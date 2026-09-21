import enum
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, Date, Time, DateTime,
    ForeignKey, Float, func, UniqueConstraint, Enum as SAEnum
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.database import Base


class DutyType(str, enum.Enum):
    DISCIPLINE_DUTY = "DISCIPLINE_DUTY"
    WING_DUTY = "WING_DUTY"
    EXAM_DUTY = "EXAM_DUTY"
    SPECIAL_DUTY = "SPECIAL_DUTY"


class DutyStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class AssignmentStatus(str, enum.Enum):
    PROPOSED = "PROPOSED"
    ASSIGNED = "ASSIGNED"
    OVERRIDDEN = "OVERRIDDEN"
    REPLACED = "REPLACED"
    CANCELLED = "CANCELLED"
    COMPLETED = "COMPLETED"


class CampusArea(Base):
    """Configurable campus areas/zones for Wing Duty, Discipline supervision, or Exam halls."""
    __tablename__ = "campus_areas"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    code = Column(String(50), nullable=False, unique=True, index=True)
    duty_type = Column(String(50), nullable=False, default=DutyType.WING_DUTY.value)
    building_or_block = Column(String(100), nullable=True)
    floor = Column(String(50), nullable=True)
    required_teachers = Column(Integer, nullable=False, default=1)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    department = relationship("Department", foreign_keys=[department_id])
    duties = relationship("CampusDuty", back_populates="area")


class DutyBreakPeriod(Base):
    """Configurable campus break/interval periods (Interval, Lunch, Dispersal, etc.)
    used to dynamically generate discipline and corridor duties."""
    __tablename__ = "duty_break_periods"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    duty_type = Column(String(50), nullable=False, default=DutyType.DISCIPLINE_DUTY.value)
    required_teachers = Column(Integer, nullable=False, default=3)
    min_teachers = Column(Integer, nullable=False, default=1)
    max_teachers = Column(Integer, nullable=False, default=10)
    # The timetable period number ending immediately before this break (e.g. P2 before interval, P3 before lunch)
    preceding_period_number = Column(Integer, nullable=True)
    # Comma-separated or JSON string of applicable Day Orders (e.g. "1,2,3,4,5,6")
    applicable_day_orders = Column(String(100), nullable=False, default="1,2,3,4,5,6")
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="CASCADE"), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    department = relationship("Department", foreign_keys=[department_id])
    duties = relationship("CampusDuty", back_populates="break_period")


class CampusDuty(Base):
    """Authoritative campus duty instance (Discipline, Wing, Exam, or Special)."""
    __tablename__ = "campus_duties"

    id = Column(Integer, primary_key=True, index=True)
    duty_type = Column(SAEnum(DutyType, name="duty_type", native_enum=False), nullable=False, index=True)
    title = Column(String(150), nullable=False)
    duty_date = Column(Date, nullable=False, index=True)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)

    break_period_id = Column(Integer, ForeignKey("duty_break_periods.id", ondelete="SET NULL"), nullable=True)
    area_id = Column(Integer, ForeignKey("campus_areas.id", ondelete="SET NULL"), nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="CASCADE"), nullable=True)
    day_order = Column(Integer, nullable=True)
    required_teachers = Column(Integer, nullable=False, default=1)

    status = Column(SAEnum(DutyStatus, name="duty_status", native_enum=False), nullable=False, default=DutyStatus.PUBLISHED, index=True)
    is_locked = Column(Boolean, nullable=False, default=False)
    locked_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    locked_at = Column(DateTime(timezone=True), nullable=True)
    lock_reason = Column(String(255), nullable=True)

    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    break_period = relationship("DutyBreakPeriod", back_populates="duties")
    area = relationship("CampusArea", back_populates="duties")
    department = relationship("Department", foreign_keys=[department_id])
    locked_by_user = relationship("User", foreign_keys=[locked_by_user_id])
    created_by_user = relationship("User", foreign_keys=[created_by_user_id])
    assignments = relationship("DutyAssignment", back_populates="duty", cascade="all, delete-orphan")


class DutyAssignment(Base):
    """Faculty assignment to a specific CampusDuty."""
    __tablename__ = "duty_assignments"

    id = Column(Integer, primary_key=True, index=True)
    duty_id = Column(Integer, ForeignKey("campus_duties.id", ondelete="CASCADE"), nullable=False, index=True)
    teacher_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(SAEnum(AssignmentStatus, name="assignment_status", native_enum=False), nullable=False, default=AssignmentStatus.ASSIGNED, index=True)
    role = Column(String(50), nullable=False, default="GENERAL")  # SUPERVISOR, INVIGILATOR, RELIEF, GENERAL

    assigned_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    is_manual = Column(Boolean, nullable=False, default=False)
    is_locked = Column(Boolean, nullable=False, default=False)
    selection_reason = Column(JSONB, nullable=True)  # List of explainability strings
    score = Column(Float, nullable=True)

    overridden_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    overridden_reason = Column(String(255), nullable=True)

    replaced_assignment_id = Column(Integer, ForeignKey("duty_assignments.id", ondelete="SET NULL"), nullable=True)
    replacement_reason = Column(String(255), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    duty = relationship("CampusDuty", back_populates="assignments")
    teacher = relationship("User", foreign_keys=[teacher_id])
    assigned_by_user = relationship("User", foreign_keys=[assigned_by_user_id])
    overridden_by_user = relationship("User", foreign_keys=[overridden_by_user_id])


class DutyAssignmentRun(Base):
    """Audit log of an automatic assignment engine batch execution."""
    __tablename__ = "duty_assignment_runs"

    id = Column(Integer, primary_key=True, index=True)
    run_date = Column(Date, nullable=False, index=True)
    duty_type = Column(String(50), nullable=False)
    triggered_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    total_duties = Column(Integer, nullable=False, default=0)
    total_assigned = Column(Integer, nullable=False, default=0)
    total_unfilled = Column(Integer, nullable=False, default=0)
    details = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    triggered_by_user = relationship("User", foreign_keys=[triggered_by_user_id])
