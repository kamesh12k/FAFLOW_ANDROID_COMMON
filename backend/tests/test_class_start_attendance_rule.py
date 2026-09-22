"""
Test Suite for Class Start Time Student Attendance Rule
======================================================
Verifies the institutional business rule:
- Teachers can ONLY take student attendance AFTER the scheduled class has started (sub_time >= start_time).
- Submitting attendance before class starts is strictly rejected with HTTP 400.
- On-time (within 15 min window) vs late submissions (after 15 min window or after class ends) are properly categorized.
- Admin / Principal / System Admin retain administrative override to submit at any time.
- Offline sync batches enforce the class start timing rule.
"""
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo
import pytest
from fastapi import HTTPException

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
    SubmitAttendanceRequest, EmergencyAttendanceRequest, OfflineSyncBatchRequest,
    OfflineSyncOperation
)
from app.services.student_attendance_service import StudentAttendanceService

TZ_KOLKATA = ZoneInfo("Asia/Kolkata")


@pytest.fixture
def class_start_test_env(db_session, test_teacher, test_principal):
    """Sets up a clean test department, class, students, and timetable slot."""
    dept = Department(name="Class Start Test Dept", code="CSTD")
    db_session.add(dept)
    db_session.flush()

    cls = Class(name="III CSE-B", section="B", department_id=dept.id, semester=5)
    db_session.add(cls)
    db_session.flush()

    students = []
    for i in range(1, 6):
        st = Student(
            roll_number=f"26CS5{i:03d}",
            name=f"Student {i:03d}",
            class_id=cls.id,
            department_id=dept.id,
            is_active=True
        )
        students.append(st)
    db_session.add_all(students)

    subj = Subject(name="Operating Systems", code="CS-501", credits=4, department_id=dept.id, semester=5)
    db_session.add(subj)
    db_session.flush()

    # Slot: Day Order 1, Period 1 (09:20 - 10:20 IST)
    slot1 = TimetableSlot(teacher_id=test_teacher.id, subject_id=subj.id, class_id=cls.id, day_order=1, period_number=1)
    db_session.add(slot1)

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


def test_submission_before_class_starts_is_strictly_blocked(db_session, class_start_test_env):
    """Teacher attempts to submit attendance at 09:15 IST (5 minutes before Period 1 starts at 09:20)."""
    env = class_start_test_env
    t_date = env["date"]

    # 09:15 IST -> 5 mins before 09:20 start
    before_class_time = datetime.combine(t_date, time(9, 15), tzinfo=TZ_KOLKATA).astimezone(timezone.utc)
    req = SubmitAttendanceRequest(
        class_id=env["class"].id,
        period_number=1,
        attendance_date=t_date,
        absent_roll_suffixes=["001"],
        client_timestamp=before_class_time
    )

    with pytest.raises(HTTPException) as exc_info:
        StudentAttendanceService.submit_attendance(db_session, env["teacher"], req)

    assert exc_info.value.status_code == 400
    assert "Attendance can only be taken after class starts" in str(exc_info.value.detail)


def test_submission_at_exact_class_start_time_allowed(db_session, class_start_test_env):
    """Teacher submits at exactly 09:20:00 IST (exact class start time) -> Accepted."""
    env = class_start_test_env
    t_date = env["date"]

    exact_start_time = datetime.combine(t_date, time(9, 20, 0), tzinfo=TZ_KOLKATA).astimezone(timezone.utc)
    req = SubmitAttendanceRequest(
        class_id=env["class"].id,
        period_number=1,
        attendance_date=t_date,
        absent_roll_suffixes=["001"],
        client_timestamp=exact_start_time
    )

    sess = StudentAttendanceService.submit_attendance(db_session, env["teacher"], req)
    assert sess.status == SessionStatus.submitted
    assert sess.present_count == 4
    assert sess.absent_count == 1


