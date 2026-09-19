import pytest
from datetime import date, datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.models.user import User, Role, AdminLevel
from app.models.department import Department
from app.models.class_ import Class
from app.models.student import Student
from app.models.student_attendance import (
    AttendanceSession, StudentAttendance, SessionStatus, AttendanceType, StudentAttendanceStatus
)
from app.models.academic_intelligence import (
    AcademicIntelligenceEvent, IntelligenceEventType, IntelligenceEventState, IntelligenceSeverity
)
from app.services.academic_intelligence_service import AcademicIntelligenceService
from app.core.dependencies import get_current_user


@pytest.fixture
def intelligence_env(db_session: Session):
    # Departments
    dept_cs = Department(name="Computer Science", code="CS_INTEL")
    dept_ee = Department(name="Electrical Engineering", code="EE_INTEL")
    db_session.add_all([dept_cs, dept_ee])
    db_session.flush()

    # Classes
    cls_cs = Class(name="CSE 3A", section="A", department_id=dept_cs.id, semester=5)
    cls_ee = Class(name="EEE 2A", section="A", department_id=dept_ee.id, semester=3)
    db_session.add_all([cls_cs, cls_ee])
    db_session.flush()

    # Students for CS (10 students)
    students_cs = [
        Student(roll_number=f"26CS{i:03d}", name=f"CS Student {i}", class_id=cls_cs.id, department_id=dept_cs.id, is_active=True)
        for i in range(1, 11)
    ]
    db_session.add_all(students_cs)
    db_session.flush()

    # Users
    teacher = User(name="Faculty One", email="fac1@test.com", password_hash="hash", role=Role.teacher, department_id=dept_cs.id)
    hod_cs = User(
        name="HOD CS",
        username="hod_cs",
        password_hash="hash",
        role=Role.admin,
        admin_level=AdminLevel.secondary_admin,
        department_id=dept_cs.id
    )

    principal = User(name="Principal User", username="principal_user", password_hash="hash", role=Role.principal)
    db_session.add_all([teacher, hod_cs, principal])
    db_session.commit()

    return {
        "dept_cs": dept_cs,
        "dept_ee": dept_ee,
        "cls_cs": cls_cs,
        "cls_ee": cls_ee,
        "students_cs": students_cs,
        "teacher": teacher,
        "hod_cs": hod_cs,
        "principal": principal,
    }


def test_group_absenteeism_evaluation_and_auto_resolution(db_session: Session, intelligence_env):
    env = intelligence_env
    cls_cs = env["cls_cs"]
    teacher = env["teacher"]
    students = env["students_cs"]
    today = date.today()

    # 1. Create a submitted session with 5 out of 10 absent (50% absent -> Critical alert)
    session = AttendanceSession(
        attendance_date=today,
        class_id=cls_cs.id,
        period_number=1,
        actual_teacher_id=teacher.id,
        status=SessionStatus.submitted,
        attendance_type=AttendanceType.normal,
        submitted_at=datetime.now(timezone.utc),
    )
    db_session.add(session)
    db_session.flush()

    for idx, st in enumerate(students):
        status_val = StudentAttendanceStatus.absent if idx < 5 else StudentAttendanceStatus.present
        db_session.add(StudentAttendance(
            attendance_session_id=session.id,
            student_id=st.id,
            status=status_val,
        ))
    db_session.commit()

    # Evaluate
    events = AcademicIntelligenceService.evaluate_session(db_session, session.id)
    assert len(events) >= 1

    ev = db_session.query(AcademicIntelligenceEvent).filter(
        AcademicIntelligenceEvent.attendance_session_id == session.id,
        AcademicIntelligenceEvent.event_type == IntelligenceEventType.group_absenteeism,
    ).first()

    assert ev is not None
    assert ev.state == IntelligenceEventState.active
    assert ev.severity == IntelligenceSeverity.critical
    assert ev.absent_count == 5
    assert ev.total_count == 10

    # 2. Correct attendance so only 1 student is absent (10% absent -> should auto-resolve)
    recs = db_session.query(StudentAttendance).filter(StudentAttendance.attendance_session_id == session.id).all()
    for idx, r in enumerate(recs):
        r.status = StudentAttendanceStatus.absent if idx == 0 else StudentAttendanceStatus.present
    db_session.commit()

    # Re-evaluate
    AcademicIntelligenceService.evaluate_session(db_session, session.id)

    db_session.refresh(ev)
    assert ev.state == IntelligenceEventState.resolved
    assert ev.resolved_at is not None


