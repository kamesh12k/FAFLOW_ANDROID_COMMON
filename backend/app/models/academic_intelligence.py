import enum
from sqlalchemy import (
    Column, Integer, String, Date, DateTime, ForeignKey, Enum, Float, func
)
from sqlalchemy.orm import relationship

from app.database import Base


class IntelligenceEventType(str, enum.Enum):
    group_absenteeism = "group_absenteeism"
    attendance_drop = "attendance_drop"
    coverage_issue = "coverage_issue"
    late_submission = "late_submission"
    missed_attendance = "missed_attendance"
    student_shortage = "student_shortage"
    substitution_coverage = "substitution_coverage"
    subject_attendance_pattern = "subject_attendance_pattern"


class IntelligenceEventState(str, enum.Enum):
    active = "active"
    resolved = "resolved"
    acknowledged = "acknowledged"


class IntelligenceSeverity(str, enum.Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    info = "info"


class AcademicIntelligenceEvent(Base):
    """Represents an automated operational or academic alert/event evaluated from campus data."""
    __tablename__ = "academic_intelligence_events"

    id = Column(Integer, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="CASCADE"), nullable=False, index=True)
    class_id = Column(Integer, ForeignKey("classes.id", ondelete="CASCADE"), nullable=True, index=True)
    attendance_session_id = Column(Integer, ForeignKey("attendance_sessions.id", ondelete="SET NULL"), nullable=True, index=True)
    timetable_slot_id = Column(Integer, ForeignKey("timetable_slots.id", ondelete="SET NULL"), nullable=True, index=True)

    event_type = Column(
        Enum(IntelligenceEventType, name="intelligence_event_type", create_type=False),
        nullable=False,
        index=True,
    )
    severity = Column(
        Enum(IntelligenceSeverity, name="intelligence_severity", create_type=False),
        nullable=False,
        default=IntelligenceSeverity.medium,
        index=True,
    )
    state = Column(
        Enum(IntelligenceEventState, name="intelligence_event_state", create_type=False),
        nullable=False,
        default=IntelligenceEventState.active,
        index=True,
    )

    # Unique source key for idempotent upsert/deduplication
    source_key = Column(String(160), unique=True, nullable=False, index=True)

    title = Column(String(255), nullable=False)
    detail = Column(String(1000), nullable=True)

    attendance_percentage = Column(Float, nullable=True)
    absent_count = Column(Integer, nullable=True)
    total_count = Column(Integer, nullable=True)

    relevant_date = Column(Date, nullable=False, index=True)
    period_number = Column(Integer, nullable=True)

    detected_at = Column(DateTime(timezone=True), server_default=func.now())
    last_evaluated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    acknowledged_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    notified_at = Column(DateTime(timezone=True), nullable=True)

    department = relationship("Department")
    class_ = relationship("Class")
    attendance_session = relationship("AttendanceSession")
    timetable_slot = relationship("TimetableSlot")
    acknowledged_by = relationship("User", foreign_keys=[acknowledged_by_id])
