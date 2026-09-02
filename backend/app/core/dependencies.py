from fastapi import Depends, HTTPException, status, Header, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.security import decode_token
from app.models.user import User, Role, AdminLevel

bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    payload = decode_token(token)

    user_id: int | None = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account disabled")

    return user


def require_credentials_set(current_user: User = Depends(get_current_user)) -> User:
    """Blocks access to every protected route except the first-login-setup
    endpoint (which depends on get_current_user directly) until an admin
    bootstrapped on default credentials has set a real username/password."""
    if current_user.must_change_credentials:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="MUST_CHANGE_CREDENTIALS",
        )
    return current_user


def require_admin(
    current_user: User = Depends(require_credentials_set),
    request: Request = None
) -> User:
    if current_user.role in (Role.principal, Role.governance):
        if request is not None and request.method != "GET":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"{current_user.role.value.capitalize()} accounts have read-only access to standard administrative records"
            )
        return current_user
    if current_user.role not in (Role.admin, Role.system_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


def require_super_admin(current_user: User = Depends(require_credentials_set)) -> User:
    if current_user.role == Role.system_admin:
        return current_user
    if current_user.role != Role.admin or current_user.admin_level != AdminLevel.super_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super Admin access required")
    return current_user



def require_system_admin(current_user: User = Depends(require_credentials_set)) -> User:
    if current_user.role != Role.system_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="System Admin access required")
    return current_user


def require_principal(current_user: User = Depends(require_credentials_set)) -> User:
    if current_user.role != Role.principal:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Principal access required")
    return current_user


def require_teacher(current_user: User = Depends(require_credentials_set)) -> User:
    if current_user.role not in (Role.teacher, Role.admin, Role.system_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Teacher access required")
    return current_user


def require_manager(current_user: User = Depends(require_credentials_set)) -> User:
    if current_user.role not in (Role.manager, Role.system_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Manager access required")
    return current_user


def require_manager_or_admin(
    current_user: User = Depends(require_credentials_set),
    request: Request = None,
) -> User:
    if current_user.role == Role.principal:
        if request is not None and request.method != "GET":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Principal accounts are read-only")
        return current_user
    if current_user.role not in (Role.manager, Role.admin, Role.system_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Manager or Admin access required")
    return current_user


def require_governance(current_user: User = Depends(require_credentials_set)) -> User:
    if current_user.role not in (Role.governance, Role.system_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Governance access required")
    return current_user


def get_tenant_department_id(
    current_user: User = Depends(require_credentials_set),
    x_department_id: str | None = Header(None, alias="X-Department-ID")
) -> int | None:
    """Returns the department_id that queries must be filtered by.
    None for system_admin / principal / governance / institution-wide manager, allowing them to scope via header or view all."""
    if current_user.role in (Role.system_admin, Role.principal, Role.governance) or (current_user.role == Role.manager and current_user.department_id is None):
        if x_department_id:
            try:
                return int(x_department_id)
            except ValueError:
                pass
        return None
    return current_user.department_id



