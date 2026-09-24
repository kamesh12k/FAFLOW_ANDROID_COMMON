import logging
from datetime import date, datetime
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from fastapi import HTTPException, status

from app.models.leave_policy import (
    LeavePolicy,
    TeacherLeaveBalance,
    LeaveBalanceTransaction,
    LeaveBalanceTransactionType,
)
from app.models.leave import LeaveRequest, LeaveStatus
from app.models.credit import TeacherCredit
from app.models.user import User, Role
from app.models.timetable import TimetableSlot
from app.schemas.leave_policy import (
    LeavePolicyOut,
    TeacherPolicyBalanceOut,
    LeaveValidationOut,
    LeaveBalanceTransactionOut,
    TeacherLeaveBalanceSummaryOut,
    DepartmentLeaveBalanceOverviewOut,
)
from app.services.admin_service import log_audit_event
from app.services import day_order_service

logger = logging.getLogger(__name__)


def get_current_academic_year(target_date: Optional[date] = None) -> str:
    """Computes the institutional academic year string, e.g. '2026-2027'."""
    d = target_date or date.today()
    if d.month >= 6:
        return f"{d.year}-{d.year + 1}"
    else:
        return f"{d.year - 1}-{d.year}"


def get_active_policies(db: Session) -> List[LeavePolicy]:
    """Returns all active institutional leave policies ordered by code."""
    return db.query(LeavePolicy).filter(LeavePolicy.is_active == True).order_by(LeavePolicy.id).all()


def get_policy_by_id_or_code(db: Session, policy_id: Optional[int] = None, policy_code: Optional[str] = None) -> Optional[LeavePolicy]:
    query = db.query(LeavePolicy).filter(LeavePolicy.is_active == True)
    if policy_id:
        p = query.filter(LeavePolicy.id == policy_id).first()
        if p:
            return p
    if policy_code:
        p = query.filter(func.upper(LeavePolicy.code) == policy_code.strip().upper()).first()
        if p:
            return p
    # Default fallback to Applied Leave (AL) or any active policy
    p = query.filter(LeavePolicy.code == "AL").first()
    if p:
        return p
    p = query.first()
    if p:
        return p
    # If table is unseeded, auto-bootstrap default AL policy gracefully
    try:
        default_policy = LeavePolicy(
            name="Casual Leave / Applied Leave",
            code="AL",
            entitlement=12.0,
            monthly_limit=2,
            is_active=True,
            description="Default standard faculty leave entitlement"
        )
        db.add(default_policy)
        db.flush()
        return default_policy
    except Exception:
        db.rollback()
        return query.first()


def get_or_create_teacher_balance(
    db: Session,
    teacher_id: int,
    policy: LeavePolicy,
    academic_year: Optional[str] = None,
) -> TeacherLeaveBalance:
    """Atomically resolves or initializes a teacher's leave balance for a policy."""
    ay = academic_year or get_current_academic_year()
    balance = (
        db.query(TeacherLeaveBalance)
        .filter(
            TeacherLeaveBalance.teacher_id == teacher_id,
            TeacherLeaveBalance.leave_policy_id == policy.id,
            TeacherLeaveBalance.academic_year == ay,
        )
        .first()
    )

    if not balance:
        balance = TeacherLeaveBalance(
            teacher_id=teacher_id,
            leave_policy_id=policy.id,
            academic_year=ay,
            entitlement=policy.entitlement,
            consumed=0.0,
            remaining=policy.entitlement,
        )
        db.add(balance)
        db.flush()

        # Record opening balance in the dedicated leave balance transaction ledger
        tx = LeaveBalanceTransaction(
            teacher_id=teacher_id,
            leave_policy_id=policy.id,
            leave_request_id=None,
            transaction_type=LeaveBalanceTransactionType.OPENING_BALANCE.value,
            days=policy.entitlement,
            balance_before=0.0,
            balance_after=policy.entitlement,
            reason=f"Opening annual leave entitlement for {ay} ({policy.name})",
            created_by_id=None,
        )
        db.add(tx)
        db.commit()
        db.refresh(balance)

    return balance


