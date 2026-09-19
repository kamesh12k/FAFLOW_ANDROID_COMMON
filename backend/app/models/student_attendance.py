from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Enum, UniqueConstraint, CheckConstraint, func
from sqlalchemy.orm import relationship
import enum

from app.database import Base


class AttendanceType(str, enum.Enum):
    normal = "normal"
    registered_substitution = "registered_substitution"
    emergency = "emergency"


class SessionStatus(str, enum.Enum):
    not_open = "not_open"
    open = "open"
    submitted = "submitted"
    submitted_late = "submitted_late"
    missed = "missed"
    locked = "locked"
    cancelled = "cancelled"
    not_conducted = "not_conducted"


class StudentAttendanceStatus(str, enum.Enum):
    present = "present"
    absent = "absent"
    late = "late"
    on_duty = "on_duty"
    leave = "leave"
    medical = "medical"


class AttendanceSession(Base):
    """Represents a conducted or scheduled student attendance session for a class, period, and date."""
    __tablename__ = "attendance_sessions"

    id = Column(Integer, primary_key=True, index=True)
    attendance_date = Column(Date, nullable=False, index=True)
    calendar_day_id = Column(Integer, ForeignKey("calendar_days.id", ondelete="SET NULL"), nullable=True)
    timetable_slot_id = Column(Integer, ForeignKey("timetable_slots.id", ondelete="SET NULL"), nullable=True)
    class_id = Column(Integer, ForeignKey("classes.id", ondelete="RESTRICT"), nullable=False, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True, index=True)
    period_number = Column(Integer, nullable=False)
    day_order = Column(Integer, nullable=True)

    scheduled_teacher_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    actual_teacher_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    substitution_id = Column(Integer, ForeignKey("alter_assignments.id", ondelete="SET NULL"), nullable=True)

    attendance_type = Column(
        Enum(AttendanceType, name="student_attendance_type", create_type=False),
        nullable=False,
        default=AttendanceType.normal
    )
    status = Column(
        Enum(SessionStatus, name="student_session_status", create_type=False),
        nullable=False,
        default=SessionStatus.open
    )

    scheduled_start_time = Column(DateTime(timezone=True), nullable=True)
    scheduled_end_time = Column(DateTime(timezone=True), nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    submitted_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    correction_deadline = Column(DateTime(timezone=True), nullable=True)
    idempotency_key = Column(String(100), unique=True, nullable=True, index=True)
    notes = Column(String(500), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    class_ = relationship("Class")
    subject = relationship("Subject")
    timetable_slot = relationship("TimetableSlot")
    scheduled_teacher = relationship("User", foreign_keys=[scheduled_teacher_id])
    actual_teacher = relationship("User", foreign_keys=[actual_teacher_id])
    submitted_by = relationship("User", foreign_keys=[submitted_by_id])
    substitution = relationship("AlterAssignment", foreign_keys=[substitution_id])

    records = relationship("StudentAttendance", back_populates="session", cascade="all, delete-orphan")
    audits = relationship("AttendanceCorrectionAudit", back_populates="session", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("attendance_date", "class_id", "period_number", name="uq_session_date_class_period"),
        CheckConstraint("period_number BETWEEN 1 AND 5", name="chk_session_period_number"),
    )


class StudentAttendance(Base):
    """Individual student attendance mark for a specific session."""
    __tablename__ = "student_attendance"

    id = Column(Integer, primary_key=True, index=True)
    attendance_session_id = Column(Integer, ForeignKey("attendance_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(
        Enum(StudentAttendanceStatus, name="student_attendance_status", create_type=False),
        nullable=False,
        default=StudentAttendanceStatus.present
    )
    marked_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    session = relationship("AttendanceSession", back_populates="records")
    student = relationship("Student", back_populates="attendance_records")

    __table_args__ = (
        UniqueConstraint("attendance_session_id", "student_id", name="uq_session_student"),
    )


class AttendanceCorrectionAudit(Base):
    """Immutable audit trail for student attendance status changes made during or after correction windows."""
    __tablename__ = "attendance_correction_audits"

    id = Column(Integer, primary_key=True, index=True)
    attendance_session_id = Column(Integer, ForeignKey("attendance_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=True, index=True)
    old_status = Column(String(50), nullable=False)
    new_status = Column(String(50), nullable=False)
    changed_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reason = Column(String(500), nullable=True)
    device_id = Column(String(100), nullable=True)
    changed_at = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("AttendanceSession", back_populates="audits")
    student = relationship("Student")
    changed_by = relationship("User")
