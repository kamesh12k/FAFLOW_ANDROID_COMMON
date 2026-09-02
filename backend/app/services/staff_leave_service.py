from typing import List, Optional
from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc
from fastapi import HTTPException, status

from app.models.staff_leave import StaffLeaveRequest, StaffCredit, StaffCreditTransaction, StaffLeaveStatus
from app.models.operational_staff import OperationalStaff, EmploymentStatus, StaffCategory
from app.models.user import User, Role
from app.schemas.staff_leave import (
    StaffLeaveApply,
    StaffLeaveOut,
    StaffCreditOut,
    StaffCreditAdjust,
    StaffLedgerTransactionOut,
    StaffLedgerSummary,
    StaffQuotaUpdate,
)

from app.services.admin_service import log_audit_event
from app.services import notification_service

DEFAULT_OPENING_BALANCE = 12.0


def get_or_create_staff_credit(db: Session, staff_id: int) -> StaffCredit:
    credit = db.query(StaffCredit).filter(StaffCredit.staff_id == staff_id).first()
    if not credit:
        credit = StaffCredit(staff_id=staff_id, balance=DEFAULT_OPENING_BALANCE)
        db.add(credit)
        db.flush()

        # Log opening balance transaction
        tx = StaffCreditTransaction(
            staff_id=staff_id,
            change=DEFAULT_OPENING_BALANCE,
            balance_after=DEFAULT_OPENING_BALANCE,
            category="opening_balance",
            reason="Initial annual leave credit quota allocation",
        )
        db.add(tx)
        db.commit()
        db.refresh(credit)
    return credit


def apply_staff_leave(
    db: Session,
    staff: OperationalStaff,
    data: StaffLeaveApply,
) -> StaffLeaveRequest:
    if data.start_date > data.end_date:
        raise HTTPException(status_code=400, detail="Start date cannot be after end date")

    # Calculate days count
    if data.is_half_day:
        if data.start_date != data.end_date:
            raise HTTPException(status_code=400, detail="Half-day leave must be for a single day")
        days_count = 0.5
    else:
        days_count = float((data.end_date - data.start_date).days + 1)

    # Check overlapping active leaves
    overlap = db.query(StaffLeaveRequest).filter(
        StaffLeaveRequest.staff_id == staff.id,
        StaffLeaveRequest.status.in_(["pending", "approved"]),
        StaffLeaveRequest.start_date <= data.end_date,
        StaffLeaveRequest.end_date >= data.start_date,
    ).first()
    if overlap:
        raise HTTPException(
            status_code=400,
            detail=f"You already have a {overlap.status} leave overlapping this date range ({overlap.start_date} to {overlap.end_date})"
        )

    leave = StaffLeaveRequest(
        staff_id=staff.id,
        start_date=data.start_date,
        end_date=data.end_date,
        leave_type=data.leave_type,
        is_half_day=data.is_half_day,
        half_day_session=data.half_day_session if data.is_half_day else None,
        days_count=days_count,
        reason=data.reason,
        status="pending",
    )
    db.add(leave)
    db.commit()
    db.refresh(leave)

    # Notify managers of the department
    managers = db.query(User).filter(
        User.role.in_([Role.manager, Role.admin, Role.system_admin]),
        (User.department_id == staff.department_id) | (User.role == Role.system_admin),
        User.is_active == True,
    ).all() if staff else []

    staff_name = staff.full_name if staff else f"Staff #{staff.id}"
    for mgr in managers:
        notification_service.create_notification(
            db, mgr.id,
            title=f"Staff Leave Request: {staff_name}",
            body=f"{staff_name} requested {data.leave_type} leave from {data.start_date} to {data.end_date} ({days_count} day(s)).",
            event_type="staff_leave_submitted",
        )

    # Notify staff user if they have an active account
    if staff and staff.user_id:
        notification_service.create_notification(
            db, staff.user_id,
            title="Leave Request Submitted",
            body=f"Your {data.leave_type} leave request from {data.start_date} to {data.end_date} was submitted for approval.",
            event_type="staff_leave_submitted",
        )
    db.commit()

    return leave


