package com.governence.faflow.camera

/**
 * Structured runtime states for the CameraX subsystem.
 */
sealed interface CameraState {
    data object PermissionRequired : CameraState
    data object Initializing : CameraState
    data object Ready : CameraState
    data class Processing(
        val fps: Float = 0f,
        val droppedCount: Long = 0,
        val timestamp: Long = System.currentTimeMillis()
    ) : CameraState
    data class Unavailable(val reason: String) : CameraState
    data class Error(val message: String, val canRetry: Boolean = true) : CameraState
}

/**
 * Camera lens configuration (Strictly FRONT for staff facial attendance).
 */
enum class CameraLens {
    FRONT,
    BACK
}
