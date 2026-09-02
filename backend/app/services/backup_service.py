"""
backup_service.py — FAFLOW Backup & Restore Service

Creates, lists, validates, restores, and deletes JSON-format database backups.
Reuses and extends the proven snapshot approach from factory_reset_service.py.

Format:
  Each backup is a .json file containing a dict of table_name -> list[row_dict].
  A backup_index.json manifest tracks metadata for all backups.

RBAC:
  All public functions here are called only from backup routes which are
  guarded by require_system_admin — authorization is enforced at the route layer.
"""
from __future__ import annotations

import hashlib
import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings
from app.services.admin_service import log_audit_event

logger = logging.getLogger(__name__)

# ── Constants ──────────────────────────────────────────────────────────────────

# Resolve the configured backup directory relative to backend root.
_BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
_INDEX_FILENAME = "backup_index.json"

# All application tables in the correct deletion/insertion order (children before
# parents for deletion, parents before children for insertion). Derived from the
# authoritative list in factory_reset_service.py and the model __init__.py.
BACKUP_TABLES = [
    "users",
    "departments",
    "academic_years",
    "semesters",
    "calendar_days",
    "subjects",
    "rooms",
    "classes",
    "timetable_slots",
    "timetable_submissions",
    "leave_requests",
    "alter_assignments",
    "substitution_preferences",
    "teacher_credits",
    "credit_transactions",
    "operational_staff",
    "notifications",
    "push_subscriptions",
    "audit_logs",
    "system_settings",
    "staff_leave_requests",
    "staff_credits",
    "staff_credit_transactions",
]

# Deletion order: children first to satisfy FK constraints.
_RESTORE_DELETE_ORDER = [
    "staff_credit_transactions",
    "staff_credits",
    "staff_leave_requests",
    "push_subscriptions",
    "notifications",
    "credit_transactions",
    "teacher_credits",
    "substitution_preferences",
    "alter_assignments",
    "leave_requests",
    "timetable_submissions",
    "timetable_slots",
    "calendar_days",
    "semesters",
    "academic_years",
    "operational_staff",
    "classes",
    "rooms",
    "subjects",
    "audit_logs",
    "system_settings",
    "users",
    "departments",
]

# ── Helpers ────────────────────────────────────────────────────────────────────


def _backup_dir() -> Path:
    """Resolve backup storage directory from settings. Created on demand."""
    raw = settings.BACKUP_STORAGE_PATH
    path = Path(raw)
    if not path.is_absolute():
        path = _BACKEND_ROOT / path
    path.mkdir(parents=True, exist_ok=True)
    return path


def _index_path() -> Path:
    return _backup_dir() / _INDEX_FILENAME


def _load_index() -> list[dict]:
    p = _index_path()
    if not p.exists():
        return []
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return []


def _save_index(index: list[dict]) -> None:
    _index_path().write_text(
        json.dumps(index, indent=2, default=str), encoding="utf-8"
    )


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _safe_filename(ts: str) -> str:
    """Generate a filesystem-safe backup filename."""
    return f"faflow_backup_{ts}.json"


def _meta_entry(
    backup_id: str,
    filename: str,
    created_at: str,
    created_by: str,
    file_size_bytes: int,
    checksum: str,
    backup_type: str = "full",
    status: str = "completed",
    validation_status: str = "not_validated",
    is_pre_restore: bool = False,
    department_id: int | None = None,
    department_name: str | None = None,
    backup_scope: str = "full",
) -> dict:
    return {
        "backup_id": backup_id,
        "filename": filename,
        "created_at": created_at,
        "created_by": created_by,
        "file_size_bytes": file_size_bytes,
        "checksum_sha256": checksum,
        "backup_type": backup_type,
        "status": status,
        "validation_status": validation_status,
        "is_pre_restore": is_pre_restore,
        "last_validated_at": None,
        "restored_at": None,
        "table_count": len(BACKUP_TABLES),
        "department_id": department_id,
        "department_name": department_name,
        "backup_scope": backup_scope,
    }


# ── Core public functions ──────────────────────────────────────────────────────


