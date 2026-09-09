import logging

from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import require_admin, require_teacher, get_current_user, get_tenant_department_id
from app.models.user import User
from app.models.leave import AssignmentType
from app.schemas.leave import (
    LeaveCreate, LeaveBatchCreate, LeaveOut, BulkLeaveAction,
    AlterAssignmentCreate, AlterAssignmentOut, FreeTeacherOut,
    OverrideSubstituteRequest, LockAssignmentRequest,
    AdminCancelRequest, CancelImpactOut, AdminLeaveCreate,
)
from app.schemas.substitution import RecommendationOut
from app.services import leave_service, substitution_service

router = APIRouter(prefix="/leaves", tags=["Leaves"])
logger = logging.getLogger(__name__)


@router.post("/", response_model=LeaveOut, status_code=201)
def apply_leave(
    data: LeaveCreate,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    return leave_service.submit_leave(current_user.id, data, db)


@router.post("/batch", response_model=list[LeaveOut], status_code=201)
def apply_leave_batch(
    data: LeaveBatchCreate,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """Submit a batch leave request (multiple periods or whole-day) for the
    authenticated teacher. Returns 400 with a descriptive message for bad
    input (non-working day, no periods scheduled, etc.). Never returns 500
    for anticipated failures — any unexpected error is logged and surfaces
    as a descriptive 500 with no internal detail leaked to the client."""
    try:
        return leave_service.submit_leave_batch(current_user.id, data, db)
    except HTTPException:
        raise
    except Exception:
        logger.exception(
            "POST /leaves/batch unhandled exception: teacher_id=%s date=%s",
            current_user.id, data.date,
        )
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while submitting the leave request. Please try again.",
        )


@router.get("/", response_model=list[LeaveOut])
def list_all_leaves(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    return leave_service.get_all_leaves(db, tenant_department_id)


@router.get("/my", response_model=list[LeaveOut])
def my_leaves(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return leave_service.get_teacher_leaves(current_user.id, db)


@router.patch("/{leave_id}/approve")
def approve_leave(
    leave_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    leave, free_teachers = leave_service.approve_leave(leave_id, db, tenant_department_id)
    return {
        "leave": LeaveOut.model_validate(leave),
        "free_teachers": free_teachers,
    }


@router.patch("/{leave_id}/reject", response_model=LeaveOut)
def reject_leave(
    leave_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    return leave_service.reject_leave(leave_id, db, tenant_department_id)


class LeaveStatusUpdate(BaseModel):
    status: str
    admin_notes: str | None = None


@router.patch("/{leave_id}/status")
def update_leave_status(
    leave_id: int,
    data: LeaveStatusUpdate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    if data.status == "approved":
        leave, free_teachers = leave_service.approve_leave(leave_id, db, tenant_department_id)
        return {
            "leave": LeaveOut.model_validate(leave),
            "free_teachers": free_teachers,
        }
    elif data.status == "rejected":
        leave = leave_service.reject_leave(leave_id, db, tenant_department_id)
        return {
            "leave": LeaveOut.model_validate(leave),
            "free_teachers": [],
        }
    else:
        raise HTTPException(status_code=400, detail="Status must be 'approved' or 'rejected'")



@router.post("/bulk-approve", response_model=list[LeaveOut])
def bulk_approve(
    data: BulkLeaveAction,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    return leave_service.bulk_approve(data.leave_ids, db, tenant_department_id)


@router.post("/bulk-reject", response_model=list[LeaveOut])
def bulk_reject(
    data: BulkLeaveAction,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    return leave_service.bulk_reject(data.leave_ids, db, tenant_department_id)


@router.post("/{leave_id}/assign", response_model=AlterAssignmentOut, status_code=201)
def assign_substitute(
    leave_id: int,
    data: AlterAssignmentCreate,
    include_cross_department: bool = False,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    """Manual admin pick — not from the ranked recommendation list. If the
    admin instead approved a ranked suggestion, the frontend should call
    this with the same substitute_teacher_id; the assignment_type still
    records as admin_assigned because *this endpoint* doesn't know which
    list the id came from. Use /recommendations to show the ranked list."""
    return leave_service.assign_substitute(
        leave_id, data.substitute_teacher_id, db,
        actor_id=_admin.id,
        tenant_department_id=tenant_department_id,
        include_cross_department=include_cross_department,
        override_substitution_limit=data.override_substitution_limit,
    )


@router.get("/{leave_id}/recommendations", response_model=list[RecommendationOut])
@router.get("/{leave_id}/candidates", response_model=list[RecommendationOut])
def get_recommendations(
    leave_id: int,
    limit: int = 100,
    include_cross_department: bool = False,
    only_handles_class: bool = False,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    """Ranked, scored substitute candidates — powers the Assisted-mode
    recommendation panel. Each entry shows the compatibility score and
    the specific reasons behind it (same subject, same department,
    workload, fairness) so the admin isn't approving a black-box number."""
    from app.core.timezone import is_substitution_expired
    from app.models.leave import LeaveRequest
    leave = db.query(LeaveRequest).filter(LeaveRequest.id == leave_id).first()
    if not leave:
        raise HTTPException(404, "Leave not found")
    if is_substitution_expired(leave.date):
        raise HTTPException(400, "Cannot find candidates for an expired substitution (cutoff is 5:00 PM in Asia/Kolkata on the substitution date)")
    return substitution_service.get_ranked_recommendations(db, leave_id, limit, tenant_department_id, include_cross_department, only_handles_class)


@router.post("/{leave_id}/assign-recommended", response_model=AlterAssignmentOut, status_code=201)
def assign_recommended_substitute(
    leave_id: int,
    data: AlterAssignmentCreate,
    include_cross_department: bool = False,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    """Same effect as /assign, but records assignment_type=
    faculty_recommended with the score that was shown when the admin
    clicked Approve — use this when the admin picked from the ranked
    list returned by /recommendations, so the dashboard can later show
    "this was a recommended pick" vs "this was assigned from scratch"."""
    recs = substitution_service.get_ranked_recommendations(db, leave_id, limit=50, tenant_department_id=tenant_department_id, include_cross_department=include_cross_department)
    matched = next((r for r in recs if r.teacher.id == data.substitute_teacher_id), None)
    score = matched.score if matched else None
    return leave_service.assign_substitute(
        leave_id, data.substitute_teacher_id, db,
        assignment_type=AssignmentType.faculty_recommended, compatibility_score=score,
        actor_id=_admin.id,
        tenant_department_id=tenant_department_id, include_cross_department=include_cross_department,
        override_substitution_limit=data.override_substitution_limit,
    )


@router.post("/{leave_id}/override", response_model=AlterAssignmentOut)
def override_substitute(
    leave_id: int,
    data: OverrideSubstituteRequest,
    include_cross_department: bool = False,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    """Replaces an existing substitute assignment with a different
    teacher — for correcting an auto-assignment or a prior manual pick."""
    return leave_service.override_substitute(
        leave_id, data.new_substitute_teacher_id, admin, db,
        tenant_department_id=tenant_department_id,
        include_cross_department=include_cross_department,
        override_substitution_limit=data.override_substitution_limit,
    )


@router.post("/{leave_id}/undo-assignment", response_model=LeaveOut)
def undo_assignment(
    leave_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    """Removes the current substitute assignment entirely (reversing
    credits), leaving the leave approved but unassigned again."""
    return leave_service.undo_assignment(leave_id, admin, db, tenant_department_id)


@router.post("/{leave_id}/lock", response_model=AlterAssignmentOut)
def set_assignment_lock(
    leave_id: int,
    data: LockAssignmentRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    """Locked assignments are skipped by the autonomous engine's auto-swap
    and self-healing logic — use for labs, exams, or anything that must
    never be silently re-routed. An admin can still override a locked
    assignment directly; only the autonomous engine is restrained."""
    return leave_service.set_assignment_lock(leave_id, data.locked, admin, db, tenant_department_id)


@router.get("/{leave_id}/free-teachers", response_model=list[FreeTeacherOut])
def free_teachers(
    leave_id: int,
    include_cross_department: bool = False,
    only_handles_class: bool = False,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    from app.core.timezone import is_substitution_expired
    from app.models.leave import LeaveRequest
    leave = db.query(LeaveRequest).filter(LeaveRequest.id == leave_id).first()
    if not leave:
        raise HTTPException(404, "Leave not found")
    if is_substitution_expired(leave.date):
        raise HTTPException(400, "Cannot find free teachers for an expired substitution (cutoff is 5:00 PM in Asia/Kolkata on the substitution date)")
    if tenant_department_id is not None and leave.teacher.department_id != tenant_department_id:
        raise HTTPException(403, "Access denied: leave request is from another department")
    if include_cross_department:
        if not substitution_service.cross_department_substitutions_enabled(db, leave.teacher.department_id):
            raise HTTPException(403, "Cross-department substitutions are disabled for this department")
        candidates = leave_service.detect_free_teachers(leave.day_order, leave.period_number, leave.teacher_id, db, None)
    else:
        candidates = leave_service.detect_free_teachers(leave.day_order, leave.period_number, leave.teacher_id, db, tenant_department_id)
    if only_handles_class:
        from app.models.timetable import TimetableSlot
        affected = db.query(TimetableSlot).filter(TimetableSlot.teacher_id == leave.teacher_id, TimetableSlot.day_order == leave.day_order, TimetableSlot.period_number == leave.period_number).first()
        if not affected:
            return []
        teacher_ids = {row[0] for row in db.query(TimetableSlot.teacher_id).filter(TimetableSlot.class_id == affected.class_id).all()}
        candidates = [candidate for candidate in candidates if candidate.id in teacher_ids]
    return candidates


@router.post("/{leave_id:int}/cancel", response_model=LeaveOut)
@router.delete("/{leave_id:int}", response_model=LeaveOut)
def cancel_leave(
    leave_id: int,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """Teacher cancels their own leave. Future leaves are always
    cancellable. Same-day leaves may only be cancelled before 10:00 AM.
    Past leaves cannot be cancelled."""
    return leave_service.cancel_leave_by_teacher(leave_id, current_user.id, db)


@router.post("/{leave_id}/admin-cancel", response_model=LeaveOut)
def admin_cancel_leave(
    leave_id: int,
    data: AdminCancelRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    """Admin cancels any leave at any time. A reason is required for
    the audit trail."""
    return leave_service.cancel_leave_by_admin(leave_id, admin, data.reason, db, tenant_department_id)


@router.get("/{leave_id}/cancel-impact", response_model=CancelImpactOut)
def cancel_impact(
    leave_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    """Preview what substitute assignments and timetable entries will be
    affected if this leave is cancelled."""
    return leave_service.get_cancel_impact(leave_id, db, tenant_department_id)


@router.post("/admin-create", response_model=list[LeaveOut], status_code=201)
def admin_create_leave(
    data: AdminLeaveCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    """
    Submit and immediately approve a leave request on behalf of a teacher.
    Only available to administrators. Triggers auto-substitution if the mode is autonomous.
    """
    try:
        return leave_service.submit_leave_by_admin(data, current_user, db, tenant_department_id)
    except HTTPException:
        raise
    except Exception:
        logger.exception(
            "POST /leaves/admin-create unhandled exception: admin_id=%s teacher_id=%s date=%s",
            current_user.id, data.teacher_id, data.date,
        )
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while recording the leave request. Please try again.",
        )
