from datetime import datetime, date, time
from zoneinfo import ZoneInfo
from unittest.mock import patch
import pytest
from fastapi import HTTPException

from app.core.timezone import (
    is_substitution_expired,
    get_institution_now,
    get_institution_today,
    INSTITUTION_TZ,
    CUTOFF_HOUR,
)
from app.services.teacher_substitution_service import (
    teacher_get_leave_requests,
    teacher_assign_substitute,
    teacher_override_substitute,
    teacher_undo_assignment,
    teacher_get_candidates,
    teacher_get_free_teachers,
)
from app.services import leave_service
from app.models.leave import LeaveRequest, LeaveStatus, AlterAssignment, AssignmentType
from app.models.user import User, Role
from app.models.system_setting import SystemSetting
from app.schemas.leave import LeaveOut


def test_timezone_configuration():
    """Verify that INSTITUTION_TZ is configured explicitly as Asia/Kolkata."""
    assert str(INSTITUTION_TZ) == "Asia/Kolkata"
    assert CUTOFF_HOUR == 17


def test_exact_time_boundary_in_asia_kolkata():
    """Verify exact 5:00 PM boundary:
    16:59:59 -> Active (False)
    17:00:00 -> Expired (True)
    17:00:01 -> Expired (True)
    """
    today_kolkata = date(2026, 8, 19)

    # 1. 16:59:59 (4:59:59 PM) in Asia/Kolkata
    t_1659 = datetime(2026, 8, 19, 16, 59, 59, tzinfo=INSTITUTION_TZ)
    with patch("app.core.timezone.get_institution_now", return_value=t_1659):
        assert is_substitution_expired(today_kolkata) is False

    # 2. 17:00:00 (5:00:00 PM) in Asia/Kolkata
    t_1700 = datetime(2026, 8, 19, 17, 0, 0, tzinfo=INSTITUTION_TZ)
    with patch("app.core.timezone.get_institution_now", return_value=t_1700):
        assert is_substitution_expired(today_kolkata) is True

    # 3. 17:00:01 (5:00:01 PM) in Asia/Kolkata
    t_1701 = datetime(2026, 8, 19, 17, 0, 1, tzinfo=INSTITUTION_TZ)
    with patch("app.core.timezone.get_institution_now", return_value=t_1701):
        assert is_substitution_expired(today_kolkata) is True


def test_server_in_different_timezone_still_evaluates_asia_kolkata():
    """Verify that if the host/server OS timezone is UTC or US/Pacific,
    the cutoff decision is strictly calculated against Asia/Kolkata time (+05:30).

    Example 1: UTC time 11:29:59 on Aug 19 is 16:59:59 in Asia/Kolkata -> ACTIVE
    Example 2: UTC time 11:30:00 on Aug 19 is 17:00:00 in Asia/Kolkata -> EXPIRED
    """
    today_kolkata = date(2026, 8, 19)

    # UTC 11:29:59 = Kolkata 16:59:59 (Active)
    utc_before = datetime(2026, 8, 19, 11, 29, 59, tzinfo=ZoneInfo("UTC"))
    kolkata_before = utc_before.astimezone(INSTITUTION_TZ)
    with patch("app.core.timezone.get_institution_now", return_value=kolkata_before):
        assert is_substitution_expired(today_kolkata) is False

    # UTC 11:30:00 = Kolkata 17:00:00 (Expired)
    utc_at = datetime(2026, 8, 19, 11, 30, 0, tzinfo=ZoneInfo("UTC"))
    kolkata_at = utc_at.astimezone(INSTITUTION_TZ)
    with patch("app.core.timezone.get_institution_now", return_value=kolkata_at):
        assert is_substitution_expired(today_kolkata) is True

    # US/Pacific 04:29:59 = Kolkata 16:59:59 (Active)
    pdt_before = datetime(2026, 8, 19, 4, 29, 59, tzinfo=ZoneInfo("America/Los_Angeles"))
    kolkata_pdt = pdt_before.astimezone(INSTITUTION_TZ)
    with patch("app.core.timezone.get_institution_now", return_value=kolkata_pdt):
        assert is_substitution_expired(today_kolkata) is False


