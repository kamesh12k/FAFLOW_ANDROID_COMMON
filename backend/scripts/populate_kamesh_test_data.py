"""
populate_kamesh_test_data.py
Authoritative database seeding and state toggling for kamesh1272006s@gmail.com
Supports:
  python populate_kamesh_test_data.py --mode populated
  python populate_kamesh_test_data.py --mode empty
  python populate_kamesh_test_data.py --mode reset-attendance
"""

import sys
import os
import argparse
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.user import User, Role
from app.models.department import Department
from app.models.subject import Subject, SubjectType
from app.models.class_ import Class
from app.models.room import Room
from app.models.timetable import TimetableSlot
from app.models.leave import LeaveRequest, AlterAssignment, LeaveStatus, AssignmentType
from app.models.credit import TeacherCredit, CreditTransaction
from app.models.staff_attendance import StaffAttendanceRecord
from app.models.notification import Notification
from app.models.campus_geofence import CampusGeofence
from app.models.day_order_calendar import CalendarDay, DayType
from app.core.security import hash_password

TARGET_EMAIL = "kamesh1272006s@gmail.com"
DEFAULT_PASSWORD = "Kamesh1272006@k"

def get_or_create_user(db):
    user = db.query(User).filter(User.email.ilike(TARGET_EMAIL)).first()
    cse_dept = db.query(Department).filter(Department.name.ilike("%Computer%")).first()
    if not cse_dept:
        cse_dept = Department(name="Computer Science & Engineering", code="CSE")
        db.add(cse_dept)
        db.flush()

    if not user:
        user = User(
            name="Prof. Kamesh Govindhan",
            email=TARGET_EMAIL,
            password_hash=hash_password(DEFAULT_PASSWORD),
            role=Role.teacher,
            department_id=cse_dept.id,
            is_active=True,
            has_face_enrolled=True,
            face_enrolled_at=datetime.now(timezone.utc)
        )
        db.add(user)
        db.flush()
        print(f"[+] Created user {user.name} ({user.email}) with ID: {user.id}")
    else:
        # Ensure password is set to known standard password
        user.password_hash = hash_password(DEFAULT_PASSWORD)
        user.name = "Prof. Kamesh Govindhan"
        user.department_id = cse_dept.id
        user.is_active = True
        user.has_face_enrolled = True
        if not user.face_enrolled_at:
            user.face_enrolled_at = datetime.now(timezone.utc)
        db.flush()
        print(f"[+] Updated user {user.name} ({user.email}), ID: {user.id}")

    return user, cse_dept

def clear_user_data(db, user_id):
    """Clears all related domain records for user_id."""
    db.query(TimetableSlot).filter_by(teacher_id=user_id).delete()
    db.query(CreditTransaction).filter_by(teacher_id=user_id).delete()
    db.query(TeacherCredit).filter_by(teacher_id=user_id).delete()
    
    # Delete alter assignments where substitute or related to leaves
    user_leaves = db.query(LeaveRequest.id).filter_by(teacher_id=user_id).all()
    leave_ids = [lid[0] for lid in user_leaves]
    if leave_ids:
        db.query(AlterAssignment).filter(AlterAssignment.leave_request_id.in_(leave_ids)).delete(synchronize_session=False)
    db.query(AlterAssignment).filter_by(substitute_teacher_id=user_id).delete()
    db.query(LeaveRequest).filter_by(teacher_id=user_id).delete()
    
    db.query(StaffAttendanceRecord).filter_by(user_id=user_id).delete()
    db.query(Notification).filter_by(user_id=user_id).delete()
    db.commit()
    print(f"[-] Cleared all related records for User ID: {user_id}")

