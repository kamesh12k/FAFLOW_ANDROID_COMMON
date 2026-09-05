package com.governence.faflow.domain.model

/**
 * FAFLOW Staff / Faculty Member entity (reused directly from FAFLOW `users` table).
 */
data class StaffMember(
    val id: Int,
    val name: String,
    val email: String,
    val username: String? = null,
    val role: String = "teacher",
    val departmentId: Int? = null,
    val departmentName: String? = null,
    val isActive: Boolean = true,
    val faceEnrolled: Boolean = false,
    val creditBalance: Int = 0
)

/**
 * Staff biometric face profile storing 512-dim ArcFace embedding.
 */
data class StaffFaceProfile(
    val id: String,
    val staffId: Int,
    val embedding: FloatArray,
    val modelName: String = "InsightFace_ArcFace_MobileFaceNet",
    val modelVersion: String = "w600k_mbf_v1",
    val qualityScore: Float = 1.0f,
    val isActive: Boolean = true,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false

        other as StaffFaceProfile

        if (id != other.id) return false
        if (staffId != other.staffId) return false
        if (!embedding.contentEquals(other.embedding)) return false
        if (modelName != other.modelName) return false
        if (modelVersion != other.modelVersion) return false

        return true
    }

    override fun hashCode(): Int {
        var result = id.hashCode()
        result = 31 * result + staffId.hashCode()
        result = 31 * result + embedding.contentHashCode()
        result = 31 * result + modelName.hashCode()
        result = 31 * result + modelVersion.hashCode()
        return result
    }
}

/**
 * Daily FAFLOW Staff Attendance Record (Check-In & Check-Out).
 */
data class StaffAttendanceRecord(
    val id: String,
    val staffId: Int,
    val date: String,
    val checkInTime: String? = null,
    val checkOutTime: String? = null,
    val status: AttendanceStatus = AttendanceStatus.PRESENT,
    val checkInLatitude: Double? = null,
    val checkInLongitude: Double? = null,
    val geofenceName: String? = null,
    val similarityScore: Float = 0f,
    val livenessScore: Float = 0f,
    val syncStatus: SyncStatus = SyncStatus.SYNCED,
    val idempotencyKey: String = ""
)

enum class AttendanceStatus {
    PRESENT,
    HALF_DAY,
    LATE,
    ON_LEAVE,
    ABSENT
}

enum class SyncStatus {
    PENDING,
    SYNCED,
    FAILED
}

/**
 * FAFLOW Academic Schedule Timetable Slot (5 periods across 6 Day Orders).
 */
data class TimetableSlot(
    val id: Int,
    val teacherId: Int,
    val subjectName: String,
    val subjectCode: String,
    val className: String,
    val section: String,
    val roomNumber: String,
    val dayOrder: Int, // 1 - 6
    val periodNumber: Int // 1 - 5
)

/**
 * FAFLOW Faculty Leave Request entity.
 */
data class LeaveRequest(
    val id: Int,
    val teacherId: Int,
    val date: String,
    val dayOrder: Int,
    val periodNumber: Int,
    val reason: String,
    val status: LeaveStatus = LeaveStatus.PENDING,
    val isEmergency: Boolean = false,
    val substituteTeacherName: String? = null
)

enum class LeaveStatus {
    PENDING,
    APPROVED,
    REJECTED,
    CANCELLED
}

/**
 * FAFLOW Teacher Credit Balance & Transaction.
 */
data class CreditTransaction(
    val id: Int,
    val teacherId: Int,
    val change: Int, // +1 or -1
    val category: String, // substitute_class, manual_adjustment, exam_duty
    val reason: String,
    val createdAt: String
)
