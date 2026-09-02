from pydantic import BaseModel, field_validator, computed_field
from datetime import date, datetime
from uuid import UUID
from app.models.leave import LeaveStatus, AssignmentType
from app.schemas.user import UserOut
from app.schemas.validators import validate_period_number


class LeaveCreate(BaseModel):
    date: date
    period_number: int
    reason: str

    @field_validator("period_number")
    @classmethod
    def validate_period(cls, v: int) -> int:
        return validate_period_number(v)


class LeaveBatchCreate(BaseModel):
    """Apply for leave across multiple periods (same date) or a whole day
    in one submission. period_numbers=None + whole_day=True expands to all
    periods scheduled for the teacher that day."""
    date: date
    whole_day: bool = False
    period_numbers: list[int] | None = None
    reason: str

    @field_validator("period_numbers")
    @classmethod
    def validate_periods(cls, v: list[int] | None) -> list[int] | None:
        if v is not None:
            for p in v:
                validate_period_number(p)
        return v


class AlterAssignmentCreate(BaseModel):
    substitute_teacher_id: int
    override_substitution_limit: bool = False


class AlterAssignmentOut(BaseModel):
    id: int
    leave_request_id: int
    substitute_teacher_id: int
    assigned_at: datetime
    assignment_type: AssignmentType
    compatibility_score: float | None
    is_locked: bool
    substitute: UserOut

    model_config = {"from_attributes": True}


class LeaveOut(BaseModel):
    id: int
    teacher_id: int
    date: date
    day_order: int
    period_number: int
    reason: str
    status: LeaveStatus
    created_at: datetime
    batch_id: UUID | None
    is_emergency: bool
    teacher: UserOut
    alter_assignment: AlterAssignmentOut | None = None

    @computed_field
    @property
    def is_expired(self) -> bool:
        from app.core.timezone import is_substitution_expired
        return is_substitution_expired(self.date)

    model_config = {"from_attributes": True}


class BulkLeaveAction(BaseModel):
    leave_ids: list[int]


class OverrideSubstituteRequest(BaseModel):
    new_substitute_teacher_id: int
    override_substitution_limit: bool = False


class LockAssignmentRequest(BaseModel):
    locked: bool


class FreeTeacherOut(BaseModel):
    id: int
    name: str
    department: str | None
    today_workload: int
    today_periods: list[int]
    week_workload: int

    model_config = {"from_attributes": True}


class AdminCancelRequest(BaseModel):
    reason: str


class CancelImpactOut(BaseModel):
    """Preview of what will be affected if this leave is cancelled."""
    leave_id: int
    leave_date: date
    day_order: int
    period_number: int
    teacher_name: str
    has_substitute: bool
    substitute_name: str | None = None
    substitute_id: int | None = None
    assignment_type: str | None = None


class AdminLeaveCreate(BaseModel):
    teacher_id: int
    date: date
    whole_day: bool = False
    period_numbers: list[int] | None = None
    reason: str
    notes: str | None = None

    @field_validator("period_numbers")
    @classmethod
    def validate_periods(cls, v: list[int] | None) -> list[int] | None:
        if v is not None:
            for p in v:
                validate_period_number(p)
        return v


