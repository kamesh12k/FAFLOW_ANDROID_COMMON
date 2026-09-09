package com.governence.faflow.attendance.pipeline

import android.graphics.Bitmap
import com.governence.faflow.attendance.biometrics.FaceDetector
import com.governence.faflow.attendance.biometrics.liveness.LivenessState
import com.governence.faflow.attendance.biometrics.model.FaceDetectionResult
import com.governence.faflow.attendance.biometrics.model.StaffBiometricVerificationState
import com.governence.faflow.attendance.biometrics.recognition.FaceRecognitionEngine
import com.governence.faflow.attendance.data.AttendanceRepository
import com.governence.faflow.attendance.data.AttendanceSubmissionResult
import com.governence.faflow.attendance.geolocation.GeofenceValidator
import com.governence.faflow.attendance.geolocation.LocationVerificationResult
import com.governence.faflow.attendance.geolocation.StaffLiveLocation
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Result of the unified single-pass attendance pipeline.
 */
sealed interface AttendancePipelineResult {
    data class Success(
        val submission: AttendanceSubmissionResult,
        val elapsedMs: Long,
        val similarityScore: Float
    ) : AttendancePipelineResult

    data class GeofenceRejected(val reason: String) : AttendancePipelineResult
    data class NoFaceDetected(val reason: String) : AttendancePipelineResult
    data class LivenessFailed(val reason: String) : AttendancePipelineResult
    data class BiometricMismatch(val similarityScore: Float, val threshold: Float) : AttendancePipelineResult
    data class BiometricNotEnrolled(val staffId: String) : AttendancePipelineResult
    data class SubmissionFailed(val errorCode: Int, val message: String) : AttendancePipelineResult
    data class PipelineError(val message: String, val throwable: Throwable? = null) : AttendancePipelineResult
}

/**
 * Unified Attendance Pipeline Orchestrator.
 * Chained execution order:
 * 1. Geolocation Geofence check (instant in-memory pre-warmed fix, fail-fast)
 * 2. Single-frame Face Detection (Scrfd / Native)
 * 3. Passive Liveness defense (temporal landmark variance + active challenge evaluation) — FAIL CLOSED
 * 4. 5-point Umeyama canonical facial alignment
 * 5. Deep neural feature embedding (MobileFaceNet / ArcFace)
 * 6. Cosine similarity identity matching against enrolled profile
 * 7. Backend shift persistence (online or queued offline)
 *
 * SECURITY CONTRACT:
 *   Liveness MUST be independently verified (LivenessState.Passed) before identity matching proceeds.
 *   A passing identity score alone does NOT grant liveness authorization.
 *   BIOMETRIC ENGINE FAILURE = FAIL CLOSED.
 */
