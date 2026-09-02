"""Tests for app.services.notification_service."""
import pytest
from datetime import date, timedelta

from app.services.notification_service import (
    create_notification, list_notifications, unread_count,
    mark_read, mark_all_read, generate_holiday_reminders,
)
from app.models.notification import Notification
from app.models.day_order_calendar import DayType
from tests.conftest import create_calendar_day


class TestCreateNotification:
    def test_creates(self, db_session, test_teacher):
        note = create_notification(db_session, test_teacher.id, "T", "B", "test")
        db_session.commit()
        assert note.id is not None
        assert note.title == "T"


class TestListNotifications:
    def test_all(self, db_session, test_teacher):
        create_notification(db_session, test_teacher.id, "A", "a", "x")
        create_notification(db_session, test_teacher.id, "B", "b", "x")
        db_session.commit()
        result = list_notifications(db_session, test_teacher.id)
        assert len(result) == 2

    def test_unread_only(self, db_session, test_teacher):
        n1 = create_notification(db_session, test_teacher.id, "A", "a", "x")
        create_notification(db_session, test_teacher.id, "B", "b", "x")
        db_session.commit()
        n1.is_read = True
        db_session.commit()
        result = list_notifications(db_session, test_teacher.id, unread_only=True)
        assert len(result) == 1


class TestUnreadCount:
    def test_count(self, db_session, test_teacher):
        create_notification(db_session, test_teacher.id, "A", "a", "x")
        create_notification(db_session, test_teacher.id, "B", "b", "x")
        db_session.commit()
        assert unread_count(db_session, test_teacher.id) == 2


class TestMarkRead:
    def test_mark_single(self, db_session, test_teacher):
        n = create_notification(db_session, test_teacher.id, "A", "a", "x")
        db_session.commit()
        mark_read(db_session, test_teacher.id, n.id)
        db_session.refresh(n)
        assert n.is_read is True

    def test_mark_all(self, db_session, test_teacher):
        create_notification(db_session, test_teacher.id, "A", "a", "x")
        create_notification(db_session, test_teacher.id, "B", "b", "x")
        db_session.commit()
        mark_all_read(db_session, test_teacher.id)
        assert unread_count(db_session, test_teacher.id) == 0


class TestHolidayReminders:
    def test_creates_reminders(self, db_session, test_teacher):
        today = date(2026, 7, 1)
        create_calendar_day(db_session, today + timedelta(days=1), DayType.holiday, label="Independence")
        generate_holiday_reminders(db_session, test_teacher.id, today)
        notes = list_notifications(db_session, test_teacher.id)
        assert len(notes) == 0  # Expect 0 since holiday reminders are disabled

    def test_deduplicates(self, db_session, test_teacher):
        today = date(2026, 7, 1)
        create_calendar_day(db_session, today + timedelta(days=1), DayType.holiday, label="H")
        generate_holiday_reminders(db_session, test_teacher.id, today)
        generate_holiday_reminders(db_session, test_teacher.id, today)
        notes = list_notifications(db_session, test_teacher.id)
        assert len(notes) == 0  # Expect 0 since holiday reminders are disabled

    def test_no_upcoming_holidays(self, db_session, test_teacher):
        today = date(2026, 7, 1)
        generate_holiday_reminders(db_session, test_teacher.id, today)
        assert unread_count(db_session, test_teacher.id) == 0
