from sqlalchemy import or_, func
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from datetime import date as date_cls

from app.models.user import User, Role
from app.models.credit import TeacherCredit
from app.core.security import hash_password, verify_password, create_access_token, validate_password_strength
from app.schemas.user import UserRegister, UserCreate
from app.services import notification_service


def _hash_password_or_400(password: str, *, forbid_default: bool = False) -> str:
    try:
        validate_password_strength(password, forbid_default=forbid_default)
        return hash_password(password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


def register_teacher(data: UserRegister, db: Session) -> User:
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    if not data.department_id:
        raise HTTPException(status_code=400, detail="department_id is required for teacher registration")

    from app.models.department import Department
    dept = db.query(Department).filter(Department.id == data.department_id).first()
    if not dept:
        raise HTTPException(status_code=400, detail="Department not found")

    user = User(
        name=data.name,
        email=data.email,
        password_hash=_hash_password_or_400(data.password),
        role=Role.teacher,
        department=data.department or dept.name,
        department_id=data.department_id,
    )
    db.add(user)
    db.flush()  # get user.id before commit

    # Initialise credit balance at 0
    db.add(TeacherCredit(teacher_id=user.id, balance=0))
    db.commit()
    db.refresh(user)
    return user


def create_user_by_admin(data: UserCreate, db: Session, tenant_department_id: int | None = None) -> User:
    """Teacher accounts only — admin accounts go through the Secondary
    Admin endpoint (app.services.admin_service.create_secondary_admin),
    which enforces the max-3 / Super-Admin-only rules."""
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    dept_id = tenant_department_id if tenant_department_id is not None else data.department_id

    user = User(
        name=data.name,
        email=data.email,
        password_hash=_hash_password_or_400(data.password),
        role=Role.teacher,
        department=data.department,
        department_id=dept_id,
        must_change_credentials=True,  # teacher must set own credentials on first login
    )
    db.add(user)
    db.flush()
    db.add(TeacherCredit(teacher_id=user.id, balance=0))

    db.commit()
    db.refresh(user)
    return user


def bulk_create_teachers(data, db: Session, tenant_department_id: int | None = None) -> dict:
    created = []
    skipped = 0
    errors = []

    for item in data.teachers:
        email = item.email.strip().lower()
        if db.query(User).filter(func.lower(User.email) == email).first():
            skipped += 1
            errors.append(f"Email already registered: {email}")
            continue

        dept_id = tenant_department_id if tenant_department_id is not None else (item.department_id or data.department_id)
        if not dept_id:
            skipped += 1
            errors.append(f"Missing department_id for teacher: {item.name} ({email})")
            continue

        pwd = item.default_password or "Password123!"
        pwd_hash = _hash_password_or_400(pwd)

        user = User(
            name=item.name.strip(),
            email=email,
            password_hash=pwd_hash,
            role=Role.teacher,
            department_id=dept_id,
            must_change_credentials=True,
        )
        db.add(user)
        db.flush()
        db.add(TeacherCredit(teacher_id=user.id, balance=0))
        created.append(user)

    db.commit()
    for u in created:
        db.refresh(u)

    return {
        "created_count": len(created),
        "skipped_count": skipped,
        "errors": errors,
        "teachers": created,
    }




def login(identifier: str, password: str, db: Session) -> dict:
    cleaned_identifier = (identifier or "").strip()
    user = db.query(User).filter(
        or_(
            func.lower(User.username) == cleaned_identifier.lower(),
            func.lower(User.email) == cleaned_identifier.lower(),
        )
    ).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password",
        )

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="This account has been disabled")

    # Best-effort: generate "upcoming holiday" reminders for this user.
    # Never let a problem here block login itself — notifications are a
    # convenience layer, not part of the auth contract.
    try:
        notification_service.generate_holiday_reminders(db, user.id, date_cls.today())
    except Exception:
        db.rollback()

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return {"access_token": token, "token_type": "bearer", "user": user}
