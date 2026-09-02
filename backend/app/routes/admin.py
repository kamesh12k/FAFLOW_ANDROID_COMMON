from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from io import BytesIO
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import get_current_user, require_admin, require_super_admin, require_system_admin, get_tenant_department_id
from app.core.security import verify_password
from app.models.user import User, Role
from app.models.leave import LeaveRequest
from app.schemas.user import UserOut, Token
from app.schemas.admin import (
    FirstLoginSetupRequest, SecondaryAdminCreate, FactoryResetRequest,
    FactoryResetResponse, AuditLogOut,
)
from app.services import admin_service, factory_reset_service

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/master-export")
def master_export(admin: User = Depends(require_system_admin), db: Session = Depends(get_db)):
    """Institution-wide accountability workbook; deliberately System Admin only."""
    from app.services.master_export_service import build_master_export
    payload = build_master_export(db, admin.username or admin.name)
    return StreamingResponse(BytesIO(payload), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": 'attachment; filename="FAFLOW_Master_Accountability.xlsx"'})



@router.post("/first-login/setup", response_model=Token)
def first_login_setup(
    data: FirstLoginSetupRequest,
    # Intentionally depends on get_current_user, NOT require_credentials_set —
    # this is the one endpoint that must remain reachable while the
    # must_change_credentials gate is blocking everything else.
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return admin_service.complete_first_login_setup(current_user, data, db)


@router.get("/secondary-admins", response_model=list[UserOut])
def list_secondary_admins(
    _admin: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    return admin_service.list_admins(db, tenant_department_id)


@router.post("/secondary-admins", response_model=UserOut, status_code=201)
def create_secondary_admin(
    data: SecondaryAdminCreate,
    super_admin: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    return admin_service.create_secondary_admin(data, super_admin, db, tenant_department_id)


@router.patch("/secondary-admins/{admin_id}/enable", response_model=UserOut)
def enable_secondary_admin(
    admin_id: int,
    super_admin: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    return admin_service.set_secondary_admin_active(admin_id, True, super_admin, db, tenant_department_id)


@router.patch("/secondary-admins/{admin_id}/disable", response_model=UserOut)
def disable_secondary_admin(
    admin_id: int,
    super_admin: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    return admin_service.set_secondary_admin_active(admin_id, False, super_admin, db, tenant_department_id)


@router.get("/audit-logs", response_model=list[AuditLogOut])
def get_audit_logs(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    logs = admin_service.list_audit_logs(db, tenant_department_id=tenant_department_id)
    actor_ids = {log.actor_user_id for log in logs if log.actor_user_id}
    actors = {u.id: u.name for u in db.query(User).filter(User.id.in_(actor_ids)).all()} if actor_ids else {}
    return [
        AuditLogOut(
            id=log.id, actor_user_id=log.actor_user_id, actor_name=actors.get(log.actor_user_id),
            action=log.action, target_type=log.target_type, target_id=log.target_id,
            details=log.details, created_at=log.created_at,
        )
        for log in logs
    ]


@router.post("/factory-reset", response_model=FactoryResetResponse)
def factory_reset(
    data: FactoryResetRequest,
    super_admin: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """Destructive, irreversible (beyond the automatic backup). Requires
    the Super Admin's current password AND the literal typed phrase
    "RESET EVERYTHING" (validated by the request schema)."""
    if not verify_password(data.password, super_admin.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect password")

    if super_admin.role == Role.system_admin:
        result = factory_reset_service.perform_factory_reset(db, super_admin)
    else:
        result = factory_reset_service.perform_department_reset(db, super_admin, super_admin.department_id)
    return FactoryResetResponse(**result)



@router.post("/clear-credits-history")
def clear_credits_history(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    """Wipes all transactions from credit_transactions and deletes/truncates teacher_credits.
    Department admins only clear their own department's data."""
    from app.models.credit import CreditTransaction, TeacherCredit
    if tenant_department_id is not None:
        from app.models.user import User as UserModel
        dept_teacher_ids = [u.id for u in db.query(UserModel.id).filter(UserModel.department_id == tenant_department_id, UserModel.role == Role.teacher).all()]
        if dept_teacher_ids:
            db.query(CreditTransaction).filter(CreditTransaction.teacher_id.in_(dept_teacher_ids)).delete(synchronize_session=False)
            db.query(TeacherCredit).filter(TeacherCredit.teacher_id.in_(dept_teacher_ids)).delete(synchronize_session=False)
    else:
        db.query(CreditTransaction).delete(synchronize_session=False)
        db.query(TeacherCredit).delete(synchronize_session=False)
    admin_service.log_audit_event(
        db, admin.id, "credits.clear_history", "system", None, {"department_id": tenant_department_id}
    )
    db.commit()
    return {"ok": True}


@router.post("/clear-leaves-history")
def clear_leaves_history(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    """Wipes all leave requests and substitution assignments.
    Department admins only clear their own department's data."""
    from app.models.leave import AlterAssignment, LeaveRequest
    if tenant_department_id is not None:
        from app.models.user import User as UserModel
        dept_teacher_ids = [u.id for u in db.query(UserModel.id).filter(UserModel.department_id == tenant_department_id, UserModel.role == Role.teacher).all()]
        if dept_teacher_ids:
            leave_ids = [l.id for l in db.query(LeaveRequest.id).filter(LeaveRequest.teacher_id.in_(dept_teacher_ids)).all()]
            if leave_ids:
                db.query(AlterAssignment).filter(AlterAssignment.leave_request_id.in_(leave_ids)).delete(synchronize_session=False)
                db.query(LeaveRequest).filter(LeaveRequest.id.in_(leave_ids)).delete(synchronize_session=False)
    else:
        db.query(AlterAssignment).delete(synchronize_session=False)
        db.query(LeaveRequest).delete(synchronize_session=False)
    admin_service.log_audit_event(
        db, admin.id, "leaves.clear_history", "system", None, {"department_id": tenant_department_id}
    )
    db.commit()
    return {"ok": True}


@router.post("/principal", response_model=UserOut, status_code=201)
def create_principal(
    data: SecondaryAdminCreate,
    _admin: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    """
    Creates a college Principal account.
    Only callable by the System Admin.
    """
    return admin_service.create_principal_account(data, db)


@router.get("/global-users", response_model=list[UserOut])
def list_global_users(
    _admin: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    """
    Lists all department super admins and the principal.
    Only callable by the System Admin.
    """
    from app.models.user import AdminLevel
    return db.query(User).filter(
        (User.role == Role.principal) | 
        ((User.role == Role.admin) & (User.admin_level == AdminLevel.super_admin))
    ).order_by(User.role, User.created_at).all()


@router.delete("/global-users/{user_id}", status_code=204)
def delete_global_user(
    user_id: int,
    _admin: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    """
    Deletes a department super admin or principal.
    Only callable by the System Admin.
    """
    from app.models.user import AdminLevel
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role not in [Role.principal, Role.admin]:
        raise HTTPException(status_code=400, detail="Cannot delete this user here")
    if user.role == Role.admin and user.admin_level != AdminLevel.super_admin:
        raise HTTPException(status_code=400, detail="Cannot delete this user here")
        
    from app.models.notification import PushSubscription, Notification
    from app.models.credit import CreditTransaction, TeacherCredit
    from app.models.substitution_preference import SubstitutionPreference
    from app.models.timetable import TimetableSlot
    from app.models.timetable_submission import TimetableSubmission
    from app.models.leave import LeaveRequest, AlterAssignment

    db.query(PushSubscription).filter(PushSubscription.user_id == user_id).delete(synchronize_session=False)
    db.query(Notification).filter(Notification.user_id == user_id).delete(synchronize_session=False)
    db.query(CreditTransaction).filter(CreditTransaction.teacher_id == user_id).delete(synchronize_session=False)
    db.query(TeacherCredit).filter(TeacherCredit.teacher_id == user_id).delete(synchronize_session=False)
    db.query(SubstitutionPreference).filter(SubstitutionPreference.teacher_id == user_id).delete(synchronize_session=False)
    db.query(TimetableSlot).filter(TimetableSlot.teacher_id == user_id).delete(synchronize_session=False)
    db.query(TimetableSubmission).filter(TimetableSubmission.teacher_id == user_id).delete(synchronize_session=False)

    leave_ids = [l.id for l in db.query(LeaveRequest.id).filter(LeaveRequest.teacher_id == user_id).all()]
    if leave_ids:
        db.query(AlterAssignment).filter(AlterAssignment.leave_request_id.in_(leave_ids)).delete(synchronize_session=False)
        db.query(LeaveRequest).filter(LeaveRequest.id.in_(leave_ids)).delete(synchronize_session=False)

    db.query(AlterAssignment).filter(AlterAssignment.substitute_teacher_id == user_id).delete(synchronize_session=False)

    db.delete(user)
    db.commit()


@router.get("/system-metrics")
def get_system_metrics(
    _admin: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    from app.core.traffic import traffic_manager, get_system_performance
    perf = get_system_performance(db)
    traffic = traffic_manager.get_stats()
    return {
        "performance": perf,
        "traffic": traffic
    }


@router.post("/system-metrics/clear-traffic")
def clear_traffic_logs(
    _admin: User = Depends(require_system_admin),
):
    from app.core.traffic import traffic_manager
    traffic_manager.clear()
    return {"ok": True}


# ── Manager Account Management (System Admin Only) ───────────────────────────

from app.schemas.operational_staff import ManagerCreate, ManagerUpdate, ManagerOut


@router.get("/managers", response_model=list[ManagerOut])
def list_managers(
    _admin: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    managers = admin_service.list_managers(db)
    return [
        ManagerOut(
            id=m.id,
            name=m.name,
            username=m.username,
            email=m.email,
            role=m.role.value,
            department_id=m.department_id,
            department_name=m.department_rel.name if m.department_rel else "Institution-wide",
            is_active=m.is_active,
            must_change_credentials=m.must_change_credentials,
            created_at=m.created_at,
        )
        for m in managers
    ]


@router.post("/managers", response_model=ManagerOut, status_code=201)
def create_manager(
    data: ManagerCreate,
    admin: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    m = admin_service.create_manager_account(
        name=data.name,
        username=data.username,
        password=data.password,
        department_id=data.department_id,
        current_user_id=admin.id,
        db=db,
    )
    return ManagerOut(
        id=m.id,
        name=m.name,
        username=m.username,
        email=m.email,
        role=m.role.value,
        department_id=m.department_id,
        department_name=m.department_rel.name if m.department_rel else "Institution-wide",
        is_active=m.is_active,
        must_change_credentials=m.must_change_credentials,
        created_at=m.created_at,
    )


@router.get("/managers/{manager_id}", response_model=ManagerOut)
def get_manager(
    manager_id: int,
    _admin: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    m = admin_service.get_manager_by_id(manager_id, db)
    return ManagerOut(
        id=m.id,
        name=m.name,
        username=m.username,
        email=m.email,
        role=m.role.value,
        department_id=m.department_id,
        department_name=m.department_rel.name if m.department_rel else "Institution-wide",
        is_active=m.is_active,
        must_change_credentials=m.must_change_credentials,
        created_at=m.created_at,
    )


@router.put("/managers/{manager_id}", response_model=ManagerOut)
def update_manager(
    manager_id: int,
    data: ManagerUpdate,
    admin: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    m = admin_service.update_manager_account(
        manager_id=manager_id,
        name=data.name,
        department_id=data.department_id,
        is_active=data.is_active,
        password=data.password,
        current_user_id=admin.id,
        db=db,
    )
    return ManagerOut(
        id=m.id,
        name=m.name,
        username=m.username,
        email=m.email,
        role=m.role.value,
        department_id=m.department_id,
        department_name=m.department_rel.name if m.department_rel else "Institution-wide",
        is_active=m.is_active,
        must_change_credentials=m.must_change_credentials,
        created_at=m.created_at,
    )


@router.delete("/managers/{manager_id}", status_code=204)
def delete_manager(
    manager_id: int,
    admin: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    admin_service.delete_manager_account(manager_id, current_user_id=admin.id, db=db)
    return None


