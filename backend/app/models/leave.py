from sqlalchemy import Column, Integer, String, Boolean, Float, ForeignKey, Enum, Date, DateTime, func, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum

from app.database import Base


class LeaveStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    cancelled = "cancelled"


class AssignmentType(str, enum.Enum):
    """How a substitute ended up assigned to this leave — drives the
    color-coded badge in the substitution dashboard and lets the
    autonomous engine distinguish "I can safely re-decide this" (auto_*)
    from "a human already made this call" (admin_assigned, overridden)."""
    auto_assigned = "auto_assigned"             # Autonomous mode, zero clicks
    faculty_recommended = "faculty_recommended"  # Assisted mode, admin clicked Approve on a ranked suggestion
    admin_assigned = "admin_assigned"            # Admin picked manually, not from the ranked list
    auto_swapped = "auto_swapped"                 # Self-healing engine re-routed an existing assignment
    overridden = "overridden"                     # Admin replaced an existing (often auto) assignment
    emergency = "emergency"                       # Leave submitted inside the emergency window
    teacher_assigned = "teacher_assigned"         # Teacher self-assigned substitute in teacher_mode
    combined_class = "combined_class"             # Class combined/merged with another parallel active class



class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False)
    day_order = Column(Integer, nullable=False)
    period_number = Column(Integer, nullable=False)  # 1-5
    reason = Column(String(500), nullable=False)
    status = Column(Enum(LeaveStatus, name="leave_status", create_type=False), default=LeaveStatus.pending, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    batch_id = Column(UUID(as_uuid=True), nullable=True)

    # True when this leave was submitted inside the emergency window (see
    # substitution_service.EMERGENCY_WINDOW_HOURS) — i.e. too close to the
    # affected class for the normal approval delay to be safe. Computed
    # once at submission time and stored, rather than recalculated later,
    # because "how close to class was this submitted" should reflect the
    # moment of submission even if someone looks at the record days after.
    is_emergency = Column(Boolean, default=False, nullable=False)

    teacher = relationship("User", back_populates="leave_requests", foreign_keys=[teacher_id])
    alter_assignment = relationship("AlterAssignment", back_populates="leave_request", uselist=False)
    credit_transactions = relationship("CreditTransaction", back_populates="related_leave")

    __table_args__ = (
        CheckConstraint("period_number BETWEEN 1 AND 5", name="chk_leave_period_number"),
    )


class AlterAssignment(Base):
    __tablename__ = "alter_assignments"

    id = Column(Integer, primary_key=True, index=True)
    leave_request_id = Column(Integer, ForeignKey("leave_requests.id", ondelete="CASCADE"), unique=True, nullable=False)
    substitute_teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_at = Column(DateTime(timezone=True), server_default=func.now())

    # How this assignment came to be (see AssignmentType) — purely
    # descriptive, never read by eligibility logic.
    assignment_type = Column(Enum(AssignmentType, name="assignment_type", create_type=False), default=AssignmentType.admin_assigned, nullable=False)

    # The recommendation engine's compatibility score (0-100) for this
    # substitute at the moment they were assigned, or NULL for a manual
    # admin pick that didn't go through scoring at all. Kept as a
    # historical snapshot — re-running the scorer later for the same
    # leave could legitimately produce a different number (workload and
    # fairness shift over time), and the dashboard should show what the
    # system actually based its decision on, not a number computed after
    # the fact.
    compatibility_score = Column(Float, nullable=True)

    # Locked assignments are never touched by the autonomous engine (no
    # auto-swap, no self-healing re-routing) — see substitution_service
    # for every write path's lock check. An admin can still manually
    # override a locked assignment; the lock only blocks the *autonomous*
    # engine, never the admin's own authority.
    is_locked = Column(Boolean, default=False, nullable=False)

    leave_request = relationship("LeaveRequest", back_populates="alter_assignment")
    substitute = relationship("User", back_populates="alter_assignments", foreign_keys=[substitute_teacher_id])
