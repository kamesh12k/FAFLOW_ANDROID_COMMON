from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException

from app.models.timetable import TimetableSlot
from app.models.user import User, Role
from app.models.class_ import Class
from app.schemas.timetable import TimetableSlotCreate, TimetableResetRequest


def _slot_summary(slot: TimetableSlot) -> dict:
    """Return safe, human-readable context for a conflicting booking."""
    class_name = "Unknown class"
    if slot.class_:
        class_name = f"{slot.class_.name}-{slot.class_.section}"
    return {
        "slot_id": slot.id,
        "teacher_id": slot.teacher_id,
        "teacher_name": slot.teacher.name if slot.teacher else "Unknown teacher",
        "class_id": slot.class_id,
        "class_name": class_name,
        "subject_id": slot.subject_id,
        "subject_name": slot.subject.name if slot.subject else "Assigned session",
        "room_id": slot.room_id,
        "room_name": slot.room.room_number if slot.room else "No room selected",
        "day_order": slot.day_order,
        "period_number": slot.period_number,
    }


def _raise_conflict(conflict_type: str, existing: TimetableSlot, requested: TimetableSlotCreate) -> None:
    labels = {
        "teacher": ("Teacher already scheduled", "This teacher is already teaching another class at this time.", "Choose a different teacher, day order, or period."),
        "class": ("Class already scheduled", "This class already has a session at this time.", "Choose a different class, day order, or period."),
        "room": ("Room already booked", "This room is already being used for another session at this time.", "Choose a different room, day order, or period."),
    }
    title, reason, resolution = labels[conflict_type]
    raise HTTPException(
        status_code=409,
        detail={
            "code": "TIMETABLE_CONFLICT",
            "conflict_type": conflict_type,
            "title": title,
            "reason": reason,
            "resolution": resolution,
            "requested": requested.model_dump(),
            "existing": _slot_summary(existing),
        },
    )


def _check_conflicts(db: Session, slot: TimetableSlotCreate, exclude_id: int | None = None) -> None:
    """Mirrors DB conflict validation with a friendly, specific 409 message identifying
    exactly which resource conflicts. When allow_combined_class is True, allows multiple
    staff to be assigned to the same class/room for co-teaching and combined sessions."""
    from sqlalchemy.orm import joinedload
    q = db.query(TimetableSlot).options(
        joinedload(TimetableSlot.teacher),
        joinedload(TimetableSlot.class_),
        joinedload(TimetableSlot.subject),
        joinedload(TimetableSlot.room),
    ).filter(
        TimetableSlot.day_order == slot.day_order,
        TimetableSlot.period_number == slot.period_number,
    )
    if exclude_id:
        q = q.filter(TimetableSlot.id != exclude_id)

    if getattr(slot, "allow_combined_class", False):
        # In Combined Class mode: allow co-staff or combined sections, but prevent exact duplicate
        exact_dup = q.filter(
            TimetableSlot.teacher_id == slot.teacher_id,
            TimetableSlot.class_id == slot.class_id,
        ).first()
        if exact_dup:
            _raise_conflict("teacher", exact_dup, slot)
    else:
        # Strict mode (Combine Class is OFF): single teacher per class, single class per teacher, single room per period
        teacher_conflict = q.filter(TimetableSlot.teacher_id == slot.teacher_id).first()
        if teacher_conflict:
            _raise_conflict("teacher", teacher_conflict, slot)

        class_conflict = q.filter(TimetableSlot.class_id == slot.class_id).first()
        if class_conflict:
            _raise_conflict("class", class_conflict, slot)

        if slot.room_id is not None:
            room_conflict = q.filter(TimetableSlot.room_id == slot.room_id).first()
            if room_conflict:
                _raise_conflict("room", room_conflict, slot)




def create_slot(data: TimetableSlotCreate, db: Session, tenant_department_id: int | None = None) -> TimetableSlot:
    # Classes are global. An HOD may schedule an active teacher from another
    # department on a global class; the normal teacher/class/room conflict
    # constraints still apply below.
    teacher = db.query(User).filter(User.id == data.teacher_id, User.role == "teacher", User.is_active == True).first()  # noqa: E712
    if not teacher:
        raise HTTPException(status_code=404, detail="Active teacher not found")
    if not db.query(Class).filter(Class.id == data.class_id).first():
        raise HTTPException(status_code=404, detail="Class not found")

    _check_conflicts(db, data)
    slot_dict = data.model_dump(exclude={"allow_combined_class"})
    slot = TimetableSlot(**slot_dict)
    db.add(slot)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Conflicting timetable slot (teacher already booked)")
    db.refresh(slot)
    return slot



