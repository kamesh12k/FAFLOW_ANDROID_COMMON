package com.governence.faflow.face.model

/**
 * Metadata and structural constants for the InsightFace SCRFD model.
 */
object ScrfdModelMetadata {
    const val MODEL_FILE_NAME = "models/scrfd_500m_kps.onnx"
    const val MODEL_ID = "insightface-scrfd-500m-kps"
    const val MODEL_NAME = "InsightFace SCRFD 500M KPS"
    const val MODEL_VERSION = "1.0.0"

    const val INPUT_WIDTH = 640
    const val INPUT_HEIGHT = 640
    const val INPUT_CHANNELS = 3

    val INPUT_MEAN = floatArrayOf(127.5f, 127.5f, 127.5f)
    val INPUT_STD = floatArrayOf(128.0f, 128.0f, 128.0f)

    val STRIDES = intArrayOf(8, 16, 32)
    const val NUM_ANCHORS_PER_STRIDE = 2

    const val DEFAULT_SCORE_THRESHOLD = 0.50f
    const val DEFAULT_NMS_IOU_THRESHOLD = 0.40f
    const val MIN_FACE_SIZE_PIXELS = 80f
}