def import_backup(
    file_bytes: bytes,
    original_filename: str,
    actor_user_id: int | None,
    actor_name: str,
    db: Session,
    tenant_department_id: int | None = None,
    tenant_department_name: str | None = None,
) -> dict:
    """
    Import an uploaded FAFLOW backup JSON file from the client's local machine.

    Validates the file content, saves it to the backup directory under a
    server-generated safe filename, registers it in the index, and
    audit-logs the import.

    Raises:
      ValueError: file too large, invalid JSON, or wrong backup format.
    """
    from app.config import settings

    # 1. Size guard
    max_bytes = settings.BACKUP_MAX_SIZE_MB * 1024 * 1024
    if len(file_bytes) > max_bytes:
        raise ValueError(
            f"File exceeds maximum allowed size of {settings.BACKUP_MAX_SIZE_MB} MB"
        )

    if len(file_bytes) == 0:
        raise ValueError("Uploaded file is empty")

    # 2. Parse JSON
    try:
        content = json.loads(file_bytes.decode("utf-8"))
    except Exception as e:
        raise ValueError(f"File is not valid JSON: {e}") from e

    # 3. Validate format
    if "_meta" not in content or "data" not in content:
        raise ValueError(
            "File does not appear to be a FAFLOW backup (missing '_meta' or 'data' sections)"
        )
    meta_section = content.get("_meta", {})
    if meta_section.get("backup_format") != "faflow_json_v1":
        raise ValueError(
            f"Unsupported backup format: '{meta_section.get('backup_format', 'unknown')}'. "
            "Only 'faflow_json_v1' is supported."
        )

    file_dept_id = meta_section.get("department_id")
    file_scope = meta_section.get("backup_scope", "full")

    # Scope validation for department admins
    if tenant_department_id is not None:
        if file_dept_id is not None and file_dept_id != tenant_department_id:
            raise ValueError(
                f"Cannot import backup from another department (ID {file_dept_id}). "
                f"Your department ID is {tenant_department_id}."
            )
        file_dept_id = tenant_department_id
        file_scope = "department"

    # 4. Save to disk under a safe server-generated filename
    backup_id = str(uuid.uuid4())
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H-%M-%S")
    safe_orig = "".join(c if c.isalnum() or c in "-_." else "_" for c in original_filename)[:80]
    prefix = f"dept_{tenant_department_id}_" if tenant_department_id else ""
    filename = f"{prefix}imported_{ts}_{backup_id[:8]}_{safe_orig}"
    if not filename.endswith(".json"):
        filename += ".json"

    backup_dir = _backup_dir()
    file_path = backup_dir / filename

    try:
        file_path.write_bytes(file_bytes)
    except OSError as e:
        raise RuntimeError(f"Failed to save imported backup: {e}") from e

    file_size = file_path.stat().st_size
    checksum = _sha256(file_path)
    created_at_str = meta_section.get("created_at") or _now_str()
    created_by_str = meta_section.get("created_by") or "unknown"

    meta = _meta_entry(
        backup_id=backup_id,
        filename=filename,
        created_at=created_at_str,
        created_by=f"{created_by_str} [imported by {actor_name}]",
        file_size_bytes=file_size,
        checksum=checksum,
        backup_type="imported",
        validation_status="valid",
        department_id=file_dept_id,
        department_name=tenant_department_name or meta_section.get("department_name"),
        backup_scope=file_scope,
    )

    index = _load_index()
    index.insert(0, meta)
    _save_index(index)

    log_audit_event(
        db,
        actor_user_id=actor_user_id,
        action="backup.imported",
        target_type="backup",
        details={
            "backup_id": backup_id,
            "filename": filename,
            "original_filename": original_filename,
            "file_size_bytes": file_size,
            "department_id": file_dept_id,
            "backup_scope": file_scope,
        },
    )
    db.commit()

    logger.info(
        "backup_service: imported backup '%s' → '%s' (%d bytes)",
        original_filename,
        filename,
        file_size,
    )
    return meta


