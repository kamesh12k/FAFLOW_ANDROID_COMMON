package com.governence.faflow.face.liveness

import com.governence.faflow.face.model.FaceBox
import com.governence.faflow.face.model.FaceLandmarks
import com.governence.faflow.face.model.SpoofType

/**
 * Presentation Attack Detection (PAD) risk tier.
 */
enum class PresentationAttackRisk {
    LOW,
    MEDIUM,
    HIGH
}

/**
 * Randomized active liveness interaction challenge types.
 */
enum class LivenessChallenge(val prompt: String) {
    TURN_LEFT("Turn your head slightly to the left"),
    TURN_RIGHT("Turn your head slightly to the right"),
    LOOK_UP("Tilt your head slightly upward"),
    LOOK_DOWN("Tilt your head slightly downward"),
    BLINK("Blink your eyes once")
}

/**
 * 3D head pose orientation angles in degrees.
 */
data class HeadPose(
    val yawDegrees: Float = 0f,
    val pitchDegrees: Float = 0f,
    val rollDegrees: Float = 0f
) {
    val isFrontal: Boolean
        get() = Math.abs(yawDegrees) <= 15f && Math.abs(pitchDegrees) <= 15f && Math.abs(rollDegrees) <= 15f
}

/**
 * Temporal snapshot of a detected face observation.
 */
data class FaceObservation(
    val timestamp: Long,
    val boundingBox: FaceBox,
    val landmarks: FaceLandmarks?,
    val headPose: HeadPose
)

/**
 * Dynamic liveness verification lifecycle state machine.
 */
sealed interface LivenessState {
    data class Unavailable(val reason: String) : LivenessState
    data object Initializing : LivenessState
    data object WaitingForFace : LivenessState
    data class FaceNotSuitable(val reason: String) : LivenessState
    data class PreparingChallenge(val challenge: LivenessChallenge) : LivenessState
    data class ChallengeActive(
        val challenge: LivenessChallenge,
        val progress: Float,
        val instructions: String,
        val timeRemainingMs: Long
    ) : LivenessState
    data object Processing : LivenessState
    data class Passed(val livenessScore: Float, val risk: PresentationAttackRisk) : LivenessState
    data class Failed(val reason: String) : LivenessState
    data class TimedOut(val challenge: LivenessChallenge) : LivenessState
    data class SpoofSuspected(val spoofType: SpoofType, val reason: String) : LivenessState
    data class Error(val message: String) : LivenessState
}

/**
 * Unified authorization-ready biometric verification result.
 * Combines 1-to-1 face recognition with presentation attack defense.
 */
data class BiometricVerificationResult(
    val staffId: String,
    val identityVerified: Boolean,
    val similarityScore: Float,
    val livenessVerified: Boolean,
    val livenessScore: Float,
    val presentationAttackRisk: PresentationAttackRisk,
    val timestamp: Long = System.currentTimeMillis()
) {
    val isAttendanceEligible: Boolean
        get() = identityVerified && livenessVerified && presentationAttackRisk == PresentationAttackRisk.LOW
}
