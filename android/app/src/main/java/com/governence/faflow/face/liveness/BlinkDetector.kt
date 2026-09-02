package com.governence.faflow.face.liveness

import com.governence.faflow.face.model.FaceLandmarks

/**
 * Pluggable provider interface for eye aspect ratio (EAR) landmark extraction.
 */
interface EyeLandmarkProvider {
    val isDenseLandmarksSupported: Boolean
    fun computeEyeAspectRatio(landmarks: FaceLandmarks): Float?
}

/**
 * Standard 5-point landmark fallback for Blink Detection.
 * NOTE: 5-point SCRFD landmarks provide eye center points rather than upper/lower eyelid contours.
 * For production EAR (Eye Aspect Ratio) calculation, a dense 68-point / 468-point landmark detector is utilized.
 */
class DefaultEyeLandmarkProvider : EyeLandmarkProvider {
    override val isDenseLandmarksSupported: Boolean = false

    override fun computeEyeAspectRatio(landmarks: FaceLandmarks): Float? {
        // Fallback: 5-point landmarks do not contain vertical eyelid coordinates.
        return null
    }
}

/**
 * Evaluates blink events across a temporal window of EAR measurements.
 */
class BlinkDetector(
    private val provider: EyeLandmarkProvider = DefaultEyeLandmarkProvider()
) {
    private val earHistory = ArrayList<Float>()
    private var isBlinkDetected = false

    fun reset() {
        earHistory.clear()
        isBlinkDetected = false
    }

    fun processFrame(landmarks: FaceLandmarks): Boolean {
        val ear = provider.computeEyeAspectRatio(landmarks) ?: return false
        earHistory.add(ear)

        if (earHistory.size > 10) {
            earHistory.removeAt(0)
        }

        // Simple threshold dip detection
        if (earHistory.size >= 3) {
            val minEar = earHistory.minOrNull() ?: 1.0f
            val maxEar = earHistory.maxOrNull() ?: 1.0f
            if (maxEar - minEar > 0.15f && minEar < 0.20f) {
                isBlinkDetected = true
            }
        }

        return isBlinkDetected
    }
}
