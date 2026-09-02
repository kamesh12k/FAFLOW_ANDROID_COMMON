"""
Tests for Backup & Restore service and routes.

Uses the existing in-memory SQLite test infrastructure from conftest.py.
Covers: service-level backup/restore/validate/delete, route authorization,
path traversal prevention, invalid backup ID handling.

Fixture names from conftest.py:
  db_session           — yields a fresh SQLAlchemy Session per test
  client               — FastAPI TestClient with DB override
  auth_headers_system_admin  — {"Authorization": "Bearer <token>"} for system_admin
  auth_headers_admin         — headers for dept super_admin
  auth_headers_teacher       — headers for teacher
"""
from __future__ import annotations

import json
import uuid
from unittest.mock import patch, MagicMock

import pytest


# ══════════════════════════════════════════════════════════════════════════════
# Service-level unit tests
# ══════════════════════════════════════════════════════════════════════════════

class TestBackupServiceUnit:
    """Unit tests for backup_service functions using the SQLite test DB."""

    def test_create_backup_returns_metadata(self, db_session, tmp_path):
        """create_backup() should return a metadata dict with required keys."""
        from app.services import backup_service

        with patch.object(backup_service, "_backup_dir", return_value=tmp_path):
            meta = backup_service.create_backup(
                db=db_session,
                actor_user_id=None,
                actor_name="testadmin",
            )

        assert "backup_id" in meta
        assert "filename" in meta
        assert meta["filename"].startswith("faflow_backup_")
        assert meta["filename"].endswith(".json")
        assert meta["status"] == "completed"
        assert meta["file_size_bytes"] > 0
        assert len(meta["checksum_sha256"]) == 64  # SHA-256 hex

    def test_create_backup_file_written_to_disk(self, db_session, tmp_path):
        """create_backup() must write a real JSON file with _meta and data sections."""
        from app.services import backup_service

        with patch.object(backup_service, "_backup_dir", return_value=tmp_path):
            meta = backup_service.create_backup(db=db_session, actor_user_id=None, actor_name="admin")
            file_path = tmp_path / meta["filename"]

        assert file_path.exists()
        content = json.loads(file_path.read_text())
        assert "_meta" in content
        assert "data" in content
        assert content["_meta"]["backup_format"] == "faflow_json_v1"

    def test_create_backup_adds_to_index(self, db_session, tmp_path):
        """create_backup() must record the entry in backup_index.json."""
        from app.services import backup_service

        with patch.object(backup_service, "_backup_dir", return_value=tmp_path):
            meta = backup_service.create_backup(db=db_session, actor_user_id=None, actor_name="admin")

        index = json.loads((tmp_path / "backup_index.json").read_text())
        assert any(e["backup_id"] == meta["backup_id"] for e in index)

    def test_list_backups_empty(self, tmp_path):
        """list_backups() returns [] when no index exists."""
        from app.services import backup_service

        with patch.object(backup_service, "_backup_dir", return_value=tmp_path):
            result = backup_service.list_backups()

        assert result == []

    def test_list_backups_returns_multiple(self, db_session, tmp_path):
        """list_backups() returns all created backups, newest first."""
        from app.services import backup_service

        with patch.object(backup_service, "_backup_dir", return_value=tmp_path):
            backup_service.create_backup(db=db_session, actor_user_id=None, actor_name="admin")
            backup_service.create_backup(db=db_session, actor_user_id=None, actor_name="admin")
            result = backup_service.list_backups()

        assert len(result) == 2

    def test_get_backup_not_found_returns_none(self, tmp_path):
        """get_backup() returns None for unknown backup_id."""
        from app.services import backup_service

        with patch.object(backup_service, "_backup_dir", return_value=tmp_path):
            result = backup_service.get_backup("nonexistent-id")

        assert result is None

    def test_validate_backup_reports_valid(self, db_session, tmp_path):
        """validate_backup() marks a fresh unmodified backup as 'valid'."""
        from app.services import backup_service

        with patch.object(backup_service, "_backup_dir", return_value=tmp_path):
            meta = backup_service.create_backup(db=db_session, actor_user_id=None, actor_name="admin")
            result = backup_service.validate_backup(meta["backup_id"])

        assert result["validation_status"] == "valid"
        assert result.get("validation_errors", []) == []

    def test_validate_backup_missing_file_is_invalid(self, db_session, tmp_path):
        """validate_backup() marks 'invalid' when file deleted from disk."""
        from app.services import backup_service

        with patch.object(backup_service, "_backup_dir", return_value=tmp_path):
            meta = backup_service.create_backup(db=db_session, actor_user_id=None, actor_name="admin")
            (tmp_path / meta["filename"]).unlink()
            result = backup_service.validate_backup(meta["backup_id"])

        assert result["validation_status"] == "invalid"
        assert any("not found" in e for e in result.get("validation_errors", []))

    def test_validate_backup_checksum_mismatch(self, db_session, tmp_path):
        """validate_backup() marks 'invalid' if file content was tampered with."""
        from app.services import backup_service

        with patch.object(backup_service, "_backup_dir", return_value=tmp_path):
            meta = backup_service.create_backup(db=db_session, actor_user_id=None, actor_name="admin")
            # Corrupt the file after backup
            (tmp_path / meta["filename"]).write_text("corrupted content", encoding="utf-8")
            result = backup_service.validate_backup(meta["backup_id"])

        assert result["validation_status"] == "invalid"

    def test_validate_backup_unknown_id(self, tmp_path):
        """validate_backup() returns 'not_found' status for unknown ID."""
        from app.services import backup_service

        with patch.object(backup_service, "_backup_dir", return_value=tmp_path):
            result = backup_service.validate_backup(str(uuid.uuid4()))

        assert result["validation_status"] == "not_found"

    def test_delete_backup_removes_file_and_index(self, db_session, tmp_path):
        """delete_backup() must remove file from disk and from index."""
        from app.services import backup_service

        with patch.object(backup_service, "_backup_dir", return_value=tmp_path):
            meta = backup_service.create_backup(db=db_session, actor_user_id=None, actor_name="admin")
            backup_service.delete_backup(
                backup_id=meta["backup_id"],
                db=db_session,
                actor_user_id=None,
            )
            remaining = backup_service.get_backup(meta["backup_id"])
            file_exists = (tmp_path / meta["filename"]).exists()

        assert remaining is None
        assert not file_exists

    def test_delete_backup_unknown_id_raises(self, tmp_path):
        """delete_backup() raises ValueError for unknown backup_id."""
        from app.services import backup_service

        with patch.object(backup_service, "_backup_dir", return_value=tmp_path):
            with pytest.raises(ValueError, match="not found"):
                backup_service.delete_backup(
                    backup_id=str(uuid.uuid4()),
                    db=MagicMock(),
                    actor_user_id=None,
                )

    def test_pre_restore_backup_naming(self, db_session, tmp_path):
        """create_backup(is_pre_restore=True) creates a pre_restore_backup_ file."""
        from app.services import backup_service

        with patch.object(backup_service, "_backup_dir", return_value=tmp_path):
            meta = backup_service.create_backup(
                db=db_session,
                actor_user_id=None,
                actor_name="admin",
                is_pre_restore=True,
            )

        assert meta["is_pre_restore"] is True
        assert meta["filename"].startswith("pre_restore_backup_")

    def test_get_backup_file_path_rejects_unknown_id(self, tmp_path):
        """
        get_backup_file_path() must never accept unknown IDs.
        This prevents path traversal — the client cannot specify arbitrary paths.
        """
        from app.services import backup_service

        with patch.object(backup_service, "_backup_dir", return_value=tmp_path):
            with pytest.raises(ValueError):
                backup_service.get_backup_file_path("../../etc/passwd")

            with pytest.raises(ValueError):
                backup_service.get_backup_file_path(str(uuid.uuid4()))

    def test_summary_empty(self, tmp_path):
        """get_backup_summary() returns zero values when no backups exist."""
        from app.services import backup_service

        with patch.object(backup_service, "_backup_dir", return_value=tmp_path):
            summary = backup_service.get_backup_summary()

        assert summary["backup_count"] == 0
        assert summary["total_storage_bytes"] == 0
        assert summary["last_backup_at"] is None
        assert summary["last_restore_at"] is None

    def test_import_backup_success(self, db_session, tmp_path):
        """import_backup() saves uploaded valid backup file and indexes it."""
        from app.services import backup_service

        valid_payload = json.dumps({
            "_meta": {
                "backup_id": str(uuid.uuid4()),
                "created_at": "2026-08-15T12:00:00Z",
                "created_by": "original_admin",
                "faflow_version": "3.0.0",
                "backup_format": "faflow_json_v1",
                "tables": ["users"],
            },
            "data": {"users": []},
        }).encode("utf-8")

        with patch.object(backup_service, "_backup_dir", return_value=tmp_path):
            meta = backup_service.import_backup(
                file_bytes=valid_payload,
                original_filename="my_saved_backup.json",
                actor_user_id=None,
                actor_name="importing_admin",
                db=db_session,
            )

        assert meta["backup_type"] == "imported"
        assert meta["validation_status"] == "valid"
        assert (tmp_path / meta["filename"]).exists()
        index = json.loads((tmp_path / "backup_index.json").read_text())
        assert any(e["backup_id"] == meta["backup_id"] for e in index)

    def test_import_backup_invalid_json(self, db_session, tmp_path):
        """import_backup() raises ValueError for invalid JSON."""
        from app.services import backup_service

        with patch.object(backup_service, "_backup_dir", return_value=tmp_path):
            with pytest.raises(ValueError, match="not valid JSON"):
                backup_service.import_backup(
                    file_bytes=b"not a json",
                    original_filename="bad.json",
                    actor_user_id=1,
                    actor_name="admin",
                    db=db_session,
                )

    def test_import_backup_missing_meta(self, db_session, tmp_path):
        """import_backup() raises ValueError for JSON without FAFLOW structure."""
        from app.services import backup_service

        with patch.object(backup_service, "_backup_dir", return_value=tmp_path):
            with pytest.raises(ValueError, match="FAFLOW backup"):
                backup_service.import_backup(
                    file_bytes=json.dumps({"some_key": 123}).encode("utf-8"),
                    original_filename="bad_schema.json",
                    actor_user_id=1,
                    actor_name="admin",
                    db=db_session,
                )

    def test_restore_backup_with_dict_and_list_fields(self, db_session, tmp_path):
        """restore_backup() successfully restores tables with dict/list JSON columns (e.g. audit_logs.details)."""
        from app.services import backup_service

        backup_id = str(uuid.uuid4())
        filename = f"faflow_backup_test_complex.json"
        payload = {
            "_meta": {
                "backup_id": backup_id,
                "created_at": "2026-08-15T12:00:00Z",
                "created_by": "admin",
                "faflow_version": "3.0.0",
                "backup_format": "faflow_json_v1",
                "tables": ["users", "audit_logs"],
            },
            "data": {
                "users": [
                    {
                        "id": 99,
                        "name": "Restored User",
                        "email": "restored@test.com",
                        "username": "restored_user",
                        "password_hash": "hash123",
                        "role": "system_admin",
                        "is_active": True,
                        "must_change_credentials": False,
                    }
                ],
                "audit_logs": [
                    {
                        "id": 193,
                        "actor_user_id": 99,
                        "action": "calendar.mark_day",
                        "target_type": "calendar_day",
                        "target_id": 77,
                        "details": {"date": "2026-07-01", "day_type": "working", "day_order": 1},
                        "created_at": "2026-07-04 19:21:38.196005",
                        "department_id": None,
                    }
                ],
            },
        }
        (tmp_path / filename).write_text(json.dumps(payload))
        (tmp_path / "backup_index.json").write_text(json.dumps([{
            "backup_id": backup_id,
            "filename": filename,
            "created_at": "2026-08-15T12:00:00Z",
            "created_by": "admin",
            "file_size_bytes": 500,
            "checksum_sha256": "fake",
            "backup_type": "full",
            "status": "completed",
            "validation_status": "valid",
            "is_pre_restore": False,
        }]))

        with patch.object(backup_service, "_backup_dir", return_value=tmp_path):
            result = backup_service.restore_backup(
                db=db_session,
                backup_id=backup_id,
                actor_user_id=None,
                actor_name="admin",
            )

        assert "restored_backup_id" in result
        assert result["restored_backup_id"] == backup_id


