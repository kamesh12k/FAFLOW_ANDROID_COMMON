import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.audit_log import AuditLog
from tests.conftest import make_auth_headers


def test_get_current_policy(client: TestClient):
    res = client.get("/policy/current")
    assert res.status_code == 200
    data = res.json()
    assert data["version"] == "v1.0.0"
    assert len(data["sections"]) >= 4
    section_ids = [s["id"] for s in data["sections"]]
    assert "privacy" in section_ids
    assert "terms" in section_ids
    assert "geofence_attendance" in section_ids


def test_accept_policy_lifecycle(client: TestClient, db_session: Session, test_teacher: User):
    headers = make_auth_headers(test_teacher)

    # 1. Invalid version should fail 400
    res_bad = client.post("/policy/accept", json={"version": "v999.0"}, headers=headers)
    assert res_bad.status_code == 400

    # 2. Valid version acceptance
    res_ok = client.post("/policy/accept", json={"version": "v1.0.0"}, headers=headers)
    assert res_ok.status_code == 200
    res_json = res_ok.json()
    assert res_json["success"] is True
    assert res_json["version_accepted"] == "v1.0.0"
    assert res_json["accepted_at"] is not None

    # Check DB state
    db_user = db_session.query(User).filter(User.id == test_teacher.id).first()
    assert db_user.policy_version_accepted == "v1.0.0"
    assert db_user.policy_accepted_at is not None

    # Check AuditLog
    audit_entry = db_session.query(AuditLog).filter(
        AuditLog.actor_user_id == test_teacher.id,
        AuditLog.action == "user.policy_accepted"
    ).first()
    assert audit_entry is not None
    assert audit_entry.details["policy_version"] == "v1.0.0"


def test_onboarding_completion_and_reset(client: TestClient, db_session: Session, test_teacher: User):
    headers = make_auth_headers(test_teacher)

    # 1. Complete onboarding
    res_complete = client.post("/policy/onboarding/complete", headers=headers)
    assert res_complete.status_code == 200
    assert res_complete.json()["onboarding_completed"] is True

    db_user = db_session.query(User).filter(User.id == test_teacher.id).first()
    assert db_user.onboarding_completed is True

    # Check AuditLog
    audit_complete = db_session.query(AuditLog).filter(
        AuditLog.actor_user_id == test_teacher.id,
        AuditLog.action == "user.onboarding_completed"
    ).first()
    assert audit_complete is not None

    # 2. Reset onboarding (for replaying guided tour)
    res_reset = client.post("/policy/onboarding/reset", headers=headers)
    assert res_reset.status_code == 200
    assert res_reset.json()["onboarding_completed"] is False

    db_user = db_session.query(User).filter(User.id == test_teacher.id).first()
    assert db_user.onboarding_completed is False
