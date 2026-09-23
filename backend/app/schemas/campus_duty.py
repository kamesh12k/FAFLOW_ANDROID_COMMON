from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import date, time, datetime


class CampusAreaBase(BaseModel):
    name: str
    code: str
    duty_type: str = "WING_DUTY"
    building_or_block: Optional[str] = None
    floor: Optional[str] = None
    required_teachers: int = 1
    department_id: Optional[int] = None
    is_active: bool = True


class CampusAreaCreate(CampusAreaBase):
    pass


class CampusAreaUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    duty_type: Optional[str] = None
    building_or_block: Optional[str] = None
    floor: Optional[str] = None
    required_teachers: Optional[int] = None
    department_id: Optional[int] = None
    is_active: Optional[bool] = None


class CampusAreaOut(CampusAreaBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DutyBreakPeriodBase(BaseModel):
    name: str
    start_time: time
    end_time: time
    duty_type: str = "DISCIPLINE_DUTY"
    required_teachers: int = 3
    min_teachers: int = 1
    max_teachers: int = 10
    preceding_period_number: Optional[int] = None
    applicable_day_orders: str = "1,2,3,4,5,6"
    department_id: Optional[int] = None
    is_active: bool = True


class DutyBreakPeriodCreate(DutyBreakPeriodBase):
    pass


class DutyBreakPeriodUpdate(BaseModel):
    name: Optional[str] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    duty_type: Optional[str] = None
    required_teachers: Optional[int] = None
    min_teachers: Optional[int] = None
    max_teachers: Optional[int] = None
    preceding_period_number: Optional[int] = None
    applicable_day_orders: Optional[str] = None
    department_id: Optional[int] = None
    is_active: Optional[bool] = None


class DutyBreakPeriodOut(DutyBreakPeriodBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DutyAssignmentOut(BaseModel):
    id: int
    duty_id: int
    teacher_id: int
    teacher_name: str
    teacher_department: Optional[str] = None
    status: str
    role: str
    is_manual: bool = False
    is_locked: bool = False
    selection_reason: Optional[List[str]] = None
    score: Optional[float] = None
    overridden_by_user_id: Optional[int] = None
    overridden_reason: Optional[str] = None
    replacement_reason: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CampusDutyCreate(BaseModel):
    duty_type: str  # DISCIPLINE_DUTY, WING_DUTY, EXAM_DUTY, SPECIAL_DUTY
    title: str
    duty_date: date
    start_time: time
    end_time: time
    break_period_id: Optional[int] = None
    area_id: Optional[int] = None
    room_id: Optional[int] = None
    department_id: Optional[int] = None
    day_order: Optional[int] = None
    required_teachers: int = 1


class CampusDutyUpdate(BaseModel):
    title: Optional[str] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    area_id: Optional[int] = None
    room_id: Optional[int] = None
    required_teachers: Optional[int] = None
    status: Optional[str] = None


class CampusDutyOut(BaseModel):
    id: int
    duty_type: str
    title: str
    duty_date: date
    start_time: time
    end_time: time
    break_period_id: Optional[int] = None
    break_period_name: Optional[str] = None
    area_id: Optional[int] = None
    area_name: Optional[str] = None
    area_code: Optional[str] = None
    room_id: Optional[int] = None
    room_number: Optional[str] = None
    room_name: Optional[str] = None
    location_hierarchy: Optional[str] = None
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    day_order: Optional[int] = None
    required_teachers: int
    assigned_teachers_count: int = 0
    status: str
    is_locked: bool
    locked_by_name: Optional[str] = None
    locked_at: Optional[datetime] = None
    lock_reason: Optional[str] = None
    assignments: List[DutyAssignmentOut] = []
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DutyGenerateRequest(BaseModel):
    target_date: date
    department_id: Optional[int] = None


class WingDutyGenerateRequest(BaseModel):
    target_date: date
    start_time: time = time(9, 30)
    end_time: time = time(16, 30)
    block_ids: Optional[List[int]] = None
    department_id: Optional[int] = None
    required_teachers_per_wing: int = 1


class ExamDutyGenerateRequest(BaseModel):
    target_date: date
    start_time: time = time(10, 0)
    end_time: time = time(13, 0)
    title: str = "Semester Examination"
    block_ids: Optional[List[int]] = None
    floor_ids: Optional[List[int]] = None
    department_id: Optional[int] = None


class DutyAutoAssignRequest(BaseModel):
    duty_id: Optional[int] = None
    target_date: Optional[date] = None
    department_id: Optional[int] = None


class DutyManualAssignRequest(BaseModel):
    teacher_id: int
    role: str = "GENERAL"


class DutyOverrideRequest(BaseModel):
    new_teacher_id: int
    reason: str


class DutyLockRequest(BaseModel):
    lock: bool = True
    reason: Optional[str] = None


class DutyReplaceRequest(BaseModel):
    reason: str


class DutyCandidateOut(BaseModel):
    teacher_id: int
    teacher_name: str
    department_name: Optional[str] = None
    score: float
    is_eligible: bool
    free_before_break: bool = False
    present_today: bool = True
    duties_today: int = 0
    duties_this_week: int = 0
    reasons: List[str] = []
    exclusion_reason: Optional[str] = None


class DutyCandidatesResponse(BaseModel):
    duty_id: int
    duty_title: str
    duty_type: str
    required_teachers: int
    assigned_count: int
    candidates: List[DutyCandidateOut] = []


class DutyDashboardMetricsOut(BaseModel):
    total_duties_today: int = 0
    filled_duties_today: int = 0
    unfilled_duties_today: int = 0
    teachers_assigned_today: int = 0
    locked_duties_today: int = 0
    replacements_needed_today: int = 0
    discipline_coverage_pct: float = 100.0
    wing_coverage_pct: float = 100.0
    exam_coverage_pct: float = 100.0


class DutyTimelineItemOut(BaseModel):
    time_label: str
    start_time: time
    end_time: time
    duties: List[CampusDutyOut] = []


class DutyRulesOut(BaseModel):
    max_discipline_teachers: int = 3
    safe_min_discipline_teachers: int = 1
    safe_max_discipline_teachers: int = 10
    default_daily_duty_limit: int = 1
    safe_min_daily_duty_limit: int = 1
    safe_max_daily_duty_limit: int = 3
    default_weekly_duty_limit: int = 3
    safe_min_weekly_duty_limit: int = 1
    safe_max_weekly_duty_limit: int = 10
    prefer_free_before_break: bool = True
    auto_assignment_enabled: bool = True
    auto_replacement_enabled: bool = True
    cross_department_assignment: bool = False
    max_exam_duties: int = 5


class DutyRulesUpdate(BaseModel):
    max_discipline_teachers: Optional[int] = None
    default_daily_duty_limit: Optional[int] = None
    default_weekly_duty_limit: Optional[int] = None
    prefer_free_before_break: Optional[bool] = None
    auto_assignment_enabled: Optional[bool] = None
    auto_replacement_enabled: Optional[bool] = None
    cross_department_assignment: Optional[bool] = None
    max_exam_duties: Optional[int] = None


class DutyRulesImpactPreview(BaseModel):
    rule_name: str
    old_value: Any
    new_value: Any
    impact_explanation: str
    affects_future: bool = True
    affects_existing_unlocked: bool = False
    affects_existing_locked: bool = False


# ── Autonomous Duty Activation ───────────────────────────────────────────────

class DayOrderSummary(BaseModel):
    date: str
    day_order: Optional[int] = None
    discipline_duties: int = 0
    wing_duties: int = 0
    total_duties: int = 0
    assigned: int = 0
    unfilled: int = 0


class AutonomousDutyActivateRequest(BaseModel):
    start_date: Optional[date] = None  # first date of the 6-day-order window
    target_date: Optional[date] = None  # legacy alias
    activate_discipline: bool = True
    activate_wing: bool = True
    num_day_orders: int = 6


class AutonomousDutyActivateResponse(BaseModel):
    success: bool
    start_date: str
    schedule_from: str
    schedule_to: str
    num_day_orders: int
    discipline_duties_count: int
    wing_duties_count: int
    total_duties_active: int
    total_assigned: int
    total_unfilled: int
    per_day_order: List[DayOrderSummary] = []
    message: str


class Next6DayOrderItem(BaseModel):
    date: str
    day_order: Optional[int] = None
    day_name: str
    formatted_date: str
    total_duties: int = 0
    filled_duties: int = 0
    unfilled_duties: int = 0
    is_today: bool = False


class Next6DayOrdersResponse(BaseModel):
    autonomous_enabled: bool = False
    start_date: str
    day_orders: List[Next6DayOrderItem] = []


class AutonomousDutyToggleRequest(BaseModel):
    enabled: bool
    start_date: Optional[date] = None
    num_day_orders: int = 6
    activate_discipline: bool = True
    activate_wing: bool = True


# ── Auto-Replace Absent Teachers ─────────────────────────────────────────────

class AutoReplaceRequest(BaseModel):
    target_date: Optional[date] = None  # defaults to today


class AutoReplaceResult(BaseModel):
    duty_id: int
    duty_title: str
    replaced_teacher_name: str
    new_teacher_name: str
    reason: str


class AutoReplaceResponse(BaseModel):
    target_date: str
    replacements_made: int
    unfilled_after: int
    results: List[AutoReplaceResult] = []
    message: str
