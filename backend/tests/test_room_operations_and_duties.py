import pytest
from datetime import date, time
from app.models.campus_structure import CampusBlock, CampusFloor
from app.models.room import Room, RoomType
from app.models.department import Department
from app.models.class_ import Class
from app.models.user import User, Role
from app.models.timetable import TimetableSlot
from app.models.campus_duty import CampusDuty, DutyType, DutyStatus
from app.models.day_order_calendar import CalendarDay, DayType
from app.services.campus_structure_service import CampusStructureService
from app.services import room_service
from app.services.campus_duty_service import CampusDutyService
from app.schemas.campus_structure import (
    BulkRoomGenerateRequest, SmartBlockAutoFillRequest, SmartFloorConfig,
    RoomPatternPreviewRequest
)
from app.schemas.room import BulkRoomAssignIn


def test_ground_floor_001_and_first_floor_101_numbering(db_session):
    """Verifies that Ground Floor generates 001, 002... and First Floor generates 101, 102..."""
    db = db_session
    block = CampusBlock(name="Science Block", code="SC", floors_count=2)
    db.add(block)
    db.flush()

    gf = CampusFloor(block_id=block.id, floor_number=0, floor_name="Ground Floor", display_order=0)
    ff = CampusFloor(block_id=block.id, floor_number=1, floor_name="First Floor", display_order=1)
    db.add_all([gf, ff])
    db.commit()

    # Generate for Ground Floor (floor_number = 0)
    gf_gen = BulkRoomGenerateRequest(
        block_id=block.id,
        floor_id=gf.id,
        start_num=1,
        count=3,
        pad_digits=2,
        pattern="{floor_code}{number:02d}"
    )
    gf_res = CampusStructureService.generate_rooms_bulk(db, gf_gen)
    gf_nums = [r.room_number for r in gf_res.created_rooms]
    assert gf_nums == ["001", "002", "003"]

    # Generate for First Floor (floor_number = 1)
    ff_gen = BulkRoomGenerateRequest(
        block_id=block.id,
        floor_id=ff.id,
        start_num=1,
        count=3,
        pad_digits=2,
        pattern="{floor_code}{number:02d}"
    )
    ff_res = CampusStructureService.generate_rooms_bulk(db, ff_gen)
    ff_nums = [r.room_number for r in ff_res.created_rooms]
    assert ff_nums == ["101", "102", "103"]


def test_mixed_room_types_on_same_floor(db_session):
    """Verifies 101 can be classroom, 103 lab, 104 seminar_hall on the same floor."""
    db = db_session
    block = CampusBlock(name="Technology Block", code="TECH", floors_count=1)
    db.add(block)
    db.flush()

    floor = CampusFloor(block_id=block.id, floor_number=1, floor_name="First Floor", display_order=1)
    db.add(floor)
    db.commit()

    # Bulk generate with room_type_overrides
    req = BulkRoomGenerateRequest(
        block_id=block.id,
        floor_id=floor.id,
        start_num=1,
        count=5,
        pattern="10{number}",
        room_type=RoomType.classroom,
        room_type_overrides={
            "103": RoomType.lab,
            "104": RoomType.seminar_hall
        }
    )
    res = CampusStructureService.generate_rooms_bulk(db, req)
    rooms_by_num = {r.room_number: r.room_type for r in res.created_rooms}

    assert rooms_by_num["101"] == RoomType.classroom
    assert rooms_by_num["102"] == RoomType.classroom
    assert rooms_by_num["103"] == RoomType.lab
    assert rooms_by_num["104"] == RoomType.seminar_hall
    assert rooms_by_num["105"] == RoomType.classroom


def test_bulk_assign_department_floor_and_block(db_session):
    """Verifies assigning a department to all rooms on a floor or block in 1 operation."""
    db = db_session
    dept = Department(name="Computer Science", code="CS_DEPT")
    db.add(dept)
    db.flush()

    block = CampusBlock(name="Engineering Block", code="ENG", floors_count=2)
    db.add(block)
    db.flush()

    f1 = CampusFloor(block_id=block.id, floor_number=0, floor_name="Ground Floor", display_order=0)
    f2 = CampusFloor(block_id=block.id, floor_number=1, floor_name="First Floor", display_order=1)
    db.add_all([f1, f2])
    db.flush()

    r1 = Room(room_number="E001", block_id=block.id, floor_id=f1.id, capacity=60)
    r2 = Room(room_number="E002", block_id=block.id, floor_id=f1.id, capacity=60)
    r3 = Room(room_number="E101", block_id=block.id, floor_id=f2.id, capacity=60)
    db.add_all([r1, r2, r3])
    db.commit()

    # Assign department to floor 1 only
    count = CampusStructureService.bulk_assign_floor_department(db, floor_id=f1.id, department_id=dept.id)
    assert count == 2

    db.refresh(r1)
    db.refresh(r2)
    db.refresh(r3)
    assert r1.department_id == dept.id
    assert r2.department_id == dept.id
    assert r3.department_id is None

    # Clear department on floor 1
    clear_count = CampusStructureService.bulk_assign_floor_department(db, floor_id=f1.id, department_id=None, clear_department=True)
    assert clear_count == 2
    db.refresh(r1)
    assert r1.department_id is None

    # Assign department to entire block
    block_count = CampusStructureService.bulk_assign_block_department(db, block_id=block.id, department_id=dept.id)
    assert block_count == 3
    db.refresh(r1)
    db.refresh(r2)
    db.refresh(r3)
    assert r1.department_id == dept.id
    assert r2.department_id == dept.id
    assert r3.department_id == dept.id