def get_teacher_balances(
    db: Session,
    teacher_id: int,
    academic_year: Optional[str] = None,
    target_date: Optional[date] = None,
) -> List[TeacherPolicyBalanceOut]:
    """Returns all policy balances with consumption and monthly limits for a teacher."""
    ay = academic_year or get_current_academic_year(target_date)
    d = target_date or date.today()
    policies = get_active_policies(db)
    results = []

    for pol in policies:
        bal = get_or_create_teacher_balance(db, teacher_id, pol, ay)

        # Calculate consumed this month (both approved/consumed leaves in current calendar month)
        monthly_consumed = (
            db.query(func.count(func.distinct(LeaveRequest.date)))
            .filter(
                LeaveRequest.teacher_id == teacher_id,
                LeaveRequest.leave_policy_id == pol.id,
                LeaveRequest.status.in_([LeaveStatus.approved, LeaveStatus.consumed]),
                extract("year", LeaveRequest.date) == d.year,
                extract("month", LeaveRequest.date) == d.month,
            )
            .scalar() or 0
        )
        monthly_consumed_float = float(monthly_consumed)
        monthly_rem = max(0.0, pol.monthly_limit - monthly_consumed_float) if pol.monthly_limit is not None else None

        results.append(
            TeacherPolicyBalanceOut(
                id=bal.id,
                policy_id=pol.id,
                code=pol.code,
                policy_code=pol.code,
                name=pol.name,
                policy_name=pol.name,
                description=pol.description,
                period=pol.period,
                entitlement=bal.entitlement,
                consumed=bal.consumed,
                pending=0.0,
                remaining=bal.remaining,
                monthly_limit=pol.monthly_limit,
                max_per_month=int(pol.monthly_limit) if pol.monthly_limit is not None else None,
                monthly_consumed=monthly_consumed_float,
                monthly_remaining=monthly_rem,
                semester_limit=pol.semester_limit,
                approval_required=pol.approval_required,
                document_required=pol.document_required,
                requires_document=pol.document_required,
                is_on_duty=pol.is_on_duty,
            )
        )

    return results


def calculate_requested_leave_duration(
    db: Session,
    teacher_id: int,
    target_date: date,
    whole_day: bool = False,
    period_numbers: Optional[List[int]] = None,
) -> Tuple[float, int, List[int]]:
    """
    Computes duration in days according to institutional timetable rules.
    - If whole_day or multiple scheduled periods: evaluated as 1.0 day.
    - If single period: 1.0 day or proportional (standard FAFLOW faculty unit is 1.0 day of leave per calendar date).
    """
    calendar_day = db.query(day_order_service.CalendarDay).filter(day_order_service.CalendarDay.date == target_date).first()
    day_order = calendar_day.day_order if calendar_day else None

    scheduled_periods = []
    if day_order:
        slots = (
            db.query(TimetableSlot.period_number)
            .filter(TimetableSlot.teacher_id == teacher_id, TimetableSlot.day_order == day_order)
            .order_by(TimetableSlot.period_number)
            .all()
        )
        scheduled_periods = [s[0] for s in slots]

    effective_periods = scheduled_periods if whole_day or not period_numbers else [p for p in period_numbers if p in scheduled_periods or not scheduled_periods]
    period_count = len(effective_periods) if effective_periods else (len(period_numbers) if period_numbers else 1)
    # Institutional day duration: applying for scheduled periods on a date constitutes 1.0 day of leave
    days_duration = 1.0

    return days_duration, period_count, scheduled_periods


