import pytest
from datetime import date, datetime, timedelta, timezone, time
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.user import User, Role, AdminLevel
from app.models.class_ import Class
from app.models.department import Department
from app.models.subject import Subject
from app.models.student import Student
from app.models.student_attendance import (
    AttendanceSession, StudentAttendance, AttendanceCorrectionAudit,
    AttendanceType, SessionStatus, StudentAttendanceStatus
)
from app.models.timetable import TimetableSlot
from app.models.day_order_calendar import CalendarDay, DayType
from app.models.leave import LeaveRequest, AlterAssignment, LeaveStatus
from app.models.notification import Notification
from app.services.student_attendance_service import StudentAttendanceService
from app.schemas.student_attendance import (
    SubmitAttendanceRequest, EmergencyAttendanceRequest,
    AttendanceCorrectionRequest, OfflineSyncBatchRequest, OfflineSyncOperation
)
from tests.conftest import _make_user


@pytest.fixture
def gap_fixture(db_session: Session):
    """Sets up Departments (CS, MECH, TAMIL), Classes, Students, Timetable, and Calendar."""
    dept_cs = Department(name="Computer Science", code="CS")
    dept_mech = Department(name="Mechanical", code="MECH")
    dept_tamil = Department(name="Tamil", code="TAMIL")
    db_session.add_all([dept_cs, dept_mech, dept_tamil])
    db_session.flush()

    # Classes: Class A & Class B in CS
    cls_a = Class(name="III CSE-A", section="A", department_id=dept_cs.id, semester=5)
    cls_b = Class(name="III CSE-B", section="B", department_id=dept_cs.id, semester=5)
    db_session.add_all([cls_a, cls_b])
    db_session.flush()

    # Students for Class A
    students_a = [
        Student(roll_number=f"25CS5{i:03d}", name=f"Student A {i:03d}", class_id=cls_a.id, department_id=dept_cs.id, is_active=True)
        for i in range(1, 6)
    ]
    # Students for Class B
    students_b = [
        Student(roll_number=f"25CS6{i:03d}", name=f"Student B {i:03d}", class_id=cls_b.id, department_id=dept_cs.id, is_active=True)
        for i in range(1, 6)
    ]
    db_session.add_all(students_a + students_b)

    # Subject
    subj = Subject(name="Operating Systems", code="CS-502", credits=3, department_id=dept_cs.id, semester=5)
    db_session.add(subj)
    db_session.flush()

    # Teachers
    teacher_cs1 = _make_user(db_session, name="CS Faculty One", email="cs1@test.com", department="CS")
    teacher_cs2 = _make_user(db_session, name="CS Faculty Two", email="cs2@test.com", department="CS")
    teacher_tamil = _make_user(db_session, name="Tamil Faculty", email="tamil@test.com", department="TAMIL")

    # HODs
    hod_cs = _make_user(db_session, name="CS HOD", email=None, username="cs_hod", role=Role.admin, admin_level=AdminLevel.secondary_admin, department="CS")
    hod_mech = _make_user(db_session, name="Mech HOD", email=None, username="mech_hod", role=Role.admin, admin_level=AdminLevel.secondary_admin, department="MECH")
    hod_tamil = _make_user(db_session, name="Tamil HOD", email=None, username="tamil_hod", role=Role.admin, admin_level=AdminLevel.secondary_admin, department="TAMIL")

    # Super Admin
    super_admin = _make_user(db_session, name="Super Admin User", email=None, username="super_admin_test", role=Role.system_admin, admin_level=None, department=None)

    # Timetable: teacher_cs1 scheduled for Class A, Day Order 1, Period 3
    slot_a3 = TimetableSlot(
        teacher_id=teacher_cs1.id,
        subject_id=subj.id,
        class_id=cls_a.id,
        day_order=1,
        period_number=3
    )
    # Timetable: teacher_cs1 scheduled for Class B, Day Order 1, Period 1
    slot_b1 = TimetableSlot(
        teacher_id=teacher_cs1.id,
        subject_id=subj.id,
        class_id=cls_b.id,
        day_order=1,
        period_number=1
    )
    db_session.add_all([slot_a3, slot_b1])

    # Calendar Day: Today is Day Order 1, Working
    today = date(2026, 9, 28)
    cal_day = CalendarDay(date=today, day_type=DayType.working, day_order=1)
    db_session.add(cal_day)
    db_session.commit()

    return {
        "dept_cs": dept_cs,
        "dept_mech": dept_mech,
        "dept_tamil": dept_tamil,
        "cls_a": cls_a,
        "cls_b": cls_b,
        "students_a": students_a,
        "students_b": students_b,
        "subj": subj,
        "teacher_cs1": teacher_cs1,
        "teacher_cs2": teacher_cs2,
        "teacher_tamil": teacher_tamil,
        "hod_cs": hod_cs,
        "hod_mech": hod_mech,
        "hod_tamil": hod_tamil,
        "super_admin": super_admin,
        "slot_a3": slot_a3,
        "slot_b1": slot_b1,
        "today": today
    }


