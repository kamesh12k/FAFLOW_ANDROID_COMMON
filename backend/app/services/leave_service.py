import uuid
import logging
from datetime import date, datetime
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.leave import LeaveRequest, LeaveStatus, AlterAssignment, AssignmentType
from app.models.timetable import TimetableSlot
from app.models.user import User, Role
from app.schemas.leave import LeaveCreate, LeaveBatchCreate, FreeTeacherOut, CancelImpactOut, AdminLeaveCreate
from app.services.credit_service import apply_credit_change
from app.services import day_order_service, notification_service, substitution_service
from app.services.admin_service import log_audit_event

from app.services.system_setting_service import get_setting

logger = logging.getLogger(__name__)

# ── Cancellation cutoff ────────────────────────────────────────────────
SAME_DAY_CANCEL_CUTOFF_HOUR = 10  # 10:00 AM local time


def should_auto_approve_leave(db: Session, department_id: int | None = None) -> bool:
    from app.services.substitution_service import get_mode
    return get_mode(db, department_id) == "autonomous"


def submit_leave(teacher_id: int, data: LeaveCreate, db: Session) -> LeaveRequest:
    """Single-period leave. Resolves the date to a Day Order via the
    academic calendar and rejects outright if the date isn't a working
    day — per spec, holidays must never generate leave requests, substitute
    assignments, or credit transactions."""
    calendar_day = day_order_service.assert_working_day_or_400(db, data.date)

    # Idempotency / duplicate protection: prevent duplicate submissions for the same period
    existing_leave = (
        db.query(LeaveRequest)
        .filter(
            LeaveRequest.teacher_id == teacher_id,
            LeaveRequest.date == data.date,
            LeaveRequest.period_number == data.period_number,
            LeaveRequest.status.in_([LeaveStatus.pending, LeaveStatus.approved])
        )
        .first()
    )
    if existing_leave:
        raise HTTPException(
            status_code=400,
            detail=f"Leave already exists for Period {data.period_number} on {data.date}",
        )

    teacher = db.query(User).filter(User.id == teacher_id).first()
    teacher_dept_id = teacher.department_id if teacher else None
    auto_approve = should_auto_approve_leave(db, teacher_dept_id)
    status = LeaveStatus.approved if auto_approve else LeaveStatus.pending

    leave = LeaveRequest(
        teacher_id=teacher_id,
        date=data.date,
        day_order=calendar_day.day_order,
        period_number=data.period_number,
        reason=data.reason,
        status=status,
    )
    substitution_service.mark_emergency_if_applicable(db, leave)
    db.add(leave)
    db.commit()
    db.refresh(leave)

    if auto_approve:
        log_audit_event(
            db, None, "leave.auto_approved_by_system", "leave_request", leave.id, {}
        )
        notification_service.create_notification(
            db, leave.teacher_id,
            title="Leave approved",
            body=f"Your leave for {leave.date} (Day Order {leave.day_order}, period {leave.period_number}) was approved automatically.",
            event_type="leave_approved",
            related_leave_id=leave.id,
        )
        db.commit()

        substitution_service.auto_process_approved_leave(db, leave)
        db.refresh(leave)
    else:
        teacher_name = teacher.name if teacher else f"Teacher #{teacher_id}"
        admins = db.query(User).filter(
            User.role.in_([Role.admin, Role.system_admin]),
            (User.department_id == teacher_dept_id) | (User.role == Role.system_admin),
            User.is_active == True,
        ).all()
        for adm in admins:
            notification_service.create_notification(
                db, adm.id,
                title=f"New Leave Request: {teacher_name}",
                body=f"{teacher_name} requested leave on {leave.date} (Day Order {leave.day_order}, period {leave.period_number}). Reason: {leave.reason or 'Not specified'}",
                event_type="leave_submitted",
                related_leave_id=leave.id,
            )
        notification_service.create_notification(
            db, leave.teacher_id,
            title="Leave Request Submitted",
            body=f"Your leave request for {leave.date} (Period {leave.period_number}) was submitted for approval.",
            event_type="leave_submitted",
            related_leave_id=leave.id,
        )
        db.commit()

    return leave


