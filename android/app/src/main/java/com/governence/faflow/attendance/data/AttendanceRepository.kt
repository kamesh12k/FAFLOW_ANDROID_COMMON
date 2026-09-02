package com.governence.faflow.attendance.data

import com.governence.faflow.core.network.AttendanceCheckInRequestDto
import com.governence.faflow.core.network.AttendanceCheckOutRequestDto
import com.governence.faflow.core.network.AttendanceRecordOutDto
import com.governence.faflow.core.network.AttendanceTodaySummaryOutDto
import com.governence.faflow.core.network.FaflowApiService
import com.governence.faflow.core.network.NetworkResult
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.UUID

sealed interface AttendanceSubmissionResult {
    data class Success(val record: AttendanceRecordOutDto, val isOnline: Boolean) : AttendanceSubmissionResult
    data class QueuedOffline(val pendingEntity: PendingAttendanceEntity, val message: String) : AttendanceSubmissionResult
    data class Failed(val errorCode: Int, val message: String) : AttendanceSubmissionResult
}

/**
 * Repository orchestrating online attendance submission, offline SQLite queueing,
 * and background synchronization.
 */
class AttendanceRepository(
    private val apiService: FaflowApiService,
    private val localQueue: AttendanceLocalQueue
) {

    /**
     * Submits shift check-in to FAFLOW backend with automatic offline queue fallback.
     */
    suspend fun checkIn(
        latitude: Double,
        longitude: Double,
        accuracyMeters: Double,
        faceSimilarityScore: Double,
        livenessVerified: Boolean,
        userId: Int,
        idempotencyKey: String = UUID.randomUUID().toString(),
        deviceReference: String? = "FAFLOW_STAFF_MOBILE"
    ): AttendanceSubmissionResult = withContext(Dispatchers.IO) {
        val requestDto = AttendanceCheckInRequestDto(
            idempotencyKey = idempotencyKey,
            latitude = latitude,
            longitude = longitude,
            accuracyMeters = accuracyMeters,
            faceSimilarityScore = faceSimilarityScore,
            livenessVerified = livenessVerified,
            verificationMethod = "FACE_ON_DEVICE",
            deviceReference = deviceReference
        )

        try {
            val response = apiService.checkIn(requestDto)
            if (response.isSuccessful && response.body() != null) {
                return@withContext AttendanceSubmissionResult.Success(
                    record = response.body()!!,
                    isOnline = true
                )
            } else {
                val errorBody = response.errorBody()?.string()
                val code = response.code()
                if (code in 400..499) {
                    // Client validation failure (e.g. duplicate check-in, outside geofence)
                    return@withContext AttendanceSubmissionResult.Failed(
                        errorCode = code,
                        message = errorBody ?: "Check-in rejected by institutional server (HTTP $code)"
                    )
                }
            }
        } catch (_: Exception) {
            // Network failure or offline -> fallback to local SQLite persistent queue
        }

        // Enqueue transaction locally for background WorkManager sync
        val pending = PendingAttendanceEntity(
            idempotencyKey = idempotencyKey,
            userId = userId,
            operationType = "CHECK_IN",
            latitude = latitude,
            longitude = longitude,
            accuracyMeters = accuracyMeters,
            faceSimilarityScore = faceSimilarityScore,
            livenessVerified = livenessVerified,
            verificationMethod = "FACE_ON_DEVICE",
            deviceReference = deviceReference,
            syncStatus = SyncStatus.PENDING
        )
        localQueue.enqueue(pending)

        return@withContext AttendanceSubmissionResult.QueuedOffline(
            pendingEntity = pending,
            message = "Check-in verified locally. Queued for automatic institutional synchronization."
        )
    }

    /**
     * Submits shift check-out to FAFLOW backend with automatic offline queue fallback.
     */
    suspend fun checkOut(
        latitude: Double,
        longitude: Double,
        accuracyMeters: Double,
        faceSimilarityScore: Double,
        livenessVerified: Boolean,
        userId: Int,
        idempotencyKey: String = UUID.randomUUID().toString(),
        deviceReference: String? = "FAFLOW_STAFF_MOBILE"
    ): AttendanceSubmissionResult = withContext(Dispatchers.IO) {
        val requestDto = AttendanceCheckOutRequestDto(
            idempotencyKey = idempotencyKey,
            latitude = latitude,
            longitude = longitude,
            accuracyMeters = accuracyMeters,
            faceSimilarityScore = faceSimilarityScore,
            livenessVerified = livenessVerified,
            verificationMethod = "FACE_ON_DEVICE",
            deviceReference = deviceReference
        )

        try {
            val response = apiService.checkOut(requestDto)
            if (response.isSuccessful && response.body() != null) {
                return@withContext AttendanceSubmissionResult.Success(
                    record = response.body()!!,
                    isOnline = true
                )
            } else {
                val errorBody = response.errorBody()?.string()
                val code = response.code()
                if (code in 400..499) {
                    return@withContext AttendanceSubmissionResult.Failed(
                        errorCode = code,
                        message = errorBody ?: "Check-out rejected by institutional server (HTTP $code)"
                    )
                }
            }
        } catch (_: Exception) {}

        val pending = PendingAttendanceEntity(
            idempotencyKey = idempotencyKey,
            userId = userId,
            operationType = "CHECK_OUT",
            latitude = latitude,
            longitude = longitude,
            accuracyMeters = accuracyMeters,
            faceSimilarityScore = faceSimilarityScore,
            livenessVerified = livenessVerified,
            verificationMethod = "FACE_ON_DEVICE",
            deviceReference = deviceReference,
            syncStatus = SyncStatus.PENDING
        )
        localQueue.enqueue(pending)

        return@withContext AttendanceSubmissionResult.QueuedOffline(
            pendingEntity = pending,
            message = "Check-out verified locally. Queued for automatic institutional synchronization."
        )
    }

    suspend fun getTodaySummary(): NetworkResult<AttendanceTodaySummaryOutDto> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getTodayAttendance()
            if (response.isSuccessful && response.body() != null) {
                NetworkResult.Success(response.body()!!)
            } else {
                NetworkResult.Error(response.code(), response.errorBody()?.string() ?: "Failed to fetch today attendance")
            }
        } catch (e: Exception) {
            NetworkResult.Error(0, e.localizedMessage ?: "Network error fetching attendance status")
        }
    }

    suspend fun getMyHistory(limit: Int = 30, offset: Int = 0): NetworkResult<List<AttendanceRecordOutDto>> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getMyAttendanceHistory(limit, offset)
            if (response.isSuccessful && response.body() != null) {
                NetworkResult.Success(response.body()!!)
            } else {
                NetworkResult.Error(response.code(), response.errorBody()?.string() ?: "Failed to fetch attendance history")
            }
        } catch (e: Exception) {
            NetworkResult.Error(0, e.localizedMessage ?: "Network error fetching attendance history")
        }
    }

    /**
     * Synchronizes all locally queued pending offline transactions with the server.
     */
    suspend fun synchronizePendingTransactions(): Int = withContext(Dispatchers.IO) {
        val pendingList = localQueue.getPendingTransactions()
        var successCount = 0

        for (item in pendingList) {
            localQueue.updateAttempt(item.id, SyncStatus.SYNCING)
            try {
                if (item.operationType == "CHECK_IN") {
                    val req = AttendanceCheckInRequestDto(
                        idempotencyKey = item.idempotencyKey,
                        latitude = item.latitude,
                        longitude = item.longitude,
                        accuracyMeters = item.accuracyMeters,
                        faceSimilarityScore = item.faceSimilarityScore,
                        livenessVerified = item.livenessVerified,
                        verificationMethod = item.verificationMethod,
                        deviceReference = item.deviceReference
                    )
                    val res = apiService.checkIn(req)
                    if (res.isSuccessful) {
                        localQueue.markSynced(item.id)
                        successCount++
                    } else {
                        localQueue.updateAttempt(item.id, SyncStatus.PENDING, "Server returned HTTP ${res.code()}")
                    }
                } else {
                    val req = AttendanceCheckOutRequestDto(
                        idempotencyKey = item.idempotencyKey,
                        latitude = item.latitude,
                        longitude = item.longitude,
                        accuracyMeters = item.accuracyMeters,
                        faceSimilarityScore = item.faceSimilarityScore,
                        livenessVerified = item.livenessVerified,
                        verificationMethod = item.verificationMethod,
                        deviceReference = item.deviceReference
                    )
                    val res = apiService.checkOut(req)
                    if (res.isSuccessful) {
                        localQueue.markSynced(item.id)
                        successCount++
                    } else {
                        localQueue.updateAttempt(item.id, SyncStatus.PENDING, "Server returned HTTP ${res.code()}")
                    }
                }
            } catch (e: Exception) {
                localQueue.updateAttempt(item.id, SyncStatus.PENDING, e.localizedMessage)
            }
        }
        return@withContext successCount
    }

    fun getPendingCount(): Int = localQueue.getPendingCount()
}
