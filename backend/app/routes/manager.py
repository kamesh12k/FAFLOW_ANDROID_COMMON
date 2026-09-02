from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import require_manager, require_manager_or_admin, get_tenant_department_id
from app.models.user import User, Role
from app.models.room import Room, RoomType
from app.models.operational_staff import OperationalStaff, StaffCategory, EmploymentStatus

from app.schemas.operational_staff import (
    OperationalStaffCreate,
    OperationalStaffUpdate,
    OperationalStaffOut,
    OperationalStaffStats,
)
from app.schemas.room import RoomOut
from app.services import operational_staff_service as staff_service

router = APIRouter(prefix="/manager", tags=["manager"])


@router.get("/dashboard", response_model=OperationalStaffStats)
def get_manager_dashboard(
    current_user: User = Depends(require_manager_or_admin),
    tenant_dept_id: Optional[int] = Depends(get_tenant_department_id),
    db: Session = Depends(get_db),
):
    return staff_service.get_operational_stats(db, tenant_dept_id=tenant_dept_id)


@router.get("/staff", response_model=List[OperationalStaffOut])
def list_staff(
    category: Optional[StaffCategory] = None,
    employment_status: Optional[EmploymentStatus] = None,
    assigned_room_id: Optional[int] = None,
    search: Optional[str] = None,
    current_user: User = Depends(require_manager_or_admin),
    tenant_dept_id: Optional[int] = Depends(get_tenant_department_id),
    db: Session = Depends(get_db),
):
    staff_list = staff_service.list_operational_staff(
        db,
        tenant_dept_id=tenant_dept_id,
        category=category,
        search=search,
        employment_status=employment_status,
        assigned_room_id=assigned_room_id,
    )
    return [staff_service.format_staff_out(s, db) for s in staff_list]