# ══════════════════════════════════════════════════════════════════════════════
# Route-level authorization tests
# ══════════════════════════════════════════════════════════════════════════════

class TestBackupRouteAuthorization:
    """Route-level RBAC and input validation tests."""

    def test_create_backup_system_admin_allowed(self, client, auth_headers_system_admin, tmp_path):
        """System Admin must be able to create a backup (201)."""
        from app.services import backup_service

        with patch.object(backup_service, "_backup_dir", return_value=tmp_path):
            resp = client.post("/admin/backups", headers=auth_headers_system_admin)

        assert resp.status_code == 201
        data = resp.json()
        assert "backup_id" in data
        assert data["status"] == "completed"

    def test_create_backup_dept_admin_allowed(self, client, auth_headers_admin, tmp_path):
        """Department Admin (role=admin) can create backups."""
        from app.services import backup_service

        with patch.object(backup_service, "_backup_dir", return_value=tmp_path):
            resp = client.post("/admin/backups", headers=auth_headers_admin)
        assert resp.status_code == 201
        assert "backup_id" in resp.json()

    def test_create_backup_teacher_forbidden(self, client, auth_headers_teacher):
        """Teacher must receive 403."""
        resp = client.post("/admin/backups", headers=auth_headers_teacher)
        assert resp.status_code == 403

    def test_list_backups_unauthenticated_rejected(self, client):
        """Request without token must be rejected (401 or 403)."""
        resp = client.get("/admin/backups")
        assert resp.status_code in (401, 403)

    def test_delete_backup_admin_allowed(self, client, auth_headers_admin, tmp_path):
        """Dept Admin can delete backups."""
        from app.services import backup_service

        with patch.object(backup_service, "_backup_dir", return_value=tmp_path):
            create_resp = client.post("/admin/backups", headers=auth_headers_admin)
            assert create_resp.status_code == 201
            backup_id = create_resp.json()["backup_id"]
            resp = client.delete(f"/admin/backups/{backup_id}", headers=auth_headers_admin)
        assert resp.status_code == 204

    def test_download_backup_teacher_forbidden(self, client, auth_headers_teacher):
        """Teacher cannot download backups."""
        resp = client.get(f"/admin/backups/{uuid.uuid4()}/download", headers=auth_headers_teacher)
        assert resp.status_code == 403

    def test_restore_wrong_confirmation_rejected(self, client, auth_headers_system_admin, tmp_path):
        """Restore endpoint rejects wrong confirmation_text (422)."""
        from app.services import backup_service

        with patch.object(backup_service, "_backup_dir", return_value=tmp_path):
            create_resp = client.post("/admin/backups", headers=auth_headers_system_admin)
        assert create_resp.status_code == 201
        backup_id = create_resp.json()["backup_id"]

        with patch.object(backup_service, "_backup_dir", return_value=tmp_path):
            resp = client.post(
                f"/admin/backups/{backup_id}/restore",
                json={"confirmation_text": "yes delete everything"},
                headers=auth_headers_system_admin,
            )
        assert resp.status_code == 422

    def test_validate_unknown_backup_returns_404(self, client, auth_headers_system_admin, tmp_path):
        """Validate returns 404 for unknown backup_id."""
        from app.services import backup_service

        with patch.object(backup_service, "_backup_dir", return_value=tmp_path):
            resp = client.post(
                f"/admin/backups/{uuid.uuid4()}/validate",
                headers=auth_headers_system_admin,
            )
        assert resp.status_code == 404

    def test_delete_unknown_backup_returns_404(self, client, auth_headers_system_admin, tmp_path):
        """Delete returns 404 for unknown backup_id."""
        from app.services import backup_service

        with patch.object(backup_service, "_backup_dir", return_value=tmp_path):
            resp = client.delete(
                f"/admin/backups/{uuid.uuid4()}",
                headers=auth_headers_system_admin,
            )
        assert resp.status_code == 404

    def test_list_and_summary_return_200(self, client, auth_headers_system_admin, tmp_path):
        """List and summary endpoints return 200 for system_admin."""
        from app.services import backup_service

        with patch.object(backup_service, "_backup_dir", return_value=tmp_path):
            r1 = client.get("/admin/backups", headers=auth_headers_system_admin)
            r2 = client.get("/admin/backups/summary", headers=auth_headers_system_admin)

        assert r1.status_code == 200
        assert isinstance(r1.json(), list)
        assert r2.status_code == 200
        assert "backup_count" in r2.json()

    def test_malicious_backup_id_in_path_returns_404(self, client, auth_headers_system_admin, tmp_path):
        """Path traversal attempts in backup_id return 404 (not a 500 or file leak)."""
        from app.services import backup_service

        with patch.object(backup_service, "_backup_dir", return_value=tmp_path):
            resp = client.get(
                "/admin/backups/../../etc/passwd",
                headers=auth_headers_system_admin,
            )
        # FastAPI normalizes the URL path — this will 404 cleanly
        assert resp.status_code in (404, 422)

    def test_import_backup_route_success(self, client, auth_headers_system_admin, tmp_path):
        """System Admin can import a valid backup JSON file via route."""
        from app.services import backup_service

        valid_payload = json.dumps({
            "_meta": {
                "backup_id": str(uuid.uuid4()),
                "created_at": "2026-08-15T12:00:00Z",
                "created_by": "admin",
                "faflow_version": "3.0.0",
                "backup_format": "faflow_json_v1",
                "tables": ["users"],
            },
            "data": {"users": []},
        })

        with patch.object(backup_service, "_backup_dir", return_value=tmp_path):
            resp = client.post(
                "/admin/backups/import",
                files={"file": ("uploaded_backup.json", valid_payload, "application/json")},
                headers=auth_headers_system_admin,
            )

        assert resp.status_code == 201
        data = resp.json()
        assert data["backup_type"] == "imported"
        assert "backup_id" in data

    def test_import_backup_route_forbidden_for_teacher(self, client, auth_headers_teacher):
        """Teacher cannot import backups."""
        resp = client.post(
            "/admin/backups/import",
            files={"file": ("backup.json", "{}", "application/json")},
            headers=auth_headers_teacher,
        )
        assert resp.status_code == 403

    def test_import_backup_route_invalid_file(self, client, auth_headers_system_admin, tmp_path):
        """Importing invalid file returns 400 Bad Request."""
        from app.services import backup_service

        with patch.object(backup_service, "_backup_dir", return_value=tmp_path):
            resp = client.post(
                "/admin/backups/import",
                files={"file": ("bad.json", "not valid json", "application/json")},
                headers=auth_headers_system_admin,
            )

        assert resp.status_code == 400

    def test_dept_admin_backup_is_department_scoped(self, client, auth_headers_admin, tmp_path):
        """Department Admin backup is tagged with their department and scope."""
        from app.services import backup_service

        with patch.object(backup_service, "_backup_dir", return_value=tmp_path):
            resp = client.post("/admin/backups", headers=auth_headers_admin)

        assert resp.status_code == 201
        data = resp.json()
        assert data["backup_scope"] == "department"
        assert data["department_id"] is not None
        assert "dept_" in data["filename"]

    def test_dept_admin_cannot_restore_other_department_or_full_backup(self, client, auth_headers_system_admin, auth_headers_admin, tmp_path):
        """Department Admin cannot restore full system backup."""
        from app.services import backup_service

        # 1. System admin creates full backup
        with patch.object(backup_service, "_backup_dir", return_value=tmp_path):
            sys_resp = client.post("/admin/backups", headers=auth_headers_system_admin)
            assert sys_resp.status_code == 201
            full_backup_id = sys_resp.json()["backup_id"]

            # 2. Dept admin attempts to restore full backup
            resp = client.post(
                f"/admin/backups/{full_backup_id}/restore",
                json={"confirmation_text": "I understand that the current data will be replaced"},
                headers=auth_headers_admin,
            )
        assert resp.status_code == 400
        assert "Department Admins can only restore" in resp.json()["detail"]

    def test_schedule_settings_and_run_now(self, client, auth_headers_super_admin, tmp_path, monkeypatch):
        from app.services import backup_service
        monkeypatch.setattr(backup_service, "_backup_dir", lambda: tmp_path)

        # GET schedule
        get_res = client.get("/admin/backups/schedule", headers=auth_headers_super_admin)
        assert get_res.status_code == 200
        data = get_res.json()
        assert data["enabled"] is True
        assert data["interval_days"] == 7

        # PUT update schedule (e.g. interval_days = 3)
        put_res = client.put(
            "/admin/backups/schedule",
            headers=auth_headers_super_admin,
            json={"enabled": True, "interval_days": 3},
        )
        assert put_res.status_code == 200
        assert put_res.json()["interval_days"] == 3

        # POST run-now
        run_res = client.post("/admin/backups/schedule/run-now", headers=auth_headers_super_admin)
        assert run_res.status_code == 200
        meta = run_res.json()
        assert meta["backup_type"] == "auto"
        assert "auto_backup_" in meta["filename"]


