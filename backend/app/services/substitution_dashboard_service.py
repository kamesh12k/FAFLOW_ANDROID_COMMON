from datetime import date
from sqlalchemy.orm import Session, joinedload
from app.models.leave import LeaveRequest, LeaveStatus, AlterAssignment
from app.models.user import User
from app.models.timetable import TimetableSlot
from app.models.day_order_calendar import CalendarDay
from app.models.class_ import Class
from app.core.timezone import is_substitution_expired

def get_today_substitutions(db: Session, target_date: date, tenant_department_id: int | None = None) -> dict:
    is_expired = is_substitution_expired(target_date)
    # 1. Resolve Day Order calendar entry
    cal_day = db.query(CalendarDay).filter(CalendarDay.date == target_date).first()
    day_type_str = cal_day.day_type.value if cal_day else "holiday"
    day_order_str = f"DO{cal_day.day_order}" if cal_day and cal_day.day_order else None

    # 2. Query approved leaves for the date with eager loaded relationships
    query = (
        db.query(LeaveRequest)
        .options(
            joinedload(LeaveRequest.teacher),
            joinedload(LeaveRequest.alter_assignment).joinedload(AlterAssignment.substitute)
        )
    )
    if tenant_department_id is not None:
        query = query.join(User, LeaveRequest.teacher_id == User.id).filter(User.department_id == tenant_department_id)
    
    leaves = (
        query.filter(LeaveRequest.date == target_date, LeaveRequest.status == LeaveStatus.approved)
        .order_by(LeaveRequest.period_number)
        .all()
    )

    total_leaves = len(leaves)
    total_substitutions = 0
    substitutions_list = []

    # 3. Batch load timetable slots with class_ for all original teachers on this day order
    slots_map = {}
    if cal_day and cal_day.day_order and leaves:
        teacher_ids = {leave.teacher_id for leave in leaves}
        slots = (
            db.query(TimetableSlot)
            .options(joinedload(TimetableSlot.class_))
            .filter(
                TimetableSlot.day_order == cal_day.day_order,
                TimetableSlot.teacher_id.in_(teacher_ids)
            )
            .all()
        )
        for slot in slots:
            slots_map[(slot.teacher_id, slot.period_number)] = slot


    for leave in leaves:
        # Resolve slot from pre-loaded map
        slot = slots_map.get((leave.teacher_id, leave.period_number))

        class_name = "General Duty"
        if slot and slot.class_:
            class_name = f"{slot.class_.name} - {slot.class_.section}"

        alter = leave.alter_assignment
        substitute_name = "Unassigned"
        substitute_id = None
        assignment_type = None
        is_locked = False

        if alter:
            total_substitutions += 1
            substitute_name = alter.substitute.name if alter.substitute else "Unassigned"
            substitute_id = alter.substitute_teacher_id
            assignment_type = alter.assignment_type.value
            is_locked = alter.is_locked

        substitutions_list.append({
            "leave_id": leave.id,
            "period_number": leave.period_number,
            "class_name": class_name,
            "original_teacher": {
                "id": leave.teacher.id,
                "name": leave.teacher.name,
                "department": leave.teacher.department
            },
            "substitute_teacher": {
                "id": substitute_id,
                "name": substitute_name
            } if substitute_id else None,
            "assignment_type": assignment_type,
            "is_locked": is_locked,
            "reason": leave.reason,
            "is_emergency": leave.is_emergency,
            "is_expired": is_expired
        })

    unassigned_periods = total_leaves - total_substitutions
    coverage_percentage = (
        round((total_substitutions / total_leaves) * 100, 1)
        if total_leaves > 0
        else 100.0
    )

    teachers_on_leave = len({leave.teacher_id for leave in leaves})

    return {
        "date": target_date.isoformat(),
        "day_order": day_order_str,
        "day_type": day_type_str,
        "summary": {
            "total_leaves": total_leaves,
            "total_substitutions": total_substitutions,
            "unassigned_periods": unassigned_periods,
            "coverage_percentage": coverage_percentage,
            "teachers_on_leave": teachers_on_leave,
            "leave_periods": total_leaves,
            "covered_periods": total_substitutions,
            "pending_coverage": unassigned_periods,
            "coverage_rate": coverage_percentage
        },
        "substitutions": substitutions_list
    }