def approve_staff_leave(
    db: Session,
    manager_user: User,
    leave_id: int,
    approval_remarks: Optional[str] = None,
) -> StaffLeaveRequest:
    leave = db.query(StaffLeaveRequest).filter(StaffLeaveRequest.id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")

    if leave.status != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot approve leave with status '{leave.status}'")

    staff = db.query(OperationalStaff).filter(OperationalStaff.id == leave.staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff record not found")

    # Manager Department Scoping
    if manager_user.role == Role.manager and manager_user.department_id is not None:
        if staff.department_id is not None and staff.department_id != manager_user.department_id:
            raise HTTPException(status_code=403, detail="You do not have permission to approve leaves for other departments")

    # Deduct from staff credits
    credit = get_or_create_staff_credit(db, staff.id)
    new_balance = round(credit.balance - leave.days_count, 1)
    credit.balance = new_balance

    # Create Ledger Transaction
    leave_title = leave.leave_type.replace('_', ' ').title()
    tx = StaffCreditTransaction(
        staff_id=staff.id,
        change=-leave.days_count,
        balance_after=new_balance,
        category="leave_deduction",
        reason=f"Approved {leave_title} Leave ({leave.days_count} day(s)) from {leave.start_date} to {leave.end_date}",
        related_leave_id=leave.id,
        created_by_user_id=manager_user.id,
    )
    db.add(tx)

    leave.status = "approved"
    leave.approved_by_id = manager_user.id
    leave.approval_remarks = approval_remarks

    # If today is within leave dates, mark staff on leave
    today = date.today()
    if leave.start_date <= today <= leave.end_date:
        staff.employment_status = EmploymentStatus.on_leave

    log_audit_event(
        db,
        actor_user_id=manager_user.id,
        action="APPROVE_STAFF_LEAVE",
        target_type="staff_leave",
        target_id=leave.id,
        details={
            "staff_id": staff.id,
            "employee_code": staff.employee_code,
            "days_count": leave.days_count,
            "balance_after": new_balance,
        },
    )

    db.commit()
    db.refresh(leave)

    # Notify staff member if they have an active user account
    if staff.user_id:
        notification_service.create_notification(
            db, staff.user_id,
            title="Staff Leave Approved",
            body=f"Your {leave.leave_type} leave request from {leave.start_date} to {leave.end_date} was approved." + (f" Remarks: {approval_remarks}" if approval_remarks else ""),
            event_type="staff_leave_approved",
        )
        db.commit()

    return leave


def reject_staff_leave(
    db: Session,
    manager_user: User,
    leave_id: int,
    approval_remarks: Optional[str] = None,
) -> StaffLeaveRequest:
    leave = db.query(StaffLeaveRequest).filter(StaffLeaveRequest.id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")

    if leave.status != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot reject leave with status '{leave.status}'")

    staff = db.query(OperationalStaff).filter(OperationalStaff.id == leave.staff_id).first()
    if manager_user.role == Role.manager and manager_user.department_id is not None:
        if staff and staff.department_id is not None and staff.department_id != manager_user.department_id:
            raise HTTPException(status_code=403, detail="You do not have permission for this department")

    leave.status = "rejected"
    leave.approved_by_id = manager_user.id
    leave.approval_remarks = approval_remarks

    log_audit_event(
        db,
        actor_user_id=manager_user.id,
        action="REJECT_STAFF_LEAVE",
        target_type="staff_leave",
        target_id=leave.id,
        details={"staff_id": leave.staff_id, "remarks": approval_remarks},
    )

    db.commit()
    db.refresh(leave)

    # Notify staff member if they have an active user account
    if staff and staff.user_id:
        notification_service.create_notification(
            db, staff.user_id,
            title="Staff Leave Rejected",
            body=f"Your {leave.leave_type} leave request from {leave.start_date} to {leave.end_date} was rejected." + (f" Remarks: {approval_remarks}" if approval_remarks else ""),
            event_type="staff_leave_rejected",
        )
        db.commit()

    return leave


def cancel_staff_leave(
    db: Session,
    current_user: User,
    leave_id: int,
) -> StaffLeaveRequest:
    leave = db.query(StaffLeaveRequest).filter(StaffLeaveRequest.id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")

    if leave.status not in ("pending", "approved"):
        raise HTTPException(status_code=400, detail=f"Cannot cancel leave with status '{leave.status}'")

    staff = db.query(OperationalStaff).filter(OperationalStaff.id == leave.staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff record not found")

    # If it was already approved, refund the credit balance
    if leave.status == "approved":
        credit = get_or_create_staff_credit(db, staff.id)
        new_balance = round(credit.balance + leave.days_count, 1)
        credit.balance = new_balance

        tx = StaffCreditTransaction(
            staff_id=staff.id,
            change=leave.days_count,
            balance_after=new_balance,
            category="cancellation_refund",
            reason=f"Leave cancelled: Refunded {leave.days_count} day(s) for leave {leave.start_date} to {leave.end_date}",
            related_leave_id=leave.id,
            created_by_user_id=current_user.id,
        )
        db.add(tx)

        if staff.employment_status == EmploymentStatus.on_leave:
            staff.employment_status = EmploymentStatus.active

    leave.status = "cancelled"

    log_audit_event(
        db,
        actor_user_id=current_user.id,
        action="CANCEL_STAFF_LEAVE",
        target_type="staff_leave",
        target_id=leave.id,
        details={"staff_id": staff.id, "was_approved": leave.status == "approved"},
    )

    db.commit()
    db.refresh(leave)
    return leave


def adjust_staff_credit(
    db: Session,
    manager_user: User,
    data: StaffCreditAdjust,
) -> StaffCreditTransaction:
    staff = db.query(OperationalStaff).filter(OperationalStaff.id == data.staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff record not found")

    if manager_user.role == Role.manager and manager_user.department_id is not None:
        if staff.department_id is not None and staff.department_id != manager_user.department_id:
            raise HTTPException(status_code=403, detail="Department access restricted")

    credit = get_or_create_staff_credit(db, staff.id)
    new_balance = round(credit.balance + data.change, 1)
    credit.balance = new_balance

    tx = StaffCreditTransaction(
        staff_id=staff.id,
        change=data.change,
        balance_after=new_balance,
        category=data.category,
        reason=data.reason,
        created_by_user_id=manager_user.id,
    )
    db.add(tx)

    log_audit_event(
        db,
        actor_user_id=manager_user.id,
        action="ADJUST_STAFF_CREDIT",
        target_type="staff_credit",
        target_id=staff.id,
        details={
            "staff_id": staff.id,
            "change": data.change,
            "balance_after": new_balance,
            "category": data.category,
            "reason": data.reason,
        },
    )

    db.commit()
    db.refresh(tx)
    return tx


def get_staff_leave_ledger(db: Session, staff_id: int) -> StaffLedgerSummary:
    staff = db.query(OperationalStaff).filter(OperationalStaff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff record not found")

    credit = get_or_create_staff_credit(db, staff.id)
    transactions = db.query(StaffCreditTransaction).filter(
        StaffCreditTransaction.staff_id == staff_id
    ).order_by(desc(StaffCreditTransaction.created_at), desc(StaffCreditTransaction.id)).all()


    total_leaves = sum(abs(t.change) for t in transactions if t.change < 0 and t.category == "leave_deduction")
    total_earned = sum(t.change for t in transactions if t.change > 0 and t.category != "opening_balance")

    tx_outs = []
    for t in transactions:
        tx_outs.append(StaffLedgerTransactionOut(
            id=t.id,
            staff_id=t.staff_id,
            staff_name=staff.full_name,
            change=t.change,
            balance_after=t.balance_after,
            category=t.category,
            reason=t.reason,
            related_leave_id=t.related_leave_id,
            created_by_user_id=t.created_by_user_id,
            created_by_name=t.created_by.name if t.created_by else None,
            created_at=t.created_at,
        ))

    return StaffLedgerSummary(
        staff_id=staff.id,
        staff_name=staff.full_name,
        employee_code=staff.employee_code,
        category=staff.category.value,
        department_name=staff.department.name if staff.department else "Central / College-wide",
        annual_quota=getattr(credit, "annual_quota", DEFAULT_OPENING_BALANCE) or DEFAULT_OPENING_BALANCE,
        current_balance=credit.balance,
        total_leaves_taken=round(total_leaves, 1),
        total_credits_earned=round(total_earned, 1),
        transactions=tx_outs,
    )


def update_staff_leave_quota(
    db: Session,
    manager_user: User,
    data: StaffQuotaUpdate,
) -> StaffCredit:
    staff = db.query(OperationalStaff).filter(OperationalStaff.id == data.staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff record not found")

    if manager_user.role == Role.manager and manager_user.department_id is not None:
        if staff.department_id is not None and staff.department_id != manager_user.department_id:
            raise HTTPException(status_code=403, detail="Department access restricted")

    credit = get_or_create_staff_credit(db, staff.id)
    old_quota = getattr(credit, "annual_quota", DEFAULT_OPENING_BALANCE) or DEFAULT_OPENING_BALANCE
    diff = round(data.annual_quota - old_quota, 1)

    credit.annual_quota = data.annual_quota
    if data.adjust_balance and diff != 0:
        new_balance = round(credit.balance + diff, 1)
        credit.balance = new_balance

        tx = StaffCreditTransaction(
            staff_id=staff.id,
            change=diff,
            balance_after=new_balance,
            category="quota_adjustment",
            reason=data.reason or f"Annual leave limit updated from {old_quota} to {data.annual_quota} days",
            created_by_user_id=manager_user.id,
        )
        db.add(tx)

    log_audit_event(
        db,
        actor_user_id=manager_user.id,
        action="UPDATE_STAFF_LEAVE_QUOTA",
        target_type="staff_credit",
        target_id=staff.id,
        details={
            "staff_id": staff.id,
            "old_quota": old_quota,
            "new_quota": data.annual_quota,
            "adjusted_balance": data.adjust_balance,
        },
    )

    db.commit()
    db.refresh(credit)
    return credit


def list_staff_leaves(
    db: Session,
    staff_id: Optional[int] = None,
    tenant_dept_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    category_filter: Optional[str] = None,
) -> List[StaffLeaveOut]:
    query = db.query(StaffLeaveRequest).join(OperationalStaff, StaffLeaveRequest.staff_id == OperationalStaff.id)

    if staff_id:
        query = query.filter(StaffLeaveRequest.staff_id == staff_id)

    if tenant_dept_id is not None:
        query = query.filter(
            or_(
                OperationalStaff.department_id == tenant_dept_id,
                OperationalStaff.department_id.is_(None)
            )
        )

    if status_filter:
        query = query.filter(StaffLeaveRequest.status == status_filter)

    if category_filter:
        query = query.filter(OperationalStaff.category == category_filter)

    leaves = query.order_by(desc(StaffLeaveRequest.created_at)).all()

    return [
        StaffLeaveOut(
            id=l.id,
            staff_id=l.staff_id,
            staff_name=l.staff.full_name if l.staff else "Staff",
            employee_code=l.staff.employee_code if l.staff else "N/A",
            category=l.staff.category.value if l.staff else "laboratory",
            department_id=l.staff.department_id if l.staff else None,
            department_name=l.staff.department.name if l.staff and l.staff.department else "Central / College-wide",
            start_date=l.start_date,
            end_date=l.end_date,
            leave_type=l.leave_type,
            is_half_day=l.is_half_day,
            half_day_session=l.half_day_session,
            days_count=l.days_count,
            reason=l.reason,
            status=l.status,
            approved_by_id=l.approved_by_id,
            approved_by_name=l.approved_by.name if l.approved_by else None,
            approval_remarks=l.approval_remarks,
            created_at=l.created_at,
            updated_at=l.updated_at,
        )
        for l in leaves
    ]


def list_staff_credits_summary(
    db: Session,
    tenant_dept_id: Optional[int] = None,
    category_filter: Optional[str] = None,
) -> List[StaffCreditOut]:
    query = db.query(OperationalStaff)
    if tenant_dept_id is not None:
        query = query.filter(
            or_(
                OperationalStaff.department_id == tenant_dept_id,
                OperationalStaff.department_id.is_(None)
            )
        )

    if category_filter:
        query = query.filter(OperationalStaff.category == category_filter)

    all_staff = query.order_by(OperationalStaff.full_name.asc()).all()

    results = []
    for s in all_staff:
        credit = get_or_create_staff_credit(db, s.id)
        results.append(StaffCreditOut(
            staff_id=s.id,
            staff_name=s.full_name,
            employee_code=s.employee_code,
            category=s.category.value,
            designation=s.designation,
            department_id=s.department_id,
            department_name=s.department.name if s.department else "Central / College-wide",
            annual_quota=getattr(credit, "annual_quota", DEFAULT_OPENING_BALANCE) or DEFAULT_OPENING_BALANCE,
            balance=credit.balance,
            updated_at=credit.updated_at,
        ))
    return results

