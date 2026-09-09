package com.governence.faflow.attendance.biometrics.model

import android.content.Context
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import com.governence.faflow.attendance.biometrics.ModelInfo
import com.governence.faflow.attendance.biometrics.ModelManager
import com.governence.faflow.attendance.biometrics.ModelTask
import com.governence.faflow.attendance.biometrics.ModelState
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import java.io.File
import java.io.InputStream

/**
 * Model manager orchestrating ONNX Runtime session lifecycle for the MobileFaceNet
 * face-recognition (embedding) model.
 *
 * Designed with defensive runtime safety:
 * - Validates asset presence and minimum binary size (> 1KB) before memory allocation.
 * - Catches [Throwable] to gracefully handle [UnsatisfiedLinkError] on 16KB page-size systems.
 * - Manages session initialization and release cleanly.
 */
class MobileFaceNetModelManager(
    private val context: Context
) : ModelManager {

    private val _state = MutableStateFlow<ModelState>(ModelState.Uninitialized)
    override val state: ModelState get() = _state.value
    val stateFlow: StateFlow<ModelState> = _state.asStateFlow()

    private var ortEnvironment: OrtEnvironment? = null
    private var ortSession: OrtSession? = null

    val session: OrtSession? get() = ortSession
    val environment: OrtEnvironment? get() = ortEnvironment

    override suspend fun initializeModels(): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            _state.value = ModelState.Loading(0.1f)

            // Validate that the model asset exists and is a valid binary (> 1000 bytes)
            val modelBytes = try {
                loadModelFromAssets(MobileFaceNetModelMetadata.MODEL_FILE_NAME)
            } catch (e: Exception) {
                val errMsg = "Model asset not found or unreadable: ${MobileFaceNetModelMetadata.MODEL_FILE_NAME}"
                _state.value = ModelState.Error(errMsg, e)
                return@withContext Result.failure(e)
            }

            if (modelBytes.size < 1000) {
                val errMsg = "Model asset ${MobileFaceNetModelMetadata.MODEL_FILE_NAME} is a placeholder (${modelBytes.size} bytes), expecting compiled ONNX binary."
                val ex = IllegalStateException(errMsg)
                _state.value = ModelState.Error(errMsg, ex)
                return@withContext Result.failure(ex)
            }

            _state.value = ModelState.Loading(0.4f)

            // Safely initialize ONNX Runtime environment
            val env = OrtEnvironment.getEnvironment()
            ortEnvironment = env

            _state.value = ModelState.Loading(0.7f)

            val sessionOptions = OrtSession.SessionOptions().apply {
                setIntraOpNumThreads(4)
                setOptimizationLevel(OrtSession.SessionOptions.OptLevel.ALL_OPT)
            }

            val sess = env.createSession(modelBytes, sessionOptions)
            ortSession = sess

            val info = ModelInfo(
                modelId = MobileFaceNetModelMetadata.MODEL_ID,
                modelName = MobileFaceNetModelMetadata.MODEL_NAME,
                version = MobileFaceNetModelMetadata.MODEL_VERSION,
                task = ModelTask.EMBEDDING,
                inputShape = intArrayOf(
                    1, 3,
                    MobileFaceNetModelMetadata.INPUT_SIZE,
                    MobileFaceNetModelMetadata.INPUT_SIZE
                ),
                fileSizeInBytes = modelBytes.size.toLong(),
                licenseType = "DeepInsight Non-Commercial / Evaluation",
                isCommercialPermitted = false,
                localFilePath = MobileFaceNetModelMetadata.MODEL_FILE_NAME
            )

            _state.value = ModelState.Ready(listOf(info))
            Result.success(Unit)
        } catch (t: Throwable) {
            // Catch Throwable to safeguard against native UnsatisfiedLinkError on 16KB emulators
            val errMsg = "Failed to initialize MobileFaceNet model: ${t.localizedMessage ?: "Native library error"}"
            val wrappedEx = if (t is Exception) t else RuntimeException(t)
            _state.value = ModelState.Error(message = errMsg, throwable = wrappedEx)
            Result.failure(wrappedEx)
        }
    }

    private fun loadModelFromAssets(assetPath: String): ByteArray {
        val stream: InputStream = context.assets.open(assetPath)
        return stream.use { it.readBytes() }
    }

    override fun getModelInfo(task: ModelTask): ModelInfo? {
        val readyState = _state.value as? ModelState.Ready ?: return null
        return readyState.models.find { it.task == task }
    }

    override fun validateModelFile(file: File, expectedTask: ModelTask): Boolean {
        return file.exists() && file.length() > 1000L
    }

    override fun releaseAll() {
        try {
            ortSession?.close()
            ortSession = null
            ortEnvironment?.close()
            ortEnvironment = null
            _state.value = ModelState.Uninitialized
        } catch (_: Throwable) {}
    }
}
