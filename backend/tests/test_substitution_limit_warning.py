import pytest
from datetime import date, timedelta
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.user import User, Role
from app.models.leave import LeaveRequest, LeaveStatus, AlterAssignment, AssignmentType
from app.models.timetable import TimetableSlot
from app.models.audit_log import AuditLog
from app.models.day_order_calendar import DayType
from app.services import leave_service, substitution_service, teacher_substitution_service
from app.services.substitution_service import update_preferences


from tests.conftest import (
    _make_user, create_department, create_subject, create_class,
    create_timetable_slot, create_calendar_day, create_leave_request,
    create_teacher_credit,
)


def _make_leave(db: Session, teacher: User, leave_date: date = None, period: int = 3, day_order: int = 1) -> LeaveRequest:
    if leave_date is None:
        leave_date = date.today() + timedelta(days=5)
    create_calendar_day(db, leave_date, DayType.working, day_order=day_order)
    leave = LeaveRequest(
        teacher_id=teacher.id,
        date=leave_date,
        day_order=day_order,
        period_number=period,
        status=LeaveStatus.approved,
        reason="Sick",
    )
    db.add(leave)
    db.flush()
    return leave


class TestSubstitutionLimitWarning:
    def test_below_limit_assigns_normally(self, db_session: Session):
        """Test 1: When candidate is below limit (e.g. 2/3), assignment proceeds without warning."""
        leaver = _make_user(db_session, name="Leaver", email="leaver1@test.com")
        sub = _make_user(db_session, name="Sub", email="sub1@test.com")
        admin = _make_user(db_session, name="Admin", email="admin1@test.com", role=Role.admin)
        target_date = date.today() + timedelta(days=5)
        leave = _make_leave(db_session, leaver, leave_date=target_date, period=2)

        # Set max_weekly_substitutions = 3
        update_preferences(db_session, sub.id, max_weekly_substitutions=3)

        # Add 2 prior substitutions in 7-day window
        for i in [1, 2]:
            other_leave = _make_leave(
                db_session, leaver,
                leave_date=target_date - timedelta(days=i),
                period=1, day_order=i,
            )
            leave_service.assign_substitute(other_leave.id, sub.id, db_session, actor_id=admin.id)

        # Proposed assignment is 3rd (reaches 3/3, below threshold before assignment)
        # Note: current is 2, limit is 3 -> assignment succeeds
        assignment = leave_service.assign_substitute(leave.id, sub.id, db_session, actor_id=admin.id)
        assert assignment is not None
        assert assignment.substitute_teacher_id == sub.id

    def test_at_limit_without_override_raises_409(self, db_session: Session):
        """Test 2 & 3: When candidate has reached limit (3/3), backend raises 409 LIMIT_ACKNOWLEDGEMENT_REQUIRED."""
        leaver = _make_user(db_session, name="Leaver2", email="leaver2@test.com")
        sub = _make_user(db_session, name="Sub2", email="sub2@test.com")
        admin = _make_user(db_session, name="Admin2", email="admin2@test.com", role=Role.admin)
        target_date = date.today() + timedelta(days=5)
        leave = _make_leave(db_session, leaver, leave_date=target_date, period=3)

        update_preferences(db_session, sub.id, max_weekly_substitutions=3)

        # Add 3 prior substitutions in 7-day window
        for i in [1, 2, 3]:
            other_leave = _make_leave(
                db_session, leaver,
                leave_date=target_date - timedelta(days=i),
                period=1, day_order=i,
            )
            leave_service.assign_substitute(other_leave.id, sub.id, db_session, actor_id=admin.id)

        # Candidate is now at 3/3. Attempting to assign without override must raise 409
        with pytest.raises(HTTPException) as exc_info:
            leave_service.assign_substitute(
                leave.id, sub.id, db_session, actor_id=admin.id,
                override_substitution_limit=False,
            )
        assert exc_info.value.status_code == 409
        detail = exc_info.value.detail
        assert isinstance(detail, dict)
        assert detail["code"] == "LIMIT_ACKNOWLEDGEMENT_REQUIRED"
        assert detail["current_allocations"] == 3
        assert detail["max_allocations"] == 3
        assert detail["projected_allocations"] == 4

    def test_at_limit_with_explicit_override_succeeds_and_logs_audit(self, db_session: Session):
        """Test 4 & 6: With override_substitution_limit=True, assignment succeeds and logs audit event."""
        leaver = _make_user(db_session, name="Leaver3", email="leaver3@test.com")
        sub = _make_user(db_session, name="Sub3", email="sub3@test.com")
        admin = _make_user(db_session, name="Admin3", email="admin3@test.com", role=Role.admin)
        target_date = date.today() + timedelta(days=5)
        leave = _make_leave(db_session, leaver, leave_date=target_date, period=4)

        update_preferences(db_session, sub.id, max_weekly_substitutions=3)

        for i in [1, 2, 3]:
            other_leave = _make_leave(
                db_session, leaver,
                leave_date=target_date - timedelta(days=i),
                period=1, day_order=i,
            )
            leave_service.assign_substitute(other_leave.id, sub.id, db_session, actor_id=admin.id)

        # Assign with override
        assignment = leave_service.assign_substitute(
            leave.id, sub.id, db_session, actor_id=admin.id,
            override_substitution_limit=True,
        )
        assert assignment is not None
        assert assignment.substitute_teacher_id == sub.id

        # Verify audit log recorded override
        log = (
            db_session.query(AuditLog)
            .filter(AuditLog.action == "substitution.limit_override", AuditLog.target_id == leave.id)
            .first()
        )
        assert log is not None
        assert log.actor_user_id == admin.id
        assert log.details["current_7day_allocations"] == 3
        assert log.details["max_allocations"] == 3
        assert log.details["projected_allocations"] == 4

    def test_override_substitute_enforces_limit_and_override_flag(self, db_session: Session):
        """Test: override_substitute route/service validates 7-day limit on the new substitute."""
        leaver = _make_user(db_session, name="Leaver4", email="leaver4@test.com")
        sub_initial = _make_user(db_session, name="Sub4Init", email="sub4_init@test.com")
        sub_new = _make_user(db_session, name="Sub4New", email="sub4_new@test.com")
        admin = _make_user(db_session, name="Admin4", email="admin4@test.com", role=Role.admin)
        target_date = date.today() + timedelta(days=5)
        leave = _make_leave(db_session, leaver, leave_date=target_date, period=2)

        # Initial assignment
        leave_service.assign_substitute(leave.id, sub_initial.id, db_session, actor_id=admin.id)

        # New substitute is at limit (2/2)
        update_preferences(db_session, sub_new.id, max_weekly_substitutions=2)
        for i in [1, 2]:
            other_leave = _make_leave(
                db_session, leaver,
                leave_date=target_date - timedelta(days=i),
                period=1, day_order=i,
            )
            leave_service.assign_substitute(other_leave.id, sub_new.id, db_session, actor_id=admin.id)

        # Override without flag -> 409
        with pytest.raises(HTTPException) as exc_info:
            leave_service.override_substitute(
                leave.id, sub_new.id, admin, db_session,
                override_substitution_limit=False,
            )
        assert exc_info.value.status_code == 409
        assert exc_info.value.detail["code"] == "LIMIT_ACKNOWLEDGEMENT_REQUIRED"

        # Override with flag -> succeeds
        overridden = leave_service.override_substitute(
            leave.id, sub_new.id, admin, db_session,
            override_substitution_limit=True,
        )
        assert overridden.substitute_teacher_id == sub_new.id

    def test_hard_timetable_conflict_cannot_be_overridden(self, db_session: Session):
        """Test 12: Override flag cannot bypass a hard timetable conflict."""
        leaver = _make_user(db_session, name="Leaver5", email="leaver5@test.com")
        sub = _make_user(db_session, name="Sub5", email="sub5@test.com")
        admin = _make_user(db_session, name="Admin5", email="admin5@test.com", role=Role.admin)
        target_date = date.today() + timedelta(days=5)
        leave = _make_leave(db_session, leaver, leave_date=target_date, period=3, day_order=1)

        cls = create_class(db_session, name="CSE-A")
        subj = create_subject(db_session, name="DSA", code="CS201")
        slot = TimetableSlot(
            teacher_id=sub.id,
            class_id=cls.id,
            subject_id=subj.id,
            day_order=1,
            period_number=3,
        )
        db_session.add(slot)
        db_session.flush()

        with pytest.raises(HTTPException) as exc_info:
            leave_service.assign_substitute(
                leave.id, sub.id, db_session, actor_id=admin.id,
                override_substitution_limit=True,
            )
        assert exc_info.value.status_code == 400
        assert "already teaching" in exc_info.value.detail

    def test_candidate_scoring_includes_warning_when_limit_reached(self, db_session: Session):
        """Test: score_candidate includes warning reason when candidate is at limit."""
        leaver = _make_user(db_session, name="Leaver6", email="leaver6@test.com")
        sub = _make_user(db_session, name="Sub6", email="sub6@test.com")
        admin = _make_user(db_session, name="Admin6", email="admin6@test.com", role=Role.admin)
        target_date = date.today() + timedelta(days=5)
        leave = _make_leave(db_session, leaver, leave_date=target_date, period=2)

        update_preferences(db_session, sub.id, max_weekly_substitutions=2)
        for i in [1, 2]:
            other_leave = _make_leave(
                db_session, leaver,
                leave_date=target_date - timedelta(days=i),
                period=1, day_order=i,
            )
            leave_service.assign_substitute(other_leave.id, sub.id, db_session, actor_id=admin.id)

        scored = substitution_service.score_candidate(db_session, sub, leave, None, "CSE")
        warning_reason = next((r for r in scored.reasons if "7-day limit reached" in r), None)
        assert warning_reason is not None
        assert "2/2" in warning_reason

    def test_teacher_self_management_limit_warning_and_override(self, db_session: Session):
        """Test: teacher_assign_substitute raises 409 without override, succeeds with override."""
        from app.services.system_setting_service import set_setting
        set_setting(db_session, "teacher_self_management_enabled", "true")

        leaver = _make_user(db_session, name="TeacherLeaver", email="tleaver@test.com")
        sub = _make_user(db_session, name="TeacherSub", email="tsub@test.com")
        admin = _make_user(db_session, name="AdminT", email="admint@test.com", role=Role.admin)
        target_date = date.today() + timedelta(days=5)
        leave = _make_leave(db_session, leaver, leave_date=target_date, period=2)

        update_preferences(db_session, sub.id, max_weekly_substitutions=2)
        for i in [1, 2]:
            other_leave = _make_leave(
                db_session, leaver,
                leave_date=target_date - timedelta(days=i),
                period=1, day_order=i,
            )
            leave_service.assign_substitute(other_leave.id, sub.id, db_session, actor_id=admin.id)

        # Assign via teacher self management without override -> 409
        with pytest.raises(HTTPException) as exc_info:
            teacher_substitution_service.teacher_assign_substitute(
                db_session, leave.id, sub.id, leaver.id,
                override_substitution_limit=False,
            )
        assert exc_info.value.status_code == 409
        assert exc_info.value.detail["code"] == "LIMIT_ACKNOWLEDGEMENT_REQUIRED"

        # Assign via teacher self management with override -> succeeds
        assignment = teacher_substitution_service.teacher_assign_substitute(
            db_session, leave.id, sub.id, leaver.id,
            override_substitution_limit=True,
        )
        assert assignment is not None
        assert assignment.substitute_teacher_id == sub.id
        assert assignment.assignment_type == AssignmentType.teacher_assigned

    def test_autonomous_mode_skips_candidate_at_7day_limit(self, db_session: Session):
        """Test: Autonomous mode marks candidate at 7-day limit as not hard eligible for auto-assignment."""
        leaver = _make_user(db_session, name="AutoLeaver", email="autoleaver@test.com")
        sub = _make_user(db_session, name="AutoSub", email="autosub@test.com")
        admin = _make_user(db_session, name="AutoAdmin", email="autoadmin@test.com", role=Role.admin)
        target_date = date.today() + timedelta(days=5)
        leave = _make_leave(db_session, leaver, leave_date=target_date, period=2)

        update_preferences(db_session, sub.id, max_weekly_substitutions=2, accept_auto_assignments=True)
        for i in [1, 2]:
            other_leave = _make_leave(
                db_session, leaver,
                leave_date=target_date - timedelta(days=i),
                period=1, day_order=i,
            )
            leave_service.assign_substitute(other_leave.id, sub.id, db_session, actor_id=admin.id)

        # Check hard eligibility with require_auto_opt_in=True (autonomous) -> False
        ok_auto, reason_auto = substitution_service._is_hard_eligible(db_session, sub, leave, require_auto_opt_in=True)
        assert ok_auto is False
        assert "weekly substitution cap" in reason_auto

        # Check hard eligibility with require_auto_opt_in=False (assisted/manual) -> True (can be manually overridden)
        ok_manual, _ = substitution_service._is_hard_eligible(db_session, sub, leave, require_auto_opt_in=False)
        assert ok_manual is True
