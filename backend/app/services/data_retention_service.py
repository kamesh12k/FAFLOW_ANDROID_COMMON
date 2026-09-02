from __future__ import annotations

import logging
from datetime import datetime, date, timedelta, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.notification import Notification, PushSubscription
from app.models.leave import LeaveRequest, AlterAssignment
from app.models.credit import CreditTransaction, TeacherCredit
from app.models.staff_leave import StaffLeaveRequest, StaffCreditTransaction, StaffCredit
from app.models.timetable_submission import TimetableSubmission
from app.models.day_order_calendar import CalendarDay
from app.models.academic_calendar import AcademicYear, Semester
from app.models.system_setting import SystemSetting, DEFAULT_SYSTEM_SETTINGS
from app.models.user import User, Role
from app.models.class_ import Class
from app.models.subject import Subject
from app.models.room import Room
from app.models.timetable import TimetableSlot
from app.models.operational_staff import OperationalStaff
from app.core.traffic import traffic_manager
from app.services import backup_service
from app.services.admin_service import log_audit_event
from app.schemas.data_retention import (
    RetentionPolicySettingsIn,
    RetentionPolicySettingsOut,
    SelectivePurgePreviewRequest,
    SelectivePurgePreviewResponse,
    SelectivePurgeExecuteRequest,
    SelectivePurgeExecuteResponse,
    StorageStatsOut,
    TableStat,
)

logger = logging.getLogger(__name__)


def _get_setting_val(db: Session, key: str, default: str) -> str:
    row = db.query(SystemSetting).filter(
        SystemSetting.key == key,
        SystemSetting.department_id.is_(None)
    ).first()
    return row.value if row else default


def _set_setting_val(db: Session, key: str, val: str) -> None:
    row = db.query(SystemSetting).filter(
        SystemSetting.key == key,
        SystemSetting.department_id.is_(None)
    ).first()
    if not row:
        row = SystemSetting(key=key, value=val, department_id=None)
        db.add(row)
    else:
        row.value = val


def get_retention_policy(db: Session) -> RetentionPolicySettingsOut:
    enabled = _get_setting_val(db, "retention_auto_cleanup_enabled", "true").lower() == "true"
    freq = int(_get_setting_val(db, "retention_cleanup_frequency_days", "7"))
    last_auto_str = _get_setting_val(db, "last_auto_cleanup_at", "")

    audit_days = int(_get_setting_val(db, "retention_audit_logs_days", "90"))
    notif_days = int(_get_setting_val(db, "retention_notifications_days", "30"))
    backup_days = int(_get_setting_val(db, "retention_backups_days", "60"))
    backup_max = int(_get_setting_val(db, "retention_backups_max_count", "10"))
    traffic_days = int(_get_setting_val(db, "retention_traffic_days", "30"))
    leaves_days = int(_get_setting_val(db, "retention_leaves_days", "365"))
    credits_days = int(_get_setting_val(db, "retention_credits_days", "365"))
    tt_days = int(_get_setting_val(db, "retention_timetable_submissions_days", "180"))

    next_scheduled_at = None
    if enabled:
        if last_auto_str:
            try:
                dt = datetime.fromisoformat(last_auto_str)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                next_dt = dt + timedelta(days=freq)
                next_scheduled_at = next_dt.isoformat()
            except Exception:
                next_scheduled_at = (datetime.now(timezone.utc) + timedelta(days=freq)).isoformat()
        else:
            next_scheduled_at = datetime.now(timezone.utc).isoformat()

    return RetentionPolicySettingsOut(
        auto_cleanup_enabled=enabled,
        cleanup_frequency_days=freq,
        retention_audit_logs_days=audit_days,
        retention_notifications_days=notif_days,
        retention_backups_days=backup_days,
        retention_backups_max_count=backup_max,
        retention_traffic_days=traffic_days,
        retention_leaves_days=leaves_days,
        retention_credits_days=credits_days,
        retention_timetable_submissions_days=tt_days,
        last_auto_cleanup_at=last_auto_str or None,
        next_scheduled_cleanup_at=next_scheduled_at,
        message=f"Automated retention cleanup is {'active every ' + str(freq) + ' days' if enabled else 'disabled'}.",
    )