def bulk_upload(slots_data: list[TimetableSlotCreate], db: Session, tenant_department_id: int | None = None) -> list[TimetableSlot]:
    """All-or-nothing: validates every slot for conflicts (against both
    the DB and each other within the same batch) before inserting any of
    them."""
    for slot in slots_data:
        teacher = db.query(User).filter(User.id == slot.teacher_id, User.role == "teacher", User.is_active == True).first()  # noqa: E712
        if not teacher:
            raise HTTPException(status_code=404, detail="Active teacher not found")
        if not db.query(Class).filter(Class.id == slot.class_id).first():
            raise HTTPException(status_code=404, detail="Class not found")

    seen_teacher_keys = set()
    seen_class_keys = set()
    seen_room_keys = set()

    for slot in slots_data:
        _check_conflicts(db, slot)

        t_key = (slot.teacher_id, slot.day_order, slot.period_number)
        c_key = (slot.class_id, slot.day_order, slot.period_number)
        r_key = (slot.room_id, slot.day_order, slot.period_number) if slot.room_id else None

        if t_key in seen_teacher_keys:
            raise HTTPException(status_code=409, detail=f"Duplicate teacher booking within this upload for Day Order {slot.day_order}, Period {slot.period_number}")
        if c_key in seen_class_keys:
            raise HTTPException(status_code=409, detail=f"Duplicate class booking within this upload for Day Order {slot.day_order}, Period {slot.period_number}")
        if r_key and r_key in seen_room_keys:
            raise HTTPException(status_code=409, detail=f"Duplicate room booking within this upload for Day Order {slot.day_order}, Period {slot.period_number}")

        seen_teacher_keys.add(t_key)
        seen_class_keys.add(c_key)
        if r_key:
            seen_room_keys.add(r_key)

    slots = [TimetableSlot(**s.model_dump(exclude={"allow_combined_class"})) for s in slots_data]
    db.add_all(slots)
    try:
        db.commit()

    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Conflicting timetable slot detected during save — no slots were saved")
    for s in slots:
        db.refresh(s)
    return slots


def get_by_teacher(teacher_id: int, db: Session, tenant_department_id: int | None = None) -> list[TimetableSlot]:
    if tenant_department_id is not None:
        teacher = db.query(User).filter(User.id == teacher_id).first()
        if not teacher or teacher.department_id != tenant_department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    return db.query(TimetableSlot).filter(TimetableSlot.teacher_id == teacher_id).order_by(TimetableSlot.day_order, TimetableSlot.period_number).all()


def get_by_class(class_id: int, db: Session, tenant_department_id: int | None = None) -> list[TimetableSlot]:
    if not db.query(Class).filter(Class.id == class_id).first():
        raise HTTPException(status_code=404, detail="Class not found")
    return db.query(TimetableSlot).filter(TimetableSlot.class_id == class_id).order_by(TimetableSlot.day_order, TimetableSlot.period_number).all()


def list_slots(
    db: Session,
    class_id: int | None = None,
    teacher_id: int | None = None,
    department_id: int | None = None,
    day_order: int | None = None,
    tenant_department_id: int | None = None,
) -> list[TimetableSlot]:
    dept = tenant_department_id or department_id
    q = db.query(TimetableSlot)
    if class_id is not None:
        q = q.filter(TimetableSlot.class_id == class_id)
    if teacher_id is not None:
        q = q.filter(TimetableSlot.teacher_id == teacher_id)
    if day_order is not None:
        q = q.filter(TimetableSlot.day_order == day_order)
    if dept is not None:
        q = q.join(User, TimetableSlot.teacher_id == User.id).filter(User.department_id == dept)
    return q.order_by(TimetableSlot.day_order, TimetableSlot.period_number).all()


def delete_slot(slot_id: int, db: Session, tenant_department_id: int | None = None) -> None:
    slot = db.query(TimetableSlot).filter(TimetableSlot.id == slot_id).first()
    if slot:
        if tenant_department_id is not None:
            is_class_dept = slot.class_ and slot.class_.department_id == tenant_department_id
            is_teacher_dept = slot.teacher and slot.teacher.department_id == tenant_department_id
            if not (is_class_dept or is_teacher_dept):
                raise HTTPException(status_code=403, detail="Access denied")
        db.delete(slot)
        db.commit()


def delete_by_teacher(teacher_id: int, db: Session, tenant_department_id: int | None = None) -> None:
    if tenant_department_id is not None:
        teacher = db.query(User).filter(User.id == teacher_id).first()
        if not teacher or teacher.department_id != tenant_department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    db.query(TimetableSlot).filter(TimetableSlot.teacher_id == teacher_id).delete()
    db.commit()


