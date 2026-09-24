import pytest
from datetime import date, datetime
from fastapi.testclient import TestClient

from app.models.user import User, Role
from app.models.leave_policy import LeavePolicy, TeacherLeaveBalance
from app.models.leave import LeaveRequest, LeaveStatus, PolicyEnforcementAudit
from app.models.day_order_calendar import CalendarDay, DayType
from app.models.system_setting import SystemSetting
from app.services import leave_policy_service, leave_service
from app.services.system_setting_service import set_setting, get_setting


def test_evaluate_leave_policy_strict_vs_advisory(db_session, test_teacher):
    # Setup test policy: Annual Leave (AL)
    policy = LeavePolicy(
        code="TEST_AL",
        name="Test Annual Leave",
        entitlement=1.0,
        period="YEAR",
        monthly_limit=1.0,
        is_active=True,
        advisory_allowed="ADVISORY",
    )
    db_session.add(policy)
    db_session.commit()
    db_session.refresh(policy)

    target_date = date(2026, 9, 25)

    # Give teacher 0 balance
    ay = leave_policy_service.get_current_academic_year(target_date)
    bal = TeacherLeaveBalance(
        teacher_id=test_teacher.id,
        leave_policy_id=policy.id,
        academic_year=ay,
        entitlement=1.0,
        consumed=1.0,
        remaining=0.0,
    )
    db_session.add(bal)
    db_session.commit()

    # 1. STRICT mode: violation should block submission (can_submit = False)
    set_setting(db_session, "policy_enforcement_mode", "STRICT")
    db_session.commit()

    res_strict = leave_policy_service.evaluate_leave_policy(
        db=db_session,
        teacher_id=test_teacher.id,
        target_date=target_date,
        policy_id=policy.id,
    )

    assert res_strict["compliant"] is False
    assert res_strict["mode"] == "STRICT"
    assert res_strict["can_submit"] is False
    assert res_strict["requires_warning"] is False
    assert any(v["rule_code"] == "BALANCE_EXHAUSTED" and v["severity"] == "BLOCK" for v in res_strict["violations"])

    # 2. ADVISORY mode: violation should allow submission with warning (can_submit = True, requires_warning = True)
    set_setting(db_session, "policy_enforcement_mode", "ADVISORY")
    db_session.commit()

    res_advisory = leave_policy_service.evaluate_leave_policy(
        db=db_session,
        teacher_id=test_teacher.id,
        target_date=target_date,
        policy_id=policy.id,
    )

    assert res_advisory["compliant"] is False
    assert res_advisory["mode"] == "ADVISORY"
    assert res_advisory["can_submit"] is True
    assert res_advisory["requires_warning"] is True
    assert res_advisory["requires_hod_review"] is True
    assert any(v["rule_code"] == "BALANCE_EXHAUSTED" and v["severity"] == "WARNING" for v in res_advisory["violations"])


def test_approve_leave_with_exception(db_session, test_teacher, test_admin):
    policy = LeavePolicy(
        code="TEST_EXC",
        name="Exception Test Leave",
        entitlement=1.0,
        period="YEAR",
        is_active=True,
    )
    db_session.add(policy)
    db_session.commit()

    target_date = date(2026, 9, 25)
    # Ensure working calendar day exists
    cal_day = db_session.query(CalendarDay).filter(CalendarDay.date == target_date).first()
    if not cal_day:
        cal_day = CalendarDay(date=target_date, day_order=1, day_type=DayType.working)
        db_session.add(cal_day)
        db_session.commit()

    # Create pending leave request with policy violation
    leave = LeaveRequest(
        teacher_id=test_teacher.id,
        leave_policy_id=policy.id,
        date=target_date,
        day_order=1,
        period_number=1,
        reason="Family emergency",
        status=LeaveStatus.pending,
        policy_compliant=False,
        policy_violation=True,
        policy_enforcement_mode="ADVISORY",
        policy_warning_acknowledged=True,
    )
    db_session.add(leave)
    db_session.commit()
    db_session.refresh(leave)

    # Approve with exception
    updated_leave, _ = leave_service.approve_leave_with_exception(
        leave_id=leave.id,
        db=db_session,
        hod_acknowledged=True,
        exception_reason="Special circumstance approved by HOD",
        actor_id=test_admin.id,
    )

    assert updated_leave.status == LeaveStatus.approved_with_exception
    assert updated_leave.exception_reason == "Special circumstance approved by HOD"
    assert updated_leave.exception_approved_by_id == test_admin.id
    assert updated_leave.exception_approved_at is not None


