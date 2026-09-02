from pydantic import BaseModel, field_validator
from datetime import datetime


class ClassCreate(BaseModel):
    name: str
    section: str
    department_id: int
    semester: int
    default_room_id: int | None = None

    @field_validator("semester")
    @classmethod
    def validate_semester(cls, v: int) -> int:
        if not (1 <= v <= 8):
            raise ValueError("semester must be between 1 and 8")
        return v


class ClassUpdate(BaseModel):
    name: str | None = None
    section: str | None = None
    department_id: int | None = None
    semester: int | None = None
    default_room_id: int | None = None


class ClassOut(BaseModel):
    id: int
    name: str
    section: str
    department_id: int
    semester: int
    default_room_id: int | None = None
    default_room_number: str | None = None
    default_room_type: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class BulkClassCreate(BaseModel):
    mode: str = "numeric_range"  # "numeric_range" or "section_range"
    name_prefix: str = "Year "
    start_num: int = 1
    end_num: int = 4
    section: str = "A"
    start_section: str = "A"
    end_section: str = "D"
    department_id: int
    semester: int = 1
    default_room_id: int | None = None
    auto_increment_semester: bool = True

    @field_validator("semester")
    @classmethod
    def validate_semester(cls, v: int) -> int:
        if not (1 <= v <= 8):
            raise ValueError("semester must be between 1 and 8")
        return v


class BulkClassCreateOut(BaseModel):
    created_count: int
    skipped_count: int
    message: str