def test_leave_out_schema_is_expired_computed_field(db_session, test_teacher):
    """Verify that LeaveOut serialization produces is_expired directly from backend."""
    leave_today = LeaveRequest(
        teacher_id=test_teacher.id,
        date=date(2026, 8, 19),
        day_order=6,
        period_number=1,
        reason="Check Schema",
        status=LeaveStatus.approved,
    )
    db_session.add(leave_today)
    db_session.commit()
    db_session.refresh(leave_today)

    # At 4:59 PM Kolkata
    t_active = datetime(2026, 8, 19, 16, 59, 59, tzinfo=INSTITUTION_TZ)
    with patch("app.core.timezone.get_institution_now", return_value=t_active):
        schema_out = LeaveOut.model_validate(leave_today)
        data = schema_out.model_dump()
        assert data["is_expired"] is False

    # At 5:00 PM Kolkata
    t_expired = datetime(2026, 8, 19, 17, 0, 0, tzinfo=INSTITUTION_TZ)
    with patch("app.core.timezone.get_institution_now", return_value=t_expired):
        schema_out = LeaveOut.model_validate(leave_today)
        data = schema_out.model_dump()
        assert data["is_expired"] is True


def test_all_backend_mutation_apis_reject_expired_slot(db_session, test_teacher, test_teacher2, test_admin):
    """Verify that every relevant backend API rejects operations on expired slots with HTTP 400."""
    setting = db_session.query(SystemSetting).filter(SystemSetting.key == "teacher_self_management_enabled").first()
    if not setting:
        setting = SystemSetting(key="teacher_self_management_enabled", value="true")
        db_session.add(setting)
    else:
        setting.value = "true"
    db_session.commit()

    leave_today = LeaveRequest(
        teacher_id=test_teacher.id,
        date=date(2026, 8, 19),
        day_order=6,
        period_number=2,
        reason="Today Slot",
        status=LeaveStatus.approved,
    )
    db_session.add(leave_today)
    db_session.commit()
    db_session.refresh(leave_today)

    # Freeze time to 5:00:00 PM on substitution date
    t_5pm = datetime(2026, 8, 19, 17, 0, 0, tzinfo=INSTITUTION_TZ)
    with patch("app.core.timezone.get_institution_now", return_value=t_5pm):
        # 1. Teacher assign
        with pytest.raises(HTTPException) as exc:
            teacher_assign_substitute(db_session, leave_today.id, test_teacher2.id, test_teacher.id)
        assert exc.value.status_code == 400

        # 2. Teacher candidates
        with pytest.raises(HTTPException) as exc:
            teacher_get_candidates(db_session, leave_today.id, test_teacher.id)
        assert exc.value.status_code == 400

        # 3. Teacher free teachers
        with pytest.raises(HTTPException) as exc:
            teacher_get_free_teachers(db_session, leave_today.id, test_teacher.id)
        assert exc.value.status_code == 400

        # 4. Admin assign via leave_service
        with pytest.raises(HTTPException) as exc:
            leave_service.assign_substitute(leave_today.id, test_teacher2.id, db_session, actor_id=test_admin.id)
        assert exc.value.status_code == 400

        # 5. Admin override via leave_service
        with pytest.raises(HTTPException) as exc:
            leave_service.override_substitute(leave_today.id, test_teacher2.id, test_admin, db_session)
        assert exc.value.status_code == 400

        # 6. Admin undo via leave_service
        with pytest.raises(HTTPException) as exc:
            leave_service.undo_assignment(leave_today.id, test_admin, db_session)
        assert exc.value.status_code == 400


def test_historical_records_retained_in_database(db_session, test_teacher):
    """Verify that expired records are NOT deleted from the database and remain preserved."""
    past_date = date(2026, 8, 18)
    leave_past = LeaveRequest(
        teacher_id=test_teacher.id,
        date=past_date,
        day_order=5,
        period_number=1,
        reason="Historical record",
        status=LeaveStatus.approved,
    )
    db_session.add(leave_past)
    db_session.commit()

    # Query all teacher leaves (history)
    teacher_leaves = leave_service.get_teacher_leaves(test_teacher.id, db_session)
    matching = [l for l in teacher_leaves if l.id == leave_past.id]
    assert len(matching) == 1
    assert matching[0].status == LeaveStatus.approved
    assert is_substitution_expired(matching[0].date) is True
