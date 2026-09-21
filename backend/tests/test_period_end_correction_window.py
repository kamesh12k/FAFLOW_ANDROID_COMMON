"""
Comprehensive Test Suite for Period-End Student Attendance Correction Window
=============================================================================
Verifies that teachers can correct student attendance ONLY until the configured
END TIME of the same academic period (now < period_end_dt in UTC).
At now >= period_end_dt, corrections are strictly blocked with HTTP 400.
Admin/Principal override is preserved.
"""
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.models.user import User, Role
from app.models.user import User, Role
from app.models.class_ import Class
from app.models.department import Department
from app.models.subject import Subject
from app.models.student import Student
from app.models.timetable import TimetableSlot
from app.models.day_order_calendar import CalendarDay, DayType
from app.models.student_attendance import (
    AttendanceSession, StudentAttendance, StudentAttendanceStatus, SessionStatus
)
from app.schemas.student_attendance import (
    SubmitAttendanceRequest, AttendanceCorrectionRequest, OfflineSyncBatchRequest,
    OfflineSyncOperation
)
from app.services.student_attendance_service import StudentAttendanceService
from app.services import governance_rule_service

TZ_KOLKATA = ZoneInfo("Asia/Kolkata")


@pytest.fixture
def correction_test_env(db_session, test_teacher, test_principal):
    """Sets up a clean academic environment with periods, calendar, and students."""
    # Ensure fresh department and class
    dept = Department(name="Period Test Dept", code="PTD")
    db_session.add(dept)
    db_session.flush()

    cls = Class(name="IV CSE-A", section="A", department_id=dept.id, semester=7)
    db_session.add(cls)
    db_session.flush()

    students = []
    for i in range(1, 6):
        st = Student(
            roll_number=f"26CS7{i:03d}",
            name=f"Student {i:03d}",
            class_id=cls.id,
            department_id=dept.id,
            is_active=True
        )
        students.append(st)
    db_session.add_all(students)

    subj = Subject(name="Distributed Systems", code="CS-701", credits=4, department_id=dept.id, semester=7)
    db_session.add(subj)
    db_session.flush()

    # Slot: Day Order 1, Period 1 (09:20 - 10:20 IST)
    slot1 = TimetableSlot(teacher_id=test_teacher.id, subject_id=subj.id, class_id=cls.id, day_order=1, period_number=1)
    # Slot: Day Order 1, Period 2 (10:25 - 11:25 IST)
    slot2 = TimetableSlot(teacher_id=test_teacher.id, subject_id=subj.id, class_id=cls.id, day_order=1, period_number=2)
    db_session.add_all([slot1, slot2])

    test_date = date(2026, 9, 22)
    cal_day = CalendarDay(date=test_date, day_type=DayType.working, day_order=1)
    db_session.add(cal_day)
    db_session.commit()

    return {
        "dept": dept,
        "class": cls,
        "students": students,
        "subject": subj,
        "date": test_date,
        "teacher": test_teacher,
        "principal": test_principal
    }


def test_early_on_time_submission_and_correction_allowed(db_session, correction_test_env):
    """Case 1: Early submission (09:25) -> On-time, correction allowed until period end (10:20)."""
    env = correction_test_env
    t_date = env["date"]

    # Period 1 is 09:20 -> 10:20 IST.
    # Submit at 09:25 IST
    submit_time = datetime.combine(t_date, time(9, 25), tzinfo=TZ_KOLKATA).astimezone(timezone.utc)
    req = SubmitAttendanceRequest(
        class_id=env["class"].id,
        period_number=1,
        attendance_date=t_date,
        absent_roll_suffixes=["001"],
        client_timestamp=submit_time
    )
    sess = StudentAttendanceService.submit_attendance(db_session, env["teacher"], req)
    assert sess.status == SessionStatus.submitted

    # Correct at 09:30 IST (before period end)
    corr_time = datetime.combine(t_date, time(9, 30), tzinfo=TZ_KOLKATA).astimezone(timezone.utc)
    st1 = env["students"][0]
    corr_req = AttendanceCorrectionRequest(new_status=StudentAttendanceStatus.present, reason="Arrived with bus slip")
    updated = StudentAttendanceService.correct_student_attendance(
        db_session, sess.id, st1.id, env["teacher"], corr_req, as_of=corr_time
    )
    assert updated.absent_count == 0
    assert updated.present_count == 5