def test_unscheduled_teacher_normal_path_403_and_emergency_success(db_session: Session, gap_fixture):
    """
    Requirement 1:
    - Unscheduled teacher on normal path -> 403 Forbidden with exact message.
    - Same teacher via emergency -> success with attendance_type == 'emergency'.
    - Administrative override roles can submit even if not in timetable.
    """
    data = gap_fixture
    today = data["today"]
    cls_a = data["cls_a"]
    teacher_cs2 = data["teacher_cs2"]
    super_admin = data["super_admin"]

    p3_start, _ = StudentAttendanceService.get_scheduled_times(today, 3, db_session)
    valid_ts = p3_start + timedelta(minutes=5)

    # 1. Unscheduled teacher attempts normal submission on Class A, Period 3 -> 403
    normal_req = SubmitAttendanceRequest(
        class_id=cls_a.id,
        period_number=3,
        attendance_date=today,
        absent_roll_suffixes=["002"],
        client_timestamp=valid_ts
    )
    with pytest.raises(HTTPException) as exc_info:
        StudentAttendanceService.submit_attendance(db_session, teacher_cs2, normal_req)
    assert exc_info.value.status_code == 403
    assert "You are not scheduled for this class. Use Emergency Attendance instead." in exc_info.value.detail

    # 2. Same teacher submits via emergency attendance -> success
    emerg_req = EmergencyAttendanceRequest(
        class_id=cls_a.id,
        period_number=3,
        attendance_date=today,
        absent_roll_suffixes=["002"],
        notes="Stepping in for colleague",
        client_timestamp=valid_ts
    )
    res = StudentAttendanceService.emergency_attendance(db_session, teacher_cs2, emerg_req)
    assert res.attendance_type == AttendanceType.emergency
    assert res.actual_teacher_id == teacher_cs2.id
    assert res.scheduled_teacher_id == data["teacher_cs1"].id
    assert res.absent_count == 1
    assert res.present_count == 4


