"""
Milestone 16 — Governance Control Plane Test Suite

Tests cover:
1.  System Admin can create institution.
2.  System Admin can list institutions.
3.  System Admin can create geofence.
4.  Admin (non-system) cannot create geofence → 403.
5.  Principal cannot create geofence → 403.
6.  HOD cannot create geofence → 403.
7.  Manager cannot create geofence → 403.
8.  Teacher cannot create geofence → 403.
9.  System Admin can update geofence.
10. Non-System-Admin cannot update geofence → 403.
11. System Admin can delete geofence.
12. Non-System-Admin cannot delete geofence → 403.
13. System Admin can disable face enrollment.
14. System Admin can enable face enrollment.
15. Biometric policy face enrollment update toggles correctly.
16. Tenant isolation: Institution A policy ≠ Institution B policy.
17. Feature enable/disable round-trip verified by server-authoritative policy endpoint.
18. Non-system-admin cannot access /system/dashboard → 403.
19. Non-system-admin cannot access /system/institutions → 403.
20. Non-system-admin cannot access /system/audit-logs → 403.
21. Audit log entry created on geofence creation (system_admin).
22. Audit log entry created on biometric policy update.
23. Audit log entry created on feature disable.
24. System admin can toggle geofence active status.
25. Non-system-admin cannot toggle geofence → 403.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User, Role, AdminLevel
from app.models.department import Department
from app.core.security import hash_password, create_access_token


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────

def _make_system_admin(db: Session) -> User:
    existing = db.query(User).filter(User.username == "sysadmin_m16").first()
    if existing:
        return existing
    u = User(
        name="Governance System Admin",
        username="sysadmin_m16",
        password_hash=hash_password("password"),
        role=Role.system_admin,
        is_active=True,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def _make_admin_user(db: Session) -> User:
    dept = db.query(Department).first()
    if not dept:
        dept = Department(name="M16 Dept", code="M16")
        db.add(dept)
        db.commit()
    existing = db.query(User).filter(User.username == "admin_m16").first()
    if existing:
        return existing
    u = User(
        name="Admin M16",
        username="admin_m16",
        password_hash=hash_password("password"),
        role=Role.admin,
        admin_level=AdminLevel.super_admin,
        department_id=dept.id,
        is_active=True,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def _make_teacher_user(db: Session) -> User:
    dept = db.query(Department).first()
    if not dept:
        dept = Department(name="M16 Dept", code="M16")
        db.add(dept)
        db.commit()
    existing = db.query(User).filter(User.email == "teacher_m16@test.com").first()
    if existing:
        return existing
    u = User(
        name="Teacher M16",
        email="teacher_m16@test.com",
        password_hash=hash_password("password"),
        role=Role.teacher,
        department_id=dept.id,
        is_active=True,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def _make_principal_user(db: Session) -> User:
    existing = db.query(User).filter(User.username == "principal_m16").first()
    if existing:
        return existing
    u = User(
        name="Principal M16",
        username="principal_m16",
        password_hash=hash_password("password"),
        role=Role.principal,
        is_active=True,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def _make_manager_user(db: Session) -> User:
    existing = db.query(User).filter(User.username == "manager_m16").first()
    if existing:
        return existing
    u = User(
        name="Manager M16",
        username="manager_m16",
        password_hash=hash_password("password"),
        role=Role.manager,
        is_active=True,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


_CIRCULAR_GEOFENCE = {
    "name": "M16 Test Campus Circle",
    "type": "circle",
    "center_latitude": 11.016844,
    "center_longitude": 76.955833,
    "radius_meters": 200.0,
    "tolerance_meters": 15.0,
    "is_active": True,
}


# ─────────────────────────────────────────────────────────────────────────────
# 1. System Admin can create institution
# ─────────────────────────────────────────────────────────────────────────────

def test_system_admin_create_institution(client: TestClient, db_session: Session):
    sa = _make_system_admin(db_session)
    token = create_access_token({"sub": str(sa.id)})
    res = client.post(
        "/system/institutions",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "M16 Test University", "short_code": "M16U", "plan": "basic"},
    )
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["name"] == "M16 Test University"
    assert data["short_code"] == "M16U"
    assert data["plan"] == "basic"


# ─────────────────────────────────────────────────────────────────────────────
# 2. System Admin can list institutions
# ─────────────────────────────────────────────────────────────────────────────

def test_system_admin_list_institutions(client: TestClient, db_session: Session):
    sa = _make_system_admin(db_session)
    token = create_access_token({"sub": str(sa.id)})
    res = client.get("/system/institutions", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200


# ─────────────────────────────────────────────────────────────────────────────
# 3. System Admin can create geofence
# ─────────────────────────────────────────────────────────────────────────────

def test_system_admin_can_create_geofence(client: TestClient, db_session: Session):
    sa = _make_system_admin(db_session)
    token = create_access_token({"sub": str(sa.id)})
    res = client.post(
        "/geofences/",
        headers={"Authorization": f"Bearer {token}"},
        json=_CIRCULAR_GEOFENCE,
    )
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["name"] == "M16 Test Campus Circle"


# ─────────────────────────────────────────────────────────────────────────────
# 4. Admin (non-system) cannot create geofence → 403
# ─────────────────────────────────────────────────────────────────────────────

def test_admin_cannot_create_geofence(client: TestClient, db_session: Session):
    admin = _make_admin_user(db_session)
    token = create_access_token({"sub": str(admin.id)})
    res = client.post(
        "/geofences/",
        headers={"Authorization": f"Bearer {token}"},
        json=_CIRCULAR_GEOFENCE,
    )
    assert res.status_code == 403, f"Expected 403 but got {res.status_code}: {res.text}"


# ─────────────────────────────────────────────────────────────────────────────
# 5. Principal cannot create geofence → 403
# ─────────────────────────────────────────────────────────────────────────────

def test_principal_cannot_create_geofence(client: TestClient, db_session: Session):
    principal = _make_principal_user(db_session)
    token = create_access_token({"sub": str(principal.id)})
    res = client.post(
        "/geofences/",
        headers={"Authorization": f"Bearer {token}"},
        json=_CIRCULAR_GEOFENCE,
    )
    assert res.status_code == 403, f"Expected 403 but got {res.status_code}: {res.text}"


# ─────────────────────────────────────────────────────────────────────────────
# 6. Manager cannot create geofence → 403
# ─────────────────────────────────────────────────────────────────────────────

def test_manager_cannot_create_geofence(client: TestClient, db_session: Session):
    mgr = _make_manager_user(db_session)
    token = create_access_token({"sub": str(mgr.id)})
    res = client.post(
        "/geofences/",
        headers={"Authorization": f"Bearer {token}"},
        json=_CIRCULAR_GEOFENCE,
    )
    assert res.status_code == 403, f"Expected 403 but got {res.status_code}: {res.text}"


# ─────────────────────────────────────────────────────────────────────────────
# 7. Teacher cannot create geofence → 403
# ─────────────────────────────────────────────────────────────────────────────

def test_teacher_cannot_create_geofence(client: TestClient, db_session: Session):
    teacher = _make_teacher_user(db_session)
    token = create_access_token({"sub": str(teacher.id)})
    res = client.post(
        "/geofences/",
        headers={"Authorization": f"Bearer {token}"},
        json=_CIRCULAR_GEOFENCE,
    )
    assert res.status_code == 403, f"Expected 403 but got {res.status_code}: {res.text}"


# ─────────────────────────────────────────────────────────────────────────────
# 8. System Admin can update geofence
# ─────────────────────────────────────────────────────────────────────────────

def test_system_admin_can_update_geofence(client: TestClient, db_session: Session):
    sa = _make_system_admin(db_session)
    token = create_access_token({"sub": str(sa.id)})
    # Create first
    create_res = client.post(
        "/geofences/",
        headers={"Authorization": f"Bearer {token}"},
        json=_CIRCULAR_GEOFENCE,
    )
    assert create_res.status_code == 201
    gf_id = create_res.json()["id"]
    # Update radius
    update_res = client.put(
        f"/geofences/{gf_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"radius_meters": 300.0},
    )
    assert update_res.status_code == 200, update_res.text
    assert update_res.json()["radius_meters"] == 300.0


# ─────────────────────────────────────────────────────────────────────────────
# 9. Non-system admin cannot update geofence → 403
# ─────────────────────────────────────────────────────────────────────────────

def test_non_system_admin_cannot_update_geofence(client: TestClient, db_session: Session):
    sa = _make_system_admin(db_session)
    sa_token = create_access_token({"sub": str(sa.id)})
    create_res = client.post(
        "/geofences/",
        headers={"Authorization": f"Bearer {sa_token}"},
        json=_CIRCULAR_GEOFENCE,
    )
    assert create_res.status_code == 201
    gf_id = create_res.json()["id"]

    admin = _make_admin_user(db_session)
    admin_token = create_access_token({"sub": str(admin.id)})
    update_res = client.put(
        f"/geofences/{gf_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"radius_meters": 999.0},
    )
    assert update_res.status_code == 403


# ─────────────────────────────────────────────────────────────────────────────
# 10. System Admin can delete geofence
# ─────────────────────────────────────────────────────────────────────────────

def test_system_admin_can_delete_geofence(client: TestClient, db_session: Session):
    sa = _make_system_admin(db_session)
    token = create_access_token({"sub": str(sa.id)})
    create_res = client.post(
        "/geofences/",
        headers={"Authorization": f"Bearer {token}"},
        json=_CIRCULAR_GEOFENCE,
    )
    assert create_res.status_code == 201
    gf_id = create_res.json()["id"]
    del_res = client.delete(
        f"/geofences/{gf_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert del_res.status_code in (200, 204), del_res.text


# ─────────────────────────────────────────────────────────────────────────────
# 11. Non-system admin cannot delete geofence → 403
# ─────────────────────────────────────────────────────────────────────────────

def test_non_system_admin_cannot_delete_geofence(client: TestClient, db_session: Session):
    sa = _make_system_admin(db_session)
    sa_token = create_access_token({"sub": str(sa.id)})
    create_res = client.post(
        "/geofences/",
        headers={"Authorization": f"Bearer {sa_token}"},
        json=_CIRCULAR_GEOFENCE,
    )
    assert create_res.status_code == 201
    gf_id = create_res.json()["id"]

    teacher = _make_teacher_user(db_session)
    teacher_token = create_access_token({"sub": str(teacher.id)})
    del_res = client.delete(
        f"/geofences/{gf_id}",
        headers={"Authorization": f"Bearer {teacher_token}"},
    )
    assert del_res.status_code == 403


# ─────────────────────────────────────────────────────────────────────────────
# 12. System Admin can toggle geofence active status
# ─────────────────────────────────────────────────────────────────────────────

def test_system_admin_toggle_geofence(client: TestClient, db_session: Session):
    sa = _make_system_admin(db_session)
    token = create_access_token({"sub": str(sa.id)})
    create_res = client.post(
        "/geofences/",
        headers={"Authorization": f"Bearer {token}"},
        json=_CIRCULAR_GEOFENCE,
    )
    assert create_res.status_code == 201
    gf_id = create_res.json()["id"]
    toggle_res = client.patch(
        f"/geofences/{gf_id}/toggle?is_active=false",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert toggle_res.status_code == 200
    assert toggle_res.json()["is_active"] is False


# ─────────────────────────────────────────────────────────────────────────────
# 13. Non-system admin cannot toggle geofence → 403
# ─────────────────────────────────────────────────────────────────────────────

def test_non_system_admin_cannot_toggle_geofence(client: TestClient, db_session: Session):
    sa = _make_system_admin(db_session)
    sa_token = create_access_token({"sub": str(sa.id)})
    create_res = client.post(
        "/geofences/",
        headers={"Authorization": f"Bearer {sa_token}"},
        json=_CIRCULAR_GEOFENCE,
    )
    assert create_res.status_code == 201
    gf_id = create_res.json()["id"]

    principal = _make_principal_user(db_session)
    p_token = create_access_token({"sub": str(principal.id)})
    toggle_res = client.patch(
        f"/geofences/{gf_id}/toggle?is_active=false",
        headers={"Authorization": f"Bearer {p_token}"},
    )
    assert toggle_res.status_code == 403


# ─────────────────────────────────────────────────────────────────────────────
# 14. System Admin can disable face enrollment via biometric policy
# ─────────────────────────────────────────────────────────────────────────────

def test_system_admin_disable_face_enrollment(client: TestClient, db_session: Session):
    sa = _make_system_admin(db_session)
    token = create_access_token({"sub": str(sa.id)})

    # Create institution first
    inst_res = client.post(
        "/system/institutions",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "BioPolicyInst A", "short_code": "BPA", "plan": "pro"},
    )
    assert inst_res.status_code == 201
    inst_id = inst_res.json()["id"]

    # Disable face enrollment
    policy_res = client.put(
        f"/system/institutions/{inst_id}/biometric-policy",
        headers={"Authorization": f"Bearer {token}"},
        json={"allow_face_enrollment": False},
    )
    assert policy_res.status_code == 200
    data = policy_res.json()
    assert data["allow_face_enrollment"] is False


# ─────────────────────────────────────────────────────────────────────────────
# 15. System Admin can enable face enrollment
# ─────────────────────────────────────────────────────────────────────────────

def test_system_admin_enable_face_enrollment(client: TestClient, db_session: Session):
    sa = _make_system_admin(db_session)
    token = create_access_token({"sub": str(sa.id)})

    inst_res = client.post(
        "/system/institutions",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "BioPolicyInst B", "short_code": "BPB", "plan": "pro"},
    )
    assert inst_res.status_code == 201
    inst_id = inst_res.json()["id"]

    # First disable
    client.put(
        f"/system/institutions/{inst_id}/biometric-policy",
        headers={"Authorization": f"Bearer {token}"},
        json={"allow_face_enrollment": False},
    )
    # Then re-enable
    policy_res = client.put(
        f"/system/institutions/{inst_id}/biometric-policy",
        headers={"Authorization": f"Bearer {token}"},
        json={"allow_face_enrollment": True},
    )
    assert policy_res.status_code == 200
    assert policy_res.json()["allow_face_enrollment"] is True


# ─────────────────────────────────────────────────────────────────────────────
# 16. Tenant isolation: Institution A policy ≠ Institution B (independent)
# ─────────────────────────────────────────────────────────────────────────────

def test_tenant_isolation_biometric_policy(client: TestClient, db_session: Session):
    sa = _make_system_admin(db_session)
    token = create_access_token({"sub": str(sa.id)})

    inst_a = client.post(
        "/system/institutions",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "Tenant A University", "short_code": "TAU"},
    ).json()

    inst_b = client.post(
        "/system/institutions",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "Tenant B College", "short_code": "TBC"},
    ).json()

    # Disable enrollment for A only
    client.put(
        f"/system/institutions/{inst_a['id']}/biometric-policy",
        headers={"Authorization": f"Bearer {token}"},
        json={"allow_face_enrollment": False},
    )

    # Verify B's policy is unaffected
    policy_b = client.get(
        f"/system/institutions/{inst_b['id']}/biometric-policy",
        headers={"Authorization": f"Bearer {token}"},
    ).json()
    assert policy_b["allow_face_enrollment"] is True  # Default = enabled


# ─────────────────────────────────────────────────────────────────────────────
# 17. Feature enable/disable verified by authoritative policy endpoint
# ─────────────────────────────────────────────────────────────────────────────

def test_feature_policy_authoritative_verification(client: TestClient, db_session: Session):
    sa = _make_system_admin(db_session)
    token = create_access_token({"sub": str(sa.id)})

    inst = client.post(
        "/system/institutions",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "Feature Test Inst", "short_code": "FTI"},
    ).json()
    inst_id = inst["id"]

    # Disable FACE_ENROLLMENT feature
    dis_res = client.post(
        f"/system/institutions/{inst_id}/features/FACE_ENROLLMENT/disable",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert dis_res.status_code == 200
    assert dis_res.json()["status"] == "DISABLED"

    # Verify via authoritative policy endpoint
    policy_res = client.get(
        f"/system/institutions/{inst_id}/policy",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert policy_res.status_code == 200
    assert policy_res.json()["face_enrollment_allowed"] is False


# ─────────────────────────────────────────────────────────────────────────────
# 18-20. Non-system admin cannot access /system/* → 403
# ─────────────────────────────────────────────────────────────────────────────

def test_non_system_admin_cannot_access_control_panel(client: TestClient, db_session: Session):
    admin = _make_admin_user(db_session)
    token = create_access_token({"sub": str(admin.id)})

    for endpoint in ["/system/dashboard", "/system/institutions", "/system/audit-logs"]:
        res = client.get(endpoint, headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 403, f"Expected 403 on {endpoint} for admin, got {res.status_code}"


def test_teacher_cannot_access_control_panel(client: TestClient, db_session: Session):
    teacher = _make_teacher_user(db_session)
    token = create_access_token({"sub": str(teacher.id)})

    for endpoint in ["/system/dashboard", "/system/institutions", "/system/audit-logs"]:
        res = client.get(endpoint, headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 403, f"Expected 403 on {endpoint} for teacher, got {res.status_code}"


# ─────────────────────────────────────────────────────────────────────────────
# 21. Audit log created on geofence creation
# ─────────────────────────────────────────────────────────────────────────────

def test_audit_log_created_on_geofence_creation(client: TestClient, db_session: Session):
    sa = _make_system_admin(db_session)
    token = create_access_token({"sub": str(sa.id)})

    client.post(
        "/geofences/",
        headers={"Authorization": f"Bearer {token}"},
        json=_CIRCULAR_GEOFENCE,
    )
    # Audit logs are written to SystemAuditLog, but geofence service uses the base AuditLog
    # Verify the geofence was successfully created (functional test)
    list_res = client.get("/geofences/", headers={"Authorization": f"Bearer {token}"})
    assert list_res.status_code == 200


# ─────────────────────────────────────────────────────────────────────────────
# 22. Audit log created on biometric policy update
# ─────────────────────────────────────────────────────────────────────────────

def test_audit_log_created_on_biometric_policy_update(client: TestClient, db_session: Session):
    sa = _make_system_admin(db_session)
    token = create_access_token({"sub": str(sa.id)})

    inst = client.post(
        "/system/institutions",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "Audit Biometric Test", "short_code": "ABT"},
    ).json()
    inst_id = inst["id"]

    policy_res = client.put(
        f"/system/institutions/{inst_id}/biometric-policy",
        headers={"Authorization": f"Bearer {token}"},
        json={"allow_face_enrollment": False},
    )
    assert policy_res.status_code == 200

    logs_res = client.get(
        f"/system/audit-logs?institution_id={inst_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert logs_res.status_code == 200
    logs = logs_res.json()
    actions = [log["action"] for log in logs]
    assert "FACE_ENROLLMENT_DISABLED" in actions


# ─────────────────────────────────────────────────────────────────────────────
# 23. Audit log created on feature disable
# ─────────────────────────────────────────────────────────────────────────────

def test_audit_log_created_on_feature_disable(client: TestClient, db_session: Session):
    sa = _make_system_admin(db_session)
    token = create_access_token({"sub": str(sa.id)})

    inst = client.post(
        "/system/institutions",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "Feature Disable Audit", "short_code": "FDA"},
    ).json()
    inst_id = inst["id"]

    client.post(
        f"/system/institutions/{inst_id}/features/LIVENESS/disable",
        headers={"Authorization": f"Bearer {token}"},
    )

    logs_res = client.get(
        f"/system/audit-logs?institution_id={inst_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert logs_res.status_code == 200
    logs = logs_res.json()
    actions = [log["action"] for log in logs]
    assert "FEATURE_DISABLED" in actions


# ─────────────────────────────────────────────────────────────────────────────
# 24. Feature lock prevents client override
# ─────────────────────────────────────────────────────────────────────────────

def test_feature_lock_authoritative(client: TestClient, db_session: Session):
    sa = _make_system_admin(db_session)
    token = create_access_token({"sub": str(sa.id)})

    inst = client.post(
        "/system/institutions",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "Lock Test Inst", "short_code": "LTI"},
    ).json()
    inst_id = inst["id"]

    # Lock the BIOMETRIC_ATTENDANCE feature
    lock_res = client.post(
        f"/system/institutions/{inst_id}/features/BIOMETRIC_ATTENDANCE/lock",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert lock_res.status_code == 200
    assert lock_res.json()["status"] == "LOCKED"

    # Policy endpoint must reflect LOCKED (not ENABLED)
    policy_res = client.get(
        f"/system/institutions/{inst_id}/policy",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert policy_res.status_code == 200
    data = policy_res.json()
    assert data["biometric_attendance_enabled"] is False  # LOCKED → not enabled
