package com.governence.faflow.camera

import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong

/**
 * High-performance ImageAnalysis analyzer with backpressure handling,
 * frame rate throttling, and non-blocking concurrency management.
 */
class CameraAnalyzer(
    private val frameProcessor: CameraFrameProcessor? = null,
    private val maxFps: Int = 10,
    private val lensFacing: CameraLens = CameraLens.FRONT,
    private val coroutineScope: CoroutineScope = CoroutineScope(Dispatchers.Default)
) : ImageAnalysis.Analyzer {

    private val frameIntervalMs = (1000.0 / maxFps).toLong()
    private var lastProcessedTimestamp = 0L

    private val isProcessing = AtomicBoolean(false)
    private val processedFramesCount = AtomicLong(0L)
    private val droppedFramesCount = AtomicLong(0L)

    private val _analyzerState = MutableStateFlow<CameraState>(CameraState.Ready)
    val analyzerState: StateFlow<CameraState> = _analyzerState.asStateFlow()

    override fun analyze(imageProxy: ImageProxy) {
        val currentTimestamp = System.currentTimeMillis()

        // 1. Frame Rate Throttling
        if (currentTimestamp - lastProcessedTimestamp < frameIntervalMs) {
            droppedFramesCount.incrementAndGet()
            imageProxy.close()
            return
        }

        // 2. Concurrency Lock — Drop frame if prior frame is still being processed
        if (!isProcessing.compareAndSet(false, true)) {
            droppedFramesCount.incrementAndGet()
            imageProxy.close()
            return
        }

        lastProcessedTimestamp = currentTimestamp

        // 3. Safe Frame Extraction before proxy close
        val cameraFrame = try {
            CameraFrame.fromImageProxy(
                imageProxy = imageProxy,
                lensFacing = lensFacing,
                extractBitmap = false
            )
        } catch (e: Exception) {
            isProcessing.set(false)
            imageProxy.close()
            return
        } finally {
            // Immediate proxy close to prevent CameraX buffer starvation
            imageProxy.close()
        }

        // 4. Asynchronous Background Execution on Dispatchers.Default
        coroutineScope.launch(Dispatchers.Default) {
            try {
                _analyzerState.value = CameraState.Processing(
                    fps = maxFps.toFloat(),
                    droppedCount = droppedFramesCount.get(),
                    timestamp = currentTimestamp
                )

                frameProcessor?.processFrame(cameraFrame)
                processedFramesCount.incrementAndGet()
            } catch (e: Exception) {
                _analyzerState.value = CameraState.Error(
                    message = "Frame processing error: ${e.localizedMessage ?: "Unknown error"}"
                )
            } finally {
                isProcessing.set(false)
            }
        }
    }

    fun getMetrics(): DiagnosticMetrics {
        return DiagnosticMetrics(
            processedCount = processedFramesCount.get(),
            droppedCount = droppedFramesCount.get(),
            targetFps = maxFps
        )
    }
}

data class DiagnosticMetrics(
    val processedCount: Long,
    val droppedCount: Long,
    val targetFps: Int
)
