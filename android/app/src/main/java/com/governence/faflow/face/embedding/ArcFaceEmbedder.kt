package com.governence.faflow.face.embedding

import ai.onnxruntime.OnnxTensor
import android.graphics.Bitmap
import com.governence.faflow.face.FaceEmbedder
import com.governence.faflow.face.model.ArcFaceModelManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlin.math.max
import kotlin.math.sqrt

/**
 * On-device face embedder using ArcFace / MobileFaceNet ONNX representation.
 */
class ArcFaceEmbedder(
    private val modelManager: ArcFaceModelManager,
    private val config: FaceRecognitionConfig = FaceRecognitionConfig.DEFAULT
) : FaceEmbedder {

    override val isInitialized: Boolean
        get() = modelManager.getSession() != null

    override val modelName: String = "InsightFace ArcFace MobileFaceNet"
    override val modelVersion: String = config.modelVersion
    override val embeddingDimension: Int = config.embeddingDimension

    override suspend fun extractEmbedding(alignedFace: Bitmap): FloatArray = withContext(Dispatchers.Default) {
        val env = modelManager.getEnvironment()
            ?: throw IllegalStateException("ONNX Runtime environment is not initialized")
        val session = modelManager.getSession()
            ?: throw IllegalStateException("ArcFace ONNX session is not loaded")

        val floatBuffer = EmbeddingPreprocessor.preprocessBitmapToFloatBuffer(alignedFace)
        val shape = longArrayOf(1, 3, 112, 112)

        var inputTensor: OnnxTensor? = null
        try {
            inputTensor = OnnxTensor.createTensor(env, floatBuffer, shape)
            val inputName = session.inputNames.iterator().next()

            session.run(mapOf(inputName to inputTensor)).use { result ->
                val outputName = session.outputNames.iterator().next()
                val rawOutput = result.get(outputName).get()

                val rawFloats = when (rawOutput) {
                    is Array<*> -> (rawOutput[0] as? FloatArray) ?: throw IllegalStateException("Unexpected ArcFace row type")
                    is FloatArray -> rawOutput
                    else -> throw IllegalStateException("Unexpected ArcFace output tensor format: ${rawOutput?.javaClass?.simpleName}")
                }


                return@withContext l2Normalize(rawFloats)
            }
        } finally {
            inputTensor?.close()
        }
    }

    override fun release() {
        modelManager.releaseAll()
    }

    companion object {
        /**
         * Robust L2-normalization for vector embeddings with zero-vector and NaN protection.
         * Formula: E_norm = E / max(||E||_2, 1e-12)
         */
        fun l2Normalize(vector: FloatArray): FloatArray {
            var sumSquares = 0.0
            for (v in vector) {
                if (v.isNaN() || v.isInfinite()) {
                    // Sanitize corrupted numerical entries
                    return FloatArray(vector.size) { 0f }
                }
                sumSquares += (v * v).toDouble()
            }

            val norm = sqrt(sumSquares)
            if (norm <= 1e-12) {
                // Return zero vector if magnitude is negligible
                return FloatArray(vector.size) { 0f }
            }

            val normalized = FloatArray(vector.size)
            for (i in vector.indices) {
                normalized[i] = (vector[i] / norm).toFloat()
            }
            return normalized
        }
    }
}