class AttendancePipelineOrchestrator(
    private val attendanceRepository: AttendanceRepository,
    private val recognitionEngine: FaceRecognitionEngine
) {

    suspend fun executeSinglePass(
        isCheckIn: Boolean,
        sourceBitmap: Bitmap,
        faceDetector: FaceDetector,
        currentLocation: StaffLiveLocation?,
        targetStaffId: String,
        locationVerificationResult: LocationVerificationResult? = null
    ): AttendancePipelineResult = withContext(Dispatchers.Default) {
        val startTimeMs = System.currentTimeMillis()

        // 1. Geolocation Verification (In-memory, fail-fast)
        if (locationVerificationResult is LocationVerificationResult.OutsideAllGeofences) {
            return@withContext AttendancePipelineResult.GeofenceRejected(
                "Outside campus perimeter: ${locationVerificationResult.distanceToNearestMeters.toInt()}m from nearest zone"
            )
        }

        // 2. Single-Frame Face Detection
        val detections = faceDetector.detectFaces(sourceBitmap)
        if (detections.isEmpty()) {
            return@withContext AttendancePipelineResult.NoFaceDetected(
                "No face detected in frame. Please face the camera and try again."
            )
        }
        val primaryFace = detections.first()

        // 3. LIVENESS VERIFICATION — FAIL CLOSED.
        // SECURITY: DO NOT change to `val livenessValid = true`. This gate is mandatory.
        // Any state other than LivenessState.Passed is treated as a presentation attack.
        // This check runs independently of identity matching — a recognized face does NOT
        // grant liveness authorization. Both must pass independently.
        val livenessState = recognitionEngine.livenessEngine.processFrame(primaryFace)
        val livenessValid = livenessState is LivenessState.Passed
        if (!livenessValid) {
            val livenessReason = when (livenessState) {
                is LivenessState.SpoofSuspected ->
                    "Presentation attack detected: ${livenessState.reason}"
                is LivenessState.TimedOut ->
                    "Liveness challenge timed out. Please retry."
                is LivenessState.ChallengeActive ->
                    "Liveness challenge in progress: ${livenessState.instructions}"
                is LivenessState.WaitingForFace ->
                    "Liveness: waiting for stable face detection."
                else -> "Liveness verification not yet complete."
            }
            return@withContext AttendancePipelineResult.LivenessFailed(livenessReason)
        }

        // 4 & 5 & 6. Canonical Alignment, Neural Embedding & Cosine Matching
        val verificationState = recognitionEngine.verifyStaffIdentity(
            sourceBitmap = sourceBitmap,
            detection = primaryFace,
            staffId = targetStaffId
        )

        when (verificationState) {
            is StaffBiometricVerificationState.Verified -> {
                val staffUserId = targetStaffId.toIntOrNull() ?: 1
                val lat = currentLocation?.latitude ?: 13.0827
                val lng = currentLocation?.longitude ?: 80.2707
                val accuracy = currentLocation?.accuracyMeters?.toDouble() ?: 5.0

                val submissionResult = if (isCheckIn) {
                    attendanceRepository.checkIn(
                        latitude = lat,
                        longitude = lng,
                        accuracyMeters = accuracy,
                        faceSimilarityScore = verificationState.similarity.toDouble(),
                        livenessVerified = true, // livenessValid confirmed above at step 3
                        userId = staffUserId
                    )
                } else {
                    attendanceRepository.checkOut(
                        latitude = lat,
                        longitude = lng,
                        accuracyMeters = accuracy,
                        faceSimilarityScore = verificationState.similarity.toDouble(),
                        livenessVerified = true, // livenessValid confirmed above at step 3
                        userId = staffUserId
                    )
                }

                val totalElapsed = System.currentTimeMillis() - startTimeMs
                when (submissionResult) {
                    is AttendanceSubmissionResult.Success -> AttendancePipelineResult.Success(
                        submission = submissionResult.copy(elapsedMs = totalElapsed),
                        elapsedMs = totalElapsed,
                        similarityScore = verificationState.similarity
                    )
                    is AttendanceSubmissionResult.QueuedOffline -> AttendancePipelineResult.Success(
                        submission = submissionResult.copy(elapsedMs = totalElapsed),
                        elapsedMs = totalElapsed,
                        similarityScore = verificationState.similarity
                    )
                    is AttendanceSubmissionResult.Failed -> AttendancePipelineResult.SubmissionFailed(
                        errorCode = submissionResult.errorCode,
                        message = submissionResult.message
                    )
                }
            }

            is StaffBiometricVerificationState.VerificationFailed -> {
                AttendancePipelineResult.BiometricMismatch(
                    similarityScore = verificationState.similarity,
                    threshold = verificationState.threshold
                )
            }

            is StaffBiometricVerificationState.NoEnrollment -> {
                AttendancePipelineResult.BiometricNotEnrolled(targetStaffId)
            }

            is StaffBiometricVerificationState.Unavailable -> {
                AttendancePipelineResult.PipelineError(verificationState.reason)
            }

            else -> {
                AttendancePipelineResult.BiometricMismatch(
                    similarityScore = 0f,
                    threshold = 0.85f
                )
            }
        }
    }
}
