import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import (
    get_current_user,
    require_teacher,
    require_admin,
    require_principal_or_system_admin,
    get_tenant_department_id,
)
from app.models.user import User, Role
from app.schemas.leave_policy import (
    LeavePolicyOut,
    TeacherPolicyBalanceOut,
    LeaveValidationRequest,
    LeaveValidationOut,
    LeaveBalanceTransactionOut,
    TeacherLeaveBalanceSummaryOut,
    DepartmentLeaveBalanceOverviewOut,
    AdminBalanceAdjustRequest,
)
from app.services import leave_policy_service, leave_consumption_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Leave Policies & Balances"])


# ── Active Leave Policies ──────────────────────────────────────────────────

@router.get("/leave-policies/active", response_model=List[LeavePolicyOut])
def get_active_policies(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns all active institutional leave policies (AL, IL, ML, WL, VL, OOD)."""
    return leave_policy_service.get_active_policies(db)


# ── Teacher Leave Balances (Self) ──────────────────────────────────────────

@router.get("/leave-balances/me", response_model=TeacherLeaveBalanceSummaryOut)
def get_my_leave_balances(
    academic_year: Optional[str] = Query(None, description="e.g. 2026-2027"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    """
    Returns the authenticated teacher's leave balances per policy alongside
    their separate substitution credit balance, keeping the two systems completely distinct.
    """
    ay = academic_year or leave_policy_service.get_current_academic_year()
    policy_balances = leave_policy_service.get_teacher_balances(db, current_user.id, ay)
    sub_balance = leave_policy_service.get_teacher_substitution_credit_balance(db, current_user.id)

    return TeacherLeaveBalanceSummaryOut(
        teacher_id=current_user.id,
        teacher_name=current_user.name,
        department=current_user.department or (current_user.tenant_department.name if getattr(current_user, "tenant_department", None) else None),
        academic_year=ay,
        balances=policy_balances,
        substitution_credit_balance=sub_balance,
    )


@router.get("/leave-balances/me/{leave_type}", response_model=TeacherPolicyBalanceOut)
def get_my_policy_balance(
    leave_type: str,
    academic_year: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    """Returns the teacher's balance and monthly usage for a specific leave policy code (e.g. 'AL')."""
    policy = leave_policy_service.get_policy_by_id_or_code(db, policy_code=leave_type)
    if not policy:
        raise HTTPException(status_code=404, detail=f"Leave policy '{leave_type}' not found.")

    ay = academic_year or leave_policy_service.get_current_academic_year()
    balances = leave_policy_service.get_teacher_balances(db, current_user.id, ay)
    matched = next((b for b in balances if b.policy_id == policy.id), None)
    if not matched:
        raise HTTPException(status_code=404, detail=f"Balance for policy '{leave_type}' not found.")
    return matched


# ── Leave Pre-Submission Dynamic Validator ─────────────────────────────────

@router.post("/leaves/validate", response_model=LeaveValidationOut)
def validate_leave_pre_submission(
    payload: LeaveValidationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    """
    Dynamic intelligence endpoint queried BEFORE leave submission.
    Evaluates requested duration against leave entitlement, monthly limits, and document rules.
    Does NOT deduct any balance.
    """
    return leave_policy_service.validate_leave_application(
        db=db,
        teacher_id=current_user.id,
        target_date=payload.target_date,
        policy_id=payload.policy_id,
        policy_code=payload.policy_code,
        whole_day=payload.whole_day,
        period_numbers=payload.period_numbers,
    )


# ── HOD / Admin Department Overview ────────────────────────────────────────

@router.get("/leave-balances/department", response_model=DepartmentLeaveBalanceOverviewOut)
def get_department_leave_overview(
    department_id: Optional[int] = Query(None),
    academic_year: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
    tenant_dept_id: Optional[int] = Depends(get_tenant_department_id),
):
    """
    Returns department staff leave balance matrix.
    HODs are strictly isolated to their own department via tenant_dept_id.
    Principal / System Admin can inspect any or all departments.
    """
    effective_dept_id = tenant_dept_id if tenant_dept_id is not None else department_id
    return leave_policy_service.get_department_leave_overview(
        db=db,
        tenant_department_id=effective_dept_id,
        academic_year=academic_year,
    )


@router.get("/leave-balances/department/{teacher_id}", response_model=TeacherLeaveBalanceSummaryOut)
def get_department_teacher_balance_detail(
    teacher_id: int,
    academic_year: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
    tenant_dept_id: Optional[int] = Depends(get_tenant_department_id),
):
    """
    HOD teacher detail view. Enforces department isolation.
    """
    target_teacher = db.query(User).filter(User.id == teacher_id).first()
    if not target_teacher:
        raise HTTPException(status_code=404, detail="Teacher not found.")

    if tenant_dept_id is not None and target_teacher.department_id != tenant_dept_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You can only view leave balances for teachers in your department.",
        )

    ay = academic_year or leave_policy_service.get_current_academic_year()
    policy_balances = leave_policy_service.get_teacher_balances(db, teacher_id, ay)
    sub_balance = leave_policy_service.get_teacher_substitution_credit_balance(db, teacher_id)

    return TeacherLeaveBalanceSummaryOut(
        teacher_id=target_teacher.id,
        teacher_name=target_teacher.name,
        department=target_teacher.department or (target_teacher.tenant_department.name if getattr(target_teacher, "tenant_department", None) else None),
        academic_year=ay,
        balances=policy_balances,
        substitution_credit_balance=sub_balance,
    )


# ── Leave Balance Transaction Ledger ───────────────────────────────────────

@router.get("/leave-balances/{teacher_id}/ledger", response_model=List[LeaveBalanceTransactionOut])
def get_teacher_leave_ledger(
    teacher_id: int,
    policy_id: Optional[int] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_dept_id: Optional[int] = Depends(get_tenant_department_id),
):
    """
    Returns the immutable audit ledger of leave balance transactions.
    Teachers can view their own ledger; HODs can view ledgers for staff in their department.
    """
    if current_user.role == Role.teacher and current_user.id != teacher_id:
        raise HTTPException(status_code=403, detail="You can only view your own leave balance ledger.")

    if current_user.role in (Role.admin, Role.manager) and tenant_dept_id is not None:
        target_teacher = db.query(User).filter(User.id == teacher_id).first()
        if not target_teacher or target_teacher.department_id != tenant_dept_id:
            raise HTTPException(status_code=403, detail="You can only view ledgers for staff in your department.")

    return leave_policy_service.get_teacher_ledger(db, teacher_id, policy_id=policy_id, limit=limit)


# ── Administrative Balance Adjustment ──────────────────────────────────────

@router.post("/leave-balances/{teacher_id}/adjust", response_model=TeacherPolicyBalanceOut)
def adjust_teacher_balance_admin(
    teacher_id: int,
    payload: AdminBalanceAdjustRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """
    Authorized administrative balance adjustment.
    Creates an immutable ADMIN_ADJUSTMENT transaction in leave_balance_transactions and an audit log.
    Never directly updates balances without a ledger entry.
    """
    bal = leave_policy_service.adjust_balance_admin(
        db=db,
        admin_user=admin_user,
        teacher_id=teacher_id,
        policy_id=payload.policy_id,
        change=payload.change,
        reason=payload.reason,
    )
    pol = bal.leave_policy
    return TeacherPolicyBalanceOut(
        policy_id=pol.id,
        code=pol.code,
        name=pol.name,
        description=pol.description,
        period=pol.period,
        entitlement=bal.entitlement,
        consumed=bal.consumed,
        remaining=bal.remaining,
        monthly_limit=pol.monthly_limit,
        monthly_consumed=0.0,
        monthly_remaining=pol.monthly_limit,
        semester_limit=pol.semester_limit,
        approval_required=pol.approval_required,
        document_required=pol.document_required,
        is_on_duty=pol.is_on_duty,
    )


# ── Leave Consumption Endpoints ────────────────────────────────────────────

@router.post("/leaves/{leave_id}/consume")
def consume_approved_leave(
    leave_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """
    Server-side leave consumption trigger.
    Transitions approved leave to 'consumed' and deducts entitlement exactly once (idempotent).
    Does NOT touch substitution credits.
    """
    leave = leave_consumption_service.consume_leave(db, leave_id, actor_id=admin_user.id)
    return {
        "success": True,
        "leave_id": leave.id,
        "status": leave.status.value,
        "consumed_at": leave.consumed_at.isoformat() if leave.consumed_at else None,
        "policy_id": leave.leave_policy_id,
    }


@router.post("/leaves/consume-due")
def trigger_due_leaves_consumption(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """
    Triggers batch consumption of approved leaves whose date is today or past.
    """
    count = leave_consumption_service.process_due_leave_consumption(db)
    return {"success": True, "consumed_count": count}
