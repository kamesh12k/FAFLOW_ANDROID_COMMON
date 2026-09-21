import pytest
from datetime import date, datetime, timedelta, timezone, time
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User, Role
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
from app.services.student_attendance_service import StudentAttendanceService
from app.schemas.student_attendance import (
    SubmitAttendanceRequest, EmergencyAttendanceRequest, AttendanceCorrectionRequest,
    StudentStatusException, OfflineSyncBatchRequest, OfflineSyncOperation
)


@pytest.fixture
def setup_attendance_context(db_session: Session, test_teacher: User, test_teacher2: User):
    """Sets up a department, classes, students, subjects, timetable slots, and working calendar day."""
    dept = db_session.query(Department).filter(Department.code == "CS").first()
    if not dept:
        dept = Department(name="Computer Science", code="CS")
        db_session.add(dept)
        db_session.flush()

    # Class 1: III CSE-A
    cls_a = Class(name="III CSE-A", section="A", department_id=dept.id, semester=5)
    # Class 2: III CSE-B
    cls_b = Class(name="III CSE-B", section="B", department_id=dept.id, semester=5)
    db_session.add_all([cls_a, cls_b])
    db_session.flush()

    # Students for Class A: 25CS5001 .. 25CS5010
    students_a = []
    for i in range(1, 11):
        s = Student(
            roll_number=f"25CS5{i:03d}",
            name=f"Student A {i:03d}",
            class_id=cls_a.id,
            department_id=dept.id,
            is_active=True
        )
        students_a.append(s)
    db_session.add_all(students_a)

    # Students for Class B: 25CS5101 .. 25CS5105
    students_b = []
    for i in range(1, 6):
        s = Student(
            roll_number=f"25CS5{100+i:03d}",
            name=f"Student B {i:03d}",
            class_id=cls_b.id,
            department_id=dept.id,
            is_active=True
        )
        students_b.append(s)
    db_session.add_all(students_b)

    # Subject
    subj = Subject(name="Data Structures", code="CS-501", credits=3, department_id=dept.id, semester=5)
    db_session.add(subj)
    db_session.flush()

    # Timetable Slot for Teacher 1: Day Order 1, Period 3, Class A
    slot1 = TimetableSlot(
        teacher_id=test_teacher.id,
        subject_id=subj.id,
        class_id=cls_a.id,
        day_order=1,
        period_number=3
    )
    # Timetable Slot for Teacher 1: Day Order 1, Period 1, Class B
    slot2 = TimetableSlot(
        teacher_id=test_teacher.id,
        subject_id=subj.id,
        class_id=cls_b.id,
        day_order=1,
        period_number=1
    )
    db_session.add_all([slot1, slot2])

    # Calendar Day: Today is Day Order 1, Working
    today = date(2026, 9, 18)
    cal_day = db_session.query(CalendarDay).filter(CalendarDay.date == today).first()
    if not cal_day:
        cal_day = CalendarDay(date=today, day_type=DayType.working, day_order=1)
        db_session.add(cal_day)
    else:
        cal_day.day_type = DayType.working
        cal_day.day_order = 1

    db_session.commit()
    return {
        "dept": dept,
        "class_a": cls_a,
        "class_b": cls_b,
        "students_a": students_a,
        "students_b": students_b,
        "subject": subj,
        "slot_p3": slot1,
        "today": today
    }


def test_3_digit_roll_resolution_and_normal_attendance(db_session, test_teacher, setup_attendance_context):
    """Scenario A: Teacher enters absent roll suffixes '004', '007', default is PRESENT."""
    ctx = setup_attendance_context
    today = ctx["today"]
    cls_a = ctx["class_a"]

    req = SubmitAttendanceRequest(
        class_id=cls_a.id,
        period_number=3,
        attendance_date=today,
        absent_roll_suffixes=["004", "007"]
    )
    res = StudentAttendanceService.submit_attendance(db_session, test_teacher, req)

    assert res.attendance_type == AttendanceType.normal
    assert res.total_students == 10
    assert res.absent_count == 2
    assert res.present_count == 8

    # Verify student records
    records_by_suffix = {r.student_suffix: r.status for r in res.records}
    assert records_by_suffix["004"] == StudentAttendanceStatus.absent
    assert records_by_suffix["007"] == StudentAttendanceStatus.absent
    assert records_by_suffix["001"] == StudentAttendanceStatus.present