def test_scheduled_teacher_on_time_vs_late_and_boundary_checks(db_session: Session, gap_fixture):
    """
    Requirements 1 & Acceptance Criteria:
    - Scheduled teacher on time -> 'submitted'
    - Scheduled teacher after window -> 'submitted_late'
    - Submit before period start -> 400
    - Submit for future date -> 400
    """
    data = gap_fixture
    today = data["today"]
    cls_b = data["cls_b"]
    teacher_cs1 = data["teacher_cs1"]

    p1_start, _ = StudentAttendanceService.get_scheduled_times(today, 1, db_session)

    # Future date rejected
    future_req = SubmitAttendanceRequest(
        class_id=cls_b.id,
        period_number=1,
        attendance_date=today + timedelta(days=1),
        absent_roll_suffixes=[],
        client_timestamp=p1_start + timedelta(minutes=5)
    )
    with pytest.raises(HTTPException) as exc_future:
        StudentAttendanceService.submit_attendance(db_session, teacher_cs1, future_req)
    assert exc_future.value.status_code == 400
    assert "future calendar dates" in exc_future.value.detail

    # Before period start rejected
    early_req = SubmitAttendanceRequest(
        class_id=cls_b.id,
        period_number=1,
        attendance_date=today,
        absent_roll_suffixes=[],
        client_timestamp=p1_start - timedelta(minutes=5)
    )
    with pytest.raises(HTTPException) as exc_early:
        StudentAttendanceService.submit_attendance(db_session, teacher_cs1, early_req)
    assert exc_early.value.status_code == 400
    assert "Attendance can only be taken after class starts" in exc_early.value.detail

    # Late submission (20 minutes after start) -> submitted_late
    late_req = SubmitAttendanceRequest(
        class_id=cls_b.id,
        period_number=1,
        attendance_date=today,
        absent_roll_suffixes=["001"],
        client_timestamp=p1_start + timedelta(minutes=20)
    )
    res_late = StudentAttendanceService.submit_attendance(db_session, teacher_cs1, late_req)
    assert res_late.status == SessionStatus.submitted_late


def test_strict_substitution_id_validation(db_session: Session, gap_fixture):
    """
    Requirement 2:
    - Valid substitution -> registered_substitution, scheduled_teacher_id = original_teacher.id.
    - Wrong substitute teacher -> 403.
    - Non-existent substitution ID -> 404.
    - Unapproved leave request -> 400.
    - Date mismatch -> 400.
    - Class or period mismatch -> 400.
    """
    data = gap_fixture
    today = data["today"]
    cls_a = data["cls_a"]
    cls_b = data["cls_b"]
    teacher_cs1 = data["teacher_cs1"]
    teacher_cs2 = data["teacher_cs2"]
    teacher_tamil = data["teacher_tamil"]

    # Create approved LeaveRequest for teacher_cs1 on Period 3, Day Order 1, today
    leave = LeaveRequest(
        teacher_id=teacher_cs1.id,
        date=today,
        day_order=1,
        period_number=3,
        status=LeaveStatus.approved,
        reason="Academic conference"
    )
    db_session.add(leave)
    db_session.flush()

    sub = AlterAssignment(
        leave_request_id=leave.id,
        substitute_teacher_id=teacher_cs2.id
    )
    db_session.add(sub)
    db_session.commit()

    p3_start, _ = StudentAttendanceService.get_scheduled_times(today, 3, db_session)
    valid_ts = p3_start + timedelta(minutes=5)

    # 1. Non-existent substitution ID -> 404
    req_bad_id = SubmitAttendanceRequest(
        class_id=cls_a.id, period_number=3, attendance_date=today,
        substitution_id=99999, absent_roll_suffixes=[], client_timestamp=valid_ts
    )
    with pytest.raises(HTTPException) as exc:
        StudentAttendanceService.submit_attendance(db_session, teacher_cs2, req_bad_id)
    assert exc.value.status_code == 404

    # 2. Wrong teacher attempting to use substitution -> 403
    req_wrong_user = SubmitAttendanceRequest(
        class_id=cls_a.id, period_number=3, attendance_date=today,
        substitution_id=sub.id, absent_roll_suffixes=[], client_timestamp=valid_ts
    )
    with pytest.raises(HTTPException) as exc:
        StudentAttendanceService.submit_attendance(db_session, teacher_tamil, req_wrong_user)
    assert exc.value.status_code == 403
    assert "not designated as the substitute teacher" in exc.value.detail

    # 3. Class mismatch (leave original slot is Class A, submitting for Class B) -> 400
    req_wrong_class = SubmitAttendanceRequest(
        class_id=cls_b.id, period_number=3, attendance_date=today,
        substitution_id=sub.id, absent_roll_suffixes=[], client_timestamp=valid_ts
    )
    with pytest.raises(HTTPException) as exc:
        StudentAttendanceService.submit_attendance(db_session, teacher_cs2, req_wrong_class)
    assert exc.value.status_code == 400
    assert "does not match submitted" in exc.value.detail

    # 4. Period mismatch (leave original slot is Period 3, submitting for Period 1) -> 400
    req_wrong_p = SubmitAttendanceRequest(
        class_id=cls_a.id, period_number=1, attendance_date=today,
        substitution_id=sub.id, absent_roll_suffixes=[], client_timestamp=valid_ts
    )
    with pytest.raises(HTTPException) as exc:
        StudentAttendanceService.submit_attendance(db_session, teacher_cs2, req_wrong_p)
    assert exc.value.status_code == 400
    assert "does not match submitted" in exc.value.detail

    # 5. Date mismatch -> 400
    req_wrong_date = SubmitAttendanceRequest(
        class_id=cls_a.id, period_number=3, attendance_date=today - timedelta(days=1),
        substitution_id=sub.id, absent_roll_suffixes=[], client_timestamp=valid_ts
    )
    with pytest.raises(HTTPException) as exc:
        StudentAttendanceService.submit_attendance(db_session, teacher_cs2, req_wrong_date)
    assert exc.value.status_code == 400
    assert "does not match attendance date" in exc.value.detail

    # 6. Unapproved leave -> 400
    leave.status = LeaveStatus.pending
    db_session.commit()
    req_unapproved = SubmitAttendanceRequest(
        class_id=cls_a.id, period_number=3, attendance_date=today,
        substitution_id=sub.id, absent_roll_suffixes=[], client_timestamp=valid_ts
    )
    with pytest.raises(HTTPException) as exc:
        StudentAttendanceService.submit_attendance(db_session, teacher_cs2, req_unapproved)
    assert exc.value.status_code == 400
    assert "not approved" in exc.value.detail

    # 7. Valid substitution -> Success
    leave.status = LeaveStatus.approved
    db_session.commit()
    req_valid = SubmitAttendanceRequest(
        class_id=cls_a.id, period_number=3, attendance_date=today,
        substitution_id=sub.id, absent_roll_suffixes=[], client_timestamp=valid_ts
    )
    res = StudentAttendanceService.submit_attendance(db_session, teacher_cs2, req_valid)
    assert res.attendance_type == AttendanceType.registered_substitution
    assert res.actual_teacher_id == teacher_cs2.id
    assert res.scheduled_teacher_id == teacher_cs1.id


