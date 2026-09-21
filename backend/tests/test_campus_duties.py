import pytest
from datetime import date, time, datetime, timedelta, timezone
from app.models.user import User, Role
from app.models.department import Department
from app.models.subject import Subject
from app.models.class_ import Class
from app.models.timetable import TimetableSlot
from app.models.leave import LeaveRequest, LeaveStatus
from app.models.staff_attendance import StaffAttendanceRecord
from app.models.campus_duty import (
    CampusArea, DutyBreakPeriod, CampusDuty, DutyAssignment,
    DutyType, DutyStatus, AssignmentStatus
)
from app.services.campus_duty_service import CampusDutyService
from app.schemas.campus_duty import CampusDutyCreate


@pytest.fixture
def duty_setup(db_session):
    dept = Department(name="Computer Science", code="CS")
    db_session.add(dept)
    db_session.flush()

    # Create 4 teachers
    teachers = []
    for i in range(1, 5):
        t = User(
            username=f"cs_teacher_{i}",
            name=f"CS Faculty {i}",
            email=f"cs{i}@college.edu",
            password_hash="dummy_hash_for_test",
            role=Role.teacher,
            department_id=dept.id,
            is_active=True
        )
        db_session.add(t)
        teachers.append(t)
    db_session.flush()

    # Subject & Class
    subj = Subject(name="Operating Systems", code="CS301", credits=4, semester=5, department_id=dept.id)
    cls = Class(name="CSE-3A", section="A", semester=5, department_id=dept.id)
    db_session.add_all([subj, cls])
    db_session.flush()

    # Break period: Lunch Break 12:35 to 13:35, preceding period 3
    bp = DutyBreakPeriod(
        name="Lunch Break",
        start_time=time(12, 35),
        end_time=time(13, 35),
        duty_type=DutyType.DISCIPLINE_DUTY.value,
        required_teachers=2,
        preceding_period_number=3,
        applicable_day_orders="1,2,3,4,5,6",
        department_id=dept.id,
        is_active=True
    )
    db_session.add(bp)

    # Check-in attendance for all teachers today
    today = date.today()
    for t in teachers:
        att = StaffAttendanceRecord(
            user_id=t.id,
            attendance_date=today,
            check_in_time=datetime.now(timezone.utc),
            check_out_time=None
        )
        db_session.add(att)

    db_session.commit()

    return {
        "dept": dept,
        "teachers": teachers,
        "subject": subj,
        "class": cls,
        "break_period": bp,
    }


def test_generate_discipline_duties(db_session, duty_setup):
    today = date.today()
    duties = CampusDutyService.generate_discipline_duties(db_session, target_date=today, department_id=duty_setup["dept"].id)
    assert len(duties) >= 1
    lunch_duty = next((d for d in duties if "Lunch" in d.title), None)
    assert lunch_duty is not None
    assert lunch_duty.required_teachers == 2
    assert lunch_duty.start_time == time(12, 35)


def test_free_period_before_break_preference(db_session, duty_setup):
    today = date.today()
    teachers = duty_setup["teachers"]
    dept = duty_setup["dept"]
    bp = duty_setup["break_period"]

    duty = CampusDuty(
        duty_type=DutyType.DISCIPLINE_DUTY,
        title="Lunch Break Duty",
        duty_date=today,
        start_time=time(12, 35),
        end_time=time(13, 35),
        break_period_id=bp.id,
        department_id=dept.id,
        day_order=1,
        required_teachers=2,
        status=DutyStatus.PUBLISHED
    )
    db_session.add(duty)
    db_session.commit()
    db_session.refresh(duty)

    # Teacher 1 has class in Period 3 (11:40 - 12:35, right before lunch)
    slot1 = TimetableSlot(
        day_order=1,
        period_number=3,
        teacher_id=teachers[0].id,
        class_id=duty_setup["class"].id,
        subject_id=duty_setup["subject"].id
    )
    db_session.add(slot1)

    # Teacher 2 has NO class in Period 3 (FREE before lunch)
    # Teacher 3 has class in Period 4 (13:35 - 14:30, after lunch)
    slot3 = TimetableSlot(
        day_order=1,
        period_number=4,
        teacher_id=teachers[2].id,
        class_id=duty_setup["class"].id,
        subject_id=duty_setup["subject"].id
    )
    db_session.add(slot3)
    db_session.commit()

    cand_resp = CampusDutyService.evaluate_candidates(db_session, duty.id)
    candidates = cand_resp.candidates

    t2_cand = next((c for c in candidates if c.teacher_id == teachers[1].id), None)
    t1_cand = next((c for c in candidates if c.teacher_id == teachers[0].id), None)

    assert t2_cand is not None
    assert t1_cand is not None
    # Teacher 2 is free in preceding period 3, so receives +50 pts bonus
    assert t2_cand.free_before_break is True
    assert t2_cand.score > t1_cand.score
    assert any("Free in preceding period" in r for r in t2_cand.reasons)