def submit_leave_batch(teacher_id: int, data: LeaveBatchCreate, db: Session) -> list[LeaveRequest]:
    """Multi-period / whole-day leave submitted in one form. All resulting
    rows share a batch_id. whole_day=True expands to every period the
    teacher actually has on their timetable for that date's Day Order —
    not a blind 1..5, so a teacher with only 3 scheduled periods doesn't
    get leave rows for periods they were never teaching."""
    logger.info(
        "submit_leave_batch: teacher_id=%s date=%s whole_day=%s period_numbers=%s",
        teacher_id, data.date, data.whole_day, data.period_numbers,
    )
    try:
        calendar_day = day_order_service.assert_working_day_or_400(db, data.date)
        logger.debug("submit_leave_batch: resolved day_order=%s for date=%s", calendar_day.day_order, data.date)
    except HTTPException:
        raise
    except Exception:
        logger.exception(
            "submit_leave_batch: unexpected error resolving calendar day for date=%s teacher_id=%s",
            data.date, teacher_id,
        )
        raise HTTPException(status_code=500, detail="Failed to resolve academic calendar for the requested date")

    try:
        if data.whole_day:
            scheduled = (
                db.query(TimetableSlot.period_number)
                .filter(TimetableSlot.teacher_id == teacher_id, TimetableSlot.day_order == calendar_day.day_order)
                .all()
            )
            periods = sorted({p for (p,) in scheduled})
            if not periods:
                raise HTTPException(
                    status_code=400,
                    detail=f"No timetable periods found for Day Order {calendar_day.day_order} — nothing to apply leave for",
                )
        else:
            if not data.period_numbers:
                raise HTTPException(status_code=400, detail="period_numbers is required unless whole_day=True")
            periods = sorted(set(data.period_numbers))
    except HTTPException:
        raise
    except Exception:
        logger.exception(
            "submit_leave_batch: unexpected error resolving periods teacher_id=%s date=%s",
            teacher_id, data.date,
        )
        raise HTTPException(status_code=500, detail="Failed to determine leave periods")

    logger.debug("submit_leave_batch: submitting %d period(s) %s for teacher_id=%s", len(periods), periods, teacher_id)

    try:
        batch_id = uuid.uuid4()
        leaves = []
        teacher = db.query(User).filter(User.id == teacher_id).first()
        teacher_dept_id = teacher.department_id if teacher else None
        auto_approve = should_auto_approve_leave(db, teacher_dept_id)
        status = LeaveStatus.approved if auto_approve else LeaveStatus.pending

        for period in periods:
            existing_leave = (
                db.query(LeaveRequest)
                .filter(
                    LeaveRequest.teacher_id == teacher_id,
                    LeaveRequest.date == data.date,
                    LeaveRequest.period_number == period,
                    LeaveRequest.status.in_([LeaveStatus.pending, LeaveStatus.approved])
                )
                .first()
            )
            if existing_leave:
                raise HTTPException(
                    status_code=400,
                    detail=f"Leave already exists for Period {period} on {data.date}",
                )

            leave = LeaveRequest(
                teacher_id=teacher_id,
                date=data.date,
                day_order=calendar_day.day_order,
                period_number=period,
                reason=data.reason,
                status=status,
                batch_id=batch_id,
            )
            substitution_service.mark_emergency_if_applicable(db, leave)
            db.add(leave)
            leaves.append(leave)

        db.commit()
        for leave in leaves:
            db.refresh(leave)

        if auto_approve:
            for leave in leaves:
                log_audit_event(
                    db, None, "leave.auto_approved_by_system", "leave_request", leave.id, {}
                )
                notification_service.create_notification(
                    db, leave.teacher_id,
                    title="Leave approved",
                    body=f"Your leave for {leave.date} (Day Order {leave.day_order}, period {leave.period_number}) was approved automatically.",
                    event_type="leave_approved",
                    related_leave_id=leave.id,
                )
                db.commit()

                substitution_service.auto_process_approved_leave(db, leave)
            db.commit()
            for leave in leaves:
                db.refresh(leave)
        else:
            teacher_name = teacher.name if teacher else f"Teacher #{teacher_id}"
            periods_str = ", ".join(str(p) for p in periods)
            admins = db.query(User).filter(
                User.role.in_([Role.admin, Role.system_admin]),
                (User.department_id == teacher_dept_id) | (User.role == Role.system_admin),
                User.is_active == True,
            ).all()
            for adm in admins:
                notification_service.create_notification(
                    db, adm.id,
                    title=f"New Leave Request: {teacher_name}",
                    body=f"{teacher_name} requested leave on {data.date} for Period(s) {periods_str}. Reason: {data.reason or 'Not specified'}",
                    event_type="leave_submitted",
                    related_leave_id=leaves[0].id if leaves else None,
                )
            notification_service.create_notification(
                db, teacher_id,
                title="Leave Request Submitted",
                body=f"Your leave request for {data.date} (Period(s) {periods_str}) was submitted for approval.",
                event_type="leave_submitted",
                related_leave_id=leaves[0].id if leaves else None,
            )
            db.commit()

        logger.info(
            "submit_leave_batch: created %d leave row(s) batch_id=%s teacher_id=%s date=%s",
            len(leaves), batch_id, teacher_id, data.date,
        )
        return leaves
    except HTTPException:
        raise
    except Exception:
        logger.exception(
            "submit_leave_batch: DB error persisting leave rows teacher_id=%s date=%s periods=%s",
            teacher_id, data.date, periods,
        )
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to save leave request — please try again")


