from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import require_admin, get_current_user, get_tenant_department_id
from app.models.user import User
from app.schemas.class_ import ClassCreate, ClassUpdate, ClassOut, BulkClassCreate, BulkClassCreateOut
from app.services import class_service

router = APIRouter(prefix="/classes", tags=["Classes"])


@router.get("/directory")
def class_directory(_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.services import class_directory_service
    return class_directory_service.list_class_directory(db)


@router.get("/{class_id}/faculty")
def class_faculty(class_id: int, _user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.services import class_directory_service
    result = class_directory_service.get_class_faculty(db, class_id)
    if not result:
        raise HTTPException(404, "Class not found")
    return result


@router.get("/", response_model=list[ClassOut])
def list_classes(
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    return class_service.list_classes(db, tenant_department_id)


@router.post("/", response_model=ClassOut, status_code=201)
def create_class(
    data: ClassCreate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    effective_tenant = None if _admin.is_system_admin else tenant_department_id
    return class_service.create_class(data, db, effective_tenant)


@router.post("/bulk", response_model=BulkClassCreateOut, status_code=201)
def bulk_create_classes(
    data: BulkClassCreate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    effective_tenant = None if _admin.is_system_admin else tenant_department_id
    return class_service.bulk_create_classes(data, db, effective_tenant)



@router.patch("/{class_id}", response_model=ClassOut)
def update_class(
    class_id: int,
    data: ClassUpdate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    effective_tenant = None if _admin.is_system_admin else tenant_department_id
    return class_service.update_class(class_id, data, db, effective_tenant)


@router.delete("/{class_id}", status_code=204)
def delete_class(
    class_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    effective_tenant = None if _admin.is_system_admin else tenant_department_id
    class_service.delete_class(class_id, db, effective_tenant)

