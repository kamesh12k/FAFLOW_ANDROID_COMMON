"""Tests for leave cancellation — same-day 10 AM cutoff policy."""
import pytest
from datetime import date, datetime
from fastapi import HTTPException

from app.models.leave import LeaveRequest, LeaveStatus, AlterAssignment, AssignmentType
from app.models.user import User, Role
from app.services import leave_service
from tests.conftest import (
    _make_user, create_leave_request, create_calendar_day,
    create_teacher_credit, make_auth_headers,
)
from app.models.day_order_calendar import DayType


class TestCancelLeaveByTeacher:
    """Teacher cancellation rules: future=OK, same-day<10AM=OK, same-day>=10AM=BLOCKED, past=BLOCKED."""

    def _make_teacher(self, db, email="cancel_teacher@test.com"):
        return _make_user(db, name="Cancel Teacher", email=email, role=Role.teacher)

    def test_cancel_future_leave(self, db_session):
        teacher = self._make_teacher(db_session)
        leave = create_leave_request(
            db_session, teacher.id, the_date=date(2026, 12, 15),
            status=LeaveStatus.pending, reason="Trip"
        )
        # "now" is well before the leave date
        now = datetime(2026, 6, 28, 9, 0, 0)
        result = leave_service.cancel_leave_by_teacher(leave.id, teacher.id, db_session, now=now)
        assert result.status == LeaveStatus.cancelled

    def test_cancel_approved_future_leave(self, db_session):
        teacher = self._make_teacher(db_session)
        leave = create_leave_request(
            db_session, teacher.id, the_date=date(2026, 12, 15),
            status=LeaveStatus.approved, reason="Conference"
        )
        now = datetime(2026, 6, 28, 14, 0, 0)
        result = leave_service.cancel_leave_by_teacher(leave.id, teacher.id, db_session, now=now)
        assert result.status == LeaveStatus.cancelled

    def test_cancel_same_day_before_10am(self, db_session):
        teacher = self._make_teacher(db_session)
        leave = create_leave_request(
            db_session, teacher.id, the_date=date(2026, 6, 28),
            status=LeaveStatus.approved, reason="Not well"
        )
        # 9:45 AM — allowed
        now = datetime(2026, 6, 28, 9, 45, 0)
        result = leave_service.cancel_leave_by_teacher(leave.id, teacher.id, db_session, now=now)
        assert result.status == LeaveStatus.cancelled

    def test_cancel_same_day_at_959am(self, db_session):
        teacher = self._make_teacher(db_session)
        leave = create_leave_request(
            db_session, teacher.id, the_date=date(2026, 6, 28),
            status=LeaveStatus.pending, reason="Sick"
        )
        # 9:59 AM — still allowed
        now = datetime(2026, 6, 28, 9, 59, 59)
        result = leave_service.cancel_leave_by_teacher(leave.id, teacher.id, db_session, now=now)
        assert result.status == LeaveStatus.cancelled

    def test_cancel_same_day_at_10am_blocked(self, db_session):
        teacher = self._make_teacher(db_session)
        leave = create_leave_request(
            db_session, teacher.id, the_date=date(2026, 6, 28),
            status=LeaveStatus.approved, reason="Sick"
        )
        # Exactly 10:00 AM — blocked
        now = datetime(2026, 6, 28, 10, 0, 0)
        with pytest.raises(HTTPException) as exc_info:
            leave_service.cancel_leave_by_teacher(leave.id, teacher.id, db_session, now=now)
        assert exc_info.value.status_code == 400
        assert "10:00 AM" in exc_info.value.detail

    def test_cancel_same_day_afternoon_blocked(self, db_session):
        teacher = self._make_teacher(db_session)
        leave = create_leave_request(
            db_session, teacher.id, the_date=date(2026, 6, 28),
            status=LeaveStatus.approved, reason="Doctor"
        )
        now = datetime(2026, 6, 28, 14, 30, 0)
        with pytest.raises(HTTPException) as exc_info:
            leave_service.cancel_leave_by_teacher(leave.id, teacher.id, db_session, now=now)
        assert exc_info.value.status_code == 400
        assert "10:00 AM" in exc_info.value.detail

    def test_cancel_past_leave_blocked(self, db_session):
        teacher = self._make_teacher(db_session)
        leave = create_leave_request(
            db_session, teacher.id, the_date=date(2026, 6, 20),
            status=LeaveStatus.approved, reason="Was sick"
        )
        now = datetime(2026, 6, 28, 8, 0, 0)
        with pytest.raises(HTTPException) as exc_info:
            leave_service.cancel_leave_by_teacher(leave.id, teacher.id, db_session, now=now)
        assert exc_info.value.status_code == 400
        assert "Past" in exc_info.value.detail

    def test_cancel_wrong_teacher_forbidden(self, db_session):
        teacher1 = self._make_teacher(db_session, email="t1@test.com")
        teacher2 = self._make_teacher(db_session, email="t2@test.com")
        leave = create_leave_request(
            db_session, teacher1.id, the_date=date(2026, 12, 15),
            status=LeaveStatus.pending, reason="Trip"
        )
        now = datetime(2026, 6, 28, 9, 0, 0)
        with pytest.raises(HTTPException) as exc_info:
            leave_service.cancel_leave_by_teacher(leave.id, teacher2.id, db_session, now=now)
        assert exc_info.value.status_code == 403

    def test_cancel_already_cancelled_blocked(self, db_session):
        teacher = self._make_teacher(db_session)
        leave = create_leave_request(
            db_session, teacher.id, the_date=date(2026, 12, 15),
            status=LeaveStatus.cancelled, reason="Old"
        )
        now = datetime(2026, 6, 28, 9, 0, 0)
        with pytest.raises(HTTPException) as exc_info:
            leave_service.cancel_leave_by_teacher(leave.id, teacher.id, db_session, now=now)
        assert exc_info.value.status_code == 400

    def test_cancel_rejected_leave_blocked(self, db_session):
        teacher = self._make_teacher(db_session)
        leave = create_leave_request(
            db_session, teacher.id, the_date=date(2026, 12, 15),
            status=LeaveStatus.rejected, reason="Nope"
        )
        now = datetime(2026, 6, 28, 9, 0, 0)
        with pytest.raises(HTTPException) as exc_info:
            leave_service.cancel_leave_by_teacher(leave.id, teacher.id, db_session, now=now)
        assert exc_info.value.status_code == 400

    def test_cancel_with_substitute_reverses_credits(self, db_session):
        """When a leave has a substitute assigned, cancellation should
        reverse the credit transactions and delete the assignment."""
        teacher = self._make_teacher(db_session, email="orig@test.com")
        sub_teacher = self._make_teacher(db_session, email="sub@test.com")

        leave = create_leave_request(
            db_session, teacher.id, the_date=date(2026, 12, 15),
            status=LeaveStatus.approved, reason="Planned"
        )

        # Create credits for both
        create_teacher_credit(db_session, teacher.id, balance=-1)
        create_teacher_credit(db_session, sub_teacher.id, balance=1)

        # Add assignment
        assignment = AlterAssignment(
            leave_request_id=leave.id,
            substitute_teacher_id=sub_teacher.id,
            assignment_type=AssignmentType.admin_assigned,
        )
        db_session.add(assignment)
        db_session.commit()

        now = datetime(2026, 6, 28, 9, 0, 0)
        result = leave_service.cancel_leave_by_teacher(leave.id, teacher.id, db_session, now=now)

        assert result.status == LeaveStatus.cancelled
        # Assignment should be deleted
        assert result.alter_assignment is None

        # Credits should be reversed
        from app.services.credit_service import get_balance
        assert get_balance(teacher.id, db_session) == 0   # was -1, now +1 = 0
        assert get_balance(sub_teacher.id, db_session) == 0  # was 1, now -1 = 0