def get_all_leaves(db: Session, tenant_department_id: int | None = None) -> list[LeaveRequest]:
    query = db.query(LeaveRequest)
    if tenant_department_id is not None:
        query = query.join(User, LeaveRequest.teacher_id == User.id).filter(User.department_id == tenant_department_id)
    return query.order_by(LeaveRequest.created_at.desc()).all()



def get_teacher_leaves(teacher_id: int, db: Session) -> list[LeaveRequest]:
    return (
        db.query(LeaveRequest)
        .filter(LeaveRequest.teacher_id == teacher_id)
        .order_by(LeaveRequest.created_at.desc())
        .all()
    )


def approve_leave(leave_id: int, db: Session, tenant_department_id: int | None = None) -> tuple[LeaveRequest, list[FreeTeacherOut]]:
    leave = _get_leave_or_404(leave_id, db, tenant_department_id, for_update=True)

    if leave.status != LeaveStatus.pending:
        raise HTTPException(status_code=400, detail="Only pending requests can be approved")

    # Defensive re-check: the calendar may have changed (e.g. retroactively
    # marked a holiday) between submission and approval.
    day_order_service.assert_working_day_or_400(db, leave.date)

    leave.status = LeaveStatus.approved
    db.commit()
    db.refresh(leave)

    notification_service.create_notification(
        db, leave.teacher_id,
        title="Leave approved",
        body=f"Your leave for {leave.date} (Day Order {leave.day_order}, period {leave.period_number}) was approved.",
        event_type="leave_approved",
        related_leave_id=leave.id,
    )
    db.commit()

    # Campus Operations Mode: in "autonomous" mode this immediately picks
    # and assigns a substitute with no further admin action. In "manual"
    # or "assisted" mode it's a no-op — the admin assigns via the normal
    # flow, optionally consulting get_ranked_recommendations for a
    # ranked, scored list instead of a flat one.
    substitution_service.auto_process_approved_leave(db, leave)
    db.refresh(leave)

    free_teachers = detect_free_teachers(
        leave.day_order, leave.period_number, leave.teacher_id, db,
        tenant_department_id=leave.teacher.department_id
    )
    return leave, free_teachers



def bulk_approve(leave_ids: list[int], db: Session, tenant_department_id: int | None = None) -> list[LeaveRequest]:
    results = []
    for leave_id in leave_ids:
        leave, _ = approve_leave(leave_id, db, tenant_department_id)
        results.append(leave)
    return results


def reject_leave(leave_id: int, db: Session, tenant_department_id: int | None = None) -> LeaveRequest:
    leave = _get_leave_or_404(leave_id, db, tenant_department_id, for_update=True)

    if leave.status != LeaveStatus.pending:
        raise HTTPException(status_code=400, detail="Only pending requests can be rejected")

    leave.status = LeaveStatus.rejected
    db.commit()
    db.refresh(leave)

    notification_service.create_notification(
        db, leave.teacher_id,
        title="Leave rejected",
        body=f"Your leave for {leave.date} (Day Order {leave.day_order}, period {leave.period_number}) was rejected.",
        event_type="leave_rejected",
        related_leave_id=leave.id,
    )
    db.commit()
    return leave


def bulk_reject(leave_ids: list[int], db: Session, tenant_department_id: int | None = None) -> list[LeaveRequest]:
    return [reject_leave(leave_id, db, tenant_department_id) for leave_id in leave_ids]



def detect_free_teachers(
    day_order: int,
    period_number: int,
    exclude_teacher_id: int,
    db: Session,
    tenant_department_id: int | None = None,
) -> list[FreeTeacherOut]:
    """Return teachers who have NO timetable slot for this Day Order +
    period. Day-Order-based (not weekday-based) so it correctly reflects
    the rotating schedule regardless of which calendar date triggered the
    lookup.

    Optimized for high-concurrency: performs bulk queries for today's slots
    and weekly workloads across all candidates in O(1) database round-trips.
    """
    busy_ids_query = (
        db.query(TimetableSlot.teacher_id)
        .filter(
            TimetableSlot.day_order == day_order,
            TimetableSlot.period_number == period_number,
        )
    )

    query = db.query(User).filter(
        User.role == Role.teacher,
        User.is_active == True,  # noqa: E712
        User.id != exclude_teacher_id,
        ~User.id.in_(busy_ids_query),
    )
    if tenant_department_id is not None:
        query = query.filter(User.department_id == tenant_department_id)
    free_teachers = query.all()
    if not free_teachers:
        return []

    teacher_ids = [t.id for t in free_teachers]
    all_slots = db.query(TimetableSlot).filter(TimetableSlot.teacher_id.in_(teacher_ids)).all()

    today_slots_by_teacher: dict[int, list[int]] = {}
    week_count_by_teacher: dict[int, int] = {}

    for s in all_slots:
        week_count_by_teacher[s.teacher_id] = week_count_by_teacher.get(s.teacher_id, 0) + 1
        if s.day_order == day_order:
            today_slots_by_teacher.setdefault(s.teacher_id, []).append(s.period_number)

    res = []
    for t in free_teachers:
        periods_today = sorted(today_slots_by_teacher.get(t.id, []))
        week_count = week_count_by_teacher.get(t.id, 0)
        res.append(
            FreeTeacherOut(
                id=t.id,
                name=t.name,
                department=t.department,
                today_workload=len(periods_today),
                today_periods=periods_today,
                week_workload=week_count
            )
        )
    return res



