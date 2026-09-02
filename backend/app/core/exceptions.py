from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse

class DomainException(Exception):
    def __init__(self, message: str, status_code: int = status.HTTP_400_BAD_REQUEST, code: str = "BAD_REQUEST", detail: dict | str | None = None):
        self.message = message
        self.status_code = status_code
        self.code = code
        self.detail = detail or message
        super().__init__(message)

class ResourceNotFoundException(DomainException):
    def __init__(self, resource_name: str = "Resource", resource_id: str | int | None = None):
        msg = f"{resource_name} not found" if not resource_id else f"{resource_name} '{resource_id}' not found"
        super().__init__(message=msg, status_code=status.HTTP_404_NOT_FOUND, code="NOT_FOUND")

class AccessDeniedException(DomainException):
    def __init__(self, message: str = "Access denied"):
        super().__init__(message=message, status_code=status.HTTP_403_FORBIDDEN, code="ACCESS_DENIED")

class TimetableConflictException(DomainException):
    def __init__(self, conflict_type: str, title: str, reason: str, resolution: str, requested: dict, existing: dict):
        detail = {
            "code": "TIMETABLE_CONFLICT",
            "conflict_type": conflict_type,
            "title": title,
            "reason": reason,
            "resolution": resolution,
            "requested": requested,
            "existing": existing,
        }
        super().__init__(message=title, status_code=status.HTTP_409_CONFLICT, code="TIMETABLE_CONFLICT", detail=detail)

async def domain_exception_handler(request: Request, exc: DomainException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail if isinstance(exc.detail, (dict, list)) else str(exc.detail)}
    )
