from sqlalchemy import Column, Integer, String, Boolean, Float, ForeignKey, Enum, Date, DateTime, func, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import enum

from app.database import Base


class LeaveStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    approved_with_exception = "approved_with_exception"  # policy violation approved by HOD in Advisory mode
    consumed = "consumed"
    rejected = "rejected"
    cancelled = "cancelled"
    draft = "draft"
    expired = "expired"


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
    leave_policy_id = Column(Integer, ForeignKey("leave_policies.id", ondelete="SET NULL"), nullable=True, index=True)
    date = Column(Date, nullable=False)
    day_order = Column(Integer, nullable=False)
    period_number = Column(Integer, nullable=False)  # 1-5
    reason = Column(String(500), nullable=False)
    status = Column(Enum(LeaveStatus, name="leave_status", create_type=False), default=LeaveStatus.pending, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    consumed_at = Column(DateTime(timezone=True), nullable=True)
    batch_id = Column(UUID(as_uuid=True), nullable=True)

    # True when this leave was submitted inside the emergency window (see
    # substitution_service.EMERGENCY_WINDOW_HOURS) — i.e. too close to the
    # affected class for the normal approval delay to be safe.
    is_emergency = Column(Boolean, default=False, nullable=False)
    proposed_substitute_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    document_url = Column(String(500), nullable=True)
    ood_details = Column(JSONB, nullable=True)

    # ── Policy Enforcement Snapshot (immutable after submission) ─────────────
    # Stores a point-in-time record of policy evaluation so historical audits
    # are never recalculated against a changed policy version.
    policy_compliant = Column(Boolean, nullable=True)
    policy_violation = Column(Boolean, nullable=True)
    policy_enforcement_mode = Column(String(20), nullable=True)  # "STRICT" | "ADVISORY" at submission time
    policy_warning_acknowledged = Column(Boolean, default=False, nullable=False)
    policy_warning_acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    policy_evaluation_snapshot = Column(JSONB, nullable=True)   # full PolicyEvaluationResult dict
    policy_version_id = Column(Integer, ForeignKey("leave_policies.id", ondelete="SET NULL"), nullable=True)
    # ── HOD Exception Fields (populated when status = approved_with_exception) ─
    exception_reason = Column(String(500), nullable=True)
    exception_approved_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    exception_approved_at = Column(DateTime(timezone=True), nullable=True)

    teacher = relationship("User", back_populates="leave_requests", foreign_keys=[teacher_id])
    leave_policy = relationship("LeavePolicy", back_populates="leave_requests", foreign_keys=[leave_policy_id])
    proposed_substitute = relationship("User", foreign_keys=[proposed_substitute_id])
    alter_assignment = relationship("AlterAssignment", back_populates="leave_request", uselist=False)
    credit_transactions = relationship("CreditTransaction", back_populates="related_leave")
    exception_approved_by = relationship("User", foreign_keys=[exception_approved_by_id])

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


class PolicyEnforcementAudit(Base):
    """Immutable audit trail for every institution-level enforcement mode toggle.
    Written once at toggle time; never updated or deleted."""
    __tablename__ = "policy_enforcement_audit"

    id = Column(Integer, primary_key=True, index=True)
    actor_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    previous_mode = Column(String(20), nullable=False)   # STRICT | ADVISORY
    new_mode = Column(String(20), nullable=False)         # STRICT | ADVISORY
    reason = Column(String(500), nullable=True)           # optional justification entered by actor
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    actor = relationship("User", foreign_keys=[actor_user_id])
