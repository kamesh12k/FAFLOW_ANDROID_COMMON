from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import require_admin, get_current_user, get_tenant_department_id
from app.models.user import User
from app.schemas.credit import CreditTransactionOut, CreditReportEntry, CreditAdjustment
from app.services.credit_service import get_transactions, get_all_transactions, get_credit_report, apply_credit_change
from app.services.admin_service import log_audit_event

router = APIRouter(prefix="/credits", tags=["Credits"])


@router.post("/adjust")
def adjust_credits(
    data: CreditAdjustment,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    if tenant_department_id is not None:
        teacher = db.query(User).filter(User.id == data.teacher_id).first()
        if not teacher or teacher.department_id != tenant_department_id:
            raise HTTPException(status_code=403, detail="Access denied: teacher belongs to another department")

    apply_credit_change(
        data.teacher_id, data.change, data.reason, None, db,
        category=data.category or "manual_adjustment"
    )
    log_audit_event(
        db, admin.id, "credits.manual_adjust", "user", data.teacher_id,
        {"change": data.change, "reason": data.reason, "category": data.category}
    )
    db.commit()
    return {"ok": True}


@router.get("/my/transactions", response_model=list[CreditTransactionOut])
def my_transactions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_transactions(current_user.id, db)


@router.get("/transactions", response_model=list[CreditTransactionOut])
def all_transactions(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    return get_all_transactions(db, tenant_department_id)


@router.get("/report", response_model=list[CreditReportEntry])
def credit_report(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    return get_credit_report(db, tenant_department_id)

