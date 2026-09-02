from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, Enum, Date, DateTime, Text, func
from sqlalchemy.orm import relationship
import enum

from app.database import Base


class StaffLeaveType(str, enum.Enum):
    casual = "casual"
    medical = "medical"
    earned = "earned"
    on_duty = "on_duty"
    compensatory_off = "compensatory_off"
    other = "other"


class StaffLeaveStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    cancelled = "cancelled"


class StaffLeaveRequest(Base):
    __tablename__ = "staff_leave_requests"

    id = Column(Integer, primary_key=True, index=True)
    staff_id = Column(Integer, ForeignKey("operational_staff.id", ondelete="CASCADE"), nullable=False, index=True)
    start_date = Column(Date, nullable=False, index=True)
    end_date = Column(Date, nullable=False, index=True)
    leave_type = Column(String(50), default="casual", nullable=False)
    is_half_day = Column(Boolean, default=False, nullable=False)
    half_day_session = Column(String(20), nullable=True)  # 'forenoon', 'afternoon'
    days_count = Column(Float, default=1.0, nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(String(20), default="pending", nullable=False, index=True)
    approved_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approval_remarks = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    staff = relationship("OperationalStaff", foreign_keys=[staff_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])
    credit_transactions = relationship("StaffCreditTransaction", back_populates="related_leave")


class StaffCredit(Base):
    __tablename__ = "staff_credits"

    id = Column(Integer, primary_key=True, index=True)
    staff_id = Column(Integer, ForeignKey("operational_staff.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    annual_quota = Column(Float, default=12.0, nullable=False)
    balance = Column(Float, default=12.0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    staff = relationship("OperationalStaff", foreign_keys=[staff_id])



class StaffCreditTransaction(Base):
    __tablename__ = "staff_credit_transactions"

    id = Column(Integer, primary_key=True, index=True)
    staff_id = Column(Integer, ForeignKey("operational_staff.id", ondelete="CASCADE"), nullable=False, index=True)
    change = Column(Float, nullable=False)  # e.g. -1.0, +1.0
    balance_after = Column(Float, nullable=False)
    category = Column(String(50), default="manual_adjustment", nullable=False)
    reason = Column(Text, nullable=False)
    related_leave_id = Column(Integer, ForeignKey("staff_leave_requests.id", ondelete="SET NULL"), nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    staff = relationship("OperationalStaff", foreign_keys=[staff_id])
    related_leave = relationship("StaffLeaveRequest", back_populates="credit_transactions")
    created_by = relationship("User", foreign_keys=[created_by_user_id])