def test_policy_enforcement_routes(client, auth_headers_principal, auth_headers_teacher):
    # 1. Get current mode
    res = client.get("/api/policy-settings/enforcement-mode", headers=auth_headers_teacher)
    assert res.status_code == 200
    data = res.json()
    assert "mode" in data

    # 2. Toggle mode as Principal
    patch_res = client.patch(
        "/api/policy-settings/enforcement-mode",
        headers=auth_headers_principal,
        json={"mode": "ADVISORY", "reason": "Exam preparation period flexibility"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["mode"] == "ADVISORY"

    # 3. Check audit list
    audit_res = client.get("/api/policy-settings/enforcement-mode/audit", headers=auth_headers_principal)
    assert audit_res.status_code == 200
    audits = audit_res.json()
    assert len(audits) >= 1
    assert audits[0]["new_mode"] == "ADVISORY"
    assert audits[0]["reason"] == "Exam preparation period flexibility"

    # 4. Teacher cannot toggle mode (403)
    teacher_patch = client.patch(
        "/api/policy-settings/enforcement-mode",
        headers=auth_headers_teacher,
        json={"mode": "STRICT"},
    )
    assert teacher_patch.status_code == 403


def test_leave_submission_enforcement_flow(client, auth_headers_teacher, auth_headers_principal, db_session, test_teacher):
    policy = LeavePolicy(
        code="SUB_TEST",
        name="Submission Test Policy",
        entitlement=0.0,  # 0 entitlement forces violation
        period="YEAR",
        is_active=True,
    )
    db_session.add(policy)
    db_session.commit()

    target_date = date(2026, 9, 25)
    cal_day = db_session.query(CalendarDay).filter(CalendarDay.date == target_date).first()
    if not cal_day:
        cal_day = CalendarDay(date=target_date, day_order=1, day_type=DayType.working)
        db_session.add(cal_day)
        db_session.commit()

    # 1. STRICT mode: submission must fail with 422
    client.patch(
        "/api/policy-settings/enforcement-mode",
        headers=auth_headers_principal,
        json={"mode": "STRICT"},
    )

    payload = {
        "date": "2026-09-25",
        "period_number": 1,
        "reason": "Test leave under strict mode",
        "leave_policy_id": policy.id,
        "policy_warning_acknowledged": False,
    }

    res_strict = client.post("/api/leaves/", headers=auth_headers_teacher, json=payload)
    assert res_strict.status_code == 422

    # 2. ADVISORY mode without acknowledgement: must fail with 422
    client.patch(
        "/api/policy-settings/enforcement-mode",
        headers=auth_headers_principal,
        json={"mode": "ADVISORY"},
    )

    res_adv_unack = client.post("/api/leaves/", headers=auth_headers_teacher, json=payload)
    assert res_adv_unack.status_code == 422
    assert "acknowledgement is required" in res_adv_unack.json()["detail"]

    # 3. ADVISORY mode with acknowledgement: succeeds and sets policy_violation=True
    payload["policy_warning_acknowledged"] = True
    res_adv_ack = client.post("/api/leaves/", headers=auth_headers_teacher, json=payload)
    assert res_adv_ack.status_code == 201
    leave_data = res_adv_ack.json()
    assert leave_data["policy_violation"] is True
    assert leave_data["policy_enforcement_mode"] == "ADVISORY"
    assert leave_data["policy_warning_acknowledged"] is True


def test_edit_leave_policy_endpoint(client, db_session, auth_headers_principal, auth_headers_teacher):
    # Create test policy
    policy = LeavePolicy(
        code="EDIT_TEST",
        name="Editable Policy",
        entitlement=10.0,
        monthly_limit=2.0,
        document_required=False,
        advisory_allowed="ADVISORY",
        period="YEAR",
        is_active=True,
    )
    db_session.add(policy)
    db_session.commit()
    db_session.refresh(policy)

    # 1. Teachers cannot edit policy (403 Forbidden)
    res_teacher = client.put(
        f"/api/leave-policies/{policy.id}",
        headers=auth_headers_teacher,
        json={"advisory_allowed": "STRICT", "entitlement": 15.0},
    )
    assert res_teacher.status_code == 403

    # 2. Principal can edit policy
    res_principal = client.put(
        f"/api/leave-policies/{policy.id}",
        headers=auth_headers_principal,
        json={
            "advisory_allowed": "STRICT",
            "entitlement": 14.0,
            "monthly_limit": 1.5,
            "document_required": True,
            "description": "Updated by Principal",
        },
    )
    assert res_principal.status_code == 200
    updated = res_principal.json()
    assert updated["advisory_allowed"] == "STRICT"
    assert updated["entitlement"] == 14.0
    assert updated["monthly_limit"] == 1.5
    assert updated["document_required"] is True
    assert updated["description"] == "Updated by Principal"

    # 3. Verify GET returns updated data
    res_get = client.get(f"/api/leave-policies/{policy.id}", headers=auth_headers_principal)
    assert res_get.status_code == 200
    assert res_get.json()["advisory_allowed"] == "STRICT"


