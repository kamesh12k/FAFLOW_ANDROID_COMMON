import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.user import User, Role, AdminLevel
from app.models.system_setting import DEFAULT_SYSTEM_SETTINGS
from app.models.class_ import Class
from app.models.leave import LeaveRequest
from app.core.security import hash_password

logger = logging.getLogger(__name__)

# backend/backups and backend/logs — both gitignored, created on demand.
_BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
BACKUP_DIR = _BACKEND_ROOT / "backups"
LOG_DIR = _BACKEND_ROOT / "logs"

# Tables included in the pre-reset backup, in no particular order (the
# backup is for recovery/inspection, not replay — restoring it is a manual
# DBA operation, not an automated "undo" button).
BACKUP_TABLES = [
    "users", "departments", "subjects", "classes", "rooms",
    "academic_years", "semesters", "calendar_days",
    "timetable_slots", "timetable_submissions", "leave_requests",
    "alter_assignments", "substitution_preferences",
    "teacher_credits", "credit_transactions", "operational_staff",
    "notifications", "push_subscriptions", "audit_logs", "system_settings",
]

# Deletion order matters: children before parents, to satisfy FK
# constraints regardless of each table's ON DELETE behavior.
_DELETE_ORDER = [
    "push_subscriptions", "notifications", "credit_transactions",
    "teacher_credits", "substitution_preferences", "alter_assignments", "leave_requests",
    "timetable_slots", "timetable_submissions", "calendar_days", "semesters", "academic_years",
    "operational_staff", "classes", "rooms", "subjects", "audit_logs", "users", "departments",
]



def backup_database(db: Session) -> str:
    """Dumps every table to a single timestamped JSON file before any
    destructive operation runs. Returns the absolute file path."""
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    snapshot: dict[str, list[dict]] = {}
    for table in BACKUP_TABLES:
        rows = db.execute(text(f"SELECT * FROM {table}")).mappings().all()
        snapshot[table] = [dict(r) for r in rows]

    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = BACKUP_DIR / f"factory_reset_{ts}.json"
    path.write_text(json.dumps(snapshot, indent=2, default=str))
    return str(path)


def _append_reset_audit_trail(actor_username: str | None, backup_path: str) -> None:
    """Filesystem log surviving the DB wipe (which clears audit_logs as
    part of "delete all logs/history"). This is the only durable record
    that a reset happened and who triggered it."""
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    line = (
        f"{datetime.now(timezone.utc).isoformat()} "
        f"factory_reset triggered_by={actor_username or 'cli-script'} backup={backup_path}\n"
    )
    with open(LOG_DIR / "factory_reset_audit.log", "a") as f:
        f.write(line)


def perform_factory_reset(db: Session, actor: User | None) -> dict:
    """Wipes all faculty data, reports, history, and non-system settings
    (including the full academic calendar: academic years, semesters,
    holidays, day-order assignments); deletes every Secondary Admin and
    teacher account; resets (or recreates) exactly one Super Admin to
    username=admin / password=admin with must_change_credentials=True.
    `actor` is the authenticated Super Admin calling via the API, or None
    when invoked from the offline CLI recovery script
    (scripts/factory_reset.py)."""
    backup_path = backup_database(db)
    actor_username_for_log = actor.username if actor else None

    # Pre-emptively dissociate the resetting actor from any department and switch their role
    # to system_admin. This prevents foreign key SET NULL cascades from triggering CheckConstraint
    # violations when we delete departments (since admins/teachers must have a department_id).
    if actor is not None:
        actor.role = Role.system_admin
        actor.admin_level = None
        actor.department_id = None
        actor.department_old = None
        db.flush()

    for table in _DELETE_ORDER:
        if table == "users":
            if actor is not None:
                db.execute(text("DELETE FROM users WHERE id != :id"), {"id": actor.id})
            else:
                db.execute(text("DELETE FROM users"))
        else:
            db.execute(text(f"DELETE FROM {table}"))

    db.execute(text("DELETE FROM system_settings"))
    for key, value in DEFAULT_SYSTEM_SETTINGS.items():
        db.execute(text("INSERT INTO system_settings (key, value) VALUES (:k, :v)"), {"k": key, "v": value})

    if actor is not None:
        actor.username = "admin"
        actor.name = "System Administrator"
        actor.email = None
        actor.password_hash = hash_password("admin")
        actor.role = Role.system_admin
        actor.admin_level = None
        actor.must_change_credentials = True
        actor.is_active = True
        actor.department = None
        actor.department_old = None
        actor.department_id = None
        actor.created_by_admin_id = None


    db.commit()

    if actor is None:
        # No authenticated actor (CLI path with zero remaining users) —
        # recreate the bootstrap Super Admin the same way app startup does.
        from app.services.admin_service import bootstrap_default_super_admin
        bootstrap_default_super_admin(db)

    _append_reset_audit_trail(actor_username_for_log, backup_path)
    logger.warning("FACTORY RESET completed. Backup: %s", backup_path)

    return {
        "message": "Factory reset complete. Log in with username 'admin' / password 'admin' — you'll be required to set new credentials immediately.",
        "backup_file": backup_path,
        "reset_at": datetime.now(timezone.utc),
    }


