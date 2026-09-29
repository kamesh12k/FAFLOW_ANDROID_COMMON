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
        start_time=time(0, 0),  # Past cutoff guaranteed at any hour of the day
        end_time=time(0, 30),
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


def test_waterfall_auto_swap_when_all_top_candidates_absent(db_session, duty_setup):
    today = date.today()
    teachers = duty_setup["teachers"]
    dept = duty_setup["dept"]

    # Delete all attendance records for today so NO teacher has checked in
    db_session.query(StaffAttendanceRecord).filter(
        StaffAttendanceRecord.attendance_date == today
    ).delete()
    db_session.commit()

    duty = CampusDuty(
        duty_type=DutyType.DISCIPLINE_DUTY,
        title="Gate Supervision",
        duty_date=today,
        start_time=time(8, 30),
        end_time=time(9, 15),
        department_id=dept.id,
        day_order=1,
        required_teachers=1,
        status=DutyStatus.PUBLISHED
    )
    db_session.add(duty)
    db_session.commit()

    # Query candidates with require_checked_in=True
    resp = CampusDutyService.evaluate_candidates(db_session, duty.id, require_checked_in=True)

    # Verify Waterfall auto-swap activated
    assert resp.fallback_applied is True
    assert "Waterfall auto-swap" in resp.fallback_message
    assert resp.suggested_candidate_id is not None

    # Verify candidates are eligible under waterfall rather than all being excluded with Score 0
    eligible = [c for c in resp.candidates if c.is_eligible]
    assert len(eligible) > 0
    assert any("Waterfall Auto-Swap" in r for r in eligible[0].reasons)
    assert eligible[0].score > 0.0

    # Verify auto_assign_duty successfully fills duty using the waterfall candidate
    assigned_duty = CampusDutyService.auto_assign_duty(db_session, duty.id)
    active_assignments = [a for a in assigned_duty.assignments if a.status == AssignmentStatus.ASSIGNED]
    assert len(active_assignments) == 1
    assert active_assignments[0].teacher_id == resp.suggested_candidate_id


