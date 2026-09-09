from pydantic import BaseModel, field_validator
from app.schemas.user import UserOut
from app.models.system_setting import CAMPUS_OPERATIONS_MODES as VALID_MODES


class CandidateMetrics(BaseModel):
    daily_periods: int = 0
    projected_daily_periods: int = 0
    weekly_periods: int = 0
    projected_weekly_periods: int = 0
    substitutions_last_7_days: int = 0
    longest_continuous_before: int = 0
    longest_continuous_after: int = 0


class CandidateSignals(BaseModel):
    same_department: bool = False
    same_subject: bool = False
    cross_department: bool = False


class IneligibleCandidate(BaseModel):
    teacher_id: int
    teacher_name: str
    reason: str


class RecommendationOut(BaseModel):
    """Authoritative ranked candidate recommendation with calibrated suitability score (0-100),
    tier (EXCELLENT, GOOD, FAIR, LOW), structured metrics, and explainability reasons."""
    rank: int = 1
    teacher: UserOut
    score: int
    tier: str = "GOOD"
    eligible: bool = True
    metrics: CandidateMetrics = CandidateMetrics()
    signals: CandidateSignals = CandidateSignals()
    reasons: list[str] = []

    # Legacy flat accessors for backward compatibility
    today_workload: int = 0
    projected_today_workload: int = 0
    today_periods: list[int] = []
    week_workload: int = 0
    projected_week_workload: int = 0
    substitutions_today: int = 0
    substitutions_week: int = 0
    longest_continuous_periods: int = 0
    projected_longest_continuous_periods: int = 0
    workload_count: int = 0
    fairness: float = 0.0
    leave_recovery: float = 0.0
    leave_recovery_reason: str | None = None
    compatibility_score: float | None = None

    model_config = {"from_attributes": True}


class SubstitutionCandidatesResponse(BaseModel):
    leave_id: int
    affected_date: str
    day_order: int
    period_number: int
    subject_id: int | None = None
    subject_name: str | None = None
    recommendations: list[RecommendationOut] = []
    ineligible_candidates: list[IneligibleCandidate] = []



class CampusOperationsModeOut(BaseModel):
    mode: str
    configured_mode: str | None = None
    global_override: str | None = None
    is_overridden: bool | None = None


class CampusOperationsModeSet(BaseModel):
    mode: str | None = None
    global_override: str | None = None

    @field_validator("mode")
    @classmethod
    def validate_mode(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_MODES:
            raise ValueError(f"mode must be one of {sorted(VALID_MODES)}")
        return v

    @field_validator("global_override")
    @classmethod
    def validate_override(cls, v: str | None) -> str | None:
        if v is not None and v not in {"none", "manual", "assisted", "autonomous"}:
            raise ValueError("global_override must be one of ['none', 'manual', 'assisted', 'autonomous']")
        return v


class SubstitutionPreferenceOut(BaseModel):
    teacher_id: int
    accept_auto_assignments: bool
    allow_emergency_assignments: bool
    max_weekly_substitutions: int | None
    prefer_morning_classes: bool
    prefer_same_department: bool
    only_my_classes: bool

    model_config = {"from_attributes": True}


class SubstitutionPreferenceUpdate(BaseModel):
    accept_auto_assignments: bool | None = None
    allow_emergency_assignments: bool | None = None
    max_weekly_substitutions: int | None = None
    prefer_morning_classes: bool | None = None
    prefer_same_department: bool | None = None
    only_my_classes: bool | None = None

    @field_validator("max_weekly_substitutions")
    @classmethod
    def validate_cap(cls, v: int | None) -> int | None:
        if v is not None and v < 0:
            raise ValueError("max_weekly_substitutions cannot be negative")
        return v


from datetime import date

class DepartmentAnalyticsSummary(BaseModel):
    department_id: int
    department_name: str
    department_code: str | None
    mode: str
    teacher_self_management_enabled: bool
    active_leaves_count: int
    covered_leaves_count: int
    teachers_on_leave_today_count: int | None = None
    leave_periods_today_count: int | None = None
    covered_periods_today_count: int | None = None
    pending_coverage_today_count: int | None = None

class SystemAnalyticsOut(BaseModel):
    total_departments: int
    total_registered_users: int
    active_leaves_today: int
    covered_leaves_today: int
    pending_leaves_today: int
    overall_coverage_rate: float
    recent_transactions_count: int
    auto_assigned_percentage: float
    department_summaries: list[DepartmentAnalyticsSummary]
    teachers_on_leave_today: int | None = None
    leave_periods_today: int | None = None
    covered_periods_today: int | None = None
    pending_coverage_today: int | None = None

class DryRunRequest(BaseModel):
    department_id: int | None = None
    start_date: date
    end_date: date

class SimulatedAssignmentDetail(BaseModel):
    date: date
    period_number: int
    leave_teacher_name: str
    substitute_teacher_name: str | None
    compatibility_score: float | None
    status: str  # "success" or "failed"
    reason: str | None

class DryRunResponse(BaseModel):
    leaves_processed: int
    simulated_successful_assignments: int
    simulated_failed_assignments: int
    estimated_credit_transactions: int
    simulated_assignments: list[SimulatedAssignmentDetail]

class BulkConfigSet(BaseModel):
    department_ids: list[int]
    mode: str | None = None
    teacher_self_management_enabled: bool | None = None

    @field_validator("mode")
    @classmethod
    def validate_mode(cls, v: str | None) -> str | None:
        if v is not None and v not in {"manual", "assisted", "autonomous"}:
            raise ValueError("mode must be one of ['manual', 'assisted', 'autonomous']")
        return v
