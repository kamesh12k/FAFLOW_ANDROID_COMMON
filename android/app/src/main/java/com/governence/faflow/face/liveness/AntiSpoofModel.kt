package com.governence.faflow.face.liveness

import android.graphics.Bitmap
import com.governence.faflow.face.model.SpoofType

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
 */
class DefaultAntiSpoofModel : AntiSpoofModel {
    override val isModelLoaded: Boolean = false

    override suspend fun predict(alignedFace: Bitmap): AntiSpoofPrediction {
        // Safe baseline: Relies on passive temporal motion and active head pose challenge
        return AntiSpoofPrediction(
            realFaceProbability = 1.0f,
            spoofProbability = 0.0f,
            predictedType = SpoofType.NONE,
            isLive = true
        )
    }
}
