from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import List, Optional, Dict, Any


class LeavePolicyOut(BaseModel):
    id: int
    code: str
    name: str
    description: Optional[str] = None
    entitlement: float
    period: str
    monthly_limit: Optional[float] = None
    semester_limit: Optional[float] = None
    annual_limit: Optional[float] = None
    approval_required: bool = True
    document_required: bool = False
    is_on_duty: bool = False
    is_active: bool = True

    model_config = {"from_attributes": True}


class TeacherPolicyBalanceOut(BaseModel):
    policy_id: int
    code: str
    name: str
    description: Optional[str] = None
    period: str
    entitlement: float
    consumed: float
    remaining: float
    monthly_limit: Optional[float] = None
    monthly_consumed: float = 0.0
    monthly_remaining: Optional[float] = None
    semester_limit: Optional[float] = None
    approval_required: bool = True
    document_required: bool = False
    is_on_duty: bool = False


class LeaveValidationRequest(BaseModel):
    policy_id: Optional[int] = None
    policy_code: Optional[str] = None
    date: date
    whole_day: bool = False
    period_numbers: Optional[List[int]] = None


class LeaveValidationOut(BaseModel):
    leave_policy: Dict[str, Any]
    balance: Dict[str, Any]
    request: Dict[str, Any]
    projected_balance: float
    monthly_policy: Dict[str, Any]
    semester_policy: Optional[Dict[str, Any]] = None
    policy: Dict[str, Any]
    validation: Dict[str, Any]


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
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    substitution_credits: int = 0
    balances: List[TeacherPolicyBalanceOut] = []


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