def create_backup(
    db: Session,
    actor_user_id: int | None = None,
    actor_name: str = "System",
    is_pre_restore: bool = False,
    pre_restore_ref: str | None = None,
    tenant_department_id: int | None = None,
    tenant_department_name: str | None = None,
    backup_type: str = "full",
) -> dict:
    """
    Dump application tables to a timestamped JSON file.
    If tenant_department_id is provided, dumps ONLY data for that specific department.
    Returns the metadata entry dict (same shape as BackupMetaOut).
    """
    backup_id = str(uuid.uuid4())
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H-%M-%S")
    prefix = f"dept_{tenant_department_id}_" if tenant_department_id is not None else ""

    if is_pre_restore:
        filename = f"{prefix}pre_restore_backup_{ts}.json"
        backup_type = "pre_restore"
    elif backup_type == "auto":
        filename = f"{prefix}auto_backup_{ts}.json"
    else:
        filename = f"{prefix}faflow_backup_{ts}.json"

    backup_dir = _backup_dir()
    file_path = backup_dir / filename

    snapshot: dict[str, list[dict[str, Any]]] = {}
    tables_dumped = []

    if tenant_department_id is None:
        # Full database snapshot
        for table in BACKUP_TABLES:
            try:
                rows = db.execute(text(f"SELECT * FROM {table}")).mappings().all()
                snapshot[table] = [dict(r) for r in rows]
                tables_dumped.append(table)
            except Exception as e:
                logger.warning("backup_service: skipping table %s: %s", table, e)
                snapshot[table] = []
    else:
        # Scoped snapshot for this department ONLY
        dept_id = tenant_department_id

        # 1. Department record
        dept_rows = db.execute(text("SELECT * FROM departments WHERE id = :dept_id"), {"dept_id": dept_id}).mappings().all()
        snapshot["departments"] = [dict(r) for r in dept_rows]
        tables_dumped.append("departments")

        # 2. Users in department
        user_rows = db.execute(text("SELECT * FROM users WHERE department_id = :dept_id"), {"dept_id": dept_id}).mappings().all()
        snapshot["users"] = [dict(r) for r in user_rows]
        tables_dumped.append("users")

        # 3. Classes in department
        class_rows = db.execute(text("SELECT * FROM classes WHERE department_id = :dept_id"), {"dept_id": dept_id}).mappings().all()
        snapshot["classes"] = [dict(r) for r in class_rows]
        tables_dumped.append("classes")

        # 4. Subjects in department
        subject_rows = db.execute(text("SELECT * FROM subjects WHERE department_id = :dept_id"), {"dept_id": dept_id}).mappings().all()
        snapshot["subjects"] = [dict(r) for r in subject_rows]
        tables_dumped.append("subjects")

        # 5. Rooms in department / shared
        room_rows = db.execute(text("SELECT * FROM rooms WHERE department_id = :dept_id OR department_id IS NULL"), {"dept_id": dept_id}).mappings().all()
        snapshot["rooms"] = [dict(r) for r in room_rows]
        tables_dumped.append("rooms")

        # 6. Timetable submissions in department
        tt_sub_rows = db.execute(text("""
            SELECT * FROM timetable_submissions
            WHERE teacher_id IN (SELECT id FROM users WHERE department_id = :dept_id)
               OR class_id IN (SELECT id FROM classes WHERE department_id = :dept_id)
        """), {"dept_id": dept_id}).mappings().all()
        snapshot["timetable_submissions"] = [dict(r) for r in tt_sub_rows]
        tables_dumped.append("timetable_submissions")

        # 7. Timetable slots for department classes or teachers
        tt_slot_rows = db.execute(text("""
            SELECT ts.* FROM timetable_slots ts
            WHERE ts.class_id IN (SELECT id FROM classes WHERE department_id = :dept_id)
               OR ts.teacher_id IN (SELECT id FROM users WHERE department_id = :dept_id)
        """), {"dept_id": dept_id}).mappings().all()
        snapshot["timetable_slots"] = [dict(r) for r in tt_slot_rows]
        tables_dumped.append("timetable_slots")

        # 8. Leave requests for department teachers
        leave_rows = db.execute(text("""
            SELECT * FROM leave_requests
            WHERE teacher_id IN (SELECT id FROM users WHERE department_id = :dept_id)
        """), {"dept_id": dept_id}).mappings().all()
        snapshot["leave_requests"] = [dict(r) for r in leave_rows]
        tables_dumped.append("leave_requests")

        # 9. Alter assignments for department leaves or substitute teachers
        alter_rows = db.execute(text("""
            SELECT aa.* FROM alter_assignments aa
            WHERE aa.leave_request_id IN (SELECT id FROM leave_requests WHERE teacher_id IN (SELECT id FROM users WHERE department_id = :dept_id))
               OR aa.substitute_teacher_id IN (SELECT id FROM users WHERE department_id = :dept_id)
        """), {"dept_id": dept_id}).mappings().all()
        snapshot["alter_assignments"] = [dict(r) for r in alter_rows]
        tables_dumped.append("alter_assignments")

        # 10. Substitution preferences
        pref_rows = db.execute(text("""
            SELECT * FROM substitution_preferences
            WHERE teacher_id IN (SELECT id FROM users WHERE department_id = :dept_id)
        """), {"dept_id": dept_id}).mappings().all()
        snapshot["substitution_preferences"] = [dict(r) for r in pref_rows]
        tables_dumped.append("substitution_preferences")

        # 11. Teacher credits
        cred_rows = db.execute(text("""
            SELECT * FROM teacher_credits
            WHERE teacher_id IN (SELECT id FROM users WHERE department_id = :dept_id)
        """), {"dept_id": dept_id}).mappings().all()
        snapshot["teacher_credits"] = [dict(r) for r in cred_rows]
        tables_dumped.append("teacher_credits")

        # 12. Credit transactions
        tx_rows = db.execute(text("""
            SELECT * FROM credit_transactions
            WHERE teacher_id IN (SELECT id FROM users WHERE department_id = :dept_id)
        """), {"dept_id": dept_id}).mappings().all()
        snapshot["credit_transactions"] = [dict(r) for r in tx_rows]
        tables_dumped.append("credit_transactions")

        # 13. Operational staff in department
        staff_rows = db.execute(text("SELECT * FROM operational_staff WHERE department_id = :dept_id"), {"dept_id": dept_id}).mappings().all()
        snapshot["operational_staff"] = [dict(r) for r in staff_rows]
        tables_dumped.append("operational_staff")

        # 14. Staff leaves, credits, and transactions
        staff_leave_rows = db.execute(text("""
            SELECT * FROM staff_leave_requests
            WHERE staff_id IN (SELECT id FROM operational_staff WHERE department_id = :dept_id)
        """), {"dept_id": dept_id}).mappings().all()
        snapshot["staff_leave_requests"] = [dict(r) for r in staff_leave_rows]
        tables_dumped.append("staff_leave_requests")

        staff_cred_rows = db.execute(text("""
            SELECT * FROM staff_credits
            WHERE staff_id IN (SELECT id FROM operational_staff WHERE department_id = :dept_id)
        """), {"dept_id": dept_id}).mappings().all()
        snapshot["staff_credits"] = [dict(r) for r in staff_cred_rows]
        tables_dumped.append("staff_credits")

        staff_tx_rows = db.execute(text("""
            SELECT * FROM staff_credit_transactions
            WHERE staff_id IN (SELECT id FROM operational_staff WHERE department_id = :dept_id)
        """), {"dept_id": dept_id}).mappings().all()
        snapshot["staff_credit_transactions"] = [dict(r) for r in staff_tx_rows]
        tables_dumped.append("staff_credit_transactions")

        # 15. Shared references
        for shared_table in ["academic_years", "semesters", "calendar_days", "system_settings"]:
            try:
                rows = db.execute(text(f"SELECT * FROM {shared_table}")).mappings().all()
                snapshot[shared_table] = [dict(r) for r in rows]
                tables_dumped.append(shared_table)
            except Exception as e:
                logger.warning("backup_service: skipping shared table %s: %s", shared_table, e)
                snapshot[shared_table] = []

    # Include metadata in the backup file itself for self-contained validation
    created_at_str = datetime.now(timezone.utc).isoformat()
    scope_str = "department" if tenant_department_id is not None else "full"
    payload = {
        "_meta": {
            "backup_id": backup_id,
            "created_at": created_at_str,
            "created_by": actor_name,
            "faflow_version": "3.0.0",
            "backup_format": "faflow_json_v1",
            "tables": tables_dumped,
            "is_pre_restore": is_pre_restore,
            "pre_restore_ref": pre_restore_ref,
            "department_id": tenant_department_id,
            "department_name": tenant_department_name,
            "backup_scope": scope_str,
        },
        "data": snapshot,
    }

    try:
        file_path.write_text(
            json.dumps(payload, indent=2, default=str), encoding="utf-8"
        )
    except OSError as e:
        raise RuntimeError(f"Failed to write backup file: {e}") from e

    file_size = file_path.stat().st_size
    checksum = _sha256(file_path)

    meta = _meta_entry(
        backup_id=backup_id,
        filename=filename,
        created_at=created_at_str,
        created_by=actor_name,
        file_size_bytes=file_size,
        checksum=checksum,
        backup_type=backup_type,
        is_pre_restore=is_pre_restore,
        department_id=tenant_department_id,
        department_name=tenant_department_name,
        backup_scope=scope_str,
    )

    index = _load_index()
    index.insert(0, meta)  # newest first
    _save_index(index)

    # Audit
    log_audit_event(
        db,
        actor_user_id=actor_user_id,
        action="backup.created",
        target_type="backup",
        details={
            "backup_id": backup_id,
            "filename": filename,
            "is_pre_restore": is_pre_restore,
            "file_size_bytes": file_size,
            "department_id": tenant_department_id,
            "backup_scope": scope_str,
        },
    )
    db.commit()

    logger.info("backup_service: backup created → %s (%d bytes, scope: %s)", filename, file_size, scope_str)
    return meta


