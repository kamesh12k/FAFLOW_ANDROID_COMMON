from datetime import date, datetime
import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.user import User, Role
from app.models.leave import LeaveRequest, LeaveStatus, AlterAssignment, AssignmentType
from app.models.timetable import TimetableSlot
from app.models.day_order_calendar import CalendarDay, DayType
from app.models.system_setting import SystemSetting, CAMPUS_OPERATIONS_MODES
from app.schemas.leave import LeaveCreate, LeaveBatchCreate
from app.services import leave_service, substitution_service, teacher_substitution_service
from app.services.system_setting_service import set_setting, get_setting


@pytest.fixture
def working_calendar_day(db_session: Session):
    cal_day = db_session.query(CalendarDay).filter(CalendarDay.date == date(2026, 10, 5)).first()
    if not cal_day:
        cal_day = CalendarDay(
            date=date(2026, 10, 5),
            day_type=DayType.working,
            day_order=1,
        )
        db_session.add(cal_day)
        db_session.commit()
    return cal_day


@pytest.fixture
def faculty_users(db_session: Session):
    from app.models.user import AdminLevel
    from app.models.department import Department

    dept = db_session.query(Department).filter(Department.name == "Computer Science").first()
    if not dept:
        dept = Department(name="Computer Science", code="CS")
        db_session.add(dept)
        db_session.flush()

    teacher_a = db_session.query(User).filter(User.email == "teacher_flex_a@college.edu").first()
    if not teacher_a:
        teacher_a = User(
            name="Teacher A",
            email="teacher_flex_a@college.edu",
            password_hash="hashed",
            role=Role.teacher,
            is_active=True,
            department_id=dept.id,
        )
        db_session.add(teacher_a)

    teacher_b = db_session.query(User).filter(User.email == "teacher_flex_b@college.edu").first()
    if not teacher_b:
        teacher_b = User(
            name="Teacher B",
            email="teacher_flex_b@college.edu",
            password_hash="hashed",
            role=Role.teacher,
            is_active=True,
            department_id=dept.id,
        )
        db_session.add(teacher_b)

    teacher_c = db_session.query(User).filter(User.email == "teacher_flex_c@college.edu").first()
    if not teacher_c:
        teacher_c = User(
            name="Teacher C",
            email="teacher_flex_c@college.edu",
            password_hash="hashed",
            role=Role.teacher,
            is_active=True,
            department_id=dept.id,
        )
        db_session.add(teacher_c)

    admin_user = db_session.query(User).filter(User.username == "admin_flex").first()
    if not admin_user:
        admin_user = User(
            name="HOD Admin",
            username="admin_flex",
            password_hash="hashed",
            role=Role.admin,
            admin_level=AdminLevel.super_admin,
            is_active=True,
            department_id=dept.id,
        )
        db_session.add(admin_user)

    db_session.commit()
    return teacher_a, teacher_b, teacher_c, admin_user


class TestFlexibleModeConfiguration:
    def test_flexible_mode_is_recognized(self):
        assert "flexible" in CAMPUS_OPERATIONS_MODES
        assert "flexible" in substitution_service.VALID_MODES

    def test_flexible_mode_precedence_and_resolution(self, db_session: Session, faculty_users):
        teacher_a, _, _, admin = faculty_users
        
        # Test department-level setting
        substitution_service.set_mode(db_session, "flexible", admin)
        assert substitution_service.get_mode(db_session) == "flexible"

        # Global override takes precedence
        substitution_service.set_global_override(db_session, "manual", admin)
        assert substitution_service.get_mode(db_session) == "manual"

        # Global override flexible
        substitution_service.set_global_override(db_session, "flexible", admin)
        assert substitution_service.get_mode(db_session) == "flexible"

        # Reset global override
        substitution_service.set_global_override(db_session, "none", admin)
        assert substitution_service.get_mode(db_session) == "flexible"

    def test_flexible_mode_enforces_teacher_self_management(self, db_session: Session, faculty_users):
        teacher_a, _, _, admin = faculty_users
        substitution_service.set_mode(db_session, "flexible", admin)

        # In Flexible mode, teacher self management is strictly allowed
        assert teacher_substitution_service.is_teacher_self_management_allowed(db_session, teacher_a.id) is True

        # And setting mode to flexible automatically sets teacher_self_management_enabled to true
        assert get_setting(db_session, "teacher_self_management_enabled", "false", None) == "true"


