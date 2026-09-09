package com.governence.faflow.attendance.biometrics.alignment

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.Paint
import android.os.SystemClock
import com.governence.faflow.attendance.biometrics.FaceAligner as CommonFaceAligner
import com.governence.faflow.attendance.biometrics.model.FaceLandmarks
import com.governence.faflow.attendance.biometrics.model.FacePoint
import kotlin.math.sqrt

/**
 * Production-grade [FaceAligner]: a 2D similarity transform (rotation + uniform scale + translation,
 * no shear) mapping 5 detected landmarks onto the canonical ArcFace 112x112 reference template,
 * warping the original frame directly onto a 112x112 canvas without lossy intermediate cropping.
 *
 * Implements both [com.governence.faflow.attendance.biometrics.FaceAligner] and [com.governence.faflow.attendance.biometrics.alignment.FaceAligner]
 * for full architectural interoperability across all FAFLOW subsystems.
 *
 * Reference: S. Umeyama, "Least-Squares Estimation of Transformation Parameters Between Two
 * Point Patterns", IEEE TPAMI, 1991.
 */
class SimilarityFaceAligner(
    private val outputSize: Int = OUTPUT_SIZE
) : CommonFaceAligner, FaceAligner {

    /**
     * Primary contract for [com.governence.faflow.attendance.biometrics.FaceAligner].
     * Warps [bitmap] using 5-point similarity transformation to [outputSize]x[outputSize].
     */
    override fun alignFace(bitmap: Bitmap, landmarks: FaceLandmarks): Bitmap {
        val result = align(bitmap, landmarks)
        if (result.isValidGeometry && result.alignedBitmap != null) {
            return result.alignedBitmap
        }
        // Fallback: If biological landmark validation fails, center-crop/scale safely
        return if (bitmap.width == outputSize && bitmap.height == outputSize) {
            bitmap
        } else {
            Bitmap.createScaledBitmap(bitmap, outputSize, outputSize, true)
        }
    }

    /**
     * Contract for [com.governence.faflow.attendance.biometrics.alignment.FaceAligner] returning detailed alignment telemetry.
     */
    override fun align(sourceBitmap: Bitmap, landmarks: FaceLandmarks): FaceAlignmentResult {
        val startTime = SystemClock.elapsedRealtime()

        // 1. Biological Landmark Sanity Validation
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

        // 2. Solve 2D Similarity Least-Squares Transform
        val src = landmarks.toPointList().map { it.x to it.y }
        val dst = referencePoints(outputSize)

        val transform = solveSimilarityTransform(src, dst)
        if (transform == null) {
            return FaceAlignmentResult(
                alignedBitmap = null,
                transform = null,
                sourceLandmarks = landmarks,
                isValidGeometry = false,
                errorMessage = "Singular similarity transform: collinear or degenerate landmark geometry",
                latencyMs = SystemClock.elapsedRealtime() - startTime
            )
        }

        // 3. Render directly from original bitmap onto 112x112 target canvas
        val matrix = Matrix().apply {
            setValues(
                floatArrayOf(
                    transform.a, -transform.b, transform.tx,
                    transform.b, transform.a, transform.ty,
                    0f, 0f, 1f
                )
            )
        }

        val aligned = Bitmap.createBitmap(outputSize, outputSize, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(aligned)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
        canvas.drawBitmap(sourceBitmap, matrix, paint)

        val similarityTransform = SimilarityTransform(
            scale = sqrt((transform.a * transform.a + transform.b * transform.b).toDouble()).toFloat(),
            rotationAngleRad = kotlin.math.atan2(transform.b.toDouble(), transform.a.toDouble()).toFloat(),
            tx = transform.tx,
            ty = transform.ty,
            a = transform.a,
            b = -transform.b,
            c = transform.b,
            d = transform.a
        )

        val latencyMs = SystemClock.elapsedRealtime() - startTime

        return FaceAlignmentResult(
            alignedBitmap = aligned,
            transform = similarityTransform,
            sourceLandmarks = landmarks,
            isValidGeometry = true,
            errorMessage = null,
            latencyMs = latencyMs
        )
    }

    /**
     * Validates landmark coordinates for spatial consistency and ordering.
     */
    fun validateLandmarks(landmarks: FaceLandmarks, imageWidth: Int, imageHeight: Int): String? {
        val pts = landmarks.toPointList()

        // Boundary sanity
        for (pt in pts) {
            if (pt.x < 0 || pt.y < 0 || pt.x > imageWidth || pt.y > imageHeight) {
                return "Landmarks fall outside camera frame boundaries"
            }
        }

        // Inter-pupillary distance
        val eyeDx = landmarks.rightEye.x - landmarks.leftEye.x
        val eyeDy = landmarks.rightEye.y - landmarks.leftEye.y
        val eyeDistance = sqrt((eyeDx * eyeDx + eyeDy * eyeDy).toDouble()).toFloat()

        if (eyeDistance < FaceAlignmentConfig.MIN_EYE_DISTANCE_PX) {
            return "Inter-pupillary distance too small (${"%.1f".format(eyeDistance)}px < ${FaceAlignmentConfig.MIN_EYE_DISTANCE_PX}px)"
        }

        // Eye ordering
        if (landmarks.leftEye.x >= landmarks.rightEye.x) {
            return "Inverted eye order: left eye x >= right eye x"
        }

        // Nose below eye midpoint
        val eyeMidY = (landmarks.leftEye.y + landmarks.rightEye.y) / 2f
        if (landmarks.nose.y <= eyeMidY) {
            return "Inverted nose position: nose tip above eye midpoint"
        }

        // Mouth corners below nose
        if (landmarks.leftMouth.y <= landmarks.nose.y || landmarks.rightMouth.y <= landmarks.nose.y) {
            return "Inverted mouth position: mouth corners above nose tip"
        }

        // Mouth ordering
        if (landmarks.leftMouth.x >= landmarks.rightMouth.x) {
            return "Inverted mouth corners: left mouth x >= right mouth x"
        }

        return null
    }

    private data class TransformParams(val a: Float, val b: Float, val tx: Float, val ty: Float)

    /**
     * Solves closed-form 2D similarity transform mapping src points to dst points:
     * (x', y') = (a*x - b*y + tx, b*x + a*y + ty)
     */
    private fun solveSimilarityTransform(
        src: List<Pair<Float, Float>>,
        dst: List<Pair<Float, Float>>
    ): TransformParams? {
        if (src.size != dst.size || src.size < 3) return null
        val n = src.size

        val srcCx = src.sumOf { it.first.toDouble() }.toFloat() / n
        val srcCy = src.sumOf { it.second.toDouble() }.toFloat() / n
        val dstCx = dst.sumOf { it.first.toDouble() }.toFloat() / n
        val dstCy = dst.sumOf { it.second.toDouble() }.toFloat() / n

        var numA = 0f
        var numB = 0f
        var denom = 0f

        for (i in 0 until n) {
            val x = src[i].first - srcCx
            val y = src[i].second - srcCy
            val xp = dst[i].first - dstCx
            val yp = dst[i].second - dstCy

            numA += x * xp + y * yp
            numB += x * yp - y * xp
            denom += x * x + y * y
        }

        if (denom <= 1e-6f) return null

        val a = numA / denom
        val b = numB / denom

        val tx = dstCx - (a * srcCx - b * srcCy)
        val ty = dstCy - (b * srcCx + a * srcCy)

        return TransformParams(a, b, tx, ty)
    }

    companion object {
        const val OUTPUT_SIZE = 112

        /**
         * Standard ArcFace / InsightFace 112x112 canonical 5-point reference template:
         * 1. Left eye: (38.2946, 51.6963)
         * 2. Right eye: (73.5318, 51.5014)
         * 3. Nose tip: (56.0252, 71.7366)
         * 4. Left mouth corner: (41.5493, 92.3655)
         * 5. Right mouth corner: (70.7299, 92.2041)
         */
        fun referencePoints(size: Int): List<Pair<Float, Float>> {
            val base = listOf(
                38.2946f to 51.6963f,
                73.5318f to 51.5014f,
                56.0252f to 71.7366f,
                41.5493f to 92.3655f,
                70.7299f to 92.2041f
            )
            if (size == 112) return base
            val scale = size / 112f
            return base.map { (x, y) -> x * scale to y * scale }
        }
    }
}
