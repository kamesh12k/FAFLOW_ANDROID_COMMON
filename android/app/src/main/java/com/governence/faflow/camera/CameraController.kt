package com.governence.faflow.camera

import android.content.Context
import android.util.Size
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.concurrent.Executors

/**
 * Production-quality CameraX Controller configured explicitly for Front Camera operations.
 */
class CameraController(
    private val context: Context,
    private val frameProcessor: CameraFrameProcessor? = null,
    private val targetFps: Int = 10
) {
    private var cameraProvider: ProcessCameraProvider? = null
    private var analyzer: CameraAnalyzer? = null
    private val analysisExecutor = Executors.newSingleThreadExecutor()

    private val _cameraState = MutableStateFlow<CameraState>(CameraState.Initializing)
    val cameraState: StateFlow<CameraState> = _cameraState.asStateFlow()

    fun bindCamera(
        lifecycleOwner: LifecycleOwner,
        previewView: PreviewView
    ) {
        _cameraState.value = CameraState.Initializing

        val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
        cameraProviderFuture.addListener({
            try {
                val provider = cameraProviderFuture.get()
                cameraProvider = provider

                // 1. Verify Front Camera Availability
                val frontCameraSelector = CameraSelector.Builder()
                    .requireLensFacing(CameraSelector.LENS_FACING_FRONT)
                    .build()

                if (!provider.hasCamera(frontCameraSelector)) {
                    _cameraState.value = CameraState.Unavailable("Front camera is not available on this device.")
                    return@addListener
                }

                // 2. Configure Preview Use Case
                val preview = Preview.Builder()
                    .build()
                    .also {
                        it.surfaceProvider = previewView.surfaceProvider
                    }

                // 3. Configure ImageAnalysis Use Case (KEEP_ONLY_LATEST)
                analyzer = CameraAnalyzer(
                    frameProcessor = frameProcessor,
                    maxFps = targetFps,
                    lensFacing = CameraLens.FRONT
                )

                val resolutionSelector = androidx.camera.core.resolutionselector.ResolutionSelector.Builder()
                    .setResolutionStrategy(
                        androidx.camera.core.resolutionselector.ResolutionStrategy(
                            Size(640, 480),
                            androidx.camera.core.resolutionselector.ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER
                        )
                    )
                    .build()

                val imageAnalysis = ImageAnalysis.Builder()
                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                    .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_YUV_420_888)
                    .setResolutionSelector(resolutionSelector)
                    .build()
                    .also {
                        it.setAnalyzer(analysisExecutor, analyzer!!)
                    }

                // 4. Bind to Lifecycle
                provider.unbindAll()
                provider.bindToLifecycle(
                    lifecycleOwner,
                    frontCameraSelector,
                    preview,
                    imageAnalysis
                )

                _cameraState.value = CameraState.Ready
            } catch (e: Exception) {
                _cameraState.value = CameraState.Error(
                    message = "Failed to initialize CameraX: ${e.localizedMessage ?: "Unknown error"}"
                )
            }
        }, ContextCompat.getMainExecutor(context))
    }

    fun stopCamera() {
        try {
            cameraProvider?.unbindAll()
            cameraProvider = null
            _cameraState.value = CameraState.Ready
        } catch (_: Exception) {}
    }

    fun release() {
        stopCamera()
        analysisExecutor.shutdown()
    }
}
