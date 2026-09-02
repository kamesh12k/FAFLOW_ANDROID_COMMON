from sqlalchemy.orm import Session

from app.models.class_ import Class
from app.models.timetable import TimetableSlot


def list_class_directory(db: Session) -> list[dict]:
    classes = db.query(Class).order_by(Class.name, Class.section).all()
    result = []
    for cls in classes:
        slots = db.query(TimetableSlot).filter(TimetableSlot.class_id == cls.id).all()
        faculty_ids = {slot.teacher_id for slot in slots}
        result.append({
            "id": cls.id, "name": cls.name, "section": cls.section,
            "semester": cls.semester, "department_id": cls.department_id,
            "default_room_id": cls.default_room_id,
            "default_room_number": cls.default_room.room_number if cls.default_room else None,
            "faculty_count": len(faculty_ids), "subject_count": len({s.subject_id for s in slots if s.subject_id}),
        })
    return result


def get_class_faculty(db: Session, class_id: int) -> dict:
    cls = db.query(Class).filter(Class.id == class_id).first()
    if not cls:
        return None
    slots = db.query(TimetableSlot).filter(TimetableSlot.class_id == class_id).order_by(TimetableSlot.day_order, TimetableSlot.period_number).all()
    return {
        "id": cls.id, "name": cls.name, "section": cls.section, "semester": cls.semester, "department_id": cls.department_id,
        "default_room_id": cls.default_room_id,
        "default_room_number": cls.default_room.room_number if cls.default_room else None,
        "default_room_type": cls.default_room.room_type.value if cls.default_room and hasattr(cls.default_room.room_type, "value") else (str(cls.default_room.room_type) if cls.default_room else None),
        "faculty": [{
            "teacher_id": slot.teacher_id, "teacher_name": slot.teacher.name, "teacher_department_id": slot.teacher.department_id,
            "teacher_department": slot.teacher.department, "subject_id": slot.subject_id,
            "subject_name": slot.subject.name if slot.subject else None, "subject_code": slot.subject.code if slot.subject else None,
            "day_order": slot.day_order, "period_number": slot.period_number,
            "room": slot.room.room_number if slot.room else None,
        } for slot in slots],
    }
