package com.governence.faflow.face.liveness

/**
 * Centralized configuration and mathematical thresholds for face liveness and anti-spoofing.
 */
data class LivenessConfig(
    val challengeCount: Int = 2,
    val challengeTimeoutMs: Long = 5000L,
    val leftTurnYawDegrees: Float = -18.0f,
    val rightTurnYawDegrees: Float = 18.0f,
    val lookUpPitchDegrees: Float = -12.0f,
    val lookDownPitchDegrees: Float = 12.0f,
    val temporalWindowSize: Int = 20,
    val minimumObservations: Int = 5,
    val staticPhotoVarianceThreshold: Float = 0.40f,
    val maxAllowedPositionDiscontinuityPx: Float = 160.0f,
    val isDeepAntiSpoofingEnabled: Boolean = false,
    val passScoreThreshold: Float = 0.75f
) {
    companion object {
        val DEFAULT = LivenessConfig()
    }
}