def assign_substitute(
    leave_id: int, substitute_id: int, db: Session, *,
    assignment_type: AssignmentType = AssignmentType.admin_assigned,
    compatibility_score: float | None = None,
    actor_id: int | None = None,
    tenant_department_id: int | None = None,
    include_cross_department: bool = False,
    override_substitution_limit: bool = False,
) -> AlterAssignment:
    from app.core.timezone import is_substitution_expired
    leave = _get_leave_or_404(leave_id, db, tenant_department_id)

    if leave.status != LeaveStatus.approved:
        raise HTTPException(status_code=400, detail="Leave must be approved before assigning substitute")

    if is_substitution_expired(leave.date):
        raise HTTPException(status_code=400, detail="Cannot assign substitute for an expired substitution (cutoff is 5:00 PM in Asia/Kolkata on the substitution date)")

    if leave.alter_assignment:
        raise HTTPException(status_code=400, detail="Substitute already assigned for this leave — use override instead")

    # Re-check at assignment time too — covers a holiday being marked
    # in the window between approval and substitute assignment.
    day_order_service.assert_working_day_or_400(db, leave.date)

    query = db.query(User).filter(User.id == substitute_id, User.role == Role.teacher, User.is_active == True)  # noqa: E712
    if include_cross_department:
        if not substitution_service.cross_department_substitutions_enabled(db, leave.teacher.department_id):
            raise HTTPException(status_code=403, detail="Cross-department substitutions are disabled for this department")
    elif tenant_department_id is not None:
        query = query.filter(User.department_id == tenant_department_id)
    substitute = query.first()
    if not substitute:
        raise HTTPException(status_code=404, detail="Substitute teacher not found")

    if substitute.id == leave.teacher_id:
        raise HTTPException(status_code=400, detail="A teacher cannot be their own substitute")

    # Hard conflict checks — these NEVER bend regardless of override flag
    busy = (
        db.query(TimetableSlot)
        .filter(TimetableSlot.teacher_id == substitute.id, TimetableSlot.day_order == leave.day_order,
                TimetableSlot.period_number == leave.period_number)
        .first()
    )
    if busy:
        raise HTTPException(status_code=400, detail=f"{substitute.name} is already teaching during period {leave.period_number}")

    own_leave = (
        db.query(LeaveRequest)
        .filter(LeaveRequest.teacher_id == substitute.id, LeaveRequest.date == leave.date,
                LeaveRequest.period_number == leave.period_number, LeaveRequest.status == LeaveStatus.approved)
        .first()
    )
    if own_leave:
        raise HTTPException(status_code=400, detail=f"{substitute.name} is on approved leave for period {leave.period_number}")

    already_subbing = (
        db.query(AlterAssignment)
        .join(LeaveRequest, AlterAssignment.leave_request_id == LeaveRequest.id)
        .filter(AlterAssignment.substitute_teacher_id == substitute.id, LeaveRequest.date == leave.date,
                LeaveRequest.period_number == leave.period_number)
        .first()
    )
    if already_subbing:
        raise HTTPException(status_code=400, detail=f"{substitute.name} is already substituting another class during period {leave.period_number}")

    # 7-Day Rolling Substitution Limit Validation
    limit_info = substitution_service.check_7day_substitution_limit(db, substitute.id, leave.date)
    if limit_info["limit_reached"]:
        if not override_substitution_limit:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "LIMIT_ACKNOWLEDGEMENT_REQUIRED",
                    "message": f"{substitute.name} has reached the maximum number of substitution allocations allowed within the current 7-day window.",
                    "teacher_id": substitute.id,
                    "teacher_name": substitute.name,
                    "current_allocations": limit_info["current_allocations"],
                    "max_allocations": limit_info["max_allocations"],
                    "projected_allocations": limit_info["projected_allocations"],
                },
            )
        else:
            log_audit_event(
                db, actor_id, "substitution.limit_override", "leave_request", leave.id,
                {
                    "substitute_teacher_id": substitute.id,
                    "substitute_name": substitute.name,
                    "current_7day_allocations": limit_info["current_allocations"],
                    "max_allocations": limit_info["max_allocations"],
                    "projected_allocations": limit_info["projected_allocations"],
                    "authorized_by_id": actor_id,
                },
            )

    assignment = substitution_service.create_assignment(
        db, leave, substitute, assignment_type, compatibility_score, actor_id=actor_id,
    )
    db.commit()
    db.refresh(assignment)

    return assignment