def test_late_submission_still_allows_correction_until_period_end(db_session, correction_test_env):
    """Case 3: Late submission (09:50) -> Submitted late, but teacher CAN still correct until 10:20."""
    env = correction_test_env
    t_date = env["date"]

    # Period 1 starts at 09:20. 15-min submission cutoff is 09:35. Teacher submits at 09:50.
    submit_time = datetime.combine(t_date, time(9, 50), tzinfo=TZ_KOLKATA).astimezone(timezone.utc)
    req = SubmitAttendanceRequest(
        class_id=env["class"].id,
        period_number=1,
        attendance_date=t_date,
        absent_roll_suffixes=["002"],
        client_timestamp=submit_time
    )
    sess = StudentAttendanceService.submit_attendance(db_session, env["teacher"], req)
    assert sess.status == SessionStatus.submitted_late

    # Teacher corrects at 10:10 (before 10:20 period end) -> ALLOWED!
    corr_time = datetime.combine(t_date, time(10, 10), tzinfo=TZ_KOLKATA).astimezone(timezone.utc)
    st2 = env["students"][1]
    corr_req = AttendanceCorrectionRequest(new_status=StudentAttendanceStatus.present, reason="Late correction")
    updated = StudentAttendanceService.correct_student_attendance(
        db_session, sess.id, st2.id, env["teacher"], corr_req, as_of=corr_time
    )
    assert updated.absent_count == 0


def test_correction_boundary_10_19_59_vs_10_20_00_vs_10_20_01(db_session, correction_test_env):
    """Cases 4, 5, 6:
       10:19:59 IST -> Allowed
       10:20:00 IST -> Blocked (Exact boundary)
       10:20:01 IST -> Blocked (After period end)
    """
    env = correction_test_env
    t_date = env["date"]

    submit_time = datetime.combine(t_date, time(9, 25), tzinfo=TZ_KOLKATA).astimezone(timezone.utc)
    req = SubmitAttendanceRequest(
        class_id=env["class"].id,
        period_number=1,
        attendance_date=t_date,
        absent_roll_suffixes=["001", "002"],
        client_timestamp=submit_time
    )
    sess = StudentAttendanceService.submit_attendance(db_session, env["teacher"], req)

    st1 = env["students"][0]
    st2 = env["students"][1]
    corr_req = AttendanceCorrectionRequest(new_status=StudentAttendanceStatus.present, reason="Boundary test")

    # 1. At 10:19:59 IST -> 1 second BEFORE period end -> ALLOWED
    time_10_19_59 = datetime.combine(t_date, time(10, 19, 59), tzinfo=TZ_KOLKATA).astimezone(timezone.utc)
    upd1 = StudentAttendanceService.correct_student_attendance(
        db_session, sess.id, st1.id, env["teacher"], corr_req, as_of=time_10_19_59
    )
    assert upd1.absent_count == 1

    # 2. At 10:20:00 IST -> EXACT period end -> BLOCKED
    time_10_20_00 = datetime.combine(t_date, time(10, 20, 0), tzinfo=TZ_KOLKATA).astimezone(timezone.utc)
    with pytest.raises(HTTPException) as exc_info_exact:
        StudentAttendanceService.correct_student_attendance(
            db_session, sess.id, st2.id, env["teacher"], corr_req, as_of=time_10_20_00
        )
    assert exc_info_exact.value.status_code == 400
    assert "Student attendance correction window has closed for this period." in str(exc_info_exact.value.detail)

    # 3. At 10:20:01 IST -> 1 second AFTER period end -> BLOCKED
    time_10_20_01 = datetime.combine(t_date, time(10, 20, 1), tzinfo=TZ_KOLKATA).astimezone(timezone.utc)
    with pytest.raises(HTTPException) as exc_info_after:
        StudentAttendanceService.correct_student_attendance(
            db_session, sess.id, st2.id, env["teacher"], corr_req, as_of=time_10_20_01
        )
    assert exc_info_after.value.status_code == 400
    assert "Student attendance correction window has closed for this period." in str(exc_info_after.value.detail)


