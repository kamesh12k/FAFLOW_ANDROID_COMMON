from app.models.user import User, Role, AdminLevel
from app.models.department import Department
from app.models.subject import Subject, SubjectType
from app.models.class_ import Class
from app.models.room import Room, RoomType
from app.models.academic_calendar import AcademicYear, Semester
from app.models.day_order_calendar import CalendarDay, DayOrderCalendar, DayType, BLOCKING_DAY_TYPES
from app.models.timetable import TimetableSlot
from app.models.leave import LeaveRequest, AlterAssignment, LeaveStatus, AssignmentType
from app.models.credit import TeacherCredit, CreditTransaction
from app.models.notification import Notification, PushSubscription
from app.models.audit_log import AuditLog
from app.models.system_setting import SystemSetting
from app.models.substitution_preference import SubstitutionPreference
from app.models.timetable_submission import TimetableSubmission, TimetableSubmissionStatus
from app.models.operational_staff import OperationalStaff, StaffCategory, EmploymentStatus, ShiftType
from app.models.staff_leave import StaffLeaveRequest, StaffCredit, StaffCreditTransaction, StaffLeaveType, StaffLeaveStatus
from app.models.campus_geofence import CampusGeofence
from app.models.staff_attendance import StaffAttendanceRecord
from app.models.student import Student
from app.models.student_enrollment import StudentEnrollment
from app.models.class_roll_rule import ClassRollRule, ClassRollException, RollExceptionType
from app.models.student_attendance import (
    AttendanceSession, StudentAttendance, AttendanceCorrectionAudit,
    AttendanceType, SessionStatus, StudentAttendanceStatus
)
# Governance Control Plane models (Milestone 16)
from app.models.governance_control import (
    Institution, PlanDefinition, FeatureEntitlement, BiometricPolicy, SystemAuditLog,
    PlanTier, FeatureKey, FeatureStatus, InstitutionStatus, SystemAuditAction,
)
from app.models.academic_intelligence import (
    AcademicIntelligenceEvent, IntelligenceEventType, IntelligenceEventState, IntelligenceSeverity
)
from app.models.announcement import (
    Announcement, AnnouncementTarget, AnnouncementAttachment,
    AnnouncementRead, AnnouncementAcknowledgement, AnnouncementMessage,
    MessageReaction, MessageMention,
    AnnouncementType, AnnouncementPriority, AnnouncementStatus, TargetType
)
from app.models.campus_duty import (
    CampusArea, DutyBreakPeriod, CampusDuty, DutyAssignment, DutyAssignmentRun,
    DutyType, DutyStatus, AssignmentStatus
)
from app.models.governance_rule import (
    PeriodConfig, BusinessRule, BusinessRuleHistory
)


