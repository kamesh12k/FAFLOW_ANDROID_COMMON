from pydantic import BaseModel, field_validator, computed_field
from datetime import date, datetime
from uuid import UUID
from app.models.leave import LeaveStatus, AssignmentType
from app.schemas.user import UserOut
from app.schemas.validators import validate_period_number


class PolicyViolationItem(BaseModel):
    rule_code: str
    severity: str  # BLOCK | WARNING | INFO
    message: str
    limit: float | None = None
    used: float | None = None
    requested: float | None = None


class PolicyEvaluationResult(BaseModel):
    compliant: bool
    mode: str  # STRICT | ADVISORY
    can_submit: bool
    requires_warning: bool
    requires_hod_review: bool
    violations: list[PolicyViolationItem] = []
    leave_policy: dict | None = None
    balance: dict | None = None
    request: dict | None = None
    projected_balance: float | None = None
    monthly_policy: dict | None = None


class LeavePolicyEvalRequest(BaseModel):
    date: date
    policy_id: int | None = None
    policy_code: str | None = None
    period_number: int | None = None
    period_numbers: list[int] | None = None
    whole_day: bool = False


class ApproveWithExceptionRequest(BaseModel):
    hod_acknowledged: bool
    exception_reason: str


class LeaveCreate(BaseModel):
    date: date
    period_number: int
    reason: str
    leave_policy_id: int | None = None
    leave_type: str | None = None
    proposed_substitute_id: int | None = None
    document_url: str | None = None
    ood_details: dict | None = None
    policy_warning_acknowledged: bool = False

    @field_validator("period_number")
    @classmethod
    def validate_period(cls, v: int) -> int:
        return validate_period_number(v)


class LeaveBatchCreate(BaseModel):
    """Apply for leave across multiple periods (same date) or a whole day
    in one submission. period_numbers=None + whole_day=True expands to all
    periods scheduled for the teacher that day.
    In Flexible mode, proposed_substitute_id sets a single substitute across
    all periods, or period_substitutes maps specific period numbers to substitutes."""
    date: date
    whole_day: bool = False
    period_numbers: list[int] | None = None
    reason: str
    leave_policy_id: int | None = None
    leave_type: str | None = None
    proposed_substitute_id: int | None = None
    period_substitutes: dict[int, int] | None = None
    document_url: str | None = None
    ood_details: dict | None = None
    policy_warning_acknowledged: bool = False

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
    leave_policy_id: int | None = None
    date: date
    day_order: int
    period_number: int
    reason: str
    status: LeaveStatus
    created_at: datetime
    consumed_at: datetime | None = None
    batch_id: UUID | None
    is_emergency: bool
    proposed_substitute_id: int | None = None
    proposed_substitute: UserOut | None = None
    document_url: str | None = None
    ood_details: dict | None = None
    policy_compliant: bool | None = None
    policy_violation: bool | None = None
    policy_enforcement_mode: str | None = None
    policy_warning_acknowledged: bool = False
    policy_warning_acknowledged_at: datetime | None = None
    policy_evaluation_snapshot: dict | None = None
    policy_version_id: int | None = None
    exception_reason: str | None = None
    exception_approved_by_id: int | None = None
    exception_approved_at: datetime | None = None
    teacher: UserOut
    alter_assignment: AlterAssignmentOut | None = None

    @computed_field
    @property
    def leave_policy_code(self) -> str | None:
        if hasattr(self, 'leave_policy') and self.leave_policy:
            return self.leave_policy.code
        return None

    @computed_field
    @property
    def leave_policy_name(self) -> str | None:
        if hasattr(self, 'leave_policy') and self.leave_policy:
            return self.leave_policy.name
        return None

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