def test_admin_principal_override_after_period_end(db_session, correction_test_env):
    """Case 12: Admin / Principal CAN correct student attendance even after period has ended."""
    env = correction_test_env
    t_date = env["date"]

    submit_time = datetime.combine(t_date, time(9, 25), tzinfo=TZ_KOLKATA).astimezone(timezone.utc)
    req = SubmitAttendanceRequest(
        class_id=env["class"].id,
        period_number=1,
        attendance_date=t_date,
        absent_roll_suffixes=["003"],
        client_timestamp=submit_time
    )
    sess = StudentAttendanceService.submit_attendance(db_session, env["teacher"], req)

    st3 = env["students"][2]
    # Attempt at 15:00 IST (hours after period 1 ended)
    time_15_00 = datetime.combine(t_date, time(15, 0), tzinfo=TZ_KOLKATA).astimezone(timezone.utc)
    corr_req = AttendanceCorrectionRequest(new_status=StudentAttendanceStatus.present, reason="Principal administrative review")

    # Principal performs correction -> ALLOWED
    upd = StudentAttendanceService.correct_student_attendance(
        db_session, sess.id, st3.id, env["principal"], corr_req, as_of=time_15_00
    )
    assert upd.absent_count == 0


def test_different_period_deadlines_independent(db_session, correction_test_env):
    """Case 7: Period 1 (ends 10:20) and Period 2 (ends 11:25) have independent deadlines."""
    env = correction_test_env
    t_date = env["date"]

    # Submit for Period 1
    req1 = SubmitAttendanceRequest(class_id=env["class"].id, period_number=1, attendance_date=t_date, absent_roll_suffixes=["001"])
    sess1 = StudentAttendanceService.submit_attendance(db_session, env["teacher"], req1)

    # Submit for Period 2
    req2 = SubmitAttendanceRequest(class_id=env["class"].id, period_number=2, attendance_date=t_date, absent_roll_suffixes=["002"])
    sess2 = StudentAttendanceService.submit_attendance(db_session, env["teacher"], req2)

    # At 10:30 IST:
    # Period 1 is CLOSED (ended 10:20)
    # Period 2 is OPEN (ends 11:25)
    time_10_30 = datetime.combine(t_date, time(10, 30), tzinfo=TZ_KOLKATA).astimezone(timezone.utc)
    corr_req = AttendanceCorrectionRequest(new_status=StudentAttendanceStatus.present, reason="Test")

    # Period 1 rejected
    with pytest.raises(HTTPException):
        StudentAttendanceService.correct_student_attendance(
            db_session, sess1.id, env["students"][0].id, env["teacher"], corr_req, as_of=time_10_30
        )

    # Period 2 accepted
    upd2 = StudentAttendanceService.correct_student_attendance(
        db_session, sess2.id, env["students"][1].id, env["teacher"], corr_req, as_of=time_10_30
    )
    assert upd2.absent_count == 0


def test_offline_sync_correction_rejected_after_period_end(db_session, correction_test_env):
    """Case 13: Queued offline CORRECTION operation processed after period end is safely rejected."""
    env = correction_test_env
    t_date = env["date"]

    req = SubmitAttendanceRequest(class_id=env["class"].id, period_number=1, attendance_date=t_date, absent_roll_suffixes=["001"])
    sess = StudentAttendanceService.submit_attendance(db_session, env["teacher"], req)

    # Make session's period end be in the past
    sess_obj = db_session.query(AttendanceSession).filter(AttendanceSession.id == sess.id).first()
    sess_obj.correction_deadline = datetime.now(timezone.utc) - timedelta(minutes=5)
    db_session.commit()

    # Create batch sync request containing an expired correction
    batch = OfflineSyncBatchRequest(
        device_id="TEST_DEVICE_01",
        operations=[
            OfflineSyncOperation(
                operation_id="sync-corr-001",
                idempotency_key="idemp-corr-001",
                operation_type="CORRECTION",
                payload={
                    "session_id": sess.id,
                    "student_id": env["students"][0].id,
                    "new_status": "present",
                    "reason": "Queued offline edit"
                }
            )
        ]
    )

    sync_response = StudentAttendanceService.process_sync_batch(db_session, env["teacher"], batch)
    assert sync_response.failed_count == 1
    assert sync_response.synced_count == 0
    res0 = sync_response.results[0]
    assert res0.success is False
    assert "correction window has closed" in res0.message.lower()


