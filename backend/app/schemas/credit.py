from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class CreditBalanceOut(BaseModel):
    teacher_id: int
    balance: int

    model_config = {"from_attributes": True}


class CreditTransactionOut(BaseModel):
    id: int
    teacher_id: int
    change: int
    reason: str
    category: Optional[str] = "other"
    related_leave_id: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


class CreditReportEntry(BaseModel):
    teacher_id: int
    name: str
    department: str | None
    balance: int


class CreditAdjustment(BaseModel):
    teacher_id: int
    change: int
    reason: str
    category: Optional[str] = "manual_adjustment"

