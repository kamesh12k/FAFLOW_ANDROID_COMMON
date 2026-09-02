import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import SessionLocal
from app.models.user import User
from app.models.class_ import Class
from app.models.subject import Subject
from app.models.room import Room
from app.models.timetable import TimetableSlot
from app.models.department import Department

def seed_cross_department():
    db = SessionLocal()
    try:
        departments = db.query(Department).all()
        teachers = db.query(User).filter(User.role == "teacher", User.is_active == True).all()
        classes = db.query(Class).all()
        subjects = db.query(Subject).filter(Subject.is_archived == False).all()
        rooms = db.query(Room).all()

        print(f"Loaded {len(departments)} departments, {len(teachers)} teachers, {len(classes)} classes, {len(subjects)} subjects, {len(rooms)} rooms.")

        if not teachers or not classes:
            print("Not enough teachers or classes to create slots.")
            return

        # Build existing booking sets for conflict prevention
        existing_slots = db.query(TimetableSlot).all()
        teacher_bookings = {(s.teacher_id, s.day_order, s.period_number) for s in existing_slots}
        class_bookings = {(s.class_id, s.day_order, s.period_number) for s in existing_slots}
        room_bookings = {(s.room_id, s.day_order, s.period_number) for s in existing_slots if s.room_id}

        created_count = 0

        for cls in classes:
            # Find teachers belonging to DIFFERENT departments than this class
            cross_teachers = [t for t in teachers if t.department_id != cls.department_id]
            if not cross_teachers:
                cross_teachers = teachers

            # Available subjects
            class_subjects = [s for s in subjects if s.department_id == cls.department_id] or subjects

            slots_added_for_this_class = 0
            for do in range(1, 7):
                for p in range(1, 6):
                    # Check if class is already booked at (do, p)
                    if (cls.id, do, p) in class_bookings:
                        continue

                    # Pick a cross-department teacher available at (do, p)
                    selected_teacher = None
                    for t in cross_teachers:
                        if (t.id, do, p) not in teacher_bookings:
                            selected_teacher = t
                            break

                    if not selected_teacher:
                        continue

                    # Pick a subject
                    subj = class_subjects[created_count % len(class_subjects)] if class_subjects else None

                    # Pick a room available at (do, p)
                    selected_room = None
                    for r in rooms:
                        if (r.id, do, p) not in room_bookings:
                            selected_room = r
                            break

                    # Create slot
                    new_slot = TimetableSlot(
                        teacher_id=selected_teacher.id,
                        subject_id=subj.id if subj else None,
                        class_id=cls.id,
                        room_id=selected_room.id if selected_room else None,
                        day_order=do,
                        period_number=p
                    )
                    db.add(new_slot)
                    
                    # Update in-memory tracking
                    teacher_bookings.add((selected_teacher.id, do, p))
                    class_bookings.add((cls.id, do, p))
                    if selected_room:
                        room_bookings.add((selected_room.id, do, p))

                    created_count += 1
                    slots_added_for_this_class += 1

                    t_dept_name = selected_teacher.department or f"Dept-{selected_teacher.department_id}"
                    c_dept_name = cls.department_rel.name if getattr(cls, 'department_rel', None) else f"Dept-{cls.department_id}"
                    print(f"  + Added Slot #{created_count}: [{selected_teacher.name} ({t_dept_name})] -> [{cls.name}-{cls.section} ({c_dept_name})] on DO{do} P{p}")

                    # Limit per class to create 2 cross-department slots per class
                    if slots_added_for_this_class >= 2:
                        break
                if slots_added_for_this_class >= 2:
                    break

        db.commit()
        print(f"\nSuccessfully created {created_count} cross-department timetable slots across all classes!")
    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        print(f"Error seeding cross-department slots: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_cross_department()
