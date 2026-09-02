"""
Pydantic schemas for the Backup & Restore API.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, field_validator


class BackupMetaOut(BaseModel):
    """Response shape for a single backup entry."""
    backup_id: str
    filename: str
    created_at: str
    created_by: str
    file_size_bytes: int
    checksum_sha256: str
    backup_type: str
    status: str
    validation_status: str
    is_pre_restore: bool
    last_validated_at: str | None
    restored_at: str | None
    table_count: int
    validation_errors: list[str] | None = None
    department_id: int | None = None
    department_name: str | None = None
    backup_scope: str | None = "full"


class BackupSummaryOut(BaseModel):
    """Aggregate stats for the dashboard summary bar."""
    backup_count: int
    total_storage_bytes: int
    last_backup_at: str | None
    last_restore_at: str | None


class RestoreConfirmRequest(BaseModel):
    """Body for the restore endpoint. Requires explicit typed confirmation."""
    confirmation_text: str

    @field_validator("confirmation_text")
    @classmethod
    def validate_confirmation(cls, v: str) -> str:
        if v != "I understand that the current data will be replaced":
            raise ValueError(
                'Confirmation text must be exactly: '
                '"I understand that the current data will be replaced"'
            )
        return v


class RestoreResultOut(BaseModel):
    """Response after a successful restore."""
    restored_backup_id: str
    restored_filename: str
    pre_restore_backup_id: str
    pre_restore_filename: str
    restored_at: str
    message: str


class BackupScheduleSettingsIn(BaseModel):
    """Payload to customize automatic backup interval and toggle status."""
    enabled: bool = True
    interval_days: int = 7

    @field_validator("interval_days")
    @classmethod
    def validate_interval(cls, v: int) -> int:
        if v < 1 or v > 365:
            raise ValueError("Backup interval must be between 1 and 365 days.")
        return v


class BackupScheduleSettingsOut(BaseModel):
    """Response shape for automatic backup schedule configuration."""
    enabled: bool = True
    interval_days: int = 7
    last_auto_backup_at: str | None = None
    next_scheduled_at: str | None = None
    message: str | None = None

