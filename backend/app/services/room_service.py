from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.room import Room
from app.models.timetable import TimetableSlot
from app.schemas.room import RoomCreate, RoomUpdate, RoomAvailabilityOut, BulkRoomCreate, BulkRoomCreateOut


def list_rooms(db: Session, room_type: str | None = None) -> list[Room]:
    q = db.query(Room)
    if room_type:
        q = q.filter(Room.room_type == room_type)
    return q.order_by(Room.room_number).all()


def create_room(data: RoomCreate, db: Session) -> Room:
    if db.query(Room).filter(Room.room_number == data.room_number).first():
        raise HTTPException(status_code=400, detail="A room with that number already exists")
    room = Room(**data.model_dump())
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


def bulk_create_rooms(data: BulkRoomCreate, db: Session) -> BulkRoomCreateOut:
    if data.end_num < data.start_num:
        raise HTTPException(status_code=400, detail="End number must be greater than or equal to start number")
    if (data.end_num - data.start_num + 1) > 200:
        raise HTTPException(status_code=400, detail="Cannot create more than 200 rooms in a single request")

    existing_room_numbers = {
        r.room_number for r in db.query(Room.room_number).all()
    }

    created_count = 0
    skipped_count = 0

    for num in range(data.start_num, data.end_num + 1):
        if data.pad_digits > 0:
            formatted_num = f"{num:0{data.pad_digits}d}"
        else:
            formatted_num = str(num)
        room_num = f"{data.prefix}{formatted_num}"

        if room_num in existing_room_numbers:
            skipped_count += 1
            continue

        room = Room(
            room_number=room_num,
            room_type=data.room_type,
            capacity=data.capacity,
            department_id=data.department_id,
        )
        db.add(room)
        existing_room_numbers.add(room_num)
        created_count += 1

    db.commit()
    return BulkRoomCreateOut(
        created_count=created_count,
        skipped_count=skipped_count,
        message=f"Created {created_count} room(s) successfully. Skipped {skipped_count} existing room(s)."
    )



def update_room(room_id: int, data: RoomUpdate, db: Session) -> Room:
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(room, key, value)
    db.commit()
    db.refresh(room)
    return room


def delete_room(room_id: int, db: Session) -> None:
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    from app.models.timetable_submission import TimetableSubmission
    db.query(TimetableSlot).filter(TimetableSlot.room_id == room_id).update({"room_id": None}, synchronize_session=False)
    db.query(TimetableSubmission).filter(TimetableSubmission.room_id == room_id).update({"room_id": None}, synchronize_session=False)
    db.delete(room)
    db.commit()


def check_room_availability(room_id: int, day_order: int, period_number: int, db: Session) -> bool:
    booking = (
        db.query(TimetableSlot)
        .filter(
            TimetableSlot.room_id == room_id,
            TimetableSlot.day_order == day_order,
            TimetableSlot.period_number == period_number,
        )
        .first()
    )
    return booking is None


def availability_dashboard(day_order: int, period_number: int, db: Session) -> list[RoomAvailabilityOut]:
    rooms = db.query(Room).order_by(Room.room_number).all()
    booked_room_ids = {
        r_id for (r_id,) in db.query(TimetableSlot.room_id).filter(
            TimetableSlot.day_order == day_order,
            TimetableSlot.period_number == period_number,
            TimetableSlot.room_id.isnot(None),
        ).all()
    }
    return [
        RoomAvailabilityOut(
            room_id=room.id,
            room_number=room.room_number,
            room_type=room.room_type,
            is_available=room.id not in booked_room_ids,
        )
        for room in rooms
    ]


