"""Tests for app.services.credit_service."""
import pytest
from datetime import date


from app.services.credit_service import (
    apply_credit_change, get_balance, get_transactions,
    get_all_transactions, get_credit_report, get_faculty_workload_report,
)
from app.models.credit import TeacherCredit, CreditTransaction
from app.models.user import Role
from app.models.day_order_calendar import DayType
from tests.conftest import (
    _make_user, create_teacher_credit, create_calendar_day,
    create_timetable_slot, create_department, create_subject, create_class,
)


class TestApplyCreditChange:
    def test_existing_balance(self, db_session, test_teacher):
        create_teacher_credit(db_session, test_teacher.id, balance=5)
        apply_credit_change(test_teacher.id, -1, "Leave", None, db_session)
        db_session.commit()
        assert get_balance(test_teacher.id, db_session) == 4

    def test_auto_creates_balance(self, db_session, test_teacher):
        apply_credit_change(test_teacher.id, 1, "Sub", None, db_session)
        db_session.commit()
        assert get_balance(test_teacher.id, db_session) == 1

    def test_records_transaction(self, db_session, test_teacher):
        create_teacher_credit(db_session, test_teacher.id)
        apply_credit_change(test_teacher.id, 1, "Test", None, db_session)
        db_session.commit()
        txns = get_transactions(test_teacher.id, db_session)
        assert len(txns) == 1
        assert txns[0].change == 1
        assert txns[0].reason == "Test"


class TestGetBalance:
    def test_no_credit_returns_zero(self, db_session, test_teacher):
        assert get_balance(test_teacher.id, db_session) == 0

    def test_with_credit(self, db_session, test_teacher):
        create_teacher_credit(db_session, test_teacher.id, balance=10)
        assert get_balance(test_teacher.id, db_session) == 10


class TestGetTransactions:
    def test_all_transactions(self, db_session, test_teacher, test_teacher2):
        create_teacher_credit(db_session, test_teacher.id)
        create_teacher_credit(db_session, test_teacher2.id)
        apply_credit_change(test_teacher.id, 1, "A", None, db_session)
        apply_credit_change(test_teacher2.id, 1, "B", None, db_session)
        db_session.commit()
        all_txns = get_all_transactions(db_session)
        assert len(all_txns) == 2


class TestCreditReport:
    def test_report(self, db_session, test_teacher):
        create_teacher_credit(db_session, test_teacher.id, balance=3)
        report = get_credit_report(db_session)
        assert len(report) == 1
        assert report[0].balance == 3
        assert report[0].name == test_teacher.name


class TestWorkloadReport:
    def test_workload_report(self, db_session):
        t = _make_user(db_session, name="T", email="t@test.com")
        create_teacher_credit(db_session, t.id, balance=2)
        dept = create_department(db_session)
        subj = create_subject(db_session, department_id=dept.id)
        cls = create_class(db_session, department_id=dept.id)
        create_timetable_slot(db_session, t.id, subj.id, cls.id, day_order=1, period_number=1)
        create_calendar_day(db_session, date(2026, 7, 1), DayType.working, day_order=1)
        create_calendar_day(db_session, date(2026, 7, 2), DayType.working, day_order=1)
        report = get_faculty_workload_report(db_session)
        assert len(report) == 1
        assert report[0].teacher_id == t.id
        assert report[0].total_periods == 2
        assert report[0].credit_balance == 2
