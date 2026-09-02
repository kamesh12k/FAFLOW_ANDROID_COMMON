from pydantic import BaseModel, field_validator
from datetime import datetime
from app.models.subject import SubjectType


class SubjectCreate(BaseModel):
    code: str
    name: str
    subject_type: SubjectType = SubjectType.theory
    credits: int = 1
    department_id: int
    semester: int

    @field_validator("credits")
    @classmethod
    def validate_credits(cls, v: int) -> int:
        if v is not None and v <= 0:
            raise ValueError("credits must be positive")
        return v or 1

    @field_validator("semester")
    @classmethod
    def validate_semester(cls, v: int) -> int:
        if not (1 <= v <= 8):
            raise ValueError("semester must be between 1 and 8")
        return v


class SubjectUpdate(BaseModel):
    name: str | None = None
    subject_type: SubjectType | None = None
    credits: int | None = None
    department_id: int | None = None
    semester: int | None = None


class SubjectOut(BaseModel):
    id: int
    code: str
    name: str
    subject_type: SubjectType
    credits: int
    department_id: int
    semester: int
    is_archived: bool
    created_at: datetime

    model_config = {"from_attributes": True}
