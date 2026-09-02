import pytest
from datetime import date
from sqlalchemy.orm import Session

from app.models.user import Role, AdminLevel
from app.models.leave import LeaveRequest, LeaveStatus
from app.models.day_order_calendar import CalendarDay, DayType
from app.services import leave_service
from tests.conftest import _make_user, make_auth_headers, create_department, create_calendar_day


@pytest.fixture
def test_setup(db_session: Session):
    # Create Departments
    dept_a = create_department(db_session, name="Computer Science A", code="CS_A")
    dept_b = create_department(db_session, name="Information Tech B", code="IT_B")

    # Create Users using conftest factory
    admin = _make_user(db_session, name="System Admin", username="admin_sec_test", email=None, role=Role.system_admin, department=None)
    hod_a = _make_user(db_session, name="HOD Dept A", username="hod_sec_a", email=None, role=Role.admin, admin_level=AdminLevel.secondary_admin, department=dept_a.name)
    hod_b = _make_user(db_session, name="HOD Dept B", username="hod_sec_b", email=None, role=Role.admin, admin_level=AdminLevel.secondary_admin, department=dept_b.name)
    
    teacher_a1 = _make_user(db_session, name="Teacher A1", email="teacher.a1@college.edu", role=Role.teacher, department=dept_a.name)
    teacher_a2 = _make_user(db_session, name="Teacher A2", email="teacher.a2@college.edu", role=Role.teacher, department=dept_a.name)
    teacher_b1 = _make_user(db_session, name="Teacher B1", email="teacher.b1@college.edu", role=Role.teacher, department=dept_b.name)

    # Create Working Day in Calendar
    today_date = date(2026, 9, 15)
    cal_day = create_calendar_day(db_session, the_date=today_date, day_type=DayType.working, day_order=1)

    return {
        "admin": admin, "hod_a": hod_a, "hod_b": hod_b,
        "teacher_a1": teacher_a1, "teacher_a2": teacher_a2, "teacher_b1": teacher_b1,
        "dept_a": dept_a, "dept_b": dept_b, "today": today_date,
        "headers_admin": make_auth_headers(admin),
        "headers_hod_a": make_auth_headers(hod_a),
        "headers_hod_b": make_auth_headers(hod_b),
        "headers_teacher_a1": make_auth_headers(teacher_a1),
        "headers_teacher_a2": make_auth_headers(teacher_a2),
    }


def test_fix1_debug_endpoint_unavailable(client, test_setup):
    res = client.get("/leaves/debug-batch-test", headers=test_setup["headers_teacher_a1"])
    assert res.status_code == 404, "Debug endpoint /leaves/debug-batch-test must return 404 Not Found"


def test_fix3_teacher_credit_idor(client, test_setup):
    t_a1 = test_setup["teacher_a1"]
    t_a2 = test_setup["teacher_a2"]
    t_b1 = test_setup["teacher_b1"]

    # 1. Teacher A1 views own credits -> ALLOW 200
    res_own = client.get(f"/teachers/{t_a1.id}/credits", headers=test_setup["headers_teacher_a1"])
    assert res_own.status_code == 200

    # 2. Teacher A1 attempts to view Teacher A2 credits -> DENY 403
    res_other = client.get(f"/teachers/{t_a2.id}/credits", headers=test_setup["headers_teacher_a1"])
    assert res_other.status_code == 403, "Teacher accessing another teacher's credits must return 403"

    # 3. HOD A attempts to view Teacher B1 (Dept B) credits -> DENY 403
    res_hod_cross = client.get(f"/teachers/{t_b1.id}/credits", headers=test_setup["headers_hod_a"])
    assert res_hod_cross.status_code == 403, "HOD accessing credits of teacher in another department must return 403"

    # 4. HOD A views Teacher A1 (Dept A) credits -> ALLOW 200
    res_hod_own_dept = client.get(f"/teachers/{t_a1.id}/credits", headers=test_setup["headers_hod_a"])
    assert res_hod_own_dept.status_code == 200


def test_fix4_department_isolation_teachers(client, test_setup):
    # HOD A lists teachers -> scoped to Dept A
    res = client.get("/teachers/", headers=test_setup["headers_hod_a"])
    assert res.status_code == 200
    teachers = res.json()
    dept_ids = {t["department_id"] for t in teachers if t["department_id"] is not None}
    assert dept_ids == {test_setup["dept_a"].id}, "HOD department scoping must restrict listed teachers"


def test_fix5_leave_approval_concurrency(test_setup, db_session: Session):
    t_a1 = test_setup["teacher_a1"]
    today = test_setup["today"]

    # Create pending leave
    leave = LeaveRequest(
        teacher_id=t_a1.id,
        date=today,
        day_order=1,
        period_number=1,
        reason="Testing concurrency",
        status=LeaveStatus.pending,
    )
    db_session.add(leave)
    db_session.commit()
    db_session.refresh(leave)

    # First approval -> SUCCESS
    approved_leave, _ = leave_service.approve_leave(leave.id, db_session)
    assert approved_leave.status == LeaveStatus.approved

    # Second approval attempt on already approved leave -> HTTP 400
    with pytest.raises(Exception) as exc_info:
        leave_service.approve_leave(leave.id, db_session)
    assert "Only pending requests can be approved" in str(exc_info.value)


def test_fix6_canonical_leave_status_update(client, test_setup, db_session: Session):
    t_a1 = test_setup["teacher_a1"]
    today = test_setup["today"]

    # Create pending leave
    leave = LeaveRequest(
        teacher_id=t_a1.id,
        date=today,
        day_order=1,
        period_number=2,
        reason="Testing canonical status update",
        status=LeaveStatus.pending,
    )
    db_session.add(leave)
    db_session.commit()
    db_session.refresh(leave)

    # Invoke PATCH /leaves/{id}/status with {"status": "approved"}
    res = client.patch(
        f"/leaves/{leave.id}/status",
        json={"status": "approved"},
        headers=test_setup["headers_hod_a"],
    )
    assert res.status_code == 200
    data = res.json()
    assert data["leave"]["status"] == "approved"


def test_bulk_create_teachers(client, test_setup):
    payload = {
        "department_id": test_setup["dept_a"].id,
        "teachers": [
            {"name": "Bulk Teacher 1", "email": "bulk1@college.edu"},
            {"name": "Bulk Teacher 2", "email": "bulk2@college.edu"},
        ],
    }
    res = client.post("/teachers/bulk", json=payload, headers=test_setup["headers_hod_a"])
    assert res.status_code == 201
    data = res.json()
    assert data["created_count"] == 2
    assert len(data["teachers"]) == 2

