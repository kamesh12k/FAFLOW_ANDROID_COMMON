from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import List, Optional, Dict, Any


class LeavePolicyOut(BaseModel):
    id: int
    code: str
    name: str
    description: Optional[str] = None
    entitlement: float
    entitlement_days: float = 0.0
    period: str
    entitlement_period: str = "YEAR"
    monthly_limit: Optional[float] = None
    max_per_month: Optional[int] = None
    semester_limit: Optional[float] = None
    annual_limit: Optional[float] = None
    approval_required: bool = True
    document_required: bool = False
    requires_document: bool = False
    is_on_duty: bool = False
    is_active: bool = True
    advisory_allowed: Optional[str] = "ADVISORY"

    model_config = {"from_attributes": True}


class LeavePolicyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    entitlement: Optional[float] = None
    period: Optional[str] = None
    monthly_limit: Optional[float] = None
    semester_limit: Optional[float] = None
    approval_required: Optional[bool] = None
    document_required: Optional[bool] = None
    is_on_duty: Optional[bool] = None
    is_active: Optional[bool] = None
    advisory_allowed: Optional[str] = None


class TeacherPolicyBalanceOut(BaseModel):
    id: int = 0
    policy_id: int
    code: str
    policy_code: str = ""
    name: str
    policy_name: str = ""
    description: Optional[str] = None
    period: str
    entitlement: float
    consumed: float
    pending: float = 0.0
    remaining: float
    monthly_limit: Optional[float] = None
    max_per_month: Optional[int] = None
    monthly_consumed: float = 0.0
    monthly_remaining: Optional[float] = None
    semester_limit: Optional[float] = None
    approval_required: bool = True
    document_required: bool = False
    requires_document: bool = False
    is_on_duty: bool = False

    model_config = {"from_attributes": True}


class LeaveValidationRequest(BaseModel):
    policy_id: Optional[int] = None
    policy_code: Optional[str] = None
    date: date
    whole_day: bool = False
    period_numbers: Optional[List[int]] = None
    days: Optional[float] = 1.0
    consecutive_days: Optional[int] = 1


class LeaveValidationOut(BaseModel):
    # Top-level attributes for Android DTO compatibility
    allowed: bool = True
    message: Optional[str] = None
    policy_code: str = ""
    policy_name: str = ""
    remaining_before: float = 0.0
    projected_remaining: float = 0.0
    monthly_limit_reached: bool = False
    requires_document: bool = False
    enforcement_mode: str = "STRICT"
    requires_warning: bool = False
    violations: List[Dict[str, Any]] = []

    # Nested structures for Web UI compatibility
    leave_policy: Dict[str, Any] = {}
    balance: Dict[str, Any] = {}
    request: Dict[str, Any] = {}
    projected_balance: float = 0.0
    monthly_policy: Dict[str, Any] = {}
    semester_policy: Optional[Dict[str, Any]] = None
    policy: Dict[str, Any] = {}
    validation: Dict[str, Any] = {}


class LeaveBalanceTransactionOut(BaseModel):
    id: int
    teacher_id: int
    leave_policy_id: int
    policy_code: str
    policy_name: str
    transaction_type: str
    days: float
    balance_before: float
    balance_after: float
    reason: str
    leave_request_id: Optional[int] = None
    created_by_name: Optional[str] = None
    created_at: datetime


class TeacherLeaveBalanceSummaryOut(BaseModel):
    teacher_id: int
    teacher_name: str
    department: Optional[str] = None
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    academic_year: str = ""
    substitution_credits: int = 0
    substitution_credit_balance: int = 0
    balances: List[TeacherPolicyBalanceOut] = []
    total_entitled: float = 0.0
    total_consumed: float = 0.0
    total_remaining: float = 0.0

    model_config = {"from_attributes": True}


class DepartmentLeaveBalanceOverviewOut(BaseModel):
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    total_staff: int
    staff_summaries: List[TeacherLeaveBalanceSummaryOut]
    policies: List[LeavePolicyOut]


class AdminBalanceAdjustRequest(BaseModel):
    policy_id: int
    change: float = Field(..., description="Positive or negative days adjustment, e.g. +2.0 or -1.0")
    reason: str = Field(..., min_length=3, max_length=500, description="Mandatory reason for audit trail")
