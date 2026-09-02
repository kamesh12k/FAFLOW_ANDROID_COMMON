"""Tests for app.services.academic_calendar_service."""
import pytest
from datetime import date
from fastapi import HTTPException

from app.services.academic_calendar_service import (
    list_academic_years, create_academic_year,
    list_semesters, create_semester,
)
from app.schemas.academic_calendar import AcademicYearCreate, SemesterCreate
from tests.conftest import create_academic_year as factory_year


class TestAcademicYearService:
    def test_list_empty(self, db_session):
        assert list_academic_years(db_session) == []

    def test_create_and_list(self, db_session, test_super_admin):
        data = AcademicYearCreate(name="2026-2027", start_date=date(2026, 6, 1), end_date=date(2027, 5, 31))
        year = create_academic_year(data, test_super_admin, db_session)
        assert year.name == "2026-2027"
        assert len(list_academic_years(db_session)) == 1

    def test_duplicate_name(self, db_session, test_super_admin):
        factory_year(db_session, name="2026-2027")
        data = AcademicYearCreate(name="2026-2027", start_date=date(2028, 1, 1), end_date=date(2028, 12, 31))
        with pytest.raises(HTTPException) as exc:
            create_academic_year(data, test_super_admin, db_session)
        assert exc.value.status_code == 400

    def test_overlapping_dates(self, db_session, test_super_admin):
        factory_year(db_session, name="2026-2027", start_date=date(2026, 6, 1), end_date=date(2027, 5, 31))
        data = AcademicYearCreate(name="Overlap", start_date=date(2027, 1, 1), end_date=date(2027, 12, 31))
        with pytest.raises(HTTPException) as exc:
            create_academic_year(data, test_super_admin, db_session)
        assert exc.value.status_code == 400


class TestSemesterService:
    def test_create_and_list(self, db_session, test_super_admin):
        year = factory_year(db_session)
        data = SemesterCreate(
            academic_year_id=year.id, name="Odd",
            start_date=date(2026, 6, 1), end_date=date(2026, 11, 30),
        )
        sem = create_semester(data, test_super_admin, db_session)
        assert sem.name == "Odd"
        assert len(list_semesters(db_session)) == 1

    def test_year_not_found(self, db_session, test_super_admin):
        data = SemesterCreate(
            academic_year_id=999, name="X",
            start_date=date(2026, 1, 1), end_date=date(2026, 6, 1),
        )
        with pytest.raises(HTTPException) as exc:
            create_semester(data, test_super_admin, db_session)
        assert exc.value.status_code == 404

    def test_outside_year_range(self, db_session, test_super_admin):
        year = factory_year(db_session, start_date=date(2026, 6, 1), end_date=date(2027, 5, 31))
        data = SemesterCreate(
            academic_year_id=year.id, name="Bad",
            start_date=date(2025, 1, 1), end_date=date(2025, 6, 1),
        )
        with pytest.raises(HTTPException) as exc:
            create_semester(data, test_super_admin, db_session)
        assert exc.value.status_code == 400

    def test_overlap(self, db_session, test_super_admin):
        year = factory_year(db_session)
        data1 = SemesterCreate(
            academic_year_id=year.id, name="S1",
            start_date=date(2026, 6, 1), end_date=date(2026, 11, 30),
        )
        create_semester(data1, test_super_admin, db_session)
        data2 = SemesterCreate(
            academic_year_id=year.id, name="S2",
            start_date=date(2026, 10, 1), end_date=date(2027, 3, 31),
        )
        with pytest.raises(HTTPException) as exc:
            create_semester(data2, test_super_admin, db_session)
        assert exc.value.status_code == 400
