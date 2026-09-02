package com.governence.faflow.face.scrfd

import com.governence.faflow.face.model.FaceBox
import com.governence.faflow.face.model.FaceLandmarks
import com.governence.faflow.face.model.FacePoint
import com.governence.faflow.face.model.ScrfdModelMetadata

/**
 * Raw detection candidate before NMS.
 */
data class ScrfdCandidate(
    val box: FaceBox,
    val score: Float,
    val landmarks: FaceLandmarks? = null
)

/**
 * Mathematical anchor generation and coordinate decoding engine for InsightFace SCRFD.
 */
object ScrfdDecoder {

    /**
     * Generates anchor centers for a given input resolution and stride configuration.
     * Returns a List of Pair(cx, cy) anchor centers.
     */
    fun generateAnchorCenters(
        inputWidth: Int = ScrfdModelMetadata.INPUT_WIDTH,
        inputHeight: Int = ScrfdModelMetadata.INPUT_HEIGHT,
        stride: Int,
        numAnchors: Int = ScrfdModelMetadata.NUM_ANCHORS_PER_STRIDE
    ): List<Pair<Float, Float>> {
        val featW = inputWidth / stride
        val featH = inputHeight / stride
        val centers = ArrayList<Pair<Float, Float>>(featW * featH * numAnchors)

        for (y in 0 until featH) {
            val cy = y * stride.toFloat()
            for (x in 0 until featW) {
                val cx = x * stride.toFloat()
                for (k in 0 until numAnchors) {
                    centers.add(Pair(cx, cy))
                }
            }
        }
        return centers
    }

    /**
     * Decodes raw tensor outputs for a single stride into candidate detections.
     */
    fun decodeStride(
        scores: FloatArray,          // Shape: [N, 1]
        bboxDeltas: FloatArray,      // Shape: [N, 4] -> [l, t, r, b]
        kpsDeltas: FloatArray?,      // Shape: [N, 10] -> [dx1, dy1, ... dx5, dy5]
        anchorCenters: List<Pair<Float, Float>>,
        stride: Int,
        scoreThreshold: Float,
        letterboxInfo: LetterboxInfo
    ): List<ScrfdCandidate> {
        val numAnchors = anchorCenters.size
        val candidates = ArrayList<ScrfdCandidate>()

        for (i in 0 until numAnchors) {
            val score = scores[i]
            if (score < scoreThreshold) continue

            val (cx, cy) = anchorCenters[i]

            val bOffset = i * 4
            val l = bboxDeltas[bOffset] * stride
            val t = bboxDeltas[bOffset + 1] * stride
            val r = bboxDeltas[bOffset + 2] * stride
            val b = bboxDeltas[bOffset + 3] * stride

            val x1Model = cx - l
            val y1Model = cy - t
            val x2Model = cx + r
            val y2Model = cy + b

            // Un-letterbox bounding box to original unpadded frame coordinates
            val origX1 = maxOf(0f, (x1Model - letterboxInfo.padX) / letterboxInfo.scale)
            val origY1 = maxOf(0f, (y1Model - letterboxInfo.padY) / letterboxInfo.scale)
            val origX2 = minOf(letterboxInfo.originalWidth.toFloat(), (x2Model - letterboxInfo.padX) / letterboxInfo.scale)
            val origY2 = minOf(letterboxInfo.originalHeight.toFloat(), (y2Model - letterboxInfo.padY) / letterboxInfo.scale)

            // Decode 5-point facial landmarks if present
            var landmarks: FaceLandmarks? = null
            if (kpsDeltas != null) {
                val kOffset = i * 10
                val pts = ArrayList<FacePoint>(5)
                for (k in 0 until 5) {
                    val kxModel = cx + kpsDeltas[kOffset + k * 2] * stride
                    val kyModel = cy + kpsDeltas[kOffset + k * 2 + 1] * stride

                    val origKx = (kxModel - letterboxInfo.padX) / letterboxInfo.scale
                    val origKy = (kyModel - letterboxInfo.padY) / letterboxInfo.scale
                    pts.add(FacePoint(origKx, origKy))
                }
                landmarks = FaceLandmarks(
                    leftEye = pts[0],
                    rightEye = pts[1],
                    nose = pts[2],
                    leftMouth = pts[3],
                    rightMouth = pts[4]
                )
            }

            candidates.add(
                ScrfdCandidate(
                    box = FaceBox(left = origX1, top = origY1, right = origX2, bottom = origY2),
                    score = score,
                    landmarks = landmarks
                )
            )
        }

        return candidates
    }
}
