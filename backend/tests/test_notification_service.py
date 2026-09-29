"""Tests for app.services.notification_service."""
import pytest
from datetime import date, timedelta

from app.services.notification_service import (
    create_notification, list_notifications, unread_count,
    mark_read, mark_all_read, clear_all, delete_notification,
    generate_holiday_reminders,
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


class TestClearAll:
    def test_clear_all_removes_all_user_notifications(self, db_session, test_teacher):
        create_notification(db_session, test_teacher.id, "N1", "body1", "leave_approved")
        create_notification(db_session, test_teacher.id, "N2", "body2", "timetable_assigned")
        db_session.commit()

        assert len(list_notifications(db_session, test_teacher.id)) == 2
        cleared_count = clear_all(db_session, test_teacher.id)
        assert cleared_count == 2
        assert len(list_notifications(db_session, test_teacher.id)) == 0
        assert unread_count(db_session, test_teacher.id) == 0

    def test_clear_all_isolates_other_users(self, db_session, test_teacher, test_teacher2):
        create_notification(db_session, test_teacher.id, "Teacher Note", "b", "alert")
        create_notification(db_session, test_teacher2.id, "Teacher2 Note", "b", "alert")
        db_session.commit()

        clear_all(db_session, test_teacher.id)
        assert len(list_notifications(db_session, test_teacher.id)) == 0
        # Other user's notification must remain completely untouched
        other_notes = list_notifications(db_session, test_teacher2.id)
        assert len(other_notes) == 1
        assert other_notes[0].title == "Teacher2 Note"


class TestDeleteNotification:
    def test_delete_single_notification(self, db_session, test_teacher):
        n1 = create_notification(db_session, test_teacher.id, "Keep", "b", "alert")
        n2 = create_notification(db_session, test_teacher.id, "Delete Me", "b", "alert")
        db_session.commit()

        success = delete_notification(db_session, test_teacher.id, n2.id)
        assert success is True
        remaining = list_notifications(db_session, test_teacher.id)
        assert len(remaining) == 1
        assert remaining[0].id == n1.id

    def test_delete_foreign_notification_forbidden(self, db_session, test_teacher, test_teacher2):
        n = create_notification(db_session, test_teacher2.id, "Teacher2 Private", "b", "alert")
        db_session.commit()

        # Teacher attempts to delete another user's notification
        success = delete_notification(db_session, test_teacher.id, n.id)
        assert success is False
        # Notification must still exist for the owner
        assert len(list_notifications(db_session, test_teacher2.id)) == 1
