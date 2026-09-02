from datetime import date
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import require_admin, require_super_admin, get_current_user, require_teacher, get_tenant_department_id
from app.models.user import User
from app.models.day_order_calendar import DayType
from app.schemas.academic_calendar import (
    AcademicYearCreate, AcademicYearOut, SemesterCreate, SemesterOut,
    CalendarDayMark, CalendarDayBulkMark, DayOrderAssign, DayOrderSkip,
    CalendarDayOut, DayOrderResolveResult,
    WorkingDayReportEntry, HolidayReportEntry, DayOrderReportEntry,
    FacultyWorkloadReportEntry, TodaySummary, TeacherTodaySummary,
)
from app.services import academic_calendar_service, day_order_service, report_service, credit_service, summary_service

router = APIRouter(prefix="/academic-calendar", tags=["Academic Calendar"])


def _serialize_day(day) -> dict:
    return {
        "id": day.id,
        "date": day.date,
        "day_type": day.day_type,
        "day_order": day.day_order,
        "academic_year_id": day.academic_year_id,
        "semester_id": day.semester_id,
        "is_manual_override": day.is_manual_override,
        "label": day.label,
        "notes": day.notes,
        "blocks_operations": day.blocks_operations,
        "created_at": day.created_at,
        "updated_at": day.updated_at,
    }


# ---------- Academic Years ----------

