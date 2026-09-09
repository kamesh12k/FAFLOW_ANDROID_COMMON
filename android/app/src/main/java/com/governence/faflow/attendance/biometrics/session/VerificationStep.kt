package com.governence.faflow.attendance.biometrics.session

/**
 * Sequential phases of the unified biometric verification pipeline.
 * Strict transitions:
 * IDLE -> FACE_VERIFYING -> FACE_VERIFIED -> LIVENESS_VERIFYING -> VERIFIED -> (ATTENDANCE SUBMISSION)
 * State collisions (e.g. FACE_VERIFYING + LIVENESS_VERIFYING) are strictly prohibited.
 */
enum class VerificationStep {
    IDLE,
    FACE_VERIFYING,
    FACE_VERIFIED,
    LIVENESS_VERIFYING,
    VERIFIED,
    FAILED
}
