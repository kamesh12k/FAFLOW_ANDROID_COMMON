from pydantic import BaseModel, field_validator, model_validator
from datetime import datetime
from typing import Any

from app.core.security import validate_password_strength, MIN_PASSWORD_LENGTH


class FirstLoginSetupRequest(BaseModel):
    """Clears must_change_credentials for any user still on default/temporary credentials.
    - Admins / HODs set new_username + new_password.
    - Teachers set new_email + new_password (they authenticate by email, not username).
    Exactly one of new_username or new_email must be provided based on the caller's role.
    """
    new_username: str | None = None
    new_email: str | None = None
    new_password: str
    confirm_password: str

    @field_validator("new_username")
    @classmethod
    def validate_username(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Username must be at least 3 characters long")
        if v.lower() == "admin":
            raise ValueError('Username cannot remain the default value ("admin")')
        return v

    @field_validator("new_email")
    @classmethod
    def validate_email(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip().lower()
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Please enter a valid email address")
        return v

    @model_validator(mode="after")
    def validate_passwords(self):
        if self.new_password != self.confirm_password:
            raise ValueError("Passwords do not match")
        try:
            validate_password_strength(self.new_password, forbid_default=True)
        except ValueError as e:
            raise ValueError(str(e))
        return self



class SecondaryAdminCreate(BaseModel):
    name: str
    username: str
    password: str

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Username must be at least 3 characters long")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        validate_password_strength(v)
        return v


class AdminActiveToggle(BaseModel):
    is_active: bool


class FactoryResetRequest(BaseModel):
    password: str
    confirmation_text: str

    @field_validator("confirmation_text")
    @classmethod
    def validate_confirmation(cls, v: str) -> str:
        if v != "RESET EVERYTHING":
            raise ValueError('Type exactly "RESET EVERYTHING" to confirm')
        return v


class FactoryResetResponse(BaseModel):
    message: str
    backup_file: str
    reset_at: datetime


class AuditLogOut(BaseModel):
    id: int
    actor_user_id: int | None
    actor_name: str | None = None
    action: str
    target_type: str | None
    target_id: int | None
    details: dict[str, Any] | None
    created_at: datetime

    model_config = {"from_attributes": True}


class DepartmentSummary(BaseModel):
    id: int
    name: str
    code: str | None
    teacher_count: int
    class_count: int
    pending_leaves_count: int
    leaves_today_count: int
    teachers_on_leave_today_count: int | None = None
    leave_periods_today_count: int | None = None
    pending_leave_periods_count: int | None = None
    pending_teachers_on_leave_count: int | None = None


class PrincipalOverviewOut(BaseModel):
    total_departments: int
    total_teachers: int
    total_classes: int
    total_subjects: int
    total_pending_leaves: int
    total_leaves_today: int
    departments: list[DepartmentSummary]
    teachers_on_leave_today: int | None = None
    leave_periods_today: int | None = None
    pending_leave_periods: int | None = None
    pending_teachers_on_leave: int | None = None
    overall_coverage_rate: float | None = None

