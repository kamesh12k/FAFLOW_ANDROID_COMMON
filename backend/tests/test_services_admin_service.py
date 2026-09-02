import pytest
from fastapi import HTTPException
from unittest.mock import MagicMock
from app.services import admin_service
from app.schemas.admin import FirstLoginSetupRequest, SecondaryAdminCreate
from app.models.user import Role, AdminLevel, User


def test_bootstrap_default_super_admin_creates_when_absent(monkeypatch):
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = None
    monkeypatch.setattr(admin_service, "hash_password", lambda password: "hashed")

    admin_service.bootstrap_default_super_admin(mock_db)
    mock_db.add.assert_called_once()
    mock_db.commit.assert_called_once()


def test_complete_first_login_setup_not_allowed_when_already_set(user_factory):
    current_user = user_factory(must_change_credentials=False, role=Role.admin)
    data = FirstLoginSetupRequest(new_username="admin2", new_password="NewPassword1", confirm_password="NewPassword1")
    with pytest.raises(HTTPException, match="already been set"):
        admin_service.complete_first_login_setup(current_user, data, MagicMock())


def test_complete_first_login_setup_username_taken(monkeypatch, user_factory):
    current_user = user_factory(must_change_credentials=True, id=1, role=Role.admin)
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = MagicMock()
    data = FirstLoginSetupRequest(new_username="admin2", new_password="NewPassword1", confirm_password="NewPassword1")
    with pytest.raises(HTTPException, match="already taken"):
        admin_service.complete_first_login_setup(current_user, data, mock_db)


def test_complete_first_login_setup_teacher_email_success(monkeypatch, user_factory):
    current_user = user_factory(must_change_credentials=True, id=2, role=Role.teacher)
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = None
    monkeypatch.setattr(admin_service, "hash_password", lambda password: "hashed")
    monkeypatch.setattr(admin_service, "create_access_token", lambda data: "token")
    monkeypatch.setattr(admin_service, "log_audit_event", lambda *args, **kwargs: MagicMock())

    result = admin_service.complete_first_login_setup(
        current_user,
        FirstLoginSetupRequest(new_email="new_teacher@college.edu", new_password="NewPassword1", confirm_password="NewPassword1"),
        mock_db
    )
    assert result["access_token"] == "token"
    assert current_user.email == "new_teacher@college.edu"
    assert current_user.must_change_credentials is False



def test_complete_first_login_setup_success(monkeypatch, user_factory):
    current_user = user_factory(must_change_credentials=True, id=1, role=Role.admin)
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = None
    monkeypatch.setattr(admin_service, "hash_password", lambda password: "hashed")
    monkeypatch.setattr(admin_service, "create_access_token", lambda data: "token")
    monkeypatch.setattr(admin_service, "log_audit_event", lambda *args, **kwargs: MagicMock())

    result = admin_service.complete_first_login_setup(current_user, FirstLoginSetupRequest(new_username="admin2", new_password="NewPassword1", confirm_password="NewPassword1"), mock_db)
    assert result["access_token"] == "token"
    assert current_user.username == "admin2"
    assert current_user.must_change_credentials is False



def test_create_secondary_admin_limit_reached(monkeypatch):
    mock_db = MagicMock()
    mock_query = mock_db.query.return_value
    mock_query.filter.return_value.count.return_value = admin_service.MAX_SECONDARY_ADMINS
    data = SecondaryAdminCreate(name="Admin", username="admin2", password="NewPass1")
    with pytest.raises(HTTPException, match="Maximum of"):
        admin_service.create_secondary_admin(data, MagicMock(id=1), mock_db)


def test_create_secondary_admin_username_taken(monkeypatch):
    mock_db = MagicMock()
    mock_query = mock_db.query.return_value
    mock_query.filter.return_value.count.return_value = 0
    mock_query.filter.return_value.first.return_value = MagicMock()
    data = SecondaryAdminCreate(name="Admin", username="admin2", password="NewPass1")
    with pytest.raises(HTTPException, match="username is already taken"):
        admin_service.create_secondary_admin(data, MagicMock(id=1), mock_db)


def test_create_secondary_admin_success(monkeypatch):
    mock_db = MagicMock()
    mock_query = mock_db.query.return_value
    mock_query.filter.return_value.count.return_value = 0
    mock_query.filter.return_value.first.return_value = None
    monkeypatch.setattr(admin_service, "hash_password", lambda password: "hashed")
    monkeypatch.setattr(admin_service, "log_audit_event", lambda *args, **kwargs: MagicMock())

    data = SecondaryAdminCreate(name="Admin", username="admin2", password="NewPass1")
    admin = admin_service.create_secondary_admin(data, MagicMock(id=1), mock_db)
    assert admin.username == "admin2"
    assert admin.password_hash == "hashed"
    assert admin.admin_level == AdminLevel.secondary_admin


def test_set_secondary_admin_active_not_found():
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = None
    with pytest.raises(HTTPException, match="not found"):
        admin_service.set_secondary_admin_active(1, True, MagicMock(), mock_db)


def test_set_secondary_admin_active_wrong_level(user_factory):
    target = user_factory(admin_level=None)
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = target
    with pytest.raises(HTTPException, match="Only Secondary Admin accounts"):
        admin_service.set_secondary_admin_active(1, True, MagicMock(id=1), mock_db)


def test_set_secondary_admin_active_limit(monkeypatch, user_factory):
    target = user_factory(admin_level=AdminLevel.secondary_admin, is_active=False, id=2)
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = target
    mock_db.query.return_value.filter.return_value.count.return_value = admin_service.MAX_SECONDARY_ADMINS
    with pytest.raises(HTTPException, match="Maximum of"):
        admin_service.set_secondary_admin_active(2, True, MagicMock(id=1), mock_db)


def test_set_secondary_admin_active_success(monkeypatch, user_factory):
    target = user_factory(admin_level=AdminLevel.secondary_admin, is_active=False, id=2)
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = target
    mock_db.query.return_value.filter.return_value.count.return_value = 0
    monkeypatch.setattr(admin_service, "log_audit_event", lambda *args, **kwargs: MagicMock())

    result = admin_service.set_secondary_admin_active(2, True, MagicMock(id=1), mock_db)
    assert result is target
    assert result.is_active is True