def override_substitute(
    leave_id: int, new_substitute_id: int, actor: User, db: Session,
    tenant_department_id: int | None = None,
    include_cross_department: bool = False,
    override_substitution_limit: bool = False,
) -> AlterAssignment:
    """Replaces an existing assignment (often an auto-assigned one) with
    a different substitute, chosen by an admin. Reverses the original
    credit transactions before applying new ones, so the ledger always
    reflects who is actually covering the class right now — not a
    history of every assignment that was ever proposed."""
    from app.core.timezone import is_substitution_expired
    leave = _get_leave_or_404(leave_id, db, tenant_department_id)
    if is_substitution_expired(leave.date):
        raise HTTPException(status_code=400, detail="Cannot change substitute for an expired substitution (cutoff is 5:00 PM in Asia/Kolkata on the substitution date)")
    existing = leave.alter_assignment
    if not existing:
        raise HTTPException(status_code=400, detail="No existing assignment to override — use the normal assign flow")
    if existing.is_locked:
        raise HTTPException(status_code=400, detail="This assignment is locked — unlock it before overriding")

    query = db.query(User).filter(User.id == new_substitute_id, User.role == Role.teacher, User.is_active == True)  # noqa: E712
    if include_cross_department:
        if not substitution_service.cross_department_substitutions_enabled(db, leave.teacher.department_id):
            raise HTTPException(status_code=403, detail="Cross-department substitutions are disabled for this department")
    elif tenant_department_id is not None:
        query = query.filter(User.department_id == tenant_department_id)
    new_substitute = query.first()
    if not new_substitute:
        raise HTTPException(status_code=404, detail="Substitute teacher not found")
    if new_substitute.id == leave.teacher_id:
        raise HTTPException(status_code=400, detail="A teacher cannot be their own substitute")
    if new_substitute.id == existing.substitute_teacher_id:
        raise HTTPException(status_code=400, detail="That teacher is already assigned")

    # Hard conflict checks — these NEVER bend regardless of override flag
    busy = (
        db.query(TimetableSlot)
        .filter(TimetableSlot.teacher_id == new_substitute.id, TimetableSlot.day_order == leave.day_order,
                TimetableSlot.period_number == leave.period_number)
        .first()
    )
    if busy:
        raise HTTPException(status_code=400, detail=f"{new_substitute.name} is already teaching during period {leave.period_number}")

    own_leave = (
        db.query(LeaveRequest)
        .filter(LeaveRequest.teacher_id == new_substitute.id, LeaveRequest.date == leave.date,
                LeaveRequest.period_number == leave.period_number, LeaveRequest.status == LeaveStatus.approved)
        .first()
    )
    if own_leave:
        raise HTTPException(status_code=400, detail=f"{new_substitute.name} is on approved leave for period {leave.period_number}")

    already_subbing = (
        db.query(AlterAssignment)
        .join(LeaveRequest, AlterAssignment.leave_request_id == LeaveRequest.id)
        .filter(AlterAssignment.substitute_teacher_id == new_substitute.id, LeaveRequest.date == leave.date,
                LeaveRequest.period_number == leave.period_number, AlterAssignment.id != existing.id)
        .first()
    )
    if already_subbing:
        raise HTTPException(status_code=400, detail=f"{new_substitute.name} is already substituting another class during period {leave.period_number}")

    # 7-Day Rolling Substitution Limit Validation
    limit_info = substitution_service.check_7day_substitution_limit(db, new_substitute.id, leave.date)
    if limit_info["limit_reached"]:
        if not override_substitution_limit:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "LIMIT_ACKNOWLEDGEMENT_REQUIRED",
                    "message": f"{new_substitute.name} has reached the maximum number of substitution allocations allowed within the current 7-day window.",
                    "teacher_id": new_substitute.id,
                    "teacher_name": new_substitute.name,
                    "current_allocations": limit_info["current_allocations"],
                    "max_allocations": limit_info["max_allocations"],
                    "projected_allocations": limit_info["projected_allocations"],
                },
            )
        else:
            log_audit_event(
                db, actor.id, "substitution.limit_override", "leave_request", leave.id,
                {
                    "substitute_teacher_id": new_substitute.id,
                    "substitute_name": new_substitute.name,
                    "current_7day_allocations": limit_info["current_allocations"],
                    "max_allocations": limit_info["max_allocations"],
                    "projected_allocations": limit_info["projected_allocations"],
                    "authorized_by_id": actor.id,
                },
            )

    old_substitute_id = existing.substitute_teacher_id
    old_type = existing.assignment_type

    # Reverse old credit change and apply new one
    teacher = leave.teacher or db.query(User).filter(User.id == leave.teacher_id).first()
    teacher_name = teacher.name if (teacher and teacher.name) else f"teacher #{leave.teacher_id}"
    apply_credit_change(
        teacher_id=old_substitute_id, change=-1,
        reason=f"Override: removed as substitute for {teacher_name} on {leave.date} period {leave.period_number}",
        leave_id=leave.id, db=db, category="correction",
    )
    apply_credit_change(
        teacher_id=new_substitute.id, change=+1,
        reason=f"Override: assigned as substitute for {teacher_name} on {leave.date} period {leave.period_number}",
        leave_id=leave.id, db=db, category="substitute_class",
    )

    existing.substitute_teacher_id = new_substitute.id
    existing.assignment_type = AssignmentType.overridden
    existing.compatibility_score = None

    log_audit_event(
        db, actor.id, "substitution.overridden", "leave_request", leave.id,
        {"old_substitute_id": old_substitute_id, "old_type": old_type.value, "new_substitute_id": new_substitute.id},
    )

    notification_service.create_notification(
        db, new_substitute.id, title="You've been assigned a substitute class",
        body=f"Cover {leave.date} (Day Order {leave.day_order}, period {leave.period_number}) — assigned by an admin.",
        event_type="substitute_assigned", related_leave_id=leave.id,
    )
    notification_service.create_notification(
        db, old_substitute_id, title="Substitute assignment changed",
        body=f"You're no longer covering {leave.date} period {leave.period_number} — reassigned by an admin.",
        event_type="substitute_assigned", related_leave_id=leave.id,
    )

    db.commit()
    db.refresh(existing)
    return existing


