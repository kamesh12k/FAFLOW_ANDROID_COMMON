#!/usr/bin/env python3
"""
Factory Reset recovery utility — FAFLOW.

Restores the application to its original deployment state: wipes all
faculty data, reports, history, the entire academic calendar (academic
years, semesters, holidays, Day Order assignments), and non-system
settings; deletes every admin/teacher account; recreates exactly one
Super Admin with
  username: admin
  password: admin
forcing a credential change on next login.

A timestamped JSON backup is written to backend/backups/ automatically
before anything is deleted.

Use this when you're locked out of the dashboard entirely (e.g. the only
Super Admin's credentials were lost). If you can still log in, use
Admin Panel -> Settings -> Factory Reset instead, which requires your
current password as an extra safety check.

Usage (run from the backend/ folder, with venv active):
    Windows: python scripts\\factory_reset.py
    Linux:   python3 scripts/factory_reset.py
"""
import sys
from pathlib import Path

# Allow running as `python scripts/factory_reset.py` from backend/ without
# backend/ being on sys.path by default (the script's own directory is
# added automatically, not its parent).
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

CONFIRMATION_PHRASE = "RESET EVERYTHING"

WARNING_BANNER = f"""
================================================================
                    !!! FACTORY RESET !!!
================================================================
This will PERMANENTLY DELETE:
  - All faculty/teacher records and admin accounts
  - All subjects, classes, rooms, timetables
  - All leave requests, substitute assignments, credit history
  - The entire Academic Calendar: Academic Years, Semesters,
    Holidays, Exam Days, Special Events, and Day Order assignments
  - All notifications and push subscriptions
  - All audit logs

It will then recreate a single Super Admin account:
  Username: admin
  Password: admin
  (you will be forced to change both on next login)

A timestamped backup is written automatically before deletion,
but restoring from it is a MANUAL database operation — this is
not an "undo" button.

This action cannot be undone through the application.
================================================================
"""


def main() -> int:
    print(WARNING_BANNER)

    try:
        from app.database import SessionLocal
        from app.services.factory_reset_service import perform_factory_reset
    except Exception as e:
        print(f"Could not import the application: {type(e).__name__}: {e}")
        print("Make sure you're running this from backend/ with the venv active and .env configured.")
        return 1

    typed = input(f'Type "{CONFIRMATION_PHRASE}" to confirm, or anything else to abort: ').strip()
    if typed != CONFIRMATION_PHRASE:
        print("Aborted. No changes were made.")
        return 1

    db = SessionLocal()
    try:
        result = perform_factory_reset(db, actor=None)
    except Exception as e:
        print(f"\nFactory reset FAILED: {type(e).__name__}: {e}")
        print("No partial changes should remain (the reset runs in a single transaction).")
        return 1
    finally:
        db.close()

    print("\nFactory reset complete.")
    print(f"Backup written to: {result['backup_file']}")
    print('Log in with username "admin" / password "admin" — you will be')
    print("required to set a new username and password immediately.")
    print("Remember: the Academic Calendar is now empty — mark working days,")
    print("Day Orders, and holidays again before scheduling anything.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
