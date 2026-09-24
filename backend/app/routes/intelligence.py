from datetime import date
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query, status, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User, Role
from app.models.academic_intelligence import AcademicIntelligenceEvent, IntelligenceEventState
from app.services.academic_intelligence_service import AcademicIntelligenceService

router = APIRouter(prefix="/intelligence", tags=["Academic Intelligence"])


def require_hod_or_principal(current_user: User = Depends(get_current_user)) -> User:
    """Ensures caller has HOD, Manager, Principal, or Governance privileges."""
    if current_user.role in (Role.principal, Role.system_admin, Role.governance, Role.admin, Role.manager):
        return current_user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Academic intelligence access is restricted to Principal, Governance, and HODs."
    )


def resolve_department_scope(current_user: User, requested_dept_id: Optional[int]) -> Optional[int]:
    """Resolves department filter; restricts HODs/managers to their own department while allowing Principal and Governance campus-wide access."""
    if current_user.role in (Role.admin, Role.manager):
        if requested_dept_id is not None and requested_dept_id != current_user.department_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Department administrators are restricted to their own department's intelligence."
            )
        return current_user.department_id
    return requested_dept_id


@router.get("/live", status_code=status.HTTP_200_OK)
def get_live_campus_intelligence(
    target_date: Optional[date] = Query(None, alias="date"),
    department_id: Optional[int] = Query(None),
    current_user: User = Depends(require_hod_or_principal),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Provides high-frequency live intelligence metrics (scheduled/conducted/captured/alerts)

    for Principal campus monitor and HOD department monitor.
    """
    t_date = target_date or date.today()
    dept_scope = resolve_department_scope(current_user, department_id)
    return AcademicIntelligenceService.get_live_summary(db, target_date=t_date, department_id=dept_scope)


@router.get("/events", status_code=status.HTTP_200_OK)
def get_intelligence_events(
    target_date: Optional[date] = Query(None, alias="date"),
    department_id: Optional[int] = Query(None),
    event_type: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_hod_or_principal),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Lists persistent active or historical academic intelligence events."""
    dept_scope = resolve_department_scope(current_user, department_id)
    return AcademicIntelligenceService.get_events(
        db=db,
        target_date=target_date,
        department_id=dept_scope,
        event_type=event_type,
        severity=severity,
        state=state,
        limit=limit,
        offset=offset,
    )


@router.get("/events/{id}", status_code=status.HTTP_200_OK)
def get_event_detail(
    id: int,
    current_user: User = Depends(require_hod_or_principal),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Returns single intelligence event with contextual session metadata."""
    ev = db.query(AcademicIntelligenceEvent).filter(AcademicIntelligenceEvent.id == id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Intelligence event not found")

    resolve_department_scope(current_user, ev.department_id)

    dept_name = ev.department.name if ev.department else "General"
    cls_name = f"{ev.class_.name} {ev.class_.section or ''}".strip() if ev.class_ else ""
    teacher_name = ev.attendance_session.actual_teacher.name if (ev.attendance_session and ev.attendance_session.actual_teacher) else None

    return {
        "id": ev.id,
        "department_id": ev.department_id,
        "department_name": dept_name,
        "class_id": ev.class_id,
        "class_name": cls_name,
        "attendance_session_id": ev.attendance_session_id,
        "period_number": ev.period_number,
        "event_type": ev.event_type.value if hasattr(ev.event_type, "value") else str(ev.event_type),
        "severity": ev.severity.value if hasattr(ev.severity, "value") else str(ev.severity),
        "state": ev.state.value if hasattr(ev.state, "value") else str(ev.state),
        "title": ev.title,
        "detail": ev.detail,
        "attendance_percentage": ev.attendance_percentage,
        "absent_count": ev.absent_count,
        "total_count": ev.total_count,
        "relevant_date": ev.relevant_date.isoformat(),
        "teacher_name": teacher_name,
        "detected_at": ev.detected_at.isoformat() if ev.detected_at else None,
        "acknowledged_at": ev.acknowledged_at.isoformat() if ev.acknowledged_at else None,
        "resolved_at": ev.resolved_at.isoformat() if ev.resolved_at else None,
    }


@router.patch("/events/{id}/acknowledge", status_code=status.HTTP_200_OK)
def acknowledge_intelligence_event(
    id: int,
    current_user: User = Depends(require_hod_or_principal),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Allows Principal or HOD to mark an active alert as acknowledged."""
    ev = AcademicIntelligenceService.acknowledge_event(db, id, current_user)
    if not ev:
        raise HTTPException(status_code=404, detail="Intelligence event not found or access denied")

    return {
        "id": ev.id,
        "state": ev.state.value if hasattr(ev.state, "value") else str(ev.state),
        "acknowledged_at": ev.acknowledged_at.isoformat() if ev.acknowledged_at else None,
        "message": "Event acknowledged successfully"
    }
