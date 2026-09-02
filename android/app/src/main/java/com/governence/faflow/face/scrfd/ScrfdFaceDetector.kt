package com.governence.faflow.face.scrfd

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import android.graphics.Bitmap
import com.governence.faflow.camera.CameraFrame
import com.governence.faflow.camera.CameraFrameProcessor
import com.governence.faflow.camera.FrameProcessResult
import com.governence.faflow.face.FaceDetector
import com.governence.faflow.face.model.FaceDetectionResult
import com.governence.faflow.face.model.ScrfdModelManager
import com.governence.faflow.face.model.ScrfdModelMetadata
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import java.nio.FloatBuffer

/**
 * High-level face detector leveraging ONNX Runtime to execute the InsightFace SCRFD model.
 */
class ScrfdFaceDetector(
    private val modelManager: ScrfdModelManager,
    var scoreThreshold: Float = ScrfdModelMetadata.DEFAULT_SCORE_THRESHOLD,
    var iouThreshold: Float = ScrfdModelMetadata.DEFAULT_NMS_IOU_THRESHOLD
) : FaceDetector, CameraFrameProcessor {

    override val isInitialized: Boolean
        get() = modelManager.session != null

    override val modelName: String = ScrfdModelMetadata.MODEL_NAME

    // Cached anchor centers for strides 8, 16, 32
    private val anchorsStride8 = ScrfdDecoder.generateAnchorCenters(stride = 8)
    private val anchorsStride16 = ScrfdDecoder.generateAnchorCenters(stride = 16)
    private val anchorsStride32 = ScrfdDecoder.generateAnchorCenters(stride = 32)

    private val _latestDetections = MutableStateFlow<List<FaceDetectionResult>>(emptyList())
    val latestDetections: StateFlow<List<FaceDetectionResult>> = _latestDetections.asStateFlow()

    private val _inferenceLatencyMs = MutableStateFlow<Long>(0L)
    val inferenceLatencyMs: StateFlow<Long> = _inferenceLatencyMs.asStateFlow()

    override suspend fun detectFaces(bitmap: Bitmap): List<FaceDetectionResult> = withContext(Dispatchers.Default) {
        val session = modelManager.session ?: return@withContext emptyList()
        val env = modelManager.environment ?: return@withContext emptyList()

        val startTime = System.currentTimeMillis()

        // 1. Preprocessing
        val (inputBuffer, letterboxInfo) = ScrfdPreprocessor.preprocess(
            bitmap = bitmap,
            targetWidth = ScrfdModelMetadata.INPUT_WIDTH,
            targetHeight = ScrfdModelMetadata.INPUT_HEIGHT,
            rotationDegrees = 0
        )

        // 2. ONNX Tensor Creation
        val inputShape = longArrayOf(1, 3, ScrfdModelMetadata.INPUT_HEIGHT.toLong(), ScrfdModelMetadata.INPUT_WIDTH.toLong())
        val inputTensor = OnnxTensor.createTensor(env, inputBuffer, inputShape)

        val candidates = ArrayList<ScrfdCandidate>()

        try {
            // 3. Inference
            val inputName = session.inputNames.iterator().next()
            val results = session.run(mapOf(inputName to inputTensor))

            // 4. Output Extraction & Decoding
            extractAndDecodeOutputs(results, letterboxInfo, candidates)
            results.close()
        } catch (e: Exception) {
            return@withContext emptyList()
        } finally {
            inputTensor.close()
        }

        // 5. NMS & Quality Postprocessing
        val detections = ScrfdPostprocessor.postprocess(
            candidates = candidates,
            frameWidth = bitmap.width,
            frameHeight = bitmap.height,
            iouThreshold = iouThreshold
        )

        val latency = System.currentTimeMillis() - startTime
        _inferenceLatencyMs.value = latency
        _latestDetections.value = detections

        detections
    }

    override suspend fun processFrame(frame: CameraFrame): FrameProcessResult = withContext(Dispatchers.Default) {
        val bitmap = frame.bitmap
        if (bitmap == null && frame.nv21Bytes == null) {
            return@withContext FrameProcessResult.Error("No pixel data in CameraFrame")
        }

        val detections = if (bitmap != null) {
            detectFaces(bitmap)
        } else {
            emptyList()
        }

        FrameProcessResult.FrameReady(
            frameId = frame.timestamp,
            width = frame.width,
            height = frame.height,
            rotationDegrees = frame.rotationDegrees
        )
    }

    private fun extractAndDecodeOutputs(
        results: OrtSession.Result,
        letterboxInfo: LetterboxInfo,
        outCandidates: MutableList<ScrfdCandidate>
    ) {
        val outputMap = HashMap<String, OnnxTensor>()
        for (entry in results) {
            outputMap[entry.key] = entry.value as? OnnxTensor ?: continue
        }

        // Decode Stride 8
        decodeStrideTensor(outputMap, stride = 8, anchorsStride8, letterboxInfo, outCandidates)
        // Decode Stride 16
        decodeStrideTensor(outputMap, stride = 16, anchorsStride16, letterboxInfo, outCandidates)
        // Decode Stride 32
        decodeStrideTensor(outputMap, stride = 32, anchorsStride32, letterboxInfo, outCandidates)
    }

    private fun decodeStrideTensor(
        outputMap: Map<String, OnnxTensor>,
        stride: Int,
        anchors: List<Pair<Float, Float>>,
        letterboxInfo: LetterboxInfo,
        outCandidates: MutableList<ScrfdCandidate>
    ) {
        val scoreTensor = outputMap.entries.find { it.key.contains("score") && it.key.contains("$stride") }?.value
        val bboxTensor = outputMap.entries.find { it.key.contains("bbox") && it.key.contains("$stride") }?.value
        val kpsTensor = outputMap.entries.find { it.key.contains("kps") && it.key.contains("$stride") }?.value

        if (scoreTensor == null || bboxTensor == null) return

        val scoreFloats = scoreTensor.floatBuffer.asArray()
        val bboxFloats = bboxTensor.floatBuffer.asArray()
        val kpsFloats = kpsTensor?.floatBuffer?.asArray()

        val decoded = ScrfdDecoder.decodeStride(
            scores = scoreFloats,
            bboxDeltas = bboxFloats,
            kpsDeltas = kpsFloats,
            anchorCenters = anchors,
            stride = stride,
            scoreThreshold = scoreThreshold,
            letterboxInfo = letterboxInfo
        )

        outCandidates.addAll(decoded)
    }

    private fun FloatBuffer.asArray(): FloatArray {
        this.rewind()
        val array = FloatArray(this.remaining())
        this.get(array)
        return array
    }

    override fun release() {
        modelManager.releaseAll()
    }
}
