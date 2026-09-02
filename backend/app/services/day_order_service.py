"""
Day Order & Academic Calendar engine.

Core responsibilities:
  - Mark any date as a working day (with a Day Order 1-6) or a non-working
    day type (holiday / college_leave / government_holiday / exam_day /
    special_event / department_activity / non_working).
  - Auto-sequence Day Order across working days, pausing on non-working
    days and resuming the rotation on the next working day — exactly the
    24/25/26-Aug example from the spec (DO 3 -> Holiday -> DO 4).
  - Support skip / reassign / manual override without breaking the
    sequence for dates the admin hasn't touched.
  - Provide the single source of truth ("resolve") that leave, timetable,
    and credit code call before doing anything date-related, so holiday
    exclusion lives in exactly one place.

Design note on "continue after holidays": Day Order is derived from the
nearest prior *working* day's day_order + 1 (wrapping 6 -> 1), looked up
fresh each time a date is marked — not stored as a running counter. This
makes "insert a holiday in the middle of the month" trivially correct: the
engine just recomputes everything strictly after the inserted date, skips
any manually-overridden rows, and stops correctly.
"""
from datetime import date, timedelta

from sqlalchemy import asc
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.config import settings
from app.models.day_order_calendar import CalendarDay, DayType, BLOCKING_DAY_TYPES
from app.models.user import User
from app.services.admin_service import log_audit_event

DAY_ORDER_MIN = 1
# Customizable via DAY_ORDER_MAX in .env — see app/config.py for the
# distinction between this application-layer value and the database's
# own CHECK constraint, which is a separate hard backstop not read from
# settings (widening it for real requires a migration).
DAY_ORDER_MAX = settings.DAY_ORDER_MAX


def _next_day_order(current: int) -> int:
    return DAY_ORDER_MIN if current >= DAY_ORDER_MAX else current + 1


def get_day(db: Session, the_date: date) -> CalendarDay | None:
    return db.query(CalendarDay).filter(CalendarDay.date == the_date).first()


def get_or_404(db: Session, the_date: date) -> CalendarDay:
    day = get_day(db, the_date)
    if not day:
        raise HTTPException(status_code=404, detail=f"No calendar entry for {the_date}")
    return day


def _last_working_day_before(db: Session, the_date: date) -> CalendarDay | None:
    return (
        db.query(CalendarDay)
        .filter(CalendarDay.date < the_date, CalendarDay.day_type == DayType.working)
        .order_by(CalendarDay.date.desc())
        .first()
    )


def _resequence_following_days(db: Session, from_date: date) -> None:
    """After inserting/changing a day, walk forward through subsequent
    CalendarDay rows in date order and recompute day_order for every
    working day that is NOT manually overridden, continuing the rotation
    from whatever the new predecessor's day_order is. Stops adjusting once
    it hits a manually-overridden row (that row's own value stands, and
    the rotation continues from there for anything after it)."""
    prior = _last_working_day_before(db, from_date)
    running = prior.day_order if prior else None

    following = (
        db.query(CalendarDay)
        .filter(CalendarDay.date > from_date)
        .order_by(asc(CalendarDay.date))
        .all()
    )

    for day in following:
        if day.day_type != DayType.working:
            continue
        if day.is_manual_override:
            running = day.day_order
            continue
        running = _next_day_order(running) if running is not None else DAY_ORDER_MIN
        day.day_order = running

    db.flush()


def mark_day(
    db: Session,
    actor: User,
    the_date: date,
    day_type: DayType,
    day_order: int | None = None,
    label: str | None = None,
    notes: str | None = None,
    academic_year_id: int | None = None,
    semester_id: int | None = None,
    is_manual_override: bool | None = None,
) -> CalendarDay:
    """Create or update the CalendarDay row for `the_date`. Handles all of:
      - marking a date as Holiday / College Leave / Government Holiday /
        Exam Day / Special Event / Department Activity / Non-Working
      - assigning or reassigning a Day Order on a working day
      - auto-continuing the Day Order sequence afterward

    Validation:
      - Day Order is required (or auto-derived) only for day_type=working;
        any other day_type forces day_order to NULL — a holiday cannot
        carry a Day Order by construction.
    """
    existing = get_day(db, the_date)

    if day_type != DayType.working:
        resolved_day_order = None
        resolved_override = False
    else:
        if day_order is not None:
            resolved_day_order = day_order
            resolved_override = True if is_manual_override is None else is_manual_override
        else:
            prior = _last_working_day_before(db, the_date)
            resolved_day_order = _next_day_order(prior.day_order) if prior else DAY_ORDER_MIN
            resolved_override = False

    if existing:
        existing.day_type = day_type
        existing.day_order = resolved_day_order
        existing.is_manual_override = resolved_override
        existing.label = label
        existing.notes = notes
        existing.academic_year_id = academic_year_id
        existing.semester_id = semester_id
        existing.created_by_admin_id = actor.id if actor else existing.created_by_admin_id
        day = existing
    else:
        day = CalendarDay(
            date=the_date,
            day_type=day_type,
            day_order=resolved_day_order,
            is_manual_override=resolved_override,
            label=label,
            notes=notes,
            academic_year_id=academic_year_id,
            semester_id=semester_id,
            created_by_admin_id=actor.id if actor else None,
        )
        db.add(day)

    db.flush()
    _resequence_following_days(db, the_date)

    log_audit_event(
        db, actor.id if actor else None, "calendar.mark_day", "calendar_day", day.id,
        {"date": str(the_date), "day_type": day_type.value, "day_order": resolved_day_order},
    )
    db.commit()
    db.refresh(day)
    return day