def populate_rich_data(db, user, dept):
    """Populates realistic visual testing data for all tabs."""
    uid = user.id

    # 1. Subjects, Classes & Rooms
    subjects = db.query(Subject).filter_by(department_id=dept.id).all()
    if len(subjects) < 4:
        sub_names = [
            ("Advanced Database Management", "CSE-301"),
            ("Operating Systems Architecture", "CSE-302"),
            ("Distributed Cloud Systems", "CSE-401"),
            ("Machine Learning & AI", "CSE-402"),
            ("Web Engineering & APIs", "CSE-201")
        ]
        subjects = []
        for sname, scode in sub_names:
            s = db.query(Subject).filter_by(code=scode).first()
            if not s:
                s = Subject(name=sname, code=scode, department_id=dept.id, subject_type=SubjectType.theory)
                db.add(s)
                db.flush()
            subjects.append(s)

    classes = db.query(Class).filter_by(department_id=dept.id).all()
    if not classes:
        classes = db.query(Class).all()

    rooms = db.query(Room).all()
    geofence = db.query(CampusGeofence).filter_by(is_active=True).first()

    # 2. Rich Timetable Schedule (Day Orders 1 to 6, Periods 1 to 5)
    # Give a realistic teaching load of 14-16 periods per week
    timetable_plan = [
        # (DayOrder, Period, SubjectIdx, ClassIdx, RoomIdx)
        (1, 1, 0, 0, 0),
        (1, 3, 1, 1, 1),
        (1, 4, 2, 0, 2),
        (2, 2, 3, 1, 0),
        (2, 4, 0, 0, 1),
        (3, 1, 1, 1, 2),
        (3, 3, 2, 0, 0),
        (3, 5, 4, 1, 1),
        (4, 2, 3, 0, 2),
        (4, 4, 4, 1, 0),
        (5, 1, 0, 0, 1),
        (5, 3, 1, 1, 2),
        (5, 5, 2, 0, 0),
        (6, 2, 3, 1, 1),
        (6, 4, 4, 0, 2),
    ]

    for d_order, period, s_idx, c_idx, r_idx in timetable_plan:
        sub = subjects[s_idx % len(subjects)]
        cls = classes[c_idx % len(classes)]
        rm = rooms[r_idx % len(rooms)]
        slot = TimetableSlot(
            teacher_id=uid,
            subject_id=sub.id,
            class_id=cls.id,
            room_id=rm.id,
            day_order=d_order,
            period_number=period
        )
        db.add(slot)
    print(f"[+] Populated {len(timetable_plan)} Timetable slots with valid subjects, rooms, and classes.")

    # 3. Credits & Transaction Ledger
    credit = TeacherCredit(teacher_id=uid, balance=7)
    db.add(credit)
    db.flush()

    transactions = [
        (+2, "Substitute duty for Prof. Sharma - III CSE-A Period 3", "substitute_class", -10),
        (+2, "Hackathon Mentorship & Lab Coordination", "workshop", -7),
        (+1, "Weekly perfect on-time attendance recognition", "department_duty", -4),
        (+2, "Department curriculum committee meeting substitution", "substitute_class", -2),
    ]

    for change, reason, cat, days_ago in transactions:
        tx_time = datetime.now(timezone.utc) + timedelta(days=days_ago)
        tx = CreditTransaction(
            teacher_id=uid,
            change=change,
            reason=reason,
            category=cat,
            created_at=tx_time
        )
        db.add(tx)
    print("[+] Populated Credit balance (+7 credits) and transaction history.")

    # 4. Past 14 Days Attendance Records (Present, On-duty)
    today = date.today()
    att_count = 0
    for i in range(1, 18):
        rec_date = today - timedelta(days=i)
        # Skip weekends (Saturday=5, Sunday=6)
        if rec_date.weekday() >= 5:
            continue

        in_time = datetime(rec_date.year, rec_date.month, rec_date.day, 8, 48, 12, tzinfo=timezone.utc)
        out_time = datetime(rec_date.year, rec_date.month, rec_date.day, 16, 45, 30, tzinfo=timezone.utc)
        
        status = "PRESENT"
        if i == 6:
            status = "HALF_DAY"
            out_time = datetime(rec_date.year, rec_date.month, rec_date.day, 12, 30, 0, tzinfo=timezone.utc)

        att = StaffAttendanceRecord(
            user_id=uid,
            attendance_date=rec_date,
            check_in_time=in_time,
            check_out_time=out_time,
            status=status,
            working_hours="7h 57m" if status == "PRESENT" else "3h 42m",
            check_in_geofence_id=geofence.id if geofence else None,
            check_out_geofence_id=geofence.id if geofence else None,
            face_similarity_score=0.96,
            liveness_verified=True,
            verification_method="FACE_ON_DEVICE",
            sync_source="DIRECT"
        )
        db.add(att)
        att_count += 1
    print(f"[+] Populated {att_count} past attendance history records.")

    # NOTE: Leave today's attendance clean/empty so user can test live Check-In!
    print("[+] Today's attendance is UNCHECKED so you can test camera face check-in!")

    # 5. Leaves (1 Approved in past, 1 Pending in future)
    past_leave = LeaveRequest(
        teacher_id=uid,
        date=today - timedelta(days=6),
        day_order=3,
        period_number=4,
        reason="Family function personal leave",
        status=LeaveStatus.approved
    )
    future_leave = LeaveRequest(
        teacher_id=uid,
        date=today + timedelta(days=3),
        day_order=2,
        period_number=2,
        reason="Attending Faculty Development Programme (FDP)",
        status=LeaveStatus.pending
    )
    db.add(past_leave)
    db.add(future_leave)

    # 6. Active Substitution Assignment (Where user 57 is assigned as substitute)
    # Find another teacher in department
    other_teacher = db.query(User).filter(User.id != uid, User.role == Role.teacher).first()
    if other_teacher:
        sub_leave = LeaveRequest(
            teacher_id=other_teacher.id,
            date=today,
            day_order=6,
            period_number=3,
            reason="Medical appointment",
            status=LeaveStatus.approved
        )
        db.add(sub_leave)
        db.flush()

        alter = AlterAssignment(
            leave_request_id=sub_leave.id,
            substitute_teacher_id=uid,
            assignment_type=AssignmentType.faculty_recommended,
            compatibility_score=94.5,
            is_locked=True
        )
        db.add(alter)
        print(f"[+] Populated active substitution duty: assigned to substitute for {other_teacher.name} (Period 3, Score 95/100).")

    # 7. Notifications
    notes = [
        ("Substitution Assigned", "You are assigned to cover Class III CSE-A, Period 3 today.", "substitution", False),
        ("Leave Approved", "Your leave request for Sept 2 was approved by HOD.", "leave", True),
        ("Credit Awarded", "+2 Credits awarded for hackathon coordination.", "credit", True),
        ("Institutional Calendar", "Tomorrow follows Day Order 1 schedule.", "system", False),
    ]
    for title, body, ev, is_read in notes:
        n = Notification(
            user_id=uid,
            title=title,
            body=body,
            event_type=ev,
            is_read=is_read
        )
        db.add(n)
    print(f"[+] Populated {len(notes)} notifications.")

    db.commit()
    print("\n" + "="*60)
    print(f"SUCCESS: Database fully populated for {user.email}")
    print(f"Login Identifier : {user.email}")
    print(f"Login Password   : {DEFAULT_PASSWORD}")
    print("="*60)

