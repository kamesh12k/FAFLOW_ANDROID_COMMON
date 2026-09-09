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
import java.io.FileOutputStream

/**
 * Model manager orchestrating ONNX Runtime session lifecycle for InsightFace SCRFD.
 */
class ScrfdModelManager(
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

            val env = OrtEnvironment.getEnvironment()
            ortEnvironment = env

            _state.value = ModelState.Loading(0.5f)

            val modelBytes = try {
                loadModelFromAssets(ScrfdModelMetadata.MODEL_FILE_NAME)
            } catch (e: Exception) {
                val errMsg = "SCRFD model asset not found or unreadable: ${ScrfdModelMetadata.MODEL_FILE_NAME}"
                _state.value = ModelState.Error(errMsg, e)
                return@withContext Result.failure(e)
            }

            if (modelBytes.size < 1000) {
                val errMsg = "SCRFD model asset ${ScrfdModelMetadata.MODEL_FILE_NAME} is a placeholder (${modelBytes.size} bytes), pending compiled ONNX binary."
                val ex = IllegalStateException(errMsg)
                _state.value = ModelState.Error(errMsg, ex)
                return@withContext Result.failure(ex)
            }

            val sessionOptions = OrtSession.SessionOptions().apply {
                setIntraOpNumThreads(4)
                setOptimizationLevel(OrtSession.SessionOptions.OptLevel.ALL_OPT)
            }

            val sess = env.createSession(modelBytes, sessionOptions)
            ortSession = sess

            val info = ModelInfo(
                modelId = ScrfdModelMetadata.MODEL_ID,
                modelName = ScrfdModelMetadata.MODEL_NAME,
                version = ScrfdModelMetadata.MODEL_VERSION,
                task = ModelTask.DETECTION,
                inputShape = intArrayOf(1, 3, ScrfdModelMetadata.INPUT_HEIGHT, ScrfdModelMetadata.INPUT_WIDTH),
                fileSizeInBytes = modelBytes.size.toLong(),
                licenseType = "DeepInsight Non-Commercial / Evaluation",
                isCommercialPermitted = false,
                localFilePath = ScrfdModelMetadata.MODEL_FILE_NAME
            )

            _state.value = ModelState.Ready(listOf(info))
            Result.success(Unit)
        } catch (t: Throwable) {
            _state.value = ModelState.Error(
                message = "Failed to load SCRFD model: ${t.localizedMessage ?: "Unknown error"}",
                throwable = t
            )
            Result.failure(t)
        }
    }

    private fun loadModelFromAssets(assetPath: String): ByteArray {
        return context.assets.open(assetPath).use { it.readBytes() }
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
        } catch (_: Exception) {}
    }
}