class TestCancelLeaveByAdmin:
    """Admin can cancel any leave at any time."""

    def _make_admin(self, db, email="cancel_admin@test.com"):
        return _make_user(db, name="Cancel Admin", email=email, role=Role.admin)

    def _make_teacher(self, db, email="cancel_t@test.com"):
        return _make_user(db, name="Cancel Teacher", email=email, role=Role.teacher)

    def test_admin_cancel_always_allowed(self, db_session):
        admin = self._make_admin(db_session)
        teacher = self._make_teacher(db_session)
        leave = create_leave_request(
            db_session, teacher.id, the_date=date(2026, 6, 28),
            status=LeaveStatus.approved, reason="Sick"
        )
        result = leave_service.cancel_leave_by_admin(leave.id, admin, "Schedule conflict", db_session)
        assert result.status == LeaveStatus.cancelled

    def test_admin_cancel_past_leave(self, db_session):
        admin = self._make_admin(db_session)
        teacher = self._make_teacher(db_session)
        leave = create_leave_request(
            db_session, teacher.id, the_date=date(2026, 6, 15),
            status=LeaveStatus.approved, reason="Was sick"
        )
        result = leave_service.cancel_leave_by_admin(leave.id, admin, "Error correction", db_session)
        assert result.status == LeaveStatus.cancelled

    def test_admin_cancel_already_cancelled_blocked(self, db_session):
        admin = self._make_admin(db_session)
        teacher = self._make_teacher(db_session)
        leave = create_leave_request(
            db_session, teacher.id, the_date=date(2026, 12, 15),
            status=LeaveStatus.cancelled, reason="Old"
        )
        with pytest.raises(HTTPException) as exc_info:
            leave_service.cancel_leave_by_admin(leave.id, admin, "N/A", db_session)
        assert exc_info.value.status_code == 400


class TestCancelImpact:
    """Cancel impact preview returns correct details."""

    def _make_teacher(self, db, email="impact_t@test.com"):
        return _make_user(db, name="Impact Teacher", email=email, role=Role.teacher)

    def test_impact_without_substitute(self, db_session):
        teacher = self._make_teacher(db_session)
        leave = create_leave_request(
            db_session, teacher.id, the_date=date(2026, 7, 10),
            status=LeaveStatus.pending, day_order=3, period_number=2
        )
        impact = leave_service.get_cancel_impact(leave.id, db_session)
        assert impact.leave_id == leave.id
        assert impact.day_order == 3
        assert impact.period_number == 2
        assert impact.has_substitute is False
        assert impact.substitute_name is None

    def test_impact_with_substitute(self, db_session):
        teacher = self._make_teacher(db_session, email="orig_impact@test.com")
        sub_teacher = self._make_teacher(db_session, email="sub_impact@test.com")
        leave = create_leave_request(
            db_session, teacher.id, the_date=date(2026, 7, 10),
            status=LeaveStatus.approved, day_order=4, period_number=3
        )
        assignment = AlterAssignment(
            leave_request_id=leave.id,
            substitute_teacher_id=sub_teacher.id,
            assignment_type=AssignmentType.auto_assigned,
        )
        db_session.add(assignment)
        db_session.commit()

        impact = leave_service.get_cancel_impact(leave.id, db_session)
        assert impact.has_substitute is True
        assert impact.substitute_name == "Impact Teacher"
        assert impact.substitute_id == sub_teacher.id
        assert impact.assignment_type == "auto_assigned"
