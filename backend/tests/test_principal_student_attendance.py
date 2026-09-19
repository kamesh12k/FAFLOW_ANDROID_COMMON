import pytest
from datetime import date, datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.models.user import User, Role, AdminLevel
from app.models.department import Department
from app.models.class_ import Class
from app.models.subject import Subject
from app.models.student import Student
from app.models.student_attendance import (
    AttendanceSession, StudentAttendance, AttendanceCorrectionAudit,
    AttendanceType, SessionStatus, StudentAttendanceStatus
)
from app.models.timetable import TimetableSlot
from app.models.day_order_calendar import CalendarDay, DayType
from app.services.student_attendance_service import StudentAttendanceService
from app.schemas.student_attendance import (
    SubmitAttendanceRequest, AdminSessionLockRequest, AdminAttendanceOverrideRequest
)
from app.core.dependencies import get_current_user


@pytest.fixture
def setup_principal_context(db_session: Session, test_teacher: User, test_principal: User):
    """Sets up institution context: Departments, Classes, Students, Timetable, and CalendarDay."""
    # Department 1: Computer Science
    dept_cs = db_session.query(Department).filter(Department.code == "CS").first()
    if not dept_cs:
        dept_cs = Department(name="Computer Science", code="CS")
        db_session.add(dept_cs)
        db_session.flush()

    # Department 2: Mechanical
    dept_mech = db_session.query(Department).filter(Department.code == "MECH").first()
    if not dept_mech:
        dept_mech = Department(name="Mechanical Engineering", code="MECH")
        db_session.add(dept_mech)
        db_session.flush()

    # Classes
    cls_cs = Class(name="III CSE-A", section="A", department_id=dept_cs.id, semester=5)
    cls_mech = Class(name="II MECH-A", section="A", department_id=dept_mech.id, semester=3)
    db_session.add_all([cls_cs, cls_mech])
    db_session.flush()

    # Students for CS (10 students)
    students_cs = []
    for i in range(1, 11):
        s = Student(
            roll_number=f"25CS5{i:03d}",
            name=f"CS Student {i:03d}",
            class_id=cls_cs.id,
            department_id=dept_cs.id,
            is_active=True
        )
        students_cs.append(s)
    db_session.add_all(students_cs)

    # Students for MECH (5 students)
    students_mech = []
    for i in range(1, 6):
        s = Student(
            roll_number=f"25ME3{i:03d}",
            name=f"MECH Student {i:03d}",
            class_id=cls_mech.id,
            department_id=dept_mech.id,
            is_active=True
        )
        students_mech.append(s)
    db_session.add_all(students_mech)

    # Subjects
    subj_cs = Subject(name="Data Structures", code="CS-501", credits=3, department_id=dept_cs.id, semester=5)
    subj_mech = Subject(name="Thermodynamics", code="ME-301", credits=3, department_id=dept_mech.id, semester=3)
    db_session.add_all([subj_cs, subj_mech])
    db_session.flush()

    # Working Day Order 1
    today = date.today()
    cal_day = db_session.query(CalendarDay).filter(CalendarDay.date == today).first()
    if not cal_day:
        cal_day = CalendarDay(date=today, day_type=DayType.working, day_order=1)
        db_session.add(cal_day)
    else:
        cal_day.day_type = DayType.working
        cal_day.day_order = 1
    db_session.flush()

    # Timetable Slots for Day Order 1
    slot1 = TimetableSlot(
        teacher_id=test_teacher.id,
        subject_id=subj_cs.id,
        class_id=cls_cs.id,
        day_order=1,
        period_number=1
    )
    slot2 = TimetableSlot(
        teacher_id=test_teacher.id,
        subject_id=subj_mech.id,
        class_id=cls_mech.id,
        day_order=1,
        period_number=2
    )
    db_session.add_all([slot1, slot2])
    db_session.flush()

    # Submit attendance for CS slot: 8 present, 2 absent (001, 002)
    req = SubmitAttendanceRequest(
        class_id=cls_cs.id,
        period_number=1,
        attendance_date=today,
        timetable_slot_id=slot1.id,
        absent_roll_suffixes=["001", "002"]
    )
    session_out = StudentAttendanceService.submit_attendance(db_session, test_teacher, req)

    db_session.commit()
    return {
        "dept_cs": dept_cs,
        "dept_mech": dept_mech,
        "cls_cs": cls_cs,
        "cls_mech": cls_mech,
        "subj_cs": subj_cs,
        "subj_mech": subj_mech,
        "session_cs": session_out,
        "today": today
    }


def test_principal_overview_institution_wide(db_session: Session, setup_principal_context: dict):
    today = setup_principal_context["today"]
    overview = StudentAttendanceService.get_principal_overview(db_session, today)

    assert overview.date == today
    assert overview.day_order == 1
    assert overview.total_scheduled_sessions >= 2
    assert overview.submitted_sessions >= 1
    assert len(overview.departments) >= 2
    assert overview.present_students_count >= 8
    assert overview.absent_students_count >= 2
    assert overview.overall_attendance_percentage > 0.0


def test_principal_sessions_monitoring(db_session: Session, setup_principal_context: dict):
    today = setup_principal_context["today"]
    sessions = StudentAttendanceService.get_principal_sessions(db_session, today)

    assert len(sessions) >= 2
    cs_session = next((s for s in sessions if s.class_name == "III CSE-A"), None)
    assert cs_session is not None
    assert cs_session.period_number == 1
    assert cs_session.present_count == 8
    assert cs_session.absent_count == 2
    assert cs_session.attendance_percentage == 80.0


