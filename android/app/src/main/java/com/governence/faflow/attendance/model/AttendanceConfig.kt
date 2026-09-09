package com.governence.faflow.attendance.model

/**
 * Attendance performance and pipeline configuration.
 */
object AttendanceConfig {
    /**
     * Target end-to-end time budget for tap-to-complete attendance on device.
     * Includes geofence in-memory validation, face detection, passive liveness,
     * canonical alignment, feature embedding, cosine matching, and network persistence.
     */
    const val PIPELINE_TIME_BUDGET_MS: Long = 1000L

    /**
     * Production tuning recommendations for devices exceeding time budget:
     * 1. Ensure NNAPI or GPU execution provider is enabled in OrtSession options.
     * 2. Downscale detector input resolution (e.g. 320x320 instead of 640x640).
     * 3. Pre-warm GPS location continuous cache to keep tap check strictly in-memory (< 1ms).
     */
}
