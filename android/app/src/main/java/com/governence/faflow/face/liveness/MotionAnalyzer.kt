package com.governence.faflow.face.liveness

import com.governence.faflow.face.model.FaceLandmarks
import java.util.LinkedList
import kotlin.math.sqrt

/**
 * Temporal motion and micro-variation analyzer detecting static photo attacks and replay cuts.
 */
class MotionAnalyzer(
    private val config: LivenessConfig = LivenessConfig.DEFAULT
) {

    private val observations = LinkedList<FaceObservation>()

    fun clear() {
        observations.clear()
    }

    fun addObservation(observation: FaceObservation) {
        observations.addLast(observation)
        while (observations.size > config.temporalWindowSize) {
            observations.removeFirst()
        }
    }

    val observationCount: Int get() = observations.size

    /**
     * Evaluates presentation attack risk across the current temporal window.
     */
    fun evaluateMotionRisk(): PresentationAttackRisk {
        if (observations.size < config.minimumObservations) {
            return PresentationAttackRisk.LOW
        }

        // 1. Check for Abrupt Discontinuity (Screen / Photo Swap Attack)
        for (i in 0 until observations.size - 1) {
            val curr = observations[i].boundingBox
            val next = observations[i + 1].boundingBox

            val dx = next.centerX - curr.centerX
            val dy = next.centerY - curr.centerY
            val dist = sqrt((dx * dx + dy * dy).toDouble()).toFloat()

            if (dist > config.maxAllowedPositionDiscontinuityPx) {
                return PresentationAttackRisk.HIGH
            }
        }

        // 2. Check for Static Photo Attack (Zero Landmark Variance)
        val landmarksList = observations.mapNotNull { it.landmarks }
        if (landmarksList.size >= config.minimumObservations) {
            val variance = calculateLandmarkVariance(landmarksList)
            if (variance < config.staticPhotoVarianceThreshold) {
                return PresentationAttackRisk.HIGH
            }
        }

        return PresentationAttackRisk.LOW
    }

    /**
     * Calculates spatial variance of landmark positions over time.
     */
    fun calculateLandmarkVariance(landmarksList: List<FaceLandmarks>): Float {
        if (landmarksList.size < 2) return 1.0f

        val noseXList = landmarksList.map { it.nose.x }
        val noseYList = landmarksList.map { it.nose.y }

        val meanX = noseXList.average().toFloat()
        val meanY = noseYList.average().toFloat()

        var sumSq = 0.0
        for (i in noseXList.indices) {
            val dx = noseXList[i] - meanX
            val dy = noseYList[i] - meanY
            sumSq += (dx * dx + dy * dy)
        }

        return (sumSq / noseXList.size).toFloat()
    }
}