def list_backups(tenant_department_id: int | None = None) -> list[dict]:
    """Return backup metadata entries. If tenant_department_id is passed, filters to that department."""
    all_backups = _load_index()
    if tenant_department_id is None:
        return all_backups
    return [
        e for e in all_backups
        if e.get("department_id") == tenant_department_id
    ]


def get_backup(backup_id: str, tenant_department_id: int | None = None) -> dict | None:
    """Return a single backup's metadata, or None if not found or unauthorized."""
    index = _load_index()
    for entry in index:
        if entry["backup_id"] == backup_id:
            if tenant_department_id is not None and entry.get("department_id") != tenant_department_id:
                return None
            return entry
    return None


def get_backup_summary(tenant_department_id: int | None = None) -> dict:
    """Return aggregate stats for the dashboard summary bar."""
    index = list_backups(tenant_department_id)
    completed = [e for e in index if not e.get("is_pre_restore")]
    total_bytes = sum(
        e.get("file_size_bytes", 0) for e in completed
    )
    last_backup = completed[0]["created_at"] if completed else None
    last_restore = None
    for e in completed:
        if e.get("restored_at"):
            last_restore = e["restored_at"]
            break
    return {
        "backup_count": len(completed),
        "total_storage_bytes": total_bytes,
        "last_backup_at": last_backup,
        "last_restore_at": last_restore,
    }


