import pytest
from datetime import date, time, datetime
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.user import User, Role
from app.models.department import Department
from app.models.class_ import Class
from app.models.campus_structure import CampusBlock, CampusFloor
from app.models.room import Room, RoomType
from app.models.campus_duty import CampusDuty, DutyType, DutyStatus
from app.models.staff_attendance import StaffAttendanceRecord
from app.services.campus_structure_service import CampusStructureService
from app.services.campus_duty_service import CampusDutyService
from app.schemas.campus_structure import (
    CampusBlockCreate, CampusFloorCreate,
    RoomPatternPreviewRequest, BulkRoomGenerateRequest,
    SmartBlockAutoFillRequest, SmartFloorConfig,
    BulkRoomAssignRequest, DuplicateBlockRequest
)
from app.schemas.campus_duty import CampusDutyCreate


@pytest.fixture
def db(db_session):
    return db_session


@pytest.fixture
def structure_setup(db: Session):
    # Create test department
    dept = db.query(Department).filter(Department.code == "CS").first()
    if not dept:
        dept = Department(name="Computer Science", code="CS")
        db.add(dept)
        db.flush()

    dept_math = db.query(Department).filter(Department.code == "MATH").first()
    if not dept_math:
        dept_math = Department(name="Mathematics", code="MATH")
        db.add(dept_math)
        db.flush()

    # Create test class
    cls = db.query(Class).filter(Class.name == "B.Sc CS II Year").first()
    if not cls:
        cls = Class(name="B.Sc CS II Year", section="A", department_id=dept.id, semester=3)
        db.add(cls)
        db.flush()

    # Create test teacher
    teacher = db.query(User).filter(User.username == "cs_teacher_struct").first()
    if not teacher:
        teacher = User(
            username="cs_teacher_struct",
            name="CS Faculty Dr. Rao",
            email="cs_rao@institution.edu",
            password_hash="fakehash123",
            role=Role.teacher,
            department_id=dept.id,
            is_active=True
        )
        db.add(teacher)
        db.flush()

    db.commit()
    return {"dept": dept, "dept_math": dept_math, "class": cls, "teacher": teacher}


def test_block_and_floor_crud(db: Session, structure_setup):
    # 1. Create Block
    block_data = CampusBlockCreate(
        name="A Block - Main Academic",
        code="BLK-A",
        floors_count=3,
        description="Core computing and science infrastructure",
        department_id=structure_setup["dept"].id
    )
    block_out = CampusStructureService.create_block(db, block_data)
    assert block_out.id is not None
    assert block_out.code == "BLK-A"

    # Duplicate code rejection
    with pytest.raises(HTTPException) as exc:
        CampusStructureService.create_block(db, block_data)
    assert exc.value.status_code == 400

    # 2. Create Floor
    floor_data = CampusFloorCreate(
        block_id=block_out.id,
        floor_number=0,
        floor_name="Ground Floor",
        display_order=0
    )
    floor_out = CampusStructureService.create_floor(db, floor_data)
    assert floor_out.id is not None
    assert floor_out.floor_name == "Ground Floor"

    # Duplicate floor number in same block rejection
    with pytest.raises(HTTPException) as exc:
        CampusStructureService.create_floor(db, floor_data)
    assert exc.value.status_code == 400


def test_smart_autofill_block(db: Session, structure_setup):
    # Smart Auto-fill generates Block, 3 Floors, and 28 Rooms in one atomic call
    req = SmartBlockAutoFillRequest(
        block_name="Science & Engineering Block",
        block_code="SCI-ENG",
        description="Autonomous tech block",
        department_id=structure_setup["dept"].id,
        floors=[
            SmartFloorConfig(
                floor_number=0,
                floor_name="Ground Floor",
                room_count=10,
                start_num=1,
                pattern="SE-G{number:02d}",
                room_type=RoomType.laboratory,
                capacity=45
            ),
            SmartFloorConfig(
                floor_number=1,
                floor_name="First Floor",
                room_count=10,
                start_num=1,
                pattern="SE-1{number:02d}",
                room_type=RoomType.classroom,
                capacity=60
            ),
            SmartFloorConfig(
                floor_number=2,
                floor_name="Second Floor",
                room_count=8,
                start_num=1,
                pattern="SE-2{number:02d}",
                room_type=RoomType.examination_hall,
                capacity=70
            ),
        ]
    )
    res = CampusStructureService.smart_autofill_block(db, req)
    assert res.total_floors_created == 3
    assert res.total_rooms_created == 28
    assert res.block.code == "SCI-ENG"

    # Verify rooms created in DB
    rooms = db.query(Room).filter(Room.block_id == res.block.id).all()
    assert len(rooms) == 28
    room_numbers = {r.room_number for r in rooms}
    assert "SE-G01" in room_numbers
    assert "SE-G10" in room_numbers
    assert "SE-101" in room_numbers
    assert "SE-208" in room_numbers


