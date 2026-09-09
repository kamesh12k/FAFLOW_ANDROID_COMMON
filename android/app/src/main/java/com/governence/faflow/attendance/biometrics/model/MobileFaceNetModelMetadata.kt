package com.governence.faflow.attendance.biometrics.model

/**
 * Metadata and structural constants for the MobileFaceNet / ArcFace embedding model
 * (e.g. InsightFace buffalo_sc's `w600k_mbf.onnx` — WebFace600K-trained MobileFaceNet,
 * 512-dim output).
 */
object MobileFaceNetModelMetadata {
    const val MODEL_FILE_NAME = "models/w600k_mbf.onnx"
    const val MODEL_ID = "insightface-w600k-mbf"
    const val MODEL_NAME = "InsightFace MobileFaceNet (w600k_mbf)"
    const val MODEL_VERSION = "w600k_mbf_v1"

    const val INPUT_SIZE = 112
    const val EMBEDDING_DIM = 512
}