def undo_assignment(leave_id: int, actor: User, db: Session, tenant_department_id: int | None = None) -> LeaveRequest:
    """Removes the current substitute assignment entirely (reverting
    credits) and puts the leave back to a state where a fresh assignment
    can be made — used for "Undo Last Action" / "Undo Auto Assignments"
    from the spec. Does not touch leave.status; the leave stays approved,
    only the substitute assignment is undone."""
    from app.core.timezone import is_substitution_expired
    leave = _get_leave_or_404(leave_id, db, tenant_department_id)
    if is_substitution_expired(leave.date):
        raise HTTPException(status_code=400, detail="Cannot modify an expired substitution (cutoff is 5:00 PM in Asia/Kolkata on the substitution date)")
    existing = leave.alter_assignment
    if not existing:
        raise HTTPException(status_code=400, detail="No assignment to undo")
    if existing.is_locked:
        raise HTTPException(status_code=400, detail="This assignment is locked — unlock it before undoing")

    apply_credit_change(
        teacher_id=leave.teacher_id, change=+1,
        reason=f"Undo: leave on {leave.date} period {leave.period_number} reverted",
        leave_id=leave.id, db=db, category="correction",
    )
    apply_credit_change(
        teacher_id=existing.substitute_teacher_id, change=-1,
        reason=f"Undo: substitute assignment for {leave.date} period {leave.period_number} reverted",
        leave_id=leave.id, db=db, category="correction",
    )

    log_audit_event(
        db, actor.id, "substitution.undone", "leave_request", leave.id,
        {"removed_substitute_id": existing.substitute_teacher_id, "was_type": existing.assignment_type.value},
    )

    db.delete(existing)
    db.commit()
    db.refresh(leave)
    return leave


def set_assignment_lock(leave_id: int, locked: bool, actor: User, db: Session, tenant_department_id: int | None = None) -> AlterAssignment:
    from app.core.timezone import is_substitution_expired
    leave = _get_leave_or_404(leave_id, db, tenant_department_id)
    if is_substitution_expired(leave.date):
        raise HTTPException(status_code=400, detail="Cannot modify lock on an expired substitution (cutoff is 5:00 PM in Asia/Kolkata on the substitution date)")
    existing = leave.alter_assignment
    if not existing:
        raise HTTPException(status_code=400, detail="No assignment to lock")
    existing.is_locked = locked
    log_audit_event(db, actor.id, "substitution.lock_changed", "leave_request", leave.id, {"locked": locked})
    db.commit()
    db.refresh(existing)
    return existing



# ── Leave Cancellation ──────────────────────────────────────────────────

def _reverse_assignment_if_exists(leave: LeaveRequest, db: Session) -> int | None:
    """If the leave has a substitute assignment, reverse the credits and
    delete it. Returns the displaced substitute's user ID, or None."""
    existing = leave.alter_assignment
    if not existing:
        return None

    substitute_id = existing.substitute_teacher_id

    # Reverse credits: give back to original teacher, take back from sub
    apply_credit_change(
        teacher_id=leave.teacher_id, change=+1,
        reason=f"Leave cancelled: {leave.date} period {leave.period_number} reverted",
        leave_id=leave.id, db=db, category="correction",
    )
    apply_credit_change(
        teacher_id=substitute_id, change=-1,
        reason=f"Leave cancelled: substitute assignment for {leave.date} period {leave.period_number} removed",
        leave_id=leave.id, db=db, category="correction",
    )

    db.delete(existing)
    return substitute_id


