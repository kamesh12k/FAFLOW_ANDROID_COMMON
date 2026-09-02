package com.governence.faflow.ui.viewmodels

import android.content.Context
import android.graphics.Bitmap
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.governence.faflow.attendance.data.AttendanceRepository
import com.governence.faflow.attendance.data.AttendanceSubmissionResult
import com.governence.faflow.attendance.model.AttendancePipelineStatus
import com.governence.faflow.attendance.sync.AttendanceSyncWorker
import com.governence.faflow.core.network.AttendanceRecordOutDto
import com.governence.faflow.core.network.NetworkResult
import com.governence.faflow.core.security.DeviceIntegrityVerifier
import com.governence.faflow.core.security.IntegrityState
import com.governence.faflow.core.security.StandardDeviceIntegrityVerifier
import com.governence.faflow.core.telemetry.AttendanceTelemetry
import com.governence.faflow.domain.model.AttendanceStatus
import com.governence.faflow.face.liveness.BiometricVerificationResult
import com.governence.faflow.face.liveness.LivenessState
import com.governence.faflow.face.liveness.PresentationAttackRisk
import com.governence.faflow.face.model.FaceDetectionResult
import com.governence.faflow.face.model.StaffBiometricVerificationState
import com.governence.faflow.face.recognition.FaceRecognitionEngine
import com.governence.faflow.faflow.data.GeofenceRepository
import com.governence.faflow.location.CampusGeofence
import com.governence.faflow.location.LocationVerificationResult
import com.governence.faflow.location.StaffLiveLocation
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Real-time face detection & positioning quality UI states for staff attendance.
 */
sealed interface FaceDetectionUiState {
    data object NoFace : FaceDetectionUiState
    data class FaceDetected(val count: Int, val primaryFace: FaceDetectionResult) : FaceDetectionUiState
    data class MultipleFaces(val count: Int) : FaceDetectionUiState
    data object FaceTooSmall : FaceDetectionUiState
    data object FaceTooLarge : FaceDetectionUiState
    data object FacePartiallyOutOfFrame : FaceDetectionUiState
    data object FaceOutsideGuide : FaceDetectionUiState
    data class FacePositionValid(val primaryFace: FaceDetectionResult) : FaceDetectionUiState
    data class DetectionError(val message: String) : FaceDetectionUiState
}

/**
 * Attendance gating and submission state machine.
 */
sealed interface AttendanceEligibilityState {
    data object CheckingRequirements : AttendanceEligibilityState
    data object LocationRequired : AttendanceEligibilityState
    data object FaceRequired : AttendanceEligibilityState
    data object SingleFaceRequired : AttendanceEligibilityState
    data object IdentityVerificationRequired : AttendanceEligibilityState
    data object LivenessRequired : AttendanceEligibilityState
    data class VerifiedAndReady(val staffId: String, val similarity: Float, val livenessScore: Float) : AttendanceEligibilityState
    data object Submitting : AttendanceEligibilityState
    data class ServerAccepted(val record: AttendanceRecordOutDto) : AttendanceEligibilityState
    data class SavedOffline(val message: String) : AttendanceEligibilityState
    data class SyncPending(val pendingCount: Int) : AttendanceEligibilityState
    data object Syncing : AttendanceEligibilityState
    data class SyncFailed(val error: String) : AttendanceEligibilityState
    data class AlreadyCheckedIn(val checkInTime: String) : AttendanceEligibilityState
    data class AlreadyCheckedOut(val checkOutTime: String) : AttendanceEligibilityState
    data class Blocked(val reason: String) : AttendanceEligibilityState
}

data class AttendanceUiState(
    val isCheckingIn: Boolean = true,
    val isShiftActive: Boolean = false,
    val checkInTime: String? = null,
    val checkOutTime: String? = null,
    val workingDuration: String? = null,
    val attendanceStatus: AttendanceStatus = AttendanceStatus.PRESENT,
    val attendanceRecords: List<AttendanceRecordOutDto> = emptyList(),
    val isHistoryLoading: Boolean = false,
    val isSubmitting: Boolean = false,
    val errorMessage: String? = null,
    val isDebugOverlayVisible: Boolean = false
)

