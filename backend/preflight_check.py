#!/usr/bin/env python3
"""
Pre-flight check for the FAFLOW backend.

Run this AFTER `pip install -r requirements.txt` and setting up `.env`,
BEFORE starting uvicorn, to catch configuration problems early with clear
error messages instead of a confusing stack trace on first request.

Usage (from the backend/ folder, with venv activated):
    python3 preflight_check.py
"""
import sys


def check(label, fn):
    print(f"  {label}...", end=" ", flush=True)
    try:
        fn()
        print("OK")
        return True
    except Exception as e:
        print(f"FAILED\n    -> {type(e).__name__}: {e}")
        return False


def main():
    print("FAFLOW — Pre-flight Check\n")
    all_ok = True

    # 1. Can we even import the app's settings? (catches missing .env / bad values)
    def check_settings():
        from app.config import settings
        if not settings.SECRET_KEY or settings.SECRET_KEY == "your-super-secret-key-change-in-production-min-32-chars":
            raise ValueError("SECRET_KEY is missing or still set to the placeholder value in .env.example")
        if len(settings.SECRET_KEY) < 32:
            raise ValueError(f"SECRET_KEY is only {len(settings.SECRET_KEY)} chars — use at least 32")
    all_ok &= check("Loading settings from .env", check_settings)

    # 2. Can every route module actually import without error?
    def check_imports():
        from app.routes import (
            auth, teachers, timetable, leaves, credits, notifications,
            departments, subjects, classes, rooms, day_order, admin,
            academic_calendar,
        )
    all_ok &= check("Importing all route modules", check_imports)

    # 3. Can we connect to the configured database?
    def check_db_connection():
        from app.database import engine
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    all_ok &= check("Connecting to PostgreSQL (DATABASE_URL)", check_db_connection)

    # 4. Do the expected tables actually exist? (catches "forgot to run schema.sql")
    def check_tables_exist():
        from app.database import engine
        from sqlalchemy import inspect
        inspector = inspect(engine)
        existing = set(inspector.get_table_names())
        expected = {
            "users", "departments", "subjects", "classes", "rooms",
            "academic_years", "semesters", "calendar_days",
            "timetable_slots", "leave_requests",
            "alter_assignments", "substitution_preferences", "teacher_credits", "credit_transactions",
            "notifications", "push_subscriptions", "audit_logs", "system_settings",
        }
        missing = expected - existing
        if missing:
            raise RuntimeError(
                f"Missing tables: {sorted(missing)} — run: psql -d <your_db> -f ../database/schema.sql "
                f"(or, if upgrading from v2: ../database/migrations/003_academic_calendar.sql)"
            )
    all_ok &= check("Verifying all expected tables exist", check_tables_exist)

    # 5. Do users table have RBAC columns? (catches "forgot to run migration 002")
    def check_rbac_schema():
        from app.database import engine
        from sqlalchemy import inspect
        inspector = inspect(engine)
        columns = {c['name'] for c in inspector.get_columns('users')}
        required = {'username', 'admin_level', 'must_change_credentials', 'is_active'}
        missing = required - columns
        if missing:
            raise RuntimeError(
                f"Missing user columns (RBAC): {sorted(missing)} — "
                f"run: psql -d <your_db> -f ../database/migrations/002_add_rbac_and_audit.sql"
            )
    all_ok &= check("Verifying users table has RBAC schema", check_rbac_schema)

    # 6. Does calendar_days have the academic-calendar columns? (catches
    # "forgot to run migration 003" on a v2 database that already has the
    # old day_order_calendar table but not the new one)
    def check_academic_calendar_schema():
        from app.database import engine
        from sqlalchemy import inspect
        inspector = inspect(engine)
        table_names = set(inspector.get_table_names())
        if 'calendar_days' not in table_names:
            raise RuntimeError(
                "Missing table 'calendar_days' — run: "
                "psql -d <your_db> -f ../database/migrations/003_academic_calendar.sql"
            )
        columns = {c['name'] for c in inspector.get_columns('calendar_days')}
        required = {'date', 'day_type', 'day_order', 'is_manual_override'}
        missing = required - columns
        if missing:
            raise RuntimeError(f"calendar_days is missing columns: {sorted(missing)} — schema is out of date")
    all_ok &= check("Verifying Academic Calendar schema (calendar_days)", check_academic_calendar_schema)

    # 7. Is there at least one admin account (of any level)? If not, bootstrap
    # will create username=admin on startup, but warn the operator.
    def check_admin_exists():
        from app.database import SessionLocal
        from app.models.user import User, Role
        db = SessionLocal()
        try:
            count = db.query(User).filter(User.role == Role.admin).count()
            if count == 0:
                print("  (no Super Admin found yet — will bootstrap on startup)")
        finally:
            db.close()
    all_ok &= check("Checking admin account", check_admin_exists)

    # 8. Is there at least one Academic Year + working calendar day? Not a
    # hard failure (a brand-new install legitimately has none yet) but
    # worth flagging since leave/timetable submissions will all 400 until
    # the calendar has working days marked.
    def check_calendar_populated():
        from app.database import SessionLocal
        from app.models.day_order_calendar import CalendarDay, DayType
        db = SessionLocal()
        try:
            count = db.query(CalendarDay).filter(CalendarDay.day_type == DayType.working).count()
            if count == 0:
                print(
                    "  (no working days marked in the Academic Calendar yet — leave "
                    "requests and timetable scheduling will be rejected until an admin "
                    "marks at least one working day with a Day Order via Admin > Academic Calendar)"
                )
        finally:
            db.close()
    all_ok &= check("Checking Academic Calendar has working days", check_calendar_populated)

    # 9. Does alter_assignments have the substitution-engine columns, and
    # does substitution_preferences exist? (catches "forgot to run
    # migration 004" on a v3 database)
    def check_substitution_engine_schema():
        from app.database import engine
        from sqlalchemy import inspect
        inspector = inspect(engine)
        table_names = set(inspector.get_table_names())
        if "substitution_preferences" not in table_names:
            raise RuntimeError(
                "Missing table 'substitution_preferences' — run: "
                "psql -d <your_db> -f ../database/migrations/004_autonomous_substitution.sql"
            )
        columns = {c["name"] for c in inspector.get_columns("alter_assignments")}
        required = {"assignment_type", "compatibility_score", "is_locked"}
        missing = required - columns
        if missing:
            raise RuntimeError(
                f"alter_assignments is missing columns: {sorted(missing)} — run: "
                "psql -d <your_db> -f ../database/migrations/004_autonomous_substitution.sql"
            )
    all_ok &= check("Verifying Autonomous Substitution Engine schema", check_substitution_engine_schema)

    # 10. Does multi-department schema exist? (catches "forgot to run migration 006")
    def check_multi_department_schema():
        from app.database import engine
        from sqlalchemy import inspect
        inspector = inspect(engine)
        
        user_cols = {c['name'] for c in inspector.get_columns('users')}
        if 'department_id' not in user_cols:
            raise RuntimeError("Missing column 'department_id' in table 'users' — run migration 006")
            
        subject_cols = {c['name'] for c in inspector.get_columns('subjects')}
        if 'department_id' not in subject_cols:
            raise RuntimeError("Missing column 'department_id' in table 'subjects' — run migration 006")
            
        class_cols = {c['name'] for c in inspector.get_columns('classes')}
        if 'department_id' not in class_cols:
            raise RuntimeError("Missing column 'department_id' in table 'classes' — run migration 006")
            
        audit_cols = {c['name'] for c in inspector.get_columns('audit_logs')}
        if 'department_id' not in audit_cols:
            raise RuntimeError("Missing column 'department_id' in table 'audit_logs' — run migration 006")
            
        setting_cols = {c['name'] for c in inspector.get_columns('system_settings')}
        if 'department_id' not in setting_cols:
            raise RuntimeError("Missing column 'department_id' in table 'system_settings' — run migration 006")
            
    all_ok &= check("Verifying multi-department schema (Migration 006)", check_multi_department_schema)

    print()
    if all_ok:
        print("All checks passed. Safe to start the backend:")
        print("  uvicorn app.main:app --reload --port 8000")
        sys.exit(0)
    else:
        print("One or more checks failed — fix the issue(s) above before starting the server.")
        sys.exit(1)


if __name__ == "__main__":
    main()
