package com.governence.faflow.attendance.biometrics.liveness

import android.graphics.Bitmap
import com.governence.faflow.attendance.biometrics.model.FaceDetectionResult
import com.governence.faflow.attendance.biometrics.model.FaceLandmarks
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/**
 * Result of eye state evaluation on a single frame.
 */
data class EyeStateResult(
    val leftEyeOpenness: Float,
    val rightEyeOpenness: Float,
    val ear: Float,
    val isEyesClosed: Boolean,
    val isEyesOpen: Boolean,
    val confidence: Float = 1.0f
)

/**
 * Pluggable provider interface for extracting eye state & EAR measurements.
 */
interface EyeStateProvider {
    val isDenseLandmarksSupported: Boolean
    fun computeEyeState(bitmap: Bitmap?, face: FaceDetectionResult): EyeStateResult?
    fun computeEyeAspectRatio(landmarks: FaceLandmarks): Float?
}

/**
 * Interface for reading pixel colors, enabling decoupled unit testing on the JVM without native Bitmap mocks.
 */
fun interface PixelReader {
    fun getPixel(x: Int, y: Int): Int
}

/**
 * Detailed facial-landmark component specifically dedicated to eye aperture
 * and Eye Aspect Ratio (EAR) extraction for the Blink Detector.
 *
 * Operates non-disruptively on top of SCRFD detections:
 * 1. Locates eye bounding regions from primary facial landmarks.
 * 2. Crops high-resolution ocular patches for left and right eyes.
 * 3. Computes vertical-to-horizontal gradient ratio and central pupil-to-eyelid contrast.
 * 4. Yields a normalized EAR (Eye Aspect Ratio) metric between 0.0 (fully shut) and 1.0 (wide open).
 */
