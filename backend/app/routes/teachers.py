from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import require_admin, require_system_admin, get_current_user, get_tenant_department_id
from app.models.user import User, Role
from app.models.timetable import TimetableSlot
from app.models.leave import LeaveRequest, AlterAssignment
from app.schemas.user import UserOut, UserCreate, UserUpdate, TeacherBulkCreate, TeacherBulkCreateOut
from app.schemas.credit import CreditBalanceOut
from app.services import auth_service
from app.services.credit_service import get_balance
from app.core.security import hash_password
from app.services.admin_service import log_audit_event

router = APIRouter(prefix="/teachers", tags=["Teachers"])


@router.get("/", response_model=list[UserOut])
def list_teachers(
    include_cross_department: bool = False,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):

    query = db.query(User).filter(User.role == Role.teacher)
    if tenant_department_id is not None and not include_cross_department:
        query = query.filter(User.department_id == tenant_department_id)
    return query.order_by(User.name).all()


@router.post("/", response_model=UserOut, status_code=201)
def create_teacher(
    data: UserCreate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    return auth_service.create_user_by_admin(data, db, tenant_department_id)


@router.post("/bulk", response_model=TeacherBulkCreateOut, status_code=201)
def bulk_create_teachers(
    data: TeacherBulkCreate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    return auth_service.bulk_create_teachers(data, db, tenant_department_id)



@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/{teacher_id}/credits", response_model=CreditBalanceOut)
def get_teacher_credits(
    teacher_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    target_teacher = db.query(User).filter(User.id == teacher_id).first()
    if not target_teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    if current_user.role == Role.teacher:
        if current_user.id != teacher_id:
            raise HTTPException(status_code=403, detail="Not authorized to access another teacher's credit information")
    elif tenant_department_id is not None:
        if target_teacher.department_id != tenant_department_id:
            raise HTTPException(status_code=403, detail="Not authorized to access credits of a teacher in another department")

    balance = get_balance(teacher_id, db)
    return CreditBalanceOut(teacher_id=teacher_id, balance=balance)



@router.put("/{teacher_id}", response_model=UserOut)
def update_teacher(
    teacher_id: int,
    data: UserUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    query = db.query(User).filter(User.id == teacher_id, User.role == Role.teacher)
    if tenant_department_id is not None:
        query = query.filter(User.department_id == tenant_department_id)
    teacher = query.first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    # Check email duplicate
    exists = db.query(User).filter(User.email == data.email, User.id != teacher_id).first()
    if exists:
        raise HTTPException(status_code=400, detail="Email is already registered")

    teacher.name = data.name
    teacher.email = data.email
    teacher.department = data.department
    if data.department_id is not None:
        if tenant_department_id is not None and data.department_id != tenant_department_id:
            raise HTTPException(status_code=403, detail="Cannot assign teacher to another department")
        teacher.department_id = data.department_id
    elif tenant_department_id is not None:
        teacher.department_id = tenant_department_id

    teacher.is_active = data.is_active
    
    if data.password:
        teacher.password_hash = hash_password(data.password)

    log_audit_event(
        db, admin.id, "teachers.update", "user", teacher.id,
        {"name": data.name, "email": data.email, "department": data.department, "is_active": data.is_active}
    )
    db.commit()
    db.refresh(teacher)
    return teacher


@router.delete("/{teacher_id}", status_code=204)
def delete_teacher(
    teacher_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    query = db.query(User).filter(User.id == teacher_id, User.role == Role.teacher)
    if tenant_department_id is not None:
        query = query.filter(User.department_id == tenant_department_id)
    teacher = query.first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    from app.models.notification import PushSubscription, Notification
    from app.models.credit import CreditTransaction, TeacherCredit
    from app.models.substitution_preference import SubstitutionPreference
    from app.models.timetable_submission import TimetableSubmission

    # Automatically clean up all associated records for this teacher:
    db.query(PushSubscription).filter(PushSubscription.user_id == teacher_id).delete(synchronize_session=False)
    db.query(Notification).filter(Notification.user_id == teacher_id).delete(synchronize_session=False)
    db.query(CreditTransaction).filter(CreditTransaction.teacher_id == teacher_id).delete(synchronize_session=False)
    db.query(TeacherCredit).filter(TeacherCredit.teacher_id == teacher_id).delete(synchronize_session=False)
    db.query(SubstitutionPreference).filter(SubstitutionPreference.teacher_id == teacher_id).delete(synchronize_session=False)
    db.query(TimetableSlot).filter(TimetableSlot.teacher_id == teacher_id).delete(synchronize_session=False)
    db.query(TimetableSubmission).filter(TimetableSubmission.teacher_id == teacher_id).delete(synchronize_session=False)

    leave_ids = [l.id for l in db.query(LeaveRequest.id).filter(LeaveRequest.teacher_id == teacher_id).all()]
    if leave_ids:
        db.query(AlterAssignment).filter(AlterAssignment.leave_request_id.in_(leave_ids)).delete(synchronize_session=False)
        db.query(LeaveRequest).filter(LeaveRequest.id.in_(leave_ids)).delete(synchronize_session=False)

    db.query(AlterAssignment).filter(AlterAssignment.substitute_teacher_id == teacher_id).delete(synchronize_session=False)

    log_audit_event(
        db, admin.id, "teachers.delete", "user", teacher.id,
        {"name": teacher.name, "email": teacher.email}
    )
    db.delete(teacher)
    db.commit()


@router.post("/me/biometrics/enroll", response_model=UserOut)
def enroll_my_biometrics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Registers that the authenticated user (faculty/staff) has captured and verified
    their facial biometric template on their mobile device.
    """
    from datetime import datetime, timezone
    current_user.has_face_enrolled = True
    current_user.face_enrolled_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/{teacher_id}/biometrics/reset", response_model=UserOut)
def reset_teacher_biometrics(
    teacher_id: int,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Resets the stored facial biometric registration for a faculty member.
    Authorized for institutional and system administrators.
    """
    teacher = db.query(User).filter(User.id == teacher_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Faculty member not found")

    teacher.has_face_enrolled = False
    teacher.face_enrolled_at = None

    log_audit_event(
        db, admin_user.id, "biometrics.reset", "user", teacher.id,
        {"name": teacher.name, "email": teacher.email}
    )
    db.commit()
    db.refresh(teacher)
    return teacher

