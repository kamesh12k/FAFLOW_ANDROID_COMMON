from __future__ import annotations

import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import require_governance
from app.models.user import User
from app.models.leave import LeaveRequest
from app.services import governance_service, substitution_service
from app.schemas.governance import EmergencyOverrideRequest, GovernanceSubstituteAssignRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/governance", tags=["Governance Command Center"])


@router.get("/overview")
def get_overview(
    current_user: User = Depends(require_governance),
    db: Session = Depends(get_db),
):
    """
    Unified high-performance operational snapshot powering the Governance Command Center.
    Returns faculty, leaves, substitutions, engine status, department health, and system health in a single payload.
    """
    return governance_service.get_governance_overview(db, current_user)


@router.get("/search")
def search_entities(
    q: str = Query(..., min_length=1, description="Search query string"),
    current_user: User = Depends(require_governance),
    db: Session = Depends(get_db),
):
    """
    Global search for faculty, classes, departments, and active leaves.
    """
    return governance_service.search_governance_entities(db, q)


@router.get("/candidates/{leave_id}")
def get_candidates_for_leave(
    leave_id: int,
    current_user: User = Depends(require_governance),
    db: Session = Depends(get_db),
):
    """
    Retrieves ranked eligible substitution candidates as well as active parallel classes available for class combination.
    """
    leave = db.query(LeaveRequest).filter(LeaveRequest.id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Leave request #{leave_id} not found.")

    from app.models.timetable import TimetableSlot
    candidates = substitution_service.get_ranked_recommendations(db, leave)

    # Parallel classes active in the same Day Order and Period
    parallel_slots = (
        db.query(TimetableSlot)
        .filter(
            TimetableSlot.day_order == leave.day_order,
            TimetableSlot.period_number == leave.period_number,
            TimetableSlot.teacher_id != leave.teacher_id,
        )
        .all()
    )

    parallel_classes = [
        {
            "slot_id": s.id,
            "class_id": s.class_id,
            "class_name": s.class_.name if s.class_ else f"Class #{s.class_id}",
            "teacher_id": s.teacher_id,
            "teacher_name": s.teacher.name if s.teacher else "Unknown",
            "subject_name": s.subject.name if s.subject else None,
            "subject_code": s.subject.code if s.subject else None,
            "room_id": s.room_id,
            "room_number": s.room.room_number if s.room else None,
        }
        for s in parallel_slots
    ]

    return {
        "leave_id": leave_id,
        "date": leave.date.isoformat(),
        "day_order": leave.day_order,
        "period_number": leave.period_number,
        "teacher_name": leave.teacher.name if leave.teacher else "Unknown",
        "candidates": [
            {
                "teacher_id": c.teacher.id,
                "teacher_name": c.teacher.name,
                "department_name": c.teacher.department,
                "score": c.score,
                "reasons": c.reasons,
                "leave_recovery": c.leave_recovery,
                "leave_recovery_reason": c.leave_recovery_reason,
                "today_workload": c.today_workload,
                "week_workload": c.week_workload,
                "substitutions_today": c.substitutions_today,
                "substitutions_week": c.substitutions_week,
            }
            for c in candidates
        ],
        "parallel_classes": parallel_classes,
    }


@router.post("/emergency-override")
def emergency_override(
    data: EmergencyOverrideRequest,
    current_user: User = Depends(require_governance),
    db: Session = Depends(get_db),
):
    """
    Executes an emergency Governance override with mandatory reasoning and audit logging.
    """
    try:
        return governance_service.execute_emergency_override(
            db=db,
            actor_user=current_user,
            action_type=data.action_type,
            target_id=data.target_id,
            reason=data.reason,
            details=data.details,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/assign-substitute")
def assign_substitute(
    data: GovernanceSubstituteAssignRequest,
    current_user: User = Depends(require_governance),
    db: Session = Depends(get_db),
):
    """
    Assigns a substitute directly or combines the class with a parallel section from Governance Command Center.
    """
    try:
        return governance_service.assign_substitute_governance(
            db=db,
            actor_user=current_user,
            leave_id=data.leave_id,
            substitute_teacher_id=data.substitute_teacher_id,
            reason=data.reason,
            override_cap=data.override_weekly_cap,
            override_cutoff=data.override_5pm_cutoff,
            is_combined=data.is_combined,
            combined_with_class_id=data.combined_with_class_id,
            combined_room_id=data.combined_room_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