def validate_backup(backup_id: str) -> dict:
    """
    Validate a backup without restoring it.
    Checks: metadata exists, file on disk, readable, non-zero,
    valid JSON, expected format key, checksum match, table list present.

    Returns updated metadata entry.
    """
    index = _load_index()
    entry = next((e for e in index if e["backup_id"] == backup_id), None)
    if entry is None:
        return {"backup_id": backup_id, "validation_status": "not_found", "validation_errors": ["Backup not found in index"]}

    backup_dir = _backup_dir()
    file_path = backup_dir / entry["filename"]
    errors: list[str] = []

    # 1. File exists
    if not file_path.exists():
        errors.append("Backup file not found on disk")
        _update_index_entry(index, backup_id, {"validation_status": "invalid", "last_validated_at": _now_str()})
        _save_index(index)
        entry["validation_status"] = "invalid"
        entry["validation_errors"] = errors
        return entry

    # 2. Non-zero size
    size = file_path.stat().st_size
    if size == 0:
        errors.append("Backup file is empty (zero bytes)")

    # 3. Checksum
    actual_checksum = _sha256(file_path)
    if actual_checksum != entry.get("checksum_sha256"):
        errors.append(
            f"Checksum mismatch: stored={entry.get('checksum_sha256', 'none')[:16]}... "
            f"actual={actual_checksum[:16]}..."
        )

    # 4. Valid JSON
    try:
        content = json.loads(file_path.read_text(encoding="utf-8"))
    except Exception as e:
        errors.append(f"File is not valid JSON: {e}")
        content = None

    # 5. Expected format keys
    if content is not None:
        if "_meta" not in content:
            errors.append("Missing '_meta' section (not a FAFLOW backup)")
        if "data" not in content:
            errors.append("Missing 'data' section")
        else:
            meta_section = content.get("_meta", {})
            if meta_section.get("backup_format") != "faflow_json_v1":
                errors.append(
                    f"Unknown backup format: {meta_section.get('backup_format', 'unknown')}"
                )
            missing_tables = [
                t for t in ["users", "departments"]  # critical tables
                if t not in content.get("data", {})
            ]
            if missing_tables:
                errors.append(f"Missing critical tables: {missing_tables}")

    status = "valid" if not errors else "invalid"
    _update_index_entry(
        index,
        backup_id,
        {"validation_status": status, "last_validated_at": _now_str()},
    )
    _save_index(index)

    updated_entry = next((e for e in index if e["backup_id"] == backup_id), entry)
    updated_entry["validation_errors"] = errors
    return updated_entry


