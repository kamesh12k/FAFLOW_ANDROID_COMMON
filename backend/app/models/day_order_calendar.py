from sqlalchemy import Column, Integer, String, Date, Enum, Boolean, ForeignKey, DateTime, func, UniqueConstraint
from sqlalchemy.orm import relationship
import enum

from app.database import Base


class DayType(str, enum.Enum):
    """What kind of day this calendar date is. `working` is the only type
    that ever carries a day_order, gets a timetable, or feeds workload /
    credit / substitute calculations. Every other type is a "blocked" day
    for those purposes — see CalendarDay.blocks_operations."""
    working = "working"
    holiday = "holiday"
    college_leave = "college_leave"
    government_holiday = "government_holiday"
    exam_day = "exam_day"
    special_event = "special_event"
    department_activity = "department_activity"
    non_working = "non_working"


# Day types that block classes/substitutes/credits/workload/attendance, per
# spec ("No classes... No substitute... No credits... No workload...").
# exam_day and special_event are deliberately included: the spec lists them
# alongside holidays under "Examination Days" / "Special Event Days" as
# calendar entries the Super Admin creates outside the normal teaching
# rotation, and the holiday-blocking rules ("ignore the date" for timetable
# calculations) read as applying to the whole non-working-day family, not
# just the literal `holiday` type. `working` and `department_activity` are
# the only types that keep normal operations — a department activity day
# is explicitly described as something Admin *schedules*, not something
# that cancels the day's classes.
BLOCKING_DAY_TYPES = {
    DayType.holiday,
    DayType.college_leave,
    DayType.government_holiday,
    DayType.exam_day,
    DayType.special_event,
    DayType.non_working,
}


class CalendarDay(Base):
    """One row per calendar date that the institution has touched —
    replaces/extends the old day_order_calendar table. A date with
    day_type='working' and a non-null day_order is a normal teaching day;
    any other day_type means the date is excluded from timetable
    generation, substitute assignment, credit/workload calculation, and
    attendance expectations (see BLOCKING_DAY_TYPES).

    day_order is nullable because holidays/exam days/etc. don't carry one
    — the rotation simply pauses and resumes on the next working day
    (see day_order_service.py for the resequencing logic)."""
    __tablename__ = "calendar_days"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False, unique=True)
    day_type = Column(Enum(DayType, name="day_type", create_type=False), nullable=False, default=DayType.working)
    day_order = Column(Integer, nullable=True)  # 1-6, NULL for non-working days

    academic_year_id = Column(Integer, ForeignKey("academic_years.id", ondelete="SET NULL"), nullable=True)
    semester_id = Column(Integer, ForeignKey("semesters.id", ondelete="SET NULL"), nullable=True)

    # True when an admin has explicitly pinned the day_order for this date
    # (manual override / reassignment), rather than it being auto-derived
    # by the sequencing engine continuing the rotation. Auto-resequencing
    # (e.g. "insert a holiday in the middle of the month") skips locked
    # rows so a manual override survives.
    is_manual_override = Column(Boolean, default=False, nullable=False)

    # Free-text label for special_event / department_activity / exam_day
    # rows (e.g. "Annual Sports Day", "Semester 3 Internal Exam").
    label = Column(String(200), nullable=True)
    notes = Column(String(500), nullable=True)

    created_by_admin_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    academic_year = relationship("AcademicYear", back_populates="calendar_days")
    semester = relationship("Semester", back_populates="calendar_days")

    __table_args__ = (
        UniqueConstraint("date", name="uq_calendar_day_date"),
    )

    @property
    def blocks_operations(self) -> bool:
        """True if this date must be excluded from timetable generation,
        substitute allocation, credit/workload calculation, and attendance
        — i.e. it's anything other than a normal working day."""
        return self.day_type in BLOCKING_DAY_TYPES or self.day_type != DayType.working


# Backwards-compatible alias: existing code/imports referencing the old
# table name continue to resolve to the same model during the migration
# window. New code should import CalendarDay directly.
DayOrderCalendar = CalendarDay
