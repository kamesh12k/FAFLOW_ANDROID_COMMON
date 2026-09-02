"""
Shared test fixtures for the credits-system backend.

Sets up an in-memory SQLite database, overrides FastAPI dependencies,
and provides pre-built user objects and auth headers.
"""
import os

# ── Set env vars BEFORE any app imports so pydantic-settings picks them up ──
os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-unit-tests")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "60")
os.environ.setdefault("FRONTEND_ORIGIN", '["http://localhost:5173"]')

import pytest
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import JSONB, UUID

@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"

@compiles(UUID, "sqlite")
def compile_uuid_sqlite(type_, compiler, **kw):
    return "VARCHAR(36)"

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient
from datetime import date, datetime, timezone

from app.database import Base, get_db
from app.core.security import hash_password, create_access_token
from app.models.user import User, Role, AdminLevel
from app.models.department import Department
from app.models.subject import Subject, SubjectType
from app.models.class_ import Class
from app.models.room import Room, RoomType
from app.models.timetable import TimetableSlot
from app.models.leave import LeaveRequest, LeaveStatus, AlterAssignment, AssignmentType
from app.models.credit import TeacherCredit, CreditTransaction
from app.models.notification import Notification
from app.models.day_order_calendar import CalendarDay, DayType
from app.models.academic_calendar import AcademicYear, Semester
from app.models.audit_log import AuditLog
from app.models.system_setting import SystemSetting
from app.models.substitution_preference import SubstitutionPreference

# ── In-memory SQLite engine ──
SQLALCHEMY_TEST_URL = "sqlite://"

