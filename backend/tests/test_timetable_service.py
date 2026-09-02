"""Tests for app.services.timetable_service."""
import pytest
from fastapi import HTTPException

from app.services.timetable_service import (
    create_slot, bulk_upload, get_by_teacher, get_by_class, delete_slot,
)
from app.schemas.timetable import TimetableSlotCreate
from tests.conftest import (
    create_department, create_subject, create_class, create_room,
    create_timetable_slot, _make_user,
)


def _setup(db_session):
    dept = create_department(db_session)
    subj = create_subject(db_session, department_id=dept.id)
    cls = create_class(db_session, department_id=dept.id)
    room = create_room(db_session)
    teacher = _make_user(db_session, email="tt@test.com")
    return dept, subj, cls, room, teacher


class TestCreateSlot:
    def test_success(self, db_session):
        _, subj, cls, room, teacher = _setup(db_session)
        data = TimetableSlotCreate(
            teacher_id=teacher.id, subject_id=subj.id, class_id=cls.id,
            room_id=room.id, day_order=1, period_number=1,
        )
        slot = create_slot(data, db_session)
        assert slot.id is not None

    def test_teacher_conflict(self, db_session):
        _, subj, cls, room, teacher = _setup(db_session)
        create_timetable_slot(db_session, teacher.id, subj.id, cls.id, room_id=room.id)
        cls2 = create_class(db_session, name="B", section="B", department_id=subj.department_id)
        room2 = create_room(db_session, room_number="R2")
        data = TimetableSlotCreate(
            teacher_id=teacher.id, subject_id=subj.id, class_id=cls2.id,
            room_id=room2.id, day_order=1, period_number=1,
        )
        with pytest.raises(HTTPException) as exc:
            create_slot(data, db_session)
        assert exc.value.status_code == 409

    def test_class_conflict(self, db_session):
        _, subj, cls, room, teacher = _setup(db_session)
        create_timetable_slot(db_session, teacher.id, subj.id, cls.id, room_id=room.id)
        teacher2 = _make_user(db_session, email="t2@test.com")
        room2 = create_room(db_session, room_number="R3")
        data = TimetableSlotCreate(
            teacher_id=teacher2.id, subject_id=subj.id, class_id=cls.id,
            room_id=room2.id, day_order=1, period_number=1,
            allow_combined_class=False,
        )
        with pytest.raises(HTTPException) as exc:
            create_slot(data, db_session)
        assert exc.value.status_code == 409

    def test_combine_class_multi_staff_success(self, db_session):
        _, subj, cls, room, teacher = _setup(db_session)
        create_timetable_slot(db_session, teacher.id, subj.id, cls.id, room_id=room.id)
        teacher2 = _make_user(db_session, email="t2comb@test.com")
        data = TimetableSlotCreate(
            teacher_id=teacher2.id, subject_id=subj.id, class_id=cls.id,
            room_id=room.id, day_order=1, period_number=1,
            allow_combined_class=True,
        )
        slot2 = create_slot(data, db_session)
        assert slot2.id is not None
        assert slot2.teacher_id == teacher2.id
        assert slot2.class_id == cls.id



class TestBulkUpload:
    def test_success(self, db_session):
        _, subj, cls, room, teacher = _setup(db_session)
        slots_data = [
            TimetableSlotCreate(
                teacher_id=teacher.id, subject_id=subj.id, class_id=cls.id,
                room_id=room.id, day_order=d, period_number=1,
            )
            for d in [1, 2, 3]
        ]
        result = bulk_upload(slots_data, db_session)
        assert len(result) == 3

    def test_intra_batch_teacher_dup(self, db_session):
        _, subj, cls, room, teacher = _setup(db_session)
        cls2 = create_class(db_session, name="C2", section="C", department_id=subj.department_id)
        data = [
            TimetableSlotCreate(
                teacher_id=teacher.id, subject_id=subj.id, class_id=cls.id,
                room_id=None, day_order=1, period_number=1,
            ),
            TimetableSlotCreate(
                teacher_id=teacher.id, subject_id=subj.id, class_id=cls2.id,
                room_id=None, day_order=1, period_number=1,
            ),
        ]
        with pytest.raises(HTTPException) as exc:
            bulk_upload(data, db_session)
        assert exc.value.status_code == 409


