from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class AttendanceCheckInRequest(BaseModel):
    idempotency_key: str = Field(..., description="Unique client-generated UUID for deduplication")
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    accuracy_meters: float = Field(..., ge=0.0, le=100.0)
    face_similarity_score: float = Field(..., ge=0.0, le=1.0)
    liveness_verified: bool = Field(..., description="On-device liveness / PAD verification outcome")
    verification_method: str = Field(default="FACE_ON_DEVICE")
    device_reference: Optional[str] = Field(None, max_length=100)
    captured_at: Optional[datetime] = None


class AttendanceCheckOutRequest(BaseModel):
    idempotency_key: str = Field(..., description="Unique client-generated UUID for deduplication")
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    accuracy_meters: float = Field(..., ge=0.0, le=100.0)
    face_similarity_score: float = Field(..., ge=0.0, le=1.0)
    liveness_verified: bool = Field(..., description="On-device liveness / PAD verification outcome")
    verification_method: str = Field(default="FACE_ON_DEVICE")
    device_reference: Optional[str] = Field(None, max_length=100)
    captured_at: Optional[datetime] = None


class AttendanceRecordOut(BaseModel):
    id: int
    user_id: int
    staff_name: Optional[str] = None
    attendance_date: date
    check_in_time: Optional[datetime] = None
    check_out_time: Optional[datetime] = None
    status: str
    check_in_geofence_name: Optional[str] = None
    check_out_geofence_name: Optional[str] = None
    face_similarity_score: Optional[float] = None
    liveness_verified: bool
    verification_method: str
    working_hours: Optional[str] = None
    is_synced: bool = True

    class Config:
        from_attributes = True


class AttendanceTodaySummaryOut(BaseModel):
    is_checked_in: bool
    is_checked_out: bool
    check_in_time: Optional[datetime] = None
    check_out_time: Optional[datetime] = None
    working_duration: Optional[str] = None
    record: Optional[AttendanceRecordOut] = None


class AttendanceSupervisorLiveStatusOut(BaseModel):
    total_staff: int
    checked_in_count: int
    checked_out_count: int
    absent_count: int
    active_shifts: List[AttendanceRecordOut]
    anomalies_count: int = 0