def update_retention_policy(
    db: Session,
    policy: RetentionPolicySettingsIn,
    actor_user_id: int | None = None,
    actor_name: str | None = None,
) -> RetentionPolicySettingsOut:
    _set_setting_val(db, "retention_auto_cleanup_enabled", "true" if policy.auto_cleanup_enabled else "false")
    _set_setting_val(db, "retention_cleanup_frequency_days", str(policy.cleanup_frequency_days))
    _set_setting_val(db, "retention_audit_logs_days", str(policy.retention_audit_logs_days))
    _set_setting_val(db, "retention_notifications_days", str(policy.retention_notifications_days))
    _set_setting_val(db, "retention_backups_days", str(policy.retention_backups_days))
    _set_setting_val(db, "retention_backups_max_count", str(policy.retention_backups_max_count))
    _set_setting_val(db, "retention_traffic_days", str(policy.retention_traffic_days))
    _set_setting_val(db, "retention_leaves_days", str(policy.retention_leaves_days))
    _set_setting_val(db, "retention_credits_days", str(policy.retention_credits_days))
    _set_setting_val(db, "retention_timetable_submissions_days", str(policy.retention_timetable_submissions_days))
    db.commit()

    log_audit_event(
        db,
        actor_user_id=actor_user_id,
        action="retention.policy_updated",
        target_type="system_setting",
        details={
            "enabled": policy.auto_cleanup_enabled,
            "cleanup_frequency_days": policy.cleanup_frequency_days,
            "updated_by": actor_name,
        },
    )
    db.commit()

    return get_retention_policy(db)


def _format_size(num_bytes: int) -> str:
    if num_bytes <= 0:
        return "0 B"
    for unit in ["B", "KB", "MB", "GB"]:
        if num_bytes < 1024.0:
            return f"{num_bytes:.1f} {unit}"
        num_bytes /= 1024.0
    return f"{num_bytes:.1f} TB"


def get_storage_stats(db: Session, tenant_department_id: int | None = None) -> StorageStatsOut:
    """Returns database table record counts, timestamps, and backup storage metrics."""
    tables_to_inspect = [
        ("audit_logs", "Audit Logs", "System & Logs", AuditLog, AuditLog.created_at, AuditLog.department_id),
        ("notifications", "Notifications", "System & Logs", Notification, Notification.created_at, None),
        ("push_subscriptions", "Push Subscriptions", "System & Logs", PushSubscription, PushSubscription.created_at, None),
        ("leave_requests", "Faculty Leave Requests", "Leaves & Operations", LeaveRequest, LeaveRequest.created_at, None),
        ("alter_assignments", "Substitution Assignments", "Leaves & Operations", AlterAssignment, AlterAssignment.assigned_at, None),
        ("credit_transactions", "Credit Transactions", "Credits", CreditTransaction, CreditTransaction.created_at, None),
        ("teacher_credits", "Teacher Credit Balances", "Credits", TeacherCredit, None, None),
        ("staff_leave_requests", "Staff Leave Requests", "Staff Operations", StaffLeaveRequest, StaffLeaveRequest.created_at, None),
        ("staff_credit_transactions", "Staff Credit Transactions", "Staff Operations", StaffCreditTransaction, StaffCreditTransaction.created_at, None),
        ("timetable_submissions", "Timetable Submissions", "Timetable", TimetableSubmission, TimetableSubmission.created_at, None),
        ("timetable_slots", "Timetable Slots", "Timetable", TimetableSlot, None, None),
        ("calendar_days", "Academic Calendar Days", "Academic Calendar", CalendarDay, None, None),
        ("users", "User Accounts", "Core Setup", User, User.created_at, User.department_id),
        ("classes", "Classes", "Core Setup", Class, None, Class.department_id),
        ("subjects", "Subjects", "Core Setup", Subject, None, Subject.department_id),
        ("rooms", "Rooms & Labs", "Core Setup", Room, None, None),
        ("operational_staff", "Operational Staff", "Staff Operations", OperationalStaff, None, OperationalStaff.department_id),
    ]

    table_stats: list[TableStat] = []
    total_records = 0

    for tbl_name, disp_name, cat, model, date_col, dept_col in tables_to_inspect:
        try:
            q = db.query(model)
            if tenant_department_id is not None and dept_col is not None:
                q = q.filter(dept_col == tenant_department_id)
            cnt = q.count()
            total_records += cnt

            oldest_str, newest_str = None, None
            if date_col is not None and cnt > 0:
                oldest = db.query(func.min(date_col)).scalar()
                newest = db.query(func.max(date_col)).scalar()
                if oldest:
                    oldest_str = oldest.isoformat() if hasattr(oldest, "isoformat") else str(oldest)
                if newest:
                    newest_str = newest.isoformat() if hasattr(newest, "isoformat") else str(newest)

            table_stats.append(
                TableStat(
                    table_name=tbl_name,
                    display_name=disp_name,
                    category=cat,
                    record_count=cnt,
                    oldest_record_at=oldest_str,
                    newest_record_at=newest_str,
                )
            )
        except Exception as e:
            logger.debug("Failed stat for table %s: %s", tbl_name, e)

    # Backup filesystem stats
    backups_list = backup_service.list_backups(tenant_department_id=tenant_department_id)
    backup_count = len(backups_list)
    backup_total_size = sum(b.get("size_bytes", 0) for b in backups_list)

    last_auto_str = _get_setting_val(db, "last_auto_cleanup_at", "")
    enabled = _get_setting_val(db, "retention_auto_cleanup_enabled", "true").lower() == "true"

    return StorageStatsOut(
        total_records=total_records,
        tables=table_stats,
        backup_count=backup_count,
        backup_total_size_bytes=backup_total_size,
        backup_total_size_human=_format_size(backup_total_size),
        last_auto_cleanup_at=last_auto_str or None,
        retention_enabled=enabled,
    )


