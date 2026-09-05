package com.governence.faflow.attendance

import com.governence.faflow.domain.model.StaffAttendanceRecord
import com.governence.faflow.location.StaffLiveLocation
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.StateFlow

data class DailyShiftStatus(
    val hasCheckedIn: Boolean = false,
    val hasCheckedOut: Boolean = false,
    val checkInTime: String? = null,
    val checkOutTime: String? = null,
    val totalWorkDuration: String? = null,
    val currentStatus: String = "NOT_CHECKED_IN" // NOT_CHECKED_IN, CHECKED_IN, COMPLETED
)

sealed interface AttendanceCheckResult {
    data class Success(val record: StaffAttendanceRecord, val message: String) : AttendanceCheckResult
    data class GeofenceFailure(val message: String, val distanceMeters: Float) : AttendanceCheckResult
    data class FaceMatchFailure(val similarityScore: Float, val threshold: Float) : AttendanceCheckResult
    data class LivenessFailure(val reason: String) : AttendanceCheckResult
    data class MockLocationFailure(val message: String) : AttendanceCheckResult
    data class NetworkQueued(val record: StaffAttendanceRecord) : AttendanceCheckResult
    data class Error(val message: String) : AttendanceCheckResult
}

/**
 * Contract for FAFLOW Staff Check-In & Check-Out orchestration.
 */
interface StaffAttendanceManager {
    val shiftStatus: StateFlow<DailyShiftStatus>
    val recentAttendanceRecords: StateFlow<List<StaffAttendanceRecord>>

    suspend fun performCheckIn(
        location: StaffLiveLocation,
        faceEmbedding: FloatArray,
        livenessScore: Float
    ): AttendanceCheckResult

    suspend fun performCheckOut(
        location: StaffLiveLocation,
        faceEmbedding: FloatArray,
        livenessScore: Float
    ): AttendanceCheckResult

    fun getMonthlyAttendanceHistory(): Flow<List<StaffAttendanceRecord>>
}
