package com.governence.faflow.face.model

import android.content.Context
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import com.governence.faflow.face.ModelInfo
import com.governence.faflow.face.ModelManager
import com.governence.faflow.face.ModelTask
import com.governence.faflow.face.ModelState
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

            val modelBytes = loadModelFromAssets(ScrfdModelMetadata.MODEL_FILE_NAME)
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
        } catch (e: Exception) {
            _state.value = ModelState.Error(
                message = "Failed to load SCRFD model: ${e.localizedMessage ?: "Unknown error"}",
                throwable = e
            )
            Result.failure(e)
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
