from pydantic import BaseModel, field_validator
from datetime import date, datetime
from typing import Optional, List, Dict, Any


class StaffLeaveApply(BaseModel):
    start_date: date
    end_date: date
    leave_type: str = "casual"  # casual, medical, earned, on_duty, compensatory_off, other
    is_half_day: bool = False
    half_day_session: Optional[str] = None  # 'forenoon', 'afternoon'
    reason: str

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Reason must be at least 3 characters")
        return v


class StaffLeaveApproval(BaseModel):
    approval_remarks: Optional[str] = None


class StaffLeaveOut(BaseModel):
    id: int
    staff_id: int
    staff_name: str
    employee_code: str
    category: str
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    start_date: date
    end_date: date
    leave_type: str
    is_half_day: bool
    half_day_session: Optional[str] = None
    days_count: float
    reason: str
    status: str  # pending, approved, rejected, cancelled
    approved_by_id: Optional[int] = None
    approved_by_name: Optional[str] = None
    approval_remarks: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class StaffCreditOut(BaseModel):
    staff_id: int
    staff_name: str
    employee_code: str
    category: str
    designation: str
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    annual_quota: float = 12.0
    balance: float
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class StaffCreditAdjust(BaseModel):
    staff_id: int
    change: float  # e.g. +1.0 for overtime/special duty, -1.0 for penalty/adjustment
    category: str = "manual_adjustment"  # overtime_duty, lab_maintenance_duty, exam_support_duty, manual_adjustment
    reason: str

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Adjustment reason is required")
        return v


class StaffQuotaUpdate(BaseModel):
    staff_id: int
    annual_quota: float
    adjust_balance: bool = True
    reason: Optional[str] = "Annual leave quota limit updated"


class StaffLedgerTransactionOut(BaseModel):
    id: int
    staff_id: int
    staff_name: Optional[str] = None
    change: float
    balance_after: float
    category: str
    reason: str
    related_leave_id: Optional[int] = None
    created_by_user_id: Optional[int] = None
    created_by_name: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class StaffLedgerSummary(BaseModel):
    staff_id: int
    staff_name: str
    employee_code: str
    category: str
    department_name: Optional[str] = None
    annual_quota: float = 12.0
    current_balance: float
    total_leaves_taken: float
    total_credits_earned: float
    transactions: List[StaffLedgerTransactionOut] = []