def get_classroom_occupancy(
    db: Session,
    day_order: int | None = None,
    period_number: int | None = None,
    department_id: int | None = None,
    room_type: str | None = None,
) -> dict:
    """Returns comprehensive real-time and scheduled occupancy status for all classrooms and labs."""
    from app.core.timezone import get_institution_today
    from app.models.day_order_calendar import CalendarDay
    from app.models.department import Department
    from app.models.class_ import Class
    from app.models.subject import Subject
    from app.models.user import User
    from app.models.leave import LeaveRequest, AlterAssignment

    today = get_institution_today()

    # 1. Resolve Day Order
    if day_order is None or day_order < 1 or day_order > 6:
        cal = db.query(CalendarDay).filter(CalendarDay.date == today).first()
        day_order = cal.day_order if (cal and cal.day_order) else 1

    # 2. Resolve Period Number (default to 1 if not specified or out of bounds)
    active_period = period_number if (period_number and 1 <= period_number <= 5) else 1

    # 3. Query all rooms with optional filtering
    q = db.query(Room)
    if department_id:
        q = q.filter(Room.department_id == department_id)
    if room_type:
        q = q.filter(Room.room_type == room_type)
    rooms = q.order_by(Room.room_number).all()

    room_ids = [r.id for r in rooms]

    # 4. Fetch all slots for these rooms on this day_order (periods 1 to 5)
    slots = (
        db.query(TimetableSlot)
        .filter(
            TimetableSlot.room_id.in_(room_ids),
            TimetableSlot.day_order == day_order,
        )
        .all()
    ) if room_ids else []

    # 5. Fetch substitutions for today to reflect actual active faculty
    sub_map = {}
    today_leaves = db.query(LeaveRequest).filter(LeaveRequest.date == today).all()
    if today_leaves:
        leave_ids = [l.id for l in today_leaves]
        alters = (
            db.query(AlterAssignment)
            .filter(
                AlterAssignment.leave_request_id.in_(leave_ids),
                AlterAssignment.substitute_teacher_id.isnot(None),
            )
            .all()
        )
        leave_teacher_map = {l.id: l.teacher_id for l in today_leaves}
        for alt in alters:
            t_id = leave_teacher_map.get(alt.leave_request_id)
            if t_id and alt.period_number and alt.substitute:
                is_comb = alt.assignment_type.value == "combined_class" if hasattr(alt.assignment_type, "value") else str(alt.assignment_type) == "combined_class"
                sub_map[(t_id, alt.period_number)] = {
                    "substitute_name": alt.substitute.name,
                    "is_combined": is_comb,
                }

    # Organize slots by (room_id, period_number)
    slot_map = {}
    for s in slots:
        sub_info = sub_map.get((s.teacher_id, s.period_number))
        sub_name = sub_info["substitute_name"] if sub_info else None
        is_comb = sub_info["is_combined"] if sub_info else False
        slot_map[(s.room_id, s.period_number)] = {
            "slot_id": s.id,
            "class_id": s.class_id,
            "class_name": s.class_.name if s.class_ else None,
            "subject_id": s.subject_id,
            "subject_name": s.subject.name if s.subject else None,
            "subject_code": s.subject.code if s.subject else None,
            "teacher_id": s.teacher_id,
            "teacher_name": s.teacher.name if s.teacher else None,
            "substitute_name": sub_name,
            "is_substituted": bool(sub_name),
            "is_combined": is_comb,
        }


    # 6. Build response per room
    room_list = []
    occupied_count = 0
    vacant_count = 0

    for r in rooms:
        period_schedule = {}
        for p in range(1, 6):
            p_slot = slot_map.get((r.id, p))
            period_schedule[p] = {
                "period_number": p,
                "is_occupied": p_slot is not None,
                "class_name": p_slot["class_name"] if p_slot else None,
                "subject_code": p_slot["subject_code"] if p_slot else None,
                "teacher_name": (p_slot["substitute_name"] or p_slot["teacher_name"]) if p_slot else None,
                "is_substituted": p_slot["is_substituted"] if p_slot else False,
            }

        cur_slot = slot_map.get((r.id, active_period))
        is_occ = cur_slot is not None
        if is_occ:
            occupied_count += 1
        else:
            vacant_count += 1

        dept_name = r.department.name if r.department else "General / Campus"

        room_list.append({
            "id": r.id,
            "room_number": r.room_number,
            "room_type": r.room_type.value if hasattr(r.room_type, "value") else str(r.room_type),
            "capacity": r.capacity,
            "department_id": r.department_id,
            "department_name": dept_name,
            "is_occupied": is_occ,
            "current_slot": cur_slot,
            "period_schedule": period_schedule,
        })

    total_rooms = len(rooms)
    rate = round((occupied_count / total_rooms * 100), 1) if total_rooms > 0 else 0.0

    return {
        "date": str(today),
        "day_order": day_order,
        "selected_period": active_period,
        "summary": {
            "total_rooms": total_rooms,
            "occupied_count": occupied_count,
            "vacant_count": vacant_count,
            "occupancy_rate_percent": rate,
        },
        "rooms": room_list,
    }

