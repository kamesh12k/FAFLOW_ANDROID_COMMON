from datetime import date
from sqlalchemy.orm import Session

from app.models.day_order_calendar import CalendarDay, DayType
from app.schemas.academic_calendar import (
    WorkingDayReportEntry, HolidayReportEntry, DayOrderReportEntry,
)


def working_day_report(db: Session, start: date, end: date) -> list[WorkingDayReportEntry]:
    days = (
        db.query(CalendarDay)
        .filter(CalendarDay.date >= start, CalendarDay.date <= end)
        .order_by(CalendarDay.date)
        .all()
    )
    return [
        WorkingDayReportEntry(date=d.date, day_order=d.day_order, is_working=(d.day_type == DayType.working))
        for d in days
    ]


def holiday_report(db: Session, start: date, end: date) -> list[HolidayReportEntry]:
    days = (
        db.query(CalendarDay)
        .filter(CalendarDay.date >= start, CalendarDay.date <= end, CalendarDay.day_type != DayType.working)
        .order_by(CalendarDay.date)
        .all()
    )
    return [HolidayReportEntry(date=d.date, day_type=d.day_type, label=d.label) for d in days]


def day_order_report(db: Session, start: date, end: date) -> list[DayOrderReportEntry]:
    days = (
        db.query(CalendarDay)
        .filter(
            CalendarDay.date >= start,
            CalendarDay.date <= end,
            CalendarDay.day_type == DayType.working,
            CalendarDay.day_order.isnot(None),
        )
        .order_by(CalendarDay.date)
        .all()
    )
    grouped: dict[int, list[date]] = {}
    for d in days:
        grouped.setdefault(d.day_order, []).append(d.date)

    return [
        DayOrderReportEntry(day_order=do, occurrences=len(dates), dates=dates)
        for do, dates in sorted(grouped.items())
    ]