def _resolve_date_cutoff(
    filter_type: str,
    older_than_days: int | None,
    start_date_str: str | None,
    end_date_str: str | None,
) -> tuple[datetime | None, datetime | None, str]:
    """Resolves (start_datetime, end_datetime, description)."""
    now = datetime.now(timezone.utc)
    if filter_type == "older_than_days":
        days = older_than_days if older_than_days is not None else 90
        cutoff = now - timedelta(days=days)
        return None, cutoff, f"Records older than {days} days (before {cutoff.strftime('%Y-%m-%d %H:%M UTC')})"
    elif filter_type == "date_range":
        start_dt, end_dt = None, None
        if start_date_str:
            d = date.fromisoformat(start_date_str)
            start_dt = datetime(d.year, d.month, d.day, 0, 0, 0, tzinfo=timezone.utc)
        if end_date_str:
            d = date.fromisoformat(end_date_str)
            end_dt = datetime(d.year, d.month, d.day, 23, 59, 59, tzinfo=timezone.utc)
        desc = f"Records between {start_date_str or 'Beginning'} and {end_date_str or 'Present'}"
        return start_dt, end_dt, desc
    else:  # all_records
        return None, None, "All historical records in selected categories"


def preview_selective_purge(
    db: Session,
    req: SelectivePurgePreviewRequest,
    tenant_department_id: int | None = None,
) -> SelectivePurgePreviewResponse:
    """Calculates exactly how many records would be deleted for each selected target without making modifications."""
    start_dt, end_dt, desc = _resolve_date_cutoff(
        req.filter_type, req.older_than_days, req.start_date, req.end_date
    )
    dept_id = req.department_id or tenant_department_id

    summary: dict[str, int] = {}
    total = 0
    warnings: list[str] = []

    # 1. Audit Logs
    if "audit_logs" in req.targets:
        q = db.query(AuditLog)
        if dept_id is not None:
            q = q.filter(AuditLog.department_id == dept_id)
        if start_dt is not None:
            q = q.filter(AuditLog.created_at >= start_dt)
        if end_dt is not None:
            q = q.filter(AuditLog.created_at <= end_dt)
        cnt = q.count()
        summary["audit_logs"] = cnt
        total += cnt

    # 2. Notifications
    if "notifications" in req.targets:
        q = db.query(Notification)
        if start_dt is not None:
            q = q.filter(Notification.created_at >= start_dt)
        if end_dt is not None:
            q = q.filter(Notification.created_at <= end_dt)
        cnt = q.count()
        summary["notifications"] = cnt
        total += cnt

    # 3. Backups
    if "backups" in req.targets:
        all_backups = backup_service.list_backups(tenant_department_id=dept_id)
        match_count = 0
        for b in all_backups:
            try:
                b_created = datetime.fromisoformat(b["created_at"])
                if b_created.tzinfo is None:
                    b_created = b_created.replace(tzinfo=timezone.utc)
                if start_dt and b_created < start_dt:
                    continue
                if end_dt and b_created > end_dt:
                    continue
                match_count += 1
            except Exception:
                if req.filter_type == "all_records":
                    match_count += 1
        summary["backups"] = match_count
        total += match_count

    # 4. Traffic & Performance Metrics
    if "traffic_metrics" in req.targets:
        stats = traffic_manager.get_stats()
        recent_logs = stats.get("recent_logs", [])
        summary["traffic_metrics"] = len(recent_logs)
        total += len(recent_logs)

    # 5. Leaves & Substitutions
    if "leaves" in req.targets:
        q = db.query(LeaveRequest)
        if dept_id is not None:
            q = q.join(User, LeaveRequest.teacher_id == User.id).filter(User.department_id == dept_id)
        if req.leave_status_filter:
            q = q.filter(LeaveRequest.status.in_(req.leave_status_filter))
        if start_dt is not None:
            q = q.filter(LeaveRequest.created_at >= start_dt)
        if end_dt is not None:
            q = q.filter(LeaveRequest.created_at <= end_dt)
        cnt = q.count()
        summary["leaves"] = cnt
        total += cnt
        if req.filter_type == "all_records" and not req.leave_status_filter:
            warnings.append("All leave requests (including pending/approved) will be purged.")

    # 6. Credit Transactions
    if "credits" in req.targets:
        q = db.query(CreditTransaction)
        if dept_id is not None:
            q = q.join(User, CreditTransaction.teacher_id == User.id).filter(User.department_id == dept_id)
        if start_dt is not None:
            q = q.filter(CreditTransaction.created_at >= start_dt)
        if end_dt is not None:
            q = q.filter(CreditTransaction.created_at <= end_dt)
        cnt = q.count()
        summary["credits"] = cnt
        total += cnt

    # 7. Staff Leaves & Staff Credit Transactions
    if "staff_leaves" in req.targets:
        q = db.query(StaffLeaveRequest)
        if dept_id is not None:
            q = q.join(OperationalStaff, StaffLeaveRequest.staff_id == OperationalStaff.id).filter(OperationalStaff.department_id == dept_id)
        if start_dt is not None:
            q = q.filter(StaffLeaveRequest.created_at >= start_dt)
        if end_dt is not None:
            q = q.filter(StaffLeaveRequest.created_at <= end_dt)
        cnt = q.count()
        summary["staff_leaves"] = cnt
        total += cnt

    # 8. Timetable Submissions
    if "timetable_submissions" in req.targets:
        q = db.query(TimetableSubmission)
        if dept_id is not None:
            q = q.join(User, TimetableSubmission.teacher_id == User.id).filter(User.department_id == dept_id)
        if start_dt is not None:
            q = q.filter(TimetableSubmission.created_at >= start_dt)
        if end_dt is not None:
            q = q.filter(TimetableSubmission.created_at <= end_dt)
        cnt = q.count()
        summary["timetable_submissions"] = cnt
        total += cnt

    # 9. Calendar Days
    if "calendar_days" in req.targets:
        q = db.query(CalendarDay)
        if start_dt is not None:
            q = q.filter(CalendarDay.date >= start_dt.date())
        if end_dt is not None:
            q = q.filter(CalendarDay.date <= end_dt.date())
        cnt = q.count()
        summary["calendar_days"] = cnt
        total += cnt

    if total == 0:
        warnings.append("No records matched the selected criteria.")

    estimated_disk = _format_size(total * 512)

    return SelectivePurgePreviewResponse(
        targets_summary=summary,
        total_records=total,
        estimated_disk_impact=estimated_disk,
        warning_messages=warnings,
        filter_description=desc,
    )


