import pytest
from datetime import date
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models.user import User, Role
from app.models.department import Department
from app.models.class_ import Class
from app.models.student import Student
from app.models.academic_calendar import AcademicYear
from app.models.class_roll_rule import ClassRollRule, ClassRollException, RollExceptionType
from app.models.student_enrollment import StudentEnrollment
from app.services.effective_membership_service import EffectiveMembershipService
from app.services.rollover_service import RolloverService
from app.services.student_import_service import StudentImportService
from app.schemas.class_roll_rule import AcademicYearRolloverExecuteRequest, RolloverClassProgression

# In-memory test SQLite DB
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        # Create core fixtures
        dept = Department(name="Computer Science & Engineering", code="CSE")
        dept2 = Department(name="Mechanical Engineering", code="MECH")
        session.add_all([dept, dept2])
        session.commit()

        ay = AcademicYear(name="2025-2026", start_date=date(2025, 6, 1), end_date=date(2026, 5, 31), is_active=True)
        ay_next = AcademicYear(name="2026-2027", start_date=date(2026, 6, 1), end_date=date(2027, 5, 31), is_active=False)
        session.add_all([ay, ay_next])
        session.commit()

        cls1 = Class(name="I B.Sc CS", section="A", department_id=dept.id, semester=1)
        cls2 = Class(name="II B.Sc CS", section="A", department_id=dept.id, semester=3)
        cls3 = Class(name="III B.Sc CS", section="A", department_id=dept.id, semester=5)
        session.add_all([cls1, cls2, cls3])
        session.commit()

        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


def test_primary_range_and_missing_student_detection(db):
    cls = db.query(Class).filter(Class.name == "II B.Sc CS").first()
    ay = db.query(AcademicYear).filter(AcademicYear.name == "2025-2026").first()

    # Rule: 25UCS001 to 25UCS005 (5 expected)
    rule = ClassRollRule(
        class_id=cls.id,
        academic_year_id=ay.id,
        prefix="25UCS",
        start_number=1,
        end_number=5,
        padding=3,
        is_active=True
    )
    db.add(rule)

    # Insert only 3 students: 25UCS001, 25UCS002, 25UCS003
    for i in range(1, 4):
        db.add(Student(
            roll_number=f"25UCS{i:03d}",
            name=f"Student {i}",
            class_id=cls.id,
            department_id=cls.department_id,
            is_active=True
        ))
    db.commit()

    roster = EffectiveMembershipService.resolve_class_students(db, cls.id, ay.id)

    assert roster.total_effective == 3
    assert roster.validation.expected_count == 5
    assert roster.validation.found_count == 3
    # 25UCS004 and 25UCS005 must be reported as missing
    assert "25UCS004" in roster.validation.missing_rolls
    assert "25UCS005" in roster.validation.missing_rolls
    assert len(roster.validation.warnings) > 0


def test_include_and_exclude_exceptions(db):
    cls = db.query(Class).filter(Class.name == "II B.Sc CS").first()
    ay = db.query(AcademicYear).filter(AcademicYear.name == "2025-2026").first()

    rule = ClassRollRule(
        class_id=cls.id,
        academic_year_id=ay.id,
        prefix="25UCS",
        start_number=1,
        end_number=3,
        padding=3,
        is_active=True
    )
    db.add(rule)
    db.commit()

    # Students: 25UCS001, 25UCS002, 25UCS003, and lateral entry 24UCS099
    for i in range(1, 4):
        db.add(Student(roll_number=f"25UCS{i:03d}", name=f"Student {i}", class_id=cls.id, department_id=cls.department_id))
    lateral = Student(roll_number="24UCS099", name="Lateral Student", class_id=cls.id, department_id=cls.department_id)
    db.add(lateral)

    # Exclude 25UCS002 (transferred), Include 24UCS099 (lateral entry)
    ex1 = ClassRollException(class_roll_rule_id=rule.id, roll_number="25UCS002", exception_type="EXCLUDE", reason="Transferred")
    ex2 = ClassRollException(class_roll_rule_id=rule.id, roll_number="24UCS099", exception_type="INCLUDE", reason="Lateral Entry")
    db.add_all([ex1, ex2])
    db.commit()

    roster = EffectiveMembershipService.resolve_class_students(db, cls.id, ay.id)

    rolls = [s.roll_number for s in roster.students]
    # Expected: 25UCS001, 25UCS003, 24UCS099. 25UCS002 is excluded.
    assert "25UCS001" in rolls
    assert "25UCS003" in rolls
    assert "24UCS099" in rolls
    assert "25UCS002" not in rolls
    assert roster.total_effective == 3