def test_duplicate_roll_suffix_and_format_normalization(db_session, test_teacher, setup_attendance_context):
    """Normalizes '004 007, 004\n007' into unique suffixes and rejects duplicates gracefully."""
    ctx = setup_attendance_context
    today = ctx["today"]
    cls_a = ctx["class_a"]

    req = SubmitAttendanceRequest(
        class_id=cls_a.id,
        period_number=3,
        attendance_date=today,
        absent_roll_suffixes=["004 007, 004\n007"]
    )
    res = StudentAttendanceService.submit_attendance(db_session, test_teacher, req)
    assert res.absent_count == 2


def test_invalid_roll_suffix_rejected(db_session, test_teacher, setup_attendance_context):
    """Suffix 999 does not exist in class roster -> raises 400."""
    ctx = setup_attendance_context
    today = ctx["today"]
    cls_a = ctx["class_a"]

    req = SubmitAttendanceRequest(
        class_id=cls_a.id,
        period_number=3,
        attendance_date=today,
        absent_roll_suffixes=["999"]
    )
    with pytest.raises(Exception) as exc_info:
        StudentAttendanceService.submit_attendance(db_session, test_teacher, req)
    assert "999" in str(exc_info.value)


def test_student_from_another_class_rejected(db_session, test_teacher, setup_attendance_context):
    """Suffix 101 belongs to Class B, not Class A -> rejected when submitted for Class A."""
    ctx = setup_attendance_context
    today = ctx["today"]
    cls_a = ctx["class_a"]

    req = SubmitAttendanceRequest(
        class_id=cls_a.id,
        period_number=3,
        attendance_date=today,
        absent_roll_suffixes=["101"]
    )
    with pytest.raises(Exception) as exc_info:
        StudentAttendanceService.submit_attendance(db_session, test_teacher, req)
    assert "101" in str(exc_info.value)


def test_registered_substitution_attendance(db_session, test_teacher, test_teacher2, setup_attendance_context):
    """Scenario B: Teacher 1 is on leave, Teacher 2 is registered substitute."""
    ctx = setup_attendance_context
    today = ctx["today"]
    cls_a = ctx["class_a"]

    # Teacher 1 creates approved leave for Period 3
    leave = LeaveRequest(
        teacher_id=test_teacher.id,
        date=today,
        day_order=1,
        period_number=3,
        reason="Medical",
        status=LeaveStatus.approved
    )
    db_session.add(leave)
    db_session.flush()

    sub = AlterAssignment(
        leave_request_id=leave.id,
        substitute_teacher_id=test_teacher2.id
    )
    db_session.add(sub)
    db_session.commit()

    # Teacher 2 submits attendance with substitution_id
    req = SubmitAttendanceRequest(
        class_id=cls_a.id,
        period_number=3,
        attendance_date=today,
        substitution_id=sub.id,
        absent_roll_suffixes=["002"]
    )
    res = StudentAttendanceService.submit_attendance(db_session, test_teacher2, req)

    assert res.attendance_type == AttendanceType.registered_substitution
    assert res.actual_teacher_id == test_teacher2.id
    assert res.scheduled_teacher_id == test_teacher.id
    assert res.absent_count == 1
    assert res.present_count == 9


def test_emergency_attendance_any_class(db_session, test_teacher2, setup_attendance_context):
    """Scenario C: Teacher 2 steps into Class A without prior registration and submits emergency attendance."""
    ctx = setup_attendance_context
    today = ctx["today"]
    cls_a = ctx["class_a"]

    req = EmergencyAttendanceRequest(
        class_id=cls_a.id,
        period_number=3,
        attendance_date=today,
        absent_roll_suffixes=["003", "005"]
    )
    res = StudentAttendanceService.emergency_attendance(db_session, test_teacher2, req)

    assert res.attendance_type == AttendanceType.emergency
    assert res.actual_teacher_id == test_teacher2.id
    assert res.absent_count == 2
    assert res.present_count == 8