def restore_backup(
    db: Session,
    backup_id: str,
    actor_user_id: int,
    actor_name: str,
    tenant_department_id: int | None = None,
    tenant_department_name: str | None = None,
) -> dict:
    """
    Safely restore a backup.
    If tenant_department_id is passed, verifies the backup belongs to that department,
    cleans up and restores ONLY that department's records, leaving all other departments untouched.
    """
    index = _load_index()
    entry = next((e for e in index if e["backup_id"] == backup_id), None)
    if entry is None:
        raise ValueError(f"Backup '{backup_id}' not found")

    if tenant_department_id is not None:
        if entry.get("backup_scope") != "department" or entry.get("department_id") != tenant_department_id:
            raise ValueError("Department Admins can only restore department-scoped backups created for their own department.")

    backup_dir = _backup_dir()
    file_path = backup_dir / entry["filename"]
    if not file_path.exists():
        raise ValueError("Backup file not found on disk")

    # Load content
    try:
        content = json.loads(file_path.read_text(encoding="utf-8"))
    except Exception as e:
        raise ValueError(f"Backup file is not valid JSON: {e}") from e

    if "data" not in content or "_meta" not in content:
        raise ValueError("Backup file format is invalid (missing 'data' or '_meta')")

    data: dict[str, list[dict]] = content["data"]

    # ── Step 3: Pre-restore safety backup ────────────────────────────────────
    logger.warning(
        "restore_backup: creating pre-restore safety backup before restoring %s (scope: %s)",
        backup_id,
        "department" if tenant_department_id else "full",
    )
    try:
        pre_restore_meta = create_backup(
            db=db,
            actor_user_id=actor_user_id,
            actor_name=actor_name,
            is_pre_restore=True,
            pre_restore_ref=backup_id,
            tenant_department_id=tenant_department_id,
            tenant_department_name=tenant_department_name,
        )
        pre_restore_id = pre_restore_meta["backup_id"]
        logger.info(
            "restore_backup: pre-restore safety backup created → %s",
            pre_restore_meta["filename"],
        )
    except Exception as e:
        raise RuntimeError(
            f"Cannot proceed with restore: failed to create pre-restore safety backup. {e}"
        ) from e

    # ── Step 4 & 5: Delete then re-insert ────────────────────────────────────
    try:
        if tenant_department_id is None:
            # Full database wipe
            for table in _RESTORE_DELETE_ORDER:
                try:
                    db.execute(text(f"DELETE FROM {table}"))
                except Exception as e:
                    logger.warning("restore: could not delete %s: %s", table, e)
        else:
            # Scoped department wipe in reverse FK order
            dept_id = tenant_department_id
            dept_delete_stmts = [
                ("staff_credit_transactions", "DELETE FROM staff_credit_transactions WHERE staff_id IN (SELECT id FROM operational_staff WHERE department_id = :dept_id)"),
                ("staff_credits", "DELETE FROM staff_credits WHERE staff_id IN (SELECT id FROM operational_staff WHERE department_id = :dept_id)"),
                ("staff_leave_requests", "DELETE FROM staff_leave_requests WHERE staff_id IN (SELECT id FROM operational_staff WHERE department_id = :dept_id)"),
                ("credit_transactions", "DELETE FROM credit_transactions WHERE teacher_id IN (SELECT id FROM users WHERE department_id = :dept_id)"),
                ("teacher_credits", "DELETE FROM teacher_credits WHERE teacher_id IN (SELECT id FROM users WHERE department_id = :dept_id)"),
                ("substitution_preferences", "DELETE FROM substitution_preferences WHERE teacher_id IN (SELECT id FROM users WHERE department_id = :dept_id)"),
                ("alter_assignments", "DELETE FROM alter_assignments WHERE leave_request_id IN (SELECT id FROM leave_requests WHERE teacher_id IN (SELECT id FROM users WHERE department_id = :dept_id))"),
                ("leave_requests", "DELETE FROM leave_requests WHERE teacher_id IN (SELECT id FROM users WHERE department_id = :dept_id)"),
                ("timetable_slots", "DELETE FROM timetable_slots WHERE class_id IN (SELECT id FROM classes WHERE department_id = :dept_id) OR teacher_id IN (SELECT id FROM users WHERE department_id = :dept_id)"),
                ("timetable_submissions", "DELETE FROM timetable_submissions WHERE teacher_id IN (SELECT id FROM users WHERE department_id = :dept_id) OR class_id IN (SELECT id FROM classes WHERE department_id = :dept_id)"),
                ("operational_staff", "DELETE FROM operational_staff WHERE department_id = :dept_id"),
                ("classes", "DELETE FROM classes WHERE department_id = :dept_id"),
                ("subjects", "DELETE FROM subjects WHERE department_id = :dept_id"),
                ("users", "DELETE FROM users WHERE department_id = :dept_id AND id != :actor_id"),
            ]
            for tbl, stmt in dept_delete_stmts:
                try:
                    db.execute(text(stmt), {"dept_id": dept_id, "actor_id": actor_user_id})
                except Exception as e:
                    logger.warning("restore: department delete for %s: %s", tbl, e)

        # Insert in parents-first order (reverse of delete order)
        insert_order = list(reversed(_RESTORE_DELETE_ORDER))
        for table in insert_order:
            rows = data.get(table, [])
            if not rows:
                continue
            for row in rows:
                if not row:
                    continue

                if tenant_department_id is not None:
                    if table in ["academic_years", "semesters", "calendar_days", "system_settings"]:
                        row_id = row.get("id")
                        if row_id is not None:
                            existing = db.execute(text(f'SELECT id FROM "{table}" WHERE id = :id'), {"id": row_id}).first()
                            if existing:
                                continue
                    elif table == "departments":
                        row_id = row.get("id")
                        if row_id is not None:
                            existing = db.execute(text('SELECT id FROM "departments" WHERE id = :id'), {"id": row_id}).first()
                            if existing:
                                continue
                    elif table == "users" and row.get("id") == actor_user_id:
                        continue
                    elif table == "rooms":
                        row_id = row.get("id")
                        if row_id is not None:
                            existing = db.execute(text('SELECT id FROM "rooms" WHERE id = :id'), {"id": row_id}).first()
                            if existing:
                                continue

                # Adapt complex types (dict, list) to JSON strings for PostgreSQL / psycopg2
                cleaned_row = {}
                for k, v in row.items():
                    if isinstance(v, (dict, list)):
                        cleaned_row[k] = json.dumps(v)
                    else:
                        cleaned_row[k] = v

                cols = ", ".join(f'"{k}"' for k in cleaned_row.keys())
                placeholders = ", ".join(f":{k}" for k in cleaned_row.keys())
                stmt = text(f'INSERT INTO "{table}" ({cols}) VALUES ({placeholders})')
                try:
                    db.execute(stmt, cleaned_row)
                except Exception as e:
                    logger.error(
                        "restore: failed inserting row into %s: %s | row keys: %s",
                        table, e, list(cleaned_row.keys())
                    )
                    raise RuntimeError(
                        f"Restore failed while inserting into table '{table}': {e}. "
                        f"Pre-restore safety backup '{pre_restore_meta['filename']}' is preserved."
                    ) from e

        db.commit()

        # Synchronize sequence counters on PostgreSQL so new inserts don't collide
        _sync_postgres_sequences(db)

    except RuntimeError:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise RuntimeError(
            f"Restore failed: {e}. "
            f"Pre-restore safety backup '{pre_restore_meta['filename']}' is preserved."
        ) from e

    # ── Step 7: Update index + audit ─────────────────────────────────────────
    index = _load_index()  # reload after create_backup modified it
    _update_index_entry(index, backup_id, {"restored_at": _now_str()})
    _save_index(index)

    log_audit_event(
        db,
        actor_user_id=actor_user_id,
        action="backup.restored",
        target_type="backup",
        details={
            "backup_id": backup_id,
            "filename": entry["filename"],
            "pre_restore_backup_id": pre_restore_id,
            "pre_restore_filename": pre_restore_meta["filename"],
            "department_id": tenant_department_id,
        },
    )
    db.commit()

    logger.warning(
        "restore_backup: restore completed for %s. Pre-restore backup: %s",
        entry["filename"],
        pre_restore_meta["filename"],
    )

    return {
        "restored_backup_id": backup_id,
        "restored_filename": entry["filename"],
        "pre_restore_backup_id": pre_restore_id,
        "pre_restore_filename": pre_restore_meta["filename"],
        "restored_at": _now_str(),
        "message": f"Restore completed successfully for {entry.get('department_name', 'department') if tenant_department_id else 'entire database'}.",
    }