def reset_timetable(
    data: TimetableResetRequest,
    db: Session,
    actor_user: User,
    tenant_department_id: int | None = None,
) -> dict:
    """
    Granularly reset timetable slots with 3 supported scopes:
      1. 'all'        — all teachers across the institution (System Admin only)
      2. 'department' — all teachers in a specific department
      3. 'teachers'   — one or more selected teachers

    Optionally also clears pending/approved timetable submissions for the targets.
    Logs every reset to the system audit log.
    """
    from app.models.department import Department
    from app.models.timetable_submission import TimetableSubmission
    from app.services.admin_service import log_audit_event

    scope = data.scope.lower() if data.scope else ""
    deleted_slots_count = 0
    deleted_subs_count = 0
    target_summary = ""

    is_system_admin = actor_user.role == Role.system_admin
    effective_dept_id = None if is_system_admin else (tenant_department_id or actor_user.department_id)

    if scope == "all":
        # Global institution-wide reset
        if not is_system_admin:
            raise HTTPException(
                status_code=403,
                detail="Only System Administrators can reset the timetable institution-wide.",
            )
        slots_q = db.query(TimetableSlot)
        subs_q = db.query(TimetableSubmission)
        deleted_slots_count = slots_q.count()
        deleted_subs_count = subs_q.count() if data.clear_submissions else 0

        slots_q.delete(synchronize_session=False)
        if data.clear_submissions:
            subs_q.delete(synchronize_session=False)

        target_summary = "All teachers (institution-wide)"

    elif scope == "department":
        if not data.department_id:
            raise HTTPException(
                status_code=400,
                detail="department_id is required when scope is 'department'.",
            )
        if effective_dept_id is not None and effective_dept_id != data.department_id:
            raise HTTPException(
                status_code=403,
                detail="You can only reset the timetable for your assigned department.",
            )

        dept = db.query(Department).filter(Department.id == data.department_id).first()
        if not dept:
            raise HTTPException(status_code=404, detail="Department not found.")

        dept_teachers = db.query(User).filter(User.department_id == data.department_id).all()
        dept_teacher_ids = [t.id for t in dept_teachers]
        dept_class_ids = [c.id for c in db.query(Class.id).filter(Class.department_id == data.department_id).all()]

        slots_q = db.query(TimetableSlot).filter(
            (TimetableSlot.teacher_id.in_(dept_teacher_ids)) | (TimetableSlot.class_id.in_(dept_class_ids))
        ) if (dept_teacher_ids or dept_class_ids) else db.query(TimetableSlot).filter(False)

        subs_q = db.query(TimetableSubmission).filter(
            (TimetableSubmission.teacher_id.in_(dept_teacher_ids)) | (TimetableSubmission.class_id.in_(dept_class_ids))
        ) if (dept_teacher_ids or dept_class_ids) else db.query(TimetableSubmission).filter(False)

        deleted_slots_count = slots_q.count()
        deleted_subs_count = subs_q.count() if data.clear_submissions else 0

        slots_q.delete(synchronize_session=False)
        if data.clear_submissions:
            subs_q.delete(synchronize_session=False)

        target_summary = f"Department '{dept.name}' ({len(dept_teacher_ids)} teachers)"

    elif scope == "teachers":
        if not data.teacher_ids or len(data.teacher_ids) == 0:
            raise HTTPException(
                status_code=400,
                detail="teacher_ids list must contain at least one teacher ID.",
            )

        teachers = db.query(User).filter(User.id.in_(data.teacher_ids)).all()
        if not teachers:
            raise HTTPException(status_code=404, detail="No matching teachers found.")

        if effective_dept_id is not None:
            non_dept = [t for t in teachers if t.department_id != effective_dept_id]
            if non_dept:
                raise HTTPException(
                    status_code=403,
                    detail="One or more selected teachers do not belong to your department.",
                )

        target_ids = [t.id for t in teachers]
        slots_q = db.query(TimetableSlot).filter(TimetableSlot.teacher_id.in_(target_ids))
        subs_q = db.query(TimetableSubmission).filter(TimetableSubmission.teacher_id.in_(target_ids))

        deleted_slots_count = slots_q.count()
        deleted_subs_count = subs_q.count() if data.clear_submissions else 0

        slots_q.delete(synchronize_session=False)
        if data.clear_submissions:
            subs_q.delete(synchronize_session=False)

        sample_names = ", ".join(t.name for t in teachers[:3])
        if len(teachers) > 3:
            sample_names += f" and {len(teachers) - 3} more"
        target_summary = f"{len(teachers)} teacher(s) [{sample_names}]"

    else:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid scope '{data.scope}'. Must be 'all', 'department', or 'teachers'.",
        )

    db.commit()

    # Audit logging
    log_audit_event(
        db,
        actor_user_id=actor_user.id,
        action="timetable.reset",
        target_type="timetable",
        details={
            "scope": scope,
            "deleted_slots_count": deleted_slots_count,
            "deleted_submissions_count": deleted_subs_count,
            "target_summary": target_summary,
            "department_id": data.department_id,
            "teacher_ids": data.teacher_ids,
        },
    )
    db.commit()

    return {
        "deleted_slots_count": deleted_slots_count,
        "deleted_submissions_count": deleted_subs_count,
        "scope": scope,
        "target_summary": target_summary,
        "message": f"Successfully reset timetable for {target_summary}. {deleted_slots_count} slot(s) cleared.",
    }
