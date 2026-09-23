from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status, Response, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User, Role
from app.schemas.student_attendance import (
    TeacherTodayAttendanceOut, ClassRosterOut, AttendanceSessionOut,
    CreateAttendanceSessionRequest, SubmitAttendanceRequest, EmergencyAttendanceRequest,
    AttendanceCorrectionRequest, OfflineSyncBatchRequest, OfflineSyncBatchResponse,
    HodAttendanceOverviewOut,
    PrincipalDepartmentSummaryOut, PrincipalAttendanceOverviewOut, PrincipalSessionItemOut,
    ClassPeriodSlotInfo, ClassStudentMatrixRowOut, ClassPeriodMatrixOut,
    StudentSubjectAttendanceOut, StudentSessionHistoryItemOut, StudentProfileAttendanceOut,
    TeacherComplianceItemOut, PrincipalExceptionItemOut,
    AdminAttendanceOverrideRequest, AdminSessionLockRequest,
    LiveAbsenteesOverviewOut, ClassEodAttendanceOut
)
from app.services.student_attendance_service import StudentAttendanceService

router = APIRouter(prefix="/student-attendance", tags=["Student Attendance"])


@router.get("/today", response_model=TeacherTodayAttendanceOut, status_code=status.HTTP_200_OK)
def get_teacher_today_attendance(
    target_date: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieves teacher's timetable classes, substitution duties, and institutional class directory for emergency attendance."""
    t_date = target_date if target_date else date.today()
    return StudentAttendanceService.get_today_teacher_schedule(db, current_user, t_date)


@router.get("/classes/{class_id}/roster", response_model=ClassRosterOut, status_code=status.HTTP_200_OK)
def get_class_roster(
    class_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns active student roster for a class with roll numbers and 3-digit roll suffixes."""
    return StudentAttendanceService.resolve_class_roster(db, class_id)


@router.get("/sessions/{id}", response_model=AttendanceSessionOut, status_code=status.HTTP_200_OK)
def get_session_details(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns full details of an attendance session including student-level marks and compliance status."""
    return StudentAttendanceService.get_session_details(db, id)


@router.post("/sessions", response_model=AttendanceSessionOut, status_code=status.HTTP_201_CREATED)
def create_or_get_session(
    data: CreateAttendanceSessionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Initializes or retrieves an active attendance session for a class period."""
    return StudentAttendanceService.create_or_get_session(db, current_user, data)


@router.post("/sessions/{id}/submit", response_model=AttendanceSessionOut, status_code=status.HTTP_200_OK)
def submit_attendance_by_id(
    id: int,
    data: SubmitAttendanceRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Submits per-period student attendance for an existing session using 3-digit roll suffixes."""
    return StudentAttendanceService.submit_attendance_by_session_id(db, id, current_user, data)


@router.post("/sessions/submit", response_model=AttendanceSessionOut, status_code=status.HTTP_201_CREATED)
def submit_attendance(
    data: SubmitAttendanceRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Submits per-period student attendance using 3-digit absent roll suffixes with 15-minute compliance validation."""
    return StudentAttendanceService.submit_attendance(db, current_user, data)


@router.post("/emergency", response_model=AttendanceSessionOut, status_code=status.HTTP_201_CREATED)
def emergency_attendance(
    data: EmergencyAttendanceRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Autonomous emergency attendance for any class across the institution without pre-registration."""
    return StudentAttendanceService.emergency_attendance(db, current_user, data)


@router.patch("/sessions/{id}/students/{student_id}", response_model=AttendanceSessionOut, status_code=status.HTTP_200_OK)
def correct_student_attendance(
    id: int,
    student_id: int,
    data: AttendanceCorrectionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Frictionless in-window correction of student attendance without requiring HOD/Admin approval."""
    return StudentAttendanceService.correct_student_attendance(db, id, student_id, current_user, data)


@router.post("/sync", response_model=OfflineSyncBatchResponse, status_code=status.HTTP_200_OK)
def process_offline_sync(
    batch: OfflineSyncBatchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Idempotent batch synchronization endpoint for offline-queued mobile submissions and corrections."""
    return StudentAttendanceService.process_sync_batch(db, current_user, batch)


def require_hod_or_principal(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in (Role.admin, Role.system_admin, Role.principal, Role.governance, Role.manager):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="HOD or administrative access required"
        )
    return current_user


@router.get("/hod/overview", response_model=HodAttendanceOverviewOut, status_code=status.HTTP_200_OK)
def get_hod_attendance_overview(
    target_date: Optional[date] = Query(None),
    department_id: Optional[int] = Query(None),
    current_user: User = Depends(require_hod_or_principal),
    db: Session = Depends(get_db)
):
    """HOD consolidated operational view of department class attendance, percentages, late submissions, and exceptions."""
    t_date = target_date if target_date else date.today()
    return StudentAttendanceService.get_hod_overview(db, current_user, t_date, department_id=department_id)


@router.get("/absentees/live", response_model=LiveAbsenteesOverviewOut, status_code=status.HTTP_200_OK)
def get_live_student_absentees(
    target_date: Optional[date] = Query(None),
    department_id: Optional[int] = Query(None),
    current_user: User = Depends(require_hod_or_principal),
    db: Session = Depends(get_db)
):
    """Real-time live student absentees list for HOD (department-scoped) and System Admin / Principal (campus-wide / selectable department)."""
    t_date = target_date if target_date else date.today()
    return StudentAttendanceService.get_live_absentees(db, current_user, t_date, department_id=department_id)


@router.get("/classes/{class_id}/eod-summary", response_model=ClassEodAttendanceOut, status_code=status.HTTP_200_OK)
def get_class_eod_attendance_summary(
    class_id: int,
    target_date: Optional[date] = Query(None),
    current_user: User = Depends(require_hod_or_principal),
    db: Session = Depends(get_db)
):
    """End-of-day attendance audit for a class detailing full-day absentees, students who skipped classes, and latecomers."""
    t_date = target_date if target_date else date.today()
    return StudentAttendanceService.get_class_eod_attendance(db, class_id, t_date)



# =========================================================================
# PRINCIPAL MONITORING & GOVERNANCE ENDPOINTS
# =========================================================================

def require_principal_or_governance(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in (Role.principal, Role.system_admin, Role.governance, Role.admin, Role.manager):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Principal, HOD, or administrative access required"
        )
    return current_user


@router.get("/principal/overview", response_model=PrincipalAttendanceOverviewOut, status_code=status.HTTP_200_OK)
def get_principal_overview(
    target_date: Optional[date] = Query(None),
    current_user: User = Depends(require_principal_or_governance),
    db: Session = Depends(get_db)
):
    """Institutional macro attendance dashboard aggregating all departments, scheduled classes, submissions, and attendance rates."""
    t_date = target_date if target_date else date.today()
    return StudentAttendanceService.get_principal_overview(db, t_date)


@router.get("/principal/sessions", response_model=List[PrincipalSessionItemOut], status_code=status.HTTP_200_OK)
def get_principal_sessions(
    target_date: Optional[date] = Query(None),
    department_id: Optional[int] = Query(None),
    class_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    is_late: Optional[bool] = Query(None),
    is_emergency: Optional[bool] = Query(None),
    current_user: User = Depends(require_principal_or_governance),
    db: Session = Depends(get_db)
):
    """Institution-wide period-by-period class session monitoring grid with department, class, and compliance filters."""
    t_date = target_date if target_date else date.today()
    return StudentAttendanceService.get_principal_sessions(
        db=db,
        target_date=t_date,
        department_id=department_id,
        class_id=class_id,
        status_filter=status,
        type_filter=type,
        is_late=is_late,
        is_emergency=is_emergency
    )


@router.get("/principal/classes/{class_id}/matrix", response_model=ClassPeriodMatrixOut, status_code=status.HTTP_200_OK)
def get_class_period_matrix(
    class_id: int,
    target_date: Optional[date] = Query(None),
    current_user: User = Depends(require_principal_or_governance),
    db: Session = Depends(get_db)
):
    """Complete student-by-period class attendance matrix for a date with conducted-only percentage calculations."""
    t_date = target_date if target_date else date.today()
    return StudentAttendanceService.get_class_period_matrix(db, class_id, t_date)


@router.get("/principal/students/{student_id}", response_model=StudentProfileAttendanceOut, status_code=status.HTTP_200_OK)
def get_student_attendance_profile(
    student_id: int,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    current_user: User = Depends(require_principal_or_governance),
    db: Session = Depends(get_db)
):
    """Individual student profile drill-down showing overall attendance, subject breakdowns, session history, and shortage flags."""
    return StudentAttendanceService.get_student_attendance_profile(db, student_id, start_date, end_date)


@router.get("/principal/teacher-compliance", response_model=List[TeacherComplianceItemOut], status_code=status.HTTP_200_OK)
def get_teacher_submission_compliance(
    target_date: Optional[date] = Query(None),
    department_id: Optional[int] = Query(None),
    current_user: User = Depends(require_principal_or_governance),
    db: Session = Depends(get_db)
):
    """Institutional teacher submission compliance engine tracking on-time, late, missed, and emergency teaching sessions."""
    t_date = target_date if target_date else date.today()
    return StudentAttendanceService.get_teacher_compliance(db, t_date, department_id)


@router.get("/principal/exceptions", response_model=List[PrincipalExceptionItemOut], status_code=status.HTTP_200_OK)
def get_principal_exceptions(
    target_date: Optional[date] = Query(None),
    type: Optional[str] = Query(None),
    department_id: Optional[int] = Query(None),
    current_user: User = Depends(require_principal_or_governance),
    db: Session = Depends(get_db)
):
    """Institutional attendance exception detector (late submissions, missed classes, emergency sessions, shortage list, absenteeism)."""
    t_date = target_date if target_date else date.today()
    return StudentAttendanceService.get_principal_exceptions(db, t_date, type, department_id)


@router.patch("/principal/sessions/{id}/lock", response_model=AttendanceSessionOut, status_code=status.HTTP_200_OK)
@router.post("/principal/sessions/{id}/lock", response_model=AttendanceSessionOut, status_code=status.HTTP_200_OK)
def admin_toggle_session_lock(
    id: int,
    data: AdminSessionLockRequest,
    current_user: User = Depends(require_principal_or_governance),
    db: Session = Depends(get_db)
):
    """Administrative lock or unlock override for attendance sessions with audit logging."""
    return StudentAttendanceService.admin_toggle_session_lock(db, id, current_user, data)


@router.patch("/principal/sessions/{id}/students/{student_id}", response_model=AttendanceSessionOut, status_code=status.HTTP_200_OK)
@router.post("/principal/sessions/{id}/students/{student_id}", response_model=AttendanceSessionOut, status_code=status.HTTP_200_OK)
@router.patch("/principal/sessions/{id}/students/{student_id}/override", response_model=AttendanceSessionOut, status_code=status.HTTP_200_OK)
@router.post("/principal/sessions/{id}/students/{student_id}/override", response_model=AttendanceSessionOut, status_code=status.HTTP_200_OK)
def admin_override_student_attendance(
    id: int,
    student_id: int,
    data: AdminAttendanceOverrideRequest,
    current_user: User = Depends(require_principal_or_governance),
    db: Session = Depends(get_db)
):
    """Authorized administrative correction override with mandatory justification and audit trail."""
    return StudentAttendanceService.admin_override_student_attendance(db, id, student_id, current_user, data)


@router.get("/principal/export", status_code=status.HTTP_200_OK)
def export_attendance_report(
    report_type: str = Query("daily_summary"),
    target_date: Optional[date] = Query(None),
    department_id: Optional[int] = Query(None),
    current_user: User = Depends(require_principal_or_governance),
    db: Session = Depends(get_db)
):
    """Direct CSV report export for daily summary, shortage list, teacher compliance, and class sessions."""
    t_date = target_date if target_date else date.today()
    csv_content = StudentAttendanceService.export_attendance_report_csv(db, report_type, t_date, department_id)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=faflow_attendance_{report_type}_{t_date}.csv"}
    )
