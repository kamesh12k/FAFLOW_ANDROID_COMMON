package com.governence.faflow.face.alignment

import com.governence.faflow.face.model.FacePoint

/**
 * Configuration and canonical reference template constants for 5-point facial alignment.
 */
object FaceAlignmentConfig {
    const val TARGET_WIDTH = 112
    const val TARGET_HEIGHT = 112
    const val ALIGNMENT_VERSION = "Umeyama-112x112-v1"

    // InsightFace standard ArcFace 112x112 reference landmarks
    val REFERENCE_LANDMARKS = listOf(
        FacePoint(38.2946f, 51.6963f), // Left Eye
        FacePoint(73.5318f, 51.5014f), // Right Eye
        FacePoint(56.0252f, 71.7366f), // Nose Tip
        FacePoint(41.5493f, 92.3655f), // Left Mouth Corner
        FacePoint(70.7299f, 92.2041f)  // Right Mouth Corner
    )

    // Validation thresholds
    const val MIN_EYE_DISTANCE_PX = 12.0f
    const val MIN_LANDMARK_CONFIDENCE = 0.50f
    const val MAX_ALLOWED_YAW_DEG = 35.0f
    const val MAX_ALLOWED_PITCH_DEG = 30.0f
}
