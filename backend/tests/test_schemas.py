"""Tests for Pydantic schema validation."""
import pytest
from datetime import date
from pydantic import ValidationError

from app.schemas.leave import LeaveCreate, LeaveBatchCreate
from app.schemas.timetable import TimetableSlotCreate
from app.schemas.admin import FirstLoginSetupRequest, SecondaryAdminCreate, FactoryResetRequest
from app.schemas.academic_calendar import (
    AcademicYearCreate, SemesterCreate, CalendarDayMark, CalendarDayBulkMark,
    DayOrderAssign, DayOrderSkip,
)
from app.schemas.subject import SubjectCreate
from app.schemas.room import RoomCreate
from app.schemas.class_ import ClassCreate
from app.schemas.user import UserCreate
from app.schemas.substitution import SubstitutionPreferenceUpdate, CampusOperationsModeSet
from app.schemas.validators import validate_period_number, validate_day_order
from app.models.day_order_calendar import DayType
from app.models.user import Role


class TestPeriodDayOrderValidators:
    def test_valid_period(self):
        assert validate_period_number(1) == 1
        assert validate_period_number(5) == 5

    def test_invalid_period_low(self):
        with pytest.raises(ValueError):
            validate_period_number(0)

    def test_invalid_period_high(self):
        with pytest.raises(ValueError):
            validate_period_number(6)

    def test_valid_day_order(self):
        assert validate_day_order(1) == 1
        assert validate_day_order(6) == 6

    def test_invalid_day_order(self):
        with pytest.raises(ValueError):
            validate_day_order(0)
        with pytest.raises(ValueError):
            validate_day_order(7)


class TestLeaveSchemas:
    def test_leave_create_valid(self):
        lc = LeaveCreate(date=date(2026, 7, 1), period_number=3, reason="Sick")
        assert lc.period_number == 3

    def test_leave_create_invalid_period(self):
        with pytest.raises(ValidationError):
            LeaveCreate(date=date(2026, 7, 1), period_number=0, reason="Sick")

    def test_batch_create_valid_periods(self):
        bc = LeaveBatchCreate(date=date(2026, 7, 1), period_numbers=[1, 3], reason="Trip")
        assert bc.period_numbers == [1, 3]

    def test_batch_create_invalid_period(self):
        with pytest.raises(ValidationError):
            LeaveBatchCreate(date=date(2026, 7, 1), period_numbers=[0], reason="Trip")


class TestTimetableSchemas:
    def test_valid_slot(self):
        slot = TimetableSlotCreate(
            teacher_id=1, subject_id=1, class_id=1, day_order=1, period_number=1,
        )
        assert slot.day_order == 1

    def test_invalid_day_order(self):
        with pytest.raises(ValidationError):
            TimetableSlotCreate(
                teacher_id=1, subject_id=1, class_id=1, day_order=7, period_number=1,
            )

    def test_invalid_period(self):
        with pytest.raises(ValidationError):
            TimetableSlotCreate(
                teacher_id=1, subject_id=1, class_id=1, day_order=1, period_number=6,
            )


class TestAdminSchemas:
    def test_first_login_password_mismatch(self):
        with pytest.raises(ValidationError, match="match"):
            FirstLoginSetupRequest(
                new_username="newadmin", new_password="Secure123", confirm_password="Different1",
            )

    def test_first_login_short_username(self):
        with pytest.raises(ValidationError, match="3 characters"):
            FirstLoginSetupRequest(
                new_username="ab", new_password="Secure123", confirm_password="Secure123",
            )

    def test_first_login_default_username(self):
        with pytest.raises(ValidationError, match="admin"):
            FirstLoginSetupRequest(
                new_username="admin", new_password="Secure123", confirm_password="Secure123",
            )

    def test_secondary_admin_weak_password(self):
        with pytest.raises(ValidationError):
            SecondaryAdminCreate(name="Admin", username="newadmin", password="weak")

    def test_factory_reset_wrong_confirmation(self):
        with pytest.raises(ValidationError, match="RESET EVERYTHING"):
            FactoryResetRequest(password="pw", confirmation_text="reset")

    def test_factory_reset_valid(self):
        fr = FactoryResetRequest(password="pw", confirmation_text="RESET EVERYTHING")
        assert fr.confirmation_text == "RESET EVERYTHING"


class TestSubjectSchema:
    def test_credits_must_be_positive(self):
        with pytest.raises(ValidationError, match="positive"):
            SubjectCreate(code="X", name="X", credits=0, department_id=1, semester=1)

    def test_semester_range(self):
        with pytest.raises(ValidationError, match="between 1 and 8"):
            SubjectCreate(code="X", name="X", credits=1, department_id=1, semester=9)


class TestRoomSchema:
    def test_capacity_must_be_positive(self):
        with pytest.raises(ValidationError, match="positive"):
            RoomCreate(room_number="R1", capacity=0)


class TestClassSchema:
    def test_semester_range(self):
        with pytest.raises(ValidationError, match="between 1 and 8"):
            ClassCreate(name="A", section="A", department_id=1, semester=0)


class TestUserCreateSchema:
    def test_admin_role_rejected(self):
        with pytest.raises(ValidationError, match="Secondary Admin"):
            UserCreate(
                name="Bad", email="bad@test.com", password="Test1234", role=Role.admin,
            )


class TestAcademicCalendarSchemas:
    def test_academic_year_end_before_start(self):
        with pytest.raises(ValidationError, match="after"):
            AcademicYearCreate(name="X", start_date=date(2027, 1, 1), end_date=date(2026, 1, 1))

    def test_semester_end_before_start(self):
        with pytest.raises(ValidationError, match="after"):
            SemesterCreate(academic_year_id=1, name="X", start_date=date(2027, 1, 1), end_date=date(2026, 1, 1))

    def test_bulk_mark_working_rejected(self):
        with pytest.raises(ValidationError, match="non-working"):
            CalendarDayBulkMark(
                start_date=date(2026, 7, 1), end_date=date(2026, 7, 5),
                day_type=DayType.working,
            )


class TestSubstitutionSchemas:
    def test_negative_weekly_cap(self):
        with pytest.raises(ValidationError, match="negative"):
            SubstitutionPreferenceUpdate(max_weekly_substitutions=-1)

    def test_invalid_mode(self):
        with pytest.raises(ValidationError):
            CampusOperationsModeSet(mode="invalid_mode")

    def test_valid_mode(self):
        m = CampusOperationsModeSet(mode="autonomous")
        assert m.mode == "autonomous"