@router.get("/academic-years", response_model=list[AcademicYearOut])
def list_academic_years(_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return academic_calendar_service.list_academic_years(db)


@router.post("/academic-years", response_model=AcademicYearOut, status_code=201)
def create_academic_year(
    data: AcademicYearCreate,
    super_admin: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    return academic_calendar_service.create_academic_year(data, super_admin, db)


# ---------- Semesters ----------

@router.get("/semesters", response_model=list[SemesterOut])
def list_semesters(
    academic_year_id: int | None = Query(default=None),
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return academic_calendar_service.list_semesters(db, academic_year_id)


@router.post("/semesters", response_model=SemesterOut, status_code=201)
def create_semester(
    data: SemesterCreate,
    super_admin: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    return academic_calendar_service.create_semester(data, super_admin, db)


# ---------- Calendar Days: holiday marking + day order assignment ----------

@router.get("/days", response_model=list[CalendarDayOut])
def get_calendar_range(
    start: date = Query(...),
    end: date = Query(...),
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Powers the Monthly Calendar View / Day Order View / Holiday View —
    one endpoint, filter client-side by day_type if needed."""
    days = day_order_service.get_range(db, start, end)
    return [CalendarDayOut(**_serialize_day(d)) for d in days]


@router.get("/days/{the_date}", response_model=CalendarDayOut)
def get_calendar_day(
    the_date: date,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    day = day_order_service.get_or_404(db, the_date)
    return CalendarDayOut(**_serialize_day(day))


@router.post("/days/mark", response_model=CalendarDayOut, status_code=201)
def mark_day(
    data: CalendarDayMark,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Single entry point for: Working Days, Holidays, College Leave Days,
    Government Holidays, Examination Days, Special Event Days, and
    Department Activity Days — distinguished by day_type."""
    day = day_order_service.mark_day(
        db, admin, data.date, data.day_type,
        day_order=data.day_order, label=data.label, notes=data.notes,
        academic_year_id=data.academic_year_id, semester_id=data.semester_id,
    )
    return CalendarDayOut(**_serialize_day(day))


@router.post("/days/bulk-mark", response_model=list[CalendarDayOut], status_code=201)
def bulk_mark_days(
    data: CalendarDayBulkMark,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Mark a contiguous date range with the same non-working day_type in
    one call — e.g. a week of Government Holiday."""
    days = day_order_service.bulk_mark_range(db, admin, data.start_date, data.end_date, data.day_type, data.label, data.notes)
    return [CalendarDayOut(**_serialize_day(d)) for d in days]


@router.post("/days/day-order/assign", response_model=CalendarDayOut)
def assign_day_order(
    data: DayOrderAssign,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Assign or reassign an explicit Day Order for a date (manual
    override) — subsequent dates auto-resequence from this value."""
    day = day_order_service.reassign_day_order(db, admin, data.date, data.day_order)
    return CalendarDayOut(**_serialize_day(day))


@router.post("/days/day-order/skip", response_model=CalendarDayOut)
def skip_day_order(
    data: DayOrderSkip,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Deliberately skip ahead in the rotation (e.g. 3 -> [skip 4] -> 5)."""
    day = day_order_service.skip_day_order(db, admin, data.date, data.skip_to_day_order)
    return CalendarDayOut(**_serialize_day(day))


@router.delete("/days/{the_date}/override", response_model=CalendarDayOut)
def clear_override(
    the_date: date,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Releases a manual Day Order override so the date rejoins the
    auto-sequence based on its predecessor."""
    day = day_order_service.clear_override(db, admin, the_date)
    return CalendarDayOut(**_serialize_day(day))


@router.delete("/days/{the_date}", status_code=204)
def delete_calendar_day(
    the_date: date,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    day_order_service.delete_day(db, admin, the_date)


# ---------- Resolve (used by leave/timetable forms) ----------

@router.get("/resolve", response_model=DayOrderResolveResult)
def resolve(
    date_: date | None = Query(default=None, alias="date"),
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """date -> {day_order, day_type, blocks_operations}, the calendar
    lookup leave/timetable forms call before submitting."""
    if date_ is None:
        raise HTTPException(status_code=400, detail="Provide a 'date' query parameter")

    day = day_order_service.resolve_by_date(db, date_)
    if not day:
        return DayOrderResolveResult(date=date_, day_order=None, day_type=DayType.non_working, blocks_operations=True)
    return DayOrderResolveResult(date=day.date, day_order=day.day_order, day_type=day.day_type, blocks_operations=day.blocks_operations)


# ---------- Today / Home summary ----------

@router.get("/today-summary", response_model=TodaySummary)
def today_summary(
    date_: date | None = Query(default=None, alias="date"),
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    """Powers the admin Home screen's single 'Today' card. Defaults to the
    server's current date; accepts an explicit date for testing/demo."""
    target = date_ or date.today()
    return summary_service.get_today_summary(db, target, tenant_department_id)


@router.get("/my-today-summary", response_model=TeacherTodaySummary)
def my_today_summary(
    date_: date | None = Query(default=None, alias="date"),
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """Teacher-scoped equivalent of /today-summary — only the calling
    teacher's own leave status, never another teacher's."""
    target = date_ or date.today()
    return summary_service.get_teacher_today_summary(db, teacher.id, target)


# ---------- Reports ----------

@router.get("/reports/working-days", response_model=list[WorkingDayReportEntry])
def working_day_report(
    start: date = Query(...), end: date = Query(...),
    _admin: User = Depends(require_admin), db: Session = Depends(get_db),
):
    return report_service.working_day_report(db, start, end)


@router.get("/reports/holidays", response_model=list[HolidayReportEntry])
def holiday_report(
    start: date = Query(...), end: date = Query(...),
    _admin: User = Depends(require_admin), db: Session = Depends(get_db),
):
    return report_service.holiday_report(db, start, end)


@router.get("/reports/day-orders", response_model=list[DayOrderReportEntry])
def day_order_report(
    start: date = Query(...), end: date = Query(...),
    _admin: User = Depends(require_admin), db: Session = Depends(get_db),
):
    return report_service.day_order_report(db, start, end)


@router.get("/reports/faculty-workload", response_model=list[FacultyWorkloadReportEntry])
def faculty_workload_report(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    """Per spec: workload excluding holidays — see credit_service for the
    exclusion logic (only Day-Order occurrences that landed on an actual
    working day count toward a teacher's total)."""
    return credit_service.get_faculty_workload_report(db, tenant_department_id)