def test_room_pattern_preview_and_bulk_generation(db: Session, structure_setup):
    # 1. Test Preview
    preview_req = RoomPatternPreviewRequest(
        pattern="CS-ROOM-{number:03d}",
        start_num=101,
        count=5,
        room_type=RoomType.classroom,
        capacity=60
    )
    preview = CampusStructureService.preview_room_generation(db, preview_req)
    assert preview.total_requested == 5
    assert preview.valid_count == 5
    assert preview.items[0].room_number == "CS-ROOM-101"
    assert preview.items[4].room_number == "CS-ROOM-105"

    # 2. Test Bulk Generation on a specific floor
    block = CampusStructureService.create_block(db, CampusBlockCreate(name="B Block", code="BLK-B", floors_count=1))
    floor = CampusStructureService.create_floor(db, CampusFloorCreate(block_id=block.id, floor_number=1, floor_name="1st Floor"))

    gen_req = BulkRoomGenerateRequest(
        block_id=block.id,
        floor_id=floor.id,
        pattern="B-{number}",
        start_num=101,
        count=5,
        room_type=RoomType.classroom,
        capacity=60
    )
    gen_res = CampusStructureService.generate_rooms_bulk(db, gen_req)
    assert gen_res.created_count == 5
    assert len(gen_res.created_rooms) == 5

    # Re-running same preview shows conflicts
    preview2 = CampusStructureService.preview_room_generation(db, RoomPatternPreviewRequest(
        pattern="B-{number}", start_num=101, count=5
    ))
    assert preview2.conflict_count == 5


def test_duplicate_block_structure(db: Session, structure_setup):
    # 1. Create Source Block with 2 floors and 6 rooms
    src_block = CampusStructureService.create_block(db, CampusBlockCreate(name="Template Block", code="TPL-A", floors_count=2))
    f1 = CampusStructureService.create_floor(db, CampusFloorCreate(block_id=src_block.id, floor_number=0, floor_name="Ground"))
    f2 = CampusStructureService.create_floor(db, CampusFloorCreate(block_id=src_block.id, floor_number=1, floor_name="First"))

    CampusStructureService.generate_rooms_bulk(db, BulkRoomGenerateRequest(
        block_id=src_block.id, floor_id=f1.id, pattern="TPL-G{number:02d}", start_num=1, count=3
    ))
    CampusStructureService.generate_rooms_bulk(db, BulkRoomGenerateRequest(
        block_id=src_block.id, floor_id=f2.id, pattern="TPL-1{number:02d}", start_num=1, count=3
    ))

    # 2. Duplicate into Clone Block
    dup_req = DuplicateBlockRequest(
        new_block_name="Cloned Block",
        new_block_code="TPL-B",
        prefix_replace_from="TPL-",
        prefix_replace_to="CLONE-"
    )
    dup_res = CampusStructureService.duplicate_block_structure(db, src_block.id, dup_req)
    assert dup_res.cloned_floors_count == 2
    assert dup_res.cloned_rooms_count == 6

    cloned_rooms = db.query(Room).filter(Room.block_id == dup_res.new_block.id).all()
    cloned_numbers = {r.room_number for r in cloned_rooms}
    assert "CLONE-G01" in cloned_numbers
    assert "CLONE-103" in cloned_numbers


def test_bulk_room_assignment(db: Session, structure_setup):
    # Create 3 rooms
    r1 = Room(room_number="BULK-01", capacity=50, room_type=RoomType.classroom)
    r2 = Room(room_number="BULK-02", capacity=50, room_type=RoomType.classroom)
    r3 = Room(room_number="BULK-03", capacity=50, room_type=RoomType.classroom)
    db.add_all([r1, r2, r3])
    db.commit()

    # Bulk assign to Examination Hall with exam capacity & department
    assign_req = BulkRoomAssignRequest(
        room_ids=[r1.id, r2.id, r3.id],
        room_type=RoomType.examination_hall,
        is_exam_eligible=True,
        exam_capacity=45,
        required_invigilators=2,
        department_id=structure_setup["dept"].id
    )
    res = CampusStructureService.bulk_assign_rooms(db, assign_req)
    assert res.updated_count == 3

    # Check database
    updated = db.query(Room).filter(Room.id.in_([r1.id, r2.id, r3.id])).all()
    for room in updated:
        assert room.room_type == RoomType.examination_hall
        assert room.is_exam_eligible == True
        assert room.exam_capacity == 45
        assert room.required_invigilators == 2
        assert room.department_id == structure_setup["dept"].id


def test_structure_metrics_and_warnings(db: Session, structure_setup):
    block = CampusStructureService.create_block(db, CampusBlockCreate(name="Metrics Block", code="MET-01", floors_count=1))
    floor = CampusStructureService.create_floor(db, CampusFloorCreate(block_id=block.id, floor_number=0, floor_name="G-Floor"))
    room = Room(room_number="MET-101", capacity=40, room_type=RoomType.classroom, block_id=block.id, floor_id=floor.id)
    db.add(room)
    db.commit()

    metrics = CampusStructureService.get_structure_metrics(db)
    assert metrics.total_blocks >= 1
    assert metrics.total_rooms >= 1
    # Check that actionable warnings exist and are descriptive strings
    assert isinstance(metrics.warnings, list)
    for w in metrics.warnings:
        assert isinstance(w, str)
        assert len(w) > 5