def test_student_level_exceptions_late_od_leave_medical(db_session, test_teacher, setup_attendance_context):
    """Verifies separate statuses for LATE, ON_DUTY, LEAVE, and MEDICAL."""
    ctx = setup_attendance_context
    today = ctx["today"]
    cls_a = ctx["class_a"]

    req = SubmitAttendanceRequest(
        class_id=cls_a.id,
        period_number=3,
        attendance_date=today,
        absent_roll_suffixes=["001"],
        exceptions=[
            StudentStatusException(roll_suffix="002", status=StudentAttendanceStatus.late),
            StudentStatusException(roll_suffix="003", status=StudentAttendanceStatus.on_duty),
            StudentStatusException(roll_suffix="004", status=StudentAttendanceStatus.leave),
            StudentStatusException(roll_suffix="005", status=StudentAttendanceStatus.medical),
        ]
    )
    res = StudentAttendanceService.submit_attendance(db_session, test_teacher, req)

    assert res.absent_count == 1
    assert res.late_count == 1
    assert res.on_duty_count == 1
    assert res.leave_count == 1
    assert res.medical_count == 1
    assert res.present_count == 5


def test_submission_15_minute_rule(db_session, test_teacher, setup_attendance_context):
    """Submission within 15 mins -> submitted; submission after 15 mins -> submitted_late."""
    ctx = setup_attendance_context
    today = ctx["today"]
    cls_a = ctx["class_a"]

    # Period 3 start time is 11:40 (15-min window ends at 11:55)
    on_time = datetime.combine(today, time(11, 45)).replace(tzinfo=timezone.utc)
    req1 = SubmitAttendanceRequest(
        class_id=cls_a.id,
        period_number=3,
        attendance_date=today,
        absent_roll_suffixes=["001"],
        client_timestamp=on_time
    )
    res1 = StudentAttendanceService.submit_attendance(db_session, test_teacher, req1)
    assert res1.status == SessionStatus.submitted

    # Clear session for second test
    db_session.query(AttendanceSession).delete()
    db_session.commit()

    late_time = datetime.combine(today, time(12, 0)).replace(tzinfo=timezone.utc)
    req2 = SubmitAttendanceRequest(
        class_id=cls_a.id,
        period_number=3,
        attendance_date=today,
        absent_roll_suffixes=["001"],
        client_timestamp=late_time
    )
    res2 = StudentAttendanceService.submit_attendance(db_session, test_teacher, req2)
    assert res2.status == SessionStatus.submitted_late


def test_frictionless_in_window_correction_with_audit(db_session, test_teacher, setup_attendance_context):
    """Scenario F: Teacher corrects ABSENT -> PRESENT inside window with zero admin approval required."""
    ctx = setup_attendance_context
    today = ctx["today"]
    cls_a = ctx["class_a"]

    req = SubmitAttendanceRequest(
        class_id=cls_a.id,
        period_number=3,
        attendance_date=today,
        absent_roll_suffixes=["004"]
    )
    res = StudentAttendanceService.submit_attendance(db_session, test_teacher, req)
    assert res.absent_count == 1

    student_004 = next(r for r in res.records if r.student_suffix == "004")
    assert student_004.status == StudentAttendanceStatus.absent

    # Correct to PRESENT
    corr_req = AttendanceCorrectionRequest(
        new_status=StudentAttendanceStatus.present,
        reason="Student arrived with pass"
    )
    updated = StudentAttendanceService.correct_student_attendance(
        db_session, res.id, student_004.student_id, test_teacher, corr_req
    )

    assert updated.absent_count == 0
    assert updated.present_count == 10

    # Verify audit trail
    audits = db_session.query(AttendanceCorrectionAudit).filter(AttendanceCorrectionAudit.attendance_session_id == res.id).all()
    assert len(audits) == 1
    assert audits[0].old_status == "absent"
    assert audits[0].new_status == "present"
    assert audits[0].changed_by_id == test_teacher.id


