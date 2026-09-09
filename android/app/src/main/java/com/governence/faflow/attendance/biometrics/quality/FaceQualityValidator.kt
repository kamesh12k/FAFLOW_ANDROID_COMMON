package com.governence.faflow.attendance.biometrics.quality

import com.governence.faflow.attendance.biometrics.model.FaceDetectionResult
import kotlin.math.abs

/**
 * Result of biometric face quality assessment prior to alignment and embedding inference.
 */
sealed class FaceQualityCheckResult {
    data class Valid(val primaryFace: FaceDetectionResult) : FaceQualityCheckResult()
    data class Rejected(val reason: String, val code: QualityErrorCode) : FaceQualityCheckResult()
}

enum class QualityErrorCode {
    NO_FACE,
    MULTIPLE_FACES,
    TOO_FAR,
    TOO_CLOSE,
    OFF_CENTER,
    POOR_LIGHTING,
    EXCESSIVE_GLARE,
    TILTED_POSE,
    LOW_CONFIDENCE
}

/**
 * Enterprise-grade face quality validator enforcing strict single-person attendance gating.
 *
 * Rejects substandard frames before expensive inference and returns concise,
 * direct operational feedback designed for professional governance workflows.
 */
class FaceQualityValidator(
    private val minFaceWidthRatio: Float = 0.22f,
    private val maxFaceWidthRatio: Float = 0.80f,
    private val maxAngleDegrees: Float = 20.0f,
    private val minConfidence: Float = 0.50f,
    private val minBrightness: Float = 0.25f,
    private val maxBrightness: Float = 0.90f
) {

    fun validate(
        detections: List<FaceDetectionResult>,
        frameWidth: Int = 640,
        frameHeight: Int = 480
    ): FaceQualityCheckResult {
        // 1. Multiple Face Gating: Attendance must NEVER identify wrong person due to crowd
        if (detections.isEmpty()) {
            return FaceQualityCheckResult.Rejected("Face not detected", QualityErrorCode.NO_FACE)
        }
        if (detections.size > 1) {
            return FaceQualityCheckResult.Rejected(
                "Only one person should be visible",
                QualityErrorCode.MULTIPLE_FACES
            )
        }

        val face = detections.first()
        val box = face.boundingBox

        // 2. Detection Confidence
        if (face.confidence < minConfidence) {
            return FaceQualityCheckResult.Rejected(
                "Face not detected clearly",
                QualityErrorCode.LOW_CONFIDENCE
            )
        }

        // 3. Face Size / Distance Check
        val faceWidthRatio = box.width / frameWidth.toFloat()
        if (faceWidthRatio < minFaceWidthRatio) {
            return FaceQualityCheckResult.Rejected("Move closer", QualityErrorCode.TOO_FAR)
        }
        if (faceWidthRatio > maxFaceWidthRatio) {
            return FaceQualityCheckResult.Rejected("Move farther away", QualityErrorCode.TOO_CLOSE)
        }

        // 4. Centering & Boundary Gating
        val isBorderClipped = box.left < 10f || box.top < 10f ||
                box.right > (frameWidth - 10f) || box.bottom > (frameHeight - 10f)
        val centerDeltaX = abs(box.centerX - (frameWidth / 2f)) / frameWidth.toFloat()
        val centerDeltaY = abs(box.centerY - (frameHeight / 2f)) / frameHeight.toFloat()

        if (isBorderClipped || centerDeltaX > 0.28f || centerDeltaY > 0.28f) {
            return FaceQualityCheckResult.Rejected("Center your face", QualityErrorCode.OFF_CENTER)
        }

        // 5. Head Pose Angle
        val quality = face.quality
        if (abs(quality.yawAngle) > maxAngleDegrees || abs(quality.pitchAngle) > maxAngleDegrees || abs(quality.rollAngle) > maxAngleDegrees) {
            return FaceQualityCheckResult.Rejected("Look directly at the camera", QualityErrorCode.TILTED_POSE)
        }

        // 6. Lighting / Brightness Gating
        if (quality.brightnessScore < minBrightness) {
            return FaceQualityCheckResult.Rejected("Improve lighting", QualityErrorCode.POOR_LIGHTING)
        }
        if (quality.brightnessScore > maxBrightness) {
            return FaceQualityCheckResult.Rejected("Reduce glare", QualityErrorCode.EXCESSIVE_GLARE)
        }

        return FaceQualityCheckResult.Valid(face)
    }

    /**
     * Relaxed quality check used exclusively during active LIVENESS challenges.
     *
     * During liveness the user is INTENTIONALLY moving their head (turning, tilting).
     * The strict alignment checks (centering, pose angle) must NOT apply here —
     * they would reject valid gestures as quality failures.
     *
     * Only hard-blocks on:
     * - No face at all (tracking truly lost)
     * - Multiple faces (security gate — must always hold)
     * - Face too far outside the frame to track (expanded boundary)
     *
     * Everything else is allowed: off-center, tilted pose, slightly low confidence.
     */
    fun validateForLivenessTracking(
        detections: List<FaceDetectionResult>,
        frameWidth: Int = 640,
        frameHeight: Int = 480
    ): FaceQualityCheckResult {
        // Security gate: multiple faces must always fail
        if (detections.isEmpty()) {
            return FaceQualityCheckResult.Rejected("Keep your face visible", QualityErrorCode.NO_FACE)
        }
        if (detections.size > 1) {
            return FaceQualityCheckResult.Rejected(
                "Only one person should be visible",
                QualityErrorCode.MULTIPLE_FACES
            )
        }

        val face = detections.first()
        val box = face.boundingBox

        // Lowered confidence threshold — motion blur during gestures reduces detection confidence
        if (face.confidence < 0.35f) {
            return FaceQualityCheckResult.Rejected("Keep your face visible", QualityErrorCode.LOW_CONFIDENCE)
        }

        // Size check with wider bounds — head movement changes apparent face size
        val faceWidthRatio = box.width / frameWidth.toFloat()
        if (faceWidthRatio < 0.15f) {
            return FaceQualityCheckResult.Rejected("Move closer", QualityErrorCode.TOO_FAR)
        }
        if (faceWidthRatio > 0.92f) {
            return FaceQualityCheckResult.Rejected("Move farther away", QualityErrorCode.TOO_CLOSE)
        }

        // Expanded centering boundary — head turns shift the face center laterally
        // 0.50 (vs strict 0.28) allows the face to travel across ~50% of frame width
        val centerDeltaX = Math.abs(box.centerX - (frameWidth / 2f)) / frameWidth.toFloat()
        val centerDeltaY = Math.abs(box.centerY - (frameHeight / 2f)) / frameHeight.toFloat()
        val isFarOutOfFrame = box.left < -20f || box.top < -20f ||
                box.right > (frameWidth + 20f) || box.bottom > (frameHeight + 20f)

        if (isFarOutOfFrame || centerDeltaX > 0.50f || centerDeltaY > 0.50f) {
            return FaceQualityCheckResult.Rejected("Keep your face visible", QualityErrorCode.OFF_CENTER)
        }

        // NOTE: NO pose/angle check here — the user is intentionally tilting/turning their head.
        // NOTE: NO lighting check here — liveness is about movement, not perfect illumination.

        return FaceQualityCheckResult.Valid(face)
    }
}
