import logging
from datetime import date, datetime, timezone
from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.leave import LeaveRequest, LeaveStatus
from app.models.leave_policy import (
    LeavePolicy,
    TeacherLeaveBalance,
    LeaveBalanceTransaction,
    LeaveBalanceTransactionType,
)
from app.services.leave_policy_service import (
    get_or_create_teacher_balance,
    get_current_academic_year,
)
from app.services.admin_service import log_audit_event

logger = logging.getLogger(__name__)


def consume_leave(
    db: Session,
    leave_id: int,
    actor_id: Optional[int] = None,
) -> LeaveRequest:
    """
    Idempotent leave consumption engine.
    Deducts from the selected leave policy balance ONLY when the leave is actually consumed.
    DOES NOT touch teacher_credits (substitution workload ledger is completely independent).
    """
    leave = db.query(LeaveRequest).filter(LeaveRequest.id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found.")

    # Idempotency checks
    if leave.status == LeaveStatus.consumed:
        logger.info("Leave #%s is already marked as consumed. Skipping.", leave_id)
        return leave

    if leave.status in [LeaveStatus.rejected, LeaveStatus.cancelled]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot consume leave with status '{leave.status.value}'.",
        )

    if leave.status != LeaveStatus.approved:
        raise HTTPException(
            status_code=400,
            detail=f"Leave must be in 'approved' status to be consumed. Current status: '{leave.status.value}'.",
        )

    # Resolve policy
    policy = leave.leave_policy
    if not policy and leave.leave_policy_id:
        policy = db.query(LeavePolicy).filter(LeavePolicy.id == leave.leave_policy_id).first()

    if not policy:
        # Fallback to Applied Leave (AL)
        policy = db.query(LeavePolicy).filter(LeavePolicy.code == "AL").first()
        if not policy:
            policy = db.query(LeavePolicy).first()
        leave.leave_policy_id = policy.id if policy else None

    # Calculate consumed days duration
    consumed_days = 1.0
    if leave.batch_id:
        # If part of a batch, check if this is the primary consumption anchor
        same_batch_consumed = (
            db.query(LeaveRequest)
            .filter(
                LeaveRequest.batch_id == leave.batch_id,
                LeaveRequest.status == LeaveStatus.consumed,
                LeaveRequest.id != leave.id,
            )
            .count()
        )
        if same_batch_consumed > 0:
            # Whole day batch already had 1 day deducted; subsequent period slots in the same batch consume 0 additional days
            consumed_days = 0.0

    ay = get_current_academic_year(leave.date)
    balance = get_or_create_teacher_balance(db, leave.teacher_id, policy, ay)

    before = balance.remaining
    balance.consumed = round(balance.consumed + consumed_days, 1)
    balance.remaining = round(balance.entitlement - balance.consumed, 1)
    after = balance.remaining

    # Record in leave balance ledger
    if consumed_days > 0:
        tx = LeaveBalanceTransaction(
            teacher_id=leave.teacher_id,
            leave_policy_id=policy.id,
            leave_request_id=leave.id,
            transaction_type=LeaveBalanceTransactionType.CONSUMED.value,
            days=-consumed_days,
            balance_before=before,
            balance_after=after,
            reason=f"Consumed {consumed_days} day(s) for leave on {leave.date} (Period {leave.period_number})",
            created_by_id=actor_id,
        )
        db.add(tx)

    # Transition state to CONSUMED
    leave.status = LeaveStatus.consumed
    leave.consumed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(leave)

    log_audit_event(
        db,
        actor_user_id=actor_id,
        action="CONSUME_LEAVE",
        target_type="leave_request",
        target_id=leave.id,
        details={
            "teacher_id": leave.teacher_id,
            "policy_code": policy.code if policy else None,
            "date": str(leave.date),
            "period": leave.period_number,
            "consumed_days": consumed_days,
            "balance_after": after,
        },
    )

    return leave


def reverse_consumed_leave(
    db: Session,
    leave: LeaveRequest,
    reason: str,
    actor_id: Optional[int] = None,
) -> None:
    """
    Reverses an already-consumed leave balance deduction upon administrative cancellation.
    Writes an auditable REVERSAL transaction.
    """
    if leave.status != LeaveStatus.consumed:
        return

    policy = leave.leave_policy
    if not policy and leave.leave_policy_id:
        policy = db.query(LeavePolicy).filter(LeavePolicy.id == leave.leave_policy_id).first()

    if not policy:
        return

    # Check if a transaction was recorded for this leave
    tx = (
        db.query(LeaveBalanceTransaction)
        .filter(
            LeaveBalanceTransaction.leave_request_id == leave.id,
            LeaveBalanceTransaction.transaction_type == LeaveBalanceTransactionType.CONSUMED.value,
        )
        .first()
    )

    reversal_days = abs(tx.days) if tx else 1.0

    ay = get_current_academic_year(leave.date)
    balance = get_or_create_teacher_balance(db, leave.teacher_id, policy, ay)

    before = balance.remaining
    balance.consumed = max(0.0, round(balance.consumed - reversal_days, 1))
    balance.remaining = round(balance.entitlement - balance.consumed, 1)
    after = balance.remaining

    rev_tx = LeaveBalanceTransaction(
        teacher_id=leave.teacher_id,
        leave_policy_id=policy.id,
        leave_request_id=leave.id,
        transaction_type=LeaveBalanceTransactionType.REVERSAL.value,
        days=reversal_days,
        balance_before=before,
        balance_after=after,
        reason=f"Reversal upon cancellation: {reason}",
        created_by_id=actor_id,
    )
    db.add(rev_tx)
    db.flush()

    log_audit_event(
        db,
        actor_user_id=actor_id,
        action="REVERSE_LEAVE_CONSUMPTION",
        target_type="leave_request",
        target_id=leave.id,
        details={
            "teacher_id": leave.teacher_id,
            "policy_code": policy.code,
            "reversal_days": reversal_days,
            "balance_after": after,
            "reason": reason,
        },
    )


def process_due_leave_consumption(
    db: Session,
    target_date: Optional[date] = None,
) -> List[int]:
    """
    Evaluates approved leaves whose calendar date has arrived (date <= today) and transitions them to consumed.
    """
    t_date = target_date or date.today()
    due_leaves = (
        db.query(LeaveRequest)
        .filter(
            LeaveRequest.status == LeaveStatus.approved,
            LeaveRequest.date <= t_date,
            LeaveRequest.consumed_at == None,
        )
        .all()
    )

    consumed_ids = []
    for l in due_leaves:
        try:
            consume_leave(db, l.id)
            consumed_ids.append(l.id)
        except Exception as e:
            logger.error("Failed to consume leave #%s: %s", l.id, str(e))

    return consumed_ids