def test_bulk_assign_rooms_service(db_session):
    """Verifies bulk_assign_rooms in room_service across selected room IDs."""
    db = db_session
    dept = Department(name="Information Tech", code="IT_DEPT")
    db.add(dept)
    db.flush()
    cls = Class(name="II BCA", section="A", department_id=dept.id, semester=3)
    db.add(cls)
    db.flush()

    r1 = Room(room_number="R301", capacity=60)
    r2 = Room(room_number="R302", capacity=60)
    db.add_all([r1, r2])
    db.commit()

    # Bulk assign department, primary class, and exam eligibility
    req = BulkRoomAssignIn(
        room_ids=[r1.id, r2.id],
        department_id=dept.id,
        primary_class_id=cls.id,
        is_exam_eligible=True,
        exam_capacity=30,
        required_invigilators=1
    )
    res = room_service.bulk_assign_rooms(req, db)
    assert res.updated_count == 2

    db.refresh(r1)
    db.refresh(r2)
    assert r1.department_id == dept.id
    assert r1.primary_class_id == cls.id
    assert r1.is_exam_eligible is True
    assert r1.exam_capacity == 30


def test_optional_class_mapping_and_occupancy(db_session):
    """Verifies that optional class mapping displays home class, and shows room as free when unscheduled."""
    db = db_session
    dept = Department(name="Commerce", code="COM_DEPT")
    db.add(dept)
    db.flush()
    cls = Class(name="I B.Com", section="A", department_id=dept.id, semester=1)
    db.add(cls)
    db.flush()

    r = Room(room_number="C101", capacity=60, department_id=dept.id, primary_class_id=cls.id)
    db.add(r)
    db.commit()

    # When no timetable slot is booked in Period 1
    occ = room_service.get_classroom_occupancy(db, day_order=1, period_number=1, department_id=dept.id)
    matching = next(item for item in occ["rooms"] if item["id"] == r.id)
    assert matching["primary_class_id"] == cls.id
    assert matching["primary_class_name"] == "I B.Com"
    assert matching["is_occupied"] is False  # Free / available


def test_classroom_doubles_as_exam_hall_classes_suspended(db_session):
    """Verifies that during exam times, the classroom is used as exam hall and normal classes are suspended."""
    db = db_session
    dept = Department(name="Mathematics", code="MATH_DEPT")
    db.add(dept)
    db.flush()
    teacher = User(email="math_prof@faflow.edu", name="Prof. Euler", role=Role.teacher, password_hash="pw", department_id=dept.id)
    db.add(teacher)
    db.flush()

    r = Room(room_number="M201", capacity=60, is_exam_eligible=True, exam_capacity=30, required_invigilators=1)
    db.add(r)
    db.flush()

    today = date.today()

    # Schedule an exam duty for this room today
    duty = CampusDuty(
        duty_type=DutyType.EXAM_DUTY,
        title="Calculus End-Sem Exam",
        duty_date=today,
        start_time=time(10, 0),
        end_time=time(13, 0),
        room_id=r.id,
        department_id=dept.id,
        required_teachers=1,
        status=DutyStatus.PUBLISHED
    )
    db.add(duty)
    db.commit()

    # Check occupancy
    occ = room_service.get_classroom_occupancy(db, day_order=1, period_number=1)
    matching = next(item for item in occ["rooms"] if item["id"] == r.id)
    assert matching["is_exam_active"] is True
    assert matching["is_occupied"] is True
    assert matching["current_slot"]["is_exam"] is True
    assert "Calculus End-Sem Exam" in matching["current_slot"]["exam_title"]


def test_automated_wing_duty_and_exam_duty_generation(db_session):
    """Verifies that Wing Duties are created from Floors and Exam Duties from exam-eligible Classrooms."""
    db = db_session
    block = CampusBlock(name="Main Academic Block", code="MAB", floors_count=2)
    db.add(block)
    db.flush()

    f1 = CampusFloor(block_id=block.id, floor_number=0, floor_name="Ground Floor", display_order=0)
    f2 = CampusFloor(block_id=block.id, floor_number=1, floor_name="First Floor", display_order=1)
    db.add_all([f1, f2])
    db.flush()

    r1 = Room(room_number="M001", block_id=block.id, floor_id=f1.id, is_exam_eligible=True, exam_capacity=25, required_invigilators=1)
    r2 = Room(room_number="M101", block_id=block.id, floor_id=f2.id, is_exam_eligible=False)
    db.add_all([r1, r2])
    db.commit()

    target_date = date.today()

    # 1. Generate Wing Duties for this block
    wing_duties = CampusDutyService.generate_wing_duties(
        db, target_date=target_date, block_ids=[block.id]
    )
    assert len(wing_duties) >= 2
    wing_titles = [d.title for d in wing_duties]
    assert any("Ground Floor" in t for t in wing_titles)
    assert any("First Floor" in t for t in wing_titles)

    # 2. Generate Exam Duties for this block
    exam_duties = CampusDutyService.generate_exam_duties(
        db, target_date=target_date, title="Midterm Exam", block_ids=[block.id]
    )
    # Only r1 is exam_eligible
    assert len(exam_duties) >= 1
    assert any(d.room_id == r1.id for d in exam_duties)
    assert not any(d.room_id == r2.id for d in exam_duties)
