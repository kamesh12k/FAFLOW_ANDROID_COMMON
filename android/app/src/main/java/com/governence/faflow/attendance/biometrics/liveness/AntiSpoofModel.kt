package com.governence.faflow.attendance.biometrics.liveness

import android.graphics.Bitmap
import com.governence.faflow.attendance.biometrics.model.SpoofType

/**
 * Result of deep neural network anti-spoofing presentation attack analysis.
 */
data class AntiSpoofPrediction(
    val realFaceProbability: Float,
    val spoofProbability: Float,
    val predictedType: SpoofType,
    val isLive: Boolean
)

/**
 * Pluggable interface for deep neural network Presentation Attack Detection (PAD).
 */
interface AntiSpoofModel {
    val isModelLoaded: Boolean
    suspend fun predict(alignedFace: Bitmap): AntiSpoofPrediction
}

/**
 * Fallback baseline PAD predictor when ONNX weights are not bundled.
 *
 * SECURITY: This stub is FAIL-CLOSED by design (isLive = false).
 * When no deep anti-spoofing ONNX model is available, the system MUST NOT
 * silently pass all faces as live. Instead, the liveness decision defers
 * entirely to the MotionAnalyzer (static landmark variance) and the
 * ActiveLivenessDetector (head-pose challenge) — which are real defenses.
 *
 * DO NOT change isLive to true here. That would be a fail-open vulnerability.
 */
class DefaultAntiSpoofModel : AntiSpoofModel {
    override val isModelLoaded: Boolean = false

    override suspend fun predict(alignedFace: Bitmap): AntiSpoofPrediction {
        // FAIL CLOSED: no ONNX model → report inconclusive (not live).
        // Liveness decision falls through to MotionAnalyzer and ActiveLivenessDetector.
        return AntiSpoofPrediction(
            realFaceProbability = 0.0f,
            spoofProbability = 1.0f,
            predictedType = SpoofType.UNKNOWN,
            isLive = false
        )
    }
}
