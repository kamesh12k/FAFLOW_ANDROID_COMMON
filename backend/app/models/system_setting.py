from sqlalchemy import Column, String, Text, DateTime, func, Integer, ForeignKey, UniqueConstraint

from app.database import Base

# Single source of truth for valid campus_operations_mode values — both
# app/services/substitution_service.py and app/schemas/substitution.py
# import this rather than each declaring their own copy, so the two can
# never drift out of sync.
CAMPUS_OPERATIONS_MODES = {"manual", "assisted", "autonomous"}


class SystemSetting(Base):
    """Small key/value store for settings that Factory Reset restores to
    defaults. Most configuration lives in .env (untouched by reset);
    this table is only for runtime-editable defaults."""
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), nullable=False)
    value = Column(Text, nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="CASCADE"), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("key", "department_id", name="uq_system_settings_key_dept"),
    )



DEFAULT_SYSTEM_SETTINGS = {
    "app_name": "FAFLOW",
    "push_notifications_enabled": "true",
    "max_secondary_admins": "3",
    "periods_per_day": "5",
    "day_order_max": "6",
    # Campus Operations Mode: "manual" | "assisted" | "autonomous" — see
    # substitution_service.py for what each mode actually does. Defaults
    # to "assisted" rather than "autonomous": a fresh install should not
    # start auto-executing substitute assignments before an admin has
    # deliberately turned that on.
    "campus_operations_mode": "assisted",
    "campus_operations_mode_override": "none",
    "emergency_window_hours": "2",
    "teacher_self_management_enabled": "false",
    "cross_department_substitutions_enabled": "false",
    "teacher_timetable_entry_mode": "approval",
    "auto_backup_enabled": "true",
    "auto_backup_interval_days": "7",
    "last_auto_backup_at": "",
    "retention_auto_cleanup_enabled": "true",
    "retention_cleanup_frequency_days": "7",
    "last_auto_cleanup_at": "",
    "retention_audit_logs_days": "90",
    "retention_notifications_days": "30",
    "retention_backups_days": "60",
    "retention_backups_max_count": "10",
    "retention_traffic_days": "30",
    "retention_leaves_days": "365",
    "retention_credits_days": "365",
    "retention_timetable_submissions_days": "180",
}