def delete_backup(
    backup_id: str,
    db: Session,
    actor_user_id: int,
    tenant_department_id: int | None = None,
) -> None:
    """
    Delete a backup file and remove it from the index.
    Raises ValueError if not found or unauthorized.
    """
    index = _load_index()
    entry = next((e for e in index if e["backup_id"] == backup_id), None)
    if entry is None:
        raise ValueError(f"Backup '{backup_id}' not found")

    if tenant_department_id is not None and entry.get("department_id") != tenant_department_id:
        raise ValueError("Cannot delete a backup belonging to another department")

    backup_dir = _backup_dir()
    file_path = backup_dir / entry["filename"]

    if file_path.exists():
        try:
            file_path.unlink()
        except OSError as e:
            raise RuntimeError(f"Failed to delete backup file: {e}") from e

    new_index = [e for e in index if e["backup_id"] != backup_id]
    _save_index(new_index)

    log_audit_event(
        db,
        actor_user_id=actor_user_id,
        action="backup.deleted",
        target_type="backup",
        details={"backup_id": backup_id, "filename": entry["filename"]},
    )
    db.commit()

    logger.info("backup_service: deleted backup %s", entry["filename"])


def get_backup_file_path(backup_id: str, tenant_department_id: int | None = None) -> Path:
    """
    Return the filesystem path for a backup file.
    Raises ValueError if the backup doesn't exist in the index, on disk, or unauthorized.
    """
    index = _load_index()
    entry = next((e for e in index if e["backup_id"] == backup_id), None)
    if entry is None:
        raise ValueError(f"Backup '{backup_id}' not found")

    if tenant_department_id is not None and entry.get("department_id") != tenant_department_id:
        raise ValueError("Cannot access a backup belonging to another department")

    path = _backup_dir() / entry["filename"]
    if not path.exists():
        raise ValueError("Backup file not found on disk")
    return path


# ── Internal helpers ───────────────────────────────────────────────────────────


def _now_str() -> str:
    return datetime.now(timezone.utc).isoformat()


def _update_index_entry(index: list[dict], backup_id: str, updates: dict) -> None:
    for entry in index:
        if entry["backup_id"] == backup_id:
            entry.update(updates)
            return


def _sync_postgres_sequences(db: Session) -> None:
    """
    On PostgreSQL, synchronizes sequence counters for all table ID columns
    so subsequent inserts don't collide with restored explicit IDs.
    """
    try:
        bind = db.get_bind()
        if bind.dialect.name == "postgresql":
            for table in BACKUP_TABLES:
                try:
                    seq_query = text(f"SELECT pg_get_serial_sequence('{table}', 'id');")
                    seq_name = db.execute(seq_query).scalar()
                    if seq_name:
                        db.execute(text(f"""
                            SELECT setval('{seq_name}', COALESCE((SELECT MAX(id) FROM "{table}"), 1), true);
                        """))
                except Exception as ex:
                    logger.debug("Sequence sync skipped for %s: %s", table, ex)
            db.commit()
    except Exception as e:
        logger.warning("Failed to sync postgres sequences: %s", e)


# ── Automatic Backup Scheduling ────────────────────────────────────────────────


