package com.governence.faflow.core.network

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

// ---------- Auth DTOs ----------

@JsonClass(generateAdapter = true)
data class UserLoginRequestDto(
    @Json(name = "identifier") val identifier: String,
    @Json(name = "password") val password: String
)

@JsonClass(generateAdapter = true)
data class UserOutDto(
    @Json(name = "id") val id: Int,
    @Json(name = "name") val name: String,
    @Json(name = "email") val email: String?,
    @Json(name = "username") val username: String?,
    @Json(name = "role") val role: String,
    @Json(name = "department") val department: String?,
    @Json(name = "department_id") val departmentId: Int?,
    @Json(name = "must_change_credentials") val mustChangeCredentials: Boolean = false,
    @Json(name = "is_active") val isActive: Boolean = true,
    @Json(name = "created_at") val createdAt: String? = null
)

@JsonClass(generateAdapter = true)
data class TokenDto(
    @Json(name = "access_token") val accessToken: String,
    @Json(name = "token_type") val tokenType: String = "bearer",
    @Json(name = "user") val user: UserOutDto
)

// ---------- Academic Calendar & Day Order DTOs ----------

@JsonClass(generateAdapter = true)
data class DayOrderResolveDto(
    @Json(name = "date") val date: String,
    @Json(name = "day_order") val dayOrder: Int?,
    @Json(name = "day_type") val dayType: String,
    @Json(name = "blocks_operations") val blocksOperations: Boolean
)

@JsonClass(generateAdapter = true)
data class TeacherTodaySummaryDto(
    @Json(name = "date") val date: String,
    @Json(name = "day_order") val dayOrder: Int?,
    @Json(name = "day_type") val dayType: String,
    @Json(name = "blocks_operations") val blocksOperations: Boolean = false,
    @Json(name = "is_on_leave") val isOnLeave: Boolean = false,
    @Json(name = "leave_periods") val leavePeriods: List<Int> = emptyList(),
    @Json(name = "substitute_duties_today") val substituteDutiesToday: List<SubstituteDutyDto> = emptyList()
)

@JsonClass(generateAdapter = true)
data class SubstituteDutyDto(
    @Json(name = "period_number") val periodNumber: Int,
    @Json(name = "class_name") val className: String?,
    @Json(name = "covering_for_name") val coveringForName: String?
)

// ---------- Timetable DTOs ----------

@JsonClass(generateAdapter = true)
data class TimetableSlotOutDto(
    @Json(name = "id") val id: Int,
    @Json(name = "teacher_id") val teacherId: Int,
    @Json(name = "subject_id") val subjectId: Int?,
    @Json(name = "class_id") val classId: Int,
    @Json(name = "room_id") val roomId: Int?,
    @Json(name = "day_order") val dayOrder: Int,
    @Json(name = "period_number") val periodNumber: Int,
    @Json(name = "subject_name") val subjectName: String? = null,
    @Json(name = "subject_code") val subjectCode: String? = null,
    @Json(name = "class_name") val className: String? = null,
    @Json(name = "class_section") val classSection: String? = null,
    @Json(name = "room_number") val roomNumber: String? = null
)

// ---------- Leave DTOs ----------

@JsonClass(generateAdapter = true)
data class LeaveCreateDto(
    @Json(name = "date") val date: String,
    @Json(name = "period_number") val periodNumber: Int,
    @Json(name = "reason") val reason: String
)

@JsonClass(generateAdapter = true)
data class LeaveBatchCreateDto(
    @Json(name = "date") val date: String,
    @Json(name = "period_numbers") val periodNumbers: List<Int>,
    @Json(name = "reason") val reason: String
)

@JsonClass(generateAdapter = true)
data class LeaveOutDto(
    @Json(name = "id") val id: Int,
    @Json(name = "teacher_id") val teacherId: Int,
    @Json(name = "date") val date: String,
    @Json(name = "day_order") val dayOrder: Int,
    @Json(name = "period_number") val periodNumber: Int,
    @Json(name = "reason") val reason: String,
    @Json(name = "status") val status: String,
    @Json(name = "is_emergency") val isEmergency: Boolean = false,
    @Json(name = "teacher_name") val teacherName: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "alter_assignment") val alterAssignment: AlterAssignmentOutDto? = null
)