class TestGetAndDelete:
    def test_get_by_teacher(self, db_session):
        _, subj, cls, _, teacher = _setup(db_session)
        create_timetable_slot(db_session, teacher.id, subj.id, cls.id)
        result = get_by_teacher(teacher.id, db_session)
        assert len(result) == 1

    def test_get_by_class(self, db_session):
        _, subj, cls, _, teacher = _setup(db_session)
        create_timetable_slot(db_session, teacher.id, subj.id, cls.id)
        result = get_by_class(cls.id, db_session)
        assert len(result) == 1

    def test_delete(self, db_session):
        _, subj, cls, _, teacher = _setup(db_session)
        slot = create_timetable_slot(db_session, teacher.id, subj.id, cls.id)
        delete_slot(slot.id, db_session)
        assert get_by_teacher(teacher.id, db_session) == []


class TestResetTimetable:
    def test_reset_by_teachers(self, db_session):
        from app.services.timetable_service import reset_timetable
        from app.schemas.timetable import TimetableResetRequest
        from app.models.user import Role
        dept, subj, cls, _, teacher1 = _setup(db_session)
        teacher2 = _make_user(db_session, email="t2@test.com", department=dept.name)
        admin = _make_user(db_session, email="admin@test.com", role=Role.system_admin)

        create_timetable_slot(db_session, teacher1.id, subj.id, cls.id, day_order=1, period_number=1)
        create_timetable_slot(db_session, teacher2.id, subj.id, cls.id, day_order=2, period_number=1)

        req = TimetableResetRequest(scope="teachers", teacher_ids=[teacher1.id])
        res = reset_timetable(req, db_session, actor_user=admin)

        assert res["deleted_slots_count"] == 1
        assert len(get_by_teacher(teacher1.id, db_session)) == 0
        assert len(get_by_teacher(teacher2.id, db_session)) == 1

    def test_reset_by_department(self, db_session):
        from app.services.timetable_service import reset_timetable
        from app.schemas.timetable import TimetableResetRequest
        from app.models.user import Role
        dept, subj, cls, _, teacher1 = _setup(db_session)
        teacher2 = _make_user(db_session, email="t2@test.com", department=dept.name)
        admin = _make_user(db_session, email="admin@test.com", role=Role.system_admin)

        create_timetable_slot(db_session, teacher1.id, subj.id, cls.id, day_order=1, period_number=1)
        create_timetable_slot(db_session, teacher2.id, subj.id, cls.id, day_order=2, period_number=1)

        req = TimetableResetRequest(scope="department", department_id=dept.id)
        res = reset_timetable(req, db_session, actor_user=admin)

        assert res["deleted_slots_count"] == 2
        assert len(get_by_teacher(teacher1.id, db_session)) == 0
        assert len(get_by_teacher(teacher2.id, db_session)) == 0

    def test_reset_all_global(self, db_session):
        from app.services.timetable_service import reset_timetable
        from app.schemas.timetable import TimetableResetRequest
        from app.models.user import Role
        dept, subj, cls, _, teacher1 = _setup(db_session)
        teacher2 = _make_user(db_session, email="t2@test.com", department="OtherDept")
        admin = _make_user(db_session, email="admin@test.com", role=Role.system_admin)

        create_timetable_slot(db_session, teacher1.id, subj.id, cls.id, day_order=1, period_number=1)
        create_timetable_slot(db_session, teacher2.id, subj.id, cls.id, day_order=2, period_number=1)

        req = TimetableResetRequest(scope="all")
        res = reset_timetable(req, db_session, actor_user=admin)

        assert res["deleted_slots_count"] == 2
        assert len(get_by_teacher(teacher1.id, db_session)) == 0
        assert len(get_by_teacher(teacher2.id, db_session)) == 0

    def test_reset_all_forbidden_for_tenant_dept(self, db_session):
        from app.services.timetable_service import reset_timetable
        from app.schemas.timetable import TimetableResetRequest
        from app.models.user import Role
        dept, _, _, _, _ = _setup(db_session)
        admin = _make_user(db_session, email="deptadmin@test.com", role=Role.admin)

        req = TimetableResetRequest(scope="all")
        with pytest.raises(HTTPException) as exc:
            reset_timetable(req, db_session, actor_user=admin, tenant_department_id=dept.id)
        assert exc.value.status_code == 403
