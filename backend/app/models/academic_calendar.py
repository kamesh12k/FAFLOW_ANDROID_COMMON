from sqlalchemy import Column, Integer, String, Date, Boolean, ForeignKey, DateTime, func
from sqlalchemy.orm import relationship

from app.database import Base


class AcademicYear(Base):
    """E.g. "2026-2027". Super Admin creates these as the top-level
    container for Semesters and CalendarDay entries. Kept separate from
    the existing integer `semester` field on Subjects/Classes (which
    already works fine for "which semester is this subject taught in" and
    isn't date-bound) — this table is purely about the calendar/scheduling
    timeline, not curriculum structure."""
    __tablename__ = "academic_years"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(20), nullable=False, unique=True)  # "2026-2027"
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    semesters = relationship("Semester", back_populates="academic_year", cascade="all, delete-orphan")
    calendar_days = relationship("CalendarDay", back_populates="academic_year")


class Semester(Base):
    """A date-bound term within an AcademicYear (e.g. "Odd Semester",
    1 Aug 2026 - 15 Dec 2026). Distinct from the plain integer `semester`
    column on Subjects/Classes (1-8), which denotes curriculum sequence,
    not a calendar period — that field is left untouched so existing
    subject/class data and validation keep working unchanged."""
    __tablename__ = "semesters"

    id = Column(Integer, primary_key=True, index=True)
    academic_year_id = Column(Integer, ForeignKey("academic_years.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(50), nullable=False)  # "Odd Semester", "Semester 1"
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    academic_year = relationship("AcademicYear", back_populates="semesters")
    calendar_days = relationship("CalendarDay", back_populates="semester")
