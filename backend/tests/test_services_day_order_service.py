import pytest
from datetime import date, timedelta
from unittest.mock import MagicMock
from app.services import day_order_service
from app.models.day_order_calendar import CalendarDay, DayType


class FakeQuery:
    def __init__(self, first_result=None, all_result=None):
        self.first_result = first_result
        self.all_result = all_result or []

    def filter(self, *args, **kwargs):
        return self

    def order_by(self, *args, **kwargs):
        return self

    def first(self):
        return self.first_result

    def all(self):
        return self.all_result


class FakeDB:
    def __init__(self, first_result=None, all_result=None):
        self.query_obj = FakeQuery(first_result=first_result, all_result=all_result)
        self.add = MagicMock()
        self.flush = MagicMock()
        self.commit = MagicMock()
        self.refresh = MagicMock()
        self.delete = MagicMock()

    def query(self, model):
        return self.query_obj


def make_day(**kwargs):
    defaults = {
        "id": kwargs.get("id", 1),
        "date": kwargs.get("date", date(2026, 1, 1)),
        "day_type": kwargs.get("day_type", DayType.working),
        "day_order": kwargs.get("day_order", 1),
        "is_manual_override": kwargs.get("is_manual_override", False),
        "label": kwargs.get("label", None),
        "notes": kwargs.get("notes", None),
    }
    day = CalendarDay()
    for key, value in defaults.items():
        setattr(day, key, value)
    return day


def test_next_day_order_wraps():
    assert day_order_service._next_day_order(day_order_service.DAY_ORDER_MAX) == day_order_service.DAY_ORDER_MIN


def test_get_or_404_raises():
    mock_db = FakeDB(first_result=None)
    with pytest.raises(Exception, match="No calendar entry"):
        day_order_service.get_or_404(mock_db, date(2026, 1, 2))


def test_resequence_following_days_auto_sequences(monkeypatch):
    prior = make_day(date=date(2026, 1, 1), day_order=3)
    day_a = make_day(date=date(2026, 1, 2), day_order=None)
    day_b = make_day(date=date(2026, 1, 3), day_order=None)
    mock_db = FakeDB(first_result=prior, all_result=[day_a, day_b])

    day_order_service._resequence_following_days(mock_db, date(2026, 1, 1))
    assert day_a.day_order == 4
    assert day_b.day_order == 5


def test_resequence_following_days_respects_manual_override():
    prior = make_day(date=date(2026, 1, 1), day_order=2)
    manual = make_day(date=date(2026, 1, 2), day_order=5, is_manual_override=True)
    later = make_day(date=date(2026, 1, 3), day_order=None)
    mock_db = FakeDB(first_result=prior, all_result=[manual, later])

    day_order_service._resequence_following_days(mock_db, date(2026, 1, 1))
    assert manual.day_order == 5
    assert later.day_order == 6


def test_mark_day_creates_working_day(monkeypatch):
    mock_db = FakeDB()
    monkeypatch.setattr(day_order_service, "get_day", lambda db, the_date: None)
    monkeypatch.setattr(day_order_service, "_resequence_following_days", lambda db, the_date: None)
    monkeypatch.setattr(day_order_service, "log_audit_event", lambda *args, **kwargs: MagicMock())

    day = day_order_service.mark_day(mock_db, MagicMock(id=1), date(2026, 1, 1), DayType.working)
    assert day.day_type == DayType.working
    assert day.day_order == 1
    assert day.is_manual_override is False
    mock_db.commit.assert_called_once()


def test_mark_day_creates_non_working_day(monkeypatch):
    mock_db = FakeDB()
    monkeypatch.setattr(day_order_service, "get_day", lambda db, the_date: None)
    monkeypatch.setattr(day_order_service, "_resequence_following_days", lambda db, the_date: None)
    monkeypatch.setattr(day_order_service, "log_audit_event", lambda *args, **kwargs: MagicMock())

    day = day_order_service.mark_day(mock_db, MagicMock(id=1), date(2026, 1, 2), DayType.holiday)
    assert day.day_type == DayType.holiday
    assert day.day_order is None
    mock_db.commit.assert_called_once()



def test_skip_day_order_on_non_working(monkeypatch):
    monkeypatch.setattr(day_order_service, "get_day", lambda db, the_date: make_day(day_type=DayType.holiday))
    with pytest.raises(Exception, match="Cannot assign a Day Order"):
        day_order_service.skip_day_order(MagicMock(), MagicMock(id=1), date(2026, 1, 2), 3)


def test_reassign_day_order_on_non_working(monkeypatch):
    monkeypatch.setattr(day_order_service, "get_day", lambda db, the_date: make_day(day_type=DayType.holiday))
    with pytest.raises(Exception, match="Cannot assign a Day Order"):
        day_order_service.reassign_day_order(MagicMock(), MagicMock(id=1), date(2026, 1, 2), 4)


def test_clear_override_on_non_working(monkeypatch):
    monkeypatch.setattr(day_order_service, "get_or_404", lambda db, the_date: make_day(day_type=DayType.holiday))
    with pytest.raises(Exception, match="Only working days can have Day Order overrides"):
        day_order_service.clear_override(MagicMock(), MagicMock(id=1), date(2026, 1, 2))


def test_bulk_mark_range_errors_for_working():
    with pytest.raises(Exception, match="Bulk-mark is for non-working day types only"):
        day_order_service.bulk_mark_range(MagicMock(), MagicMock(id=1), date(2026, 1, 1), date(2026, 1, 2), DayType.working)


def test_bulk_mark_range_non_working(monkeypatch):
    created = []
    def fake_mark(db, actor, d, day_type, label=None, notes=None):
        day = CalendarDay()
        day.date = d
        day.day_type = day_type
        created.append(day)
        return day
    monkeypatch.setattr(day_order_service, "mark_day", fake_mark)

    result = day_order_service.bulk_mark_range(MagicMock(), MagicMock(id=1), date(2026, 1, 1), date(2026, 1, 3), DayType.holiday)
    assert len(result) == 3
    assert all(item.day_type == DayType.holiday for item in result)
