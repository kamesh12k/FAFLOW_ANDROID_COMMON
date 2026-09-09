from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import require_admin, require_teacher, get_current_user, get_tenant_department_id, require_credentials_set

from app.models.user import User
from app.schemas.timetable import (
    TimetableSlotCreate,
    TimetableSlotOut,
    BulkTimetableCreate,
    TimetableSubmissionCreate,
    TimetableSubmissionReview,
    BulkTimetableSubmissionReview,
    TimetableSubmissionOut,
    TimetableResetRequest,
    TimetableResetResponse,
)
from app.services import timetable_service

router = APIRouter(prefix="/timetable", tags=["Timetable"])


@router.post("/submissions", response_model=TimetableSubmissionOut, status_code=201)
def submit_my_timetable_entry(data: TimetableSubmissionCreate, teacher: User = Depends(require_teacher), db: Session = Depends(get_db)):
    from app.services import timetable_submission_service
    return timetable_submission_service.submit(db, teacher, data)


@router.get("/submissions/my", response_model=list[TimetableSubmissionOut])
def my_timetable_submissions(teacher: User = Depends(require_teacher), db: Session = Depends(get_db)):
    from app.services import timetable_submission_service
    return timetable_submission_service.list_for_teacher(db, teacher.id)


@router.get("/submissions/pending", response_model=list[TimetableSubmissionOut])
def pending_timetable_submissions(admin: User = Depends(require_admin), db: Session = Depends(get_db), tenant_department_id: int | None = Depends(get_tenant_department_id)):
    from app.services import timetable_submission_service
    return timetable_submission_service.list_pending(db, tenant_department_id)


@router.post("/submissions/{submission_id}/review", response_model=TimetableSubmissionOut)
def review_timetable_submission(submission_id: int, data: TimetableSubmissionReview, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    from app.services import timetable_submission_service
    return timetable_submission_service.review(db, submission_id, admin, data.approved, data.review_note)


@router.post("/submissions/bulk-review")
def bulk_review_timetable_submissions(data: BulkTimetableSubmissionReview, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    from app.services import timetable_submission_service
    return timetable_submission_service.bulk_review(db, data.submission_ids, admin, data.approved)



@router.delete("/submissions/{submission_id}", status_code=204)
def cancel_timetable_submission(submission_id: int, user: User = Depends(require_credentials_set), db: Session = Depends(get_db)):
    from app.services import timetable_submission_service
    timetable_submission_service.cancel(db, submission_id, user)



@router.post("/slot", response_model=TimetableSlotOut, status_code=201)
def create_slot(
    data: TimetableSlotCreate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    return timetable_service.create_slot(data, db, tenant_department_id)


@router.post("/", response_model=list[TimetableSlotOut], status_code=201)
def upload_timetable(
    data: BulkTimetableCreate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    return timetable_service.bulk_upload(data.slots, db, tenant_department_id)


@router.get("/", response_model=list[TimetableSlotOut])
def get_timetable(
    class_id: int | None = None,
    teacher_id: int | None = None,
    department_id: int | None = None,
    day_order: int | None = None,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    """Query timetable slots by class, teacher, department, or day order."""
    return timetable_service.list_slots(
        db=db,
        class_id=class_id,
        teacher_id=teacher_id,
        department_id=department_id,
        day_order=day_order,
        tenant_department_id=tenant_department_id,
    )


@router.get("/teacher/{teacher_id}", response_model=list[TimetableSlotOut])
def get_timetable_by_teacher(
    teacher_id: int,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    return timetable_service.get_by_teacher(teacher_id, db, tenant_department_id)


@router.get("/class/{class_id}", response_model=list[TimetableSlotOut])
def get_timetable_by_class(
    class_id: int,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    return timetable_service.get_by_class(class_id, db, tenant_department_id)


@router.delete("/{slot_id}", status_code=204)
def delete_slot(
    slot_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    timetable_service.delete_slot(slot_id, db, tenant_department_id)


@router.delete("/teacher/{teacher_id}", status_code=204)
def delete_teacher_timetable(
    teacher_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    timetable_service.delete_by_teacher(teacher_id, db, tenant_department_id)


@router.post("/reset", response_model=TimetableResetResponse)
def reset_timetable(
    data: TimetableResetRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    """
    Granular timetable reset:
      - scope='all' -> all teachers across the institution (System Admin only)
      - scope='department' -> all teachers in a specific department
      - scope='teachers' -> specific list of teacher IDs
    """
    return timetable_service.reset_timetable(
        data=data,
        db=db,
        actor_user=admin,
        tenant_department_id=tenant_department_id,
    )
