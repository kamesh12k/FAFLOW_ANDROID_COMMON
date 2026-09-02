import logging
from sqlalchemy.orm import Session
from sqlalchemy import select
from fastapi import HTTPException

from app.config import settings
from app.models.user import User, Role, AdminLevel
from app.models.audit_log import AuditLog
from app.core.security import hash_password, create_access_token
from app.schemas.admin import FirstLoginSetupRequest, SecondaryAdminCreate

logger = logging.getLogger(__name__)

MAX_SECONDARY_ADMINS = settings.MAX_SECONDARY_ADMINS


def log_audit_event(
    db: Session,
    actor_user_id: int | None,
    action: str,
    target_type: str | None = None,
    target_id: int | None = None,
    details: dict | None = None,
) -> AuditLog:
    """Adds + flushes (does not commit) so callers can keep the audit
    entry in the same transaction as the action it records."""
    dept_id = None
    if actor_user_id is not None:
        actor = db.query(User).filter(User.id == actor_user_id).first()
        if actor:
            dept_id = actor.department_id

    entry = AuditLog(
        actor_user_id=actor_user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        details=details,
        department_id=dept_id,
    )
    db.add(entry)
    db.flush()
    return entry



def bootstrap_default_super_admin(db: Session) -> None:
    """Called once at app startup. If no Super Admin exists yet (fresh
    install, or right after a Factory Reset that hasn't recreated one for
    some reason), creates username=admin / password=admin and forces a
    credential change before any dashboard access is allowed."""
    existing = db.query(User).filter(User.username == "admin").first()
    if existing:
        return

    admin = User(
        name="System Administrator",
        username="admin",
        email=None,
        password_hash=hash_password("admin"),
        role=Role.system_admin,
        admin_level=None,
        must_change_credentials=True,
        is_active=True,
    )
    db.add(admin)
    db.commit()
    logger.warning(
        "Bootstrap: created default System Admin (username='admin', password='admin'). "
        "Log in immediately and set real credentials — the dashboard is locked until you do."
    )



def complete_first_login_setup(current_user: User, data: FirstLoginSetupRequest, db: Session) -> dict:
    if not current_user.must_change_credentials:
        raise HTTPException(status_code=400, detail="Credentials have already been set for this account")

    if current_user.role == Role.teacher:
        # Teachers authenticate by email — they must provide a new email.
        if not data.new_email:
            raise HTTPException(status_code=422, detail="Teachers must provide a new email address")
        email_exists = db.query(User).filter(User.email == data.new_email, User.id != current_user.id).first()
        if email_exists:
            raise HTTPException(status_code=400, detail="That email address is already in use")
        current_user.email = data.new_email
    else:
        # Admins / HODs / staff authenticate by username.
        if not data.new_username:
            raise HTTPException(status_code=422, detail="Please provide a new username")
        existing = db.query(User).filter(User.username == data.new_username, User.id != current_user.id).first()
        if existing:
            raise HTTPException(status_code=400, detail="That username is already taken")
        current_user.username = data.new_username

    current_user.password_hash = hash_password(data.new_password)
    current_user.must_change_credentials = False

    log_audit_event(db, current_user.id, "credentials.first_login_setup", "user", current_user.id)
    db.commit()
    db.refresh(current_user)

    token = create_access_token({"sub": str(current_user.id), "role": current_user.role})
    return {"access_token": token, "token_type": "bearer", "user": current_user}



def list_admins(db: Session, tenant_department_id: int | None = None) -> list[User]:
    query = db.query(User).filter(User.role == Role.admin)
    if tenant_department_id is not None:
        query = query.filter(User.department_id == tenant_department_id)
    return query.order_by(User.admin_level.desc(), User.created_at).all()


def create_secondary_admin(data: SecondaryAdminCreate, requesting_admin: User, db: Session, tenant_department_id: int | None = None) -> User:
    # Resolve the department: department admins create within their own dept;
    # system admins must be operating in a specific department context.
    dept_id = tenant_department_id or requesting_admin.department_id
    if dept_id is None:
        raise HTTPException(
            status_code=400,
            detail="A department context is required to create a Secondary Admin. Use the department switcher.",
        )

    # Per-department cap on active secondary admins
    active_count = (
        db.query(User)
        .filter(
            User.role == Role.admin,
            User.admin_level == AdminLevel.secondary_admin,
            User.department_id == dept_id,
            User.is_active == True,  # noqa: E712
        )
        .count()
    )
    if active_count >= MAX_SECONDARY_ADMINS:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum of {MAX_SECONDARY_ADMINS} active Secondary Admins reached in this department. Disable one before adding another.",
        )

    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(status_code=400, detail="That username is already taken")

    admin = User(
        name=data.name,
        username=data.username,
        email=None,
        password_hash=hash_password(data.password),
        role=Role.admin,
        admin_level=AdminLevel.secondary_admin,
        department_id=dept_id,
        # Secondary admins also get a forced rotation on first login, so a
        # Super Admin handing out a temp password never leaves a long-lived
        # credential the creator still knows.
        must_change_credentials=True,
        is_active=True,
        created_by_admin_id=requesting_admin.id,
    )
    db.add(admin)
    db.flush()

    log_audit_event(
        db, requesting_admin.id, "secondary_admin.create", "user", admin.id,
        {"name": admin.name, "username": admin.username, "department_id": dept_id},
    )
    db.commit()
    db.refresh(admin)
    return admin