@router.post("/staff", response_model=OperationalStaffOut, status_code=status.HTTP_201_CREATED)
def create_staff(
    data: OperationalStaffCreate,
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    staff = staff_service.create_operational_staff(db, current_user=current_user, data=data)
    return staff_service.format_staff_out(staff, db)


@router.get("/staff/{staff_id}", response_model=OperationalStaffOut)
def get_staff(
    staff_id: int,
    current_user: User = Depends(require_manager_or_admin),
    tenant_dept_id: Optional[int] = Depends(get_tenant_department_id),
    db: Session = Depends(get_db),
):
    staff = staff_service.get_operational_staff(db, staff_id=staff_id, tenant_dept_id=tenant_dept_id)
    return staff_service.format_staff_out(staff, db)


@router.put("/staff/{staff_id}", response_model=OperationalStaffOut)
def update_staff(
    staff_id: int,
    data: OperationalStaffUpdate,
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    staff = staff_service.update_operational_staff(db, current_user=current_user, staff_id=staff_id, data=data)
    return staff_service.format_staff_out(staff, db)


@router.patch("/staff/{staff_id}/status", response_model=OperationalStaffOut)
def toggle_staff_status(
    staff_id: int,
    employment_status: EmploymentStatus = Query(...),
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    update_data = OperationalStaffUpdate(employment_status=employment_status)
    staff = staff_service.update_operational_staff(db, current_user=current_user, staff_id=staff_id, data=update_data)
    return staff_service.format_staff_out(staff, db)



@router.delete("/staff/{staff_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_staff(
    staff_id: int,
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    staff_service.delete_operational_staff(db, current_user=current_user, staff_id=staff_id)
    return None


@router.get("/labs", response_model=List[RoomOut])
def get_available_labs(
    current_user: User = Depends(require_manager_or_admin),
    tenant_dept_id: Optional[int] = Depends(get_tenant_department_id),
    db: Session = Depends(get_db),
):
    query = db.query(Room).filter(Room.room_type == RoomType.lab)
    if tenant_dept_id is not None:
        query = query.filter(
            (Room.department_id == tenant_dept_id) | (Room.department_id.is_(None))
        )
    return query.order_by(Room.room_number.asc()).all()


# ── Staff Leaves & Approvals Management ──────────────────────────────────────

from app.schemas.staff_leave import (
    StaffLeaveOut,
    StaffLeaveApproval,
    StaffCreditOut,
    StaffCreditAdjust,
    StaffLedgerSummary,
    StaffLedgerTransactionOut,
    StaffQuotaUpdate,
)

from app.services import staff_leave_service


@router.get("/leaves", response_model=List[StaffLeaveOut])
def list_manager_staff_leaves(
    status_filter: Optional[str] = None,
    category_filter: Optional[str] = None,
    current_user: User = Depends(require_manager_or_admin),
    tenant_dept_id: Optional[int] = Depends(get_tenant_department_id),
    db: Session = Depends(get_db),
):
    return staff_leave_service.list_staff_leaves(
        db,
        tenant_dept_id=tenant_dept_id,
        status_filter=status_filter,
        category_filter=category_filter,
    )


@router.post("/leaves/{leave_id}/approve", response_model=StaffLeaveOut)
def approve_staff_leave(
    leave_id: int,
    data: Optional[StaffLeaveApproval] = None,
    current_user: User = Depends(require_manager_or_admin),
    db: Session = Depends(get_db),
):
    remarks = data.approval_remarks if data else None
    staff_leave_service.approve_staff_leave(db, current_user, leave_id, remarks)
    return staff_leave_service.list_staff_leaves(db, staff_id=None)[0]


@router.post("/leaves/{leave_id}/reject", response_model=StaffLeaveOut)
def reject_staff_leave(
    leave_id: int,
    data: Optional[StaffLeaveApproval] = None,
    current_user: User = Depends(require_manager_or_admin),
    db: Session = Depends(get_db),
):
    remarks = data.approval_remarks if data else None
    staff_leave_service.reject_staff_leave(db, current_user, leave_id, remarks)
    return staff_leave_service.list_staff_leaves(db, staff_id=None)[0]


# ── Staff Credits & Leave Ledger Accounting ─────────────────────────────────

@router.get("/credits", response_model=List[StaffCreditOut])
def list_staff_credits(
    category_filter: Optional[str] = None,
    current_user: User = Depends(require_manager_or_admin),
    tenant_dept_id: Optional[int] = Depends(get_tenant_department_id),
    db: Session = Depends(get_db),
):
    return staff_leave_service.list_staff_credits_summary(
        db,
        tenant_dept_id=tenant_dept_id,
        category_filter=category_filter,
    )


@router.get("/credits/{staff_id}/ledger", response_model=StaffLedgerSummary)
def get_staff_credit_ledger(
    staff_id: int,
    current_user: User = Depends(require_manager_or_admin),
    db: Session = Depends(get_db),
):
    return staff_leave_service.get_staff_leave_ledger(db, staff_id)


@router.post("/credits/adjust", response_model=StaffLedgerTransactionOut)
def adjust_staff_credit_balance(
    data: StaffCreditAdjust,
    current_user: User = Depends(require_manager_or_admin),
    db: Session = Depends(get_db),
):
    tx = staff_leave_service.adjust_staff_credit(db, current_user, data)
    staff = db.query(OperationalStaff).filter(OperationalStaff.id == data.staff_id).first()
    return StaffLedgerTransactionOut(
        id=tx.id,
        staff_id=tx.staff_id,
        staff_name=staff.full_name if staff else "Staff",
        change=tx.change,
        balance_after=tx.balance_after,
        category=tx.category,
        reason=tx.reason,
        related_leave_id=tx.related_leave_id,
        created_by_user_id=tx.created_by_user_id,
        created_by_name=current_user.name,
        created_at=tx.created_at,
    )


@router.post("/credits/quota", response_model=StaffCreditOut)
def update_staff_leave_limit_quota(
    data: StaffQuotaUpdate,
    current_user: User = Depends(require_manager_or_admin),
    db: Session = Depends(get_db),
):
    credit = staff_leave_service.update_staff_leave_quota(db, current_user, data)
    staff = db.query(OperationalStaff).filter(OperationalStaff.id == data.staff_id).first()
    return StaffCreditOut(
        staff_id=staff.id,
        staff_name=staff.full_name,
        employee_code=staff.employee_code,
        category=staff.category.value,
        designation=staff.designation,
        department_id=staff.department_id,
        department_name=staff.department.name if staff.department else "Central / College-wide",
        annual_quota=credit.annual_quota,
        balance=credit.balance,
        updated_at=credit.updated_at,
    )