def bulk_mark_range(
    db: Session,
    actor: User,
    start_date: date,
    end_date: date,
    day_type: DayType,
    label: str | None = None,
    notes: str | None = None,
) -> list[CalendarDay]:
    """Marks every date in [start_date, end_date] inclusive with the same
    non-working day_type — e.g. a week-long Government Holiday block."""
    if day_type == DayType.working:
        raise HTTPException(status_code=400, detail="Bulk-mark is for non-working day types only")

    results = []
    current = start_date
    while current <= end_date:
        results.append(mark_day(db, actor, current, day_type, label=label, notes=notes))
        current += timedelta(days=1)
    return results


def skip_day_order(db: Session, actor: User, the_date: date, skip_to_day_order: int) -> CalendarDay:
    """Deliberately jump the rotation: the_date becomes day_order =
    skip_to_day_order (manual override), and everything after it
    continues counting up from there. Use when a Day Order value should
    be omitted entirely for this cycle (e.g. 3 -> [skip 4] -> 5)."""
    day = get_day(db, the_date)
    if day and day.day_type != DayType.working:
        raise HTTPException(status_code=400, detail="Cannot assign a Day Order to a non-working day")
    return mark_day(db, actor, the_date, DayType.working, day_order=skip_to_day_order, is_manual_override=True,
                     label=day.label if day else None, notes=day.notes if day else None)


def reassign_day_order(db: Session, actor: User, the_date: date, day_order: int) -> CalendarDay:
    """Pin an explicit Day Order for a working date (manual override),
    re-sequencing everything after it."""
    day = get_day(db, the_date)
    if day and day.day_type != DayType.working:
        raise HTTPException(status_code=400, detail="Cannot assign a Day Order to a non-working day")
    return mark_day(db, actor, the_date, DayType.working, day_order=day_order, is_manual_override=True,
                     label=day.label if day else None, notes=day.notes if day else None)


def clear_override(db: Session, actor: User, the_date: date) -> CalendarDay:
    """Releases a manual override so the date rejoins the auto-sequence
    based on its predecessor."""
    day = get_or_404(db, the_date)
    if day.day_type != DayType.working:
        raise HTTPException(status_code=400, detail="Only working days can have Day Order overrides")
    return mark_day(db, actor, the_date, DayType.working, day_order=None, is_manual_override=False)


def delete_day(db: Session, actor: User, the_date: date) -> None:
    day = get_or_404(db, the_date)
    db.delete(day)
    db.flush()
    _resequence_following_days(db, the_date)
    log_audit_event(db, actor.id if actor else None, "calendar.delete_day", "calendar_day", None, {"date": str(the_date)})
    db.commit()


def get_range(db: Session, start: date, end: date) -> list[CalendarDay]:
    return (
        db.query(CalendarDay)
        .filter(CalendarDay.date >= start, CalendarDay.date <= end)
        .order_by(asc(CalendarDay.date))
        .all()
    )


def resolve_by_date(db: Session, the_date: date) -> CalendarDay | None:
    return get_day(db, the_date)


def resolve_dates_for_day_order(db: Session, day_order: int, start: date | None = None, end: date | None = None) -> list[date]:
    q = db.query(CalendarDay).filter(CalendarDay.day_order == day_order, CalendarDay.day_type == DayType.working)
    if start:
        q = q.filter(CalendarDay.date >= start)
    if end:
        q = q.filter(CalendarDay.date <= end)
    return [d.date for d in q.order_by(asc(CalendarDay.date)).all()]


def is_working_day(db: Session, the_date: date) -> bool:
    """The single check every other module (leave, timetable, credit,
    workload, attendance) must call before doing anything with a date.
    A date with no CalendarDay row at all is treated as NOT a working day
    — the calendar must be explicit, never implicit, about what's
    teachable. This is intentionally conservative: an admin who forgets to
    populate the calendar gets hard failures pointing at the gap, rather
    than silently-wrong credit/workload numbers."""
    day = get_day(db, the_date)
    if not day:
        return False
    return day.day_type == DayType.working


def assert_working_day_or_400(db: Session, the_date: date) -> CalendarDay:
    """Raises 400 with a specific reason if the date can't be used for
    timetable / leave / substitute / credit operations. Returns the
    CalendarDay row (guaranteed day_type=working) on success."""
    day = get_day(db, the_date)
    if not day:
        raise HTTPException(
            status_code=400,
            detail=f"{the_date} has no academic calendar entry — mark it as a working day (with a Day Order) before scheduling anything on it",
        )
    if day.day_type != DayType.working:
        raise HTTPException(
            status_code=400,
            detail=f"{the_date} is marked as {day.day_type.value.replace('_', ' ')} — no classes, substitutes, or credits can be scheduled on this date",
        )
    if day.day_order is None:
        # Should be structurally impossible given mark_day, but guard anyway.
        raise HTTPException(status_code=400, detail=f"{the_date} is a working day with no Day Order assigned")
    return day
