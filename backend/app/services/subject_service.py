from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.subject import Subject
from app.schemas.subject import SubjectCreate, SubjectUpdate


def list_subjects(db: Session, include_archived: bool = False, tenant_department_id: int | None = None) -> list[Subject]:
    q = db.query(Subject)
    if not include_archived:
        q = q.filter(Subject.is_archived == False)  # noqa: E712
    if tenant_department_id is not None:
        q = q.filter(Subject.department_id == tenant_department_id)
    return q.order_by(Subject.code).all()


def create_subject(data: SubjectCreate, db: Session, tenant_department_id: int | None = None) -> Subject:
    dept_id = tenant_department_id if tenant_department_id is not None else data.department_id
    if db.query(Subject).filter(Subject.code == data.code, Subject.department_id == dept_id).first():
        raise HTTPException(status_code=400, detail="A subject with that code already exists in this department")
    
    subject_data = data.model_dump()
    subject_data["department_id"] = dept_id
    subject = Subject(**subject_data)
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return subject


def update_subject(subject_id: int, data: SubjectUpdate, db: Session, tenant_department_id: int | None = None) -> Subject:
    query = db.query(Subject).filter(Subject.id == subject_id)
    if tenant_department_id is not None:
        query = query.filter(Subject.department_id == tenant_department_id)
    subject = query.first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
        
    for key, value in data.model_dump(exclude_unset=True).items():
        if key == "department_id" and tenant_department_id is not None and value != tenant_department_id:
            raise HTTPException(status_code=403, detail="Cannot assign subject to another department")
        setattr(subject, key, value)
        
    db.commit()
    db.refresh(subject)
    return subject


def set_archived(subject_id: int, archived: bool, db: Session, tenant_department_id: int | None = None) -> Subject:
    query = db.query(Subject).filter(Subject.id == subject_id)
    if tenant_department_id is not None:
        query = query.filter(Subject.department_id == tenant_department_id)
    subject = query.first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
        
    subject.is_archived = archived
    db.commit()
    db.refresh(subject)
    return subject


def delete_subject(subject_id: int, db: Session, tenant_department_id: int | None = None) -> None:
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    if tenant_department_id is not None and subject.department_id != tenant_department_id:
        raise HTTPException(status_code=403, detail="You can only delete subjects belonging to your own department")
        
    from app.models.timetable import TimetableSlot
    from app.models.timetable_submission import TimetableSubmission
    
    # Nullify subject references in timetable slots and submissions to preserve slot continuity
    db.query(TimetableSlot).filter(TimetableSlot.subject_id == subject_id).update({TimetableSlot.subject_id: None}, synchronize_session=False)
    db.query(TimetableSubmission).filter(TimetableSubmission.subject_id == subject_id).update({TimetableSubmission.subject_id: None}, synchronize_session=False)
    
    db.delete(subject)
    db.commit()
