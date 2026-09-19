from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import date, datetime, time
from app.models.student_attendance import AttendanceType, SessionStatus, StudentAttendanceStatus


class StudentOut(BaseModel):
    id: int
    roll_number: str
    roll_suffix: str
    name: str
    class_id: int
    department_id: int
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class ClassRosterOut(BaseModel):
    class_id: int
    class_name: str
    section: str
    department_id: int
    department_name: Optional[str] = None
    total_students: int
    students: List[StudentOut]


class StudentStatusException(BaseModel):
    roll_suffix: str
    status: StudentAttendanceStatus # late, on_duty, leave, medical


class StudentAttendanceRecordOut(BaseModel):
    id: int
    student_id: int
    student_roll: str
    student_suffix: str
    student_name: str
    status: StudentAttendanceStatus
    marked_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class AttendanceSessionOut(BaseModel):
    id: int
    attendance_date: date
    period_number: int
    day_order: Optional[int] = None
    class_id: int
    class_name: str
    section: str
    subject_id: Optional[int] = None
    subject_name: Optional[str] = None
    scheduled_teacher_id: Optional[int] = None
    scheduled_teacher_name: Optional[str] = None
    actual_teacher_id: int
    actual_teacher_name: str
    attendance_type: AttendanceType
    status: SessionStatus
    scheduled_start_time: Optional[datetime] = None
    scheduled_end_time: Optional[datetime] = None
    submitted_at: Optional[datetime] = None
    correction_deadline: Optional[datetime] = None
    total_students: int
    present_count: int
    absent_count: int
    late_count: int
    on_duty_count: int
    leave_count: int
    medical_count: int
    records: List[StudentAttendanceRecordOut] = []

    model_config = ConfigDict(from_attributes=True)


class TeacherClassSlotOut(BaseModel):
    timetable_slot_id: Optional[int] = None
    period_number: int
    period_time: str
    class_id: int
    class_name: str
    section: str
    subject_id: Optional[int] = None
    subject_name: Optional[str] = None
    room_number: Optional[str] = None
    is_substitution: bool = False
    scheduled_teacher_name: Optional[str] = None
    substitution_id: Optional[int] = None
    session_id: Optional[int] = None
    session_status: Optional[SessionStatus] = None


class TeacherTodayAttendanceOut(BaseModel):
    date: date
    day_order: Optional[int] = None
    is_blocked_date: bool = False
    block_reason: Optional[str] = None
    current_period: Optional[int] = None
    scheduled_classes: List[TeacherClassSlotOut] = []
    substitutions: List[TeacherClassSlotOut] = []
    all_active_classes: List[Dict[str, Any]] = [] # For emergency any-class picker


class CreateAttendanceSessionRequest(BaseModel):
    class_id: Optional[int] = None
    period_number: Optional[int] = None
    timetable_slot_id: Optional[int] = None
    subject_id: Optional[int] = None
    attendance_date: Optional[date] = None
    substitution_id: Optional[int] = None
    attendance_type: Optional[AttendanceType] = None


class SubmitAttendanceRequest(BaseModel):
    class_id: Optional[int] = None
    period_number: Optional[int] = None
    attendance_date: Optional[date] = None
    timetable_slot_id: Optional[int] = None
    substitution_id: Optional[int] = None
    absent_roll_suffixes: List[str] = []
    exceptions: Optional[List[StudentStatusException]] = None
    student_exceptions: Optional[List[Dict[str, Any]]] = None
    idempotency_key: Optional[str] = None
    device_id: Optional[str] = None
    client_timestamp: Optional[datetime] = None


class EmergencyAttendanceRequest(BaseModel):
    class_id: int
    period_number: int
    attendance_date: Optional[date] = None
    subject_id: Optional[int] = None
    absent_roll_suffixes: List[str] = []
    exceptions: Optional[List[StudentStatusException]] = None
    student_exceptions: Optional[List[Dict[str, Any]]] = None
    idempotency_key: Optional[str] = None
    device_id: Optional[str] = None
    notes: Optional[str] = None