@JsonClass(generateAdapter = true)
data class AlterAssignmentOutDto(
    @Json(name = "id") val id: Int,
    @Json(name = "leave_request_id") val leaveRequestId: Int,
    @Json(name = "substitute_teacher_id") val substituteTeacherId: Int,
    @Json(name = "substitute_name") val substituteName: String? = null,
    @Json(name = "assignment_type") val assignmentType: String = "admin_assigned",
    @Json(name = "compatibility_score") val compatibilityScore: Float? = null,
    @Json(name = "is_locked") val isLocked: Boolean = false
)

// ---------- Credits DTOs ----------

@JsonClass(generateAdapter = true)
data class CreditBalanceOutDto(
    @Json(name = "teacher_id") val teacherId: Int,
    @Json(name = "balance") val balance: Int
)

@JsonClass(generateAdapter = true)
data class CreditTransactionOutDto(
    @Json(name = "id") val id: Int,
    @Json(name = "teacher_id") val teacherId: Int,
    @Json(name = "teacher_name") val teacherName: String? = null,
    @Json(name = "change") val change: Int,
    @Json(name = "reason") val reason: String,
    @Json(name = "category") val category: String? = "other",
    @Json(name = "related_leave_id") val relatedLeaveId: Int? = null,
    @Json(name = "created_at") val createdAt: String
)

// ---------- Substitution DTOs ----------

@JsonClass(generateAdapter = true)
data class RecommendationOutDto(
    @Json(name = "teacher_id") val teacherId: Int,
    @Json(name = "teacher_name") val teacherName: String,
    @Json(name = "department") val department: String?,
    @Json(name = "compatibility_score") val compatibilityScore: Float,
    @Json(name = "reason") val reason: String? = null
)

@JsonClass(generateAdapter = true)
data class SubstitutionPreferenceOutDto(
    @Json(name = "teacher_id") val teacherId: Int,
    @Json(name = "max_substitutions_per_day") val maxSubstitutionsPerDay: Int = 2,
    @Json(name = "max_substitutions_per_week") val maxSubstitutionsPerWeek: Int = 6,
    @Json(name = "willing_for_cross_department") val willingForCrossDepartment: Boolean = false
)

@JsonClass(generateAdapter = true)
data class SubstitutionPreferenceUpdateDto(
    @Json(name = "max_substitutions_per_day") val maxSubstitutionsPerDay: Int? = null,
    @Json(name = "max_substitutions_per_week") val maxSubstitutionsPerWeek: Int? = null,
    @Json(name = "willing_for_cross_department") val willingForCrossDepartment: Boolean? = null
)

// ---------- Notifications DTOs ----------

@JsonClass(generateAdapter = true)
data class NotificationOutDto(
    @Json(name = "id") val id: Int,
    @Json(name = "title") val title: String,
    @Json(name = "body") val body: String,
    @Json(name = "event_type") val eventType: String? = null,
    @Json(name = "related_leave_id") val relatedLeaveId: Int? = null,
    @Json(name = "is_read") val isRead: Boolean = false,
    @Json(name = "created_at") val createdAt: String
)

@JsonClass(generateAdapter = true)
data class UnreadCountDto(
    @Json(name = "count") val count: Int
)

@JsonClass(generateAdapter = true)
data class StatusOkDto(
    @Json(name = "ok") val ok: Boolean = true
)

// ---------- Attendance DTOs ----------

@JsonClass(generateAdapter = true)
data class AttendanceCheckInRequestDto(
    @Json(name = "idempotency_key") val idempotencyKey: String,
    @Json(name = "latitude") val latitude: Double,
    @Json(name = "longitude") val longitude: Double,
    @Json(name = "accuracy_meters") val accuracyMeters: Double,
    @Json(name = "face_similarity_score") val faceSimilarityScore: Double,
    @Json(name = "liveness_verified") val livenessVerified: Boolean,
    @Json(name = "verification_method") val verificationMethod: String = "FACE_ON_DEVICE",
    @Json(name = "device_reference") val deviceReference: String? = null
)

@JsonClass(generateAdapter = true)
data class AttendanceCheckOutRequestDto(
    @Json(name = "idempotency_key") val idempotencyKey: String,
    @Json(name = "latitude") val latitude: Double,
    @Json(name = "longitude") val longitude: Double,
    @Json(name = "accuracy_meters") val accuracyMeters: Double,
    @Json(name = "face_similarity_score") val faceSimilarityScore: Double,
    @Json(name = "liveness_verified") val livenessVerified: Boolean,
    @Json(name = "verification_method") val verificationMethod: String = "FACE_ON_DEVICE",
    @Json(name = "device_reference") val deviceReference: String? = null
)

