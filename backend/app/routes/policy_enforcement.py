from datetime import date, datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func, extract

from app.database import get_db
from app.models.user import User, Role
from app.models.system_setting import SystemSetting
from app.models.leave import LeaveRequest, LeaveStatus, PolicyEnforcementAudit
from app.models.leave_policy import LeavePolicy
from app.services.system_setting_service import get_setting, set_setting
from app.services.admin_service import log_audit_event
from app.core.dependencies import require_credentials_set, require_principal_or_system_admin

router = APIRouter(prefix="/policy-settings", tags=["policy-settings"])


class ModeUpdateRequest(BaseModel):
    mode: str = Field(..., description="Target policy enforcement mode: STRICT or ADVISORY")
    reason: Optional[str] = Field(None, max_length=500, description="Optional rationale for changing the enforcement mode")


class ModeAuditItem(BaseModel):
    id: int
    actor_user_id: Optional[int] = None
    actor_name: Optional[str] = None
    previous_mode: str
    new_mode: str
    reason: Optional[str] = None
    created_at: datetime


@router.get("/enforcement-mode")
def get_enforcement_mode(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_credentials_set),
):
    """
    Returns current institution-level policy enforcement mode (STRICT | ADVISORY),
    along with metadata on who changed it last and total active policies.
    Accessible to any authenticated user (teachers, HODs, Principals).
    """
    mode = (get_setting(db, "policy_enforcement_mode", "STRICT") or "STRICT").upper()
    latest_audit = (
        db.query(PolicyEnforcementAudit)
        .order_by(PolicyEnforcementAudit.id.desc())
        .first()
    )
    active_policies_count = db.query(LeavePolicy).filter(LeavePolicy.is_active == True).count()

    last_changed_by = None
    last_changed_at = None
    last_reason = None

    if latest_audit:
        last_changed_at = latest_audit.created_at
        last_reason = latest_audit.reason
        if latest_audit.actor:
            last_changed_by = {
                "id": latest_audit.actor.id,
                "name": latest_audit.actor.name,
                "role": latest_audit.actor.role.value if hasattr(latest_audit.actor.role, "value") else str(latest_audit.actor.role),
            }

    return {
        "mode": mode,
        "last_changed_by": last_changed_by,
        "last_changed_at": last_changed_at,
        "last_reason": last_reason,
        "active_policies_count": active_policies_count,
    }


@router.patch("/enforcement-mode")
def set_enforcement_mode(
    payload: ModeUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_principal_or_system_admin),
):
    """
    Toggles policy enforcement mode between STRICT and ADVISORY.
    Restricted strictly to Principal and System Admin.
    Records an immutable audit entry in policy_enforcement_audit.
    """
    new_mode = payload.mode.strip().upper()
    if new_mode not in ("STRICT", "ADVISORY"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mode must be either 'STRICT' or 'ADVISORY'",
        )

    current_mode = (get_setting(db, "policy_enforcement_mode", "STRICT") or "STRICT").upper()

    set_setting(db, "policy_enforcement_mode", new_mode)

    audit_entry = PolicyEnforcementAudit(
        actor_user_id=current_user.id,
        previous_mode=current_mode,
        new_mode=new_mode,
        reason=payload.reason.strip() if payload.reason else None,
    )
    db.add(audit_entry)
    db.commit()

    log_audit_event(
        db,
        current_user.id,
        "policy.enforcement_mode_changed",
        "system_setting",
        None,
        {"previous_mode": current_mode, "new_mode": new_mode, "reason": payload.reason},
    )

    return {
        "status": "success",
        "mode": new_mode,
        "previous_mode": current_mode,
        "message": f"Policy enforcement mode switched to {new_mode}",
    }


@router.get("/enforcement-mode/audit", response_model=List[ModeAuditItem])
def get_enforcement_audit(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_principal_or_system_admin),
):
    """
    Returns the last 50 mode toggle audit records.
    Restricted to Principal and System Admin.
    """
    audits = (
        db.query(PolicyEnforcementAudit)
        .order_by(PolicyEnforcementAudit.id.desc())
        .limit(50)
        .all()
    )
    results = []
    for a in audits:
        results.append(
            ModeAuditItem(
                id=a.id,
                actor_user_id=a.actor_user_id,
                actor_name=a.actor.name if a.actor else "System",
                previous_mode=a.previous_mode,
                new_mode=a.new_mode,
                reason=a.reason,
                created_at=a.created_at,
            )
        )
    return results


@router.get("/enforcement-mode/compliance-report")
def get_compliance_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_principal_or_system_admin),
):
    """
    Returns policy compliance analytics for today and the current month.
    """
    today = date.today()
    current_mode = (get_setting(db, "policy_enforcement_mode", "STRICT") or "STRICT").upper()

    # Query leaves for today
    today_leaves = db.query(LeaveRequest).filter(LeaveRequest.date == today).all()
    today_total = len(today_leaves)
    today_compliant = sum(1 for l in today_leaves if l.policy_compliant is True)
    today_warnings = sum(1 for l in today_leaves if l.policy_violation is True)
    today_exceptions = sum(1 for l in today_leaves if l.status == LeaveStatus.approved_with_exception)
    today_pending_exceptions = sum(1 for l in today_leaves if l.policy_violation is True and l.status == LeaveStatus.pending)

    # Query leaves for current month
    month_leaves = (
        db.query(LeaveRequest)
        .filter(
            extract("year", LeaveRequest.date) == today.year,
            extract("month", LeaveRequest.date) == today.month,
        )
        .all()
    )
    month_total = len(month_leaves)
    month_compliant = sum(1 for l in month_leaves if l.policy_compliant is True)
    month_warnings = sum(1 for l in month_leaves if l.policy_violation is True)
    month_exceptions = sum(1 for l in month_leaves if l.status == LeaveStatus.approved_with_exception)
    month_pending_exceptions = sum(1 for l in month_leaves if l.policy_violation is True and l.status == LeaveStatus.pending)

    # Per policy summary
    policies = db.query(LeavePolicy).filter(LeavePolicy.is_active == True).all()
    policy_breakdown = []
    for pol in policies:
        pol_month = [l for l in month_leaves if l.leave_policy_id == pol.id]
        pol_total = len(pol_month)
        pol_violations = sum(1 for l in pol_month if l.policy_violation is True)
        pol_exceptions = sum(1 for l in pol_month if l.status == LeaveStatus.approved_with_exception)
        policy_breakdown.append({
            "policy_id": pol.id,
            "policy_code": pol.code,
            "policy_name": pol.name,
            "advisory_allowed": pol.advisory_allowed,
            "month_total": pol_total,
            "month_violations": pol_violations,
            "month_exceptions": pol_exceptions,
        })

    return {
        "current_mode": current_mode,
        "today": {
            "total_leaves": today_total,
            "compliant": today_compliant,
            "violations_or_warnings": today_warnings,
            "exceptions_approved": today_exceptions,
            "pending_exceptions": today_pending_exceptions,
        },
        "month": {
            "total_leaves": month_total,
            "compliant": month_compliant,
            "violations_or_warnings": month_warnings,
            "exceptions_approved": month_exceptions,
            "pending_exceptions": month_pending_exceptions,
        },
        "policy_breakdown": policy_breakdown,
    }
