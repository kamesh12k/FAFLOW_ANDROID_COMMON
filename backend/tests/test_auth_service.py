"""Tests for app.services.auth_service."""
import pytest
from fastapi import HTTPException

from app.services.auth_service import register_teacher, create_user_by_admin, login
from app.schemas.user import UserRegister, UserCreate
from app.models.user import Role
from app.models.credit import TeacherCredit
from tests.conftest import _make_user, create_department


class TestRegisterTeacher:
    def test_success(self, db_session):
        dept = create_department(db_session)
        data = UserRegister(name="New", email="new@test.com", password="Testpass1", department="CS", department_id=dept.id)
        user = register_teacher(data, db_session)
        assert user.email == "new@test.com"
        assert user.role == Role.teacher
        # Credit balance initialized
        credit = db_session.query(TeacherCredit).filter(TeacherCredit.teacher_id == user.id).first()
        assert credit is not None
        assert credit.balance == 0

    def test_duplicate_email(self, db_session, test_teacher):
        data = UserRegister(name="Dup", email="teacher@test.com", password="Testpass1", department_id=test_teacher.department_id)
        with pytest.raises(HTTPException) as exc:
            register_teacher(data, db_session)
        assert exc.value.status_code == 400
        assert "already registered" in exc.value.detail


class TestCreateUserByAdmin:
    def test_success(self, db_session):
        dept = create_department(db_session)
        data = UserCreate(name="AdminCreated", email="ac@test.com", password="Testpass1", department="CS", department_id=dept.id)
        user = create_user_by_admin(data, db_session)
        assert user.email == "ac@test.com"
        assert user.role == Role.teacher

    def test_duplicate_email(self, db_session, test_teacher):
        data = UserCreate(name="Dup", email="teacher@test.com", password="Testpass1", department_id=test_teacher.department_id)
        with pytest.raises(HTTPException) as exc:
            create_user_by_admin(data, db_session)
        assert exc.value.status_code == 400


class TestLogin:
    def test_login_with_email(self, db_session, test_teacher):
        result = login("teacher@test.com", "Testpass1", db_session)
        assert "access_token" in result
        assert result["user"].id == test_teacher.id

    def test_login_with_username(self, db_session, test_super_admin):
        result = login("superadmin", "Testpass1", db_session)
        assert "access_token" in result

    def test_wrong_password(self, db_session, test_teacher):
        with pytest.raises(HTTPException) as exc:
            login("teacher@test.com", "WrongPass1", db_session)
        assert exc.value.status_code == 401

    def test_nonexistent_user(self, db_session):
        with pytest.raises(HTTPException) as exc:
            login("nobody@test.com", "Testpass1", db_session)
        assert exc.value.status_code == 401

    def test_inactive_user(self, db_session):
        _make_user(db_session, email="inactive@test.com", is_active=False)
        with pytest.raises(HTTPException) as exc:
            login("inactive@test.com", "Testpass1", db_session)
        assert exc.value.status_code == 401