def execute_selective_purge(
    db: Session,
    req: SelectivePurgeExecuteRequest,
    actor_user_id: int | None = None,
    actor_name: str | None = None,
    tenant_department_id: int | None = None,
) -> SelectivePurgeExecuteResponse:
    """
    Executes selective deletion of targeted records in foreign-key safe order.
    Optionally takes a snapshot backup before making any changes.
    """
    if req.confirmation_phrase.strip().upper() != "PURGE DATA":
        raise ValueError("Invalid confirmation phrase. Please type 'PURGE DATA' to confirm.")

    dept_id = req.department_id or tenant_department_id
    start_dt, end_dt, desc = _resolve_date_cutoff(
        req.filter_type, req.older_than_days, req.start_date, req.end_date
    )

    backup_id = None
    backup_filename = None

    # Step 1: Create automatic snapshot backup if requested
    if req.create_backup_first:
        try:
            meta = backup_service.create_backup(
                db=db,
                actor_user_id=actor_user_id,
                actor_name=f"Pre-Purge Auto Backup ({actor_name or 'Admin'})",
                backup_type="manual",
                tenant_department_id=dept_id,
            )
            backup_id = meta.get("backup_id")
            backup_filename = meta.get("filename")
            logger.info("Pre-purge snapshot backup created: %s", backup_filename)
        except Exception as e:
            logger.warning("Could not create pre-purge backup: %s", e)

    purged_counts: dict[str, int] = {}
    total_purged = 0

    # Step 2: Delete targets in child-first foreign key order

    # 1. Staff Leaves & Staff Credits
    if "staff_leaves" in req.targets:
        q = db.query(StaffLeaveRequest)
        if dept_id is not None:
            q = q.join(OperationalStaff, StaffLeaveRequest.staff_id == OperationalStaff.id).filter(OperationalStaff.department_id == dept_id)
        if start_dt is not None:
            q = q.filter(StaffLeaveRequest.created_at >= start_dt)
        if end_dt is not None:
            q = q.filter(StaffLeaveRequest.created_at <= end_dt)
        leave_ids = [l.id for l in q.all()]
        if leave_ids:
            cnt = db.query(StaffLeaveRequest).filter(StaffLeaveRequest.id.in_(leave_ids)).delete(synchronize_session=False)
            purged_counts["staff_leaves"] = cnt
            total_purged += cnt

    # 2. Leaves & Substitutions
    if "leaves" in req.targets:
        q = db.query(LeaveRequest)
        if dept_id is not None:
            q = q.join(User, LeaveRequest.teacher_id == User.id).filter(User.department_id == dept_id)
        if req.leave_status_filter:
            q = q.filter(LeaveRequest.status.in_(req.leave_status_filter))
        if start_dt is not None:
            q = q.filter(LeaveRequest.created_at >= start_dt)
        if end_dt is not None:
            q = q.filter(LeaveRequest.created_at <= end_dt)
        
        target_leaves = q.all()
        leave_ids = [l.id for l in target_leaves]
        if leave_ids:
            # Delete child AlterAssignments first
            db.query(AlterAssignment).filter(AlterAssignment.leave_request_id.in_(leave_ids)).delete(synchronize_session=False)
            # Also nullify or delete related credit transactions referencing leave_request_id
            db.query(CreditTransaction).filter(CreditTransaction.leave_request_id.in_(leave_ids)).delete(synchronize_session=False)
            cnt = db.query(LeaveRequest).filter(LeaveRequest.id.in_(leave_ids)).delete(synchronize_session=False)
            purged_counts["leaves"] = cnt
            total_purged += cnt

    # 3. Credit Transactions
    if "credits" in req.targets:
        q = db.query(CreditTransaction)
        if dept_id is not None:
            q = q.join(User, CreditTransaction.teacher_id == User.id).filter(User.department_id == dept_id)
        if start_dt is not None:
            q = q.filter(CreditTransaction.created_at >= start_dt)
        if end_dt is not None:
            q = q.filter(CreditTransaction.created_at <= end_dt)
        cnt = q.delete(synchronize_session=False)
        purged_counts["credits"] = cnt
        total_purged += cnt

    # 4. Timetable Submissions
    if "timetable_submissions" in req.targets:
        q = db.query(TimetableSubmission)
        if dept_id is not None:
            q = q.join(User, TimetableSubmission.teacher_id == User.id).filter(User.department_id == dept_id)
        if start_dt is not None:
            q = q.filter(TimetableSubmission.created_at >= start_dt)
        if end_dt is not None:
            q = q.filter(TimetableSubmission.created_at <= end_dt)
        cnt = q.delete(synchronize_session=False)
        purged_counts["timetable_submissions"] = cnt
        total_purged += cnt

    # 5. Notifications
    if "notifications" in req.targets:
        q = db.query(Notification)
        if start_dt is not None:
            q = q.filter(Notification.created_at >= start_dt)
        if end_dt is not None:
            q = q.filter(Notification.created_at <= end_dt)
        cnt = q.delete(synchronize_session=False)
        purged_counts["notifications"] = cnt
        total_purged += cnt

    # 6. Audit Logs
    if "audit_logs" in req.targets:
        q = db.query(AuditLog)
        if dept_id is not None:
            q = q.filter(AuditLog.department_id == dept_id)
        if start_dt is not None:
            q = q.filter(AuditLog.created_at >= start_dt)
        if end_dt is not None:
            q = q.filter(AuditLog.created_at <= end_dt)
        cnt = q.delete(synchronize_session=False)
        purged_counts["audit_logs"] = cnt
        total_purged += cnt

    # 7. Calendar Days
    if "calendar_days" in req.targets:
        q = db.query(CalendarDay)
        if start_dt is not None:
            q = q.filter(CalendarDay.date >= start_dt.date())
        if end_dt is not None:
            q = q.filter(CalendarDay.date <= end_dt.date())
        cnt = q.delete(synchronize_session=False)
        purged_counts["calendar_days"] = cnt
        total_purged += cnt

    # 8. Traffic Metrics
    if "traffic_metrics" in req.targets:
        traffic_manager.clear()
        purged_counts["traffic_metrics"] = 1

    # 9. Backups
    if "backups" in req.targets:
        all_backups = backup_service.list_backups(tenant_department_id=dept_id)
        deleted_bks = 0
        for b in all_backups:
            try:
                b_created = datetime.fromisoformat(b["created_at"])
                if b_created.tzinfo is None:
                    b_created = b_created.replace(tzinfo=timezone.utc)
                if start_dt and b_created < start_dt:
                    continue
                if end_dt and b_created > end_dt:
                    continue
                # Don't delete the backup we just created moments ago!
                if backup_id and b["backup_id"] == backup_id:
                    continue
                backup_service.delete_backup(b["backup_id"], db=db, actor_user_id=actor_user_id, tenant_department_id=dept_id)
                deleted_bks += 1
            except Exception as e:
                logger.debug("Failed deleting backup %s: %s", b.get("backup_id"), e)
        if deleted_bks > 0:
            purged_counts["backups"] = deleted_bks
            total_purged += deleted_bks

    db.commit()

    # Log the audit event for this selective purge
    log_audit_event(
        db,
        actor_user_id=actor_user_id,
        action="data_retention.selective_purge_executed",
        target_type="system",
        details={
            "targets": req.targets,
            "filter_type": req.filter_type,
            "filter_desc": desc,
            "purged_counts": purged_counts,
            "total_purged": total_purged,
            "backup_id": backup_id,
            "backup_filename": backup_filename,
            "actor_name": actor_name,
        },
    )
    db.commit()

    now_iso = datetime.now(timezone.utc).isoformat()

    return SelectivePurgeExecuteResponse(
        success=True,
        purged_counts=purged_counts,
        total_purged=total_purged,
        backup_id=backup_id,
        backup_filename=backup_filename,
        purged_at=now_iso,
        purged_by=actor_name or "System Administrator",
        message=f"Successfully purged {total_purged} records across {len(purged_counts)} dataset(s)."
    )


