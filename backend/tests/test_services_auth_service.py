import pytest
from fastapi import HTTPException
from unittest.mock import MagicMock
from app.services import auth_service
from app.schemas.user import UserRegister, UserCreate
from app.models.user import Role


class FakeUser:
    email = None
    username = None

    def __init__(self, name, email, password_hash, role, department, department_id=None, **kwargs):
        self.name = name
        self.email = email
        self.password_hash = password_hash
        self.role = role
        self.department = department
        self.department_id = department_id
        self.id = 1




class FakeCredit:
    def __init__(self, teacher_id, balance):
        self.teacher_id = teacher_id
        self.balance = balance


def test_register_teacher_email_already_registered(mock_db):
    mock_db.query.return_value.filter.return_value.first.return_value = MagicMock()
    data = UserRegister(name="Teacher", email="teach@example.com", password="StrongPass1", department="Math")

    with pytest.raises(HTTPException, match="Email already registered"):
        auth_service.register_teacher(data, mock_db)


def test_register_teacher_creates_user(monkeypatch, mock_db):
    from unittest.mock import MagicMock
    dept_mock = MagicMock(name="DepartmentMock")
    dept_mock.name = "Math"
    mock_db.query.return_value.filter.return_value.first.side_effect = [None, dept_mock]
    monkeypatch.setattr(auth_service, "User", FakeUser)
    monkeypatch.setattr(auth_service, "TeacherCredit", FakeCredit)
    monkeypatch.setattr(auth_service, "hash_password", lambda password: "hashed")

    data = UserRegister(name="Teacher", email="teach@example.com", password="StrongPass1", department="Math", department_id=1)
    user = auth_service.register_teacher(data, mock_db)

    assert user.email == "teach@example.com"
    assert user.password_hash == "hashed"
    assert user.role == Role.teacher
    from unittest.mock import ANY
    mock_db.add.assert_any_call(user)
    mock_db.add.assert_any_call(ANY)
    mock_db.commit.assert_called_once()
    mock_db.refresh.assert_called_once_with(user)


def test_login_invalid_credentials(mock_db):
    mock_db.query.return_value.filter.return_value.first.return_value = None
    with pytest.raises(HTTPException, match="Incorrect username/email or password"):
        auth_service.login("user@example.com", "badpass", mock_db)


def test_login_disabled_account(monkeypatch, mock_db, user_factory):
    user = user_factory(is_active=False)
    mock_db.query.return_value.filter.return_value.first.return_value = user
    monkeypatch.setattr(auth_service, "verify_password", lambda plain, hashed: True)

    with pytest.raises(HTTPException, match="disabled"):
        auth_service.login("user@example.com", "password", mock_db)


def test_login_succeeds_and_generates_token(monkeypatch, mock_db, user_factory):
    user = user_factory()
    mock_db.query.return_value.filter.return_value.first.return_value = user
    monkeypatch.setattr(auth_service, "verify_password", lambda plain, hashed: True)
    monkeypatch.setattr(auth_service, "create_access_token", lambda data: "token")
    generate_spy = MagicMock()
    monkeypatch.setattr(auth_service.notification_service, "generate_holiday_reminders", generate_spy)

    token_data = auth_service.login("user@example.com", "password", mock_db)
    assert token_data["access_token"] == "token"
    assert token_data["token_type"] == "bearer"
    assert token_data["user"] is user
    generate_spy.assert_called_once()


def test_login_notification_failure_rolls_back(monkeypatch, mock_db, user_factory):
    user = user_factory()
    mock_db.query.return_value.filter.return_value.first.return_value = user
    monkeypatch.setattr(auth_service, "verify_password", lambda plain, hashed: True)
    monkeypatch.setattr(auth_service, "create_access_token", lambda data: "token")
    def raise_exc(db, user_id, today):
        raise RuntimeError("notification failure")
    monkeypatch.setattr(auth_service.notification_service, "generate_holiday_reminders", raise_exc)

    token_data = auth_service.login("user@example.com", "password", mock_db)
    assert token_data["access_token"] == "token"
    mock_db.rollback.assert_called_once()
