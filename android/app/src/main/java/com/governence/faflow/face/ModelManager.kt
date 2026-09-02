package com.governence.faflow.face

import java.io.File

/**
 * Metadata descriptor for an AI model artifact.
 */
data class ModelInfo(
    val modelId: String,
    val modelName: String,
    val version: String,
    val task: ModelTask,
    val inputShape: IntArray,
    val fileSizeInBytes: Long,
    val licenseType: String,
    val isCommercialPermitted: Boolean,
    val localFilePath: String? = null
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false

        other as ModelInfo

        if (modelId != other.modelId) return false
        if (modelName != other.modelName) return false
        if (version != other.version) return false
        if (task != other.task) return false
        if (!inputShape.contentEquals(other.inputShape)) return false

        return true
    }

    override fun hashCode(): Int {
        var result = modelId.hashCode()
        result = 31 * result + modelName.hashCode()
        result = 31 * result + version.hashCode()
        result = 31 * result + task.hashCode()
        result = 31 * result + inputShape.contentHashCode()
        return result
    }
}

enum class ModelTask {
    DETECTION,
    ALIGNMENT,
    EMBEDDING,
    LIVENESS
}

sealed interface ModelState {
    data object Uninitialized : ModelState
    data class Loading(val progress: Float) : ModelState
    data class Ready(val models: List<ModelInfo>) : ModelState
    data class Error(val message: String, val throwable: Throwable? = null) : ModelState
}

/**
 * Contract for managing lifecycle, loading, switching, and validation of ONNX / AI models.
 */
interface ModelManager {
    val state: ModelState

    suspend fun initializeModels(): Result<Unit>
    fun getModelInfo(task: ModelTask): ModelInfo?
    fun validateModelFile(file: File, expectedTask: ModelTask): Boolean
    fun releaseAll()
}
