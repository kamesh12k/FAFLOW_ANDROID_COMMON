package com.governence.faflow.face.model

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
 * Thread-safe lifecycle coordinator for the ArcFace / MobileFaceNet embedding ONNX model.
 */
class ArcFaceModelManager(
    private val context: Context,
    private val modelAssetPath: String = "models/arcface_mobilefacenet.onnx"
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
                    val errorMsg = "ArcFace model binary '$modelAssetPath' is pending provisioning in assets."
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
                    modelId = "arcface-mobilefacenet-v1",
                    modelName = "InsightFace ArcFace MobileFaceNet",
                    version = "1.0",
                    task = ModelTask.EMBEDDING,
                    inputShape = intArrayOf(1, 3, 112, 112),
                    fileSizeInBytes = modelFile.length(),
                    licenseType = "Non-Commercial Research / Academic",
                    isCommercialPermitted = false,
                    localFilePath = modelFile.absolutePath
                )
                currentModelInfo = modelInfo

                _modelState.value = ModelState.Ready(listOf(modelInfo))
                Result.success(Unit)
            } catch (e: Exception) {
                _modelState.value = ModelState.Error("Failed to initialize ArcFace ONNX model: ${e.localizedMessage}", e)
                Result.failure(e)
            }
        }
    }

    override fun getModelInfo(task: ModelTask): ModelInfo? {
        return if (task == ModelTask.EMBEDDING) currentModelInfo else null
    }

    override fun validateModelFile(file: File, expectedTask: ModelTask): Boolean {
        return file.exists() && file.length() > 100 && expectedTask == ModelTask.EMBEDDING
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
