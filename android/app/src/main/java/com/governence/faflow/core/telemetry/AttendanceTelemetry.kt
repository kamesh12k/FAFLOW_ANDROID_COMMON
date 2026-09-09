package com.governence.faflow.core.telemetry

import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicLong

/**
 * Non-sensitive technical performance and operational metrics collector.
 * PRIVACY GUARANTEE: Never logs or collects biometric images, vectors, or sensitive user data.
 */
object AttendanceTelemetry {

    private val metricsMap = ConcurrentHashMap<String, AtomicLong>()
    private val eventsMap = ConcurrentHashMap<String, String>()
    private var isTelemetryEnabled = true

    fun setEnabled(enabled: Boolean) {
        isTelemetryEnabled = enabled
    }

    fun recordMetric(metricName: String, durationMs: Long) {
        if (!isTelemetryEnabled) return
        metricsMap.computeIfAbsent(metricName) { AtomicLong(0) }.set(durationMs)
        com.governence.faflow.core.logging.FaflowLogger.d("AttendanceTelemetry", "METRIC $metricName: ${durationMs}ms")
    }

    fun recordEvent(eventName: String, eventValue: String) {
        if (!isTelemetryEnabled) return
        eventsMap[eventName] = eventValue
    }

    fun getMetric(metricName: String): Long {
        return metricsMap[metricName]?.get() ?: 0L
    }

    fun getEvent(eventName: String): String? {
        return eventsMap[eventName]
    }

    fun clear() {
        metricsMap.clear()
        eventsMap.clear()
    }

    // Telemetry metric keys
    const val METRIC_GPS_ACQUISITION_MS = "gps_acquisition_latency_ms"
    const val METRIC_SCRFD_DETECTION_MS = "scrfd_face_detection_latency_ms"
    const val METRIC_UMEYAMA_ALIGNMENT_MS = "umeyama_alignment_latency_ms"
    const val METRIC_ARCFACE_EMBEDDING_MS = "arcface_embedding_latency_ms"
    const val METRIC_LIVENESS_VERIFICATION_MS = "liveness_verification_latency_ms"
    const val METRIC_NETWORK_SUBMISSION_MS = "network_submission_latency_ms"

    // Item 25 Performance Telemetry Keys
    const val METRIC_APP_STARTUP_MS = "appStartupMs"
    const val METRIC_FIRST_SCREEN_RENDER_MS = "firstScreenRenderMs"
    const val METRIC_FIRST_SCREEN_INTERACTIVE_MS = "firstScreenInteractiveMs"
    const val METRIC_ATTENDANCE_SCREEN_OPEN_MS = "attendanceScreenOpenMs"
    const val METRIC_CAMERA_READY_MS = "cameraReadyMs"
    const val METRIC_FACE_DETECTION_MS = "faceDetectionMs"
    const val METRIC_CAPTURE_DECISION_MS = "captureDecisionMs"
    const val METRIC_EMBEDDING_MS = "embeddingMs"
    const val METRIC_MATCHING_MS = "matchingMs"
    const val METRIC_BACKEND_MS = "backendMs"
    const val METRIC_TOTAL_ATTENDANCE_MS = "totalAttendanceMs"
}
