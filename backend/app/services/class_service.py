from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.class_ import Class
from app.models.timetable import TimetableSlot
from app.schemas.class_ import ClassCreate, ClassUpdate, ClassOut, BulkClassCreate, BulkClassCreateOut
def _enrich_class(cls: Class) -> ClassOut:
    return ClassOut(
        id=cls.id,
        name=cls.name,
        section=cls.section,
        department_id=cls.department_id,
        semester=cls.semester,
        default_room_id=cls.default_room_id,
        default_room_number=cls.default_room.room_number if cls.default_room else None,
        default_room_type=cls.default_room.room_type.value if cls.default_room and hasattr(cls.default_room.room_type, "value") else (str(cls.default_room.room_type) if cls.default_room else None),
        created_at=cls.created_at,
    )


def list_classes(db: Session, tenant_department_id: int | None = None) -> list[ClassOut]:
    # Classes are global. tenant_department_id is deliberately ignored for
    # read access; it remains relevant only when an admin changes ownership.
    classes = db.query(Class).order_by(Class.name, Class.section).all()
    return [_enrich_class(c) for c in classes]


def create_class(data: ClassCreate, db: Session, tenant_department_id: int | None = None) -> ClassOut:
    if tenant_department_id is not None and data.department_id != tenant_department_id:
        raise HTTPException(status_code=403, detail="HODs can only create classes for their own department")
    dept_id = tenant_department_id if tenant_department_id is not None else data.department_id
    exists = db.query(Class).filter(
        Class.name == data.name,
        Class.section == data.section,
    ).first()
    if exists:
        raise HTTPException(status_code=400, detail="A global class with that name and section already exists")
    
    cls = Class(
        name=data.name,
        section=data.section,
        department_id=dept_id,
        semester=data.semester,
        default_room_id=data.default_room_id,
    )
    db.add(cls)
    db.commit()
    db.refresh(cls)
    return _enrich_class(cls)


def bulk_create_classes(
    data: BulkClassCreate, db: Session, tenant_department_id: int | None = None
) -> BulkClassCreateOut:
    if tenant_department_id is not None and data.department_id != tenant_department_id:
        raise HTTPException(status_code=403, detail="HODs can only create classes for their own department")
    dept_id = tenant_department_id if tenant_department_id is not None else data.department_id

    existing_classes = {
        (c.name.strip().lower(), c.section.strip().lower())
        for c in db.query(Class.name, Class.section).all()
    }

    created_count = 0
    skipped_count = 0

    if data.mode == "section_range":
        start_char = data.start_section.strip().upper()[:1] or "A"
        end_char = data.end_section.strip().upper()[:1] or "D"
        start_ord = ord(start_char)
        end_ord = ord(end_char)

        if end_ord < start_ord:
            raise HTTPException(status_code=400, detail="End section must be greater than or equal to start section")
        if (end_ord - start_ord + 1) > 26:
            raise HTTPException(status_code=400, detail="Section range cannot exceed 26 sections (A-Z)")

        class_name = data.name_prefix.strip()
        for char_code in range(start_ord, end_ord + 1):
            sec = chr(char_code)
            key = (class_name.lower(), sec.lower())

            if key in existing_classes:
                skipped_count += 1
                continue

            cls = Class(
                name=class_name,
                section=sec,
                department_id=dept_id,
                semester=data.semester,
                default_room_id=data.default_room_id,
            )
            db.add(cls)
            existing_classes.add(key)
            created_count += 1
    else:
        # numeric_range
        if data.end_num < data.start_num:
            raise HTTPException(status_code=400, detail="End number must be greater than or equal to start number")
        if (data.end_num - data.start_num + 1) > 100:
            raise HTTPException(status_code=400, detail="Cannot create more than 100 classes in a single request")

        sec = data.section.strip() or "A"
        for idx, num in enumerate(range(data.start_num, data.end_num + 1)):
            class_name = f"{data.name_prefix}{num}".strip()
            key = (class_name.lower(), sec.lower())

            if key in existing_classes:
                skipped_count += 1
                continue

            if data.auto_increment_semester:
                calc_sem = min(8, max(1, data.semester + (idx * 2)))
            else:
                calc_sem = data.semester

            cls = Class(
                name=class_name,
                section=sec,
                department_id=dept_id,
                semester=calc_sem,
                default_room_id=data.default_room_id,
            )
            db.add(cls)
            existing_classes.add(key)
            created_count += 1

    db.commit()
    return BulkClassCreateOut(
        created_count=created_count,
        skipped_count=skipped_count,
        message=f"Created {created_count} class(es) successfully. Skipped {skipped_count} existing class(es)."
    )



def update_class(class_id: int, data: ClassUpdate, db: Session, tenant_department_id: int | None = None) -> ClassOut:
    cls = db.query(Class).filter(Class.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    if tenant_department_id is not None and cls.department_id != tenant_department_id:
        raise HTTPException(status_code=403, detail="You can only edit classes belonging to your own department")
        
    for key, value in data.model_dump(exclude_unset=True).items():
        if key == "department_id" and tenant_department_id is not None and value != tenant_department_id:
            raise HTTPException(status_code=403, detail="Cannot assign class to another department")
        setattr(cls, key, value)
        
    db.commit()
    db.refresh(cls)
    return _enrich_class(cls)


def delete_class(class_id: int, db: Session, tenant_department_id: int | None = None) -> None:
    cls = db.query(Class).filter(Class.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    if tenant_department_id is not None and cls.department_id != tenant_department_id:
        raise HTTPException(status_code=403, detail="You can only delete classes belonging to your own department")
        
    from app.models.timetable_submission import TimetableSubmission
    db.query(TimetableSlot).filter(TimetableSlot.class_id == class_id).delete(synchronize_session=False)
    db.query(TimetableSubmission).filter(TimetableSubmission.class_id == class_id).delete(synchronize_session=False)
    db.delete(cls)
    db.commit()