class AttendanceCorrectionRequest(BaseModel):
    new_status: StudentAttendanceStatus
    reason: Optional[str] = None
    device_id: Optional[str] = None


class OfflineSyncOperation(BaseModel):
    operation_id: str
    idempotency_key: str
    operation_type: str  # SUBMIT_ATTENDANCE, EMERGENCY_ATTENDANCE, CORRECTION
    payload: Dict[str, Any]
    device_id: Optional[str] = None
    client_timestamp: Optional[datetime] = None


class OfflineSyncBatchRequest(BaseModel):
    device_id: Optional[str] = None
    operations: List[OfflineSyncOperation]


class SyncOperationResult(BaseModel):
    operation_id: str
    idempotency_key: str
    success: bool
    session_id: Optional[int] = None
    message: str
    status: Optional[str] = None


class OfflineSyncBatchResponse(BaseModel):
    synced_count: int
    failed_count: int
    results: List[SyncOperationResult]


class HodClassAttendanceSummaryOut(BaseModel):
    class_id: int
    class_name: str
    section: str
    department_name: str
    period_number: int
    session_id: Optional[int] = None
    session_status: Optional[SessionStatus] = None
    attendance_type: Optional[AttendanceType] = None
    scheduled_teacher: Optional[str] = None
    actual_teacher: Optional[str] = None
    present_count: int = 0
    absent_count: int = 0
    total_students: int = 0
    percentage: float = 0.0
    is_late_submission: bool = False
    is_emergency: bool = False


class HodAttendanceExceptionOut(BaseModel):
    session_id: int
    attendance_date: date
    period_number: int
    class_name: str
    section: str
    scheduled_teacher: Optional[str] = None
    actual_teacher: str
    exception_type: str  # "LATE_SUBMISSION", "MISSED_SUBMISSION", "EMERGENCY"
    details: str
    timestamp: datetime


class HodAttendanceOverviewOut(BaseModel):
    date: date
    day_order: Optional[int] = None
    total_classes: int
    submitted_count: int
    pending_count: int
    late_count: int
    emergency_count: int
    student_attendance_percentage: float
    classes: List[HodClassAttendanceSummaryOut]
    exceptions: List[HodAttendanceExceptionOut]


# ==========================================
# PRINCIPAL MONITORING & GOVERNANCE SCHEMAS
# ==========================================

class PrincipalDepartmentSummaryOut(BaseModel):
    department_id: int
    department_name: str
    department_code: str
    classes_count: int
    total_scheduled_sessions: int
    submitted_sessions: int
    pending_sessions: int
    late_sessions: int
    emergency_sessions: int
    student_attendance_percentage: float
    total_students: int
    hod_name: Optional[str] = None


class PrincipalAttendanceOverviewOut(BaseModel):
    date: date
    day_order: Optional[int] = None
    is_blocked_date: bool = False
    block_reason: Optional[str] = None
    total_scheduled_sessions: int
    submitted_sessions: int
    pending_sessions: int
    late_sessions: int
    emergency_sessions: int
    missed_sessions: int
    cancelled_sessions: int
    overall_attendance_percentage: float
    total_students_enrolled: int
    present_students_count: int
    absent_students_count: int
    on_duty_students_count: int
    leave_students_count: int
    medical_students_count: int
    late_students_count: int
    departments: List[PrincipalDepartmentSummaryOut]


class PrincipalSessionItemOut(BaseModel):
    session_id: Optional[int] = None
    attendance_date: date
    period_number: int
    period_time: str
    day_order: Optional[int] = None
    class_id: int
    class_name: str
    section: str
    department_id: int
    department_name: str
    department_code: str
    subject_id: Optional[int] = None
    subject_name: Optional[str] = None
    subject_code: Optional[str] = None
    scheduled_teacher_id: Optional[int] = None
    scheduled_teacher_name: Optional[str] = None
    actual_teacher_id: Optional[int] = None
    actual_teacher_name: Optional[str] = None
    is_substitution: Optional[bool] = False
    substitution_id: Optional[int] = None
    attendance_type: Optional[AttendanceType] = None
    status: SessionStatus
    scheduled_start_time: Optional[datetime] = None
    scheduled_end_time: Optional[datetime] = None
    submitted_at: Optional[datetime] = None
    is_late_submission: bool = False
    is_emergency: bool = False
    total_students: int = 0
    present_count: int = 0
    absent_count: int = 0
    late_count: int = 0
    on_duty_count: int = 0
    leave_count: int = 0
    medical_count: int = 0
    attendance_percentage: float = 0.0


