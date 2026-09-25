package com.governence.faflow.attendance.biometrics.enrollment

import android.graphics.Bitmap
import com.governence.faflow.attendance.biometrics.FaceMatcher
import com.governence.faflow.attendance.biometrics.embedding.MobileFaceNetEmbedder
import com.governence.faflow.attendance.biometrics.model.FaceDetectionResult
import kotlin.math.abs

/**
 * Ordered multi-pose capture targets for high-reliability biometric enrollment.
 */
enum class EnrollmentPoseTarget(
    val id: Int,
    val title: String,
    val shortLabel: String,
    val prompt: String,
    val yawMin: Float,
    val yawMax: Float
) {
    FRONTAL(
        id = 1,
        title = "Frontal View",
        shortLabel = "Center",
        prompt = "Look directly at the camera",
        yawMin = -9f,
        yawMax = 9f
    ),
    LEFT_ANGLE(
        id = 2,
        title = "Turn Head Left",
        shortLabel = "Left",
        prompt = "Turn head slightly to the left (←)",
        yawMin = 8f,
        yawMax = 28f
    ),
    RIGHT_ANGLE(
        id = 3,
        title = "Turn Head Right",
        shortLabel = "Right",
        prompt = "Turn head slightly to the right (→)",
        yawMin = -28f,
        yawMax = -8f
    );

    fun isPoseSatisfied(yawAngle: Float, rollAngle: Float): Boolean {
        if (abs(rollAngle) > 22f) return false
        return yawAngle in yawMin..yawMax
    }
}

/**
 * Captured biometric sample for a specific pose.
 */
data class PoseCapture(
    val target: EnrollmentPoseTarget,
    val bitmap: Bitmap? = null,
    val embedding: FloatArray
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is PoseCapture) return false
        return target == other.target && embedding.contentEquals(other.embedding)
    }

    override fun hashCode(): Int {
        var result = target.hashCode()
        result = 31 * result + embedding.contentHashCode()
        return result
    }
}

/**
 * Result of evaluating live detection against the current target pose.
 */
sealed interface PoseEvaluationResult {
    data class ValidPose(
        val yaw: Float,
        val prompt: String = "Perfect! Hold still..."
    ) : PoseEvaluationResult

    data class AdjustPose(
        val yaw: Float,
        val guidance: String
    ) : PoseEvaluationResult

    data class QualityIssue(
        val reason: String
    ) : PoseEvaluationResult
}

/**
 * Result of cross-sample biometric identity validation and master profile generation.
 */
sealed interface EnrollmentValidationResult {
    data class Success(
        val masterEmbedding: FloatArray,
        val templates: List<FloatArray>,
        val crossSimilarities: List<Float>
    ) : EnrollmentValidationResult

    data class InconsistentIdentity(
        val lowestSimilarity: Float,
        val requiredThreshold: Float,
        val reason: String
    ) : EnrollmentValidationResult
}

/**
 * Domain engine managing pose classification, stability gating, and cross-consistency validation
 * for accurate multi-pose biometric registration.
 */
class FaceEnrollmentEngine(
    val requiredHoldFrames: Int = 4,
    val minCrossSimilarity: Float = 0.55f
) {

    /**
     * Evaluates a detected face against the requested pose target.
     */
    fun evaluatePose(
        detection: FaceDetectionResult,
        target: EnrollmentPoseTarget
    ): PoseEvaluationResult {
        val q = detection.quality

        // 1. Lighting Gate
        if (q.brightnessScore < 0.25f) {
            return PoseEvaluationResult.QualityIssue("Lighting is too dark. Move to a well-lit area.")
        }

        // 2. Head Tilt (Roll) Gate
        if (abs(q.rollAngle) > 22f) {
            return PoseEvaluationResult.AdjustPose(
                yaw = q.yawAngle,
                guidance = "Keep your head level (avoid tilting)"
            )
        }

        // 3. Pose-specific yaw evaluation
        val yaw = q.yawAngle
        return when (target) {
            EnrollmentPoseTarget.FRONTAL -> {
                if (yaw > 9f) {
                    PoseEvaluationResult.AdjustPose(yaw, "Turn slightly right towards center")
                } else if (yaw < -9f) {
                    PoseEvaluationResult.AdjustPose(yaw, "Turn slightly left towards center")
                } else {
                    PoseEvaluationResult.ValidPose(yaw)
                }
            }
            EnrollmentPoseTarget.LEFT_ANGLE -> {
                if (yaw < 8f) {
                    PoseEvaluationResult.AdjustPose(yaw, "Turn head a little more to the left (←)")
                } else if (yaw > 30f) {
                    PoseEvaluationResult.AdjustPose(yaw, "Turn back slightly towards center")
                } else {
                    PoseEvaluationResult.ValidPose(yaw)
                }
            }
            EnrollmentPoseTarget.RIGHT_ANGLE -> {
                if (yaw > -8f) {
                    PoseEvaluationResult.AdjustPose(yaw, "Turn head a little more to the right (→)")
                } else if (yaw < -30f) {
                    PoseEvaluationResult.AdjustPose(yaw, "Turn back slightly towards center")
                } else {
                    PoseEvaluationResult.ValidPose(yaw)
                }
            }
        }
    }

    /**
     * Verifies that all 3 captured samples belong to the same person across poses (cross-sample consistency),
     * and computes the L2-normalized master composite embedding.
     */
    fun validateAndConsolidate(
        captures: List<PoseCapture>,
        matcher: FaceMatcher
    ): EnrollmentValidationResult {
        if (captures.size < 3) {
            return EnrollmentValidationResult.InconsistentIdentity(
                lowestSimilarity = 0f,
                requiredThreshold = minCrossSimilarity,
                reason = "All 3 poses (Center, Left, Right) must be captured before validation."
            )
        }

        val e1 = captures[0].embedding
        val e2 = captures[1].embedding
        val e3 = captures[2].embedding

        val s12 = matcher.computeCosineSimilarity(e1, e2)
        val s23 = matcher.computeCosineSimilarity(e2, e3)
        val s13 = matcher.computeCosineSimilarity(e1, e3)

        val lowest = minOf(s12, minOf(s23, s13))
        if (lowest < minCrossSimilarity) {
            return EnrollmentValidationResult.InconsistentIdentity(
                lowestSimilarity = lowest,
                requiredThreshold = minCrossSimilarity,
                reason = "Cross-sample similarity ($lowest) fell below consistency threshold ($minCrossSimilarity). Please re-enroll in stable lighting."
            )
        }

        // Master composite calculation: mean vector + L2-normalization
        val master = computeMasterEmbedding(listOf(e1, e2, e3))

        return EnrollmentValidationResult.Success(
            masterEmbedding = master,
            templates = listOf(e1, e2, e3),
            crossSimilarities = listOf(s12, s23, s13)
        )
    }

    /**
     * Averages multiple 512-D embedding vectors and applies L2-normalization.
     */
    fun computeMasterEmbedding(embeddings: List<FloatArray>): FloatArray {
        require(embeddings.isNotEmpty()) { "Embeddings list cannot be empty" }
        val dim = embeddings.first().size
        val accum = FloatArray(dim)

        for (emb in embeddings) {
            for (i in 0 until dim) {
                accum[i] += emb[i]
            }
        }

        val count = embeddings.size.toFloat()
        for (i in 0 until dim) {
            accum[i] /= count
        }

        return MobileFaceNetEmbedder.l2Normalize(accum)
    }
}
