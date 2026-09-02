from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.department import Department
from app.models.subject import Subject
from app.models.class_ import Class
from app.schemas.department import DepartmentCreate, DepartmentUpdate


def list_departments(db: Session, tenant_department_id: int | None = None) -> list[Department]:
    query = db.query(Department)
    if tenant_department_id is not None:
        query = query.filter(Department.id == tenant_department_id)
    return query.order_by(Department.name).all()


def check_department_access(dept_id: int, tenant_department_id: int | None) -> None:
    if tenant_department_id is not None and dept_id != tenant_department_id:
        raise HTTPException(status_code=403, detail="Access denied to this department's resources")


def create_department(data: DepartmentCreate, db: Session) -> Department:
    if db.query(Department).filter(Department.name == data.name).first():
        raise HTTPException(status_code=400, detail="A department with that name already exists")
    if data.code and db.query(Department).filter(Department.code == data.code).first():
        raise HTTPException(status_code=400, detail="A department with that code already exists")
    dept = Department(**data.model_dump())
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept


def update_department(dept_id: int, data: DepartmentUpdate, db: Session, tenant_department_id: int | None = None) -> Department:
    check_department_access(dept_id, tenant_department_id)
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    
    if data.name is not None and data.name != dept.name:
        if db.query(Department).filter(Department.name == data.name).first():
            raise HTTPException(status_code=400, detail="A department with that name already exists")
            
    if data.code is not None and data.code != dept.code:
        if db.query(Department).filter(Department.code == data.code).first():
            raise HTTPException(status_code=400, detail="A department with that code already exists")
            
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(dept, key, value)
        
    db.commit()
    db.refresh(dept)
    return dept


def delete_department(dept_id: int, db: Session, tenant_department_id: int | None = None) -> None:
    check_department_access(dept_id, tenant_department_id)
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
        
    from app.models.timetable import TimetableSlot
    from app.models.timetable_submission import TimetableSubmission
    from app.models.system_setting import SystemSetting
    from app.models.audit_log import AuditLog
    from app.models.user import User
    from app.models.notification import PushSubscription, Notification
    from app.models.credit import CreditTransaction, TeacherCredit
    from app.models.substitution_preference import SubstitutionPreference
    from app.models.leave import LeaveRequest, AlterAssignment

    class_ids = [c.id for c in db.query(Class.id).filter(Class.department_id == dept_id).all()]
    if class_ids:
        db.query(TimetableSlot).filter(TimetableSlot.class_id.in_(class_ids)).delete(synchronize_session=False)
        db.query(TimetableSubmission).filter(TimetableSubmission.class_id.in_(class_ids)).delete(synchronize_session=False)
        db.query(Class).filter(Class.id.in_(class_ids)).delete(synchronize_session=False)

    db.query(Subject).filter(Subject.department_id == dept_id).delete(synchronize_session=False)
    db.query(SystemSetting).filter(SystemSetting.department_id == dept_id).delete(synchronize_session=False)
    db.query(AuditLog).filter(AuditLog.department_id == dept_id).delete(synchronize_session=False)

    dept_user_ids = [u.id for u in db.query(User.id).filter(User.department_id == dept_id).all()]
    if dept_user_ids:
        db.query(PushSubscription).filter(PushSubscription.user_id.in_(dept_user_ids)).delete(synchronize_session=False)
        db.query(Notification).filter(Notification.user_id.in_(dept_user_ids)).delete(synchronize_session=False)
        db.query(CreditTransaction).filter(CreditTransaction.teacher_id.in_(dept_user_ids)).delete(synchronize_session=False)
        db.query(TeacherCredit).filter(TeacherCredit.teacher_id.in_(dept_user_ids)).delete(synchronize_session=False)
        db.query(SubstitutionPreference).filter(SubstitutionPreference.teacher_id.in_(dept_user_ids)).delete(synchronize_session=False)
        db.query(TimetableSlot).filter(TimetableSlot.teacher_id.in_(dept_user_ids)).delete(synchronize_session=False)
        db.query(TimetableSubmission).filter(TimetableSubmission.teacher_id.in_(dept_user_ids)).delete(synchronize_session=False)

        leave_ids = [l.id for l in db.query(LeaveRequest.id).filter(LeaveRequest.teacher_id.in_(dept_user_ids)).all()]
        if leave_ids:
            db.query(AlterAssignment).filter(AlterAssignment.leave_request_id.in_(leave_ids)).delete(synchronize_session=False)
            db.query(LeaveRequest).filter(LeaveRequest.id.in_(leave_ids)).delete(synchronize_session=False)

        db.query(AlterAssignment).filter(AlterAssignment.substitute_teacher_id.in_(dept_user_ids)).delete(synchronize_session=False)
        db.query(User).filter(User.created_by_admin_id.in_(dept_user_ids)).update({"created_by_admin_id": None}, synchronize_session=False)
        db.query(User).filter(User.id.in_(dept_user_ids)).delete(synchronize_session=False)

    db.delete(dept)
    db.commit()