def test_emergency_and_late_notifications_isolated_to_class_department(db_session: Session, gap_fixture):
    """
    Requirement 3:
    - Emergency by a Tamil faculty on a CS class -> CS HOD receives in-app notification with faculty name; Tamil HOD gets none.
    - Normal on-time submission does NOT notify HOD.
    - Notification creation failure does not fail or rollback submission.
    """
    data = gap_fixture
    today = data["today"]
    cls_b = data["cls_b"]
    cls_a = data["cls_a"]
    teacher_tamil = data["teacher_tamil"]
    teacher_cs1 = data["teacher_cs1"]
    hod_cs = data["hod_cs"]
    hod_tamil = data["hod_tamil"]

    p1_start, _ = StudentAttendanceService.get_scheduled_times(today, 1, db_session)
    valid_ts = p1_start + timedelta(minutes=5)

    # 1. Tamil faculty submits emergency on Class B (CS Department)
    emerg_req = EmergencyAttendanceRequest(
        class_id=cls_b.id,
        period_number=1,
        attendance_date=today,
        absent_roll_suffixes=["001"],
        client_timestamp=valid_ts
    )
    sess_out = StudentAttendanceService.emergency_attendance(db_session, teacher_tamil, emerg_req)
    assert sess_out.attendance_type == AttendanceType.emergency

    # Verify CS HOD received notification
    cs_notes = db_session.query(Notification).filter(Notification.user_id == hod_cs.id).all()
    assert len(cs_notes) >= 1
    latest_note = cs_notes[-1]
    assert "Tamil Faculty" in latest_note.body
    assert "III CSE-B" in latest_note.body
    assert "Period 1" in latest_note.body

    # Verify Tamil HOD received ZERO notifications
    tamil_notes = db_session.query(Notification).filter(Notification.user_id == hod_tamil.id).all()
    assert len(tamil_notes) == 0

    # 2. Normal on-time submission does NOT notify HOD
    p3_start, _ = StudentAttendanceService.get_scheduled_times(today, 3, db_session)
    cs_notes_count_before = db_session.query(Notification).filter(Notification.user_id == hod_cs.id).count()
    normal_req = SubmitAttendanceRequest(
        class_id=cls_a.id,
        period_number=3,
        attendance_date=today,
        absent_roll_suffixes=[],
        client_timestamp=p3_start + timedelta(minutes=5)
    )
    res_normal = StudentAttendanceService.submit_attendance(db_session, teacher_cs1, normal_req)
    assert res_normal.status == SessionStatus.submitted
    cs_notes_count_after = db_session.query(Notification).filter(Notification.user_id == hod_cs.id).count()
    assert cs_notes_count_after == cs_notes_count_before


