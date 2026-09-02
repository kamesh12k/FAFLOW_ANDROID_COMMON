import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.models.user import User, Role
from app.models.room import Room, RoomType
from app.models.department import Department
from app.models.operational_staff import OperationalStaff, StaffCategory, EmploymentStatus, ShiftType
from app.core.security import hash_password, create_access_token


@pytest.fixture
def manager_user(db_session: Session):
    user = User(
        name="Test Manager",
        username="test_manager",
        email=None,
        password_hash=hash_password("Manager123!"),
        role=Role.manager,
        must_change_credentials=False,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def manager_headers(manager_user):
    token = create_access_token({"sub": str(manager_user.id)})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def system_admin_headers(db_session: Session):
    admin = db_session.query(User).filter(User.role == Role.system_admin).first()
    if not admin:
        admin = User(
            name="Sys Admin",
            username="sysadmin",
            password_hash=hash_password("AdminPass123!"),
            role=Role.system_admin,
            must_change_credentials=False,
            is_active=True,
        )
        db_session.add(admin)
        db_session.commit()
        db_session.refresh(admin)
    token = create_access_token({"sub": str(admin.id)})
    return {"Authorization": f"Bearer {token}"}


def test_system_admin_manager_crud(client: TestClient, system_admin_headers: dict, db_session: Session):
    # 1. Create Manager
    create_payload = {
        "name": "New Manager",
        "username": "new_manager_user",
        "password": "Password123!",
        "department_id": None,
    }
    res = client.post("/admin/managers", json=create_payload, headers=system_admin_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "New Manager"
    assert data["role"] == "manager"
    mgr_id = data["id"]

    # 2. List Managers
    list_res = client.get("/admin/managers", headers=system_admin_headers)
    assert list_res.status_code == 200
    assert any(m["id"] == mgr_id for m in list_res.json())

    # 3. Update Manager
    up_res = client.put(f"/admin/managers/{mgr_id}", json={"name": "Updated Manager Name"}, headers=system_admin_headers)
    assert up_res.status_code == 200
    assert up_res.json()["name"] == "Updated Manager Name"

    # 4. Delete Manager
    del_res = client.delete(f"/admin/managers/{mgr_id}", headers=system_admin_headers)
    assert del_res.status_code == 204


def test_manager_access_control(client: TestClient, manager_headers: dict):
    # Manager must NOT be able to access teacher endpoints (require_teacher blocks Manager with 403)
    res = client.get("/timetable/submissions/my", headers=manager_headers)
    assert res.status_code == 403

    # Manager must NOT be able to access system admin master export
    exp_res = client.get("/admin/master-export", headers=manager_headers)
    assert exp_res.status_code == 403




def test_manager_operational_staff_crud(client: TestClient, manager_headers: dict, db_session: Session):
    # Create a test Lab Room
    lab_room = Room(room_number="LAB-501", room_type=RoomType.lab, capacity=30)
    db_session.add(lab_room)
    db_session.commit()
    db_session.refresh(lab_room)

    # 1. Create Laboratory Staff
    lab_staff_payload = {
        "employee_code": "LAB-TEST-01",
        "full_name": "Ravi Lab Tech",
        "category": "laboratory",
        "designation": "Lab Incharge",
        "assigned_room_id": lab_room.id,
        "phone_number": "9876543210",
        "shift_type": "morning",
    }
    create_res = client.post("/manager/staff", json=lab_staff_payload, headers=manager_headers)
    assert create_res.status_code == 201
    staff_data = create_res.json()
    assert staff_data["full_name"] == "Ravi Lab Tech"
    assert staff_data["assigned_room_number"] == "LAB-501"
    staff_id = staff_data["id"]

    # 2. Query Dashboard
    dash_res = client.get("/manager/dashboard", headers=manager_headers)
    assert dash_res.status_code == 200
    stats = dash_res.json()
    assert stats["total_staff"] >= 1
    assert stats["total_lab_staff"] >= 1

    # 3. List Staff
    list_res = client.get("/manager/staff", params={"category": "laboratory"}, headers=manager_headers)
    assert list_res.status_code == 200
    assert any(s["id"] == staff_id for s in list_res.json())

    # 4. Update Staff
    up_res = client.put(f"/manager/staff/{staff_id}", json={"designation": "Chief Lab Specialist"}, headers=manager_headers)
    assert up_res.status_code == 200
    assert up_res.json()["designation"] == "Chief Lab Specialist"

    # 5. Toggle Status
    status_res = client.patch(f"/manager/staff/{staff_id}/status", params={"employment_status": "on_leave"}, headers=manager_headers)
    assert status_res.status_code == 200
    assert status_res.json()["employment_status"] == "on_leave"

    # 6. Delete Staff
    del_res = client.delete(f"/manager/staff/{staff_id}", headers=manager_headers)
    assert del_res.status_code == 204


def test_staff_login_and_portal_access(client: TestClient, manager_headers: dict, db_session: Session):
    # 1. Create Staff with login credentials
    staff_payload = {
        "employee_code": "LAB-LOGIN-99",
        "full_name": "Karthik Lab Specialist",
        "category": "laboratory",
        "designation": "Lab Incharge",
        "phone_number": "9998887776",
        "username": "karthik.lab",
        "password": "Password123!",
    }
    create_res = client.post("/manager/staff", json=staff_payload, headers=manager_headers)
    assert create_res.status_code == 201
    staff_id = create_res.json()["id"]
    assert create_res.json()["has_login"] is True
    assert create_res.json()["username"] == "karthik.lab"

    # 2. Authenticate as staff member via /auth/login
    login_res = client.post("/auth/login", json={"identifier": "karthik.lab", "password": "Password123!"})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    staff_headers = {"Authorization": f"Bearer {token}"}

    # 3. Access Staff Portal /staff/me
    me_res = client.get("/staff/me", headers=staff_headers)
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["full_name"] == "Karthik Lab Specialist"
    assert me_data["employee_code"] == "LAB-LOGIN-99"

    # 4. Clean up
    del_res = client.delete(f"/manager/staff/{staff_id}", headers=manager_headers)
    assert del_res.status_code == 204

