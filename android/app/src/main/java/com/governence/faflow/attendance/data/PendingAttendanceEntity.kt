package com.governence.faflow.attendance.data

/**
 * Lifecycle synchronization state for an offline attendance transaction.
 */
enum class SyncStatus {
    PENDING,
    SYNCING,
    SYNCED,
    FAILED
}

/**
 * Represents a local queued attendance transaction stored securely on-device
 * pending network synchronization with the FAFLOW backend.
 * NOTE: Strictly stores minimal verification metadata; zero raw images or video.
 */
data class PendingAttendanceEntity(
    val id: Long = 0L,
    val idempotencyKey: String,
    val userId: Int,
    val operationType: String, // "CHECK_IN" or "CHECK_OUT"
    val createdAt: Long = System.currentTimeMillis(),
    val latitude: Double,
    val longitude: Double,
    val accuracyMeters: Double,
    val geofenceId: String? = null,
    val faceSimilarityScore: Double,
    val livenessVerified: Boolean,
    val verificationMethod: String = "FACE_ON_DEVICE",
    val deviceReference: String? = null,
    val attemptCount: Int = 0,
    val lastAttemptAt: Long = 0L,
    val syncStatus: SyncStatus = SyncStatus.PENDING,
    val lastError: String? = null
)
