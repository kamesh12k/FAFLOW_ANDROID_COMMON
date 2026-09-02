"""Tests for app.services.room_service."""
import pytest
from fastapi import HTTPException

from app.services.room_service import (
    list_rooms, create_room, update_room, delete_room,
    check_room_availability, availability_dashboard,
)
from app.schemas.room import RoomCreate, RoomUpdate
from tests.conftest import (
    create_department, create_subject, create_class, create_room as factory_room,
    create_timetable_slot, _make_user,
)


class TestRoomService:
    def test_list_empty(self, db_session):
        assert list_rooms(db_session) == []

    def test_create_and_list(self, db_session):
        data = RoomCreate(room_number="R1", capacity=60)
        room = create_room(data, db_session)
        assert room.room_number == "R1"
        assert len(list_rooms(db_session)) == 1

    def test_duplicate_number(self, db_session):
        factory_room(db_session, room_number="R1")
        data = RoomCreate(room_number="R1", capacity=30)
        with pytest.raises(HTTPException) as exc:
            create_room(data, db_session)
        assert exc.value.status_code == 400

    def test_update(self, db_session):
        room = factory_room(db_session)
        result = update_room(room.id, RoomUpdate(capacity=100), db_session)
        assert result.capacity == 100

    def test_update_not_found(self, db_session):
        with pytest.raises(HTTPException) as exc:
            update_room(999, RoomUpdate(capacity=1), db_session)
        assert exc.value.status_code == 404

    def test_delete(self, db_session):
        room = factory_room(db_session)
        delete_room(room.id, db_session)
        assert list_rooms(db_session) == []

    def test_delete_not_found(self, db_session):
        with pytest.raises(HTTPException) as exc:
            delete_room(999, db_session)
        assert exc.value.status_code == 404

    def test_delete_in_use(self, db_session):
        dept = create_department(db_session)
        subj = create_subject(db_session, department_id=dept.id)
        cls = create_class(db_session, department_id=dept.id)
        room = factory_room(db_session)
        teacher = _make_user(db_session, email="rm@test.com")
        slot = create_timetable_slot(db_session, teacher.id, subj.id, cls.id, room_id=room.id)
        delete_room(room.id, db_session)
        assert list_rooms(db_session) == []
        db_session.refresh(slot)
        assert slot.room_id is None

    def test_bulk_create_rooms_success(self, db_session):
        from app.services.room_service import bulk_create_rooms
        from app.schemas.room import BulkRoomCreate
        data = BulkRoomCreate(prefix="Room ", start_num=101, end_num=105, capacity=50)
        res = bulk_create_rooms(data, db_session)
        assert res.created_count == 5
        assert res.skipped_count == 0
        rooms = list_rooms(db_session)
        assert len(rooms) == 5
        assert [r.room_number for r in rooms] == ["Room 101", "Room 102", "Room 103", "Room 104", "Room 105"]

    def test_bulk_create_rooms_skips_existing(self, db_session):
        from app.services.room_service import bulk_create_rooms
        from app.schemas.room import BulkRoomCreate
        factory_room(db_session, room_number="Lab 02")
        data = BulkRoomCreate(prefix="Lab ", start_num=1, end_num=3, pad_digits=2, capacity=40)
        res = bulk_create_rooms(data, db_session)
        assert res.created_count == 2
        assert res.skipped_count == 1

    def test_bulk_create_rooms_invalid_range(self, db_session):
        from app.services.room_service import bulk_create_rooms
        from app.schemas.room import BulkRoomCreate
        data = BulkRoomCreate(prefix="Room ", start_num=10, end_num=5)
        with pytest.raises(HTTPException) as exc:
            bulk_create_rooms(data, db_session)
        assert exc.value.status_code == 400



class TestRoomAvailability:
    def test_available(self, db_session):
        room = factory_room(db_session)
        assert check_room_availability(room.id, 1, 1, db_session) is True

    def test_not_available(self, db_session):
        dept = create_department(db_session)
        subj = create_subject(db_session, department_id=dept.id)
        cls = create_class(db_session, department_id=dept.id)
        room = factory_room(db_session)
        teacher = _make_user(db_session, email="avail@test.com")
        create_timetable_slot(db_session, teacher.id, subj.id, cls.id, room_id=room.id)
        assert check_room_availability(room.id, 1, 1, db_session) is False

    def test_dashboard(self, db_session):
        room1 = factory_room(db_session, room_number="R1")
        room2 = factory_room(db_session, room_number="R2")
        result = availability_dashboard(1, 1, db_session)
        assert len(result) == 2
        assert all(r.is_available for r in result)

    def test_classroom_occupancy_matrix(self, db_session):
        from app.services.room_service import get_classroom_occupancy
        dept = create_department(db_session, name="CSE")
        subj = create_subject(db_session, department_id=dept.id, name="Networks", code="CS301")
        cls = create_class(db_session, department_id=dept.id, name="III CS A")
        r1 = factory_room(db_session, room_number="CS-101", capacity=60, department_id=dept.id)
        r2 = factory_room(db_session, room_number="CS-102", capacity=40, department_id=dept.id)
        teacher = _make_user(db_session, email="occ@test.com", name="Prof. Alan")

        # Book r1 for day_order=1, period_number=2
        create_timetable_slot(db_session, teacher.id, subj.id, cls.id, room_id=r1.id, day_order=1, period_number=2)

        res_p1 = get_classroom_occupancy(db_session, day_order=1, period_number=1)
        assert res_p1["summary"]["total_rooms"] == 2
        assert res_p1["summary"]["occupied_count"] == 0
        assert res_p1["summary"]["vacant_count"] == 2

        res_p2 = get_classroom_occupancy(db_session, day_order=1, period_number=2)
        assert res_p2["summary"]["occupied_count"] == 1
        assert res_p2["summary"]["vacant_count"] == 1
        assert res_p2["summary"]["occupancy_rate_percent"] == 50.0

        r1_item = next(r for r in res_p2["rooms"] if r["room_number"] == "CS-101")
        assert r1_item["is_occupied"] is True
        assert r1_item["current_slot"]["class_name"] == "III CS A"
        assert r1_item["current_slot"]["subject_code"] == "CS301"
        assert r1_item["current_slot"]["teacher_name"] == "Prof. Alan"
        assert r1_item["period_schedule"][2]["is_occupied"] is True
        assert r1_item["period_schedule"][1]["is_occupied"] is False