def test_submission_during_class_on_time_allowed(db_session, class_start_test_env):
    """Teacher submits at 09:25 IST (5 minutes after class started, within 15 min window) -> Submitted on time."""
    env = class_start_test_env
    t_date = env["date"]

    during_class_time = datetime.combine(t_date, time(9, 25), tzinfo=TZ_KOLKATA).astimezone(timezone.utc)
    req = SubmitAttendanceRequest(
        class_id=env["class"].id,
        period_number=1,
        attendance_date=t_date,
        absent_roll_suffixes=["002"],
        client_timestamp=during_class_time
    )

    sess = StudentAttendanceService.submit_attendance(db_session, env["teacher"], req)
    assert sess.status == SessionStatus.submitted


def test_submission_after_window_marked_submitted_late(db_session, class_start_test_env):
    """Teacher submits at 09:40 IST (20 minutes after class started) -> Allowed but flagged submitted_late."""
    env = class_start_test_env
    t_date = env["date"]

    late_time = datetime.combine(t_date, time(9, 40), tzinfo=TZ_KOLKATA).astimezone(timezone.utc)
    req = SubmitAttendanceRequest(
        class_id=env["class"].id,
        period_number=1,
        attendance_date=t_date,
        absent_roll_suffixes=["002"],
        client_timestamp=late_time
    )

    sess = StudentAttendanceService.submit_attendance(db_session, env["teacher"], req)
    assert sess.status == SessionStatus.submitted_late


def test_submission_after_class_ended_allowed_as_late(db_session, class_start_test_env):
    """Teacher submits at 10:25 IST (class ended at 10:20 IST) -> Allowed and flagged submitted_late."""
    env = class_start_test_env
    t_date = env["date"]

    after_class_time = datetime.combine(t_date, time(10, 25), tzinfo=TZ_KOLKATA).astimezone(timezone.utc)
    req = SubmitAttendanceRequest(
        class_id=env["class"].id,
        period_number=1,
        attendance_date=t_date,
        absent_roll_suffixes=["003"],
        client_timestamp=after_class_time
    )

    sess = StudentAttendanceService.submit_attendance(db_session, env["teacher"], req)
    assert sess.status == SessionStatus.submitted_late


def test_admin_principal_override_before_class_starts(db_session, class_start_test_env):
    """Principal / Admin CAN record attendance before class starts for administrative pre-scheduling."""
    env = class_start_test_env
    t_date = env["date"]

    before_time = datetime.combine(t_date, time(8, 45), tzinfo=TZ_KOLKATA).astimezone(timezone.utc)
    req = SubmitAttendanceRequest(
        class_id=env["class"].id,
        period_number=1,
        attendance_date=t_date,
        absent_roll_suffixes=["001"],
        client_timestamp=before_time
    )

    sess = StudentAttendanceService.submit_attendance(db_session, env["principal"], req)
    assert sess.status == SessionStatus.submitted


def test_offline_sync_batch_before_class_starts_is_rejected(db_session, class_start_test_env):
    """Offline sync operation recorded before class starts is rejected in batch results."""
    env = class_start_test_env
    t_date = env["date"]

    before_class_time = datetime.combine(t_date, time(9, 10), tzinfo=TZ_KOLKATA).astimezone(timezone.utc)
    op = OfflineSyncOperation(
        operation_id="sync-early-001",
        idempotency_key="idemp-early-001",
        operation_type="SUBMIT_ATTENDANCE",
        client_timestamp=before_class_time,
        payload={
            "class_id": env["class"].id,
            "period_number": 1,
            "attendance_date": str(t_date),
            "absent_roll_suffixes": ["001"],
            "client_timestamp": before_class_time.isoformat()
        }
    )
    batch = OfflineSyncBatchRequest(operations=[op])
    res = StudentAttendanceService.process_sync_batch(db_session, env["teacher"], batch)

    assert res.failed_count == 1
    assert res.synced_count == 0
    assert "Attendance can only be taken after class starts" in res.results[0].message
