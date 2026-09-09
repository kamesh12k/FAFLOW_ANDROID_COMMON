import sys
import os
import zoneinfo
from datetime import datetime, date

# Ensure backend directory is in path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database import SessionLocal
from app.config import settings
from app.models.staff_attendance import StaffAttendanceRecord
from app.models.user import User

def reset_today_attendance():
    tz = zoneinfo.ZoneInfo(settings.TIMEZONE)
    now_in_tz = datetime.now(tz)
    today_in_tz = now_in_tz.date()

    print("==================================================")
    print("FAFLOW ATTENDANCE RESET SCRIPT (TODAY'S RECORDS)")
    print("==================================================")
    print(f"Configured Timezone : {settings.TIMEZONE}")
    print(f"Current Date/Time   : {now_in_tz.strftime('%Y-%m-%d %H:%M:%S %Z')}")
    print(f"Target Today Date   : {today_in_tz}")
    print("--------------------------------------------------")

    db = SessionLocal()
    try:
        # 1. Total records audit before deletion
        total_records_before = db.query(StaffAttendanceRecord).count()
        total_users_before = db.query(User).count()

        # 2. Preview today's records
        today_records = db.query(StaffAttendanceRecord).filter(
            StaffAttendanceRecord.attendance_date == today_in_tz
        ).all()

        print(f"Total attendance records in DB : {total_records_before}")
        print(f"Total users in DB              : {total_users_before}")
        print(f"Today's attendance records     : {len(today_records)}")
        print("--------------------------------------------------")

        if not today_records:
            print("No attendance records found for today. Nothing to reset.")
            return

        print("Records to be deleted:")
        for r in today_records:
            user = db.query(User).filter(User.id == r.user_id).first()
            user_name = user.name if user else f"User #{r.user_id}"
            user_email = user.email if user else "N/A"
            print(f"  - ID: {r.id} | Staff: {user_name} ({user_email}, ID: {r.user_id}) | "
                  f"Check-In: {r.check_in_time} | Check-Out: {r.check_out_time} | Status: {r.status}")

        print("--------------------------------------------------")
        print("Executing atomic deletion...")

        # 3. Transactional deletion of only today's records
        deleted_count = db.query(StaffAttendanceRecord).filter(
            StaffAttendanceRecord.attendance_date == today_in_tz
        ).delete(synchronize_session=False)

        db.commit()
        print(f"Successfully deleted {deleted_count} today's attendance record(s).")

        # 4. Verification
        today_records_after = db.query(StaffAttendanceRecord).filter(
            StaffAttendanceRecord.attendance_date == today_in_tz
        ).count()
        total_records_after = db.query(StaffAttendanceRecord).count()
        total_users_after = db.query(User).count()

        print("--------------------------------------------------")
        print("POST-RESET VERIFICATION:")
        print(f"Today's attendance records remaining : {today_records_after} (Expected: 0)")
        print(f"Historical attendance records intact : {total_records_after} (Expected: {total_records_before - deleted_count})")
        print(f"Total users intact                  : {total_users_after} (Expected: {total_users_before})")
        print("==================================================")
        assert today_records_after == 0, "Error: Today records still exist!"
        assert total_users_after == total_users_before, "Error: User count changed!"
        print("RESET VERIFICATION PASSED SUCCESSFULLY.")

    except Exception as e:
        db.rollback()
        print(f"ERROR: Transaction rolled back. Details: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    reset_today_attendance()
