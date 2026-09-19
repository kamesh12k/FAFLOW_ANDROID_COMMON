from pydantic import BaseModel, field_validator
from datetime import datetime
from app.schemas.user import UserOut
from app.schemas.validators import validate_period_number, validate_day_order


class TimetableSlotCreate(BaseModel):
    teacher_id: int
    subject_id: int | None = None
    class_id: int
    room_id: int | None = None
    day_order: int
    period_number: int
    allow_combined_class: bool = False

    @field_validator("day_order")
    @classmethod
    def validate_day_order_field(cls, v: int) -> int:
        return validate_day_order(v)

    @field_validator("period_number")
    @classmethod
    def validate_period_field(cls, v: int) -> int:
        return validate_period_number(v)


class TimetableSlotOut(BaseModel):
    id: int
    teacher_id: int
    subject_id: int | None
    class_id: int
    room_id: int | None
    day_order: int
    period_number: int

    # Enriched display fields resolved from relations — avoids N+1 list fetches on frontend
    subject_name: str | None = None
    subject_code: str | None = None
    class_name: str | None = None
    class_section: str | None = None
    room_number: str | None = None

    model_config = {"from_attributes": False}

    @classmethod
    def from_orm_slot(cls, slot: object) -> "TimetableSlotOut":
        """Construct from a TimetableSlot ORM instance, resolving relation names."""
        return cls(
            id=slot.id,
            teacher_id=slot.teacher_id,
            subject_id=slot.subject_id,
            class_id=slot.class_id,
            room_id=slot.room_id,
            day_order=slot.day_order,
            period_number=slot.period_number,
            subject_name=slot.subject.name if slot.subject else None,
            subject_code=slot.subject.code if slot.subject else None,
            class_name=slot.class_.name if slot.class_ else None,
            class_section=slot.class_.section if slot.class_ else None,
            room_number=slot.room.room_number if slot.room else None,
        )


class BulkTimetableCreate(BaseModel):
    slots: list[TimetableSlotCreate]


class TimetableSubmissionCreate(BaseModel):
    subject_id: int | None = None
    class_id: int
    room_id: int | None = None
    day_order: int
    period_number: int
    allow_combined_class: bool = False


    @field_validator("day_order")
    @classmethod
    def validate_day_order_field(cls, v: int) -> int:
        return validate_day_order(v)

    @field_validator("period_number")
    @classmethod
    def validate_period_field(cls, v: int) -> int:
        return validate_period_number(v)


class TimetableSubmissionReview(BaseModel):
    approved: bool
    review_note: str | None = None


class BulkTimetableSubmissionReview(BaseModel):
    submission_ids: list[int]
    approved: bool



class TimetableSubmissionOut(BaseModel):
    id: int
    teacher_id: int
    subject_id: int | None
    class_id: int
    room_id: int | None
    day_order: int
    period_number: int
    status: str
    review_note: str | None
    reviewed_by_id: int | None
    created_at: datetime
    reviewed_at: datetime | None

    model_config = {"from_attributes": True}


class TimetableResetScope(str):
    all = "all"
    department = "department"
    teachers = "teachers"


class TimetableResetRequest(BaseModel):
    scope: str  # "all" | "department" | "teachers"
    department_id: int | None = None
    teacher_ids: list[int] | None = None
    clear_submissions: bool = False


class TimetableResetResponse(BaseModel):
    deleted_slots_count: int
    deleted_submissions_count: int = 0
    scope: str
    target_summary: str
    message: str
