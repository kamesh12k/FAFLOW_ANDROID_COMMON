from pydantic import BaseModel, EmailStr, field_validator
from datetime import date, datetime
from typing import Optional, Literal, List, Dict, Any

from app.models.operational_staff import StaffCategory, EmploymentStatus, ShiftType

from app.core.security import validate_password_strength


# ── Manager Schemas (System Admin Management) ────────────────────────────────

class ManagerCreate(BaseModel):
    name: str
    username: str
    password: str
    department_id: Optional[int] = None  # None = Institution-wide Manager

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Name must be at least 2 characters long")
        return v

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        v = v.strip().lower()
        if len(v) < 3:
            raise ValueError("Username must be at least 3 characters long")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        validate_password_strength(v)
        return v


class ManagerUpdate(BaseModel):
    name: Optional[str] = None
    department_id: Optional[int] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v.strip():
            validate_password_strength(v)
            return v
        return None


class ManagerOut(BaseModel):
    id: int
    name: str
    username: Optional[str] = None
    email: Optional[str] = None
    role: str
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    is_active: bool
    must_change_credentials: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Operational Staff Schemas (Manager Management) ───────────────────────────

class OperationalStaffCreate(BaseModel):
    employee_code: str
    full_name: str
    category: StaffCategory
    designation: str
    department_id: Optional[int] = None
    assigned_room_id: Optional[int] = None
    assigned_room_ids: Optional[List[int]] = []
    phone_number: Optional[str] = None
    email: Optional[str] = None
    shift_type: ShiftType = ShiftType.general
    joining_date: Optional[date] = None
    notes: Optional[str] = None

    # Optional / enabled staff portal login account
    enable_login: bool = True
    username: Optional[str] = None
    password: Optional[str] = None

    @field_validator("employee_code")
    @classmethod
    def validate_code(cls, v: str) -> str:
        v = v.strip().upper()
        if not v:
            raise ValueError("Employee code is required")
        return v

    @field_validator("full_name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Full name must be at least 2 characters")
        return v

    @field_validator("designation")
    @classmethod
    def validate_designation(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Designation is required")
        return v


class OperationalStaffUpdate(BaseModel):
    employee_code: Optional[str] = None
    full_name: Optional[str] = None
    category: Optional[StaffCategory] = None
    designation: Optional[str] = None
    department_id: Optional[int] = None
    assigned_room_id: Optional[int] = None
    assigned_room_ids: Optional[List[int]] = None
    phone_number: Optional[str] = None
    email: Optional[str] = None
    employment_status: Optional[EmploymentStatus] = None
    shift_type: Optional[ShiftType] = None
    joining_date: Optional[date] = None
    notes: Optional[str] = None

    # Credentials update
    enable_login: Optional[bool] = None
    username: Optional[str] = None
    password: Optional[str] = None


class OperationalStaffOut(BaseModel):
    id: int
    employee_code: str
    full_name: str
    category: StaffCategory
    designation: str
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    assigned_room_id: Optional[int] = None
    assigned_room_number: Optional[str] = None
    assigned_room_type: Optional[str] = None
    assigned_room_ids: List[int] = []
    assigned_rooms: List[Dict[str, Any]] = []
    phone_number: Optional[str] = None
    email: Optional[str] = None
    employment_status: EmploymentStatus
    shift_type: ShiftType
    joining_date: Optional[date] = None
    user_id: Optional[int] = None
    username: Optional[str] = None
    has_login: bool = False
    created_by_manager_id: Optional[int] = None
    created_by_manager_name: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True




class OperationalStaffStats(BaseModel):
    total_staff: int
    total_lab_staff: int
    total_non_teaching: int
    active_staff: int
    on_leave_staff: int
    inactive_staff: int
    assigned_labs_count: int
