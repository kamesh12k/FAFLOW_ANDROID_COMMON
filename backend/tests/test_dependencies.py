"""Tests for app.core.dependencies — auth guards."""
import pytest
from unittest.mock import MagicMock
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.core.security import create_access_token
from app.core.dependencies import (
    get_current_user, require_credentials_set,
    require_admin, require_teacher, require_super_admin,
)
from app.models.user import User, Role, AdminLevel
from tests.conftest import _make_user


class TestGetCurrentUser:
    def test_valid_token(self, db_session, test_teacher):
        token = create_access_token({"sub": str(test_teacher.id), "role": "teacher"})
        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        user = get_current_user(creds, db_session)
        assert user.id == test_teacher.id

    def test_invalid_token_raises(self, db_session):
        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="bad-token")
        with pytest.raises(HTTPException) as exc:
            get_current_user(creds, db_session)
        assert exc.value.status_code == 401

    def test_user_not_found_raises(self, db_session):
        token = create_access_token({"sub": "9999", "role": "teacher"})
        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        with pytest.raises(HTTPException) as exc:
            get_current_user(creds, db_session)
        assert exc.value.status_code == 401

    def test_inactive_user_raises(self, db_session):
        user = _make_user(db_session, email="inactive@test.com", is_active=False)
        token = create_access_token({"sub": str(user.id), "role": "teacher"})
        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        with pytest.raises(HTTPException) as exc:
            get_current_user(creds, db_session)
        assert exc.value.status_code == 401


class TestRequireCredentialsSet:
    def test_must_change_blocks(self, db_session):
        user = _make_user(
            db_session, email="mustchange@test.com",
            must_change_credentials=True,
            role=Role.admin, admin_level=AdminLevel.super_admin,
            username="mustchange",
        )
        with pytest.raises(HTTPException) as exc:
            require_credentials_set(user)
        assert exc.value.status_code == 403
        assert "MUST_CHANGE_CREDENTIALS" in exc.value.detail

    def test_normal_user_passes(self, test_teacher):
        result = require_credentials_set(test_teacher)
        assert result.id == test_teacher.id


class TestRoleGuards:
    def test_require_admin_blocks_teacher(self, test_teacher):
        with pytest.raises(HTTPException) as exc:
            require_admin(test_teacher)
        assert exc.value.status_code == 403

    def test_require_admin_allows_admin(self, test_super_admin):
        result = require_admin(test_super_admin)
        assert result.id == test_super_admin.id

    def test_require_super_admin_blocks_secondary(self, test_secondary_admin):
        with pytest.raises(HTTPException) as exc:
            require_super_admin(test_secondary_admin)
        assert exc.value.status_code == 403

    def test_require_super_admin_allows_super(self, test_super_admin):
        result = require_super_admin(test_super_admin)
        assert result.id == test_super_admin.id

    def test_require_teacher_blocks_principal(self, db_session):
        principal = _make_user(db_session, role=Role.principal)
        with pytest.raises(HTTPException) as exc:
            require_teacher(principal)
        assert exc.value.status_code == 403

    def test_require_teacher_allows_teacher(self, test_teacher):
        result = require_teacher(test_teacher)
        assert result.id == test_teacher.id