@JsonClass(generateAdapter = true)
data class AttendanceRecordOutDto(
    @Json(name = "id") val id: Int,
    @Json(name = "user_id") val userId: Int,
    @Json(name = "staff_name") val staffName: String? = null,
    @Json(name = "attendance_date") val attendanceDate: String,
    @Json(name = "check_in_time") val checkInTime: String? = null,
    @Json(name = "check_out_time") val checkOutTime: String? = null,
    @Json(name = "status") val status: String,
    @Json(name = "check_in_geofence_name") val checkInGeofenceName: String? = null,
    @Json(name = "check_out_geofence_name") val checkOutGeofenceName: String? = null,
    @Json(name = "face_similarity_score") val faceSimilarityScore: Double? = null,
    @Json(name = "liveness_verified") val livenessVerified: Boolean = false,
    @Json(name = "verification_method") val verificationMethod: String = "FACE_ON_DEVICE",
    @Json(name = "working_hours") val workingHours: String? = null,
    @Json(name = "is_synced") val isSynced: Boolean = true
)

@JsonClass(generateAdapter = true)
data class AttendanceTodaySummaryOutDto(
    @Json(name = "is_checked_in") val isCheckedIn: Boolean = false,
    @Json(name = "is_checked_out") val isCheckedOut: Boolean = false,
    @Json(name = "check_in_time") val checkInTime: String? = null,
    @Json(name = "check_out_time") val checkOutTime: String? = null,
    @Json(name = "working_duration") val workingDuration: String? = null,
    @Json(name = "record") val record: AttendanceRecordOutDto? = null
)

// ---------- Geofence DTOs ----------

@JsonClass(generateAdapter = true)
data class GeofenceOutDto(
    @Json(name = "id") val id: Int,
    @Json(name = "name") val name: String,
    @Json(name = "description") val description: String? = null,
    @Json(name = "type") val type: String = "circle",
    @Json(name = "center_latitude") val centerLatitude: Double,
    @Json(name = "center_longitude") val centerLongitude: Double,
    @Json(name = "radius_meters") val radiusMeters: Double = 150.0,
    @Json(name = "polygon_vertices") val polygonVertices: List<List<Double>>? = null,
    @Json(name = "tolerance_meters") val toleranceMeters: Double = 15.0,
    @Json(name = "area_sq_meters") val areaSqMeters: Double? = null,
    @Json(name = "perimeter_meters") val perimeterMeters: Double? = null,
    @Json(name = "is_active") val isActive: Boolean = true,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "updated_at") val updatedAt: String? = null
)

@JsonClass(generateAdapter = true)
data class GeofenceCreateDto(
    @Json(name = "name") val name: String,
    @Json(name = "description") val description: String? = null,
    @Json(name = "type") val type: String = "circle",
    @Json(name = "center_latitude") val centerLatitude: Double? = null,
    @Json(name = "center_longitude") val centerLongitude: Double? = null,
    @Json(name = "radius_meters") val radiusMeters: Double? = null,
    @Json(name = "polygon_vertices") val polygonVertices: List<List<Double>>? = null,
    @Json(name = "tolerance_meters") val toleranceMeters: Double = 15.0
)

@JsonClass(generateAdapter = true)
data class GeofenceUpdateDto(
    @Json(name = "name") val name: String? = null,
    @Json(name = "description") val description: String? = null,
    @Json(name = "center_latitude") val centerLatitude: Double? = null,
    @Json(name = "center_longitude") val centerLongitude: Double? = null,
    @Json(name = "radius_meters") val radiusMeters: Double? = null,
    @Json(name = "polygon_vertices") val polygonVertices: List<List<Double>>? = null,
    @Json(name = "tolerance_meters") val toleranceMeters: Double? = null,
    @Json(name = "is_active") val isActive: Boolean? = null
)

// ---------- Supervisor Live Status DTOs ----------

@JsonClass(generateAdapter = true)
data class SupervisorLiveStatusOutDto(
    @Json(name = "date") val date: String,
    @Json(name = "total_staff") val totalStaff: Int,
    @Json(name = "present_count") val presentCount: Int,
    @Json(name = "absent_count") val absentCount: Int,
    @Json(name = "currently_active_count") val currentlyActiveCount: Int,
    @Json(name = "checked_out_count") val checkedOutCount: Int,
    @Json(name = "records") val records: List<AttendanceRecordOutDto> = emptyList()
)