def test_locked_session_prevents_correction(db_session, test_teacher, setup_attendance_context):
    """Locked session rejects routine teacher edits."""
    ctx = setup_attendance_context
    today = ctx["today"]
    cls_a = ctx["class_a"]

    req = SubmitAttendanceRequest(
        class_id=cls_a.id,
        period_number=3,
        attendance_date=today,
        absent_roll_suffixes=["004"]
    )
    res = StudentAttendanceService.submit_attendance(db_session, test_teacher, req)

    # Lock session
    session = db_session.query(AttendanceSession).filter(AttendanceSession.id == res.id).first()
    session.status = SessionStatus.locked
    db_session.commit()

    student_004 = next(r for r in res.records if r.student_suffix == "004")
    corr_req = AttendanceCorrectionRequest(new_status=StudentAttendanceStatus.present)

    with pytest.raises(Exception) as exc_info:
        StudentAttendanceService.correct_student_attendance(
            db_session, res.id, student_004.student_id, test_teacher, corr_req
        )
    assert "locked" in str(exc_info.value).lower()


def test_idempotent_duplicate_submission(db_session, test_teacher, setup_attendance_context):
    """Replaying submission with identical idempotency key returns existing session without duplicate rows."""
    ctx = setup_attendance_context
    today = ctx["today"]
    cls_a = ctx["class_a"]

    key = "client-op-uuid-12345"
    req = SubmitAttendanceRequest(
        class_id=cls_a.id,
        period_number=3,
        attendance_date=today,
        absent_roll_suffixes=["004"],
        idempotency_key=key
    )
    res1 = StudentAttendanceService.submit_attendance(db_session, test_teacher, req)
    res2 = StudentAttendanceService.submit_attendance(db_session, test_teacher, req)

    assert res1.id == res2.id
    count = db_session.query(AttendanceSession).filter(AttendanceSession.idempotency_key == key).count()
    assert count == 1


def test_offline_sync_batch(db_session, test_teacher, setup_attendance_context):
    """Processes batch of offline-queued operations (submission + correction)."""
    ctx = setup_attendance_context
    today = ctx["today"]
    cls_a = ctx["class_a"]

    batch = OfflineSyncBatchRequest(
        device_id="pixel-7-device-001",
        operations=[
            OfflineSyncOperation(
                operation_id="op-1",
                idempotency_key="idemp-batch-1",
                operation_type="SUBMIT_ATTENDANCE",
                payload={
                    "class_id": cls_a.id,
                    "period_number": 3,
                    "attendance_date": str(today),
                    "absent_roll_suffixes": ["001"]
                }
            )
        ]
    )
    sync_res = StudentAttendanceService.process_sync_batch(db_session, test_teacher, batch)

    assert sync_res.synced_count == 1
    assert sync_res.failed_count == 0
    assert sync_res.results[0].success == True


def test_non_working_day_blocks_attendance(db_session, test_teacher, setup_attendance_context):
    """Cannot submit attendance on holiday/non-working day."""
    ctx = setup_attendance_context
    cls_a = ctx["class_a"]
    holiday_date = date(2026, 9, 19)

    cal_day = CalendarDay(date=holiday_date, day_type=DayType.holiday, day_order=None)
    db_session.add(cal_day)
    db_session.commit()

    req = SubmitAttendanceRequest(
        class_id=cls_a.id,
        period_number=1,
        attendance_date=holiday_date,
        absent_roll_suffixes=[]
    )
    with pytest.raises(Exception) as exc:
        StudentAttendanceService.submit_attendance(db_session, test_teacher, req)
    assert "non-working" in str(exc.value).lower()


def test_duplicate_session_conflict(db_session, test_teacher, test_teacher2, setup_attendance_context):
    """Submitting attendance for already submitted class and period raises conflict (409)."""
    ctx = setup_attendance_context
    today = ctx["today"]
    cls_a = ctx["class_a"]

    req = SubmitAttendanceRequest(
        class_id=cls_a.id,
        period_number=3,
        attendance_date=today,
        absent_roll_suffixes=["001"]
    )
    StudentAttendanceService.submit_attendance(db_session, test_teacher, req)

    # Second submission attempt for same (date, class, period)
    with pytest.raises(Exception) as exc:
        StudentAttendanceService.submit_attendance(db_session, test_teacher2, req)
    assert "already been submitted" in str(exc.value).lower()


