package com.governence.faflow.face.embedding

import com.governence.faflow.face.alignment.FaceAlignmentConfig

/**
 * Institutional face recognition configuration and threshold boundaries.
 */
data class FaceRecognitionConfig(
    /**
     * Cosine similarity threshold for 1-to-1 staff verification.
     * NOTE: Requires institutional validation and calibration based on operational lighting conditions.
     */
    val similarityThreshold: Float = 0.60f,
    val embeddingDimension: Int = 512,
    val modelVersion: String = "InsightFace-MobileFaceNet-ArcFace-v1",
    val alignmentVersion: String = FaceAlignmentConfig.ALIGNMENT_VERSION,
    val inputResolution: Int = 112
) {
    companion object {
        val DEFAULT = FaceRecognitionConfig()
    }
}