class DetailedEyeLandmarkProvider(
    private val closedThreshold: Float = 0.142f,
    private val openThreshold: Float = 0.158f
) : EyeStateProvider {

    override val isDenseLandmarksSupported: Boolean = true

    override fun computeEyeAspectRatio(landmarks: FaceLandmarks): Float? {
        // SCRFD 5-point keypoints provide eye centers; direct geometric EAR requires eyelid contours.
        // Detailed ocular patch analysis via computeEyeState is used instead.
        return null
    }

    override fun computeEyeState(bitmap: Bitmap?, face: FaceDetectionResult): EyeStateResult? {
        if (bitmap == null) return null
        return computeEyeStateFromReader(
            reader = { x, y -> bitmap.getPixel(x, y) },
            imageWidth = bitmap.width,
            imageHeight = bitmap.height,
            face = face
        )
    }

    fun computeEyeStateFromReader(
        reader: PixelReader,
        imageWidth: Int,
        imageHeight: Int,
        face: FaceDetectionResult
    ): EyeStateResult? {
        val landmarks = face.landmarks ?: return null

        // Scale-invariant eye region calculation:
        // Use inter-ocular distance between eye centers. This is completely immune to
        // normalized vs absolute bounding box representations.
        val eyeDistance = kotlin.math.hypot(
            landmarks.rightEye.x - landmarks.leftEye.x,
            landmarks.rightEye.y - landmarks.leftEye.y
        ).coerceIn(20f, imageWidth.toFloat())

        // An eye occupies approximately 34% width and 24% height of the inter-ocular distance
        val eyeCropW = (eyeDistance * 0.36f).toInt().coerceIn(16, imageWidth / 4)
        val eyeCropH = (eyeDistance * 0.24f).toInt().coerceIn(12, imageHeight / 4)

        val leftEyeScore = analyzeEyePatch(
            reader = reader,
            imageWidth = imageWidth,
            imageHeight = imageHeight,
            centerX = landmarks.leftEye.x.toInt(),
            centerY = landmarks.leftEye.y.toInt(),
            halfW = eyeCropW / 2,
            halfH = eyeCropH / 2
        )

        val rightEyeScore = analyzeEyePatch(
            reader = reader,
            imageWidth = imageWidth,
            imageHeight = imageHeight,
            centerX = landmarks.rightEye.x.toInt(),
            centerY = landmarks.rightEye.y.toInt(),
            halfW = eyeCropW / 2,
            halfH = eyeCropH / 2
        )

        val avgEar = (leftEyeScore + rightEyeScore) / 2.0f
        val isClosed = avgEar <= closedThreshold
        val isOpen = avgEar >= openThreshold

        return EyeStateResult(
            leftEyeOpenness = leftEyeScore,
            rightEyeOpenness = rightEyeScore,
            ear = avgEar,
            isEyesClosed = isClosed,
            isEyesOpen = isOpen,
            confidence = face.confidence
        )
    }

    /**
     * Measures ocular aperture across the cropped eye patch.
     *
     * In an OPEN eye:
     * - The center contains a dark pupil and iris.
     * - The lateral sides (left/right flanks) contain brighter sclera.
     * - The upper and lower margins are eyelids.
     * - Result: A distinct central dip in luminance (sclera > center) AND vertical contrast.
     *
     * In a CLOSED eye:
     * - The eyelid completely covers the iris and sclera with continuous, uniform skin.
     * - Center luminance is equal to lateral and vertical luminance.
     * - Result: Central dip collapses towards zero, vertical aperture metric drops sharply (< 0.14).
     */
    private fun analyzeEyePatch(
        reader: PixelReader,
        imageWidth: Int,
        imageHeight: Int,
        centerX: Int,
        centerY: Int,
        halfW: Int,
        halfH: Int
    ): Float {
        val startX = max(0, centerX - halfW)
        val endX = min(imageWidth - 1, centerX + halfW)
        val startY = max(0, centerY - halfH)
        val endY = min(imageHeight - 1, centerY + halfH)

        val patchW = endX - startX
        val patchH = endY - startY
        if (patchW < 8 || patchH < 6) return 0.25f // default neutral

        var totalCenterLuma = 0f
        var centerPixels = 0

        var totalLateralLuma = 0f
        var lateralPixels = 0

        var totalLidLuma = 0f
        var lidPixels = 0

        var minLuma = 255f
        var maxLuma = 0f

        val stepX = max(1, patchW / 14)
        val stepY = max(1, patchH / 10)

        // Subdivide patch into relative zones:
        // Horizontal: Left Flank [0 .. 30%], Center Core [35% .. 65%], Right Flank [70% .. 100%]
        // Vertical: Upper Lid [0 .. 25%], Center Core [30% .. 70%], Lower Lid [75% .. 100%]
        for (y in startY until endY step stepY) {
            val relY = (y - startY).toFloat() / patchH
            val isVerticalCenter = relY in 0.25f..0.75f

            for (x in startX until endX step stepX) {
                val p = reader.getPixel(x, y)
                val luma = (0.299f * ((p shr 16) and 0xFF)) +
                        (0.587f * ((p shr 8) and 0xFF)) +
                        (0.114f * (p and 0xFF))

                if (luma < minLuma) minLuma = luma
                if (luma > maxLuma) maxLuma = luma

                val relX = (x - startX).toFloat() / patchW

                if (isVerticalCenter) {
                    if (relX in 0.30f..0.70f) {
                        totalCenterLuma += luma
                        centerPixels++
                    } else if (relX < 0.25f || relX > 0.75f) {
                        totalLateralLuma += luma
                        lateralPixels++
                    }
                } else {
                    totalLidLuma += luma
                    lidPixels++
                }
            }
        }

        val avgCenter = if (centerPixels > 0) totalCenterLuma / centerPixels else 128f
        val avgLateral = if (lateralPixels > 0) totalLateralLuma / lateralPixels else avgCenter
        val avgLid = if (lidPixels > 0) totalLidLuma / lidPixels else avgCenter

        // Metric 1: Iris-to-Sclera horizontal contrast
        // When open, white sclera is distinctly brighter than the central iris/pupil: avgLateral > avgCenter
        val irisContrast = max(0f, avgLateral - avgCenter) / max(1f, avgLateral)

        // Metric 2: Vertical eyelid-to-center contrast
        // When open, the central fissure is dark relative to the upper/lower margin
        val verticalAperture = max(0f, avgLid - avgCenter) / max(1f, avgLid)

        // Metric 3: Internal contrast aperture
        val centralContrast = (maxLuma - avgCenter) / max(1f, maxLuma)

        // Composite EAR estimate:
        // In an open eye, avgLateral > avgCenter and avgLid > avgCenter produce values ~ 0.25 - 0.45.
        // When eyelids close, avgCenter equals avgLateral and avgLid, dropping both metrics to 0.0, yielding EAR < 0.14.
        val ear = (irisContrast * 0.45f) + (verticalAperture * 0.40f) + (centralContrast * 0.15f)
        return ear.coerceIn(0.06f, 0.48f)
    }
}
