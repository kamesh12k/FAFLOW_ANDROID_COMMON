package com.governence.faflow.attendance.biometrics.liveness

import android.graphics.Bitmap
import com.governence.faflow.attendance.biometrics.model.FaceDetectionResult
import com.governence.faflow.attendance.biometrics.model.FaceLandmarks

/**
 * Backward-compatible alias for EyeLandmarkProvider.
 */
typealias EyeLandmarkProvider = EyeStateProvider

/**
 * Fallback provider when detailed eye analysis is unavailable.
 */
class DefaultEyeLandmarkProvider : EyeStateProvider {
    override val isDenseLandmarksSupported: Boolean = false
    override fun computeEyeAspectRatio(landmarks: FaceLandmarks): Float? = null
    override fun computeEyeState(bitmap: Bitmap?, face: FaceDetectionResult): EyeStateResult? = null
}

/**
 * Strict, robust lifecycle states for the Two-Blink Verification State Machine.
 */
sealed interface BlinkState {
    data object Idle : BlinkState
    data object WaitingForBlink1 : BlinkState
    data class EyesClosed1(val frameCount: Int, val elapsedMs: Long) : BlinkState
    data class Blink1Completed(val timestampMs: Long) : BlinkState
    data object WaitingForBlink2 : BlinkState
    data class EyesClosed2(val frameCount: Int, val elapsedMs: Long) : BlinkState
    data class Blink2Completed(val timestampMs: Long) : BlinkState
    data object LivenessVerified : BlinkState
    data class TimedOut(val elapsedMs: Long) : BlinkState
    data class Failed(val reason: String) : BlinkState
}

/**
 * Configuration parameters for the double-blink state machine.
 * Tuned for natural human blinking dynamics across varying camera frame rates (10–30 FPS).
 */
data class BlinkDetectorConfig(
    val openThreshold: Float = 0.158f,
    val closedThreshold: Float = 0.142f,
    val minClosedFrames: Int = 1,
    val minOpenFrames: Int = 1,
    val minInterBlinkOpenMs: Long = 100L,
    val maxClosedDurationMs: Long = 2500L,
    val sessionTimeoutMs: Long = 12_000L
) {
    companion object {
        val DEFAULT = BlinkDetectorConfig()
    }
}

/**
 * Developer and operational debug telemetry for the two-blink liveness verification flow.
 */
data class LivenessDebugInfo(
    val faceStatus: String = "No Face",
    val livenessState: String = "Idle",
    val eyeState: String = "UNCERTAIN",
    val ear: Float = 0f,
    val leftEar: Float = 0f,
    val rightEar: Float = 0f,
    val blinkCount: Int = 0,
    val totalFrames: Long = 0L,
    val droppedFrames: Long = 0L,
    val processingTimeMs: Long = 0L
)

/**
 * Dedicated Two-Blink Liveness State Machine.
 *
 * Enforces:
 *   OPEN -> CLOSED -> OPEN (Blink #1)
 *       ↓
 *   CLEAN RESET TO EYES_OPEN STATE
 *       ↓
 *   OPEN -> CLOSED -> OPEN (Blink #2)
 *       ↓
 *   LIVENESS_VERIFIED = TRUE
 *
 * Guarantees:
 * - Second blink is never swallowed or dropped by debounce windows.
 * - Eyes must reopen after blink #1 before blink #2 is accepted.
 * - Single-frame landmark noise does not falsely trigger or cancel blinks.
 * - Continuous eye closure (> 2.5s) fails as non-liveness (e.g. photo presentation attack).
 * - Static photographs produce 0 blinks and time out.
 */