def cancel_leave_by_teacher(
    leave_id: int, teacher_id: int, db: Session, *, now: datetime | None = None,
) -> LeaveRequest:
    """Teacher cancels their own leave. Rules:
    - Future date: always allowed
    - Same day: only before 10:00 AM
    - Past date: never allowed
    The ``now`` parameter exists for testability."""
    leave = _get_leave_or_404(leave_id, db)

    if leave.teacher_id != teacher_id:
        raise HTTPException(status_code=403, detail="You can only cancel your own leave requests")

    if leave.status in (LeaveStatus.rejected, LeaveStatus.cancelled):
        raise HTTPException(status_code=400, detail=f"Cannot cancel a leave that is already {leave.status.value}")

    if now is None:
        now = datetime.now()

    today = now.date()

    if leave.date < today:
        raise HTTPException(status_code=400, detail="Past leave requests cannot be cancelled")

    if leave.date == today and now.hour >= SAME_DAY_CANCEL_CUTOFF_HOUR:
        raise HTTPException(
            status_code=400,
            detail="Same-day leave cancellation is only available before 10:00 AM. Please contact an administrator.",
        )

    # Determine cancellation type for audit
    if leave.date > today:
        cancellation_type = "future_leave"
    else:
        cancellation_type = "same_day_before_10am"

    # Reverse any substitute assignment + credits
    displaced_sub_id = _reverse_assignment_if_exists(leave, db)

    leave.status = LeaveStatus.cancelled
    log_audit_event(
        db, teacher_id, "leave.cancelled_by_teacher", "leave_request", leave.id,
        {
            "cancellation_type": cancellation_type,
            "cancellation_time": now.isoformat(),
        },
    )

    # Notify the teacher
    notification_service.create_notification(
        db, leave.teacher_id,
        title="Leave cancelled",
        body=f"Your leave for {leave.date} (Day Order {leave.day_order}, period {leave.period_number}) has been cancelled.",
        event_type="leave_cancelled",
        related_leave_id=leave.id,
    )

    # Notify displaced substitute
    if displaced_sub_id:
        notification_service.create_notification(
            db, displaced_sub_id,
            title="Coverage assignment removed",
            body=f"You are no longer covering {leave.date} period {leave.period_number} -- the original leave was cancelled.",
            event_type="substitute_removed",
            related_leave_id=leave.id,
        )

    db.commit()
    db.refresh(leave)
    return leave


def cancel_leave_by_admin(
    leave_id: int, admin: User, reason: str, db: Session,
    tenant_department_id: int | None = None,
) -> LeaveRequest:
    """Admin cancels any leave -- no date/time restrictions. A reason is
    required for the audit trail."""
    leave = _get_leave_or_404(leave_id, db, tenant_department_id)

    if leave.status in (LeaveStatus.rejected, LeaveStatus.cancelled):
        raise HTTPException(status_code=400, detail=f"Cannot cancel a leave that is already {leave.status.value}")

    displaced_sub_id = _reverse_assignment_if_exists(leave, db)

    leave.status = LeaveStatus.cancelled
    log_audit_event(
        db, admin.id, "leave.cancelled_by_admin_override", "leave_request", leave.id,
        {
            "reason": reason,
            "cancellation_time": datetime.now().isoformat(),
            "had_substitute": displaced_sub_id is not None,
            "displaced_substitute_id": displaced_sub_id,
        },
    )

    # Notify the teacher that their leave was cancelled
    notification_service.create_notification(
        db, leave.teacher_id,
        title="Leave cancelled by admin",
        body=f"Your leave for {leave.date} (Day Order {leave.day_order}, period {leave.period_number}) was cancelled by an administrator. Reason: {reason}",
        event_type="leave_cancelled",
        related_leave_id=leave.id,
    )

    if displaced_sub_id:
        notification_service.create_notification(
            db, displaced_sub_id,
            title="Coverage assignment removed",
            body=f"You are no longer covering {leave.date} period {leave.period_number} -- the leave was cancelled by an administrator.",
            event_type="substitute_removed",
            related_leave_id=leave.id,
        )

    db.commit()
    db.refresh(leave)
    return leave


def get_cancel_impact(leave_id: int, db: Session, tenant_department_id: int | None = None) -> CancelImpactOut:
    """Returns a preview of what will be affected if this leave is
    cancelled -- used by the admin frontend to show a confirmation modal."""
    leave = _get_leave_or_404(leave_id, db, tenant_department_id)
    existing = leave.alter_assignment

    return CancelImpactOut(
        leave_id=leave.id,
        leave_date=leave.date,
        day_order=leave.day_order,
        period_number=leave.period_number,
        teacher_name=leave.teacher.name if leave.teacher else "Unknown",
        has_substitute=existing is not None,
        substitute_name=existing.substitute.name if existing and existing.substitute else None,
        substitute_id=existing.substitute_teacher_id if existing else None,
        assignment_type=existing.assignment_type.value if existing else None,
    )