def perform_department_reset(db: Session, actor: User, dept_id: int) -> dict:
    """Wipes all data, reports, history, settings, classes, subjects,
    teachers, and other admins for a single department. Resets the actor
    (the department Super Admin) to username=admin_{dept_code} and
    password=admin_{dept_code} with must_change_credentials=True."""
    # First, run a full backup (same timestamped recovery snapshot)
    backup_path = backup_database(db)
    actor_username_for_log = actor.username
    
    # Get department code
    from app.models.department import Department
    dept = db.query(Department).filter(Department.id == dept_id).first()
    dept_code = (dept.code.strip().lower() if dept and dept.code else f"dept_{dept_id}").replace(" ", "_")

    # Get department teacher / admin IDs
    user_ids = [u.id for u in db.query(User.id).filter(User.department_id == dept_id).all()]
    class_ids = [c.id for c in db.query(Class.id).filter(Class.department_id == dept_id).all()]
    leave_ids = [l.id for l in db.query(LeaveRequest.id).filter(LeaveRequest.teacher_id.in_(user_ids)).all()] if user_ids else []

    # 1. Deletions matching department scope:
    if user_ids:
        db.execute(text("DELETE FROM push_subscriptions WHERE user_id IN :uids"), {"uids": tuple(user_ids)})
        db.execute(text("DELETE FROM notifications WHERE user_id IN :uids"), {"uids": tuple(user_ids)})
        db.execute(text("DELETE FROM credit_transactions WHERE teacher_id IN :uids"), {"uids": tuple(user_ids)})
        db.execute(text("DELETE FROM teacher_credits WHERE teacher_id IN :uids"), {"uids": tuple(user_ids)})
        db.execute(text("DELETE FROM substitution_preferences WHERE teacher_id IN :uids"), {"uids": tuple(user_ids)})
        db.execute(text("DELETE FROM timetable_slots WHERE teacher_id IN :uids"), {"uids": tuple(user_ids)})
        db.execute(text("DELETE FROM timetable_submissions WHERE teacher_id IN :uids"), {"uids": tuple(user_ids)})
        
    if leave_ids:
        db.execute(text("DELETE FROM alter_assignments WHERE leave_request_id IN :lids"), {"lids": tuple(leave_ids)})
        db.execute(text("DELETE FROM leave_requests WHERE id IN :lids"), {"lids": tuple(leave_ids)})

    # Delete timetable slots and submissions associated with classes of this department
    if class_ids:
        db.execute(text("DELETE FROM timetable_slots WHERE class_id IN :cids"), {"cids": tuple(class_ids)})
        db.execute(text("DELETE FROM timetable_submissions WHERE class_id IN :cids"), {"cids": tuple(class_ids)})
        db.execute(text("DELETE FROM classes WHERE id IN :cids"), {"cids": tuple(class_ids)})

    # Delete subjects of this department
    db.execute(text("DELETE FROM subjects WHERE department_id = :dept_id"), {"dept_id": dept_id})

    # Delete operational staff of this department
    db.execute(text("DELETE FROM operational_staff WHERE department_id = :dept_id"), {"dept_id": dept_id})

    # Delete settings of this department
    db.execute(text("DELETE FROM system_settings WHERE department_id = :dept_id"), {"dept_id": dept_id})


    # Delete audit logs of this department
    db.execute(text("DELETE FROM audit_logs WHERE department_id = :dept_id"), {"dept_id": dept_id})

    # Delete other users of this department
    db.execute(text("DELETE FROM users WHERE department_id = :dept_id AND id != :actor_id"), {"dept_id": dept_id, "actor_id": actor.id})

    # Reset actor credentials
    actor.username = f"admin_{dept_code}"
    actor.name = f"{dept.name if dept else 'Department'} Administrator"
    actor.email = None
    actor.password_hash = hash_password(f"admin_{dept_code}")
    actor.must_change_credentials = True
    actor.is_active = True

    db.commit()

    _append_reset_audit_trail(actor_username_for_log, backup_path)
    logger.warning("DEPARTMENT FACTORY RESET completed for department_id=%d. Backup: %s", dept_id, backup_path)

    return {
        "message": f"Department factory reset complete. Log in with username 'admin_{dept_code}' / password 'admin_{dept_code}' — you'll be required to set new credentials immediately.",
        "backup_file": backup_path,
        "reset_at": datetime.now(timezone.utc),
    }

