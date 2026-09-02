from pydantic import BaseModel, field_validator
from datetime import datetime
from app.models.room import RoomType


class RoomCreate(BaseModel):
    room_number: str
    room_type: RoomType = RoomType.classroom
    capacity: int
    department_id: int | None = None

    @field_validator("capacity")
    @classmethod
    def validate_capacity(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("capacity must be positive")
        return v


class RoomUpdate(BaseModel):
    room_number: str | None = None
    room_type: RoomType | None = None
    capacity: int | None = None
    department_id: int | None = None


class RoomOut(BaseModel):
    id: int
    room_number: str
    room_type: RoomType
    capacity: int
    department_id: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


class RoomAvailabilityOut(BaseModel):
    room_id: int
    room_number: str
    room_type: RoomType
    is_available: bool


class BulkRoomCreate(BaseModel):
    prefix: str = "Room "
    start_num: int
    end_num: int
    pad_digits: int = 0
    room_type: RoomType = RoomType.classroom
    capacity: int = 60
    department_id: int | None = None

    @field_validator("capacity")
    @classmethod
    def validate_capacity(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("capacity must be positive")
        return v


class BulkRoomCreateOut(BaseModel):
    created_count: int
    skipped_count: int
    message: str