def test_discipline_duty_belongs_to_block_auto_assign_staff(client, db_session, auth_headers_admin):
    """
    User Story Test:
    "A discipline duty belongs to a BLOCK. The Principal specifies how many staff are required.
    FaFlow automatically gathers eligible faculty belonging to departments located in that block,
    applies the existing faculty filtering/eligibility rules, balances workload, and assigns the required number of staff."
    """
    from app.models.campus_structure import CampusBlock, CampusFloor
    from app.models.room import Room
    from app.models.day_order_calendar import DayOrderCalendar
    from app.schemas.campus_duty import DutyGenerateRequest

    today = date.today()
    db_session.add(DayOrderCalendar(date=today, day_order=1))
    db_session.flush()

    # 1. Setup Departments
    dept_cse = Department(name="Computer Science & Engineering", code="CSE")
    dept_ece = Department(name="Electronics & Communication", code="ECE")
    dept_mech = Department(name="Mechanical Engineering", code="MECH")
    db_session.add_all([dept_cse, dept_ece, dept_mech])
    db_session.flush()

    # 2. Setup Campus Blocks
    # Block Alpha houses CSE (primary) and ECE (floor 1 rooms)
    block_alpha = CampusBlock(name="Alpha Technology Block", code="BLK-ALPHA", floors_count=2, department_id=dept_cse.id, is_active=True)
    # Block Beta houses MECH
    block_beta = CampusBlock(name="Beta Engineering Block", code="BLK-BETA", floors_count=1, department_id=dept_mech.id, is_active=True)
    db_session.add_all([block_alpha, block_beta])
    db_session.flush()

    # Floors & Rooms
    fl_g = CampusFloor(block_id=block_alpha.id, floor_number=0, floor_name="Ground Floor", display_order=0)
    fl_1 = CampusFloor(block_id=block_alpha.id, floor_number=1, floor_name="First Floor", display_order=1)
    db_session.add_all([fl_g, fl_1])
    db_session.flush()

    # Room on Floor 1 assigned to ECE (so ECE is located in Block Alpha!)
    rm_ece = Room(room_number="A-101", block_id=block_alpha.id, floor_id=fl_1.id, department_id=dept_ece.id)
    rm_cse = Room(room_number="A-G01", block_id=block_alpha.id, floor_id=fl_g.id, department_id=dept_cse.id)
    db_session.add_all([rm_ece, rm_cse])
    db_session.flush()

    # Verify Block Alpha departments resolution
    alpha_depts = CampusDutyService.get_departments_for_block(db_session, block_alpha.id)
    assert dept_cse.id in alpha_depts
    assert dept_ece.id in alpha_depts
    assert dept_mech.id not in alpha_depts

    # 3. Setup Faculty Members
    # CSE Faculty 1: Perfect candidate (free before break)
    cse_1 = User(username="cse_fac_1", name="Dr. Alan Turing", email="cse1@college.edu", password_hash="hash", role=Role.teacher, department_id=dept_cse.id, is_active=True)
    # CSE Faculty 2: Has 1 existing duty today (workload penalty test)
    cse_2 = User(username="cse_fac_2", name="Dr. Ada Lovelace", email="cse2@college.edu", password_hash="hash", role=Role.teacher, department_id=dept_cse.id, is_active=True)
    # CSE Faculty 3: On approved leave (exclusion test)
    cse_leave = User(username="cse_fac_leave", name="Prof. On Leave", email="csel@college.edu", password_hash="hash", role=Role.teacher, department_id=dept_cse.id, is_active=True)
    # ECE Faculty 1: Has class conflict (exclusion test)
    ece_conflict = User(username="ece_fac_conflict", name="Prof. Busy Signal", email="ece1@college.edu", password_hash="hash", role=Role.teacher, department_id=dept_ece.id, is_active=True)
    # ECE Faculty 2: Eligible candidate (located in Block Alpha via Room A-101)
    ece_2 = User(username="ece_fac_2", name="Dr. Claude Shannon", email="ece2@college.edu", password_hash="hash", role=Role.teacher, department_id=dept_ece.id, is_active=True)
    # MECH Faculty: Completely separate block (Block Beta) -> MUST NEVER be assigned
    mech_fac = User(username="mech_fac", name="Dr. Nikola Tesla", email="mech@college.edu", password_hash="hash", role=Role.teacher, department_id=dept_mech.id, is_active=True)

    db_session.add_all([cse_1, cse_2, cse_leave, ece_conflict, ece_2, mech_fac])
    db_session.flush()

    # Attendance check-in for active teachers
    for u in [cse_1, cse_2, ece_conflict, ece_2, mech_fac]:
        db_session.add(StaffAttendanceRecord(user_id=u.id, attendance_date=today, check_in_time=datetime.now(timezone.utc)))

    # Approved leave for CSE Faculty 3
    db_session.add(LeaveRequest(teacher_id=cse_leave.id, date=today, day_order=1, period_number=1, status=LeaveStatus.approved, reason="Medical"))

    # Break period: Morning Interval 10:45 - 11:05
    bp = DutyBreakPeriod(
        name="Morning Interval",
        start_time=time(10, 45),
        end_time=time(11, 5),
        duty_type=DutyType.DISCIPLINE_DUTY.value,
        required_teachers=1, # Default is 1, but Principal will specify 2!
        applicable_day_orders="1,2,3,4,5,6",
        department_id=dept_cse.id,
        is_active=True
    )
    db_session.add(bp)
    db_session.flush()

    # Existing duty for cse_2 earlier today (workload penalty test)
    early_duty = CampusDuty(
        duty_type=DutyType.DISCIPLINE_DUTY,
        title="Early Gate Duty",
        duty_date=today,
        start_time=time(8, 0),
        end_time=time(8, 45),
        required_teachers=1,
        status=DutyStatus.PUBLISHED
    )
    db_session.add(early_duty)
    db_session.flush()
    db_session.add(DutyAssignment(duty_id=early_duty.id, teacher_id=cse_2.id, status=AssignmentStatus.ASSIGNED))

    # Class timetable collision for ece_conflict during 10:45 - 11:05 (Period 2: 10:00 - 11:00)
    day_ord = CampusDutyService.get_day_order_for_date(db_session, today) or 1
    subj = Subject(name="Signal Processing", code="EC201", credits=3, semester=3, department_id=dept_ece.id)
    cls = Class(name="ECE-2A", section="A", semester=3, department_id=dept_ece.id)
    db_session.add_all([subj, cls])
    db_session.flush()
    slot = TimetableSlot(day_order=day_ord, period_number=2, teacher_id=ece_conflict.id, class_id=cls.id, subject_id=subj.id)
    db_session.add(slot)
    db_session.commit()

    # 4. PRINCIPAL SPECIFIES HOW MANY STAFF ARE REQUIRED (e.g. 2 staff) for BLOCK Alpha
    # Using the HTTP endpoint: POST /campus-duties/generate-discipline
    resp = client.post(
        "/campus-duties/generate-discipline",
        json={
            "target_date": str(today),
            "block_id": block_alpha.id,
            "required_teachers": 2,
            "auto_assign": True
        },
        headers=auth_headers_admin
    )
    assert resp.status_code == 200, resp.text
    duties_data = resp.json()
    assert len(duties_data) >= 1

    disc_duty = next((d for d in duties_data if "Morning Interval" in d["title"]), None)
    assert disc_duty is not None
    # Verify discipline duty belongs to BLOCK Alpha
    assert disc_duty["block_id"] == block_alpha.id
    assert disc_duty["block_name"] == block_alpha.name
    assert "Alpha Technology Block" in disc_duty["location_hierarchy"]
    # Verify Principal specified staff count
    assert disc_duty["required_teachers"] == 2
    assert disc_duty["assigned_teachers_count"] == 2

    assigned_teacher_ids = [a["teacher_id"] for a in disc_duty["assignments"]]
    assert len(assigned_teacher_ids) == 2

    # RULE CHECKS:
    # A. Mech faculty must NEVER be assigned to Block Alpha!
    assert mech_fac.id not in assigned_teacher_ids

    # B. Leave faculty must NEVER be assigned!
    assert cse_leave.id not in assigned_teacher_ids

    # C. Timetable class conflicting faculty must NEVER be assigned!
    assert ece_conflict.id not in assigned_teacher_ids

    # D. Both assigned faculty must belong to departments located in Block Alpha (CSE or ECE)
    allowed_ids = {cse_1.id, cse_2.id, ece_2.id}
    for t_id in assigned_teacher_ids:
        assert t_id in allowed_ids

    # E. Workload balancing: cse_1 (0 duties today) and ece_2 (0 duties today) prioritized over cse_2 (1 duty today)
    assert cse_1.id in assigned_teacher_ids
    assert ece_2.id in assigned_teacher_ids