def get_backup_schedule_settings(db: Session) -> dict[str, Any]:
    """
    Retrieve automatic backup configuration and next scheduled backup time.
    Default interval is 7 days if not previously configured.
    """
    from app.models.system_setting import SystemSetting
    from datetime import timedelta

    def _get_val(key: str, default: str) -> str:
        row = db.query(SystemSetting).filter(
            SystemSetting.key == key,
            SystemSetting.department_id.is_(None)
        ).first()
        return row.value if row else default

    enabled_str = _get_val("auto_backup_enabled", "true").strip().lower()
    enabled = enabled_str in {"true", "1", "yes", "on"}

    try:
        interval_days = int(_get_val("auto_backup_interval_days", "7"))
        if interval_days < 1:
            interval_days = 7
    except ValueError:
        interval_days = 7

    last_auto_str = _get_val("last_auto_backup_at", "").strip()
    if not last_auto_str:
        # Fallback: check latest backup in index
        index = _load_index()
        if index:
            last_auto_str = index[0].get("created_at")

    next_scheduled_at = None
    if enabled:
        if last_auto_str:
            try:
                dt = datetime.fromisoformat(last_auto_str)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                next_dt = dt + timedelta(days=interval_days)
                next_scheduled_at = next_dt.isoformat()
            except Exception:
                next_scheduled_at = (datetime.now(timezone.utc) + timedelta(days=interval_days)).isoformat()
        else:
            # If no backup has ever run, next is immediate
            next_scheduled_at = datetime.now(timezone.utc).isoformat()

    return {
        "enabled": enabled,
        "interval_days": interval_days,
        "last_auto_backup_at": last_auto_str or None,
        "next_scheduled_at": next_scheduled_at,
        "message": f"Automatic backup is {'active every ' + str(interval_days) + ' days' if enabled else 'disabled'}."
    }


def update_backup_schedule_settings(
    db: Session,
    enabled: bool,
    interval_days: int,
    actor_user_id: int | None = None,
    actor_name: str | None = None,
) -> dict[str, Any]:
    """
    Update automatic backup schedule interval (default: 7 days) and toggle status.
    """
    from app.models.system_setting import SystemSetting

    if interval_days < 1:
        interval_days = 7

    def _set_val(key: str, val: str) -> None:
        row = db.query(SystemSetting).filter(
            SystemSetting.key == key,
            SystemSetting.department_id.is_(None)
        ).first()
        if not row:
            row = SystemSetting(key=key, value=val, department_id=None)
            db.add(row)
        else:
            row.value = val

    _set_val("auto_backup_enabled", "true" if enabled else "false")
    _set_val("auto_backup_interval_days", str(interval_days))
    db.commit()

    log_audit_event(
        db,
        actor_user_id=actor_user_id,
        action="backup.schedule_updated",
        target_type="system_setting",
        details={
            "enabled": enabled,
            "interval_days": interval_days,
            "updated_by": actor_name,
        },
    )
    db.commit()

    logger.info(
        "backup_service: schedule updated by %s (enabled=%s, interval_days=%d)",
        actor_name or "admin",
        enabled,
        interval_days,
    )

    return get_backup_schedule_settings(db)


def check_and_run_auto_backup(db: Session, force: bool = False) -> dict[str, Any] | None:
    """
    Evaluates if an automatic backup is due based on configured interval (default 7 days).
    If due or force=True, creates a full database backup tagged as 'auto'.
    """
    from app.models.system_setting import SystemSetting
    from datetime import timedelta

    sched = get_backup_schedule_settings(db)
    if not sched["enabled"] and not force:
        return None

    interval_days = sched["interval_days"]
    last_auto_str = sched["last_auto_backup_at"]
    is_due = False

    if force or not last_auto_str:
        is_due = True
    else:
        try:
            dt = datetime.fromisoformat(last_auto_str)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            now = datetime.now(timezone.utc)
            if (now - dt).total_seconds() >= interval_days * 86400:
                is_due = True
        except Exception:
            is_due = True

    if not is_due:
        return None

    logger.info(
        "backup_service: running scheduled automatic backup (interval: %d days)...",
        interval_days
    )

    try:
        meta = create_backup(
            db=db,
            actor_user_id=None,
            actor_name="Automated System Scheduler",
            backup_type="auto",
        )

        now_str = _now_str()
        row = db.query(SystemSetting).filter(
            SystemSetting.key == "last_auto_backup_at",
            SystemSetting.department_id.is_(None)
        ).first()
        if not row:
            row = SystemSetting(key="last_auto_backup_at", value=now_str, department_id=None)
            db.add(row)
        else:
            row.value = now_str
        db.commit()

        log_audit_event(
            db,
            actor_user_id=None,
            action="backup.auto_completed",
            target_type="backup",
            details={
                "backup_id": meta["backup_id"],
                "filename": meta["filename"],
                "interval_days": interval_days,
            },
        )
        db.commit()

        logger.info("backup_service: auto backup created successfully (%s)", meta["filename"])
        return meta
    except Exception as e:
        logger.error("backup_service: scheduled auto-backup failed: %s", e)
        return None

