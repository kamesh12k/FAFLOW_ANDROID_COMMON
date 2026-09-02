"""Tests for app.services.leave_service."""
import pytest
from datetime import date, timedelta
from fastapi import HTTPException
from unittest.mock import patch

from app.core.timezone import get_institution_today

from app.services.leave_service import (
    submit_leave, get_all_leaves, get_teacher_leaves,
    approve_leave, reject_leave, detect_free_teachers,
    assign_substitute, override_substitute, undo_assignment,
    set_assignment_lock, submit_leave_by_admin,
)
from app.schemas.leave import LeaveCreate, AdminLeaveCreate
from app.models.leave import LeaveRequest, LeaveStatus, AlterAssignment, AssignmentType
from app.models.credit import TeacherCredit
from tests.conftest import (
    _make_user, create_calendar_day, create_leave_request,
    create_teacher_credit, create_department, create_subject,
    create_class, create_timetable_slot,
)
from app.models.day_order_calendar import DayType


class TestSubmitLeave:
    def test_success(self, db_session, test_teacher):
        create_calendar_day(db_session, date(2026, 7, 1), DayType.working, day_order=1)
        data = LeaveCreate(date=date(2026, 7, 1), period_number=1, reason="Sick")
        leave = submit_leave(test_teacher.id, data, db_session)
        assert leave.status == LeaveStatus.pending
        assert leave.day_order == 1

    def test_non_working_day_rejected(self, db_session, test_teacher):
        create_calendar_day(db_session, date(2026, 7, 1), DayType.holiday, day_order=None)
        data = LeaveCreate(date=date(2026, 7, 1), period_number=1, reason="Sick")
        with pytest.raises(HTTPException) as exc:
            submit_leave(test_teacher.id, data, db_session)
        assert exc.value.status_code == 400

    def test_no_calendar_entry(self, db_session, test_teacher):
        data = LeaveCreate(date=date(2026, 7, 1), period_number=1, reason="Sick")
        with pytest.raises(HTTPException) as exc:
            submit_leave(test_teacher.id, data, db_session)
        assert exc.value.status_code == 400

    def test_reapply_after_rejection(self, db_session, test_teacher):
        create_calendar_day(db_session, date(2026, 7, 1), DayType.working, day_order=1)
        data1 = LeaveCreate(date=date(2026, 7, 1), period_number=1, reason="First try")
        leave1 = submit_leave(test_teacher.id, data1, db_session)
        assert leave1.status == LeaveStatus.pending

        # Reject it
        reject_leave(leave1.id, db_session)
        assert leave1.status == LeaveStatus.rejected

        # Reapply on the same date and period
        data2 = LeaveCreate(date=date(2026, 7, 1), period_number=1, reason="Second try with proper reason")
        leave2 = submit_leave(test_teacher.id, data2, db_session)
        assert leave2.id != leave1.id
        assert leave2.status == LeaveStatus.pending


class TestGetLeaves:
    def test_all(self, db_session, test_teacher):
        create_leave_request(db_session, test_teacher.id)
        assert len(get_all_leaves(db_session)) == 1

    def test_by_teacher(self, db_session, test_teacher, test_teacher2):
        create_leave_request(db_session, test_teacher.id)
        create_leave_request(db_session, test_teacher2.id, the_date=date(2026, 7, 2))
        assert len(get_teacher_leaves(test_teacher.id, db_session)) == 1


class TestApproveReject:
    def test_approve(self, db_session, test_teacher):
        create_calendar_day(db_session, date(2026, 7, 1), DayType.working, day_order=1)
        leave = create_leave_request(db_session, test_teacher.id)
        result, free = approve_leave(leave.id, db_session)
        assert result.status == LeaveStatus.approved

    def test_approve_already_approved(self, db_session, test_teacher):
        create_calendar_day(db_session, date(2026, 7, 1), DayType.working, day_order=1)
        leave = create_leave_request(db_session, test_teacher.id, status=LeaveStatus.approved)
        with pytest.raises(HTTPException) as exc:
            approve_leave(leave.id, db_session)
        assert exc.value.status_code == 400

    def test_reject(self, db_session, test_teacher):
        leave = create_leave_request(db_session, test_teacher.id)
        result = reject_leave(leave.id, db_session)
        assert result.status == LeaveStatus.rejected

    def test_reject_already_rejected(self, db_session, test_teacher):
        leave = create_leave_request(db_session, test_teacher.id, status=LeaveStatus.rejected)
        with pytest.raises(HTTPException) as exc:
            reject_leave(leave.id, db_session)
        assert exc.value.status_code == 400

    def test_not_found(self, db_session):
        with pytest.raises(HTTPException) as exc:
            approve_leave(999, db_session)
        assert exc.value.status_code == 404