engine = create_engine(
    SQLALCHEMY_TEST_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

# Enable foreign key enforcement on SQLite (off by default)
@event.listens_for(engine, "connect")
def _enable_fk(dbapi_conn, connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def db_session():
    """Create fresh tables for every test, yield a session, then drop."""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db_session):
    """FastAPI TestClient with the DB dependency overridden."""
    from app.main import app  # local import to avoid side effects

    def _override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ────────────────── User Factories ──────────────────

def _make_user(
    db: Session,
    *,
    name: str = "Test Teacher",
    email: str | None = "teacher@test.com",
    username: str | None = None,
    role: Role = Role.teacher,
    admin_level: AdminLevel | None = None,
    department: str | None = "CS",
    must_change_credentials: bool = False,
    is_active: bool = True,
    password: str = "Testpass1",
) -> User:
    dept_id = None
    if department and role in (Role.admin, Role.teacher):
        dept = db.query(Department).filter(
            (Department.name == department) | (Department.code == department)
        ).first()
        if not dept:
            dept = Department(name=department, code=department[:10])
            db.add(dept)
            db.flush()
        dept_id = dept.id

    if role != Role.teacher and not username:
        username = (email.split('@')[0] if email else name.lower().replace(' ', '_')) + f"_{role.value}"
    if role == Role.admin and not admin_level:
        admin_level = AdminLevel.super_admin

    user = User(
        name=name,
        email=email,
        username=username,
        password_hash=hash_password(password),
        role=role,
        admin_level=admin_level,
        department_id=dept_id,
        must_change_credentials=must_change_credentials,
        is_active=is_active,
    )

    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture()
def test_teacher(db_session) -> User:
    return _make_user(db_session, name="Test Teacher", email="teacher@test.com")


@pytest.fixture()
def test_teacher2(db_session) -> User:
    return _make_user(
        db_session, name="Teacher Two", email="teacher2@test.com", department="EE",
    )


@pytest.fixture()
def test_super_admin(db_session) -> User:
    return _make_user(
        db_session,
        name="Super Admin",
        email=None,
        username="superadmin",
        role=Role.admin,
        admin_level=AdminLevel.super_admin,
    )


@pytest.fixture()
def test_admin(db_session):
    """Alias for test_super_admin for convenience."""
    return _make_user(
        db_session,
        name="Admin User",
        email=None,
        username="adminuser",
        role=Role.admin,
        admin_level=AdminLevel.super_admin,
    )


@pytest.fixture()
def test_secondary_admin(db_session) -> User:
    return _make_user(
        db_session,
        name="Secondary Admin",
        email=None,
        username="secadmin",
        role=Role.admin,
        admin_level=AdminLevel.secondary_admin,
    )


@pytest.fixture()
def test_system_admin(db_session) -> User:
    return _make_user(
        db_session,
        name="System Admin",
        email=None,
        username="sysadmin",
        role=Role.system_admin,
    )


@pytest.fixture()
def auth_headers_system_admin(test_system_admin) -> dict[str, str]:
    return make_auth_headers(test_system_admin)



# ────────────────── Auth Header Factories ──────────────────

def make_auth_headers(user: User) -> dict[str, str]:
    token = create_access_token({"sub": str(user.id), "role": user.role})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def auth_headers_teacher(test_teacher) -> dict[str, str]:
    return make_auth_headers(test_teacher)


@pytest.fixture()
def auth_headers_admin(test_admin) -> dict[str, str]:
    return make_auth_headers(test_admin)


@pytest.fixture()
def auth_headers_super_admin(test_super_admin) -> dict[str, str]:
    return make_auth_headers(test_super_admin)


# ────────────────── Data Factories ──────────────────

def create_department(db: Session, name: str = "CS", code: str | None = "CS") -> Department:
    existing = db.query(Department).filter(Department.name == name).first()
    if existing:
        return existing
    dept = Department(name=name, code=code)
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept


def create_subject(
    db: Session, code: str = "CS101", name: str = "Intro CS",
    department_id: int = 1, semester: int = 1, credits: int = 3,
) -> Subject:
    subj = Subject(
        code=code, name=name, subject_type=SubjectType.theory,
        credits=credits, department_id=department_id, semester=semester,
    )
    db.add(subj)
    db.commit()
    db.refresh(subj)
    return subj


def create_class(db: Session, name: str = "CSE-A", section: str = "A",
                 department_id: int = 1, semester: int = 1) -> Class:
    cls = Class(name=name, section=section, department_id=department_id, semester=semester)
    db.add(cls)
    db.commit()
    db.refresh(cls)
    return cls


def create_room(
    db: Session,
    room_number: str = "R101",
    capacity: int = 60,
    department_id: int | None = None,
    room_type: RoomType = RoomType.classroom,
) -> Room:
    room = Room(room_number=room_number, room_type=room_type, capacity=capacity, department_id=department_id)
    db.add(room)
    db.commit()
    db.refresh(room)
    return room



def create_timetable_slot(
    db: Session, teacher_id: int, subject_id: int, class_id: int,
    day_order: int = 1, period_number: int = 1, room_id: int | None = None,
) -> TimetableSlot:
    slot = TimetableSlot(
        teacher_id=teacher_id, subject_id=subject_id, class_id=class_id,
        room_id=room_id, day_order=day_order, period_number=period_number,
    )
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return slot


def create_calendar_day(
    db: Session, the_date: date, day_type: DayType = DayType.working,
    day_order: int | None = 1, label: str | None = None,
) -> CalendarDay:
    day = CalendarDay(date=the_date, day_type=day_type, day_order=day_order, label=label)
    db.add(day)
    db.commit()
    db.refresh(day)
    return day


def create_leave_request(
    db: Session, teacher_id: int, the_date: date = None,
    day_order: int = 1, period_number: int = 1,
    status: LeaveStatus = LeaveStatus.pending,
    reason: str = "Sick",
) -> LeaveRequest:
    if the_date is None:
        the_date = date(2026, 7, 1)
    leave = LeaveRequest(
        teacher_id=teacher_id, date=the_date, day_order=day_order,
        period_number=period_number, reason=reason, status=status,
    )
    db.add(leave)
    db.commit()
    db.refresh(leave)
    return leave


def create_teacher_credit(db: Session, teacher_id: int, balance: int = 0) -> TeacherCredit:
    credit = TeacherCredit(teacher_id=teacher_id, balance=balance)
    db.add(credit)
    db.commit()
    db.refresh(credit)
    return credit


def create_academic_year(
    db: Session, name: str = "2026-2027",
    start_date: date = None, end_date: date = None,
) -> AcademicYear:
    if start_date is None:
        start_date = date(2026, 6, 1)
    if end_date is None:
        end_date = date(2027, 5, 31)
    ay = AcademicYear(name=name, start_date=start_date, end_date=end_date)
    db.add(ay)
    db.commit()
    db.refresh(ay)
    return ay


def create_notification(
    db: Session, user_id: int, title: str = "Test",
    body: str = "Test body", event_type: str = "test",
) -> Notification:
    n = Notification(user_id=user_id, title=title, body=body, event_type=event_type)
    db.add(n)
    db.commit()
    db.refresh(n)
    return n

from unittest.mock import MagicMock

@pytest.fixture()
def mock_db():
    return MagicMock()

@pytest.fixture()
def user_factory():
    def _factory(**kwargs):
        u = MagicMock()
        u.id = kwargs.get("id", 1)
        u.name = kwargs.get("name", "Test User")
        u.email = kwargs.get("email", "user@example.com")
        u.username = kwargs.get("username", "testuser")
        u.password_hash = kwargs.get("password_hash", "hashed")
        u.role = kwargs.get("role", Role.teacher)
        u.admin_level = kwargs.get("admin_level", None)
        u.department = kwargs.get("department", "CS")
        u.must_change_credentials = kwargs.get("must_change_credentials", False)
        u.is_active = kwargs.get("is_active", True)
        return u
    return _factory

