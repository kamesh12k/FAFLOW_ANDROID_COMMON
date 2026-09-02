from __future__ import annotations

from datetime import date, datetime
from typing import Any
from pydantic import BaseModel, Field


class RetentionPolicySettingsIn(BaseModel):
    auto_cleanup_enabled: bool = Field(default=True, description="Whether automated retention cleanup runs periodically")
    cleanup_frequency_days: int = Field(default=7, ge=1, le=365, description="Frequency in days to run automated cleanup")
    retention_audit_logs_days: int = Field(default=90, ge=0, description="Days to retain audit logs (0 to keep indefinitely)")
    retention_notifications_days: int = Field(default=30, ge=0, description="Days to retain notifications (0 to keep indefinitely)")
    retention_backups_days: int = Field(default=60, ge=0, description="Days to retain backup files (0 to keep indefinitely)")
    retention_backups_max_count: int = Field(default=10, ge=1, le=100, description="Maximum number of backups to keep (older backups purged)")
    retention_traffic_days: int = Field(default=30, ge=0, description="Days to retain traffic & performance metrics")
    retention_leaves_days: int = Field(default=365, ge=0, description="Days to retain completed/historical leave requests (0 to keep indefinitely)")
    retention_credits_days: int = Field(default=365, ge=0, description="Days to retain credit transaction history (0 to keep indefinitely)")
    retention_timetable_submissions_days: int = Field(default=180, ge=0, description="Days to retain timetable submission history (0 to keep indefinitely)")


class RetentionPolicySettingsOut(RetentionPolicySettingsIn):
    last_auto_cleanup_at: str | None = None
    next_scheduled_cleanup_at: str | None = None
    message: str | None = None


class SelectivePurgePreviewRequest(BaseModel):
    targets: list[str] = Field(..., description="List of entity targets e.g. ['audit_logs', 'notifications', 'backups', 'traffic_metrics', 'leaves', 'credits', 'staff_leaves', 'timetable_submissions']")
    filter_type: str = Field(default="older_than_days", description="'older_than_days', 'date_range', or 'all_records'")
    older_than_days: int | None = Field(default=90, ge=0, description="Number of days threshold for 'older_than_days' filter")
    start_date: str | None = Field(default=None, description="Start date (YYYY-MM-DD) for date_range")
    end_date: str | None = Field(default=None, description="End date (YYYY-MM-DD) for date_range")
    department_id: int | None = Field(default=None, description="Optional department isolation filter")
    leave_status_filter: list[str] | None = Field(default=None, description="Optional leave statuses e.g. ['approved', 'rejected', 'cancelled']")


class SelectivePurgePreviewResponse(BaseModel):
    targets_summary: dict[str, int]
    total_records: int
    estimated_disk_impact: str
    warning_messages: list[str]
    filter_description: str


class SelectivePurgeExecuteRequest(SelectivePurgePreviewRequest):
    create_backup_first: bool = Field(default=True, description="Automatically take a snapshot backup before purging")
    confirmation_phrase: str = Field(default="PURGE DATA", description="Safety confirmation phrase")


class SelectivePurgeExecuteResponse(BaseModel):
    success: bool
    purged_counts: dict[str, int]
    total_purged: int
    backup_id: str | None = None
    backup_filename: str | None = None
    purged_at: str
    purged_by: str
    message: str


class TableStat(BaseModel):
    table_name: str
    display_name: str
    category: str
    record_count: int
    oldest_record_at: str | None = None
    newest_record_at: str | None = None


class StorageStatsOut(BaseModel):
    total_records: int
    tables: list[TableStat]
    backup_count: int
    backup_total_size_bytes: int
    backup_total_size_human: str
    last_auto_cleanup_at: str | None = None
    retention_enabled: bool = True