def test_hod_overview_and_percentage_calculation(db_session, test_teacher, setup_attendance_context):
    """HOD receives consolidated view and accurate percentage calculation."""
    ctx = setup_attendance_context
    today = ctx["today"]
    cls_a = ctx["class_a"]

    # Submit with 1 absent out of 10 students (90% attendance)
    req = SubmitAttendanceRequest(
        class_id=cls_a.id,
        period_number=3,
        attendance_date=today,
        absent_roll_suffixes=["001"]
    )
    StudentAttendanceService.submit_attendance(db_session, test_teacher, req)

    overview = StudentAttendanceService.get_hod_overview(db_session, test_teacher, today)
    assert overview.submitted_count >= 1
    assert overview.total_classes >= 1
    assert overview.student_attendance_percentage == 90.0


def test_api_routes_end_to_end(client: TestClient, db_session, test_teacher, auth_headers_teacher, setup_attendance_context):
    """Tests FastAPI HTTP routes: GET roster, POST submit, GET session, and PATCH correction."""
    ctx = setup_attendance_context
    cls_a = ctx["class_a"]
    today = str(ctx["today"])

    # 1. GET Roster
    res = client.get(f"/student-attendance/classes/{cls_a.id}/roster", headers=auth_headers_teacher)
    assert res.status_code == 200
    roster_data = res.json()
    assert roster_data["total_students"] == 10

    # 2. POST Submit Attendance
    submit_body = {
        "class_id": cls_a.id,
        "period_number": 3,
        "attendance_date": today,
        "absent_roll_suffixes": ["001", "002"]
    }
    res_submit = client.post("/student-attendance/sessions/submit", json=submit_body, headers=auth_headers_teacher)
    assert res_submit.status_code == 201
    sess_data = res_submit.json()
    assert sess_data["absent_count"] == 2
    assert sess_data["present_count"] == 8
    sess_id = sess_data["id"]

    # 3. GET Session Details
    res_get = client.get(f"/student-attendance/sessions/{sess_id}", headers=auth_headers_teacher)
    assert res_get.status_code == 200
    assert res_get.json()["id"] == sess_id

    # 4. PATCH Correction
    student_001 = next(s for s in sess_data["records"] if s["student_suffix"] == "001")
    corr_body = {
        "new_status": "present",
        "reason": "Corrected entry"
    }
    res_corr = client.patch(
        f"/student-attendance/sessions/{sess_id}/students/{student_001['student_id']}",
        json=corr_body,
        headers=auth_headers_teacher
    )
    assert res_corr.status_code == 200
    updated_sess = res_corr.json()
    assert updated_sess["absent_count"] == 1
    assert updated_sess["present_count"] == 9


def test_hod_overview_rbac_and_isolation(client: TestClient, auth_headers_teacher, auth_headers_admin, setup_attendance_context):
    """Verifies that teachers are forbidden (403) from accessing HOD overview and HOD can access (200)."""
    # Teacher role attempt -> 403 Forbidden
    res_teacher = client.get("/student-attendance/hod/overview", headers=auth_headers_teacher)
    assert res_teacher.status_code == 403

    # HOD role attempt -> 200 OK
    res_hod = client.get("/student-attendance/hod/overview", headers=auth_headers_admin)
    assert res_hod.status_code == 200
    data = res_hod.json()
    assert "classes" in data
    assert "total_classes" in data
    assert "sessions" in data
    assert "emergency_count" in data


