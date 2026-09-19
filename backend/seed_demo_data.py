import sys
import os
import random

# Add parent directory to sys.path so we can import from app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models.department import Department
from app.models.user import User, Role
from app.models.subject import Subject, SubjectType
from app.models.class_ import Class
from app.models.room import Room, RoomType
from app.models.timetable import TimetableSlot
from app.models.credit import TeacherCredit
from datetime import date
from app.models.academic_calendar import AcademicYear
from app.models.student import Student
from app.models.student_enrollment import StudentEnrollment
from app.models.class_roll_rule import ClassRollRule, ClassRollException, RollExceptionType

def seed():
    db = SessionLocal()
    try:
        # 1. Create 10 Departments
        dept_names = [
            ("Computer Science & Engineering", "CSE"),
            ("Electrical & Electronics Engineering", "EEE"),
            ("Mechanical Engineering", "MECH"),
            ("Civil Engineering", "CIVIL"),
            ("Chemical Engineering", "CHEM"),
            ("Information Technology", "IT"),
            ("Electronics & Communication Engineering", "ECE"),
            ("Biotechnology", "BIOTECH"),
            ("Aerospace Engineering", "AERO"),
            ("Metallurgical Engineering", "META")
        ]
        
        departments = []
        for name, code in dept_names:
            dept = db.query(Department).filter(Department.name == name).first()
            if not dept:
                dept = Department(name=name, code=code)
                db.add(dept)
                db.commit()
                db.refresh(dept)
            departments.append(dept)
            
        print(f"Created/verified {len(departments)} departments.")
        
        # 2. Create Rooms globally
        rooms = []
        for i in range(1, 26):
            room_num = f"Room {100 + i}"
            room = db.query(Room).filter(Room.room_number == room_num).first()
            if not room:
                room = Room(
                    room_number=room_num,
                    room_type=RoomType.classroom,
                    capacity=60
                )
                db.add(room)
                db.commit()
                db.refresh(room)
            rooms.append(room)
        print(f"Created/verified {len(rooms)} rooms.")

        # Tracking sets to avoid collisions in timetable slots
        teacher_busy = set() # (teacher_id, day, period)
        class_busy = set()   # (class_id, day, period)
        room_busy = set()    # (room_id, day, period)
        
        # Load existing slots to avoid collision with existing data
        existing_slots = db.query(TimetableSlot).all()
        for slot in existing_slots:
            teacher_busy.add((slot.teacher_id, slot.day_order, slot.period_number))
            class_busy.add((slot.class_id, slot.day_order, slot.period_number))
            room_busy.add((slot.room_id, slot.day_order, slot.period_number))

        password_hash = hash_password("Password123")
        
        total_teachers_created = 0
        total_slots_created = 0
        
        for dept in departments:
            # Create 3 subjects for this department
            subjects = []
            for j in range(1, 4):
                subj_code = f"{dept.code}-SUB-{j}"
                subj = db.query(Subject).filter(Subject.department_id == dept.id, Subject.code == subj_code).first()
                if not subj:
                    subj = Subject(
                        code=subj_code,
                        name=f"{dept.name} Subject {j}",
                        subject_type=SubjectType.theory,
                        credits=3,
                        department_id=dept.id,
                        semester=1
                    )
                    db.add(subj)
                    db.commit()
                    db.refresh(subj)
                subjects.append(subj)
                
            # Create 2 classes for this department
            classes = []
            for k in range(1, 3):
                class_name = f"{dept.code} Year {k}"
                cls = db.query(Class).filter(Class.department_id == dept.id, Class.name == class_name).first()
                if not cls:
                    cls = Class(
                        name=class_name,
                        section="A",
                        department_id=dept.id,
                        semester=k
                    )
                    db.add(cls)
                    db.commit()
                    db.refresh(cls)
                classes.append(cls)
                
            # Create 20 teachers for this department
            for idx in range(1, 21):
                email = f"teacher_{dept.code.lower()}_{idx}@example.com"
                teacher = db.query(User).filter(User.email == email).first()
                if not teacher:
                    teacher = User(
                        name=f"Teacher {dept.code} {idx}",
                        email=email,
                        password_hash=password_hash,
                        role=Role.teacher,
                        department_id=dept.id,
                        must_change_credentials=False,
                        is_active=True
                    )
                    db.add(teacher)
                    db.commit()
                    db.refresh(teacher)
                    
                    # Initialize credits
                    db.add(TeacherCredit(teacher_id=teacher.id, balance=0))
                    db.commit()
                    total_teachers_created += 1
                
                # Fill timetable slots for this teacher
                # Assign 3 slots per teacher
                slots_assigned = 0
                attempts = 0
                while slots_assigned < 3 and attempts < 100:
                    attempts += 1
                    day = random.randint(1, 6)
                    period = random.randint(1, 5)
                    
                    cls = random.choice(classes)
                    room = random.choice(rooms)
                    subj = random.choice(subjects)
                    
                    t_key = (teacher.id, day, period)
                    c_key = (cls.id, day, period)
                    r_key = (room.id, day, period)
                    
                    if t_key not in teacher_busy and c_key not in class_busy and r_key not in room_busy:
                        slot = TimetableSlot(
                            teacher_id=teacher.id,
                            subject_id=subj.id,
                            class_id=cls.id,
                            room_id=room.id,
                            day_order=day,
                            period_number=period
                        )
                        db.add(slot)
                        db.commit()
                        
                        teacher_busy.add(t_key)
                        class_busy.add(c_key)
                        room_busy.add(r_key)
                        slots_assigned += 1
                        total_slots_created += 1
                        
        # 3. Create Academic Year
        ay = db.query(AcademicYear).filter(AcademicYear.name == "2026-2027").first()
        if not ay:
            ay = AcademicYear(name="2026-2027", start_date=date(2026, 6, 1), end_date=date(2027, 5, 31), is_active=True)
            db.add(ay)
            db.commit()
            db.refresh(ay)

        # 4. Seed students, roll rules, exceptions for classes
        total_students_seeded = 0
        all_seeded_classes = db.query(Class).all()
        for cls in all_seeded_classes:
            prefix = f"26{cls.department.code[:3].upper()}" if cls.department else "26STU"
            rule = db.query(ClassRollRule).filter(ClassRollRule.class_id == cls.id, ClassRollRule.academic_year_id == ay.id).first()
            if not rule:
                rule = ClassRollRule(
                    class_id=cls.id,
                    academic_year_id=ay.id,
                    prefix=prefix,
                    start_number=1,
                    end_number=20,
                    is_active=True
                )
                db.add(rule)
                db.commit()
                db.refresh(rule)

            for num in range(1, 21):
                roll = f"{prefix}{num:03d}"
                stu = db.query(Student).filter(Student.roll_number == roll).first()
                if not stu:
                    stu = Student(
                        roll_number=roll,
                        name=f"Student {cls.name} {num}",
                        class_id=cls.id,
                        department_id=cls.department_id,
                        admission_year=2026,
                        is_active=True
                    )
                    db.add(stu)
                    db.commit()
                    db.refresh(stu)
                    total_students_seeded += 1

                # Ensure enrollment exists
                enr = db.query(StudentEnrollment).filter(
                    StudentEnrollment.student_id == stu.id,
                    StudentEnrollment.academic_year_id == ay.id
                ).first()
                if not enr:
                    db.add(StudentEnrollment(
                        student_id=stu.id,
                        academic_year_id=ay.id,
                        class_id=cls.id,
                        roll_number=roll,
                        status="active"
                    ))
                    db.commit()

        print(f"Demo seeding finished successfully!")
        print(f"Created {total_teachers_created} new teachers.")
        print(f"Created {total_slots_created} new timetable slots.")
        print(f"Seeded {total_students_seeded} students across {len(all_seeded_classes)} classes with active roll rules and enrollments.")
    except Exception as e:
        db.rollback()
        print(f"Seeding failed: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