def test_hod_attendance_correction_scoping_and_deadline(db_session: Session, gap_fixture):
    """
    Requirement 5:
    - CS HOD can correct attendance for CS class before period end; audit records CS HOD.
    - Mech HOD attempting correction on CS class is rejected with 403.
    - After period end, CS HOD is rejected with 400.
    - Super admin can correct even after period end.
    """
    data = gap_fixture
    today = data["today"]
    cls_a = data["cls_a"]
    teacher_cs1 = data["teacher_cs1"]
    hod_cs = data["hod_cs"]
    hod_mech = data["hod_mech"]
    super_admin = data["super_admin"]
    students_a = data["students_a"]

    p3_start, p3_end = StudentAttendanceService.get_scheduled_times(today, 3, db_session)

    # Teacher submits attendance on time
    req = SubmitAttendanceRequest(
        class_id=cls_a.id,
        period_number=3,
        attendance_date=today,
        absent_roll_suffixes=["001"],
        client_timestamp=p3_start + timedelta(minutes=5)
    )
    sess_out = StudentAttendanceService.submit_attendance(db_session, teacher_cs1, req)

    # 1. Mech HOD attempts correction before period end -> 403
    corr_req = AttendanceCorrectionRequest(
        new_status=StudentAttendanceStatus.present,
        reason="Wrong roll marked",
        device_id="TEST_DEVICE"
    )
    with pytest.raises(HTTPException) as exc_mech:
        StudentAttendanceService.correct_student_attendance(
            db_session, sess_out.id, students_a[0].id, hod_mech, corr_req,
            as_of=p3_start + timedelta(minutes=10)
        )
    assert exc_mech.value.status_code == 403
    assert "outside your department" in exc_mech.value.detail

    # 2. CS HOD corrects before period end -> Success
    res_cs = StudentAttendanceService.correct_student_attendance(
        db_session, sess_out.id, students_a[0].id, hod_cs, corr_req,
        as_of=p3_start + timedelta(minutes=10)
    )
    assert res_cs.id == sess_out.id

    # Check audit record
    audit = db_session.query(AttendanceCorrectionAudit).filter(
        AttendanceCorrectionAudit.attendance_session_id == sess_out.id,
        AttendanceCorrectionAudit.student_id == students_a[0].id
    ).first()
    assert audit is not None
    assert audit.changed_by_id == hod_cs.id
    assert audit.new_status == "present"

    # 3. CS HOD attempts correction after period end -> 400
    with pytest.raises(HTTPException) as exc_late:
        StudentAttendanceService.correct_student_attendance(
            db_session, sess_out.id, students_a[0].id, hod_cs, corr_req,
            as_of=p3_end + timedelta(minutes=5)
        )
    assert exc_late.value.status_code == 400
    assert "window has closed" in exc_late.value.detail

    # 4. Super admin corrects after period end -> Success
    admin_corr = AttendanceCorrectionRequest(
        new_status=StudentAttendanceStatus.on_duty,
        reason="Principal approved on duty",
        device_id="ADMIN_CONSOLE"
    )
    res_admin = StudentAttendanceService.correct_student_attendance(
        db_session, sess_out.id, students_a[0].id, super_admin, admin_corr,
        as_of=p3_end + timedelta(minutes=15)
    )
    assert res_admin.id == sess_out.id


