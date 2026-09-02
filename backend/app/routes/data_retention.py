from __future__ import annotations

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import require_system_admin
from app.models.user import User
from app.schemas.data_retention import (
    RetentionPolicySettingsIn,
    RetentionPolicySettingsOut,
    SelectivePurgePreviewRequest,
    SelectivePurgePreviewResponse,
    SelectivePurgeExecuteRequest,
    SelectivePurgeExecuteResponse,
    StorageStatsOut,
)
from app.services import data_retention_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/data-retention", tags=["Data Retention & Purge"])


@router.get("/stats", response_model=StorageStatsOut)
def get_storage_stats(
    admin: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    """
    Returns live database record counts across all core application tables,
    backup filesystem footprint, and retention configuration status.
    Strictly accessible to System Admin only.
    """
    return data_retention_service.get_storage_stats(db, tenant_department_id=None)


@router.get("/policy", response_model=RetentionPolicySettingsOut)
def get_retention_policy(
    admin: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    """
    Retrieve automated retention policy settings, scheduled cleanup interval, and retention windows.
    Also triggers a check if auto-cleanup is due.
    Strictly accessible to System Admin only.
    """
    try:
        data_retention_service.check_and_run_auto_cleanup(db)
    except Exception as e:
        logger.debug("Auto cleanup check skipped: %s", e)
    return data_retention_service.get_retention_policy(db)


@router.put("/policy", response_model=RetentionPolicySettingsOut)
def update_retention_policy(
    policy: RetentionPolicySettingsIn,
    admin: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    """
    Update automated retention policies (cleanup frequency, retention windows per entity).
    Strictly accessible to System Admin only.
    """
    return data_retention_service.update_retention_policy(
        db=db,
        policy=policy,
        actor_user_id=admin.id,
        actor_name=admin.username or admin.name,
    )


@router.post("/run-auto-cleanup", response_model=SelectivePurgeExecuteResponse)
def run_auto_cleanup_now(
    admin: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    """
    Force immediate execution of automated data retention cleanup policy.
    Strictly accessible to System Admin only.
    """
    res = data_retention_service.check_and_run_auto_cleanup(db, force=True)
    if not res:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to run automated retention cleanup."
        )
    return SelectivePurgeExecuteResponse(
        success=res["success"],
        purged_counts=res["purged_counts"],
        total_purged=res["total_purged"],
        purged_at=res["purged_at"],
        purged_by=admin.username or admin.name,
        message=res["message"],
    )


@router.post("/preview", response_model=SelectivePurgePreviewResponse)
def preview_selective_purge(
    req: SelectivePurgePreviewRequest,
    admin: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    """
    Simulates selective data purge and calculates exact record counts for each selected entity
    matching user filter criteria (without modifying any database records).
    Strictly accessible to System Admin only.
    """
    return data_retention_service.preview_selective_purge(db, req=req, tenant_department_id=None)


@router.post("/purge", response_model=SelectivePurgeExecuteResponse)
def execute_selective_purge(
    req: SelectivePurgeExecuteRequest,
    admin: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    """
    Executes selective data purge of targeted datasets according to filter parameters.
    Requires safety confirmation phrase 'PURGE DATA' and can automatically generate
    a snapshot backup prior to deletion.
    Strictly accessible to System Admin only.
    """
    try:
        return data_retention_service.execute_selective_purge(
            db=db,
            req=req,
            actor_user_id=admin.id,
            actor_name=admin.username or admin.name,
            tenant_department_id=None,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error("Selective purge failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Purge execution failed: {e}",
        )
