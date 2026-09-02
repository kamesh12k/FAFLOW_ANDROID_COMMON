from datetime import date, timedelta
from sqlalchemy.orm import Session

from app.models.leave import LeaveRequest, LeaveStatus
from app.models.user import User
from app.models.day_order_calendar import CalendarDay, DayType
from app.schemas.academic_calendar import (
    TodaySummary, TeacherOnLeaveToday, UpcomingNonWorkingDay, TeacherTodaySummary,
)
from app.services import day_order_service

UPCOMING_LOOKAHEAD_DAYS = 14


def get_today_summary(db: Session, today: date, tenant_department_id: int | None = None) -> TodaySummary:
    """Backs the admin Home screen's single 'Today' card: what kind of day
    it is, which teachers are on approved leave today (and whether a
    substitute has been assigned), how many leave requests are still
    pending review, and any holiday/exam/etc. coming up in the next two
    weeks — the 'upcoming holiday' reminder."""
    calendar_day = day_order_service.resolve_by_date(db, today)
    day_type = calendar_day.day_type if calendar_day else DayType.non_working
    day_order = calendar_day.day_order if calendar_day else None
    blocks = calendar_day.blocks_operations if calendar_day else True

    teachers_on_leave: list[TeacherOnLeaveToday] = []
    if not blocks:
        leaves_query = db.query(LeaveRequest).join(User, LeaveRequest.teacher_id == User.id)
        if tenant_department_id is not None:
            leaves_query = leaves_query.filter(User.department_id == tenant_department_id)
        leaves_today = (
            leaves_query.filter(LeaveRequest.date == today, LeaveRequest.status == LeaveStatus.approved)
            .all()
        )
        for leave in leaves_today:
            teacher = db.query(User).filter(User.id == leave.teacher_id).first()
            sub_name = None
            if leave.alter_assignment:
                sub = db.query(User).filter(User.id == leave.alter_assignment.substitute_teacher_id).first()
                sub_name = sub.name if sub else None
            teachers_on_leave.append(
                TeacherOnLeaveToday(
                    teacher_id=leave.teacher_id,
                    name=teacher.name if teacher else "Unknown",
                    department=teacher.department if teacher else None,
                    period_number=leave.period_number,
                    has_substitute=leave.alter_assignment is not None,
                    substitute_name=sub_name,
                )
            )

    pending_query = db.query(LeaveRequest).join(User, LeaveRequest.teacher_id == User.id)
    if tenant_department_id is not None:
        pending_query = pending_query.filter(User.department_id == tenant_department_id)
    
    # Calculate distinct faculty count who have pending leave
    pending_faculty_count = (
        pending_query.filter(LeaveRequest.status == LeaveStatus.pending)
        .with_entities(LeaveRequest.teacher_id)
        .distinct()
        .count()
    )
    pending_periods_count = pending_query.filter(LeaveRequest.status == LeaveStatus.pending).count()


    upcoming_rows = (
        db.query(CalendarDay)
        .filter(
            CalendarDay.date > today,
            CalendarDay.date <= today + timedelta(days=UPCOMING_LOOKAHEAD_DAYS),
            CalendarDay.day_type != DayType.working,
        )
        .order_by(CalendarDay.date)
        .all()
    )
    upcoming = [
        UpcomingNonWorkingDay(
            date=row.date, day_type=row.day_type, label=row.label,
            days_away=(row.date - today).days,
        )
        for row in upcoming_rows
    ]

    unique_teachers = len({t.teacher_id for t in teachers_on_leave})
    return TodaySummary(
        date=today,
        day_type=day_type,
        day_order=day_order,
        blocks_operations=blocks,
        teachers_on_leave=teachers_on_leave,
        pending_leave_count=pending_faculty_count,
        pending_faculty_count=pending_faculty_count,
        pending_periods_count=pending_periods_count,
        upcoming_non_working_days=upcoming,
        teachers_on_leave_count=unique_teachers,
        leave_periods_count=len(teachers_on_leave),
    )


def get_teacher_today_summary(db: Session, teacher_id: int, today: date) -> TeacherTodaySummary:
    """Teacher-scoped Home card: same day info as the admin version, but
    only this teacher's own leave status — never another teacher's
    details, since a teacher has no business reason to see who else is
    out (that's an admin-only view)."""
    calendar_day = day_order_service.resolve_by_date(db, today)
    day_type = calendar_day.day_type if calendar_day else DayType.non_working
    day_order = calendar_day.day_order if calendar_day else None
    blocks = calendar_day.blocks_operations if calendar_day else True

    is_on_leave_today = False
    periods_today = 0
    if not blocks:
        own_leaves_today = (
            db.query(LeaveRequest)
            .filter(
                LeaveRequest.teacher_id == teacher_id,
                LeaveRequest.date == today,
                LeaveRequest.status == LeaveStatus.approved,
            )
            .count()
        )
        is_on_leave_today = own_leaves_today > 0

        from app.models.timetable import TimetableSlot
        if day_order is not None:
            periods_today = (
                db.query(TimetableSlot)
                .filter(TimetableSlot.teacher_id == teacher_id, TimetableSlot.day_order == day_order)
                .count()
            )

    upcoming_rows = (
        db.query(CalendarDay)
        .filter(
            CalendarDay.date > today,
            CalendarDay.date <= today + timedelta(days=UPCOMING_LOOKAHEAD_DAYS),
            CalendarDay.day_type != DayType.working,
        )
        .order_by(CalendarDay.date)
        .all()
    )
    upcoming = [
        UpcomingNonWorkingDay(date=row.date, day_type=row.day_type, label=row.label, days_away=(row.date - today).days)
        for row in upcoming_rows
    ]

    return TeacherTodaySummary(
        date=today,
        day_type=day_type,
        day_order=day_order,
        blocks_operations=blocks,
        is_on_leave_today=is_on_leave_today,
        periods_today=periods_today,
        upcoming_non_working_days=upcoming,
    )


