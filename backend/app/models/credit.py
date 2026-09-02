from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, func
from sqlalchemy.orm import relationship

from app.database import Base


class TeacherCredit(Base):
    __tablename__ = "teacher_credits"

    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    balance = Column(Integer, default=0, nullable=False)

    teacher = relationship("User", back_populates="credit_balance")


# Valid transaction category values (kept as plain strings so no Enum migration is needed)
# substitute_class | manual_adjustment | exam_duty | department_duty
# workshop | event_coordination | penalty | correction | other
CREDIT_CATEGORIES = [
    "substitute_class",
    "manual_adjustment",
    "exam_duty",
    "department_duty",
    "workshop",
    "event_coordination",
    "penalty",
    "correction",
    "other",
]


class CreditTransaction(Base):
    __tablename__ = "credit_transactions"

    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    change = Column(Integer, nullable=False)  # +1 or -1
    reason = Column(String(255), nullable=False)
    # Structured category — one of CREDIT_CATEGORIES; nullable for legacy rows
    category = Column(String(50), nullable=True, default="other")
    related_leave_id = Column(Integer, ForeignKey("leave_requests.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    teacher = relationship("User", back_populates="credit_transactions")
    related_leave = relationship("LeaveRequest", back_populates="credit_transactions")
