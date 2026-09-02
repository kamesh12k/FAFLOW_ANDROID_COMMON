import pytest
from datetime import date, timedelta
from fastapi import status
from app.models.user import Role
from app.models.operational_staff import StaffCategory, EmploymentStatus
from app.core.security import create_access_token, hash_password
from app.models.user import User, Role


def test_staff_leave_apply_approve_ledger(client, db_session):
    # 1. Create Manager
    manager = User(
        name="Campus Facilities Manager",
        username="facilities_mgr",
        email=None,
        password_hash=hash_password("Manager123!"),
        role=Role.manager,
        must_change_credentials=False,
        is_active=True,
    )
    db_session.add(manager)
    db_session.commit()
    db_session.refresh(manager)

    # 2. Create Laboratory Staff with User Account
    lab_user = User(
        name="Ramesh Tech",
        username="ramesh_lab",
        email=None,
        password_hash=hash_password("Staff123!"),
        role=Role.lab_staff,
        must_change_credentials=False,
        is_active=True,
    )
    db_session.add(lab_user)
    db_session.commit()
    db_session.refresh(lab_user)

    # Create Operational Staff record
    from app.models.operational_staff import OperationalStaff
    staff = OperationalStaff(
        employee_code="LAB-TEST-99",
        full_name="Ramesh Tech",
        category=StaffCategory.laboratory,
        designation="Lead Technician",
        user_id=lab_user.id,
        employment_status=EmploymentStatus.active,
    )
    db_session.add(staff)
    db_session.commit()
    db_session.refresh(staff)


    staff_headers = {"Authorization": f"Bearer {create_access_token({'sub': str(lab_user.id)})}"}
    mgr_headers = {"Authorization": f"Bearer {create_access_token({'sub': str(manager.id)})}"}


    # 3. Staff checks initial ledger
    res = client.get("/staff/ledger", headers=staff_headers)
    assert res.status_code == status.HTTP_200_OK
    ledger_data = res.json()
    assert ledger_data["current_balance"] == 12.0
    assert len(ledger_data["transactions"]) == 1
    assert ledger_data["transactions"][0]["category"] == "opening_balance"

    # 4. Staff applies for a 2-day leave
    start_d = (date.today() + timedelta(days=2)).isoformat()
    end_d = (date.today() + timedelta(days=3)).isoformat()

    apply_res = client.post(
        "/staff/leaves",
        json={
            "start_date": start_d,
            "end_date": end_d,
            "leave_type": "casual",
            "is_half_day": False,
            "reason": "Attending family function",
        },
        headers=staff_headers,
    )
    assert apply_res.status_code == status.HTTP_201_CREATED
    leave_info = apply_res.json()
    assert leave_info["days_count"] == 2.0
    assert leave_info["status"] == "pending"

    # 5. Manager views pending leaves
    mgr_leaves_res = client.get("/manager/leaves?status_filter=pending", headers=mgr_headers)
    assert mgr_leaves_res.status_code == status.HTTP_200_OK
    pending_list = mgr_leaves_res.json()
    assert len(pending_list) >= 1
    target_leave = [l for l in pending_list if l["id"] == leave_info["id"]][0]
    assert target_leave["staff_name"] == "Ramesh Tech"

    # 6. Manager approves leave
    approve_res = client.post(
        f"/manager/leaves/{leave_info['id']}/approve",
        json={"approval_remarks": "Approved. Please ensure Lab 101 keys are handed over."},
        headers=mgr_headers,
    )
    assert approve_res.status_code == status.HTTP_200_OK

    # 7. Staff checks ledger after approval
    res_after = client.get("/staff/ledger", headers=staff_headers)
    assert res_after.status_code == status.HTTP_200_OK
    ledger_after = res_after.json()
    assert ledger_after["current_balance"] == 10.0  # 12.0 - 2.0
    assert ledger_after["total_leaves_taken"] == 2.0
    assert len(ledger_after["transactions"]) == 2
    assert ledger_after["transactions"][0]["category"] == "leave_deduction"
    assert ledger_after["transactions"][0]["change"] == -2.0

    # 8. Manager awards compensatory credit for overtime / special maintenance duty
    adjust_res = client.post(
        "/manager/credits/adjust",
        json={
            "staff_id": staff.id,
            "change": 1.5,
            "category": "overtime_duty",
            "reason": "Sunday Computer Lab OS Image Deployment",
        },
        headers=mgr_headers,
    )
    assert adjust_res.status_code == status.HTTP_200_OK

    # 9. Verify staff balance updated with compensation
    res_final = client.get("/staff/ledger", headers=staff_headers)
    assert res_final.status_code == status.HTTP_200_OK
    ledger_final = res_final.json()
    assert ledger_final["current_balance"] == 11.5  # 10.0 + 1.5
    assert ledger_final["total_credits_earned"] == 1.5

    # 10. Manager updates staff annual leave limit / quota (e.g. from 12.0 to 15.0)
    quota_res = client.post(
        "/manager/credits/quota",
        json={
            "staff_id": staff.id,
            "annual_quota": 15.0,
            "adjust_balance": True,
            "reason": "Annual quota upgraded to 15 days",
        },
        headers=mgr_headers,
    )
    assert quota_res.status_code == status.HTTP_200_OK
    quota_info = quota_res.json()
    assert quota_info["annual_quota"] == 15.0
    assert quota_info["balance"] == 14.5  # 11.5 + (15.0 - 12.0)

    # 11. Staff ledger confirms new quota & updated balance
    res_quota = client.get("/staff/ledger", headers=staff_headers)
    assert res_quota.status_code == status.HTTP_200_OK
    ledger_quota = res_quota.json()
    assert ledger_quota["annual_quota"] == 15.0
    assert ledger_quota["current_balance"] == 14.5

