from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint, CheckConstraint
from sqlalchemy.orm import relationship

from app.database import Base


class TimetableSlot(Base):
    __tablename__ = "timetable_slots"

    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True)
    class_id = Column(Integer, ForeignKey("classes.id", ondelete="RESTRICT"), nullable=False)
    room_id = Column(Integer, ForeignKey("rooms.id", ondelete="SET NULL"), nullable=True)
    day_order = Column(Integer, nullable=False)
    period_number = Column(Integer, nullable=False)  # 1-5 (five periods/day per spec)

    teacher = relationship("User", back_populates="timetable_slots")
    subject = relationship("Subject")
    class_ = relationship("Class")
    room = relationship("Room")

    __table_args__ = (
        UniqueConstraint("teacher_id", "class_id", "day_order", "period_number", name="uq_teacher_class_day_period"),
        CheckConstraint("day_order BETWEEN 1 AND 6", name="chk_timetable_day_order"),
        CheckConstraint("period_number BETWEEN 1 AND 5", name="chk_timetable_period_number"),
    )

