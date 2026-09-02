"""Tests for app.services.day_order_service."""
import pytest
from datetime import date
from fastapi import HTTPException

from app.services.day_order_service import (
    _next_day_order, get_day, get_or_404, mark_day,
    bulk_mark_range, skip_day_order, reassign_day_order,
    clear_override, delete_day, get_range,
    resolve_by_date, resolve_dates_for_day_order,
    is_working_day, assert_working_day_or_400,
    DAY_ORDER_MIN, DAY_ORDER_MAX,
)
from app.models.day_order_calendar import CalendarDay, DayType
from tests.conftest import create_calendar_day, _make_user
from app.models.user import Role, AdminLevel


class TestNextDayOrder:
    def test_increment(self):
        assert _next_day_order(1) == 2
        assert _next_day_order(5) == 6

    def test_wraparound(self):
        assert _next_day_order(DAY_ORDER_MAX) == DAY_ORDER_MIN


class TestGetDay:
    def test_found(self, db_session):
        create_calendar_day(db_session, date(2026, 7, 1))
        day = get_day(db_session, date(2026, 7, 1))
        assert day is not None

    def test_not_found(self, db_session):
        assert get_day(db_session, date(2026, 7, 1)) is None

    def test_get_or_404_found(self, db_session):
        create_calendar_day(db_session, date(2026, 7, 1))
        day = get_or_404(db_session, date(2026, 7, 1))
        assert day is not None

    def test_get_or_404_raises(self, db_session):
        with pytest.raises(HTTPException) as exc:
            get_or_404(db_session, date(2026, 7, 1))
        assert exc.value.status_code == 404


class TestMarkDay:
    def test_mark_working(self, db_session, test_super_admin):
        day = mark_day(db_session, test_super_admin, date(2026, 7, 1), DayType.working)
        assert day.day_order == 1
        assert day.day_type == DayType.working

    def test_mark_holiday(self, db_session, test_super_admin):
        day = mark_day(db_session, test_super_admin, date(2026, 7, 1), DayType.holiday, label="Test")
        assert day.day_order is None
        assert day.day_type == DayType.holiday

    def test_auto_sequence(self, db_session, test_super_admin):
        mark_day(db_session, test_super_admin, date(2026, 7, 1), DayType.working)
        day2 = mark_day(db_session, test_super_admin, date(2026, 7, 2), DayType.working)
        assert day2.day_order == 2

    def test_holiday_pauses_sequence(self, db_session, test_super_admin):
        mark_day(db_session, test_super_admin, date(2026, 7, 1), DayType.working, day_order=3)
        mark_day(db_session, test_super_admin, date(2026, 7, 2), DayType.holiday)
        day3 = mark_day(db_session, test_super_admin, date(2026, 7, 3), DayType.working)
        assert day3.day_order == 4  # continues from 3

    def test_update_existing(self, db_session, test_super_admin):
        mark_day(db_session, test_super_admin, date(2026, 7, 1), DayType.working)
        day = mark_day(db_session, test_super_admin, date(2026, 7, 1), DayType.holiday)
        assert day.day_type == DayType.holiday
        assert day.day_order is None


class TestBulkMark:
    def test_range(self, db_session, test_super_admin):
        results = bulk_mark_range(
            db_session, test_super_admin,
            date(2026, 7, 1), date(2026, 7, 3),
            DayType.holiday, label="Break",
        )
        assert len(results) == 3
        assert all(d.day_type == DayType.holiday for d in results)

    def test_working_rejected(self, db_session, test_super_admin):
        with pytest.raises(HTTPException) as exc:
            bulk_mark_range(
                db_session, test_super_admin,
                date(2026, 7, 1), date(2026, 7, 3),
                DayType.working,
            )
        assert exc.value.status_code == 400


class TestSkipAndReassign:
    def test_skip(self, db_session, test_super_admin):
        mark_day(db_session, test_super_admin, date(2026, 7, 1), DayType.working, day_order=3)
        day = skip_day_order(db_session, test_super_admin, date(2026, 7, 1), 5)
        assert day.day_order == 5
        assert day.is_manual_override is True

    def test_reassign(self, db_session, test_super_admin):
        mark_day(db_session, test_super_admin, date(2026, 7, 1), DayType.working)
        day = reassign_day_order(db_session, test_super_admin, date(2026, 7, 1), 4)
        assert day.day_order == 4

    def test_clear_override(self, db_session, test_super_admin):
        mark_day(db_session, test_super_admin, date(2026, 7, 1), DayType.working, day_order=5, is_manual_override=True)
        day = clear_override(db_session, test_super_admin, date(2026, 7, 1))
        assert day.is_manual_override is False


class TestDeleteDay:
    def test_delete(self, db_session, test_super_admin):
        mark_day(db_session, test_super_admin, date(2026, 7, 1), DayType.working)
        delete_day(db_session, test_super_admin, date(2026, 7, 1))
        assert get_day(db_session, date(2026, 7, 1)) is None

    def test_delete_not_found(self, db_session, test_super_admin):
        with pytest.raises(HTTPException) as exc:
            delete_day(db_session, test_super_admin, date(2026, 7, 1))
        assert exc.value.status_code == 404


class TestResolve:
    def test_resolve_by_date(self, db_session):
        create_calendar_day(db_session, date(2026, 7, 1))
        result = resolve_by_date(db_session, date(2026, 7, 1))
        assert result is not None

    def test_resolve_dates_for_day_order(self, db_session):
        create_calendar_day(db_session, date(2026, 7, 1), day_order=1)
        create_calendar_day(db_session, date(2026, 7, 7), day_order=1)
        dates = resolve_dates_for_day_order(db_session, 1)
        assert len(dates) == 2

    def test_get_range(self, db_session):
        create_calendar_day(db_session, date(2026, 7, 1))
        create_calendar_day(db_session, date(2026, 7, 2), day_order=2)
        result = get_range(db_session, date(2026, 7, 1), date(2026, 7, 5))
        assert len(result) == 2


class TestIsWorkingDay:
    def test_working(self, db_session):
        create_calendar_day(db_session, date(2026, 7, 1), DayType.working)
        assert is_working_day(db_session, date(2026, 7, 1)) is True

    def test_holiday(self, db_session):
        create_calendar_day(db_session, date(2026, 7, 1), DayType.holiday, day_order=None)
        assert is_working_day(db_session, date(2026, 7, 1)) is False

    def test_no_entry(self, db_session):
        assert is_working_day(db_session, date(2026, 7, 1)) is False

    def test_assert_working_or_400_success(self, db_session):
        create_calendar_day(db_session, date(2026, 7, 1))
        day = assert_working_day_or_400(db_session, date(2026, 7, 1))
        assert day.day_type == DayType.working

    def test_assert_working_or_400_no_entry(self, db_session):
        with pytest.raises(HTTPException) as exc:
            assert_working_day_or_400(db_session, date(2026, 7, 1))
        assert exc.value.status_code == 400

    def test_assert_working_or_400_holiday(self, db_session):
        create_calendar_day(db_session, date(2026, 7, 1), DayType.holiday, day_order=None)
        with pytest.raises(HTTPException) as exc:
            assert_working_day_or_400(db_session, date(2026, 7, 1))
        assert exc.value.status_code == 400
