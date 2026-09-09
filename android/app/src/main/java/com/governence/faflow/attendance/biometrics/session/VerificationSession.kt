package com.governence.faflow.attendance.biometrics.session

import java.util.UUID

/**
 * Type of attendance operation being conducted.
 */
enum class AttendanceOperationType {
    CHECK_IN,
    CHECK_OUT
}

/**
 * Status of face identity verification within an active session.
 */
enum class FaceVerificationStatus {
    PENDING,
    VERIFYING,
    VERIFIED,
    FAILED
}

/**
 * Status of active double-blink liveness verification within an active session.
 */
enum class LivenessVerificationStatus {
    NOT_STARTED,
    IN_PROGRESS,
    BLINK_1_VERIFIED,
    VERIFIED,
    FAILED,
    TIMED_OUT
}

/**
 * Cryptographically unique verification session encapsulating the end-to-end
 * biometric verification lifecycle for a single attendance attempt.
 *
 * Enforces strict isolation: Check-Out will NEVER inherit or reuse verification
 * state, face embeddings, or timestamps from Check-In.
 */
data class VerificationSession(
    val sessionId: String = UUID.randomUUID().toString(),
    val operationType: AttendanceOperationType,
    val startTimeMs: Long = System.currentTimeMillis(),
    val timeoutMs: Long = 60_000L,
    var faceStatus: FaceVerificationStatus = FaceVerificationStatus.PENDING,
    var verifiedStaffId: String? = null,
    var similarityScore: Float = 0f,
    var faceVerifiedTimeMs: Long? = null,
    var livenessStatus: LivenessVerificationStatus = LivenessVerificationStatus.NOT_STARTED,
    var blinkCount: Int = 0,
    var livenessVerifiedTimeMs: Long? = null,
    var completedTimeMs: Long? = null,
    var isCancelled: Boolean = false
) {
    val isExpired: Boolean
        get() = (System.currentTimeMillis() - startTimeMs) > timeoutMs

    val isFaceVerified: Boolean
        get() = faceStatus == FaceVerificationStatus.VERIFIED

    val isLivenessVerified: Boolean
        get() = livenessStatus == LivenessVerificationStatus.VERIFIED && blinkCount >= 2

    fun markFaceVerifying() {
        if (!isCancelled && !isExpired) {
            faceStatus = FaceVerificationStatus.VERIFYING
        }
    }

    fun markFaceVerified(staffId: String, similarity: Float) {
        if (!isCancelled && !isExpired) {
            faceStatus = FaceVerificationStatus.VERIFIED
            verifiedStaffId = staffId
            similarityScore = similarity
            faceVerifiedTimeMs = System.currentTimeMillis()
        }
    }

    fun markFaceFailed() {
        faceStatus = FaceVerificationStatus.FAILED
    }

    fun markLivenessStarted() {
        if (isFaceVerified && !isCancelled && !isExpired) {
            livenessStatus = LivenessVerificationStatus.IN_PROGRESS
            blinkCount = 0
        }
    }

    fun recordBlink(count: Int) {
        if (livenessStatus == LivenessVerificationStatus.IN_PROGRESS ||
            livenessStatus == LivenessVerificationStatus.BLINK_1_VERIFIED
        ) {
            blinkCount = count
            if (count == 1) {
                livenessStatus = LivenessVerificationStatus.BLINK_1_VERIFIED
            } else if (count >= 2) {
                livenessStatus = LivenessVerificationStatus.VERIFIED
                livenessVerifiedTimeMs = System.currentTimeMillis()
            }
        }
    }

    fun markLivenessFailed() {
        livenessStatus = LivenessVerificationStatus.FAILED
    }

    fun markLivenessTimedOut() {
        livenessStatus = LivenessVerificationStatus.TIMED_OUT
    }

    fun markLivenessBypassed() {
        livenessStatus = LivenessVerificationStatus.VERIFIED
        blinkCount = 2
        livenessVerifiedTimeMs = System.currentTimeMillis()
    }

    /**
     * Absolute atomic condition required before attendance submission is permitted.
     * Fails closed if session has expired, was cancelled, does not match, or either
     * face verification or double-blink liveness is incomplete.
     * When bypassLiveness is true, only genuine face verification is mandated.
     */
    fun canSubmitAttendance(targetSessionId: String, bypassLiveness: Boolean = false): Boolean {
        return sessionId == targetSessionId &&
                !isCancelled &&
                !isExpired &&
                isFaceVerified &&
                (bypassLiveness || (isLivenessVerified && blinkCount >= 2))
    }
}