def test_attendance_drop_evaluation(db_session: Session, intelligence_env):
    env = intelligence_env
    cls_cs = env["cls_cs"]
    teacher = env["teacher"]
    students = env["students_cs"]
    today = date.today()

    # Period 1: 100% attendance
    s1 = AttendanceSession(
        attendance_date=today,
        class_id=cls_cs.id,
        period_number=1,
        actual_teacher_id=teacher.id,
        status=SessionStatus.submitted,
        attendance_type=AttendanceType.normal,
        submitted_at=datetime.now(timezone.utc),
    )
    db_session.add(s1)
    db_session.flush()
    for st in students:
        db_session.add(StudentAttendance(attendance_session_id=s1.id, student_id=st.id, status=StudentAttendanceStatus.present))
    db_session.commit()
    AcademicIntelligenceService.evaluate_session(db_session, s1.id)

    # Period 2: 60% attendance (4 absent out of 10) -> 40% drop vs Period 1
    s2 = AttendanceSession(
        attendance_date=today,
        class_id=cls_cs.id,
        period_number=2,
        actual_teacher_id=teacher.id,
        status=SessionStatus.submitted,
        attendance_type=AttendanceType.normal,
        submitted_at=datetime.now(timezone.utc),
    )
    db_session.add(s2)
    db_session.flush()
    for idx, st in enumerate(students):
        status_val = StudentAttendanceStatus.absent if idx < 4 else StudentAttendanceStatus.present
        db_session.add(StudentAttendance(attendance_session_id=s2.id, student_id=st.id, status=status_val))
    db_session.commit()
    AcademicIntelligenceService.evaluate_session(db_session, s2.id)

    ev_drop = db_session.query(AcademicIntelligenceEvent).filter(
        AcademicIntelligenceEvent.attendance_session_id == s2.id,
        AcademicIntelligenceEvent.event_type == IntelligenceEventType.attendance_drop,
    ).first()

    assert ev_drop is not None
    assert ev_drop.state == IntelligenceEventState.active
    assert ev_drop.severity == IntelligenceSeverity.critical  # drop >= 25% is critical


def test_intelligence_api_scoping_and_acknowledgement(db_session: Session, intelligence_env, client: TestClient):
    env = intelligence_env
    cls_cs = env["cls_cs"]
    dept_cs = env["dept_cs"]
    dept_ee = env["dept_ee"]
    hod_cs = env["hod_cs"]
    principal = env["principal"]
    today = date.today()

    # Create event in CS
    ev_cs = AcademicIntelligenceEvent(
        department_id=dept_cs.id,
        class_id=cls_cs.id,
        event_type=IntelligenceEventType.group_absenteeism,
        severity=IntelligenceSeverity.high,
        state=IntelligenceEventState.active,
        source_key=f"test_ga:{cls_cs.id}",
        title="CS Absenteeism",
        detail="Testing detail",
        relevant_date=today,
    )
    db_session.add(ev_cs)
    db_session.commit()

    # 1. Test Principal accessing live summary
    app.dependency_overrides[get_current_user] = lambda: principal

    res_principal = client.get(f"/intelligence/live?date={today.isoformat()}")
    assert res_principal.status_code == 200
    data = res_principal.json()
    assert data["needs_attention_count"] >= 1

    # Principal can see events
    res_evs = client.get(f"/intelligence/events?date={today.isoformat()}")
    assert res_evs.status_code == 200
    assert len(res_evs.json()) >= 1

    # 2. Test HOD CS accessing
    app.dependency_overrides[get_current_user] = lambda: hod_cs
    res_hod = client.get(f"/intelligence/live?date={today.isoformat()}")
    assert res_hod.status_code == 200

    # HOD CS attempting to access EE department explicitly -> 403 Forbidden
    res_forbidden = client.get(f"/intelligence/live?department_id={dept_ee.id}")
    assert res_forbidden.status_code == 403

    # 3. Test Event Acknowledgement
    res_ack = client.patch(f"/intelligence/events/{ev_cs.id}/acknowledge")
    assert res_ack.status_code == 200
    assert res_ack.json()["state"] == "acknowledged"

    db_session.refresh(ev_cs)
    assert ev_cs.state == IntelligenceEventState.acknowledged

    # Cleanup dependency overrides
    app.dependency_overrides.pop(get_current_user, None)

