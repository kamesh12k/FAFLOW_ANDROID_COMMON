import pytest
from unittest.mock import MagicMock
from fastapi import HTTPException
from app.core import dependencies
from app.models.user import Role, AdminLevel


def make_user(**kwargs):
    user = MagicMock()
    user.id = kwargs.get("id", 1)
    user.is_active = kwargs.get("is_active", True)
    user.must_change_credentials = kwargs.get("must_change_credentials", False)
    user.role = kwargs.get("role", Role.teacher)
    user.admin_level = kwargs.get("admin_level", None)
    return user


def test_get_current_user_success(monkeypatch):
    credentials = MagicMock()
    credentials.credentials = "token"
    mock_db = MagicMock()
    mock_user = make_user()
    mock_db.query.return_value.filter.return_value.first.return_value = mock_user
    monkeypatch.setattr(dependencies, "decode_token", lambda token: {"sub": "1"})

    user = dependencies.get_current_user(credentials=credentials, db=mock_db)
    assert user is mock_user


def test_get_current_user_invalid_token(monkeypatch):
    credentials = MagicMock()
    credentials.credentials = "token"
    mock_db = MagicMock()
    monkeypatch.setattr(dependencies, "decode_token", lambda token: {})

    with pytest.raises(HTTPException, match="Invalid token"):
        dependencies.get_current_user(credentials=credentials, db=mock_db)


def test_get_current_user_missing_user(monkeypatch):
    credentials = MagicMock()
    credentials.credentials = "token"
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = None
    monkeypatch.setattr(dependencies, "decode_token", lambda token: {"sub": "1"})

    with pytest.raises(HTTPException, match="User not found"):
        dependencies.get_current_user(credentials=credentials, db=mock_db)


def test_get_current_user_inactive_user(monkeypatch):
    credentials = MagicMock()
    credentials.credentials = "token"
    mock_db = MagicMock()
    mock_user = make_user(is_active=False)
    mock_db.query.return_value.filter.return_value.first.return_value = mock_user
    monkeypatch.setattr(dependencies, "decode_token", lambda token: {"sub": "1"})

    with pytest.raises(HTTPException, match="Account disabled"):
        dependencies.get_current_user(credentials=credentials, db=mock_db)


def test_require_credentials_set_blocks_if_user_must_change():
    user = make_user(must_change_credentials=True)
    with pytest.raises(HTTPException, match="MUST_CHANGE_CREDENTIALS"):
        dependencies.require_credentials_set(current_user=user)


def test_role_requirements():
    teacher = make_user(role=Role.teacher)
    admin = make_user(role=Role.admin, admin_level=AdminLevel.super_admin)
    with pytest.raises(HTTPException, match="Admin access required"):
        dependencies.require_admin(current_user=teacher)
    assert dependencies.require_admin(current_user=admin) is admin
    with pytest.raises(HTTPException, match="Super Admin access required"):
        dependencies.require_super_admin(current_user=teacher)
    assert dependencies.require_super_admin(current_user=admin) is admin
    principal = make_user(role=Role.principal)
    with pytest.raises(HTTPException, match="Teacher access required"):
        dependencies.require_teacher(current_user=principal)
    assert dependencies.require_teacher(current_user=teacher) is teacher