def main():
    parser = argparse.ArgumentParser(description="Seed and manage test data for kamesh1272006s@gmail.com")
    parser.add_argument("--mode", choices=["populated", "empty", "reset-attendance"], default="populated",
                        help="Data mode: 'populated' (full rich visual data), 'empty' (clear all data for clean testing), 'reset-attendance' (reset today's check-in only)")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        user, dept = get_or_create_user(db)
        
        if args.mode == "empty":
            clear_user_data(db, user.id)
            # Create a 0-balance credit entry so profile loads cleanly
            db.add(TeacherCredit(teacher_id=user.id, balance=0))
            db.commit()
            print(f"[✓] User {user.email} is now in an EMPTY STATE for testing.")
            print(f"Login: {user.email} | Password: {DEFAULT_PASSWORD}")

        elif args.mode == "reset-attendance":
            today = date.today()
            deleted = db.query(StaffAttendanceRecord).filter_by(user_id=user.id, attendance_date=today).delete()
            db.commit()
            print(f"[✓] Reset today's ({today}) attendance records (removed {deleted} record). Ready to test Camera Check-In!")

        elif args.mode == "populated":
            clear_user_data(db, user.id)
            populate_rich_data(db, user, dept)

    finally:
        db.close()

if __name__ == "__main__":
    main()