def evaluate_leave_policy(
    db: Session,
    teacher_id: int,
    target_date: date,
    policy_id: Optional[int] = None,
    policy_code: Optional[str] = None,
    whole_day: bool = False,
    period_numbers: Optional[List[int]] = None,
) -> Dict[str, Any]:
    """
    Evaluates leave application against institutional leave policies and the current
    enforcement mode (STRICT vs ADVISORY).
    
    Returns structured evaluation result dictionary:
    {
        "compliant": bool,
        "mode": "STRICT" | "ADVISORY",
        "can_submit": bool,
        "requires_warning": bool,
        "requires_hod_review": bool,
        "violations": [...],
        "leave_policy": dict,
        "balance": dict,
        "request": dict,
        "projected_balance": float,
        "monthly_policy": dict,
    }
    """
    from app.services.system_setting_service import get_setting

    policy = get_policy_by_id_or_code(db, policy_id, policy_code)
    if not policy:
        raise HTTPException(status_code=404, detail="Selected leave policy does not exist.")

    enforcement_mode = (get_setting(db, "policy_enforcement_mode", "STRICT") or "STRICT").upper()
    if enforcement_mode not in ("STRICT", "ADVISORY"):
        enforcement_mode = "STRICT"

    ay = get_current_academic_year(target_date)
    balance = get_or_create_teacher_balance(db, teacher_id, policy, ay)
    duration, period_count, scheduled_periods = calculate_requested_leave_duration(
        db, teacher_id, target_date, whole_day, period_numbers
    )

    projected_balance = round(balance.remaining - duration, 1)

    monthly_consumed = (
        db.query(func.count(func.distinct(LeaveRequest.date)))
        .filter(
            LeaveRequest.teacher_id == teacher_id,
            LeaveRequest.leave_policy_id == policy.id,
            LeaveRequest.status.in_([LeaveStatus.pending, LeaveStatus.approved, LeaveStatus.consumed, LeaveStatus.approved_with_exception]),
            extract("year", LeaveRequest.date) == target_date.year,
            extract("month", LeaveRequest.date) == target_date.month,
            LeaveRequest.date != target_date,
        )
        .scalar() or 0
    )
    monthly_consumed_float = float(monthly_consumed)
    monthly_rem = max(0.0, policy.monthly_limit - monthly_consumed_float) if policy.monthly_limit is not None else None

    violations = []
    advisory_allowed = getattr(policy, "advisory_allowed", "ADVISORY") or "ADVISORY"
    advisory_allowed = advisory_allowed.upper()

    def get_severity(default_is_block: bool = True) -> str:
        if advisory_allowed == "STRICT":
            return "BLOCK"
        elif advisory_allowed == "INFORMATIONAL":
            return "INFO"
        else:  # "ADVISORY"
            if enforcement_mode == "STRICT":
                return "BLOCK" if default_is_block else "WARNING"
            else:
                return "WARNING"

    # Check 1: Balance exhaustion / limit
    if balance.remaining <= 0:
        sev = get_severity(default_is_block=True)
        violations.append({
            "rule_code": "BALANCE_EXHAUSTED",
            "severity": sev,
            "message": f"You have 0 remaining {policy.name} entitlement for academic year {ay}.",
            "limit": balance.entitlement,
            "used": balance.consumed,
            "requested": duration,
        })
    elif duration > balance.remaining:
        sev = get_severity(default_is_block=True)
        violations.append({
            "rule_code": "BALANCE_EXHAUSTED",
            "severity": sev,
            "message": f"Request of {duration} day exceeds your available {policy.name} balance ({balance.remaining} days available).",
            "limit": balance.remaining,
            "used": balance.consumed,
            "requested": duration,
        })

    # Check 2: Monthly limit
    if policy.monthly_limit is not None and (monthly_consumed_float + duration) > policy.monthly_limit:
        sev = get_severity(default_is_block=True)
        violations.append({
            "rule_code": "MONTHLY_LIMIT_EXCEEDED",
            "severity": sev,
            "message": f"Maximum monthly limit reached for {policy.name} (Allowed: {policy.monthly_limit} day/month, already requested/consumed: {monthly_consumed_float} day).",
            "limit": policy.monthly_limit,
            "used": monthly_consumed_float,
            "requested": duration,
        })

    # Check 3: Document requirement
    if policy.document_required:
        doc_sev = "BLOCK" if advisory_allowed == "STRICT" else ("INFO" if advisory_allowed == "INFORMATIONAL" else "WARNING")
        violations.append({
            "rule_code": "DOCUMENT_REQUIRED",
            "severity": doc_sev,
            "message": f"Supporting documentation is required for {policy.name}.",
            "limit": None,
            "used": None,
            "requested": None,
        })

    compliant = len(violations) == 0
    has_block = any(v["severity"] == "BLOCK" for v in violations)
    can_submit = not has_block
    requires_warning = (not compliant) and can_submit
    requires_hod_review = not compliant

    return {
        "compliant": compliant,
        "mode": enforcement_mode,
        "can_submit": can_submit,
        "requires_warning": requires_warning,
        "requires_hod_review": requires_hod_review,
        "violations": violations,
        "leave_policy": {
            "id": policy.id,
            "code": policy.code,
            "name": policy.name,
            "description": policy.description,
            "period": policy.period,
            "advisory_allowed": advisory_allowed,
        },
        "balance": {
            "entitlement": balance.entitlement,
            "consumed": balance.consumed,
            "remaining": balance.remaining,
        },
        "request": {
            "duration": duration,
            "period_count": period_count,
            "scheduled_periods": scheduled_periods,
            "whole_day": whole_day,
        },
        "projected_balance": projected_balance,
        "monthly_policy": {
            "limit": policy.monthly_limit,
            "consumed": monthly_consumed_float,
            "remaining": monthly_rem,
        },
    }


