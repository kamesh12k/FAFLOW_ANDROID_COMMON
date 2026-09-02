from sqlalchemy import Column, Integer, Boolean, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base


class SubstitutionPreference(Base):
    """One row per teacher, created lazily on first access (see
    substitution_service.get_or_create_preferences) rather than at account
    creation — most teachers never touch this screen, so there's no value
    in forcing a row to exist before anyone has an opinion to record.

    Read by both the recommendation engine (scoring candidates) and the
    autonomous executor (hard eligibility — a teacher who has opted out of
    auto-assignment, or who is already at their weekly cap, is never
    auto-assigned regardless of how well they score)."""
    __tablename__ = "substitution_preferences"

    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)

    # Hard eligibility gates — checked before a teacher is ever assigned,
    # not just used as scoring inputs.
    accept_auto_assignments = Column(Boolean, default=True, nullable=False)
    allow_emergency_assignments = Column(Boolean, default=True, nullable=False)
    max_weekly_substitutions = Column(Integer, nullable=True)  # NULL = no cap

    # Soft preferences — scoring inputs only, never block an assignment on
    # their own (a teacher who "prefers mornings" is still eligible for an
    # afternoon class if nothing else works out).
    prefer_morning_classes = Column(Boolean, default=False, nullable=False)
    prefer_same_department = Column(Boolean, default=True, nullable=False)

    # Hard eligibility gate — when True the teacher is only surfaced as a
    # substitute candidate for a class they are already assigned to in the
    # timetable (i.e. they appear in timetable_slots for that class_id).
    # Checked in _is_hard_eligible / _is_hard_eligible_bulk before scoring.
    only_my_classes = Column(Boolean, default=False, nullable=False)

    teacher = relationship("User", backref="substitution_preference", uselist=False)
