"""
Backup & Restore API routes.

All endpoints are restricted to `system_admin` role only via the
existing `require_system_admin` dependency from app/core/dependencies.py.

Routes:
  POST   /admin/backups                      — create a new backup
  GET    /admin/backups                      — list all backups
  GET    /admin/backups/summary              — dashboard summary stats
  GET    /admin/backups/{backup_id}          — get single backup metadata
  GET    /admin/backups/{backup_id}/download — download backup file
  POST   /admin/backups/{backup_id}/validate — validate backup integrity
  POST   /admin/backups/{backup_id}/restore  — safe restore with confirmation
  DELETE /admin/backups/{backup_id}          — delete a backup
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import require_admin
from app.models.user import User, Role
from app.schemas.backup import (
    BackupMetaOut,
    BackupSummaryOut,
    RestoreConfirmRequest,
    RestoreResultOut,
    BackupScheduleSettingsIn,
    BackupScheduleSettingsOut,
)
from app.services import backup_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/backups", tags=["Backup & Restore"])


def _get_dept_scope(admin: User) -> tuple[int | None, str | None]:
    """Returns (department_id, department_name) if admin is a Dept HOD, else (None, None) for System Admin."""
    if admin.role == Role.system_admin:
        return None, None
    return admin.department_id, admin.department


@router.get("/schedule", response_model=BackupScheduleSettingsOut)
def get_backup_schedule(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Retrieve automatic backup configuration and schedule interval (default: 7 days)."""
    # Trigger auto check in case it is due
    try:
        backup_service.check_and_run_auto_backup(db)
    except Exception as e:
        logger.debug("Auto backup check skipped: %s", e)
    return backup_service.get_backup_schedule_settings(db)


@router.put("/schedule", response_model=BackupScheduleSettingsOut)
def update_backup_schedule(
    body: BackupScheduleSettingsIn,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Update automatic backup schedule interval (default: 7 days) and enabled toggle."""
    return backup_service.update_backup_schedule_settings(
        db=db,
        enabled=body.enabled,
        interval_days=body.interval_days,
        actor_user_id=admin.id,
        actor_name=admin.username or admin.name,
    )


@router.post("/schedule/run-now", response_model=BackupMetaOut)
def run_auto_backup_now(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Force execution of an automatic scheduled backup immediately."""
    res = backup_service.check_and_run_auto_backup(db, force=True)
    if not res:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to run immediate automatic backup."
        )
    return res


@router.post("/import", response_model=BackupMetaOut, status_code=201)
async def import_backup_file(
    file: UploadFile = File(...),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Import a backup JSON file from local storage. Department HOD & System Admin."""
    dept_id, dept_name = _get_dept_scope(admin)
    try:
        file_bytes = await file.read()
        meta = backup_service.import_backup(
            file_bytes=file_bytes,
            original_filename=file.filename or "uploaded_backup.json",
            actor_user_id=admin.id,
            actor_name=admin.username or admin.name,
            db=db,
            tenant_department_id=dept_id,
            tenant_department_name=dept_name,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
    return meta


@router.post("", response_model=BackupMetaOut, status_code=201)
def create_backup(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Create a backup. Scoped to the department for Department HODs; full database for System Admins."""
    dept_id, dept_name = _get_dept_scope(admin)
    try:
        meta = backup_service.create_backup(
            db=db,
            actor_user_id=admin.id,
            actor_name=admin.username or admin.name,
            tenant_department_id=dept_id,
            tenant_department_name=dept_name,
        )
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Backup creation failed: {e}",
        )
    return meta


@router.get("/summary", response_model=BackupSummaryOut)
def get_summary(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Return aggregate backup statistics for the current department (or system)."""
    try:
        backup_service.check_and_run_auto_backup(db)
    except Exception:
        pass
    dept_id, _ = _get_dept_scope(admin)
    return backup_service.get_backup_summary(tenant_department_id=dept_id)


@router.get("", response_model=list[BackupMetaOut])
def list_backups(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """List backups (newest first). Filtered to department for Department HODs."""
    try:
        backup_service.check_and_run_auto_backup(db)
    except Exception:
        pass
    dept_id, _ = _get_dept_scope(admin)
    return backup_service.list_backups(tenant_department_id=dept_id)



@router.get("/{backup_id}", response_model=BackupMetaOut)
def get_backup(
    backup_id: str,
    admin: User = Depends(require_admin),
):
    """Get metadata for a single backup."""
    dept_id, _ = _get_dept_scope(admin)
    entry = backup_service.get_backup(backup_id, tenant_department_id=dept_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Backup not found")
    return entry


@router.get("/{backup_id}/download")
def download_backup(
    backup_id: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Download a backup file.
    The filename is resolved server-side from the index — the client
    cannot specify arbitrary filesystem paths.
    """
    dept_id, _ = _get_dept_scope(admin)
    try:
        file_path = backup_service.get_backup_file_path(backup_id, tenant_department_id=dept_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    # Audit the download
    from app.services.admin_service import log_audit_event
    entry = backup_service.get_backup(backup_id, tenant_department_id=dept_id)
    log_audit_event(
        db,
        actor_user_id=admin.id,
        action="backup.downloaded",
        target_type="backup",
        details={"backup_id": backup_id, "filename": entry["filename"] if entry else "unknown"},
    )
    db.commit()

    return FileResponse(
        path=str(file_path),
        media_type="application/json",
        filename=file_path.name,
        headers={
            "Content-Disposition": f'attachment; filename="{file_path.name}"',
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.post("/{backup_id}/validate", response_model=BackupMetaOut)
def validate_backup(
    backup_id: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Validate a backup's integrity.
    Checks: file exists, non-zero, valid JSON, expected format, checksum.
    """
    dept_id, _ = _get_dept_scope(admin)
    result = backup_service.validate_backup(backup_id)
    if result.get("validation_status") == "not_found" or (dept_id is not None and result.get("department_id") != dept_id):
        raise HTTPException(status_code=404, detail="Backup not found")

    # Audit the validation
    from app.services.admin_service import log_audit_event
    log_audit_event(
        db,
        actor_user_id=admin.id,
        action="backup.validated",
        target_type="backup",
        details={
            "backup_id": backup_id,
            "validation_status": result.get("validation_status"),
            "errors": result.get("validation_errors", []),
            "department_id": dept_id,
        },
    )
    db.commit()

    return result


@router.post("/{backup_id}/restore", response_model=RestoreResultOut)
def restore_backup(
    backup_id: str,
    body: RestoreConfirmRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Safely restore a backup.
    Department HODs restore ONLY their department's data;
    System Admins restore full database state.
    """
    dept_id, dept_name = _get_dept_scope(admin)
    try:
        result = backup_service.restore_backup(
            db=db,
            backup_id=backup_id,
            actor_user_id=admin.id,
            actor_name=admin.username or admin.name,
            tenant_department_id=dept_id,
            tenant_department_name=dept_name,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
    return result


@router.delete("/{backup_id}", status_code=204)
def delete_backup(
    backup_id: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Delete a backup. Requires confirmation from the UI."""
    dept_id, _ = _get_dept_scope(admin)
    try:
        backup_service.delete_backup(
            backup_id=backup_id,
            db=db,
            actor_user_id=admin.id,
            tenant_department_id=dept_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
    return None