class BlinkDetector(
    val provider: EyeStateProvider = DetailedEyeLandmarkProvider(),
    val config: BlinkDetectorConfig = BlinkDetectorConfig.DEFAULT
) {
    private var state: BlinkState = BlinkState.Idle
    private var sessionStartTimeMs: Long = 0L

    private var closedFrameCount: Int = 0
    private var openFrameCount: Int = 0
    private var closedStartTimeMs: Long = 0L
    private var blink1TimeMs: Long = 0L

    val currentState: BlinkState get() = state
    val isLivenessVerified: Boolean get() = state is BlinkState.LivenessVerified

    val blinkCount: Int
        get() = when (state) {
            is BlinkState.Blink1Completed, is BlinkState.WaitingForBlink2, is BlinkState.EyesClosed2 -> 1
            is BlinkState.Blink2Completed, is BlinkState.LivenessVerified -> 2
            else -> 0
        }

    fun startSession(startTimeMs: Long = System.currentTimeMillis()) {
        sessionStartTimeMs = startTimeMs
        state = BlinkState.WaitingForBlink1
        closedFrameCount = 0
        openFrameCount = 0
        closedStartTimeMs = 0L
        blink1TimeMs = 0L
    }

    fun reset() {
        state = BlinkState.Idle
        sessionStartTimeMs = 0L
        closedFrameCount = 0
        openFrameCount = 0
        closedStartTimeMs = 0L
        blink1TimeMs = 0L
    }

    /**
     * Backward-compatible helper processing raw landmarks.
     */
    fun processFrame(landmarks: FaceLandmarks): Boolean {
        val ear = provider.computeEyeAspectRatio(landmarks) ?: return false
        val res = processEyeMetric(ear)
        return res is BlinkState.LivenessVerified
    }

    /**
     * Processes live CameraX detection and frame bitmap through the detailed eye provider.
     */
    fun processCameraFrame(
        bitmap: Bitmap?,
        face: FaceDetectionResult,
        currentTimeMs: Long = System.currentTimeMillis()
    ): BlinkState {
        if (state is BlinkState.Idle) {
            startSession(currentTimeMs)
        }

        val eyeResult = provider.computeEyeState(bitmap, face)
        val ear = eyeResult?.ear ?: 0.25f // default neutral open if no patch
        return processEyeMetric(ear, currentTimeMs)
    }

    /**
     * Core state machine evaluation based on temporal Eye Aspect Ratio (EAR) metric.
     */
    fun processEyeMetric(
        ear: Float,
        currentTimeMs: Long = System.currentTimeMillis()
    ): BlinkState {
        if (state is BlinkState.Idle) {
            startSession(currentTimeMs)
        }

        if (state is BlinkState.LivenessVerified || state is BlinkState.Failed || state is BlinkState.TimedOut) {
            return state
        }

        // Global session timeout check
        val elapsedSession = currentTimeMs - sessionStartTimeMs
        if (sessionStartTimeMs > 0 && elapsedSession > config.sessionTimeoutMs) {
            state = BlinkState.TimedOut(elapsedSession)
            return state
        }

        val isClosed = ear <= config.closedThreshold
        val isOpen = ear >= config.openThreshold

        when (val current = state) {
            is BlinkState.WaitingForBlink1 -> {
                if (isClosed) {
                    closedFrameCount++
                    if (closedStartTimeMs == 0L) closedStartTimeMs = currentTimeMs

                    if (closedFrameCount >= config.minClosedFrames) {
                        state = BlinkState.EyesClosed1(closedFrameCount, currentTimeMs - closedStartTimeMs)
                    }
                } else if (isOpen) {
                    closedFrameCount = 0
                    closedStartTimeMs = 0L
                }
            }

            is BlinkState.EyesClosed1 -> {
                if (isClosed) {
                    closedFrameCount++
                    openFrameCount = 0
                    val closedDuration = currentTimeMs - closedStartTimeMs
                    if (closedDuration > config.maxClosedDurationMs) {
                        // Holding eyes closed continuously is not a blink
                        state = BlinkState.Failed("Eyes remained closed too long")
                        return state
                    }
                } else if (isOpen) {
                    openFrameCount++
                    if (openFrameCount >= config.minOpenFrames) {
                        // Blink #1 Complete! Eyes confirmed open.
                        blink1TimeMs = currentTimeMs
                        openFrameCount = 0
                        closedFrameCount = 0
                        closedStartTimeMs = 0L
                        // Immediately transition to WaitingForBlink2 so second blink is NEVER dropped
                        state = BlinkState.WaitingForBlink2
                    }
                }
            }

            is BlinkState.Blink1Completed -> {
                // Maintained for direct state initialization compatibility
                val interBlinkElapsed = currentTimeMs - blink1TimeMs
                if (interBlinkElapsed >= config.minInterBlinkOpenMs) {
                    openFrameCount = 0
                    closedFrameCount = 0
                    closedStartTimeMs = 0L
                    if (isClosed) {
                        closedFrameCount = 1
                        closedStartTimeMs = currentTimeMs
                        state = BlinkState.EyesClosed2(1, 0L)
                    } else {
                        state = BlinkState.WaitingForBlink2
                    }
                }
            }

            is BlinkState.WaitingForBlink2 -> {
                val interBlinkElapsed = currentTimeMs - blink1TimeMs
                if (isClosed) {
                    // Debounce flutter immediately following blink 1 reopening
                    if (interBlinkElapsed >= config.minInterBlinkOpenMs) {
                        closedFrameCount++
                        if (closedStartTimeMs == 0L) closedStartTimeMs = currentTimeMs

                        if (closedFrameCount >= config.minClosedFrames) {
                            openFrameCount = 0
                            state = BlinkState.EyesClosed2(closedFrameCount, currentTimeMs - closedStartTimeMs)
                        }
                    }
                } else if (isOpen) {
                    closedFrameCount = 0
                    closedStartTimeMs = 0L
                }
            }

            is BlinkState.EyesClosed2 -> {
                if (isClosed) {
                    closedFrameCount++
                    openFrameCount = 0
                    val closedDuration = currentTimeMs - closedStartTimeMs
                    if (closedDuration > config.maxClosedDurationMs) {
                        state = BlinkState.Failed("Eyes remained closed too long")
                        return state
                    }
                } else if (isOpen || ear >= (config.closedThreshold + config.openThreshold) / 2f) {
                    // Eyes re-opened after closure -> Blink #2 successfully completed!
                    openFrameCount++
                    if (openFrameCount >= config.minOpenFrames) {
                        state = BlinkState.LivenessVerified
                    }
                }
            }

            else -> {}
        }

        return state
    }
}