def validate_leave_application(
    db: Session,
    teacher_id: int,
    target_date: date,
    policy_id: Optional[int] = None,
    policy_code: Optional[str] = None,
    whole_day: bool = False,
    period_numbers: Optional[List[int]] = None,
) -> LeaveValidationOut:
    """Pre-submission intelligence validator checking balance, monthly limit, and calendar gates."""
    eval_res = evaluate_leave_policy(
        db=db,
        teacher_id=teacher_id,
        target_date=target_date,
        policy_id=policy_id,
        policy_code=policy_code,
        whole_day=whole_day,
        period_numbers=period_numbers,
    )

    policy = get_policy_by_id_or_code(db, policy_id, policy_code)
    warnings = [v["message"] for v in eval_res["violations"] if v["severity"] != "BLOCK"]
    block_reason = next((v["message"] for v in eval_res["violations"] if v["severity"] == "BLOCK"), None)

    bal_remaining = float(eval_res["balance"]["remaining"]) if eval_res.get("balance") else 0.0
    proj_remaining = float(eval_res.get("projected_balance", 0.0))
    monthly_exceeded = any(v.get("rule_code") == "MONTHLY_LIMIT_EXCEEDED" for v in eval_res["violations"])
    doc_required = bool(policy.document_required) if policy else False

    android_violations = []
    for v in eval_res["violations"]:
        android_violations.append({
            "policy_id": policy.id if policy else None,
            "policy_code": policy.code if policy else None,
            "policy_name": policy.name if policy else None,
            "violation_type": v.get("rule_code", ""),
            "message": v.get("message", ""),
            "advisory_allowed": eval_res.get("mode") == "ADVISORY" or v.get("severity") != "BLOCK",
        })

    primary_msg = block_reason if not eval_res["can_submit"] else (warnings[0] if warnings else f"{policy.name if policy else 'Policy'} validated successfully")

    return LeaveValidationOut(
        allowed=eval_res["can_submit"],
        message=primary_msg,
        policy_code=policy.code if policy else "",
        policy_name=policy.name if policy else "",
        remaining_before=bal_remaining,
        projected_remaining=proj_remaining,
        monthly_limit_reached=monthly_exceeded,
        requires_document=doc_required,
        enforcement_mode=eval_res.get("mode", "STRICT"),
        requires_warning=eval_res.get("requires_warning", False),
        violations=android_violations,
        leave_policy=eval_res["leave_policy"],
        balance=eval_res["balance"],
        request=eval_res["request"],
        projected_balance=proj_remaining,
        monthly_policy=eval_res["monthly_policy"],
        semester_policy={
            "limit": policy.semester_limit,
        } if policy and policy.semester_limit else None,
        policy={
            "approval_required": policy.approval_required if policy else True,
            "document_required": doc_required,
            "is_on_duty": policy.is_on_duty if policy else False,
        },
        validation={
            "allowed": eval_res["can_submit"],
            "warnings": warnings,
            "reason": block_reason,
            "evaluation": eval_res,
        },
    )


