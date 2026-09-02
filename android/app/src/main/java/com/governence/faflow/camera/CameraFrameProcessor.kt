package com.governence.faflow.camera

/**
 * Result returned by asynchronous camera frame processing.
 */
sealed interface FrameProcessResult {
    data class FrameReady(
        val frameId: Long,
        val width: Int,
        val height: Int,
        val rotationDegrees: Int,
        val timestamp: Long = System.currentTimeMillis()
    ) : FrameProcessResult

    data class Skipped(val reason: String) : FrameProcessResult
    data class Error(val message: String) : FrameProcessResult
}

/**
 * Asynchronous frame processor contract decoupled from CameraX and UI.
 * In M6, this will be implemented by InsightFace SCRFD detector.
 */
interface CameraFrameProcessor {
    suspend fun processFrame(frame: CameraFrame): FrameProcessResult
}
