from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, Text, func, UniqueConstraint
from sqlalchemy.orm import relationship
import enum

from app.database import Base


class LeaveBalanceTransactionType(str, enum.Enum):
    OPENING_BALANCE = "OPENING_BALANCE"
    CONSUMED = "CONSUMED"
    REVERSAL = "REVERSAL"
    ADMIN_ADJUSTMENT = "ADMIN_ADJUSTMENT"
    POLICY_ALLOCATION = "POLICY_ALLOCATION"
    POLICY_RESET = "POLICY_RESET"


class LeavePolicy(Base):
    __tablename__ = "leave_policies"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), unique=True, nullable=False, index=True)  # AL, IL, ML, WL, VL, OOD
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    entitlement = Column(Float, nullable=False)  # e.g. 12.0
    period = Column(String(20), default="YEAR", nullable=False)  # YEAR, SEMESTER, PER_EVENT
    monthly_limit = Column(Float, nullable=True)  # e.g. 1.0 for AL
    semester_limit = Column(Float, nullable=True)  # e.g. 2.0 for IL
    annual_limit = Column(Float, nullable=True)
    approval_required = Column(Boolean, default=True, nullable=False)
    document_required = Column(Boolean, default=False, nullable=False)
    is_on_duty = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    # Rule-level enforcement override:
    # "ADVISORY"      = follows the institution-level policy_enforcement_mode (default)
    # "STRICT"        = always blocks regardless of institution Advisory mode
    # "INFORMATIONAL" = never blocks, only logs and warns
    advisory_allowed = Column(String(20), default="ADVISORY", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    balances = relationship("TeacherLeaveBalance", back_populates="policy")
    transactions = relationship("LeaveBalanceTransaction", back_populates="policy")
    leave_requests = relationship("LeaveRequest", back_populates="leave_policy", foreign_keys="[LeaveRequest.leave_policy_id]")


class TeacherLeaveBalance(Base):
    __tablename__ = "teacher_leave_balances"

    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    leave_policy_id = Column(Integer, ForeignKey("leave_policies.id", ondelete="RESTRICT"), nullable=False, index=True)
    academic_year = Column(String(20), nullable=False)  # e.g. '2026-2027'
    entitlement = Column(Float, nullable=False)
    consumed = Column(Float, default=0.0, nullable=False)
    remaining = Column(Float, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    teacher = relationship("User", foreign_keys=[teacher_id])
    policy = relationship("LeavePolicy", back_populates="balances")

    __table_args__ = (
        UniqueConstraint("teacher_id", "leave_policy_id", "academic_year", name="uq_teacher_policy_year"),
    )


class LeaveBalanceTransaction(Base):
    __tablename__ = "leave_balance_transactions"

    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    leave_policy_id = Column(Integer, ForeignKey("leave_policies.id", ondelete="RESTRICT"), nullable=False, index=True)
    leave_request_id = Column(Integer, ForeignKey("leave_requests.id", ondelete="SET NULL"), nullable=True, index=True)
    transaction_type = Column(String(50), nullable=False)  # e.g. 'CONSUMED', 'REVERSAL', 'ADMIN_ADJUSTMENT'
    days = Column(Float, nullable=False)  # e.g. -1.0, +1.0
    balance_before = Column(Float, nullable=False)
    balance_after = Column(Float, nullable=False)
    reason = Column(Text, nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    teacher = relationship("User", foreign_keys=[teacher_id])
    policy = relationship("LeavePolicy", back_populates="transactions")
    leave_request = relationship("LeaveRequest", foreign_keys=[leave_request_id])
    created_by = relationship("User", foreign_keys=[created_by_id])
