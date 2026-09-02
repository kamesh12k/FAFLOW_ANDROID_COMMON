"""Tests for app.services.department_service."""
import pytest
from fastapi import HTTPException

from app.services.department_service import list_departments, create_department, update_department, delete_department
from app.schemas.department import DepartmentCreate, DepartmentUpdate
from tests.conftest import (
    create_department as factory_department,
    create_subject as factory_subject,
    create_class as factory_class,
)


class TestDepartmentService:
    def test_list_empty(self, db_session):
        assert list_departments(db_session) == []

    def test_create_and_list(self, db_session):
        data = DepartmentCreate(name="CS", code="CS")
        dept = create_department(data, db_session)
        assert dept.name == "CS"
        result = list_departments(db_session)
        assert len(result) == 1

    def test_duplicate_name(self, db_session):
        factory_department(db_session, name="CS")
        data = DepartmentCreate(name="CS")
        with pytest.raises(HTTPException) as exc:
            create_department(data, db_session)
        assert exc.value.status_code == 400

    def test_update_success(self, db_session):
        dept = factory_department(db_session, name="CS", code="CS")
        data = DepartmentUpdate(name="Computer Science", code="CS_UPDATED")
        updated = update_department(dept.id, data, db_session)
        assert updated.name == "Computer Science"
        assert updated.code == "CS_UPDATED"

    def test_update_duplicate_name(self, db_session):
        dept1 = factory_department(db_session, name="CS", code="CS")
        factory_department(db_session, name="IT", code="IT")
        data = DepartmentUpdate(name="IT")
        with pytest.raises(HTTPException) as exc:
            update_department(dept1.id, data, db_session)
        assert exc.value.status_code == 400

    def test_update_duplicate_code(self, db_session):
        dept1 = factory_department(db_session, name="CS", code="CS")
        factory_department(db_session, name="IT", code="IT")
        data = DepartmentUpdate(code="IT")
        with pytest.raises(HTTPException) as exc:
            update_department(dept1.id, data, db_session)
        assert exc.value.status_code == 400

    def test_update_not_found(self, db_session):
        data = DepartmentUpdate(name="IT")
        with pytest.raises(HTTPException) as exc:
            update_department(999, data, db_session)
        assert exc.value.status_code == 404

    def test_delete_success(self, db_session):
        dept = factory_department(db_session, name="CS", code="CS")
        delete_department(dept.id, db_session)
        assert len(list_departments(db_session)) == 0

    def test_delete_not_found(self, db_session):
        with pytest.raises(HTTPException) as exc:
            delete_department(999, db_session)
        assert exc.value.status_code == 404

    def test_delete_with_subject(self, db_session):
        dept = factory_department(db_session, name="CS", code="CS")
        factory_subject(db_session, code="CS101", department_id=dept.id)
        delete_department(dept.id, db_session)
        assert len(list_departments(db_session)) == 0

    def test_delete_with_class(self, db_session):
        dept = factory_department(db_session, name="CS", code="CS")
        factory_class(db_session, name="CS-A", department_id=dept.id)
        delete_department(dept.id, db_session)
        assert len(list_departments(db_session)) == 0

    def test_delete_with_users(self, db_session):
        from app.models.user import User, Role
        from app.core.security import hash_password
        dept = factory_department(db_session, name="AERO", code="AERO")
        user = User(
            name="Aero Teacher",
            email="aero_teacher@example.com",
            password_hash=hash_password("Pass123!"),
            role=Role.teacher,
            department_id=dept.id,
        )
        db_session.add(user)
        db_session.commit()
        
        delete_department(dept.id, db_session)
        assert len(list_departments(db_session)) == 0
        assert db_session.query(User).filter(User.department_id == dept.id).count() == 0