def test_search_campus(db: Session, structure_setup):
    block = CampusStructureService.create_block(db, CampusBlockCreate(
        name="Search Block CS", code="SRCH-01", floors_count=1, department_id=structure_setup["dept"].id
    ))
    floor = CampusStructureService.create_floor(db, CampusFloorCreate(block_id=block.id, floor_number=0, floor_name="G-Floor"))
    room = Room(
        room_number="SE-G01", room_name="Special Lab", capacity=50,
        room_type=RoomType.laboratory, block_id=block.id, floor_id=floor.id,
        department_id=structure_setup["dept"].id
    )
    db.add(room)
    db.commit()

    # Search by room number
    room_res = CampusStructureService.search_campus(db, "SE-G01")
    assert room_res.total_results >= 1
    assert any(r.room_number == "SE-G01" for r in room_res.results if r.category == "ROOM")

    # Search by department
    dept_res = CampusStructureService.search_campus(db, "Computer Science")
    assert dept_res.total_results >= 1
    assert any("Computer Science" in r.title for r in dept_res.results)


def test_csv_export_and_validation(db: Session, structure_setup):
    block = CampusStructureService.create_block(db, CampusBlockCreate(name="Export Block", code="EXP-01", floors_count=1))
    floor = CampusStructureService.create_floor(db, CampusFloorCreate(block_id=block.id, floor_number=0, floor_name="G-Floor"))
    room = Room(
        room_number="EXP-101", room_name="Export Room", capacity=50,
        room_type=RoomType.classroom, block_id=block.id, floor_id=floor.id
    )
    db.add(room)
    db.commit()

    csv_str = CampusStructureService.export_csv(db)
    assert "Block Code" in csv_str
    assert "Room Code" in csv_str
    assert "Capacity" in csv_str

    # Validate import
    validation = CampusStructureService.validate_csv_import(db, csv_str)
    assert validation.total_rows > 0
    assert validation.can_commit == True


def test_exam_duty_room_double_booking_and_proximity(db: Session, structure_setup):
    # 1. Create Block and Exam Room in that Block
    block = CampusStructureService.create_block(db, CampusBlockCreate(
        name="Science & Engineering Block", code="SCI-ENG", floors_count=3, department_id=structure_setup["dept"].id
    ))
    floor = CampusStructureService.create_floor(db, CampusFloorCreate(block_id=block.id, floor_number=2, floor_name="Second Floor"))

    exam_room = Room(
        room_number="SE-201",
        room_name="SE-201 Hall",
        block_id=block.id,
        floor_id=floor.id,
        room_type=RoomType.examination_hall,
        capacity=60,
        exam_capacity=55,
        is_exam_eligible=True
    )
    db.add(exam_room)
    db.commit()
    db.refresh(exam_room)

    # 2. Schedule Exam Duty in SE-201
    duty_date = date(2026, 10, 15)
    duty_data = CampusDutyCreate(
        duty_type=DutyType.EXAM_DUTY.value,
        title="Mathematics Semester Examination",
        duty_date=duty_date,
        start_time=time(10, 0),
        end_time=time(13, 0),
        room_id=exam_room.id,
        required_teachers=2
    )
    duty = CampusDutyService.create_duty(db, duty_data)
    assert duty.id is not None
    assert duty.room_id == exam_room.id

    # 3. Double-booking the same room during overlapping time must be blocked with 409
    overlap_duty_data = CampusDutyCreate(
        duty_type=DutyType.EXAM_DUTY.value,
        title="Physics Semester Examination",
        duty_date=duty_date,
        start_time=time(11, 0),
        end_time=time(14, 0),
        room_id=exam_room.id,
        required_teachers=2
    )
    with pytest.raises(Exception) as exc:
        CampusDutyService.create_duty(db, overlap_duty_data)
    assert "already booked" in str(exc.value).lower()

    # 4. Candidate Ranking with Structural Proximity
    # Mark CS Faculty Dr. Rao checked in on duty_date
    att = db.query(StaffAttendanceRecord).filter(
        StaffAttendanceRecord.user_id == structure_setup["teacher"].id,
        StaffAttendanceRecord.attendance_date == duty_date
    ).first()
    if not att:
        att = StaffAttendanceRecord(
            user_id=structure_setup["teacher"].id,
            attendance_date=duty_date,
            check_in_time=datetime(2026, 10, 15, 9, 0)
        )
        db.add(att)
        db.commit()

    candidates_resp = CampusDutyService.evaluate_candidates(db, duty.id)
    assert candidates_resp.duty_id == duty.id
    cs_candidate = next((c for c in candidates_resp.candidates if c.teacher_id == structure_setup["teacher"].id), None)
    assert cs_candidate is not None
    # CS faculty's department matches block department -> structural proximity bonus
    if any("Structural proximity" in r for r in cs_candidate.reasons):
        assert cs_candidate.score >= 100.0

    # 5. Formatted Duty Output contains location hierarchy
    duty_out = CampusDutyService.to_duty_out(duty)
    assert duty_out.room_number == "SE-201"
    assert duty_out.location_hierarchy is not None
    assert "SE-201" in duty_out.location_hierarchy
