"""
Tests for Data Retention & Selective Purge service and routes.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import patch
import pytest

from app.models.audit_log import AuditLog
from app.models.notification import Notification
from app.models.leave import LeaveRequest, AlterAssignment
from app.models.credit import CreditTransaction
from app.models.timetable_submission import TimetableSubmission
from app.models.day_order_calendar import CalendarDay
from app.models.user import User, Role
from app.schemas.data_retention import (
    RetentionPolicySettingsIn,
    SelectivePurgePreviewRequest,
    SelectivePurgeExecuteRequest,
)
from app.services import data_retention_service


class TestDataRetentionServiceUnit:
    """Service-level unit tests for data retention policies and selective purge."""

    def test_get_and_update_retention_policy(self, db_session):
        policy = data_retention_service.get_retention_policy(db_session)
        assert policy.auto_cleanup_enabled is True
        assert policy.cleanup_frequency_days == 7
        assert policy.retention_audit_logs_days == 90

        # Update policy
        new_in = RetentionPolicySettingsIn(
            auto_cleanup_enabled=False,
            cleanup_frequency_days=14,
            retention_audit_logs_days=60,
            retention_notifications_days=15,
            retention_backups_days=30,
            retention_backups_max_count=5,
            retention_traffic_days=15,
            retention_leaves_days=180,
            retention_credits_days=180,
            retention_timetable_submissions_days=90,
        )
        updated = data_retention_service.update_retention_policy(
            db_session, new_in, actor_user_id=None, actor_name="admin"
        )
        assert updated.auto_cleanup_enabled is False
        assert updated.cleanup_frequency_days == 14
        assert updated.retention_audit_logs_days == 60
        assert updated.retention_notifications_days == 15

    def test_get_storage_stats(self, db_session):
        user = User(name="Test User", username="testuser", password_hash="fake", role=Role.system_admin, is_active=True)
        db_session.add(user)
        db_session.commit()

        # Insert test audit log and notification
        log = AuditLog(action="test.action", created_at=datetime.now(timezone.utc))
        notif = Notification(title="Test", body="Test Notif", event_type="system", user_id=user.id)
        db_session.add(log)
        db_session.add(notif)
        db_session.commit()

        stats = data_retention_service.get_storage_stats(db_session)
        assert stats.total_records >= 2
        tbl_map = {t.table_name: t.record_count for t in stats.tables}
        assert tbl_map.get("audit_logs", 0) >= 1
        assert tbl_map.get("notifications", 0) >= 1

    def test_preview_and_execute_selective_purge(self, db_session, tmp_path):
        from app.services import backup_service

        user = User(name="Test User 2", username="testuser2", password_hash="fake", role=Role.system_admin, is_active=True)
        db_session.add(user)
        db_session.commit()

        # Create older audit logs and notifications
        old_time = datetime.now(timezone.utc) - timedelta(days=120)
        recent_time = datetime.now(timezone.utc) - timedelta(days=5)

        log1 = AuditLog(action="old.log", created_at=old_time)
        log2 = AuditLog(action="recent.log", created_at=recent_time)
        notif1 = Notification(title="Old", body="Old", event_type="system", user_id=user.id, created_at=old_time)
        notif2 = Notification(title="Recent", body="Recent", event_type="system", user_id=user.id, created_at=recent_time)

        db_session.add_all([log1, log2, notif1, notif2])
        db_session.commit()

        # Preview purge older than 90 days
        preview_req = SelectivePurgePreviewRequest(
            targets=["audit_logs", "notifications"],
            filter_type="older_than_days",
            older_than_days=90,
        )
        preview = data_retention_service.preview_selective_purge(db_session, preview_req)
        assert preview.targets_summary["audit_logs"] == 1
        assert preview.targets_summary["notifications"] == 1
        assert preview.total_records == 2

        # Execute selective purge with mock backup dir
        with patch.object(backup_service, "_backup_dir", return_value=tmp_path):
            exec_req = SelectivePurgeExecuteRequest(
                targets=["audit_logs", "notifications"],
                filter_type="older_than_days",
                older_than_days=90,
                create_backup_first=True,
                confirmation_phrase="PURGE DATA",
            )
            result = data_retention_service.execute_selective_purge(
                db=db_session,
                req=exec_req,
                actor_user_id=user.id,
                actor_name="System Admin",
            )

        assert result.success is True
        assert result.total_purged == 2
        assert result.purged_counts["audit_logs"] == 1
        assert result.purged_counts["notifications"] == 1
        assert result.backup_filename is not None

        # Verify recent records still exist
        remaining_logs = db_session.query(AuditLog).filter(AuditLog.action != "data_retention.selective_purge_executed").all()
        assert any(l.action == "recent.log" for l in remaining_logs)
        assert not any(l.action == "old.log" for l in remaining_logs)

    def test_auto_cleanup_execution(self, db_session):
        user = User(name="Test User 3", username="testuser3", password_hash="fake", role=Role.system_admin, is_active=True)
        db_session.add(user)
        db_session.commit()

        old_time = datetime.now(timezone.utc) - timedelta(days=100)
        log = AuditLog(action="very.old.log", created_at=old_time)
        notif = Notification(title="Very Old", body="Very Old", event_type="system", user_id=user.id, created_at=old_time)
        db_session.add_all([log, notif])
        db_session.commit()

        # Force auto-cleanup
        res = data_retention_service.check_and_run_auto_cleanup(db_session, force=True)
        assert res is not None
        assert res["success"] is True
        assert res["total_purged"] >= 2
        assert res["purged_counts"].get("audit_logs", 0) >= 1
        assert res["purged_counts"].get("notifications", 0) >= 1


class TestDataRetentionRoutes:
    """Route-level tests for /admin/data-retention endpoints."""

    def test_get_stats_route(self, client, auth_headers_system_admin):
        resp = client.get("/admin/data-retention/stats", headers=auth_headers_system_admin)
        assert resp.status_code == 200
        data = resp.json()
        assert "total_records" in data
        assert "tables" in data

    def test_get_and_put_policy_route(self, client, auth_headers_system_admin):
        resp = client.get("/admin/data-retention/policy", headers=auth_headers_system_admin)
        assert resp.status_code == 200
        data = resp.json()
        assert "auto_cleanup_enabled" in data

        put_resp = client.put(
            "/admin/data-retention/policy",
            headers=auth_headers_system_admin,
            json={
                "auto_cleanup_enabled": True,
                "cleanup_frequency_days": 10,
                "retention_audit_logs_days": 45,
                "retention_notifications_days": 20,
                "retention_backups_days": 40,
                "retention_backups_max_count": 8,
                "retention_traffic_days": 20,
                "retention_leaves_days": 200,
                "retention_credits_days": 200,
                "retention_timetable_submissions_days": 100,
            },
        )
        assert put_resp.status_code == 200
        assert put_resp.json()["cleanup_frequency_days"] == 10
        assert put_resp.json()["retention_audit_logs_days"] == 45

    def test_preview_and_purge_routes(self, client, auth_headers_system_admin, tmp_path):
        from app.services import backup_service

        preview_resp = client.post(
            "/admin/data-retention/preview",
            headers=auth_headers_system_admin,
            json={
                "targets": ["audit_logs", "notifications"],
                "filter_type": "older_than_days",
                "older_than_days": 30,
            },
        )
        assert preview_resp.status_code == 200
        assert "targets_summary" in preview_resp.json()

        with patch.object(backup_service, "_backup_dir", return_value=tmp_path):
            purge_resp = client.post(
                "/admin/data-retention/purge",
                headers=auth_headers_system_admin,
                json={
                    "targets": ["audit_logs", "notifications"],
                    "filter_type": "older_than_days",
                    "older_than_days": 30,
                    "create_backup_first": False,
                    "confirmation_phrase": "PURGE DATA",
                },
            )
        assert purge_resp.status_code == 200
        assert purge_resp.json()["success"] is True

    def test_purge_invalid_confirmation_phrase(self, client, auth_headers_system_admin):
        resp = client.post(
            "/admin/data-retention/purge",
            headers=auth_headers_system_admin,
            json={
                "targets": ["audit_logs"],
                "filter_type": "all_records",
                "create_backup_first": False,
                "confirmation_phrase": "WRONG PHRASE",
            },
        )
        assert resp.status_code == 400
        assert "PURGE DATA" in resp.json()["detail"]

    def test_data_retention_forbidden_for_dept_admin(self, client, auth_headers_admin):
        """HODs / Department Admins must be forbidden from accessing data retention endpoints."""
        resp_stats = client.get("/admin/data-retention/stats", headers=auth_headers_admin)
        assert resp_stats.status_code == 403

        resp_policy = client.get("/admin/data-retention/policy", headers=auth_headers_admin)
        assert resp_policy.status_code == 403

        resp_preview = client.post(
            "/admin/data-retention/preview",
            headers=auth_headers_admin,
            json={"targets": ["audit_logs"], "filter_type": "older_than_days", "older_than_days": 30},
        )
        assert resp_preview.status_code == 403