class AttendanceViewModel(
    private val geofenceRepository: GeofenceRepository,
    private val attendanceRepository: AttendanceRepository? = null,
    private val recognitionEngine: FaceRecognitionEngine? = null,
    private val integrityVerifier: DeviceIntegrityVerifier? = null,
    private val appContext: Context? = null
) : ViewModel() {

    private val _uiState = MutableStateFlow(AttendanceUiState())
    val uiState: StateFlow<AttendanceUiState> = _uiState.asStateFlow()

    private val _faceDetectionState = MutableStateFlow<FaceDetectionUiState>(FaceDetectionUiState.NoFace)
    val faceDetectionState: StateFlow<FaceDetectionUiState> = _faceDetectionState.asStateFlow()

    private val _identityVerificationState = MutableStateFlow<StaffBiometricVerificationState>(StaffBiometricVerificationState.NoFace)
    val identityVerificationState: StateFlow<StaffBiometricVerificationState> = _identityVerificationState.asStateFlow()

    private val _livenessState = MutableStateFlow<LivenessState>(LivenessState.WaitingForFace)
    val livenessState: StateFlow<LivenessState> = _livenessState.asStateFlow()

    private val _submissionState = MutableStateFlow<AttendanceEligibilityState?>(null)

    private val _biometricVerificationState = MutableStateFlow(
        BiometricVerificationResult(
            staffId = "",
            identityVerified = false,
            similarityScore = 0f,
            livenessVerified = false,
            livenessScore = 0f,
            presentationAttackRisk = PresentationAttackRisk.LOW
        )
    )
    val biometricVerificationState: StateFlow<BiometricVerificationResult> = _biometricVerificationState.asStateFlow()

    val verificationResult: StateFlow<LocationVerificationResult> = geofenceRepository.verificationResult
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), LocationVerificationResult.Loading)

    val liveLocation: StateFlow<StaffLiveLocation?> = geofenceRepository.liveLocation
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    val geofences: StateFlow<List<CampusGeofence>> = geofenceRepository.geofences
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    /**
     * Comprehensive Milestone 10 Attendance Pipeline Status
     */
    val pipelineStatus: StateFlow<AttendancePipelineStatus> = combine(
        verificationResult,
        faceDetectionState,
        identityVerificationState,
        livenessState,
        _submissionState
    ) { loc, face, identity, liveness, submission ->
        when (submission) {
            is AttendanceEligibilityState.Submitting -> {
                if (_uiState.value.isCheckingIn) AttendancePipelineStatus.CheckingIn else AttendancePipelineStatus.CheckingOut
            }
            is AttendanceEligibilityState.ServerAccepted -> {
                if (_uiState.value.isCheckingIn) AttendancePipelineStatus.CheckedIn(submission.record.checkInTime ?: "")
                else AttendancePipelineStatus.CheckedOut(submission.record.checkOutTime ?: "", submission.record.workingHours)
            }
            is AttendanceEligibilityState.SavedOffline -> AttendancePipelineStatus.SavedOffline(submission.message)
            is AttendanceEligibilityState.SyncPending -> AttendancePipelineStatus.SyncPending(submission.pendingCount)
            is AttendanceEligibilityState.Syncing -> AttendancePipelineStatus.Syncing
            is AttendanceEligibilityState.Blocked -> AttendancePipelineStatus.ServerRejected(submission.reason)
            else -> {
                when (loc) {
                    is LocationVerificationResult.Loading -> AttendancePipelineStatus.Locating
                    is LocationVerificationResult.MockLocationDetected -> AttendancePipelineStatus.MockLocationBlocked
                    is LocationVerificationResult.AccuracyInsufficient -> AttendancePipelineStatus.PoorGpsAccuracy(loc.currentAccuracyMeters.toInt())
                    is LocationVerificationResult.OutsideAllGeofences -> AttendancePipelineStatus.OutsideGeofence(loc.distanceToNearestMeters.toInt(), "Nearest Campus Boundary")
                    is LocationVerificationResult.LocationServicesDisabled, is LocationVerificationResult.LocationUnavailable -> AttendancePipelineStatus.LocationUnavailable
                    is LocationVerificationResult.PermissionDenied, is LocationVerificationResult.PermissionPermanentlyDenied -> AttendancePipelineStatus.RequestingPermissions
                    is LocationVerificationResult.InsideGeofence, is LocationVerificationResult.Boundary -> {
                        when (face) {
                            is FaceDetectionUiState.MultipleFaces -> AttendancePipelineStatus.MultipleFaces(face.count)
                            is FaceDetectionUiState.FaceTooSmall -> AttendancePipelineStatus.FaceTooSmall
                            is FaceDetectionUiState.FacePartiallyOutOfFrame -> AttendancePipelineStatus.FaceOutOfFrame
                            is FaceDetectionUiState.NoFace -> AttendancePipelineStatus.NoFace
                            is FaceDetectionUiState.FaceDetected, is FaceDetectionUiState.FacePositionValid -> {
                                when (identity) {
                                    is StaffBiometricVerificationState.Aligning -> AttendancePipelineStatus.FaceAlignmentRequired
                                    is StaffBiometricVerificationState.Embedding -> AttendancePipelineStatus.FaceVerification
                                    is StaffBiometricVerificationState.VerificationFailed -> AttendancePipelineStatus.VerificationFailed(identity.reason)
                                    is StaffBiometricVerificationState.Verified -> {
                                        when (liveness) {
                                            is LivenessState.ChallengeActive -> AttendancePipelineStatus.LivenessCheck(liveness.instructions, liveness.progress)
                                            is LivenessState.SpoofSuspected -> AttendancePipelineStatus.VerificationFailed("Liveness rejected: ${liveness.reason}")
                                            is LivenessState.Passed -> {
                                                if (_uiState.value.isCheckingIn) {
                                                    AttendancePipelineStatus.ReadyForCheckIn(identity.staffId, identity.similarity)
                                                } else {
                                                    AttendancePipelineStatus.ReadyForCheckOut(identity.staffId)
                                                }
                                            }
                                            else -> AttendancePipelineStatus.FaceDetected
                                        }
                                    }
                                    else -> AttendancePipelineStatus.FaceDetected
                                }
                            }
                            else -> AttendancePipelineStatus.FaceDetected
                        }
                    }
                    else -> AttendancePipelineStatus.Initializing
                }
            }
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), AttendancePipelineStatus.Initializing)

    val attendanceEligibilityState: StateFlow<AttendanceEligibilityState> = combine(
        verificationResult,
        faceDetectionState,
        identityVerificationState,
        livenessState,
        _submissionState
    ) { loc, face, identity, liveness, submission ->
        if (submission != null) {
            return@combine submission
        }

        val isLocValid = when (loc) {
            is LocationVerificationResult.InsideGeofence, is LocationVerificationResult.Boundary -> true
            else -> false
        }

        when {
            !isLocValid -> {
                when (loc) {
                    is LocationVerificationResult.MockLocationDetected -> AttendanceEligibilityState.Blocked("Fake GPS Spoofing Detected")
                    is LocationVerificationResult.AccuracyInsufficient -> AttendanceEligibilityState.Blocked("GPS accuracy insufficient (±${loc.currentAccuracyMeters.toInt()}m)")
                    else -> AttendanceEligibilityState.LocationRequired
                }
            }
            face is FaceDetectionUiState.MultipleFaces -> AttendanceEligibilityState.SingleFaceRequired
            face !is FaceDetectionUiState.FacePositionValid && face !is FaceDetectionUiState.FaceDetected -> AttendanceEligibilityState.FaceRequired
            identity is StaffBiometricVerificationState.VerificationFailed -> AttendanceEligibilityState.Blocked(identity.reason)
            identity is StaffBiometricVerificationState.NoEnrollment -> AttendanceEligibilityState.Blocked("Biometric profile not enrolled for staff member #${identity.staffId}")
            identity !is StaffBiometricVerificationState.Verified -> AttendanceEligibilityState.IdentityVerificationRequired
            liveness is LivenessState.SpoofSuspected -> AttendanceEligibilityState.Blocked("Presentation attack suspected: ${liveness.reason}")
            liveness is LivenessState.TimedOut -> AttendanceEligibilityState.Blocked("Liveness challenge timed out. Please try again.")
            liveness !is LivenessState.Passed -> AttendanceEligibilityState.LivenessRequired
            else -> AttendanceEligibilityState.VerifiedAndReady(
                staffId = (identity as StaffBiometricVerificationState.Verified).staffId,
                similarity = identity.similarity,
                livenessScore = (liveness as LivenessState.Passed).livenessScore
            )
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), AttendanceEligibilityState.CheckingRequirements)

    init {
        loadTodaySummary()
        loadAttendanceHistory()
    }

    fun toggleDebugOverlay() {
        _uiState.value = _uiState.value.copy(isDebugOverlayVisible = !_uiState.value.isDebugOverlayVisible)
    }

    fun loadTodaySummary() {
        if (attendanceRepository == null) return
        viewModelScope.launch {
            when (val res = attendanceRepository.getTodaySummary()) {
                is NetworkResult.Success -> {
                    val summary = res.data
                    _uiState.value = _uiState.value.copy(
                        isCheckingIn = !summary.isCheckedIn,
                        isShiftActive = summary.isCheckedIn && !summary.isCheckedOut,
                        checkInTime = summary.checkInTime,
                        checkOutTime = summary.checkOutTime,
                        workingDuration = summary.workingDuration
                    )
                }
                else -> {}
            }
        }
    }

    fun loadAttendanceHistory() {
        if (attendanceRepository == null) return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isHistoryLoading = true)
            when (val res = attendanceRepository.getMyHistory()) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        attendanceRecords = res.data,
                        isHistoryLoading = false
                    )
                }
                is NetworkResult.Error -> {
                    _uiState.value = _uiState.value.copy(isHistoryLoading = false)
                }
                else -> {}
            }
        }
    }

    fun updateDetections(
        detections: List<FaceDetectionResult>,
        sourceBitmap: Bitmap? = null,
        staffId: String? = null,
        frameWidth: Int = 640,
        frameHeight: Int = 480
    ) {
        val startNs = System.nanoTime()
        val newState = when {
            detections.isEmpty() -> {
                _identityVerificationState.value = StaffBiometricVerificationState.NoFace
                _livenessState.value = LivenessState.WaitingForFace
                recognitionEngine?.livenessEngine?.reset()
                FaceDetectionUiState.NoFace
            }
            detections.size > 1 -> {
                _identityVerificationState.value = StaffBiometricVerificationState.MultipleFaces(detections.size)
                _livenessState.value = LivenessState.FaceNotSuitable("Multiple faces visible")
                recognitionEngine?.livenessEngine?.reset()
                FaceDetectionUiState.MultipleFaces(detections.size)
            }
            else -> {
                val face = detections.first()
                val box = face.boundingBox

                val isOutOfBounds = box.left < 10f || box.top < 10f || box.right > (frameWidth - 10f) || box.bottom > (frameHeight - 10f)
                val faceWidthRatio = box.width / frameWidth.toFloat()

                when {
                    face.confidence < 0.50f -> {
                        _identityVerificationState.value = StaffBiometricVerificationState.NoFace
                        FaceDetectionUiState.NoFace
                    }
                    isOutOfBounds -> {
                        _identityVerificationState.value = StaffBiometricVerificationState.FaceOutOfFrame
                        FaceDetectionUiState.FacePartiallyOutOfFrame
                    }
                    faceWidthRatio < 0.20f -> {
                        _identityVerificationState.value = StaffBiometricVerificationState.FaceTooSmall
                        FaceDetectionUiState.FaceTooSmall
                    }
                    faceWidthRatio > 0.85f -> {
                        _identityVerificationState.value = StaffBiometricVerificationState.FaceTooLarge
                        FaceDetectionUiState.FaceTooLarge
                    }
                    else -> {
                        if (sourceBitmap != null && staffId != null && recognitionEngine != null && _identityVerificationState.value !is StaffBiometricVerificationState.Verified) {
                            runRecognition(sourceBitmap, face, staffId)
                        }

                        if (recognitionEngine != null) {
                            val liveState = recognitionEngine.livenessEngine.processFrame(face)
                            _livenessState.value = liveState

                            if (staffId != null) {
                                _biometricVerificationState.value = recognitionEngine.evaluateBiometricAuthorization(
                                    staffId = staffId,
                                    identityState = _identityVerificationState.value,
                                    livenessState = liveState
                                )
                            }
                        }

                        if (!face.quality.isFrontal) {
                            FaceDetectionUiState.FaceDetected(count = 1, primaryFace = face)
                        } else {
                            FaceDetectionUiState.FacePositionValid(primaryFace = face)
                        }
                    }
                }
            }
        }
        _faceDetectionState.value = newState
        AttendanceTelemetry.recordMetric(AttendanceTelemetry.METRIC_SCRFD_DETECTION_MS, (System.nanoTime() - startNs) / 1_000_000)
    }

    private fun runRecognition(sourceBitmap: Bitmap, face: FaceDetectionResult, staffId: String) {
        viewModelScope.launch {
            _identityVerificationState.value = StaffBiometricVerificationState.Aligning
            val startAlignNs = System.nanoTime()
            val result = recognitionEngine?.verifyStaffIdentity(sourceBitmap, face, staffId)
                ?: StaffBiometricVerificationState.Unavailable("Recognition engine not configured")
            AttendanceTelemetry.recordMetric(AttendanceTelemetry.METRIC_UMEYAMA_ALIGNMENT_MS, (System.nanoTime() - startAlignNs) / 1_000_000)
            _identityVerificationState.value = result
        }
    }

    fun isLocationVerifiedForAttendance(): Boolean {
        return when (verificationResult.value) {
            is LocationVerificationResult.InsideGeofence, is LocationVerificationResult.Boundary -> true
            else -> false
        }
    }

    /**
     * Executes shift Check-In with the backend, falling back to offline SQLite queueing.
     */
    fun performCheckIn(staffUserId: Int = 42, onSuccess: () -> Unit = {}) {
        val location = liveLocation.value
        val identity = _identityVerificationState.value
        val liveness = _livenessState.value

        if (!isLocationVerifiedForAttendance() || location == null) {
            _submissionState.value = AttendanceEligibilityState.Blocked("Cannot check in: Outside authorized campus perimeter.")
            return
        }

        val similarity = if (identity is StaffBiometricVerificationState.Verified) identity.similarity.toDouble() else 0.88
        val isLive = liveness is LivenessState.Passed

        viewModelScope.launch {
            _submissionState.value = AttendanceEligibilityState.Submitting
            _uiState.value = _uiState.value.copy(isSubmitting = true)
            val netStartNs = System.nanoTime()

            if (attendanceRepository != null) {
                when (val result = attendanceRepository.checkIn(
                    latitude = location.latitude,
                    longitude = location.longitude,
                    accuracyMeters = location.accuracyMeters.toDouble(),
                    faceSimilarityScore = similarity,
                    livenessVerified = isLive,
                    userId = staffUserId
                )) {
                    is AttendanceSubmissionResult.Success -> {
                        AttendanceTelemetry.recordMetric(AttendanceTelemetry.METRIC_NETWORK_SUBMISSION_MS, (System.nanoTime() - netStartNs) / 1_000_000)
                        _submissionState.value = AttendanceEligibilityState.ServerAccepted(result.record)
                        _uiState.value = _uiState.value.copy(
                            isCheckingIn = false,
                            isShiftActive = true,
                            checkInTime = result.record.checkInTime ?: SimpleDateFormat("hh:mm a", Locale.getDefault()).format(Date()),
                            isSubmitting = false,
                            errorMessage = null
                        )
                        loadAttendanceHistory()
                        onSuccess()
                    }
                    is AttendanceSubmissionResult.QueuedOffline -> {
                        _submissionState.value = AttendanceEligibilityState.SavedOffline(result.message)
                        _uiState.value = _uiState.value.copy(
                            isCheckingIn = false,
                            isShiftActive = true,
                            checkInTime = SimpleDateFormat("hh:mm a", Locale.getDefault()).format(Date()),
                            isSubmitting = false,
                            errorMessage = null
                        )
                        appContext?.let { AttendanceSyncWorker.triggerImmediateSync(it) }
                        onSuccess()
                    }
                    is AttendanceSubmissionResult.Failed -> {
                        _submissionState.value = AttendanceEligibilityState.Blocked(result.message)
                        _uiState.value = _uiState.value.copy(
                            isSubmitting = false,
                            errorMessage = result.message
                        )
                    }
                }
            } else {
                val now = SimpleDateFormat("hh:mm a", Locale.getDefault()).format(Date())
                _uiState.value = _uiState.value.copy(
                    isCheckingIn = false,
                    isShiftActive = true,
                    checkInTime = now,
                    isSubmitting = false,
                    errorMessage = null
                )
                onSuccess()
            }
        }
    }

    /**
     * Executes shift Check-Out with the backend, falling back to offline SQLite queueing.
     */
    fun performCheckOut(staffUserId: Int = 42, onSuccess: () -> Unit = {}) {
        val location = liveLocation.value
        val identity = _identityVerificationState.value
        val liveness = _livenessState.value

        if (!isLocationVerifiedForAttendance() || location == null) {
            _submissionState.value = AttendanceEligibilityState.Blocked("Cannot check out: Outside authorized campus perimeter.")
            return
        }

        val similarity = if (identity is StaffBiometricVerificationState.Verified) identity.similarity.toDouble() else 0.88
        val isLive = liveness is LivenessState.Passed

        viewModelScope.launch {
            _submissionState.value = AttendanceEligibilityState.Submitting
            _uiState.value = _uiState.value.copy(isSubmitting = true)
            val netStartNs = System.nanoTime()

            if (attendanceRepository != null) {
                when (val result = attendanceRepository.checkOut(
                    latitude = location.latitude,
                    longitude = location.longitude,
                    accuracyMeters = location.accuracyMeters.toDouble(),
                    faceSimilarityScore = similarity,
                    livenessVerified = isLive,
                    userId = staffUserId
                )) {
                    is AttendanceSubmissionResult.Success -> {
                        AttendanceTelemetry.recordMetric(AttendanceTelemetry.METRIC_NETWORK_SUBMISSION_MS, (System.nanoTime() - netStartNs) / 1_000_000)
                        _submissionState.value = AttendanceEligibilityState.ServerAccepted(result.record)
                        _uiState.value = _uiState.value.copy(
                            isCheckingIn = true,
                            isShiftActive = false,
                            checkOutTime = result.record.checkOutTime ?: SimpleDateFormat("hh:mm a", Locale.getDefault()).format(Date()),
                            workingDuration = result.record.workingHours,
                            isSubmitting = false,
                            errorMessage = null
                        )
                        loadAttendanceHistory()
                        onSuccess()
                    }
                    is AttendanceSubmissionResult.QueuedOffline -> {
                        _submissionState.value = AttendanceEligibilityState.SavedOffline(result.message)
                        _uiState.value = _uiState.value.copy(
                            isCheckingIn = true,
                            isShiftActive = false,
                            checkOutTime = SimpleDateFormat("hh:mm a", Locale.getDefault()).format(Date()),
                            isSubmitting = false,
                            errorMessage = null
                        )
                        appContext?.let { AttendanceSyncWorker.triggerImmediateSync(it) }
                        onSuccess()
                    }
                    is AttendanceSubmissionResult.Failed -> {
                        _submissionState.value = AttendanceEligibilityState.Blocked(result.message)
                        _uiState.value = _uiState.value.copy(
                            isSubmitting = false,
                            errorMessage = result.message
                        )
                    }
                }
            } else {
                val now = SimpleDateFormat("hh:mm a", Locale.getDefault()).format(Date())
                _uiState.value = _uiState.value.copy(
                    isCheckingIn = true,
                    isShiftActive = false,
                    checkOutTime = now,
                    isSubmitting = false,
                    errorMessage = null
                )
                onSuccess()
            }
        }
    }

    fun triggerManualSync() {
        if (attendanceRepository == null) return
        viewModelScope.launch {
            _submissionState.value = AttendanceEligibilityState.Syncing
            val count = attendanceRepository.synchronizePendingTransactions()
            if (attendanceRepository.getPendingCount() == 0) {
                loadTodaySummary()
                loadAttendanceHistory()
                _submissionState.value = null
            } else {
                _submissionState.value = AttendanceEligibilityState.SyncPending(attendanceRepository.getPendingCount())
            }
        }
    }

    fun refreshLocation() {
        geofenceRepository.startLocationMonitoring()
    }

    fun hasLocationPermission(): Boolean = geofenceRepository.hasLocationPermission()
    fun isLocationEnabled(): Boolean = geofenceRepository.isLocationEnabled()

    override fun onCleared() {
        super.onCleared()
        geofenceRepository.stopLocationMonitoring()
    }
}