def test_conflict_detection_and_unique_constraint(db):
    cls = db.query(Class).filter(Class.name == "II B.Sc CS").first()
    ay = db.query(AcademicYear).filter(AcademicYear.name == "2025-2026").first()

    rule = ClassRollRule(
        class_id=cls.id,
        academic_year_id=ay.id,
        prefix="25UCS",
        start_number=1,
        end_number=5,
        padding=3,
        is_active=True
    )
    db.add(rule)
    db.commit()

    ex1 = ClassRollException(class_roll_rule_id=rule.id, roll_number="25UCS001", exception_type="INCLUDE")
    db.add(ex1)
    db.commit()

    # Database UNIQUE constraint strictly prevents duplicate exception for same roll on the rule
    ex2 = ClassRollException(class_roll_rule_id=rule.id, roll_number="25UCS001", exception_type="EXCLUDE")
    db.add(ex2)
    with pytest.raises(Exception):
        db.commit()
    db.rollback()


def test_bulk_student_import_csv(db):
    cls = db.query(Class).filter(Class.name == "I B.Sc CS").first()
    ay = db.query(AcademicYear).filter(AcademicYear.name == "2025-2026").first()

    csv_data = """Roll Number,Student Name
26UCS001,Kamesh Kumar
26UCS002,Priya Sharma
26UCS003,Rahul Dravid
"""
    preview = StudentImportService.parse_and_validate(db, csv_data, cls.id, ay.id)
    assert preview.total_rows == 3
    assert preview.valid_count == 3
    assert preview.error_count == 0

    dummy_user = User(username="sysadmin1", email="admin@example.com", name="Admin", role=Role.system_admin, password_hash="hash")
    db.add(dummy_user)
    db.commit()

    result = StudentImportService.commit_import(db, cls.id, preview.rows, dummy_user, ay.id)
    assert result.created_students == 3

    # Verify students and enrollments are created
    students = db.query(Student).filter(Student.class_id == cls.id).all()
    assert len(students) == 3

    enrollments = db.query(StudentEnrollment).filter(StudentEnrollment.class_id == cls.id).all()
    assert len(enrollments) == 3


def test_academic_year_rollover(db):
    cls_y1 = db.query(Class).filter(Class.name == "I B.Sc CS").first()
    cls_y2 = db.query(Class).filter(Class.name == "II B.Sc CS").first()
    ay1 = db.query(AcademicYear).filter(AcademicYear.name == "2025-2026").first()
    ay2 = db.query(AcademicYear).filter(AcademicYear.name == "2026-2027").first()

    # Add 2 students in Year 1
    s1 = Student(roll_number="25UCS001", name="Alice", class_id=cls_y1.id, department_id=cls_y1.department_id)
    s2 = Student(roll_number="25UCS002", name="Bob", class_id=cls_y1.id, department_id=cls_y1.department_id)
    db.add_all([s1, s2])
    db.commit()

    # Enroll in 2025-2026
    enr1 = StudentEnrollment(student_id=s1.id, academic_year_id=ay1.id, class_id=cls_y1.id, roll_number=s1.roll_number, status="active")
    enr2 = StudentEnrollment(student_id=s2.id, academic_year_id=ay1.id, class_id=cls_y1.id, roll_number=s2.roll_number, status="active")
    db.add_all([enr1, enr2])

    # Rule in Year 1
    r1 = ClassRollRule(class_id=cls_y1.id, academic_year_id=ay1.id, prefix="25UCS", start_number=1, end_number=2, is_active=True)
    db.add(r1)
    db.commit()

    # Preview rollover
    preview = RolloverService.preview_rollover(db, ay1.id, ay2.id, cls_y1.department_id)
    assert preview.total_eligible >= 2

    # Execute rollover: promote I B.Sc CS to II B.Sc CS
    req = AcademicYearRolloverExecuteRequest(
        from_year_id=ay1.id,
        to_year_id=ay2.id,
        progressions=[
            RolloverClassProgression(
                from_class_id=cls_y1.id,
                from_class_name="I B.Sc CS",
                to_class_id=cls_y2.id,
                to_class_name="II B.Sc CS",
                action="PROMOTE",
                eligible_count=2,
                review_required_count=0
            )
        ]
    )

    admin_user = User(username="sysadmin2", email="admin2@example.com", name="Admin2", role=Role.system_admin, password_hash="hash")
    db.add(admin_user)
    db.commit()

    result = RolloverService.execute_rollover(db, req, admin_user)
    assert result.promoted_students == 2

    # Verify students are now in II B.Sc CS for 2026-2027
    new_enrollments = db.query(StudentEnrollment).filter(StudentEnrollment.academic_year_id == ay2.id).all()
    assert len(new_enrollments) == 2
    assert {e.class_id for e in new_enrollments} == {cls_y2.id}

    # Verify historical 2025-2026 enrollment is untouched!
    old_enrollments = db.query(StudentEnrollment).filter(StudentEnrollment.academic_year_id == ay1.id).all()
    assert len(old_enrollments) == 2
    assert {e.class_id for e in old_enrollments} == {cls_y1.id}

    # Verify permanent student records were NOT duplicated!
    total_students = db.query(Student).count()
    assert total_students == 2
