from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import require_admin, require_system_admin, get_current_user, get_tenant_department_id
from app.models.user import User, Role
from app.schemas.department import DepartmentCreate, DepartmentUpdate, DepartmentOut
from app.schemas.admin import SecondaryAdminCreate
from app.schemas.user import UserOut
from app.services import department_service, admin_service

router = APIRouter(prefix="/departments", tags=["Departments"])


@router.get("/", response_model=list[DepartmentOut])
def list_departments(
    include_global: bool = False,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    if _user.role in [Role.system_admin, Role.principal, Role.governance] or include_global:
        return department_service.list_departments(db, None)
    return department_service.list_departments(db, tenant_department_id)



@router.post("/", response_model=DepartmentOut, status_code=201)
def create_department(
    data: DepartmentCreate,
    _admin: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    return department_service.create_department(data, db)


@router.patch("/{dept_id}", response_model=DepartmentOut)
def update_department(
    dept_id: int,
    data: DepartmentUpdate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    return department_service.update_department(dept_id, data, db, tenant_department_id)


@router.delete("/{dept_id}", status_code=204)
def delete_department(
    dept_id: int,
    _admin: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    # Only System Admin can delete departments
    department_service.delete_department(dept_id, db)


@router.post("/{dept_id}/admin", response_model=UserOut, status_code=201)
def create_department_admin(
    dept_id: int,
    data: SecondaryAdminCreate,
    _admin: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    """
    Creates a department's first Super Admin.
    Only callable by the System Admin.
    """
    return admin_service.create_department_super_admin(dept_id, data, db)

