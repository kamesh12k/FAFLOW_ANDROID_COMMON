from pydantic import BaseModel, field_validator, model_validator
import datetime as dt
from datetime import date, datetime
from typing import Optional

from app.models.day_order_calendar import DayType
from app.schemas.validators import validate_day_order


# ---------- Academic Year ----------

class AcademicYearCreate(BaseModel):
    name: str  # "2026-2027"
    start_date: date
    end_date: date

    @model_validator(mode="after")
    def validate_range(self):
        if self.end_date <= self.start_date:
            raise ValueError("end_date must be after start_date")
        return self


class AcademicYearOut(BaseModel):
    id: int
    name: str
    start_date: date
    end_date: date
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------- Semester ----------

class SemesterCreate(BaseModel):
    academic_year_id: int
    name: str
    start_date: date
    end_date: date

    @model_validator(mode="after")
    def validate_range(self):
        if self.end_date <= self.start_date:
            raise ValueError("end_date must be after start_date")
        return self


class SemesterOut(BaseModel):
    id: int
    academic_year_id: int
    name: str
    start_date: date
    end_date: date
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------- Calendar Day (holiday / exam / event / working+day-order) ----------

class CalendarDayMark(BaseModel):
    """Marks a single date with a day_type. For day_type='working', a
    day_order may optionally be supplied (manual override); otherwise the
    sequencing engine assigns/continues it automatically. For any other
    day_type, day_order is ignored even if supplied — non-working days
    structurally cannot carry one."""
    date: date
    day_type: DayType
    day_order: int | None = None
    label: str | None = None
    notes: str | None = None
    academic_year_id: int | None = None
    semester_id: int | None = None

    @field_validator("day_order")
    @classmethod
    def validate_day_order_range(cls, v: int | None) -> int | None:
        if v is not None:
            validate_day_order(v)
        return v


class CalendarDayBulkMark(BaseModel):
    """For marking a contiguous range the same way in one call (e.g. a
    week-long government holiday)."""
    start_date: date
    end_date: date
    day_type: DayType
    label: str | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def validate_range(self):
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        if self.day_type == DayType.working:
            raise ValueError("Bulk-mark is for non-working day types; set working days individually via day-order assignment")
        return self


class DayOrderAssign(BaseModel):
    """Explicit Day Order assignment/override for a single working date."""
    date: date
    day_order: int

    @field_validator("day_order")
    @classmethod
    def validate_day_order_range(cls, v: int) -> int:
        return validate_day_order(v)


class DayOrderSkip(BaseModel):
    """Skip a specific day_order value for a date range — e.g. the
    rotation jumps from 3 straight to 5, deliberately omitting 4."""
    date: date
    skip_to_day_order: int

    @field_validator("skip_to_day_order")
    @classmethod
    def validate_range(cls, v: int) -> int:
        return validate_day_order(v)


class CalendarDayOut(BaseModel):
    id: int
    date: date
    day_type: DayType
    day_order: int | None
    academic_year_id: int | None
    semester_id: int | None
    is_manual_override: bool
    label: str | None
    notes: str | None
    blocks_operations: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CalendarRangeQuery(BaseModel):
    start: date
    end: date


class DayOrderResolveResult(BaseModel):
    """Response for 'resolve(date) -> day_order' or 'resolve(day_order,
    range) -> dates' lookups used by leave/timetable forms.

    NOTE: Uses Optional[date] instead of 'date | None = None' to avoid
    a Python class-body name-shadowing bug where the field name 'date'
    (with = None default) would shadow the imported 'date' type before
    the annotation is evaluated, causing TypeError at import time.
    """
    date: dt.date | None = None
    day_order: int | None = None
    day_type: DayType
    blocks_operations: bool


# ---------- Reports ----------

class WorkingDayReportEntry(BaseModel):
    date: date
    day_order: int | None
    is_working: bool


class HolidayReportEntry(BaseModel):
    date: date
    day_type: DayType
    label: str | None


class DayOrderReportEntry(BaseModel):
    day_order: int
    occurrences: int
    dates: list[date]


class FacultyWorkloadReportEntry(BaseModel):
    teacher_id: int
    name: str
    department: str | None
    total_periods: int
    working_days_counted: int
    credit_balance: int


# ---------- Today / Home summary ----------

class UpcomingNonWorkingDay(BaseModel):
    """A holiday/exam/etc. coming up within the lookahead window — powers
    the 'upcoming holiday' reminder on the Home screen."""
    date: date
    day_type: DayType
    label: str | None
    days_away: int


class TeacherOnLeaveToday(BaseModel):
    teacher_id: int
    name: str
    department: str | None
    period_number: int
    has_substitute: bool
    substitute_name: str | None = None


class TodaySummary(BaseModel):
    """Single call powering the admin Home screen's 'Today' card: what
    kind of day it is, who's out, what's pending, and what's coming up."""
    date: date
    day_type: DayType
    day_order: int | None
    blocks_operations: bool
    teachers_on_leave: list[TeacherOnLeaveToday]
    pending_leave_count: int
    upcoming_non_working_days: list[UpcomingNonWorkingDay]
    teachers_on_leave_count: int | None = None
    leave_periods_count: int | None = None
    pending_faculty_count: int | None = None
    pending_periods_count: int | None = None


class TeacherTodaySummary(BaseModel):
    """Teacher-scoped equivalent: what kind of day it is, whether they
    personally are on leave today, and what's coming up. Deliberately
    excludes other teachers' leave details."""
    date: date
    day_type: DayType
    day_order: int | None
    blocks_operations: bool
    is_on_leave_today: bool
    periods_today: int
    upcoming_non_working_days: list[UpcomingNonWorkingDay]