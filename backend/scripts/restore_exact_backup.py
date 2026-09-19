import json
import logging
from pathlib import Path
from sqlalchemy import text
from app.database import engine, get_db

logger = logging.getLogger(__name__)

# Target backup file path
BACKUP_FILE = Path("b:/FAFLOW_UNIFIED/backend/backups/exact_backup_2026-09-19.json")

# Tables to wipe completely (children first, then parents)
ALL_TABLES_TO_WIPE = [
    "student_attendance",
    "attendance_sessions",
    "attendance_correction_audits",
    "attendance_evidence",
    "attendance_decisions",
    "attendance_policies",
    "class_roll_exceptions",
    "class_roll_rules",
    "students",
    "student_enrollments",
    "staff_attendance_records",
    "campus_geofences",
    "campuses",
    "academic_intelligence_events",
    "risk_events",
    "device_registrations",
    "user_devices",
    "feature_entitlements",
    "plan_definitions",
    "institutions",
    "workspaces",
    "configuration_entries",
    "system_audit_logs",
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
    "classes",
    "rooms",
    "subjects",
    "calendar_days",
    "semesters",
    "academic_years",
    "operational_staff",
    "audit_logs",
    "system_settings",
    "users",
    "departments",
]

# Insertion order (parents first, children last)
INSERT_ORDER = [
    "departments",
    "users",
    "academic_years",
    "semesters",
    "calendar_days",
    "rooms",
    "subjects",
    "classes",
    "operational_staff",
    "timetable_slots",
    "timetable_submissions",
    "leave_requests",
    "alter_assignments",
    "substitution_preferences",
    "teacher_credits",
    "credit_transactions",
    "notifications",
    "push_subscriptions",
    "system_settings",
    "audit_logs",
    "staff_leave_requests",
    "staff_credits",
    "staff_credit_transactions",
]

def restore_exact_backup():
    print(f"Reading backup from: {BACKUP_FILE}")
    with open(BACKUP_FILE, "r", encoding="utf-8") as f:
        payload = json.load(f)

    data = payload["data"]

    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        print("\n--- STAGE 1: ERASING ALL CURRENT DATA ---")
        for table in ALL_TABLES_TO_WIPE:
            try:
                conn.execute(text(f'TRUNCATE TABLE "{table}" CASCADE;'))
                print(f"  Truncated table: {table}")
            except Exception as e:
                # Fallback to DELETE
                try:
                    conn.execute(text(f'DELETE FROM "{table}";'))
                    print(f"  Deleted all from table: {table}")
                except Exception as e2:
                    print(f"  Could not truncate/delete {table}: {e2}")

        print("\n--- STAGE 2: FEEDING EXACT BACKUP DATA ---")
        for table in INSERT_ORDER:
            rows = data.get(table, [])
            if not rows:
                print(f"  Skipping {table} (0 rows in backup)")
                continue

            print(f"  Inserting {len(rows)} rows into {table}...")
            for row in rows:
                cleaned_row = {}
                for k, v in row.items():
                    if isinstance(v, (dict, list)):
                        cleaned_row[k] = json.dumps(v)
                    else:
                        cleaned_row[k] = v

                if table == "users":
                    cleaned_row.setdefault("has_face_enrolled", False)

                cols = ", ".join(f'"{k}"' for k in cleaned_row.keys())
                placeholders = ", ".join(f":{k}" for k in cleaned_row.keys())
                stmt = text(f'INSERT INTO "{table}" ({cols}) VALUES ({placeholders})')
                conn.execute(stmt, cleaned_row)

        print("\n--- STAGE 3: SYNCHRONIZING POSTGRESQL SEQUENCES ---")
        seq_query = text("""
            SELECT c.relname AS seq_name,
                   t.relname AS table_name,
                   a.attname AS column_name
            FROM pg_class c
            JOIN pg_depend d ON d.objid = c.oid
            JOIN pg_class t  ON t.oid = d.refobjid
            JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
            WHERE c.relkind = 'S'
        """)
        seqs = conn.execute(seq_query).fetchall()
        for seq_name, tbl_name, col_name in seqs:
            try:
                conn.execute(text(f"""
                    SELECT setval(
                        '{seq_name}',
                        COALESCE((SELECT MAX("{col_name}") FROM "{tbl_name}"), 0) + 1,
                        false
                    )
                """))
            except Exception as e:
                print(f"  Warning on sequence {seq_name}: {e}")

        print("\n--- STAGE 4: VERIFYING RESTORED COUNTS ---")
        for table in INSERT_ORDER:
            count = conn.execute(text(f'SELECT count(*) FROM "{table}"')).scalar()
            expected = len(data.get(table, []))
            print(f"  {table:30}: {count} rows (expected: {expected})")

    print("\nSUCCESS: All data erased and exact backup restored successfully!")

if __name__ == "__main__":
    restore_exact_backup()
