import sys
sys.path.append('B:/FAFLOW_UNIFIED/backend')
from app.database import SessionLocal
from app.models.staff_attendance import StaffAttendanceRecord
from app.models.user import User
from datetime import date

db = SessionLocal()
today = date.today()
today_records = db.query(StaffAttendanceRecord).filter(StaffAttendanceRecord.attendance_date == today).all()
historical_records = db.query(StaffAttendanceRecord).filter(StaffAttendanceRecord.attendance_date < today).all()
users_count = db.query(User).count()
enrolled_users_count = db.query(User).filter(User.has_face_enrolled == True).count()

print("STEP 1 DATABASE VERIFICATION:")
print(f"Today's attendance records ({today}): {len(today_records)}")
print(f"Historical attendance records: {len(historical_records)}")
print(f"Total Users: {users_count}")
print(f"Users with Face Enrolled: {enrolled_users_count}")
db.close()
