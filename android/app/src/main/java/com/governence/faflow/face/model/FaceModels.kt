package com.governence.faflow.face.model

import android.graphics.Bitmap

/**
 * 2D coordinate point for facial landmarks.
 */
data class FacePoint(
    val x: Float,
    val y: Float
)

/**
 * Normalized 2D bounding box and spatial boundaries of a detected face.
 */
data class FaceBox(
    val left: Float,
    val top: Float,
    val right: Float,
    val bottom: Float
) {
    val width: Float get() = right - left
    val height: Float get() = bottom - top
    val centerX: Float get() = (left + right) / 2f
    val centerY: Float get() = (top + bottom) / 2f
}

/**
 * 5-point facial landmarks standard in InsightFace pipelines:
 * 1. Left Eye
 * 2. Right Eye
 * 3. Nose Tip
 * 4. Left Mouth Corner
 * 5. Right Mouth Corner
 */
data class FaceLandmarks(
    val leftEye: FacePoint,
    val rightEye: FacePoint,
    val nose: FacePoint,
    val leftMouth: FacePoint,
    val rightMouth: FacePoint
) {
    fun toPointList(): List<FacePoint> = listOf(leftEye, rightEye, nose, leftMouth, rightMouth)
}

/**
 * Comprehensive face quality metrics computed prior to inference.
 */
data class FaceQuality(
    val brightnessScore: Float = 1.0f,
    val sharpnessScore: Float = 1.0f,
    val pitchAngle: Float = 0f,
    val yawAngle: Float = 0f,
    val rollAngle: Float = 0f,
    val isFrontal: Boolean = true,
    val isAdequatelySized: Boolean = true
) {
    val isAcceptableForEnrollment: Boolean
        get() = brightnessScore in 0.3f..0.95f &&
                sharpnessScore >= 0.4f &&
                Math.abs(yawAngle) <= 20f &&
                Math.abs(pitchAngle) <= 20f &&
                isAdequatelySized
}

/**
 * Result of a face detection forward pass.
 */
data class FaceDetectionResult(
    val trackingId: Int = -1,
    val boundingBox: FaceBox,
    val confidence: Float,
    val landmarks: FaceLandmarks? = null,
    val quality: FaceQuality = FaceQuality(),
    val alignedBitmap: Bitmap? = null
)

/**
 * Full biometric verification state machine for attendance gating.
 */
sealed interface StaffBiometricVerificationState {
    data class Unavailable(val reason: String) : StaffBiometricVerificationState
    data class NoEnrollment(val staffId: String) : StaffBiometricVerificationState
    data object NoFace : StaffBiometricVerificationState
    data class MultipleFaces(val count: Int) : StaffBiometricVerificationState
    data object FaceTooSmall : StaffBiometricVerificationState
    data object FaceTooLarge : StaffBiometricVerificationState
    data object FaceOutOfFrame : StaffBiometricVerificationState
    data object Aligning : StaffBiometricVerificationState
    data object Embedding : StaffBiometricVerificationState
    data class VerificationFailed(val similarity: Float, val threshold: Float, val reason: String) : StaffBiometricVerificationState
    data class Verified(val staffId: String, val similarity: Float, val threshold: Float) : StaffBiometricVerificationState
}

/**
 * Metric result from matching an embedding against registered profiles.
 */
data class FaceMatchResult(
    val personId: String?,
    val personName: String?,
    val similarityScore: Float,
    val isMatched: Boolean,
    val thresholdUsed: Float,
    val detectionResult: FaceDetectionResult
)

/**
 * Result of passive/active anti-spoofing analysis.
 */
data class LivenessResult(
    val isLive: Boolean,
    val score: Float,
    val spoofType: SpoofType = SpoofType.NONE,
    val message: String = "Liveness verified"
)

enum class SpoofType {
    NONE,
    PRINT_ATTACK,
    SCREEN_ATTACK,
    MASK_ATTACK,
    REPLAY_ATTACK,
    MOTION_INCONSISTENCY
}
