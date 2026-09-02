from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import require_admin, get_current_user, get_tenant_department_id
from app.models.user import User
from app.schemas.subject import SubjectCreate, SubjectUpdate, SubjectOut
from app.services import subject_service

router = APIRouter(prefix="/subjects", tags=["Subjects"])


@router.get("/", response_model=list[SubjectOut])
def list_subjects(
    include_archived: bool = Query(default=False),
    include_cross_department: bool = Query(default=False),
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    return subject_service.list_subjects(db, include_archived, None if include_cross_department else tenant_department_id)


@router.post("/", response_model=SubjectOut, status_code=201)
def create_subject(
    data: SubjectCreate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    effective_tenant = None if _admin.is_system_admin else tenant_department_id
    return subject_service.create_subject(data, db, effective_tenant)


@router.patch("/{subject_id}", response_model=SubjectOut)
def update_subject(
    subject_id: int,
    data: SubjectUpdate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    effective_tenant = None if _admin.is_system_admin else tenant_department_id
    return subject_service.update_subject(subject_id, data, db, effective_tenant)


@router.patch("/{subject_id}/archive", response_model=SubjectOut)
def archive_subject(
    subject_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    effective_tenant = None if _admin.is_system_admin else tenant_department_id
    return subject_service.set_archived(subject_id, True, db, effective_tenant)


@router.patch("/{subject_id}/unarchive", response_model=SubjectOut)
def unarchive_subject(
    subject_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    effective_tenant = None if _admin.is_system_admin else tenant_department_id
    return subject_service.set_archived(subject_id, False, db, effective_tenant)


@router.delete("/{subject_id}", status_code=204)
def delete_subject(
    subject_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    effective_tenant = None if _admin.is_system_admin else tenant_department_id
    subject_service.delete_subject(subject_id, db, effective_tenant)


