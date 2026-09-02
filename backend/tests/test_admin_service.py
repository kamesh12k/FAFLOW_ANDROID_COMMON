"""Tests for app.services.admin_service."""
import pytest
from fastapi import HTTPException

from app.services.admin_service import (
    bootstrap_default_super_admin, complete_first_login_setup,
    list_admins, create_secondary_admin, set_secondary_admin_active,
    log_audit_event, list_audit_logs,
)
from app.schemas.admin import FirstLoginSetupRequest, SecondaryAdminCreate
from app.models.user import User, Role, AdminLevel
from app.models.audit_log import AuditLog
from tests.conftest import _make_user


class TestBootstrap:
    def test_creates_when_none_exist(self, db_session):
        bootstrap_default_super_admin(db_session)
        admin = db_session.query(User).filter(User.role == Role.system_admin).first()
        assert admin is not None
        assert admin.username == "admin"
        assert admin.must_change_credentials is True

    def test_noop_when_exists(self, db_session):
        _make_user(db_session, email=None, username="admin", role=Role.system_admin)
        bootstrap_default_super_admin(db_session)
        count = db_session.query(User).filter(User.username == "admin").count()
        assert count == 1


class TestFirstLoginSetup:
    def test_success(self, db_session):
        admin = _make_user(
            db_session, email=None, username="admin",
            role=Role.admin, admin_level=AdminLevel.super_admin,
            must_change_credentials=True,
        )
        data = FirstLoginSetupRequest(
            new_username="realadmin", new_password="Newpass123", confirm_password="Newpass123",
        )
        result = complete_first_login_setup(admin, data, db_session)
        assert "access_token" in result
        assert admin.must_change_credentials is False
        assert admin.username == "realadmin"

    def test_already_set_raises(self, db_session, test_super_admin):
        data = FirstLoginSetupRequest(
            new_username="newname", new_password="Newpass123", confirm_password="Newpass123",
        )
        with pytest.raises(HTTPException) as exc:
            complete_first_login_setup(test_super_admin, data, db_session)
        assert exc.value.status_code == 400

    def test_username_taken(self, db_session):
        _make_user(db_session, email=None, username="existing", role=Role.admin,
                   admin_level=AdminLevel.secondary_admin)
        admin = _make_user(
            db_session, email=None, username="admin2",
            role=Role.admin, admin_level=AdminLevel.super_admin,
            must_change_credentials=True,
        )
        data = FirstLoginSetupRequest(
            new_username="existing", new_password="Newpass123", confirm_password="Newpass123",
        )
        with pytest.raises(HTTPException) as exc:
            complete_first_login_setup(admin, data, db_session)
        assert exc.value.status_code == 400


class TestSecondaryAdmin:
    def test_create_success(self, db_session, test_super_admin):
        data = SecondaryAdminCreate(name="Sec", username="secadmin2", password="Secpass12")
        admin = create_secondary_admin(data, test_super_admin, db_session)
        assert admin.admin_level == AdminLevel.secondary_admin
        assert admin.must_change_credentials is True

    def test_max_reached(self, db_session, test_super_admin):
        for i in range(3):
            _make_user(
                db_session, email=None, username=f"sec{i}",
                role=Role.admin, admin_level=AdminLevel.secondary_admin,
            )
        data = SecondaryAdminCreate(name="Extra", username="extra", password="Secpass12")
        with pytest.raises(HTTPException) as exc:
            create_secondary_admin(data, test_super_admin, db_session)
        assert exc.value.status_code == 400
        assert "Maximum" in exc.value.detail

    def test_username_taken(self, db_session, test_super_admin):
        _make_user(db_session, email=None, username="taken", role=Role.admin,
                   admin_level=AdminLevel.secondary_admin)
        data = SecondaryAdminCreate(name="Dup", username="taken", password="Secpass12")
        with pytest.raises(HTTPException) as exc:
            create_secondary_admin(data, test_super_admin, db_session)
        assert exc.value.status_code == 400


class TestSetActive:
    def test_disable(self, db_session, test_super_admin, test_secondary_admin):
        result = set_secondary_admin_active(test_secondary_admin.id, False, test_super_admin, db_session)
        assert result.is_active is False

    def test_enable(self, db_session, test_super_admin):
        sec = _make_user(
            db_session, email=None, username="dis",
            role=Role.admin, admin_level=AdminLevel.secondary_admin,
            is_active=False,
        )
        result = set_secondary_admin_active(sec.id, True, test_super_admin, db_session)
        assert result.is_active is True

    def test_not_found(self, db_session, test_super_admin):
        with pytest.raises(HTTPException) as exc:
            set_secondary_admin_active(9999, True, test_super_admin, db_session)
        assert exc.value.status_code == 404

    def test_not_secondary(self, db_session, test_super_admin):
        with pytest.raises(HTTPException) as exc:
            set_secondary_admin_active(test_super_admin.id, False, test_super_admin, db_session)
        assert exc.value.status_code == 400


class TestAuditLog:
    def test_log_event(self, db_session):
        entry = log_audit_event(db_session, None, "test.action", "user", 1, {"key": "val"})
        assert entry.action == "test.action"

    def test_list_audit_logs(self, db_session):
        log_audit_event(db_session, None, "a", None, None)
        db_session.commit()
        log_audit_event(db_session, None, "b", None, None)
        db_session.commit()
        logs = list_audit_logs(db_session)
        assert len(logs) == 2
