import pytest
from fastapi.testclient import TestClient
from datetime import date
from sqlalchemy.orm import Session

from app.models.user import User, Role
from app.models.department import Department
from app.models.leave import LeaveRequest, LeaveStatus
from app.core.security import create_access_token, hash_password
from app.core.timezone import get_institution_today


def test_governance_authorization(client: TestClient, db_session: Session):
    # Create regular teacher and admin
    dept = Department(name="Gov Test Dept", code="GTD")
    db_session.add(dept)
    db_session.commit()

    teacher = User(
        name="Gov Test Teacher",
        email="govteacher@test.com",
        password_hash=hash_password("password"),
        role=Role.teacher,
        department_id=dept.id,
        is_active=True,
    )
    db_session.add(teacher)

    gov_user = User(
        name="Governor",
        username="gov_admin_test",
        password_hash=hash_password("password"),
        role=Role.governance,
        department_id=None,
        is_active=True,
    )
    db_session.add(gov_user)
    db_session.commit()

    teacher_token = create_access_token({"sub": str(teacher.id)})
    gov_token = create_access_token({"sub": str(gov_user.id)})

    # Teacher should receive 403 Forbidden on /governance/overview
    res_teacher = client.get("/governance/overview", headers={"Authorization": f"Bearer {teacher_token}"})
    assert res_teacher.status_code == 403

    # Governance user should receive 200 OK
    res_gov = client.get("/governance/overview", headers={"Authorization": f"Bearer {gov_token}"})
    assert res_gov.status_code == 200
    data = res_gov.json()
    assert "header" in data
    assert "critical_status" in data
    assert "college_snapshot" in data
    assert "departments_health" in data
    assert "substitution_engine" in data
    assert "system_health" in data


def test_governance_search(client: TestClient, db_session: Session):
    gov_user = db_session.query(User).filter(User.role == Role.governance).first()
    if not gov_user:
        gov_user = User(
            name="Governor Test",
            username="gov_search_test",
            password_hash=hash_password("password"),
            role=Role.governance,
            is_active=True,
        )
        db_session.add(gov_user)
        db_session.commit()

    gov_token = create_access_token({"sub": str(gov_user.id)})

    res = client.get("/governance/search?q=test", headers={"Authorization": f"Bearer {gov_token}"})
    assert res.status_code == 200
    data = res.json()
    assert "faculty" in data
    assert "classes" in data
    assert "departments" in data
    assert "leaves" in data


def test_governance_emergency_override(client: TestClient, db_session: Session):
    gov_user = db_session.query(User).filter(User.role == Role.governance).first()
    if not gov_user:
        gov_user = User(
            name="Governor Test",
            username="gov_override_test",
            password_hash=hash_password("password"),
            role=Role.governance,
            is_active=True,
        )
        db_session.add(gov_user)
        db_session.commit()

    gov_token = create_access_token({"sub": str(gov_user.id)})

    # Test override without reason fails
    res_fail = client.post(
        "/governance/emergency-override",
        headers={"Authorization": f"Bearer {gov_token}"},
        json={"action_type": "override_5pm_cutoff", "reason": ""},
    )
    assert res_fail.status_code in (400, 422)

    # Test valid emergency override
    res_ok = client.post(
        "/governance/emergency-override",
        headers={"Authorization": f"Bearer {gov_token}"},
        json={
            "action_type": "override_5pm_cutoff",
            "target_id": 999,
            "reason": "Emergency campus administrative requirement for evening accreditation",
        },
    )
    assert res_ok.status_code == 200
    assert res_ok.json()["success"] is True