def set_secondary_admin_active(admin_id: int, active: bool, requesting_admin: User, db: Session, tenant_department_id: int | None = None) -> User:
    target = db.query(User).filter(User.id == admin_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Admin account not found")

    # Structural enforcement: only Super Admin can even reach this function
    # (gated by require_super_admin on the route), and it only ever
    # operates on secondary_admin accounts — a Super Admin can never be
    # disabled through this endpoint, by construction.
    if target.admin_level != AdminLevel.secondary_admin:
        raise HTTPException(status_code=400, detail="Only Secondary Admin accounts can be enabled/disabled here")

    # Department isolation: department admins can only toggle their own dept's admins
    if tenant_department_id is not None and target.department_id != tenant_department_id:
        raise HTTPException(status_code=403, detail="Access denied: admin belongs to another department")

    if active:
        # Per-department cap
        dept_id = target.department_id
        active_count = (
            db.query(User)
            .filter(
                User.role == Role.admin,
                User.admin_level == AdminLevel.secondary_admin,
                User.department_id == dept_id,
                User.is_active == True,  # noqa: E712
                User.id != target.id,
            )
            .count()
        )
        if active_count >= MAX_SECONDARY_ADMINS:
            raise HTTPException(status_code=400, detail=f"Maximum of {MAX_SECONDARY_ADMINS} active Secondary Admins reached in this department")

    target.is_active = active
    log_audit_event(
        db, requesting_admin.id,
        "secondary_admin.enable" if active else "secondary_admin.disable",
        "user", target.id,
    )
    db.commit()
    db.refresh(target)
    return target


def list_audit_logs(db: Session, limit: int = 200, tenant_department_id: int | None = None) -> list[AuditLog]:
    query = db.query(AuditLog)
    if tenant_department_id is not None:
        query = query.filter(AuditLog.department_id == tenant_department_id)
    return query.order_by(AuditLog.created_at.desc()).limit(limit).all()



def create_department_super_admin(dept_id: int, data: SecondaryAdminCreate, db: Session) -> User:
    existing = db.query(User).filter(
        User.department_id == dept_id,
        User.role == Role.admin,
        User.admin_level == AdminLevel.super_admin
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="A Super Admin already exists for this department"
        )

    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(status_code=400, detail="That username is already taken")

    admin = User(
        name=data.name,
        username=data.username,
        email=None,
        password_hash=hash_password(data.password),
        role=Role.admin,
        admin_level=AdminLevel.super_admin,
        must_change_credentials=True,
        is_active=True,
        department_id=dept_id,
    )
    db.add(admin)
    db.flush()

    log_audit_event(
        db, None, "department_super_admin.create", "user", admin.id,
        {"name": admin.name, "username": admin.username, "department_id": dept_id},
    )
    db.commit()
    db.refresh(admin)
    return admin


def create_principal_account(data: SecondaryAdminCreate, db: Session) -> User:
    existing = db.query(User).filter(User.role == Role.principal).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="A Principal account already exists"
        )

    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(status_code=400, detail="That username is already taken")

    principal = User(
        name=data.name,
        username=data.username,
        email=None,
        password_hash=hash_password(data.password),
        role=Role.principal,
        admin_level=None,
        must_change_credentials=True,
        is_active=True,
        department_id=None,
    )
    db.add(principal)
    db.flush()

    log_audit_event(
        db, None, "principal.create", "user", principal.id,
        {"name": principal.name, "username": principal.username},
    )
    db.commit()
    db.refresh(principal)
    return principal


# ── Manager Account Management (System Admin Only) ───────────────────────────

def list_managers(db: Session) -> list[User]:
    return db.query(User).filter(User.role == Role.manager).order_by(User.name.asc()).all()


def get_manager_by_id(manager_id: int, db: Session) -> User:
    manager = db.query(User).filter(User.id == manager_id, User.role == Role.manager).first()
    if not manager:
        raise HTTPException(status_code=404, detail="Manager account not found")
    return manager


def create_manager_account(name: str, username: str, password: str, department_id: int | None, current_user_id: int, db: Session) -> User:
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=400, detail=f"Username '{username}' is already taken")

    manager = User(
        name=name,
        username=username,
        email=None,
        password_hash=hash_password(password),
        role=Role.manager,
        admin_level=None,
        department_id=department_id,
        must_change_credentials=True,
        is_active=True,
        created_by_admin_id=current_user_id,
    )
    db.add(manager)
    db.flush()

    log_audit_event(
        db, current_user_id, "manager.create", "user", manager.id,
        {"name": manager.name, "username": manager.username, "department_id": department_id},
    )
    db.commit()
    db.refresh(manager)
    return manager


def update_manager_account(manager_id: int, name: str | None, department_id: int | None, is_active: bool | None, password: str | None, current_user_id: int, db: Session) -> User:
    manager = get_manager_by_id(manager_id, db)
    if name is not None:
        manager.name = name
    if department_id is not None:
        manager.department_id = department_id if department_id != 0 else None
    if is_active is not None:
        manager.is_active = is_active
    if password is not None and password.strip():
        manager.password_hash = hash_password(password)

    log_audit_event(
        db, current_user_id, "manager.update", "user", manager.id,
        {"name": manager.name, "is_active": manager.is_active, "department_id": manager.department_id},
    )
    db.commit()
    db.refresh(manager)
    return manager


def delete_manager_account(manager_id: int, current_user_id: int, db: Session) -> None:
    manager = get_manager_by_id(manager_id, db)
    log_audit_event(
        db, current_user_id, "manager.delete", "user", manager.id,
        {"name": manager.name, "username": manager.username},
    )
    db.delete(manager)
    db.commit()




