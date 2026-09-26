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


def test_get_next_6_day_orders_and_autonomous_toggle(db_session, duty_setup):
    from datetime import date
    today = date.today()

    # Verify get_next_6_day_orders returns 6 working day orders
    day_orders = CampusDutyService.get_next_6_day_orders(db_session, start_date=today, num_day_orders=6)
    assert len(day_orders) == 6
    for do in day_orders:
        assert "date" in do
        assert "day_order" in do
        assert "day_name" in do
        assert "total_duties" in do
        assert "filled_duties" in do
        assert "unfilled_duties" in do

    # Autonomous activation for 6 day orders
    res = CampusDutyService.autonomous_activate_duties(
        db_session,
        target_date=today,
        activate_discipline=True,
        activate_wing=False,
        num_day_orders=6,
        user_id=1
    )
    assert res["success"] is True
    assert res["num_day_orders"] == 6
    assert len(res["per_day_order"]) == 6
    assert res["discipline_duties_count"] >= 1

    # Check that day_orders now reflects created duties
    updated_day_orders = CampusDutyService.get_next_6_day_orders(db_session, start_date=today, num_day_orders=6)
    first_day = updated_day_orders[0]
    assert first_day["total_duties"] >= 1


def test_configure_and_assign_block_duties_by_respected_department(db_session, duty_setup):
    from datetime import date
    from app.models.campus_structure import CampusBlock, CampusFloor
    from app.models.room import Room
    from app.schemas.campus_structure import BlockDutyConfigIn

    dept_b = duty_setup["dept"]  # CSE
    teachers = duty_setup["teachers"]

    admin_user = User(
        name="Principal Dr. Smith",
        username="principal_smith",
        email="principal@faflow.edu",
        password_hash="test_hash_principal",
        role=Role.principal,
        is_active=True
    )
    db_session.add(admin_user)

    # Create Department Mech and teacher
    mech_dept = Department(name="Mechanical Engineering", code="MECH")
    db_session.add(mech_dept)
    db_session.flush()

    mech_teacher = User(
        name="Mech Faculty",
        username="mech_fac_1",
        email="mech@faflow.edu",
        password_hash="test_hash_mech",
        role=Role.teacher,
        department_id=mech_dept.id,
        is_active=True
    )
    db_session.add(mech_teacher)
    db_session.flush()

    att = StaffAttendanceRecord(
        user_id=mech_teacher.id,
        attendance_date=date.today(),
        check_in_time=datetime.now(timezone.utc),
        check_out_time=None
    )
    db_session.add(att)
    db_session.flush()

    # Create Block B with floors and rooms mapped to CSE
    block_b = CampusBlock(
        name="B Block",
        code="BLOCK-B",
        floors_count=2,
        department_id=dept_b.id,
        is_active=True
    )
    db_session.add(block_b)
    db_session.flush()

    floor_g = CampusFloor(block_id=block_b.id, floor_number=0, floor_name="Ground Floor", display_order=0)
    floor_1 = CampusFloor(block_id=block_b.id, floor_number=1, floor_name="First Floor", display_order=1)
    db_session.add_all([floor_g, floor_1])
    db_session.flush()

    room_g1 = Room(room_number="B-G01", block_id=block_b.id, floor_id=floor_g.id, department_id=dept_b.id)
    room_11 = Room(room_number="B-101", block_id=block_b.id, floor_id=floor_1.id, department_id=dept_b.id)
    db_session.add_all([room_g1, room_11])
    db_session.commit()

    config = BlockDutyConfigIn(
        target_date=date.today(),
        scope="SPECIFIC_DATE",
        wing_duty_enabled=True,
        teachers_per_wing=1,
        discipline_duty_enabled=True,
        teachers_per_discipline=1,
        enforce_block_department_only=True
    )

    result = CampusDutyService.configure_and_assign_block_duties(
        db=db_session,
        block_id=block_b.id,
        data=config,
        current_user=admin_user
    )

    assert result.block_id == block_b.id
    assert result.total_duties_configured >= 2  # At least 2 wing duties + discipline duties
    assert result.total_teachers_assigned >= 1

    # Verify that all assigned teachers belong strictly to the block's respected department (dept_b)
    block_dept_names = result.departments
    assert dept_b.name in block_dept_names

    for assignment in result.assignments:
        assert assignment.department_name == dept_b.name
        # Mech faculty should never be assigned to Block B
        assert assignment.teacher_id != mech_teacher.id


def test_configure_block_duties_route_rbac(client, db_session, duty_setup, auth_headers_admin, auth_headers_teacher):
    from app.models.campus_structure import CampusBlock, CampusFloor

    dept_b = duty_setup["dept"]
    block = CampusBlock(
        name="C Block",
        code="BLOCK-C",
        floors_count=1,
        department_id=dept_b.id,
        is_active=True
    )
    db_session.add(block)
    db_session.flush()

    fl = CampusFloor(block_id=block.id, floor_number=0, floor_name="Ground Floor", display_order=0)
    db_session.add(fl)
    db_session.commit()

    payload = {
        "target_date": str(date.today()),
        "scope": "SPECIFIC_DATE",
        "wing_duty_enabled": True,
        "teachers_per_wing": 1,
        "discipline_duty_enabled": False,
        "teachers_per_discipline": 1,
        "enforce_block_department_only": True
    }

    # As regular teacher -> 403 Forbidden
    resp_teacher = client.post(
        f"/campus-structure/blocks/{block.id}/duties/configure-and-assign",
        json=payload,
        headers=auth_headers_teacher
    )
    assert resp_teacher.status_code == 403

    # As Admin / Principal -> 200 OK
    resp_admin = client.post(
        f"/campus-structure/blocks/{block.id}/duties/configure-and-assign",
        json=payload,
        headers=auth_headers_admin
    )
    assert resp_admin.status_code == 200
    data = resp_admin.json()
    assert data["block_id"] == block.id
    assert data["total_duties_configured"] >= 1


