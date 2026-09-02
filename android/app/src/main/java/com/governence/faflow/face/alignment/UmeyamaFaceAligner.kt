package com.governence.faflow.face.alignment

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.os.SystemClock
import com.governence.faflow.face.model.FaceLandmarks
import com.governence.faflow.face.model.FacePoint
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * Robust implementation of the Umeyama 2D similarity transform for canonical 5-point face alignment.
 */
class UmeyamaFaceAligner : FaceAligner {

    override fun align(
        sourceBitmap: Bitmap,
        landmarks: FaceLandmarks
    ): FaceAlignmentResult {
        val startTime = SystemClock.elapsedRealtime()

        // 1. Geometric Validation
        val validationError = validateLandmarks(landmarks, sourceBitmap.width, sourceBitmap.height)
        if (validationError != null) {
            return FaceAlignmentResult(
                alignedBitmap = null,
                transform = null,
                sourceLandmarks = landmarks,
                isValidGeometry = false,
                errorMessage = validationError,
                latencyMs = SystemClock.elapsedRealtime() - startTime
            )
        }

        // 2. Estimate 2D Similarity Transform Matrix (Scale, Rotation, Translation)
        val srcPoints = landmarks.toPointList()
        val dstPoints = FaceAlignmentConfig.REFERENCE_LANDMARKS

        val transform = estimateSimilarityTransform(srcPoints, dstPoints)
        if (transform == null) {
            return FaceAlignmentResult(
                alignedBitmap = null,
                transform = null,
                sourceLandmarks = landmarks,
                isValidGeometry = false,
                errorMessage = "Failed to calculate singular similarity transform matrix",
                latencyMs = SystemClock.elapsedRealtime() - startTime
            )
        }

        // 3. Render Aligned 112x112 Canonical Face Bitmap
        val alignedBitmap = Bitmap.createBitmap(
            FaceAlignmentConfig.TARGET_WIDTH,
            FaceAlignmentConfig.TARGET_HEIGHT,
            Bitmap.Config.ARGB_8888
        )
        val canvas = Canvas(alignedBitmap)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
        canvas.drawBitmap(sourceBitmap, transform.toMatrix(), paint)

        val latencyMs = SystemClock.elapsedRealtime() - startTime

        return FaceAlignmentResult(
            alignedBitmap = alignedBitmap,
            transform = transform,
            sourceLandmarks = landmarks,
            isValidGeometry = true,
            errorMessage = null,
            latencyMs = latencyMs
        )
    }

    /**
     * Validates biological facial landmarks for spatial consistency.
     */
    fun validateLandmarks(landmarks: FaceLandmarks, imageWidth: Int, imageHeight: Int): String? {
        val pts = landmarks.toPointList()

        // Boundary check
        for (pt in pts) {
            if (pt.x < 0 || pt.y < 0 || pt.x > imageWidth || pt.y > imageHeight) {
                return "Landmark coordinates outside image boundary"
            }
        }

        // Eye distance
        val eyeDx = landmarks.rightEye.x - landmarks.leftEye.x
        val eyeDy = landmarks.rightEye.y - landmarks.leftEye.y
        val eyeDistance = sqrt((eyeDx * eyeDx + eyeDy * eyeDy).toDouble()).toFloat()

        if (eyeDistance < FaceAlignmentConfig.MIN_EYE_DISTANCE_PX) {
            return "Inter-pupillary distance too small (${eyeDistance}px < ${FaceAlignmentConfig.MIN_EYE_DISTANCE_PX}px)"
        }

        // Left eye must be to the left of the right eye
        if (landmarks.leftEye.x >= landmarks.rightEye.x) {
            return "Inverted eye order: left eye x (${landmarks.leftEye.x}) >= right eye x (${landmarks.rightEye.x})"
        }

        // Nose must be vertically below the eye midpoint
        val eyeMidY = (landmarks.leftEye.y + landmarks.rightEye.y) / 2f
        if (landmarks.nose.y <= eyeMidY) {
            return "Inverted nose position: nose y (${landmarks.nose.y}) <= eye mid y ($eyeMidY)"
        }

        // Mouth corners must be below the nose
        if (landmarks.leftMouth.y <= landmarks.nose.y || landmarks.rightMouth.y <= landmarks.nose.y) {
            return "Inverted mouth position: mouth corners above nose tip"
        }

        // Left mouth corner must be to the left of the right mouth corner
        if (landmarks.leftMouth.x >= landmarks.rightMouth.x) {
            return "Inverted mouth corners: left mouth x >= right mouth x"
        }

        return null
    }

    /**
     * Estimates 2D Umeyama Similarity Transformation mapping src -> dst.
     */
    fun estimateSimilarityTransform(
        src: List<FacePoint>,
        dst: List<FacePoint>
    ): SimilarityTransform? {
        val n = src.size
        if (n != dst.size || n < 3) return null

        // Calculate means
        var srcMeanX = 0.0
        var srcMeanY = 0.0
        var dstMeanX = 0.0
        var dstMeanY = 0.0

        for (i in 0 until n) {
            srcMeanX += src[i].x
            srcMeanY += src[i].y
            dstMeanX += dst[i].x
            dstMeanY += dst[i].y
        }
        srcMeanX /= n
        srcMeanY /= n
        dstMeanX /= n
        dstMeanY /= n

        // Centered coordinates and variances
        var srcVar = 0.0
        var s11 = 0.0
        var s12 = 0.0
        var s21 = 0.0
        var s22 = 0.0

        for (i in 0 until n) {
            val sx = src[i].x - srcMeanX
            val sy = src[i].y - srcMeanY
            val dx = dst[i].x - dstMeanX
            val dy = dst[i].y - dstMeanY

            srcVar += sx * sx + sy * sy

            s11 += dx * sx
            s12 += dx * sy
            s21 += dy * sx
            s22 += dy * sy
        }

        srcVar /= n
        s11 /= n
        s12 /= n
        s21 /= n
        s22 /= n

        if (srcVar <= 1e-8) return null

        // Rotation angle theta via 2D covariance decomposition
        val theta = atan2(s21 - s12, s11 + s22)
        val cosTheta = cos(theta)
        val sinTheta = sin(theta)

        // Scale factor s
        val scale = (cosTheta * s11 - sinTheta * s12 + sinTheta * s21 + cosTheta * s22) / srcVar

        if (scale.isNaN() || scale.isInfinite() || scale <= 0.0) return null

        // Translation vector t = dstMean - scale * R * srcMean
        val tx = dstMeanX - scale * (cosTheta * srcMeanX - sinTheta * srcMeanY)
        val ty = dstMeanY - scale * (sinTheta * srcMeanX + cosTheta * srcMeanY)

        val a = (scale * cosTheta).toFloat()
        val b = (-scale * sinTheta).toFloat()
        val c = (scale * sinTheta).toFloat()
        val d = (scale * cosTheta).toFloat()

        return SimilarityTransform(
            scale = scale.toFloat(),
            rotationAngleRad = theta.toFloat(),
            tx = tx.toFloat(),
            ty = ty.toFloat(),
            a = a,
            b = b,
            c = c,
            d = d
        )
    }
}
