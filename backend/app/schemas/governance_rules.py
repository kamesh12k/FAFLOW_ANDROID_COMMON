"""
Pydantic schemas for the Business Rules & Period Config Control Plane API.
"""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, field_validator, model_validator


# ─────────────────────────────────────────────────────────────────────────────
# Period Config
# ─────────────────────────────────────────────────────────────────────────────

class PeriodConfigOut(BaseModel):
    period_number: int
    name: str
    start_time: str
    end_time: str
    is_break: bool
    is_enabled: bool
    sort_order: int
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class PeriodConfigUpdate(BaseModel):
    period_number: int
    name: str
    start_time: str  # "HH:MM"
    end_time: str    # "HH:MM"
    is_break: bool = False
    is_enabled: bool = True
    sort_order: int

    @field_validator("start_time", "end_time")
    @classmethod
    def validate_time_format(cls, v: str) -> str:
        parts = v.strip().split(":")
        if len(parts) != 2:
            raise ValueError("Time must be in HH:MM format")
        h, m = parts
        if not (h.isdigit() and m.isdigit()):
            raise ValueError("Time must be in HH:MM format with numeric parts")
        if not (0 <= int(h) <= 23 and 0 <= int(m) <= 59):
            raise ValueError("Time out of range: hour 0-23, minute 0-59")
        return f"{int(h):02d}:{int(m):02d}"


class PeriodsUpdateRequest(BaseModel):
    periods: List[PeriodConfigUpdate]


# ─────────────────────────────────────────────────────────────────────────────
# Business Rule
# ─────────────────────────────────────────────────────────────────────────────

class BusinessRuleHistoryOut(BaseModel):
    id: int
    rule_key: str
    version: int
    old_value: Optional[str] = None
    new_value: str
    reason: str
    changed_by_id: Optional[int] = None
    changed_by_name: Optional[str] = None
    changed_at: datetime

    model_config = {"from_attributes": True}


class BusinessRuleOut(BaseModel):
    key: str
    category: str
    display_name: str
    description: str
    value: str
    data_type: str
    unit: Optional[str] = None
    minimum: Optional[float] = None
    maximum: Optional[float] = None
    default_value: str
    is_enabled: bool
    affected_modules: List[str] = []
    severity: str
    security_critical: bool
    requires_restart: bool
    version: int
    updated_at: Optional[datetime] = None
    updated_by_id: Optional[int] = None
    is_modified: bool = False  # True when value != default_value

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def parse_affected_modules(cls, data: Any) -> Any:
        if hasattr(data, "__dict__"):
            # SQLAlchemy model — convert to dict-like
            obj = data
            affected_raw = getattr(obj, "affected_modules", "[]") or "[]"
            try:
                modules = json.loads(affected_raw) if isinstance(affected_raw, str) else affected_raw
            except (json.JSONDecodeError, TypeError):
                modules = []
            is_mod = (getattr(obj, "value", None) != getattr(obj, "default_value", None))
            return {
                "key": obj.key,
                "category": obj.category,
                "display_name": obj.display_name,
                "description": obj.description,
                "value": obj.value,
                "data_type": obj.data_type,
                "unit": obj.unit,
                "minimum": obj.minimum,
                "maximum": obj.maximum,
                "default_value": obj.default_value,
                "is_enabled": obj.is_enabled,
                "affected_modules": modules,
                "severity": obj.severity,
                "security_critical": obj.security_critical,
                "requires_restart": obj.requires_restart,
                "version": obj.version,
                "updated_at": obj.updated_at,
                "updated_by_id": obj.updated_by_id,
                "is_modified": is_mod,
            }
        return data


class BusinessRuleUpdateRequest(BaseModel):
    value: str
    reason: str

    @field_validator("reason")
    @classmethod
    def reason_min_length(cls, v: str) -> str:
        if not v or len(v.strip()) < 5:
            raise ValueError("Reason must be at least 5 characters")
        return v.strip()


class ValidateRuleRequest(BaseModel):
    key: str
    value: str


class ValidateRuleResponse(BaseModel):
    valid: bool
    key: Optional[str] = None
    display_name: Optional[str] = None
    current_value: Optional[str] = None
    new_value: Optional[str] = None
    data_type: Optional[str] = None
    unit: Optional[str] = None
    affected_modules: List[str] = []
    severity: Optional[str] = None
    security_critical: Optional[bool] = None
    requires_restart: Optional[bool] = None
    is_modified_from_default: Optional[bool] = None
    error: Optional[str] = None


class ResetRuleRequest(BaseModel):
    reason: str = "Reset to factory default"


class RollbackRuleRequest(BaseModel):
    reason: str = "Rollback to previous version"


# ─────────────────────────────────────────────────────────────────────────────
# Public Config (Android / Web)
# ─────────────────────────────────────────────────────────────────────────────

class PeriodEntry(BaseModel):
    period_number: int
    start_time: str
    end_time: str
    label: str


class PublicGovernanceConfigOut(BaseModel):
    period_schedule: List[PeriodEntry]
    suggestion_lead_time_minutes: int
    suggestion_start_window_minutes: int
    suggestion_expiration_window_minutes: int
    current_period_tolerance_minutes: int
    student_attendance_submission_window_minutes: int
    periods_per_day: int
    day_order_max: int
