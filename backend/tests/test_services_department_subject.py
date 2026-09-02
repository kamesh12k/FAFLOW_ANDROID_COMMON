import pytest
from fastapi import HTTPException
from unittest.mock import MagicMock
from app.services import department_service, subject_service
from app.schemas.department import DepartmentCreate
from app.schemas.subject import SubjectCreate, SubjectUpdate
from app.models import department as department_model
from app.models import subject as subject_model


def test_create_department_duplicate(mock_db):
    mock_db.query.return_value.filter.return_value.first.return_value = MagicMock()
    data = DepartmentCreate(name="Math")
    with pytest.raises(HTTPException, match="already exists"):
        department_service.create_department(data, mock_db)


def test_create_department_success(mock_db):
    mock_db.query.return_value.filter.return_value.first.return_value = None
    data = DepartmentCreate(name="Math")
    department = department_service.create_department(data, mock_db)
    assert department.name == "Math"
    mock_db.commit.assert_called_once()


def test_list_subjects_filters_archived(mock_db):
    mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [MagicMock()]
    subjects = subject_service.list_subjects(mock_db)
    assert subjects


def test_list_subjects_include_archived(mock_db):
    mock_db.query.return_value.order_by.return_value.all.return_value = [MagicMock()]
    subjects = subject_service.list_subjects(mock_db, include_archived=True)
    assert subjects


def test_create_subject_duplicate(mock_db):
    mock_db.query.return_value.filter.return_value.first.return_value = MagicMock()
    data = SubjectCreate(code="PHY101", name="Physics", credits=4, department_id=1, semester=1)
    with pytest.raises(HTTPException, match="already exists"):
        subject_service.create_subject(data, mock_db)


def test_create_subject_success(mock_db):
    mock_db.query.return_value.filter.return_value.first.return_value = None
    data = SubjectCreate(code="PHY101", name="Physics", credits=4, department_id=1, semester=1)
    subject = subject_service.create_subject(data, mock_db)
    assert subject.code == "PHY101"
    mock_db.commit.assert_called_once()


def test_update_subject_not_found(mock_db):
    mock_db.query.return_value.filter.return_value.first.return_value = None
    data = SubjectUpdate(name="Physics Updated")
    with pytest.raises(HTTPException, match="not found"):
        subject_service.update_subject(1, data, mock_db)


def test_update_subject_success(mock_db):
    subject = subject_model.Subject()
    subject.id = 1
    subject.name = "Physics"
    subject.is_archived = False
    mock_db.query.return_value.filter.return_value.first.return_value = subject
    data = SubjectUpdate(name="Physics Updated")
    updated = subject_service.update_subject(1, data, mock_db)
    assert updated.name == "Physics Updated"


def test_set_archived_not_found(mock_db):
    mock_db.query.return_value.filter.return_value.first.return_value = None
    with pytest.raises(HTTPException, match="not found"):
        subject_service.set_archived(1, True, mock_db)


def test_set_archived_success(mock_db):
    subject = subject_model.Subject()
    subject.id = 1
    subject.is_archived = False
    mock_db.query.return_value.filter.return_value.first.return_value = subject
    updated = subject_service.set_archived(1, True, mock_db)
    assert updated.is_archived is True