class ClassPeriodSlotInfo(BaseModel):
    period_number: int
    period_time: str
    subject_name: Optional[str] = None
    scheduled_teacher: Optional[str] = None
    actual_teacher: Optional[str] = None
    status: SessionStatus
    attendance_type: Optional[AttendanceType] = None


class ClassStudentMatrixRowOut(BaseModel):
    student_id: int
    roll_number: str
    roll_suffix: str
    name: str
    period_marks: Dict[str, str]  # "1" -> "PRESENT", etc.
    day_attended: int
    day_eligible: int
    day_percentage: float
    cumulative_attended: int
    cumulative_eligible: int
    cumulative_percentage: float
    is_shortage: bool = False


class ClassPeriodMatrixOut(BaseModel):
    class_id: int
    class_name: str
    section: str
    department_id: int
    department_name: str
    date: date
    day_order: Optional[int] = None
    total_students: int
    scheduled_periods: List[ClassPeriodSlotInfo]
    students: List[ClassStudentMatrixRowOut]


class StudentSubjectAttendanceOut(BaseModel):
    subject_id: Optional[int] = None
    subject_name: str
    subject_code: Optional[str] = None
    eligible_sessions: int
    attended_sessions: int
    absent_sessions: int
    late_sessions: int
    od_sessions: int
    percentage: float
    is_shortage: bool = False


class StudentSessionHistoryItemOut(BaseModel):
    session_id: int
    date: date
    period_number: int
    subject_name: Optional[str] = None
    teacher_name: str
    status: StudentAttendanceStatus
    marked_at: Optional[datetime] = None


class StudentProfileAttendanceOut(BaseModel):
    student_id: int
    roll_number: str
    roll_suffix: str
    name: str
    class_id: int
    class_name: str
    section: str
    department_id: int
    department_name: str
    total_eligible_sessions: int
    attended_sessions: int
    absent_sessions: int
    late_sessions: int
    on_duty_sessions: int
    leave_sessions: int
    medical_sessions: int
    overall_percentage: float
    is_shortage: bool = False
    subjects: List[StudentSubjectAttendanceOut]
    history: List[StudentSessionHistoryItemOut]


class TeacherComplianceItemOut(BaseModel):
    teacher_id: int
    teacher_name: str
    department_id: int
    department_name: str
    scheduled_sessions_today: int
    submitted_on_time_count: int
    submitted_late_count: int
    missed_count: int
    emergency_count: int
    compliance_percentage: float
    sessions: List[Dict[str, Any]] = []


class PrincipalExceptionItemOut(BaseModel):
    session_id: Optional[int] = None
    student_id: Optional[int] = None
    attendance_date: date
    period_number: Optional[int] = None
    class_id: Optional[int] = None
    class_name: str
    section: str
    department_name: str
    scheduled_teacher: Optional[str] = None
    actual_teacher: Optional[str] = None
    student_name: Optional[str] = None
    student_roll: Optional[str] = None
    exception_type: str  # "LATE_SUBMISSION", "MISSED_SUBMISSION", "EMERGENCY", "HIGH_ABSENTEEISM", "STUDENT_SHORTAGE", "SPECIAL_DUTY"
    details: str
    attendance_percentage: Optional[float] = None
    timestamp: datetime


class AdminAttendanceOverrideRequest(BaseModel):
    new_status: StudentAttendanceStatus
    reason: str
    device_id: Optional[str] = None


class AdminSessionLockRequest(BaseModel):
    locked: bool
    reason: Optional[str] = None