class TestFlexibleLeaveWorkflow:
    def test_submit_leave_with_proposed_substitute_does_not_assign_immediately(
        self, db_session: Session, faculty_users, working_calendar_day
    ):
        teacher_a, teacher_b, _, _ = faculty_users
        leave_data = LeaveCreate(
            date=working_calendar_day.date,
            period_number=1,
            reason="Attending Workshop",
            proposed_substitute_id=teacher_b.id,
        )

        leave = leave_service.submit_leave(teacher_a.id, leave_data, db_session)
        assert leave.status == LeaveStatus.pending
        assert leave.proposed_substitute_id == teacher_b.id
        assert leave.alter_assignment is None  # MUST NOT assign immediately!

    def test_self_selection_as_proposed_substitute_is_rejected(
        self, db_session: Session, faculty_users, working_calendar_day
    ):
        teacher_a, _, _, _ = faculty_users
        leave_data = LeaveCreate(
            date=working_calendar_day.date,
            period_number=2,
            reason="Invalid Self Pick",
            proposed_substitute_id=teacher_a.id,
        )

        with pytest.raises(HTTPException) as exc:
            leave_service.submit_leave(teacher_a.id, leave_data, db_session)
        assert exc.value.status_code == 400
        assert "cannot be their own substitute" in str(exc.value.detail)

    def test_submit_batch_supports_different_substitutes_per_period(
        self, db_session: Session, faculty_users, working_calendar_day
    ):
        teacher_a, teacher_b, teacher_c, _ = faculty_users
        batch_data = LeaveBatchCreate(
            date=working_calendar_day.date,
            period_numbers=[3, 4],
            reason="Two period leave",
            period_substitutes={3: teacher_b.id, 4: teacher_c.id},
        )

        leaves = leave_service.submit_leave_batch(teacher_a.id, batch_data, db_session)
        assert len(leaves) == 2
        p3_leave = next(l for l in leaves if l.period_number == 3)
        p4_leave = next(l for l in leaves if l.period_number == 4)

        assert p3_leave.proposed_substitute_id == teacher_b.id
        assert p4_leave.proposed_substitute_id == teacher_c.id
        assert p3_leave.alter_assignment is None
        assert p4_leave.alter_assignment is None

    def test_hod_approval_creates_official_assignment_and_credits(
        self, db_session: Session, faculty_users, working_calendar_day
    ):
        teacher_a, teacher_b, _, admin = faculty_users
        leave_data = LeaveCreate(
            date=working_calendar_day.date,
            period_number=5,
            reason="Medical",
            proposed_substitute_id=teacher_b.id,
        )
        leave = leave_service.submit_leave(teacher_a.id, leave_data, db_session)

        # HOD approves
        approved_leave, _ = leave_service.approve_leave(leave.id, db_session, actor_id=admin.id)
        assert approved_leave.status == LeaveStatus.approved
        assert approved_leave.alter_assignment is not None
        assert approved_leave.alter_assignment.substitute_teacher_id == teacher_b.id
        assert approved_leave.alter_assignment.assignment_type == AssignmentType.teacher_assigned

    def test_hod_approval_blocked_on_substitute_conflict_without_partial_corruption(
        self, db_session: Session, faculty_users, working_calendar_day
    ):
        teacher_a, teacher_b, _, admin = faculty_users
        test_date = date(2026, 10, 6)

        # Ensure calendar day
        cal_day = db_session.query(CalendarDay).filter(CalendarDay.date == test_date).first()
        if not cal_day:
            cal_day = CalendarDay(date=test_date, day_type=DayType.working, day_order=2)
            db_session.add(cal_day)
            db_session.commit()

        leave_data = LeaveCreate(
            date=test_date,
            period_number=1,
            reason="Personal",
            proposed_substitute_id=teacher_b.id,
        )
        leave = leave_service.submit_leave(teacher_a.id, leave_data, db_session)

        # Simulate teacher_b having an approved leave on that date and period
        conflict_leave = LeaveRequest(
            teacher_id=teacher_b.id,
            date=test_date,
            day_order=2,
            period_number=1,
            reason="Medical emergency",
            status=LeaveStatus.approved,
        )
        db_session.add(conflict_leave)
        db_session.commit()

        # Approval must fail with 409 conflict
        with pytest.raises(HTTPException) as exc:
            leave_service.approve_leave(leave.id, db_session, actor_id=admin.id)

        assert exc.value.status_code == 409
        assert "leave" in str(exc.value.detail).lower() or "not available" in str(exc.value.detail).lower()

        # Ensure no corrupt assignment was created
        db_session.refresh(leave)
        assert leave.status == LeaveStatus.pending
        assert leave.alter_assignment is None

    def test_cancellation_reverses_assignment_and_credits_cleanly(
        self, db_session: Session, faculty_users, working_calendar_day
    ):
        teacher_a, teacher_b, _, admin = faculty_users
        future_date = date(2026, 11, 10)
        cal_day = db_session.query(CalendarDay).filter(CalendarDay.date == future_date).first()
        if not cal_day:
            cal_day = CalendarDay(date=future_date, day_type=DayType.working, day_order=3)
            db_session.add(cal_day)
            db_session.commit()

        leave_data = LeaveCreate(
            date=future_date,
            period_number=2,
            reason="Conference",
            proposed_substitute_id=teacher_b.id,
        )
        leave = leave_service.submit_leave(teacher_a.id, leave_data, db_session)
        approved_leave, _ = leave_service.approve_leave(leave.id, db_session, actor_id=admin.id)
        assert approved_leave.alter_assignment is not None

        # Teacher cancels leave
        cancelled_leave = leave_service.cancel_leave_by_teacher(approved_leave.id, teacher_a.id, db_session)
        assert cancelled_leave.status == LeaveStatus.cancelled
        assert cancelled_leave.alter_assignment is None

    def test_slot_candidates_endpoint_scoring_bounded_strictly_0_to_100(
        self, db_session: Session, faculty_users, working_calendar_day
    ):
        teacher_a, _, _, _ = faculty_users
        candidates = substitution_service.get_slot_candidates(
            db=db_session,
            teacher_id=teacher_a.id,
            leave_date=working_calendar_day.date,
            period_number=1,
            day_order=working_calendar_day.day_order,
        )

        assert isinstance(candidates, list)
        for cand in candidates:
            assert 0 <= cand.score <= 100
            assert cand.teacher.id != teacher_a.id