def adjust_balance_admin(
    db: Session,
    admin_user: User,
    teacher_id: int,
    policy_id: int,
    change: float,
    reason: str,
) -> TeacherLeaveBalance:
    """Executes authorized administrative balance adjustment with row-level locking."""
    policy = db.query(LeavePolicy).filter(LeavePolicy.id == policy_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Leave policy not found.")

    teacher = db.query(User).filter(User.id == teacher_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found.")

    # Department Isolation: HOD can only adjust teachers in their own department
    if admin_user.role == Role.admin and admin_user.department_id:
        if teacher.department_id != admin_user.department_id:
            raise HTTPException(status_code=403, detail="You can only manage leave balances for your own department.")

    ay = get_current_academic_year()
    query = db.query(TeacherLeaveBalance).filter(
        TeacherLeaveBalance.teacher_id == teacher_id,
        TeacherLeaveBalance.leave_policy_id == policy_id,
        TeacherLeaveBalance.academic_year == ay,
    )
    if db.bind and db.bind.dialect.name == "postgresql":
        query = query.with_for_update()
    balance = query.first()

    if not balance:
        balance = get_or_create_teacher_balance(db, teacher_id, policy, ay)

    before = balance.remaining
    balance.entitlement = round(balance.entitlement + change, 1)
    balance.remaining = round(balance.remaining + change, 1)
    after = balance.remaining

    tx = LeaveBalanceTransaction(
        teacher_id=teacher_id,
        leave_policy_id=policy_id,
        leave_request_id=None,
        transaction_type=LeaveBalanceTransactionType.ADMIN_ADJUSTMENT.value,
        days=change,
        balance_before=before,
        balance_after=after,
        reason=reason,
        created_by_id=admin_user.id,
    )
    db.add(tx)
    db.commit()
    db.refresh(balance)

    log_audit_event(
        db,
        actor_user_id=admin_user.id,
        action="LEAVE_BALANCE_ADMIN_ADJUSTMENT",
        target_type="teacher_leave_balance",
        target_id=balance.id,
        details={
            "teacher_id": teacher_id,
            "teacher_name": teacher.name,
            "policy_code": policy.code,
            "change": change,
            "balance_before": before,
            "balance_after": after,
            "reason": reason,
        },
    )

    return balance


def get_teacher_ledger(db: Session, teacher_id: int) -> List[LeaveBalanceTransactionOut]:
    """Returns chronologically ordered audit transactions for a teacher's leave balances."""
    txs = (
        db.query(LeaveBalanceTransaction, LeavePolicy.code, LeavePolicy.name, User.name)
        .join(LeavePolicy, LeaveBalanceTransaction.leave_policy_id == LeavePolicy.id)
        .outerjoin(User, LeaveBalanceTransaction.created_by_id == User.id)
        .filter(LeaveBalanceTransaction.teacher_id == teacher_id)
        .order_by(LeaveBalanceTransaction.created_at.desc())
        .all()
    )

    return [
        LeaveBalanceTransactionOut(
            id=t[0].id,
            teacher_id=t[0].teacher_id,
            leave_policy_id=t[0].leave_policy_id,
            policy_code=t[1],
            policy_name=t[2],
            transaction_type=t[0].transaction_type,
            days=t[0].days,
            balance_before=t[0].balance_before,
            balance_after=t[0].balance_after,
            reason=t[0].reason,
            leave_request_id=t[0].leave_request_id,
            created_by_name=t[3],
            created_at=t[0].created_at,
        )
        for t in txs
    ]


def get_department_leave_overview(
    db: Session,
    department_id: Optional[int] = None,
    academic_year: Optional[str] = None,
) -> DepartmentLeaveBalanceOverviewOut:
    """Department-isolated staff leave balances overview for HOD and institutional governance."""
    teacher_query = db.query(User).filter(User.role == Role.teacher, User.is_active == True)
    if department_id:
        teacher_query = teacher_query.filter(User.department_id == department_id)
    teachers = teacher_query.order_by(User.name).all()

    ay = academic_year or get_current_academic_year()
    policies = get_active_policies(db)

    # Substitution credit balances map
    teacher_ids = [t.id for t in teachers]
    credit_map: Dict[int, int] = {}
    if teacher_ids:
        credits = db.query(TeacherCredit).filter(TeacherCredit.teacher_id.in_(teacher_ids)).all()
        for c in credits:
            credit_map[c.teacher_id] = c.balance

    staff_summaries: List[TeacherLeaveBalanceSummaryOut] = []
    for t in teachers:
        bals = get_teacher_balances(db, t.id, ay)
        staff_summaries.append(
            TeacherLeaveBalanceSummaryOut(
                teacher_id=t.id,
                teacher_name=t.name,
                department_id=t.department_id,
                department_name=t.department,
                substitution_credits=credit_map.get(t.id, 0),
                balances=bals,
            )
        )

    dept_name = None
    if department_id:
        from app.models.department import Department
        dept = db.query(Department).filter(Department.id == department_id).first()
        if dept:
            dept_name = dept.name

    return DepartmentLeaveBalanceOverviewOut(
        department_id=department_id,
        department_name=dept_name,
        total_staff=len(teachers),
        staff_summaries=staff_summaries,
        policies=[LeavePolicyOut.model_validate(p) for p in policies],
    )