def test_bug11_duty_generation_integration_all_types(client, db_session, auth_headers_admin):
    """
    Integration test per duty type (Bug 11):
    - Seeds a minimal valid campus (classes with rooms, teachers, day order).
    - Asserts each generation endpoint (Discipline, Wing, Exam) returns a non-empty, valid roster.
    - Asserts session mapping ('FN' -> 10:00-13:00, 'AN' -> 14:00-17:00) works on Exam duties.
    - Asserts Wing duties generate successfully even if blocks/floors are not configured yet (fallback to areas).
    """
    from app.models.campus_structure import CampusBlock, CampusFloor
    from app.models.room import Room
    from app.models.day_order_calendar import DayOrderCalendar

    test_date = date.today() + timedelta(days=20)
    db_session.add(DayOrderCalendar(date=test_date, day_order=1))

    # 1. Seed Department, Class, Room with bidirectional link, and Teachers
    dept = Department(name="Aeronautical Engineering", code="AERO")
    db_session.add(dept)
    db_session.flush()

    rm = Room(room_number="AERO-101", capacity=40, department_id=dept.id, is_active=True, is_exam_eligible=False)
    db_session.add(rm)
    db_session.flush()

    cls = Class(name="AERO-1A", section="A", semester=1, department_id=dept.id, default_room_id=rm.id)
    db_session.add(cls)
    db_session.flush()
    rm.primary_class_id = cls.id

    t1 = User(username="aero_t1", name="Aero Teacher 1", email="aero1@uni.edu", password_hash="hash", role=Role.teacher, department_id=dept.id, is_active=True)
    t2 = User(username="aero_t2", name="Aero Teacher 2", email="aero2@uni.edu", password_hash="hash", role=Role.teacher, department_id=dept.id, is_active=True)
    db_session.add_all([t1, t2])
    db_session.flush()

    # Staff attendance
    db_session.add(StaffAttendanceRecord(user_id=t1.id, attendance_date=test_date, check_in_time=datetime.now(timezone.utc)))
    db_session.add(StaffAttendanceRecord(user_id=t2.id, attendance_date=test_date, check_in_time=datetime.now(timezone.utc)))

    # Break period for discipline duty
    bp = DutyBreakPeriod(
        name="Aero Lunch Break",
        start_time=time(13, 0),
        end_time=time(14, 0),
        duty_type=DutyType.DISCIPLINE_DUTY.value,
        required_teachers=2,
        applicable_day_orders="1,2,3,4,5,6",
        department_id=dept.id,
        is_active=True
    )
    db_session.add(bp)
    db_session.commit()

    # 2. DISCIPLINE DUTY GENERATION
    resp_disc = client.post(
        "/campus-duties/generate-discipline",
        json={"target_date": str(test_date), "department_id": dept.id, "auto_assign": True},
        headers=auth_headers_admin
    )
    assert resp_disc.status_code == 200, resp_disc.text
    disc_data = resp_disc.json()
    assert isinstance(disc_data, list)
    assert len(disc_data) >= 1
    assert any("Lunch" in d["title"] for d in disc_data)

    # 3. WING DUTY GENERATION (Fallback to CampusArea when no blocks/floors exist)
    resp_wing_fallback = client.post(
        "/campus-duties/generate-wing-duties",
        json={"target_date": str(test_date)},
        headers=auth_headers_admin
    )
    assert resp_wing_fallback.status_code == 200, resp_wing_fallback.text
    wing_fb_data = resp_wing_fallback.json()
    assert isinstance(wing_fb_data, list)
    assert len(wing_fb_data) >= 1
    assert all(d["duty_type"] == "WING_DUTY" for d in wing_fb_data)

    # 4. WING DUTY GENERATION (With CampusBlock & Floor configured)
    test_date_2 = test_date + timedelta(days=1)
    db_session.add(DayOrderCalendar(date=test_date_2, day_order=2))
    block = CampusBlock(name="Aero Block", code="BLK-AERO", floors_count=1, department_id=dept.id, is_active=True)
    db_session.add(block)
    db_session.flush()
    floor = CampusFloor(block_id=block.id, floor_number=1, floor_name="First Floor", display_order=1)
    db_session.add(floor)
    db_session.commit()

    resp_wing = client.post(
        "/campus-duties/generate-wing-duties",
        json={"target_date": str(test_date_2), "department_id": dept.id},
        headers=auth_headers_admin
    )
    assert resp_wing.status_code == 200, resp_wing.text
    wing_data = resp_wing.json()
    assert isinstance(wing_data, list)
    assert len(wing_data) >= 1
    assert any("First Floor" in d["title"] or "BLK-AERO" in d["title"] for d in wing_data)

    # 5. EXAM DUTY GENERATION (Session FN -> 10:00 to 13:00, with fallback to active room)
    resp_exam_fn = client.post(
        "/campus-duties/generate-exam-duties",
        json={"target_date": str(test_date), "session": "FN", "department_id": dept.id},
        headers=auth_headers_admin
    )
    assert resp_exam_fn.status_code == 200, resp_exam_fn.text
    exam_fn_data = resp_exam_fn.json()
    assert isinstance(exam_fn_data, list)
    assert len(exam_fn_data) >= 1
    assert exam_fn_data[0]["start_time"] == "10:00:00"
    assert exam_fn_data[0]["end_time"] == "13:00:00"

    # 6. EXAM DUTY GENERATION (Session AN -> 14:00 to 17:00, with exam_eligible=True room)
    rm.is_exam_eligible = True
    db_session.commit()

    resp_exam_an = client.post(
        "/campus-duties/generate-exam-duties",
        json={"target_date": str(test_date_2), "session": "AN", "department_id": dept.id},
        headers=auth_headers_admin
    )
    assert resp_exam_an.status_code == 200, resp_exam_an.text
    exam_an_data = resp_exam_an.json()
    assert isinstance(exam_an_data, list)
    assert len(exam_an_data) >= 1
    assert exam_an_data[0]["start_time"] == "14:00:00"
    assert exam_an_data[0]["end_time"] == "17:00:00"
    assert exam_an_data[0]["room_id"] == rm.id