def test_hod_overview_emergency_attendance_lifecycle_and_filters(client: TestClient, db_session, test_teacher, test_teacher2, auth_headers_admin, setup_attendance_context):
    """Tests that submitting emergency attendance reflects in HOD overview emergency_count,

    populates the sessions array with canonical EMERGENCY type, valid subject/teacher names,
    and correctly resolves under the Emergency filter tab.
    """
    ctx = setup_attendance_context
    cls_a = ctx["class_a"]
    today = ctx["today"]

    # 1. Submit Emergency Attendance for Class A, Period 3
    req = EmergencyAttendanceRequest(
        class_id=cls_a.id,
        period_number=3,
        attendance_date=today,
        absent_roll_suffixes=["003", "007"]
    )
    res_sub = StudentAttendanceService.emergency_attendance(db_session, test_teacher2, req)
    assert res_sub.attendance_type == AttendanceType.emergency

    # 2. Fetch HOD Overview via Service
    overview = StudentAttendanceService.get_hod_overview(db_session, test_teacher, today)

    # 3. Assert Counters
    assert overview.emergency_count == 1
    assert overview.total_scheduled_sessions == overview.total_classes

    # 4. Assert Sessions Array contains the Emergency Session
    emerg_sessions = [s for s in overview.sessions if s.is_emergency or s.attendance_type == "EMERGENCY"]
    assert len(emerg_sessions) == 1
    emerg_sess = emerg_sessions[0]

    assert emerg_sess.class_name == cls_a.name
    assert emerg_sess.period_number == 3
    assert emerg_sess.attendance_type == "EMERGENCY"
    assert emerg_sess.is_emergency is True
    assert emerg_sess.status in {"SUBMITTED", "SUBMITTED_LATE"}
    assert emerg_sess.actual_teacher_name == test_teacher2.name
    assert emerg_sess.subject_name is not None
    assert emerg_sess.absent_count == 2
    assert emerg_sess.present_count == 8
    assert len(emerg_sess.absent_rolls) == 2

    # 5. Assert API HTTP endpoint returns matching structure
    res_api = client.get(f"/student-attendance/hod/overview?target_date={today}", headers=auth_headers_admin)
    assert res_api.status_code == 200
    api_data = res_api.json()
    assert api_data["emergency_count"] == 1
    assert len(api_data["sessions"]) >= 1

    api_emerg_sessions = [s for s in api_data["sessions"] if s["is_emergency"] or s["attendance_type"] == "EMERGENCY"]
    assert len(api_emerg_sessions) == 1
    assert api_emerg_sessions[0]["class_name"] == cls_a.name
    assert api_emerg_sessions[0]["attendance_type"] == "EMERGENCY"
    assert api_emerg_sessions[0]["actual_teacher_name"] == test_teacher2.name
    assert api_emerg_sessions[0]["present_count"] == 8
    assert api_emerg_sessions[0]["absent_count"] == 2


def test_hod_overview_emergency_session_outside_timetable(db_session, test_teacher, test_teacher2, setup_attendance_context):
    """Verifies that an emergency session conducted for a period without any timetable slot

    is still fully present in the HOD overview sessions array.
    """
    ctx = setup_attendance_context
    cls_a = ctx["class_a"]
    today = ctx["today"]

    # Period 5 has no TimetableSlot in setup_attendance_context
    req = EmergencyAttendanceRequest(
        class_id=cls_a.id,
        period_number=5,
        attendance_date=today,
        absent_roll_suffixes=["001"]
    )
    res_sub = StudentAttendanceService.emergency_attendance(db_session, test_teacher2, req)
    assert res_sub.period_number == 5

    overview = StudentAttendanceService.get_hod_overview(db_session, test_teacher, today)

    # Session for period 5 MUST appear in sessions
    p5_sessions = [s for s in overview.sessions if s.period_number == 5]
    assert len(p5_sessions) == 1
    assert p5_sessions[0].attendance_type == "EMERGENCY"
    assert p5_sessions[0].subject_name is not None
    assert p5_sessions[0].actual_teacher_name == test_teacher2.name