def test_pending_checkin_teachers_eligible_for_advance_selection(db_session, duty_setup):
    """
    Verifies that when teachers have not yet checked in today:
    1. evaluate_candidates(require_checked_in=False) still treats them as ELIGIBLE.
    2. Score is non-zero (e.g. 85.0+), not 0.0.
    3. Reason explains 'Pending check-in (Auto-swaps if absent)'.
    4. Admin can manually assign them.
    5. When require_checked_in=True, they are excluded with 'Teacher has not checked in today'.
    """
    today = date.today()
    teachers = duty_setup["teachers"]
    dept = duty_setup["dept"]

    # Delete attendance records for Teacher 1 to simulate pending check-in
    db_session.query(StaffAttendanceRecord).filter(
        StaffAttendanceRecord.user_id == teachers[0].id,
        StaffAttendanceRecord.attendance_date == today
    ).delete()
    db_session.commit()

    duty = CampusDuty(
        duty_type=DutyType.DISCIPLINE_DUTY,
        title="Gate Supervision Duty",
        duty_date=today,
        start_time=time(8, 30),
        end_time=time(9, 0),
        department_id=dept.id,
        day_order=1,
        required_teachers=1,
        status=DutyStatus.PUBLISHED
    )
    db_session.add(duty)
    db_session.commit()

    # 1. Standard candidate evaluation (for UI picker / advance scheduling)
    cand_resp = CampusDutyService.evaluate_candidates(db_session, duty.id, require_checked_in=False)
    t1_cand = next((c for c in cand_resp.candidates if c.teacher_id == teachers[0].id), None)
    assert t1_cand is not None
    assert t1_cand.is_eligible is True
    assert t1_cand.present_today is False
    assert t1_cand.score > 0.0
    assert any("Pending check-in" in r for r in t1_cand.reasons)

    # 2. Strict candidate evaluation (used by emergency auto-replace sweep)
    cand_resp_strict = CampusDutyService.evaluate_candidates(db_session, duty.id, require_checked_in=True)
    t1_strict = next((c for c in cand_resp_strict.candidates if c.teacher_id == teachers[0].id), None)
    assert t1_strict is not None
    assert t1_strict.is_eligible is False
    assert t1_strict.score == 0.0
    assert "not checked in" in t1_strict.exclusion_reason.lower()

    # 3. Manual assignment succeeds for pending check-in teacher
    assignment = CampusDutyService.manual_assign(db_session, duty.id, teachers[0].id)
    assert assignment is not None
    assert assignment.teacher_id == teachers[0].id
    assert assignment.status == AssignmentStatus.ASSIGNED


def test_auto_replace_absent_teacher_swaps_with_checked_in_candidate(db_session, duty_setup):
    """
    Verifies that if an assigned teacher is absent past the cutoff,
    auto_replace_absent_teachers automatically swaps them with an eligible candidate
    who IS checked in.
    """
    today = date.today()
    teachers = duty_setup["teachers"]
    dept = duty_setup["dept"]

    # Teacher 1 is assigned, but has NOT checked in (absent)
    db_session.query(StaffAttendanceRecord).filter(
        StaffAttendanceRecord.user_id == teachers[0].id,
        StaffAttendanceRecord.attendance_date == today
    ).delete()

    # Teachers 2, 3, 4 ARE checked in (from duty_setup)
    db_session.commit()

    duty = CampusDuty(
        duty_type=DutyType.DISCIPLINE_DUTY,
        title="Break Interval Duty",
        duty_date=today,
        start_time=time(8, 0),  # In the past relative to now, so cutoff is passed
        end_time=time(8, 30),
        department_id=dept.id,
        day_order=1,
        required_teachers=1,
        status=DutyStatus.PUBLISHED
    )
    db_session.add(duty)
    db_session.flush()

    # Assign Teacher 1 initially
    assignment = DutyAssignment(
        duty_id=duty.id,
        teacher_id=teachers[0].id,
        status=AssignmentStatus.ASSIGNED,
        role="GENERAL",
        is_manual=True,
        score=100.0
    )
    db_session.add(assignment)
    db_session.commit()

    # Trigger auto-replacement sweep
    result = CampusDutyService.auto_replace_absent_teachers(db_session, target_date=today)
    assert result["replacements_made"] >= 1

    # Reload assignments
    db_session.refresh(duty)
    replaced_a = next((a for a in duty.assignments if a.teacher_id == teachers[0].id), None)
    assert replaced_a is not None
    assert replaced_a.status == AssignmentStatus.REPLACED
    assert "Not checked in" in replaced_a.overridden_reason

    # New active assignment is created for a checked-in teacher
    active_a = next((a for a in duty.assignments if a.status == AssignmentStatus.ASSIGNED), None)
    assert active_a is not None
    assert active_a.teacher_id != teachers[0].id


