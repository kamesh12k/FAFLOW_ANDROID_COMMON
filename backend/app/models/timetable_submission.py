import enum

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, func
from sqlalchemy.orm import relationship

from app.database import Base


class TimetableSubmissionStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    withdrawn = "withdrawn"


class TimetableSubmission(Base):
    """A teacher-proposed timetable entry; it never becomes official until approved."""
    __tablename__ = "timetable_submissions"

    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True)
    class_id = Column(Integer, ForeignKey("classes.id", ondelete="RESTRICT"), nullable=False)
    room_id = Column(Integer, ForeignKey("rooms.id", ondelete="SET NULL"), nullable=True)
    day_order = Column(Integer, nullable=False)
    period_number = Column(Integer, nullable=False)
    status = Column(Enum(TimetableSubmissionStatus, name="timetable_submission_status", create_type=False), nullable=False, default=TimetableSubmissionStatus.pending)
    review_note = Column(String(500), nullable=True)
    reviewed_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    teacher = relationship("User", foreign_keys=[teacher_id])
    subject = relationship("Subject")
    class_ = relationship("Class")
    room = relationship("Room")
