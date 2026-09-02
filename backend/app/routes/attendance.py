from typing import List
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.attendance import (
    AttendanceCheckInRequest,
    AttendanceCheckOutRequest,
    AttendanceRecordOut,
    AttendanceTodaySummaryOut,
    AttendanceSupervisorLiveStatusOut
)
from app.services.attendance_service import AttendanceService

router = APIRouter(prefix="/attendance", tags=["Staff Attendance"])


@router.post("/check-in", response_model=AttendanceRecordOut, status_code=status.HTTP_200_OK)
def check_in(
    data: AttendanceCheckInRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Processes staff shift check-in with server-side geofence and biometric metadata verification."""
    return AttendanceService.check_in(db, current_user, data)


@router.post("/check-out", response_model=AttendanceRecordOut, status_code=status.HTTP_200_OK)
def check_out(
    data: AttendanceCheckOutRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Processes staff shift check-out with server-side geofence verification."""
    return AttendanceService.check_out(db, current_user, data)


@router.get("/today", response_model=AttendanceTodaySummaryOut)
def get_today_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns the authenticated staff member's shift status for today."""
    return AttendanceService.get_today_summary(db, current_user.id)


@router.get("/my", response_model=List[AttendanceRecordOut])
def get_my_attendance_history(
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieves paginated attendance history for the authenticated staff member."""
    return AttendanceService.list_my_history(db, current_user.id, limit=limit, offset=offset)


@router.get("/admin/live-status", response_model=AttendanceSupervisorLiveStatusOut)
def get_supervisor_live_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Supervisor/HOD endpoint for real-time institutional staff shift and presence tracking."""
    return AttendanceService.get_supervisor_live_status(db, current_user)