def test_process_sync_batch_submit_alias_and_idempotency(db_session, test_teacher, setup_attendance_context):
    """Verifies that process_sync_batch correctly accepts operation_type='SUBMIT' and 'EMERGENCY',

    executes submission via session_id, and safely handles duplicate sync with the same idempotency key.
    """
    ctx = setup_attendance_context
    cls_a = ctx["class_a"]
    today = ctx["today"]
    slot1 = ctx["slot_p3"]

    # 1. First create an open attendance session in DB
    sess = AttendanceSession(
        timetable_slot_id=slot1.id,
        class_id=cls_a.id,
        scheduled_teacher_id=test_teacher.id,
        actual_teacher_id=test_teacher.id,
        attendance_date=today,
        day_order=1,
        period_number=slot1.period_number,
        attendance_type=AttendanceType.normal,
        status=SessionStatus.open,
        created_at=datetime.now(timezone.utc)
    )
    db_session.add(sess)
    db_session.commit()
    db_session.refresh(sess)

    # 2. Build OfflineSyncBatchRequest matching Android outbox structure
    idempotency_key = f"student-attendance-test-{sess.id}-uuid"
    batch_req = OfflineSyncBatchRequest(
        device_id="ANDROID_TEST_DEVICE_01",
        operations=[
            OfflineSyncOperation(
                operation_id="op-1",
                idempotency_key=idempotency_key,
                operation_type="SUBMIT",
                payload={
                    "session_id": sess.id,
                    "class_id": cls_a.id,
                    "absent_roll_suffixes": ["001", "002"],
                    "client_timestamp": datetime.now(timezone.utc).isoformat()
                }
            )
        ]
    )

    # 3. Process batch
    result = StudentAttendanceService.process_sync_batch(db_session, test_teacher, batch_req)
    assert result.synced_count == 1
    assert result.failed_count == 0
    assert len(result.results) == 1
    assert result.results[0].success is True
    assert result.results[0].status in {"submitted", "submitted_late", "SYNCED"}
    assert result.results[0].idempotency_key == idempotency_key

    # Verify DB state
    db_session.refresh(sess)
    assert sess.status in {SessionStatus.submitted, SessionStatus.submitted_late}
    absent_c = db_session.query(StudentAttendance).filter(
        StudentAttendance.attendance_session_id == sess.id,
        StudentAttendance.status == StudentAttendanceStatus.absent
    ).count()
    assert absent_c == 2

    # 4. Duplicate sync test: Re-send the exact same batch with the same idempotency key
    result_retry = StudentAttendanceService.process_sync_batch(db_session, test_teacher, batch_req)
    # Should safely return success without duplicating records or throwing an error
    assert result_retry.synced_count == 1
    assert result_retry.failed_count == 0
    assert result_retry.results[0].success is True
    assert result_retry.results[0].status in {"submitted", "submitted_late", "SYNCED"}

    # Verify still exactly one session and 10 student records
    records_count = db_session.query(StudentAttendance).filter(StudentAttendance.attendance_session_id == sess.id).count()
    assert records_count == 10


def test_offline_sync_with_negative_session_id(setup_attendance_context, test_teacher, db_session):
    """
    Verifies that client-side offline temporary negative session IDs (e.g. -406)
    are successfully synced by process_sync_batch without raising 'session not found'.
    """
    ctx = setup_attendance_context
    cls_b = ctx["class_b"]
    slot2 = ctx["slot_p3"]
    today = ctx["today"]

    batch_req = OfflineSyncBatchRequest(
        device_id="ANDROID_TEST_DEVICE_02",
        operations=[
            OfflineSyncOperation(
                operation_id="op-neg-406",
                idempotency_key=f"student-attendance-neg-test-{slot2.id}-uuid",
                operation_type="SUBMIT_ATTENDANCE",
                payload={
                    "session_id": -slot2.id,  # e.g. -406
                    "class_id": cls_b.id,
                    "period_number": 4,
                    "absent_roll_suffixes": ["101"],
                    "client_timestamp": datetime.now(timezone.utc).isoformat()
                }
            )
        ]
    )

    result = StudentAttendanceService.process_sync_batch(db_session, test_teacher, batch_req)
    assert result.synced_count == 1
    assert result.failed_count == 0
    assert len(result.results) == 1
    assert result.results[0].success is True
    assert result.results[0].session_id > 0
    assert "Attendance session" not in (result.results[0].message or "")