def get_principal_overview(db: Session) -> dict:
    from app.models.department import Department
    from app.models.class_ import Class
    from app.models.subject import Subject
    from app.models.user import User, Role
    from app.models.leave import LeaveRequest, LeaveStatus, AlterAssignment
    from datetime import date
    
    today = date.today()
    
    # Global metrics
    total_depts = db.query(Department).count()
    total_teachers = db.query(User).filter(User.role == Role.teacher).count()
    total_classes = db.query(Class).count()
    total_subjects = db.query(Subject).count()
    
    total_pending_leaves = db.query(LeaveRequest).filter(LeaveRequest.status == LeaveStatus.pending).count()
    total_leaves_today = db.query(LeaveRequest).filter(LeaveRequest.date == today, LeaveRequest.status == LeaveStatus.approved).count()
    
    # Standardized metrics
    teachers_on_leave_today = db.query(LeaveRequest.teacher_id).filter(
        LeaveRequest.date == today, LeaveRequest.status == LeaveStatus.approved
    ).distinct().count()
    
    leave_periods_today = total_leaves_today
    pending_leave_periods = total_pending_leaves
    
    pending_teachers_on_leave = db.query(LeaveRequest.teacher_id).filter(
        LeaveRequest.status == LeaveStatus.pending
    ).distinct().count()
    
    # Overall coverage rate today for principal overview
    # (Covered periods today / Approved leave periods today)
    covered_periods_today = db.query(LeaveRequest).join(AlterAssignment).filter(
        LeaveRequest.date == today, LeaveRequest.status == LeaveStatus.approved
    ).count()
    
    overall_coverage_rate = 100.0
    if leave_periods_today > 0:
        overall_coverage_rate = round((covered_periods_today / leave_periods_today) * 100.0, 1)
    
    # Department-wise breakdown
    depts = db.query(Department).order_by(Department.name).all()
    dept_summaries = []
    
    for dept in depts:
        teacher_count = db.query(User).filter(User.role == Role.teacher, User.department_id == dept.id).count()
        class_count = db.query(Class).filter(Class.department_id == dept.id).count()
        
        pending_leaves_count = (
            db.query(LeaveRequest)
            .join(User, LeaveRequest.teacher_id == User.id)
            .filter(User.department_id == dept.id, LeaveRequest.status == LeaveStatus.pending)
            .count()
        )
        
        leaves_today_count = (
            db.query(LeaveRequest)
            .join(User, LeaveRequest.teacher_id == User.id)
            .filter(User.department_id == dept.id, LeaveRequest.date == today, LeaveRequest.status == LeaveStatus.approved)
            .count()
        )
        
        # New standardized dept metrics
        teachers_today_count = (
            db.query(LeaveRequest.teacher_id)
            .join(User, LeaveRequest.teacher_id == User.id)
            .filter(User.department_id == dept.id, LeaveRequest.date == today, LeaveRequest.status == LeaveStatus.approved)
            .distinct()
            .count()
        )
        
        pending_teachers_count = (
            db.query(LeaveRequest.teacher_id)
            .join(User, LeaveRequest.teacher_id == User.id)
            .filter(User.department_id == dept.id, LeaveRequest.status == LeaveStatus.pending)
            .distinct()
            .count()
        )
        
        dept_summaries.append({
            "id": dept.id,
            "name": dept.name,
            "code": dept.code,
            "teacher_count": teacher_count,
            "class_count": class_count,
            "pending_leaves_count": pending_leaves_count,
            "leaves_today_count": leaves_today_count,
            "teachers_on_leave_today_count": teachers_today_count,
            "leave_periods_today_count": leaves_today_count,
            "pending_leave_periods_count": pending_leaves_count,
            "pending_teachers_on_leave_count": pending_teachers_count,
        })
        
    return {
        "total_departments": total_depts,
        "total_teachers": total_teachers,
        "total_classes": total_classes,
        "total_subjects": total_subjects,
        "total_pending_leaves": total_pending_leaves,
        "total_leaves_today": total_leaves_today,
        "departments": dept_summaries,
        "teachers_on_leave_today": teachers_on_leave_today,
        "leave_periods_today": leave_periods_today,
        "pending_leave_periods": pending_leave_periods,
        "pending_teachers_on_leave": pending_teachers_on_leave,
        "overall_coverage_rate": overall_coverage_rate,
    }

