package com.governence.faflow.face.scrfd

import com.governence.faflow.face.model.FaceBox
import com.governence.faflow.face.model.FaceDetectionResult
import com.governence.faflow.face.model.FaceQuality
import com.governence.faflow.face.model.ScrfdModelMetadata
import kotlin.math.atan2

/**
 * Post-processing pipeline performing Non-Maximum Suppression (NMS) and quality assessment.
 */
object ScrfdPostprocessor {

    /**
     * Calculates Intersection over Union (IoU) between two bounding boxes.
     */
    fun calculateIoU(boxA: FaceBox, boxB: FaceBox): Float {
        val xA = maxOf(boxA.left, boxB.left)
        val yA = maxOf(boxA.top, boxB.top)
        val xB = minOf(boxA.right, boxB.right)
        val yB = minOf(boxA.bottom, boxB.bottom)

        val interWidth = maxOf(0f, xB - xA)
        val interHeight = maxOf(0f, yB - yA)
        val interArea = interWidth * interHeight

        val boxAArea = boxA.width * boxA.height
        val boxBArea = boxB.width * boxB.height

        val unionArea = boxAArea + boxBArea - interArea
        if (unionArea <= 0f) return 0f

        return interArea / unionArea
    }

    /**
     * Executes Non-Maximum Suppression (NMS) on candidates sorted by confidence score.
     */
    fun applyNMS(
        candidates: List<ScrfdCandidate>,
        iouThreshold: Float = ScrfdModelMetadata.DEFAULT_NMS_IOU_THRESHOLD,
        maxDetections: Int = 10
    ): List<ScrfdCandidate> {
        if (candidates.isEmpty()) return emptyList()

        val sorted = candidates.sortedByDescending { it.score }
        val selected = ArrayList<ScrfdCandidate>()
        val suppressed = BooleanArray(sorted.size)

        for (i in sorted.indices) {
            if (suppressed[i]) continue

            val current = sorted[i]
            selected.add(current)
            if (selected.size >= maxDetections) break

            for (j in (i + 1) until sorted.size) {
                if (suppressed[j]) continue
                val iou = calculateIoU(current.box, sorted[j].box)
                if (iou > iouThreshold) {
                    suppressed[j] = true
                }
            }
        }

        return selected
    }

    /**
     * Assesses face quality and frontal head pose using eye/nose geometric alignment.
     */
    fun assessQuality(candidate: ScrfdCandidate, frameWidth: Int, frameHeight: Int): FaceQuality {
        val lm = candidate.landmarks
        var rollAngle = 0f
        var yawAngle = 0f

        if (lm != null) {
            // Roll: angle between left eye and right eye
            val dX = lm.rightEye.x - lm.leftEye.x
            val dY = lm.rightEye.y - lm.leftEye.y
            rollAngle = Math.toDegrees(atan2(dY.toDouble(), dX.toDouble())).toFloat()

            // Yaw approximation: nose offset from eye center
            val eyeMidX = (lm.leftEye.x + lm.rightEye.x) / 2f
            val eyeDist = maxOf(1f, lm.rightEye.x - lm.leftEye.x)
            val noseOffset = (lm.nose.x - eyeMidX) / eyeDist
            yawAngle = noseOffset * 45f
        }

        val isAdequatelySized = candidate.box.width >= ScrfdModelMetadata.MIN_FACE_SIZE_PIXELS
        val isFrontal = Math.abs(rollAngle) <= 25f && Math.abs(yawAngle) <= 30f

        return FaceQuality(
            brightnessScore = 0.85f,
            sharpnessScore = 0.80f,
            rollAngle = rollAngle,
            yawAngle = yawAngle,
            isFrontal = isFrontal,
            isAdequatelySized = isAdequatelySized
        )
    }

    /**
     * Converts decoded candidates into structured FaceDetectionResult instances.
     */
    fun postprocess(
        candidates: List<ScrfdCandidate>,
        frameWidth: Int,
        frameHeight: Int,
        iouThreshold: Float = ScrfdModelMetadata.DEFAULT_NMS_IOU_THRESHOLD
    ): List<FaceDetectionResult> {
        val nmsResults = applyNMS(candidates, iouThreshold)

        return nmsResults.mapIndexed { index, candidate ->
            val quality = assessQuality(candidate, frameWidth, frameHeight)
            FaceDetectionResult(
                trackingId = index + 1,
                boundingBox = candidate.box,
                confidence = candidate.score,
                landmarks = candidate.landmarks,
                quality = quality
            )
        }
    }
}