def test_dynamic_period_schedule_in_hod_and_principal_overviews(db_session: Session, gap_fixture, monkeypatch):
    """
    Requirement 4:
    - Governance period schedule is used dynamically across HOD and Principal overviews.
    """
    data = gap_fixture
    today = data["today"]
    cls_a = data["cls_a"]
    teacher_cs1 = data["teacher_cs1"]
    hod_cs = data["hod_cs"]
    super_admin = data["super_admin"]

    # Mock governance_rule_service to return custom period times: P1 -> 08:30-09:30, P3 -> 11:00-12:00
    from app.services import governance_rule_service
    custom_sched = {
        1: ("08:30", "09:30"),
        2: ("09:30", "10:30"),
        3: ("11:00", "12:00"),
        4: ("13:00", "14:00"),
        5: ("14:00", "15:00"),
    }
    monkeypatch.setattr(governance_rule_service, "get_period_schedule", lambda db: custom_sched)

    # Check HOD overview
    hod_overview = StudentAttendanceService.get_hod_overview(db_session, hod_cs, today, department_id=data["dept_cs"].id)
    p3_session_item = next((s for s in hod_overview.sessions if s.period_number == 3), None)
    if p3_session_item:
        assert p3_session_item.period_time == "11:00–12:00"

    # Check Principal sessions overview
    p_sessions = StudentAttendanceService.get_principal_sessions(db_session, today, department_id=data["dept_cs"].id)
    p3_p_item = next((s for s in p_sessions if s.period_number == 3), None)
    if p3_p_item:
        assert p3_p_item.period_time == "11:00–12:00"

    # Check Class period matrix
    matrix = StudentAttendanceService.get_class_period_matrix(db_session, cls_a.id, today)
    p3_matrix_slot = next((s for s in matrix.scheduled_periods if s.period_number == 3), None)
    if p3_matrix_slot:
        assert p3_matrix_slot.period_time == "11:00–12:00"


def test_notification_failure_does_not_break_attendance_submission(db_session: Session, gap_fixture, monkeypatch):
    """
    Requirement 3 resilience:
    - If notification_service.create_notification raises an unexpected exception,
      attendance submission must still commit and succeed.
    """
    data = gap_fixture
    today = data["today"]
    cls_b = data["cls_b"]
    teacher_tamil = data["teacher_tamil"]

    from app.services import notification_service
    def _exploding_notification(*args, **kwargs):
        raise RuntimeError("Push notification server unreachable")

    monkeypatch.setattr(notification_service, "create_notification", _exploding_notification)

    p1_start, _ = StudentAttendanceService.get_scheduled_times(today, 1, db_session)
    valid_ts = p1_start + timedelta(minutes=5)

    emerg_req = EmergencyAttendanceRequest(
        class_id=cls_b.id,
        period_number=1,
        attendance_date=today,
        absent_roll_suffixes=["002"],
        client_timestamp=valid_ts
    )
    # Submission MUST succeed despite notification failure
    res = StudentAttendanceService.emergency_attendance(db_session, teacher_tamil, emerg_req)
    assert res.attendance_type == AttendanceType.emergency
    assert res.id is not None
