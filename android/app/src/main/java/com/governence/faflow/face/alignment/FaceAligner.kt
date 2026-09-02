package com.governence.faflow.face.alignment

import android.graphics.Bitmap
import android.graphics.Matrix
import com.governence.faflow.face.model.FaceLandmarks
import com.governence.faflow.face.model.FacePoint

/**
 * Mathematical 2D similarity transform parameters.
 */
data class SimilarityTransform(
    val scale: Float,
    val rotationAngleRad: Float,
    val tx: Float,
    val ty: Float,
    val a: Float,
    val b: Float,
    val c: Float,
    val d: Float
) {
    fun toMatrix(): Matrix {
        val matrix = Matrix()
        val values = floatArrayOf(
            a, b, tx,
            c, d, ty,
            0f, 0f, 1f
        )
        matrix.setValues(values)
        return matrix
    }
}

/**
 * Structured outcome of 5-point facial landmark canonical alignment.
 */
data class FaceAlignmentResult(
    val alignedBitmap: Bitmap?,
    val transform: SimilarityTransform?,
    val sourceLandmarks: FaceLandmarks,
    val targetLandmarks: List<FacePoint> = FaceAlignmentConfig.REFERENCE_LANDMARKS,
    val isValidGeometry: Boolean,
    val errorMessage: String? = null,
    val latencyMs: Long = 0L
)

/**
 * Contract for 5-point facial similarity alignment to canonical 112x112 space.
 */
interface FaceAligner {
    /**
     * Aligns a detected face using its 5 primary facial landmarks into canonical 112x112 dimensions.
     * Operates strictly on source camera-frame coordinate space.
     */
    fun align(
        sourceBitmap: Bitmap,
        landmarks: FaceLandmarks
    ): FaceAlignmentResult
}