def check_and_run_auto_cleanup(db: Session, force: bool = False) -> dict[str, Any] | None:
    """
    Evaluates if automated data retention cleanup is due according to configured retention policies.
    If due or force=True, executes foreign-key safe pruning of expired records.
    """
    policy = get_retention_policy(db)
    if not policy.auto_cleanup_enabled and not force:
        return None

    freq_days = policy.cleanup_frequency_days
    last_auto_str = policy.last_auto_cleanup_at
    is_due = False

    if force or not last_auto_str:
        is_due = True
    else:
        try:
            dt = datetime.fromisoformat(last_auto_str)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            now = datetime.now(timezone.utc)
            if (now - dt).total_seconds() >= freq_days * 86400:
                is_due = True
        except Exception:
            is_due = True

    if not is_due:
        return None

    logger.info("data_retention_service: running automated data retention cleanup (frequency: %d days)...", freq_days)

    now = datetime.now(timezone.utc)
    purged_counts: dict[str, int] = {}
    total_purged = 0

    try:
        # 1. Prune Audit Logs
        if policy.retention_audit_logs_days > 0:
            cutoff = now - timedelta(days=policy.retention_audit_logs_days)
            cnt = db.query(AuditLog).filter(AuditLog.created_at < cutoff).delete(synchronize_session=False)
            if cnt > 0:
                purged_counts["audit_logs"] = cnt
                total_purged += cnt

        # 2. Prune Notifications
        if policy.retention_notifications_days > 0:
            cutoff = now - timedelta(days=policy.retention_notifications_days)
            cnt = db.query(Notification).filter(Notification.created_at < cutoff).delete(synchronize_session=False)
            if cnt > 0:
                purged_counts["notifications"] = cnt
                total_purged += cnt

        # 3. Prune Timetable Submissions
        if policy.retention_timetable_submissions_days > 0:
            cutoff = now - timedelta(days=policy.retention_timetable_submissions_days)
            cnt = db.query(TimetableSubmission).filter(TimetableSubmission.created_at < cutoff).delete(synchronize_session=False)
            if cnt > 0:
                purged_counts["timetable_submissions"] = cnt
                total_purged += cnt

        # 4. Prune Historical Completed/Rejected Leaves
        if policy.retention_leaves_days > 0:
            cutoff = now - timedelta(days=policy.retention_leaves_days)
            # Only prune approved, rejected, or cancelled leaves older than retention window
            old_leaves = db.query(LeaveRequest).filter(
                LeaveRequest.created_at < cutoff,
                LeaveRequest.status.in_(["approved", "rejected", "cancelled"])
            ).all()
            leave_ids = [l.id for l in old_leaves]
            if leave_ids:
                db.query(AlterAssignment).filter(AlterAssignment.leave_request_id.in_(leave_ids)).delete(synchronize_session=False)
                db.query(CreditTransaction).filter(CreditTransaction.leave_request_id.in_(leave_ids)).delete(synchronize_session=False)
                cnt = db.query(LeaveRequest).filter(LeaveRequest.id.in_(leave_ids)).delete(synchronize_session=False)
                purged_counts["leaves"] = cnt
                total_purged += cnt

        # 5. Prune Credit Transactions
        if policy.retention_credits_days > 0:
            cutoff = now - timedelta(days=policy.retention_credits_days)
            cnt = db.query(CreditTransaction).filter(CreditTransaction.created_at < cutoff).delete(synchronize_session=False)
            if cnt > 0:
                purged_counts["credits"] = cnt
                total_purged += cnt

        # 6. Prune Backups
        all_backups = backup_service.list_backups()
        deleted_bks = 0
        # By Age
        if policy.retention_backups_days > 0:
            cutoff = now - timedelta(days=policy.retention_backups_days)
            for b in all_backups:
                try:
                    b_created = datetime.fromisoformat(b["created_at"])
                    if b_created.tzinfo is None:
                        b_created = b_created.replace(tzinfo=timezone.utc)
                    if b_created < cutoff:
                        backup_service.delete_backup(b["backup_id"], db=db)
                        deleted_bks += 1
                except Exception:
                    pass
        # By Max Count
        if policy.retention_backups_max_count > 0:
            remaining_bks = backup_service.list_backups()
            if len(remaining_bks) > policy.retention_backups_max_count:
                # Sort oldest first
                remaining_bks.sort(key=lambda x: x.get("created_at", ""))
                excess = len(remaining_bks) - policy.retention_backups_max_count
                for b in remaining_bks[:excess]:
                    try:
                        backup_service.delete_backup(b["backup_id"], db=db)
                        deleted_bks += 1
                    except Exception:
                        pass
        if deleted_bks > 0:
            purged_counts["backups"] = deleted_bks
            total_purged += deleted_bks

        # Update last auto cleanup timestamp
        now_str = now.isoformat()
        _set_setting_val(db, "last_auto_cleanup_at", now_str)
        db.commit()

        # Write audit entry
        log_audit_event(
            db,
            actor_user_id=None,
            action="data_retention.auto_cleanup_completed",
            target_type="system",
            details={
                "purged_counts": purged_counts,
                "total_purged": total_purged,
                "frequency_days": freq_days,
            },
        )
        db.commit()

        logger.info("data_retention_service: auto cleanup completed (purged %d records)", total_purged)
        return {
            "success": True,
            "purged_counts": purged_counts,
            "total_purged": total_purged,
            "purged_at": now_str,
            "purged_by": "Automated Retention Scheduler",
            "message": f"Auto retention cleanup completed. Purged {total_purged} expired records."
        }
    except Exception as e:
        logger.error("data_retention_service: auto cleanup failed: %s", e)
        db.rollback()
        return None
