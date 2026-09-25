package com.governence.faflow.attendance.biometrics.feedback

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * Enterprise tactile and sensory feedback manager for FAFLOW Biometric Operations.
 *
 * CRITICAL ARCHITECTURAL GUARANTEE:
 * - Haptic feedback is triggered ONLY upon final server confirmation (or offline queueing)
 *   of attendance, NEVER during face scanning, framing, or local template matching.
 * - Non-blocking execution prevents UI jank or frame dropping.
 * - Safely handles devices without vibration hardware or with system haptics disabled.
 */
object BiometricFeedbackManager {

    private val feedbackScope = CoroutineScope(Dispatchers.Default)

    /**
     * Crisp double-pulse confirmation pattern.
     * Timing: 0ms delay, 45ms pulse 1, 65ms gap, 55ms pulse 2.
     * Amplitudes: strong pulse 1 (200/255), crisp pulse 2 (240/255).
     */
    private val SUCCESS_TIMINGS = longArrayOf(0, 45, 65, 55)
    private val SUCCESS_AMPLITUDES = intArrayOf(0, 200, 0, 240)

    /**
     * Single muted rejection pulse for unrecoverable errors.
     */
    private val ERROR_TIMINGS = longArrayOf(0, 120)
    private val ERROR_AMPLITUDES = intArrayOf(0, 180)

    /**
     * Dispatches tactile double-pulse confirmation when attendance is confirmed by the server
     * or committed to local offline storage.
     */
    fun notifyAttendanceSuccess(context: Context) {
        feedbackScope.launch {
            try {
                val vibrator = getVibrator(context) ?: return@launch
                if (!vibrator.hasVibrator()) return@launch

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R &&
                    vibrator.areAllPrimitivesSupported(
                        VibrationEffect.Composition.PRIMITIVE_CLICK,
                        VibrationEffect.Composition.PRIMITIVE_TICK
                    )
                ) {
                    val composition = VibrationEffect.startComposition()
                        .addPrimitive(VibrationEffect.Composition.PRIMITIVE_CLICK, 0.8f)
                        .addPrimitive(VibrationEffect.Composition.PRIMITIVE_TICK, 1.0f, 65)
                        .compose()
                    vibrator.vibrate(composition)
                } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    val effect = VibrationEffect.createWaveform(SUCCESS_TIMINGS, SUCCESS_AMPLITUDES, -1)
                    vibrator.vibrate(effect)
                } else {
                    @Suppress("DEPRECATION")
                    vibrator.vibrate(SUCCESS_TIMINGS, -1)
                }
            } catch (_: Throwable) {
                // Silently ignore if device prohibits vibration
            }
        }
    }

    /**
     * Dispatches a single rejection pulse when attendance verification permanently fails.
     */
    fun notifyAttendanceError(context: Context) {
        feedbackScope.launch {
            try {
                val vibrator = getVibrator(context) ?: return@launch
                if (!vibrator.hasVibrator()) return@launch

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    val effect = VibrationEffect.createWaveform(ERROR_TIMINGS, ERROR_AMPLITUDES, -1)
                    vibrator.vibrate(effect)
                } else {
                    @Suppress("DEPRECATION")
                    vibrator.vibrate(ERROR_TIMINGS, -1)
                }
            } catch (_: Throwable) {
                // Silently ignore
            }
        }
    }

    private fun getVibrator(context: Context): Vibrator? {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
            vibratorManager?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }
    }
}