def test_class_period_matrix_conducted_only(db_session: Session, setup_principal_context: dict):
    cls_cs = setup_principal_context["cls_cs"]
    today = setup_principal_context["today"]

    matrix = StudentAttendanceService.get_class_period_matrix(db_session, cls_cs.id, today)
    assert matrix.class_id == cls_cs.id
    assert matrix.total_students == 10
    assert len(matrix.students) == 10

    # First student was absent (001)
    s1 = next(s for s in matrix.students if s.roll_suffix == "001")
    assert s1.period_marks["1"] == "ABSENT"
    assert s1.day_attended == 0
    assert s1.day_percentage == 0.0

    # Third student was present (003)
    s3 = next(s for s in matrix.students if s.roll_suffix == "003")
    assert s3.period_marks["1"] == "PRESENT"
    assert s3.day_attended == 1
    assert s3.day_percentage == 100.0


def test_student_profile_and_subject_breakdown(db_session: Session, setup_principal_context: dict):
    cls_cs = setup_principal_context["cls_cs"]
    s = db_session.query(Student).filter(Student.class_id == cls_cs.id, Student.roll_number.endswith("003")).first()
    assert s is not None

    profile = StudentAttendanceService.get_student_attendance_profile(db_session, s.id)
    assert profile.student_id == s.id
    assert profile.total_eligible_sessions >= 1
    assert profile.attended_sessions >= 1
    assert profile.overall_percentage == 100.0
    assert len(profile.subjects) >= 1
    assert profile.subjects[0].subject_name == "Data Structures"


def test_teacher_compliance_monitoring(db_session: Session, setup_principal_context: dict, test_teacher: User):
    today = setup_principal_context["today"]
    compliance = StudentAttendanceService.get_teacher_compliance(db_session, today)

    t_entry = next((c for c in compliance if c.teacher_id == test_teacher.id), None)
    assert t_entry is not None
    assert t_entry.scheduled_sessions_today >= 2
    assert (t_entry.submitted_on_time_count + t_entry.submitted_late_count) >= 1


def test_principal_exceptions(db_session: Session, setup_principal_context: dict):
    today = setup_principal_context["today"]
    exceptions = StudentAttendanceService.get_principal_exceptions(db_session, today)
    assert isinstance(exceptions, list)


def test_admin_lock_and_override_with_audit(db_session: Session, setup_principal_context: dict, test_principal: User):
    sess_id = setup_principal_context["session_cs"].id

    # 1. Admin locks session
    locked_sess = StudentAttendanceService.admin_toggle_session_lock(
        db_session, sess_id, test_principal, AdminSessionLockRequest(locked=True, reason="Governance review")
    )
    assert locked_sess.status == SessionStatus.locked

    # 2. Admin unlocks session
    unlocked_sess = StudentAttendanceService.admin_toggle_session_lock(
        db_session, sess_id, test_principal, AdminSessionLockRequest(locked=False, reason="Review complete")
    )
    assert unlocked_sess.status == SessionStatus.submitted

    # 3. Admin overrides student mark
    cls_cs = setup_principal_context["cls_cs"]
    s_absent = db_session.query(Student).filter(Student.class_id == cls_cs.id, Student.roll_number.endswith("001")).first()

    override_sess = StudentAttendanceService.admin_override_student_attendance(
        db_session, sess_id, s_absent.id, test_principal,
        AdminAttendanceOverrideRequest(new_status=StudentAttendanceStatus.on_duty, reason="College representation approved")
    )
    # Verify audit trail
    audit = (
        db_session.query(AttendanceCorrectionAudit)
        .filter(
            AttendanceCorrectionAudit.attendance_session_id == sess_id,
            AttendanceCorrectionAudit.student_id == s_absent.id
        )
        .order_by(AttendanceCorrectionAudit.id.desc())
        .first()
    )
    assert audit is not None
    assert audit.old_status == "absent"
    assert audit.new_status == "on_duty"
    assert audit.reason == "College representation approved"
    assert audit.changed_by_id == test_principal.id


def test_export_attendance_report_csv(db_session: Session, setup_principal_context: dict):
    today = setup_principal_context["today"]
    csv_daily = StudentAttendanceService.export_attendance_report_csv(db_session, "daily_summary", today)
    assert "FAFLOW INSTITUTIONAL STUDENT ATTENDANCE REPORT" in csv_daily
    assert "CS" in csv_daily

    csv_shortage = StudentAttendanceService.export_attendance_report_csv(db_session, "shortage_list", today)
    assert "ATTENDANCE SHORTAGE REPORT" in csv_shortage

    csv_compliance = StudentAttendanceService.export_attendance_report_csv(db_session, "teacher_compliance", today)
    assert "TEACHER ATTENDANCE SUBMISSION COMPLIANCE REPORT" in csv_compliance


def test_principal_rbac_security(setup_principal_context: dict, test_teacher: User, test_principal: User, client: TestClient):
    # 1. Teacher access -> 403 Forbidden
    app.dependency_overrides[get_current_user] = lambda: test_teacher
    res = client.get("/student-attendance/principal/overview")
    assert res.status_code == 403
    assert "Principal or institutional governance access required" in res.json()["detail"]

    # 2. Principal access -> 200 OK
    app.dependency_overrides[get_current_user] = lambda: test_principal
    res_ok = client.get("/student-attendance/principal/overview")
    assert res_ok.status_code == 200
    data = res_ok.json()
    assert "total_scheduled_sessions" in data
    assert len(data["departments"]) >= 2

    # Test matrix endpoint
    cls_id = setup_principal_context["cls_cs"].id
    res_mat = client.get(f"/student-attendance/principal/classes/{cls_id}/matrix")
    assert res_mat.status_code == 200
    assert res_mat.json()["class_id"] == cls_id

    app.dependency_overrides.clear()