class TestDetectFreeTeachers:
    def test_detects_free(self, db_session, test_teacher, test_teacher2):
        free = detect_free_teachers(1, 1, test_teacher.id, db_session)
        ids = [t.id for t in free]
        assert test_teacher2.id in ids
        assert test_teacher.id not in ids

    def test_busy_excluded(self, db_session, test_teacher, test_teacher2):
        dept = create_department(db_session)
        subj = create_subject(db_session, department_id=dept.id)
        cls = create_class(db_session, department_id=dept.id)
        create_timetable_slot(db_session, test_teacher2.id, subj.id, cls.id)
        free = detect_free_teachers(1, 1, test_teacher.id, db_session)
        ids = [t.id for t in free]
        assert test_teacher2.id not in ids


class TestAssignSubstitute:
    def _setup(self, db_session):
        teacher = _make_user(db_session, email="lt@test.com")
        sub = _make_user(db_session, email="sub@test.com")
        test_date = get_institution_today() + timedelta(days=7)
        create_calendar_day(db_session, test_date, DayType.working, day_order=1)
        leave = create_leave_request(
            db_session, teacher.id, the_date=test_date, status=LeaveStatus.approved,
        )
        create_teacher_credit(db_session, teacher.id)
        create_teacher_credit(db_session, sub.id)
        return teacher, sub, leave

    def test_success(self, db_session):
        teacher, sub, leave = self._setup(db_session)
        assignment = assign_substitute(leave.id, sub.id, db_session)
        assert assignment.substitute_teacher_id == sub.id

    def test_not_approved(self, db_session):
        teacher = _make_user(db_session, email="na@test.com")
        sub = _make_user(db_session, email="nas@test.com")
        test_date = get_institution_today() + timedelta(days=7)
        leave = create_leave_request(db_session, teacher.id, the_date=test_date, status=LeaveStatus.pending)
        with pytest.raises(HTTPException) as exc:
            assign_substitute(leave.id, sub.id, db_session)
        assert exc.value.status_code == 400

    def test_self_assign(self, db_session):
        teacher = _make_user(db_session, email="self@test.com")
        test_date = get_institution_today() + timedelta(days=7)
        create_calendar_day(db_session, test_date, DayType.working, day_order=1)
        leave = create_leave_request(db_session, teacher.id, the_date=test_date, status=LeaveStatus.approved)
        with pytest.raises(HTTPException) as exc:
            assign_substitute(leave.id, teacher.id, db_session)
        assert exc.value.status_code == 400

    def test_teacher_not_found(self, db_session):
        teacher = _make_user(db_session, email="tnf@test.com")
        test_date = get_institution_today() + timedelta(days=7)
        create_calendar_day(db_session, test_date, DayType.working, day_order=1)
        leave = create_leave_request(db_session, teacher.id, the_date=test_date, status=LeaveStatus.approved)
        with pytest.raises(HTTPException) as exc:
            assign_substitute(leave.id, 9999, db_session)
        assert exc.value.status_code == 404


class TestSubmitLeaveByAdmin:
    def test_success_single_period(self, db_session, test_teacher):
        admin = _make_user(db_session, email="admin1@test.com")
        create_calendar_day(db_session, date(2026, 7, 1), DayType.working, day_order=1)
        data = AdminLeaveCreate(
            teacher_id=test_teacher.id,
            date=date(2026, 7, 1),
            whole_day=False,
            period_numbers=[2],
            reason="Sick leave informed by phone",
            notes="Direct HOD entry",
        )
        leaves = submit_leave_by_admin(data, admin, db_session)
        assert len(leaves) == 1
        assert leaves[0].status == LeaveStatus.approved
        assert leaves[0].period_number == 2
        assert leaves[0].reason == "Sick leave informed by phone"

    def test_success_whole_day_expansion(self, db_session, test_teacher):
        admin = _make_user(db_session, email="admin2@test.com")
        create_calendar_day(db_session, date(2026, 7, 1), DayType.working, day_order=1)
        
        # Setup timetable slots for the teacher
        dept = create_department(db_session)
        subj = create_subject(db_session, department_id=dept.id)
        cls = create_class(db_session, department_id=dept.id)
        create_timetable_slot(db_session, test_teacher.id, subj.id, cls.id, day_order=1, period_number=1)
        create_timetable_slot(db_session, test_teacher.id, subj.id, cls.id, day_order=1, period_number=3)

        data = AdminLeaveCreate(
            teacher_id=test_teacher.id,
            date=date(2026, 7, 1),
            whole_day=True,
            reason="Sick",
            notes="Direct HOD entry",
        )
        leaves = submit_leave_by_admin(data, admin, db_session)
        assert len(leaves) == 2
        periods = {l.period_number for l in leaves}
        assert periods == {1, 3}
        for leave in leaves:
            assert leave.status == LeaveStatus.approved

    def test_holiday_fails(self, db_session, test_teacher):
        admin = _make_user(db_session, email="admin3@test.com")
        create_calendar_day(db_session, date(2026, 7, 1), DayType.holiday, day_order=None)
        data = AdminLeaveCreate(
            teacher_id=test_teacher.id,
            date=date(2026, 7, 1),
            whole_day=False,
            period_numbers=[2],
            reason="Sick",
        )
        with pytest.raises(HTTPException) as exc:
            submit_leave_by_admin(data, admin, db_session)
        assert exc.value.status_code == 400