def test_dynamic_period_schedule_changes_correction_deadline(db_session, correction_test_env):
    """Case 10: Admin dynamically shifts Period 1 from 09:20–10:20 to 09:30–10:30.
    The teacher correction deadline automatically shifts to 10:30 without code changes."""
    env = correction_test_env
    t_date = env["date"]

    # 1. Update period schedule via governance service: Period 1 now ends at 10:30 (and preserve full 5-period schedule)
    extended_periods = [
        {"period_number": 1, "name": "Period 1 Extended", "start_time": "09:30", "end_time": "10:30", "is_enabled": True},
        {"period_number": 2, "name": "Period 2", "start_time": "10:35", "end_time": "11:35", "is_enabled": True},
        {"period_number": 3, "name": "Period 3", "start_time": "11:40", "end_time": "12:35", "is_enabled": True},
        {"period_number": 4, "name": "Period 4", "start_time": "13:35", "end_time": "14:30", "is_enabled": True},
        {"period_number": 5, "name": "Period 5", "start_time": "14:55", "end_time": "15:50", "is_enabled": True},
    ]
    default_periods = [
        {"period_number": 1, "name": "Period 1", "start_time": "09:20", "end_time": "10:20", "is_enabled": True},
        {"period_number": 2, "name": "Period 2", "start_time": "10:25", "end_time": "11:25", "is_enabled": True},
        {"period_number": 3, "name": "Period 3", "start_time": "11:40", "end_time": "12:35", "is_enabled": True},
        {"period_number": 4, "name": "Period 4", "start_time": "13:35", "end_time": "14:30", "is_enabled": True},
        {"period_number": 5, "name": "Period 5", "start_time": "14:55", "end_time": "15:50", "is_enabled": True},
    ]

    try:
        governance_rule_service.update_periods(db_session, extended_periods, actor=env["principal"])

        # 2. Submit attendance for Period 1
        submit_time = datetime.combine(t_date, time(9, 35), tzinfo=TZ_KOLKATA).astimezone(timezone.utc)
        req = SubmitAttendanceRequest(
            class_id=env["class"].id,
            period_number=1,
            attendance_date=t_date,
            absent_roll_suffixes=["001"],
            client_timestamp=submit_time
        )
        sess = StudentAttendanceService.submit_attendance(db_session, env["teacher"], req)

        # 3. Expected deadline is now 10:30 IST
        expected_deadline_utc = datetime.combine(t_date, time(10, 30), tzinfo=TZ_KOLKATA).astimezone(timezone.utc)
        assert sess.correction_deadline == expected_deadline_utc

        # 4. At 10:25 IST (which was previously past the old 10:20 deadline):
        # Under the new 10:30 schedule, 10:25 is BEFORE period end -> ALLOWED!
        time_10_25 = datetime.combine(t_date, time(10, 25), tzinfo=TZ_KOLKATA).astimezone(timezone.utc)
        corr_req = AttendanceCorrectionRequest(new_status=StudentAttendanceStatus.present, reason="New schedule test")
        upd = StudentAttendanceService.correct_student_attendance(
            db_session, sess.id, env["students"][0].id, env["teacher"], corr_req, as_of=time_10_25
        )
        assert upd.absent_count == 0

        # 5. At 10:30:00 IST -> Exact new period end -> BLOCKED
        time_10_30 = datetime.combine(t_date, time(10, 30, 0), tzinfo=TZ_KOLKATA).astimezone(timezone.utc)
        with pytest.raises(HTTPException) as exc:
            StudentAttendanceService.correct_student_attendance(
                db_session, sess.id, env["students"][0].id, env["teacher"], corr_req, as_of=time_10_30
            )
        assert exc.value.status_code == 400
        assert "Student attendance correction window has closed for this period." in str(exc.value.detail)
    finally:
        governance_rule_service.update_periods(db_session, default_periods, actor=env["principal"])

