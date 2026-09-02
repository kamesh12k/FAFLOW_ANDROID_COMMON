package com.governence.faflow.face.liveness

import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import android.content.Context
import com.governence.faflow.face.ModelInfo
import com.governence.faflow.face.ModelManager
import com.governence.faflow.face.ModelTask
import com.governence.faflow.face.ModelState
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream

/**
 * Thread-safe lifecycle coordinator for the optional ONNX anti-spoofing model.
 */
class AntiSpoofModelManager(
    private val context: Context,
    private val modelAssetPath: String = "models/antispoof_minifasnet.onnx"
) : ModelManager {

    private val mutex = Mutex()
    private var ortEnvironment: OrtEnvironment? = null
    private var ortSession: OrtSession? = null

    private val _modelState = MutableStateFlow<ModelState>(ModelState.Uninitialized)
    val modelStateFlow: StateFlow<ModelState> = _modelState.asStateFlow()

    override val state: ModelState
        get() = _modelState.value

    private var currentModelInfo: ModelInfo? = null

    fun getSession(): OrtSession? = ortSession
    fun getEnvironment(): OrtEnvironment? = ortEnvironment

    override suspend fun initializeModels(): Result<Unit> = withContext(Dispatchers.IO) {
        mutex.withLock {
            if (_modelState.value is ModelState.Ready) return@withContext Result.success(Unit)

            try {
                _modelState.value = ModelState.Loading(progress = 0.2f)

                val env = OrtEnvironment.getEnvironment()
                ortEnvironment = env

                _modelState.value = ModelState.Loading(progress = 0.5f)

                val modelFile = getOrExtractAsset(modelAssetPath)
                if (modelFile == null || !modelFile.exists() || modelFile.length() < 100) {
                    val errorMsg = "Anti-spoof model weights are not bundled until provenance and licensing are verified."
                    _modelState.value = ModelState.Error(errorMsg)
                    return@withContext Result.failure(IllegalStateException(errorMsg))
                }

                val sessionOptions = OrtSession.SessionOptions().apply {
                    setIntraOpNumThreads(2)
                    setOptimizationLevel(OrtSession.SessionOptions.OptLevel.BASIC_OPT)
                }

                val session = env.createSession(modelFile.absolutePath, sessionOptions)
                ortSession = session

                val modelInfo = ModelInfo(
                    modelId = "antispoof-minifasnet-v1",
                    modelName = "MiniFASNet Silent Face Anti-Spoofing",
                    version = "1.0",
                    task = ModelTask.LIVENESS,
                    inputShape = intArrayOf(1, 3, 80, 80),
                    fileSizeInBytes = modelFile.length(),
                    licenseType = "Non-Commercial Research / Academic",
                    isCommercialPermitted = false,
                    localFilePath = modelFile.absolutePath
                )
                currentModelInfo = modelInfo

                _modelState.value = ModelState.Ready(listOf(modelInfo))
                Result.success(Unit)
            } catch (e: Exception) {
                _modelState.value = ModelState.Error("Failed to initialize AntiSpoof ONNX model: ${e.localizedMessage}", e)
                Result.failure(e)
            }
        }
    }

    override fun getModelInfo(task: ModelTask): ModelInfo? {
        return if (task == ModelTask.LIVENESS) currentModelInfo else null
    }

    override fun validateModelFile(file: File, expectedTask: ModelTask): Boolean {
        return file.exists() && file.length() > 100 && expectedTask == ModelTask.LIVENESS
    }

    override fun releaseAll() {
        try {
            ortSession?.close()
            ortSession = null
            ortEnvironment?.close()
            ortEnvironment = null
            _modelState.value = ModelState.Uninitialized
        } catch (_: Exception) {}
    }

    private fun getOrExtractAsset(assetName: String): File? {
        return try {
            val targetFile = File(context.filesDir, "models_extracted/${assetName.replace('/', '_')}")
            if (targetFile.exists() && targetFile.length() > 0) {
                return targetFile
            }
            targetFile.parentFile?.mkdirs()

            var inputStream: InputStream? = null
            try {
                inputStream = context.assets.open(assetName)
            } catch (_: Exception) {
                return null
            }

            inputStream.use { input ->
                FileOutputStream(targetFile).use { output ->
                    input.copyTo(output)
                }
            }
            targetFile
        } catch (_: Exception) {
            null
        }
    }
}