def test_leave_teacher_excluded(db_session, duty_setup):
    today = date.today()
    teachers = duty_setup["teachers"]
    dept = duty_setup["dept"]

    duty = CampusDuty(
        duty_type=DutyType.DISCIPLINE_DUTY,
        title="Morning Interval Duty",
        duty_date=today,
        start_time=time(11, 15),
        end_time=time(11, 40),
        department_id=dept.id,
        day_order=1,
        required_teachers=1,
        status=DutyStatus.PUBLISHED
    )
    db_session.add(duty)
    db_session.flush()

    # Teacher 1 is on approved leave today
    leave = LeaveRequest(
        teacher_id=teachers[0].id,
        date=today,
        day_order=1,
        period_number=1,
        reason="Medical emergency",
        status=LeaveStatus.approved
    )
    db_session.add(leave)
    db_session.commit()

    cand_resp = CampusDutyService.evaluate_candidates(db_session, duty.id)
    t1_cand = next((c for c in cand_resp.candidates if c.teacher_id == teachers[0].id), None)
    assert t1_cand is not None
    assert t1_cand.is_eligible is False
    assert "leave" in t1_cand.exclusion_reason.lower()


def test_auto_assignment_and_idempotency(db_session, duty_setup):
    today = date.today()
    dept = duty_setup["dept"]

    duty = CampusDuty(
        duty_type=DutyType.DISCIPLINE_DUTY,
        title="Interval Duty",
        duty_date=today,
        start_time=time(11, 15),
        end_time=time(11, 40),
        department_id=dept.id,
        day_order=1,
        required_teachers=2,
        status=DutyStatus.PUBLISHED
    )
    db_session.add(duty)
    db_session.commit()
    db_session.refresh(duty)

    # First auto-assign
    updated1 = CampusDutyService.auto_assign_duty(db_session, duty.id)
    active_assignments1 = [a for a in updated1.assignments if a.status == AssignmentStatus.ASSIGNED]
    assert len(active_assignments1) == 2

    # Second auto-assign should be idempotent and not add duplicates
    updated2 = CampusDutyService.auto_assign_duty(db_session, duty.id)
    active_assignments2 = [a for a in updated2.assignments if a.status == AssignmentStatus.ASSIGNED]
    assert len(active_assignments2) == 2


def test_locked_duty_protection(db_session, duty_setup):
    today = date.today()
    dept = duty_setup["dept"]

    duty = CampusDuty(
        duty_type=DutyType.WING_DUTY,
        title="Main Block Wing Duty",
        duty_date=today,
        start_time=time(10, 0),
        end_time=time(11, 0),
        department_id=dept.id,
        required_teachers=1,
        status=DutyStatus.PUBLISHED
    )
    db_session.add(duty)
    db_session.commit()

    # Lock duty
    CampusDutyService.set_lock_duty(db_session, duty.id, lock=True, reason="HOD locked for inspection")

    with pytest.raises(Exception) as exc_info:
        CampusDutyService.auto_assign_duty(db_session, duty.id)
    assert "locked" in str(exc_info.value).lower()


def test_manual_override_and_replacement(db_session, duty_setup):
    today = date.today()
    teachers = duty_setup["teachers"]
    dept = duty_setup["dept"]

    duty = CampusDuty(
        duty_type=DutyType.EXAM_DUTY,
        title="Midterm Exam Hall A",
        duty_date=today,
        start_time=time(9, 30),
        end_time=time(12, 30),
        department_id=dept.id,
        required_teachers=1,
        status=DutyStatus.PUBLISHED
    )
    db_session.add(duty)
    db_session.commit()

    # Assign Teacher 1 manually
    assignment = CampusDutyService.manual_assign(db_session, duty.id, teachers[0].id)
    assert assignment.teacher_id == teachers[0].id

    # Override with Teacher 2
    new_assignment = CampusDutyService.override_assignment(
        db_session,
        assignment.id,
        new_teacher_id=teachers[1].id,
        reason="Teacher 1 assigned to external duty"
    )
    assert new_assignment.teacher_id == teachers[1].id
    assert new_assignment.status == AssignmentStatus.ASSIGNED

    # Verify old assignment status is OVERRIDDEN
    db_session.refresh(assignment)
    assert assignment.status == AssignmentStatus.OVERRIDDEN