def _get_leave_or_404(leave_id: int, db: Session, tenant_department_id: int | None = None, for_update: bool = False) -> LeaveRequest:
    query = db.query(LeaveRequest).filter(LeaveRequest.id == leave_id)
    if for_update and db.bind and db.bind.dialect.name == "postgresql":
        query = query.with_for_update()
    leave = query.first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")
    if tenant_department_id is not None:
        if leave.teacher.department_id != tenant_department_id:
            raise HTTPException(status_code=403, detail="Access denied to this leave request")
    return leave



def submit_leave_by_admin(data: AdminLeaveCreate, admin_user: User, db: Session, tenant_department_id: int | None = None) -> list[LeaveRequest]:
    """
    Submit and immediately approve leave for a teacher by an administrator.
    If whole_day is True, expands to all periods scheduled for that teacher on that day order.
    Triggers auto-substitution if mode is autonomous. Logs audit details.
    """
    logger.info(
        "submit_leave_by_admin: admin_id=%s teacher_id=%s date=%s whole_day=%s period_numbers=%s",
        admin_user.id, data.teacher_id, data.date, data.whole_day, data.period_numbers,
    )
    if tenant_department_id is not None:
        teacher = db.query(User).filter(User.id == data.teacher_id).first()
        if not teacher or teacher.department_id != tenant_department_id:
            raise HTTPException(status_code=403, detail="Access denied: teacher belongs to another department")
            
    calendar_day = day_order_service.assert_working_day_or_400(db, data.date)

    
    # 1. Resolve period numbers
    if data.whole_day:
        scheduled = (
            db.query(TimetableSlot.period_number)
            .filter(TimetableSlot.teacher_id == data.teacher_id, TimetableSlot.day_order == calendar_day.day_order)
            .all()
        )
        periods = sorted({p for (p,) in scheduled})
        if not periods:
            raise HTTPException(
                status_code=400,
                detail=f"No timetable periods found for Day Order {calendar_day.day_order} — nothing to apply leave for",
            )
    else:
        if not data.period_numbers:
            raise HTTPException(status_code=400, detail="period_numbers is required unless whole_day=True")
        periods = sorted(set(data.period_numbers))

    # 2. Create approved leaves
    try:
        batch_id = uuid.uuid4()
        leaves = []
        status = LeaveStatus.approved  # Always approved immediately for admin entries

        for period in periods:
            # Check if there is already a non-cancelled leave for this teacher, date, and period
            existing_leave = (
                db.query(LeaveRequest)
                .filter(
                    LeaveRequest.teacher_id == data.teacher_id,
                    LeaveRequest.date == data.date,
                    LeaveRequest.period_number == period,
                    LeaveRequest.status.in_([LeaveStatus.pending, LeaveStatus.approved])
                )
                .first()
            )
            if existing_leave:
                raise HTTPException(
                    status_code=400,
                    detail=f"Leave already exists for Period {period} on {data.date}",
                )

            leave = LeaveRequest(
                teacher_id=data.teacher_id,
                date=data.date,
                day_order=calendar_day.day_order,
                period_number=period,
                reason=data.reason,
                status=status,
                batch_id=batch_id,
            )
            substitution_service.mark_emergency_if_applicable(db, leave)
            db.add(leave)
            leaves.append(leave)

        db.commit()
        for leave in leaves:
            db.refresh(leave)

        # 3. Process each approved leave (audit, notifications, substitution)
        for leave in leaves:
            log_audit_event(
                db,
                admin_user.id,
                "leave.admin_created",
                "leave_request",
                leave.id,
                {
                    "created_by": admin_user.name,
                    "leave_source": "Admin Entry",
                    "reason": data.reason,
                    "notes": data.notes,
                }
            )
            
            notification_service.create_notification(
                db,
                leave.teacher_id,
                title="Leave recorded by Administrator",
                body=f"An administrator recorded approved leave for you on {leave.date} (Day Order {leave.day_order}, period {leave.period_number}). Reason: {leave.reason}",
                event_type="leave_approved",
                related_leave_id=leave.id,
            )
            db.commit()

            substitution_service.auto_process_approved_leave(db, leave)
        
        db.commit()
        for leave in leaves:
            db.refresh(leave)

        logger.info(
            "submit_leave_by_admin: created and approved %d leave row(s) batch_id=%s teacher_id=%s date=%s",
            len(leaves), batch_id, data.teacher_id, data.date,
        )
        return leaves
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        logger.exception(
            "submit_leave_by_admin: DB error persisting leave rows admin_id=%s teacher_id=%s date=%s",
            admin_user.id, data.teacher_id, data.date,
        )
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to record leave request — please try again")
