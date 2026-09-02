from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.class_ import Class
from app.models.timetable_submission import TimetableSubmission, TimetableSubmissionStatus
from app.models.user import User, Role
from app.schemas.timetable import TimetableSubmissionCreate, TimetableSlotCreate
from app.services import timetable_service, notification_service
from app.services.admin_service import log_audit_event
from app.services.system_setting_service import get_setting


def _mode(db: Session, department_id: int | None) -> str:
    return get_setting(db, "teacher_timetable_entry_mode", "approval", department_id)


def submit(db: Session, teacher: User, data: TimetableSubmissionCreate) -> TimetableSubmission:
    if _mode(db, teacher.department_id) == "disabled":
        raise HTTPException(403, "Teacher timetable self-entry is disabled")
    if not db.query(Class).filter(Class.id == data.class_id).first():
        raise HTTPException(404, "Class not found")
    slot = TimetableSlotCreate(teacher_id=teacher.id, **data.model_dump())
    timetable_service._check_conflicts(db, slot)
    submission = TimetableSubmission(teacher_id=teacher.id, **data.model_dump(exclude={"allow_combined_class"}))
    db.add(submission)
    log_audit_event(db, teacher.id, "timetable.submitted", "timetable_submission", None, data.model_dump())
    db.commit()
    db.refresh(submission)

    # Notify Admins / HODs of the department
    admins = db.query(User).filter(
        User.role.in_([Role.admin, Role.system_admin]),
        (User.department_id == teacher.department_id) | (User.role == Role.system_admin),
        User.is_active == True,
    ).all()
    for adm in admins:
        notification_service.create_notification(
            db, adm.id,
            title=f"Timetable Request: {teacher.name}",
            body=f"{teacher.name} submitted a timetable slot for Day Order {data.day_order}, Period {data.period_number}.",
            event_type="timetable_submitted",
        )

    # Notify the teacher
    notification_service.create_notification(
        db, teacher.id,
        title="Timetable Slot Submitted",
        body=f"Your timetable slot for Day Order {data.day_order}, Period {data.period_number} was submitted for approval.",
        event_type="timetable_submitted",
    )
    db.commit()

    return submission


def list_for_teacher(db: Session, teacher_id: int) -> list[TimetableSubmission]:
    return db.query(TimetableSubmission).filter(TimetableSubmission.teacher_id == teacher_id).order_by(TimetableSubmission.created_at.desc()).all()


def list_pending(db: Session, department_id: int | None) -> list[TimetableSubmission]:
    query = db.query(TimetableSubmission).join(User, TimetableSubmission.teacher_id == User.id).filter(TimetableSubmission.status == TimetableSubmissionStatus.pending)
    if department_id is not None:
        query = query.filter(User.department_id == department_id)
    return query.order_by(TimetableSubmission.created_at).all()


def review(db: Session, submission_id: int, admin: User, approved: bool, note: str | None) -> TimetableSubmission:
    submission = db.query(TimetableSubmission).filter(TimetableSubmission.id == submission_id).first()
    if not submission:
        raise HTTPException(404, "Timetable submission not found")
    if submission.status != TimetableSubmissionStatus.pending:
        raise HTTPException(400, "Only pending submissions can be reviewed")
    teacher = db.query(User).filter(User.id == submission.teacher_id).first()
    if not admin.is_system_admin and teacher.department_id != admin.department_id:
        raise HTTPException(403, "You can review only your department's submissions")
    submission.review_note = note
    submission.reviewed_by_id = admin.id
    submission.reviewed_at = datetime.now(timezone.utc)
    if approved:
        official = TimetableSlotCreate(teacher_id=submission.teacher_id, subject_id=submission.subject_id, class_id=submission.class_id, room_id=submission.room_id, day_order=submission.day_order, period_number=submission.period_number)
        timetable_service._check_conflicts(db, official)
        from app.models.timetable import TimetableSlot
        db.add(TimetableSlot(**official.model_dump(exclude={"allow_combined_class"})))
        submission.status = TimetableSubmissionStatus.approved
    else:
        submission.status = TimetableSubmissionStatus.rejected

    log_audit_event(db, admin.id, "timetable.submission_approved" if approved else "timetable.submission_rejected", "timetable_submission", submission.id, {"note": note})
    db.commit()
    db.refresh(submission)

    # Notify teacher of review decision
    notification_service.create_notification(
        db, submission.teacher_id,
        title=f"Timetable Slot {'Approved' if approved else 'Rejected'}",
        body=f"Your timetable slot for Day Order {submission.day_order}, Period {submission.period_number} was {'approved' if approved else 'rejected'}" + (f": {note}" if note else "."),
        event_type="timetable_approved" if approved else "timetable_rejected",
    )
    db.commit()

    return submission


def bulk_review(db: Session, submission_ids: list[int], admin: User, approved: bool) -> dict:
    success_count = 0
    failed_count = 0
    errors = []
    for sub_id in submission_ids:
        try:
            review(db, sub_id, admin, approved, note="One-click bulk approval")
            success_count += 1
        except Exception as e:
            failed_count += 1
            errors.append(f"Submission #{sub_id}: {getattr(e, 'detail', str(e))}")
    return {"success_count": success_count, "failed_count": failed_count, "errors": errors}



def cancel(db: Session, submission_id: int, user: User) -> None:
    submission = db.query(TimetableSubmission).filter(TimetableSubmission.id == submission_id).first()
    if not submission:
        raise HTTPException(404, "Submission not found")
    if submission.teacher_id != user.id and user.role.value not in ("admin", "system_admin"):
        raise HTTPException(403, "Not authorized to cancel this submission")
    if submission.status != TimetableSubmissionStatus.pending:
        raise HTTPException(400, "Can only cancel pending submissions")
    db.delete(submission)
    db.commit()

