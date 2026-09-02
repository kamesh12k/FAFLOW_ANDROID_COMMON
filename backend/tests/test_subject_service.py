"""Tests for app.services.subject_service."""
import pytest
from fastapi import HTTPException

from app.services.subject_service import list_subjects, create_subject, update_subject, set_archived
from app.schemas.subject import SubjectCreate, SubjectUpdate
from tests.conftest import create_department, create_subject as factory_subject


class TestSubjectService:
    def test_list_empty(self, db_session):
        assert list_subjects(db_session) == []

    def test_create_and_list(self, db_session):
        dept = create_department(db_session)
        data = SubjectCreate(code="CS101", name="Intro", credits=3, department_id=dept.id, semester=1)
        subj = create_subject(data, db_session)
        assert subj.code == "CS101"
        assert len(list_subjects(db_session)) == 1

    def test_duplicate_code(self, db_session):
        dept = create_department(db_session)
        factory_subject(db_session, code="DUP", department_id=dept.id)
        data = SubjectCreate(code="DUP", name="Dup", credits=1, department_id=dept.id, semester=1)
        with pytest.raises(HTTPException) as exc:
            create_subject(data, db_session)
        assert exc.value.status_code == 400

    def test_update(self, db_session):
        dept = create_department(db_session)
        subj = factory_subject(db_session, department_id=dept.id)
        result = update_subject(subj.id, SubjectUpdate(name="Updated"), db_session)
        assert result.name == "Updated"

    def test_update_not_found(self, db_session):
        with pytest.raises(HTTPException) as exc:
            update_subject(999, SubjectUpdate(name="X"), db_session)
        assert exc.value.status_code == 404

    def test_set_archived(self, db_session):
        dept = create_department(db_session)
        subj = factory_subject(db_session, department_id=dept.id)
        result = set_archived(subj.id, True, db_session)
        assert result.is_archived is True

    def test_archived_excluded(self, db_session):
        dept = create_department(db_session)
        subj = factory_subject(db_session, department_id=dept.id)
        set_archived(subj.id, True, db_session)
        assert len(list_subjects(db_session, include_archived=False)) == 0
        assert len(list_subjects(db_session, include_archived=True)) == 1

    def test_delete_subject(self, db_session):
        from app.services.subject_service import delete_subject
        dept = create_department(db_session)
        subj = factory_subject(db_session, code="DEL101", department_id=dept.id)
        assert len(list_subjects(db_session)) == 1
        delete_subject(subj.id, db_session)
        assert len(list_subjects(db_session)) == 0

    def test_delete_subject_not_found(self, db_session):
        from app.services.subject_service import delete_subject
        with pytest.raises(HTTPException) as exc:
            delete_subject(9999, db_session)
        assert exc.value.status_code == 404

    def test_delete_subject_department_mismatch(self, db_session):
        from app.services.subject_service import delete_subject
        dept1 = create_department(db_session, name="Dept1", code="D1")
        dept2 = create_department(db_session, name="Dept2", code="D2")
        subj = factory_subject(db_session, code="D1_SUB", department_id=dept1.id)
        with pytest.raises(HTTPException) as exc:
            delete_subject(subj.id, db_session, tenant_department_id=dept2.id)
        assert exc.value.status_code == 403

