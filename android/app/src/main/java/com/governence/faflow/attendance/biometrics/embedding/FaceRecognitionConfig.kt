package com.governence.faflow.attendance.biometrics.embedding

import com.governence.faflow.attendance.biometrics.alignment.FaceAlignmentConfig

/**
 * Institutional face recognition configuration and threshold boundaries.
 */
data class FaceRecognitionConfig(
    /**
     * Cosine similarity threshold for 1-to-1 staff verification.
     * Tuned empirically against MobileFaceNet embeddings (standard operating threshold: 0.45f - 0.60f).
     */
    val similarityThreshold: Float = 0.60f,
    val livenessRequired: Boolean = true,
    val maxFaces: Int = 1,
    val embeddingDimension: Int = 512,
    val modelVersion: String = "InsightFace-MobileFaceNet-ArcFace-v1",
    val alignmentVersion: String = FaceAlignmentConfig.ALIGNMENT_VERSION,
    val inputResolution: Int = 112,
    val minEnrollmentSamples: Int = 3,
    val enrollmentConsistencyThreshold: Float = 0.70f
) {
    companion object {
        val DEFAULT = FaceRecognitionConfig()
    }
}
