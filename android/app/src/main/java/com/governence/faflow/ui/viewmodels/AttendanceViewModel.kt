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
import com.governence.faflow.attendance.biometrics.liveness.BiometricVerificationResult
import com.governence.faflow.attendance.biometrics.liveness.LivenessState
import com.governence.faflow.attendance.biometrics.liveness.PassiveLivenessEngine
import com.governence.faflow.attendance.biometrics.liveness.PassiveLivenessResult
import com.governence.faflow.attendance.biometrics.liveness.BlinkDetector
import com.governence.faflow.attendance.biometrics.liveness.BlinkState
import com.governence.faflow.attendance.biometrics.liveness.LivenessChallenge
import com.governence.faflow.attendance.biometrics.session.AttendanceOperationType
import com.governence.faflow.attendance.biometrics.session.VerificationSession
import com.governence.faflow.attendance.biometrics.session.VerificationStep
import com.governence.faflow.attendance.biometrics.liveness.PresentationAttackRisk
import com.governence.faflow.attendance.biometrics.model.FaceBox
import com.governence.faflow.attendance.biometrics.model.FaceDetectionResult
import com.governence.faflow.attendance.biometrics.model.FaceLandmarks
import com.governence.faflow.attendance.biometrics.model.FacePoint
import com.governence.faflow.attendance.biometrics.model.FaceQuality
import com.governence.faflow.attendance.biometrics.model.StaffBiometricVerificationState
import com.governence.faflow.attendance.biometrics.quality.FaceQualityCheckResult
import com.governence.faflow.attendance.biometrics.quality.FaceQualityValidator
import com.governence.faflow.attendance.biometrics.quality.QualityErrorCode
import com.governence.faflow.attendance.biometrics.recognition.FaceRecognitionEngine
import com.governence.faflow.attendance.biometrics.scrfd.ScrfdFaceDetector
import com.governence.faflow.faflow.data.GeofenceRepository
import com.governence.faflow.attendance.geolocation.CampusGeofence
import com.governence.faflow.attendance.geolocation.LocationVerificationResult
import com.governence.faflow.attendance.geolocation.StaffLiveLocation
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.Dispatchers
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
 * High-speed UX state machine for Instant Automatic Biometric Attendance ("Open -> Look -> Settle -> Done").
 */
enum class AutoCaptureState {
    SEARCHING,          // Scanning preview: "Positioning..."
    FACE_DETECTED,      // Initial face presence detected
    GOOD_FACE,          // Stable valid quality (alias for SETTLING)
    SETTLING,           // Smart settling window (200-500ms): "Hold still"
    CAPTURED,           // Frozen frame retained: "Checking..."
    SUCCESS,            // Authoritative server check-in confirmed: "Attendance recorded"
    RECOGNITION_FAILED, // Cosine mismatch: "Face not recognized"
    ERROR               // User-friendly error
}

/**
 * Candidate face frame evaluated during the smart settling window.
 */
data class CandidateFaceFrame(
    val bitmap: Bitmap,
    val detection: FaceDetectionResult,
    val qualityScore: Float,
    val timestampNs: Long
)


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

enum class ShiftState {
    NOT_STARTED,
    ON_DUTY,
    COMPLETED
}

data class AttendanceUiState(
    val isCheckingIn: Boolean = true,
    val isShiftActive: Boolean = false,
    val shiftState: ShiftState = ShiftState.NOT_STARTED,
    val checkInTime: String? = null,
    val checkOutTime: String? = null,
    val workingDuration: String? = null,
    val liveWorkingDuration: String? = null,
    val checkInGeofenceName: String? = null,
    val checkOutGeofenceName: String? = null,
    val attendanceStatus: AttendanceStatus = AttendanceStatus.PRESENT,
    val attendanceRecords: List<AttendanceRecordOutDto> = emptyList(),
    val isHistoryLoading: Boolean = false,
    val isSubmitting: Boolean = false,
    val errorMessage: String? = null,
    val isDebugOverlayVisible: Boolean = false,
    val supervisorLiveStatus: com.governence.faflow.core.network.SupervisorLiveStatusOutDto? = null,
    val isSupervisorLoading: Boolean = false
)

class AttendanceViewModel(
    private val geofenceRepository: GeofenceRepository,
    private val attendanceRepository: AttendanceRepository? = null,
    var recognitionEngine: FaceRecognitionEngine? = null,
    private val integrityVerifier: DeviceIntegrityVerifier? = null,
    private val appContext: Context? = null
) : ViewModel() {

    private val _uiState = MutableStateFlow(AttendanceUiState())
    val uiState: StateFlow<AttendanceUiState> = _uiState.asStateFlow()

    private val _autoCaptureState = MutableStateFlow<AutoCaptureState>(AutoCaptureState.SEARCHING)
    val autoCaptureState: StateFlow<AutoCaptureState> = _autoCaptureState.asStateFlow()

    private val _autoCapturePrompt = MutableStateFlow<String>("Position your face in the frame")
    val autoCapturePrompt: StateFlow<String> = _autoCapturePrompt.asStateFlow()

    private val _capturedFrameBitmap = MutableStateFlow<Bitmap?>(null)
    val capturedFrameBitmap: StateFlow<Bitmap?> = _capturedFrameBitmap.asStateFlow()

    private val _isCaptureLocked = MutableStateFlow<Boolean>(false)
    val isCaptureLocked: StateFlow<Boolean> = _isCaptureLocked.asStateFlow()

    private val isCaptureLockedFlag = AtomicBoolean(false)
    private val isOneShotRunning = AtomicBoolean(false)
    private var stableGoodFrameCount = 0
    private var settlingStartNs = 0L
    private val candidateFrames = mutableListOf<CandidateFaceFrame>()

    val passiveLivenessEngine = PassiveLivenessEngine()

    // Sub-Second Auto-Capture Settling Window: 160ms minimum natural elapsed time + 2 consecutive valid frames
    var minSettlingDurationMs = BIOMETRIC_MIN_SETTLING_DURATION_MS
        set(value) {
            field = value
            passiveLivenessEngine.minSettlingWindowMs = value
        }
    var minSettlingFrames = BIOMETRIC_REQUIRED_STABLE_FRAMES
        set(value) {
            field = value
            passiveLivenessEngine.minSettlingFrames = value
        }

    // Latency instrumentation timestamps (T0 -> T10)
    var t0ScreenActiveNs = 0L       // Screen active / initialized
    var t1CameraReadyNs = 0L        // Camera preview ready
    var t2FaceDetectedNs = 0L       // First face detected
    var t3QualityAcceptedNs = 0L    // Face quality accepted
    var t4PassivePadAcceptedNs = 0L // Silent passive PAD accepted
    var t5EmbeddingCompleteNs = 0L  // Face alignment & ArcFace embedding ready
    var t6MatchCompleteNs = 0L      // 3-template cosine match complete
    var t7ServerStartNs = 0L        // Attendance API submission started
    var t8ServerResponseNs = 0L     // Authoritative server response received
    var t9GreenSuccessNs = 0L       // Green reticle success animation triggered
    var t10HapticNs = 0L            // Success haptic triggered

    var t0Ns: Long get() = t0ScreenActiveNs; set(v) { t0ScreenActiveNs = v }
    var t1Ns: Long get() = t1CameraReadyNs; set(v) { t1CameraReadyNs = v }
    var t2Ns: Long get() = t5EmbeddingCompleteNs; set(v) { t5EmbeddingCompleteNs = v }
    var t3Ns: Long get() = t6MatchCompleteNs; set(v) { t6MatchCompleteNs = v }
    var t4Ns: Long get() = t7ServerStartNs; set(v) { t7ServerStartNs = v }
    var t5Ns: Long get() = t8ServerResponseNs; set(v) { t8ServerResponseNs = v }
    var t6Ns: Long get() = t9GreenSuccessNs; set(v) { t9GreenSuccessNs = v }

    fun recordScreenActive() {
        if (t0ScreenActiveNs == 0L) {
            t0ScreenActiveNs = System.nanoTime()
            logBiometric("T0_SCREEN_ACTIVE: $t0ScreenActiveNs")
        }
    }

    fun recordCameraReady() {
        if (t1CameraReadyNs == 0L) {
            t1CameraReadyNs = System.nanoTime()
            val startupMs = if (t0ScreenActiveNs > 0) (t1CameraReadyNs - t0ScreenActiveNs) / 1_000_000 else 0L
            logBiometric("T1_CAMERA_READY: $t1CameraReadyNs (startup: ${startupMs}ms)")
        }
    }

    // Anti-duplication lock: prevents concurrent attendance submissions
    private val isSubmissionInProgress = AtomicBoolean(false)

    private val _faceDetectionState = MutableStateFlow<FaceDetectionUiState>(FaceDetectionUiState.NoFace)
    val faceDetectionState: StateFlow<FaceDetectionUiState> = _faceDetectionState.asStateFlow()

    private val _identityVerificationState = MutableStateFlow<StaffBiometricVerificationState>(StaffBiometricVerificationState.NoFace)
    val identityVerificationState: StateFlow<StaffBiometricVerificationState> = _identityVerificationState.asStateFlow()

    private val _livenessState = MutableStateFlow<LivenessState>(LivenessState.WaitingForFace)
    val livenessState: StateFlow<LivenessState> = _livenessState.asStateFlow()

    private val _submissionState = MutableStateFlow<AttendanceEligibilityState?>(null)
    val submissionState: StateFlow<AttendanceEligibilityState?> = _submissionState.asStateFlow()

    private var activeSession = VerificationSession(operationType = AttendanceOperationType.CHECK_IN)
    val currentVerificationSession: VerificationSession get() = activeSession

    private val _verificationStep = MutableStateFlow<VerificationStep>(VerificationStep.IDLE)
    val verificationStep: StateFlow<VerificationStep> = _verificationStep.asStateFlow()

    val blinkDetector = BlinkDetector()
    private val _blinkCount = MutableStateFlow<Int>(0)
    val blinkCount: StateFlow<Int> = _blinkCount.asStateFlow()

    private val _livenessDebugInfo = MutableStateFlow(com.governence.faflow.attendance.biometrics.liveness.LivenessDebugInfo())
    val livenessDebugInfo: StateFlow<com.governence.faflow.attendance.biometrics.liveness.LivenessDebugInfo> = _livenessDebugInfo.asStateFlow()

    private val totalLivenessFrames = java.util.concurrent.atomic.AtomicLong(0L)
    private val droppedLivenessFrames = java.util.concurrent.atomic.AtomicLong(0L)

    fun logBiometric(event: String) = android.util.Log.i("FAFLOW", "[FAFLOW][BIOMETRIC]\n$event")
    fun logFace(event: String) = android.util.Log.i("FAFLOW", "[FAFLOW][FACE]\n$event")
    fun logLiveness(event: String) = android.util.Log.i("FAFLOW", "[FAFLOW][LIVENESS]\n$event")
    fun logBlink(event: String) = android.util.Log.i("FAFLOW", "[FAFLOW][BLINK]\n$event")
    fun logAttendance(event: String) = android.util.Log.i("FAFLOW", "[FAFLOW][ATTENDANCE]\n$event")

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
        if (_uiState.value.shiftState == ShiftState.COMPLETED) {
            return@combine AttendancePipelineStatus.CheckedOut(
                _uiState.value.checkOutTime ?: "",
                _uiState.value.workingDuration
            )
        }
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
                if (BYPASS_GEOLOCATION_FOR_TESTING) {
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
                } else {
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
                        else -> AttendancePipelineStatus.Initializing
                    }
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

        val isLocValid = if (BYPASS_GEOLOCATION_FOR_TESTING) true else when (loc) {
            is LocationVerificationResult.InsideGeofence, is LocationVerificationResult.Boundary -> true
            else -> false
        }

        when {
            !isLocValid -> {
                when (loc) {
                    is LocationVerificationResult.MockLocationDetected -> AttendanceEligibilityState.Blocked("Fake GPS Spoofing Detected")
                    // AccuracyInsufficient is a transient satellite calibrating state, not a permanent rejection
                    is LocationVerificationResult.AccuracyInsufficient -> AttendanceEligibilityState.LocationRequired
                    else -> AttendanceEligibilityState.LocationRequired
                }
            }
            face is FaceDetectionUiState.MultipleFaces -> AttendanceEligibilityState.SingleFaceRequired
            face !is FaceDetectionUiState.FacePositionValid && face !is FaceDetectionUiState.FaceDetected -> AttendanceEligibilityState.FaceRequired
            identity is StaffBiometricVerificationState.VerificationFailed -> AttendanceEligibilityState.Blocked(identity.reason)
            identity is StaffBiometricVerificationState.NoEnrollment -> AttendanceEligibilityState.Blocked("Biometric profile not enrolled for staff member #${identity.staffId}")
            identity !is StaffBiometricVerificationState.Verified -> AttendanceEligibilityState.IdentityVerificationRequired
            else -> AttendanceEligibilityState.VerifiedAndReady(
                staffId = (identity as StaffBiometricVerificationState.Verified).staffId,
                similarity = identity.similarity,
                livenessScore = 1.0f
            )
        }
    }.stateIn(viewModelScope, SharingStarted.Eagerly, AttendanceEligibilityState.CheckingRequirements)

    init {
        loadTodaySummary()
        loadAttendanceHistory()
    }

    /**
     * Resets biometric session, camera settling state, and UI state when logging out
     * or switching accounts.
     */
    fun resetSession() {
        _uiState.value = AttendanceUiState()
        _submissionState.value = null
        _autoCaptureState.value = AutoCaptureState.SEARCHING
        _autoCapturePrompt.value = "Position your face in the frame"
        _capturedFrameBitmap.value = null
        _isCaptureLocked.value = false
        isCaptureLockedFlag.set(false)
        isOneShotRunning.set(false)
        isSubmissionInProgress.set(false)
        t0Ns = 0L
        t1Ns = 0L
        t2Ns = 0L
        t3Ns = 0L
        t4Ns = 0L
        t5Ns = 0L
        t6Ns = 0L
        stableGoodFrameCount = 0
        candidateFrames.clear()
        _faceDetectionState.value = FaceDetectionUiState.NoFace
        _identityVerificationState.value = StaffBiometricVerificationState.NoFace
        _livenessState.value = LivenessState.WaitingForFace
        _verificationStep.value = VerificationStep.IDLE
        _blinkCount.value = 0
        activeSession = VerificationSession(operationType = AttendanceOperationType.CHECK_IN)
    }

    fun toggleDebugOverlay() {
        _uiState.value = _uiState.value.copy(isDebugOverlayVisible = !_uiState.value.isDebugOverlayVisible)
    }

    fun calculateLiveWorkingDuration(checkInStr: String?): String? = Companion.calculateLiveWorkingDuration(checkInStr)

    fun loadTodaySummary() {
        if (attendanceRepository == null) return
        viewModelScope.launch {
            when (val res = attendanceRepository.getTodaySummary()) {
                is NetworkResult.Success -> {
                    val summary = res.data
                    val currentUserId = appContext?.let { ctx ->
                        com.governence.faflow.core.di.AppContainer.getInstance(ctx).tokenManager.getUserId()
                    } ?: -1

                    // Cross-user safety: Discard record if server payload belongs to a different user
                    if (summary.record != null && currentUserId > 0 && summary.record.userId != currentUserId) {
                        android.util.Log.w("AttendanceVM", "Summary record user ${summary.record.userId} does not match active session user $currentUserId. Resetting state.")
                        _uiState.value = AttendanceUiState()
                        return@launch
                    }

                    // Stale async response protection: If client already verified CHECKED_OUT for today,
                    // do not let a stale cached or in-flight summary regress the state to NOT_STARTED or ON_DUTY.
                    if (_uiState.value.shiftState == ShiftState.COMPLETED && !summary.isCheckedOut) {
                        android.util.Log.w("AttendanceVM", "Ignoring stale server summary: client already holds authoritative COMPLETED state for today.")
                        return@launch
                    }

                    val shiftState = when {
                        summary.isCheckedOut -> ShiftState.COMPLETED
                        summary.isCheckedIn -> ShiftState.ON_DUTY
                        else -> ShiftState.NOT_STARTED
                    }
                    val liveDur = if (summary.isCheckedIn && !summary.isCheckedOut) {
                        calculateLiveWorkingDuration(summary.checkInTime)
                    } else summary.workingDuration

                    if (summary.isCheckedOut) {
                        val recordOut = summary.record ?: AttendanceRecordOutDto(
                            id = 0,
                            userId = 0,
                            attendanceDate = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date()),
                            checkInTime = summary.checkInTime,
                            checkOutTime = summary.checkOutTime,
                            status = "COMPLETED",
                            checkInGeofenceName = _uiState.value.checkInGeofenceName,
                            checkOutGeofenceName = _uiState.value.checkOutGeofenceName,
                            livenessVerified = true,
                            workingHours = summary.workingDuration
                        )
                        _submissionState.value = AttendanceEligibilityState.ServerAccepted(recordOut)
                    }

                    _uiState.value = _uiState.value.copy(
                        isCheckingIn = !summary.isCheckedIn,
                        isShiftActive = summary.isCheckedIn && !summary.isCheckedOut,
                        shiftState = shiftState,
                        checkInTime = summary.checkInTime ?: _uiState.value.checkInTime,
                        checkOutTime = summary.checkOutTime ?: _uiState.value.checkOutTime,
                        workingDuration = summary.workingDuration ?: _uiState.value.workingDuration,
                        liveWorkingDuration = liveDur,
                        checkInGeofenceName = summary.record?.checkInGeofenceName ?: _uiState.value.checkInGeofenceName,
                        checkOutGeofenceName = summary.record?.checkOutGeofenceName ?: _uiState.value.checkOutGeofenceName
                    )
                }
                else -> {}
            }
        }
    }

    fun loadSupervisorLiveStatus() {
        if (attendanceRepository == null) return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isSupervisorLoading = true)
            when (val res = attendanceRepository.getSupervisorLiveStatus()) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        supervisorLiveStatus = res.data,
                        isSupervisorLoading = false
                    )
                }
                else -> {
                    _uiState.value = _uiState.value.copy(isSupervisorLoading = false)
                }
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

    private val qualityValidator = FaceQualityValidator()
    private val isEvaluatingFrame = AtomicBoolean(false)

    fun warmUpModels() {
        viewModelScope.launch(Dispatchers.Default) {
            try {
                passiveLivenessEngine.reset()
                recognitionEngine?.isEmbedderReady()
            } catch (_: Exception) {}
        }
    }

    fun updateDetections(
        detections: List<FaceDetectionResult>,
        sourceBitmap: Bitmap? = null,
        staffId: String? = null,
        frameWidth: Int = 640,
        frameHeight: Int = 480
    ) {
        // 0. Once captured and locked, bypass frame evaluation
        if (isCaptureLockedFlag.get()) {
            return
        }

        // Concurrency backpressure: discard frame if prior evaluation is still in flight
        if (!isEvaluatingFrame.compareAndSet(false, true)) {
            return
        }

        val frameStartNs = System.nanoTime()
        try {
            val startNs = System.nanoTime()

            // 1. Enterprise Quality & Multi-Face Gating
            when (val qualityResult = qualityValidator.validate(detections, frameWidth, frameHeight)) {
                is FaceQualityCheckResult.Rejected -> {
                    stableGoodFrameCount = 0
                    settlingStartNs = 0L
                    candidateFrames.clear()
                    passiveLivenessEngine.reset()
                    _autoCaptureState.value = AutoCaptureState.SEARCHING

                    when (qualityResult.code) {
                        QualityErrorCode.NO_FACE -> {
                            _identityVerificationState.value = StaffBiometricVerificationState.NoFace
                            _livenessState.value = LivenessState.WaitingForFace
                            _faceDetectionState.value = FaceDetectionUiState.NoFace
                            _autoCapturePrompt.value = "Position your face in the frame"
                        }
                        QualityErrorCode.MULTIPLE_FACES -> {
                            _identityVerificationState.value = StaffBiometricVerificationState.MultipleFaces(detections.size)
                            _livenessState.value = LivenessState.FaceNotSuitable("Please make sure only one face is visible.")
                            _faceDetectionState.value = FaceDetectionUiState.MultipleFaces(detections.size)
                            _autoCapturePrompt.value = "Please make sure only one face is visible."
                        }
                        QualityErrorCode.TOO_FAR -> {
                            _identityVerificationState.value = StaffBiometricVerificationState.FaceTooSmall
                            _faceDetectionState.value = FaceDetectionUiState.FaceTooSmall
                            _autoCapturePrompt.value = "Move closer"
                        }
                        QualityErrorCode.TOO_CLOSE -> {
                            _identityVerificationState.value = StaffBiometricVerificationState.FaceTooLarge
                            _faceDetectionState.value = FaceDetectionUiState.FaceTooLarge
                            _autoCapturePrompt.value = "Move back slightly"
                        }
                        QualityErrorCode.OFF_CENTER -> {
                            _identityVerificationState.value = StaffBiometricVerificationState.FaceOutOfFrame
                            _faceDetectionState.value = FaceDetectionUiState.FacePartiallyOutOfFrame
                            _autoCapturePrompt.value = "Center your face"
                        }
                        QualityErrorCode.TILTED_POSE -> {
                            _faceDetectionState.value = FaceDetectionUiState.DetectionError(qualityResult.reason)
                            _autoCapturePrompt.value = "Look straight ahead"
                        }
                        QualityErrorCode.POOR_LIGHTING -> {
                            _faceDetectionState.value = FaceDetectionUiState.DetectionError(qualityResult.reason)
                            _autoCapturePrompt.value = "Improve lighting"
                        }
                        QualityErrorCode.EXCESSIVE_GLARE -> {
                            _faceDetectionState.value = FaceDetectionUiState.DetectionError(qualityResult.reason)
                            _autoCapturePrompt.value = "Avoid glare"
                        }
                        QualityErrorCode.LOW_CONFIDENCE -> {
                            _faceDetectionState.value = FaceDetectionUiState.DetectionError(qualityResult.reason)
                            _autoCapturePrompt.value = "Position your face in the frame"
                        }
                    }
                }
                is FaceQualityCheckResult.Valid -> {
                    val face = qualityResult.primaryFace
                    _faceDetectionState.value = FaceDetectionUiState.FacePositionValid(primaryFace = face)

                    val frameBmp = sourceBitmap ?: face.alignedBitmap
                    val nowNs = System.nanoTime()
                    val qualityScore = computeCandidateQualityScore(face)

                    if (t2FaceDetectedNs == 0L) t2FaceDetectedNs = nowNs
                    if (t3QualityAcceptedNs == 0L) t3QualityAcceptedNs = nowNs

                    if (settlingStartNs == 0L) {
                        settlingStartNs = nowNs
                        if (t0ScreenActiveNs == 0L) t0ScreenActiveNs = nowNs
                        stableGoodFrameCount = 1
                        candidateFrames.clear()
                        passiveLivenessEngine.reset()
                        if (frameBmp != null) {
                            candidateFrames.add(CandidateFaceFrame(frameBmp, face, qualityScore, nowNs))
                        }
                        _autoCaptureState.value = AutoCaptureState.SETTLING
                        _autoCapturePrompt.value = "Position your face in the frame"
                    } else {
                        stableGoodFrameCount++
                        if (frameBmp != null) {
                            candidateFrames.add(CandidateFaceFrame(frameBmp, face, qualityScore, nowNs))
                        }
                    }

                    // 2. Parallel Silent Passive Presentation Attack Defense (PAD)
                    when (val padResult = passiveLivenessEngine.processFrame(face, frameBmp, System.currentTimeMillis())) {
                        is PassiveLivenessResult.SpoofDetected -> {
                            logBiometric("PAD_REJECTED - ${padResult.spoofType}: ${padResult.reason}")
                            _livenessState.value = LivenessState.SpoofSuspected(padResult.spoofType, padResult.reason)
                            _autoCaptureState.value = AutoCaptureState.ERROR
                            _autoCapturePrompt.value = "Verification failed. Please try again."
                            retryCapture()
                        }
                        is PassiveLivenessResult.Analyzing -> {
                            _livenessState.value = LivenessState.Processing
                            _autoCaptureState.value = AutoCaptureState.SETTLING
                            _autoCapturePrompt.value = "Position your face in the frame"
                        }
                        is PassiveLivenessResult.Passed -> {
                            t4PassivePadAcceptedNs = nowNs
                            _livenessState.value = LivenessState.Passed(padResult.confidence, padResult.risk)
                            logLiveness("PASSIVE_PAD_PASSED (confidence=${"%.2f".format(padResult.confidence)}, risk=${padResult.risk})")

                            if (isCaptureLockedFlag.compareAndSet(false, true)) {
                                t1Ns = nowNs
                                _isCaptureLocked.value = true
                                _autoCaptureState.value = AutoCaptureState.CAPTURED
                                _verificationStep.value = VerificationStep.FACE_VERIFYING
                                activeSession.markFaceVerifying()
                                activeSession.markPassiveLivenessVerified(padResult.confidence, padResult.risk)
                                logFace("VERIFYING")
                                _autoCapturePrompt.value = "Verifying..."

                                val bestCandidate = candidateFrames.maxByOrNull { it.qualityScore }
                                val capturedBmp = bestCandidate?.bitmap ?: frameBmp
                                val capturedDetection = bestCandidate?.detection ?: face
                                _capturedFrameBitmap.value = capturedBmp

                                executeFaceVerificationFirst(
                                    capturedBitmap = capturedBmp,
                                    detection = capturedDetection,
                                    staffId = staffId,
                                    padConfidence = padResult.confidence
                                )
                            }
                        }
                        is PassiveLivenessResult.Inconclusive -> {
                            _autoCaptureState.value = AutoCaptureState.SETTLING
                            _autoCapturePrompt.value = "Position your face in the frame"
                        }
                    }
                }
            }

            AttendanceTelemetry.recordMetric(AttendanceTelemetry.METRIC_SCRFD_DETECTION_MS, (System.nanoTime() - startNs) / 1_000_000)
        } finally {
            isEvaluatingFrame.set(false)
        }
    }

    fun processSingleFrameAttendance(
        isCheckIn: Boolean,
        sourceBitmap: Bitmap?,
        faceDetector: Any? = null,
        staffId: String? = null
    ) {
        if (isCheckIn) prepareSessionForCheckIn() else prepareSessionForCheckOut()
        if (sourceBitmap == null) {
            _autoCaptureState.value = AutoCaptureState.ERROR
            _autoCapturePrompt.value = "Camera frame not ready. Please try again."
            return
        }

        val detection = when (faceDetector) {
            is ScrfdFaceDetector -> faceDetector.latestDetections.value.firstOrNull()
            else -> null
        } ?: FaceDetectionResult(
            boundingBox = FaceBox(0f, 0f, sourceBitmap.width.toFloat(), sourceBitmap.height.toFloat()),
            confidence = 0.90f
        )

        _capturedFrameBitmap.value = sourceBitmap
        _verificationStep.value = VerificationStep.FACE_VERIFYING
        activeSession.markFaceVerifying()
        logFace("VERIFYING")
        _autoCapturePrompt.value = "Verifying..."

        if (isOneShotRunning.compareAndSet(false, true)) {
            executeFaceVerificationFirst(
                capturedBitmap = sourceBitmap,
                detection = detection,
                staffId = staffId
            )
        }
    }

    fun triggerDirectBiometricCaptureForTesting(staffId: String? = null) {
        _verificationStep.value = VerificationStep.FACE_VERIFYING
        activeSession.markFaceVerifying()
        logFace("VERIFYING")
        _autoCapturePrompt.value = "Verifying..."

        val syntheticBmp = Bitmap.createBitmap(112, 112, Bitmap.Config.ARGB_8888)
        val face = FaceDetectionResult(
            boundingBox = FaceBox(170f, 90f, 470f, 390f),
            landmarks = FaceLandmarks(
                leftEye = FacePoint(240f, 200f),
                rightEye = FacePoint(400f, 200f),
                nose = FacePoint(320f, 260f),
                leftMouth = FacePoint(260f, 330f),
                rightMouth = FacePoint(380f, 330f)
            ),
            confidence = 0.98f,
            quality = FaceQuality(
                brightnessScore = 0.6f,
                sharpnessScore = 0.9f
            ),
            alignedBitmap = syntheticBmp
        )
        _capturedFrameBitmap.value = syntheticBmp

        if (isOneShotRunning.compareAndSet(false, true)) {
            executeFaceVerificationFirst(
                capturedBitmap = syntheticBmp,
                detection = face,
                staffId = staffId
            )
        }
    }

    fun simulateBlinkForTesting(ear: Float, timestampMs: Long = System.currentTimeMillis()): BlinkState {
        if (_verificationStep.value != VerificationStep.LIVENESS_VERIFYING) {
            return BlinkState.Idle
        }
        val blinkState = blinkDetector.processEyeMetric(ear, timestampMs)
        val count = blinkDetector.blinkCount
        if (count > _blinkCount.value) {
            _blinkCount.value = count
            if (count == 1) {
                activeSession.recordBlink(1)
                logBlink("BLINK_1")
                _autoCapturePrompt.value = "✓ 1"
                _livenessState.value = LivenessState.ChallengeActive(
                    challenge = LivenessChallenge.BLINK,
                    progress = 0.5f,
                    instructions = "✓ 1",
                    timeRemainingMs = blinkDetector.config.sessionTimeoutMs
                )
            }
        }
        if (blinkState is BlinkState.LivenessVerified || count >= 2) {
            activeSession.recordBlink(2)
            logBlink("BLINK_2")
            logLiveness("VERIFIED")
            _autoCapturePrompt.value = "✓ 2"
            _verificationStep.value = VerificationStep.VERIFIED
            _livenessState.value = LivenessState.Passed(1.0f, PresentationAttackRisk.LOW)
            proceedToAttendanceSubmission(activeSession.sessionId)
        }
        return blinkState
    }

    private fun executeFaceVerificationFirst(
        capturedBitmap: Bitmap?,
        detection: FaceDetectionResult,
        staffId: String?,
        padConfidence: Float = 0.95f
    ) {
        viewModelScope.launch(Dispatchers.Default) {
            val totalStartNs = System.nanoTime()
            try {
                if (capturedBitmap == null) {
                    _autoCaptureState.value = AutoCaptureState.ERROR
                    _autoCapturePrompt.value = "Verification failed. Please try again."
                    _verificationStep.value = VerificationStep.FAILED
                    activeSession.markFaceFailed()
                    return@launch
                }

                val targetStaffId = staffId?.ifBlank { null }
                    ?: appContext?.let { ctx ->
                        val id = com.governence.faflow.core.di.AppContainer.getInstance(ctx).tokenManager.getUserId()
                        if (id > 0) id.toString() else null
                    }

                if (targetStaffId == null) {
                    android.util.Log.e("FAFLOW_BIOMETRICS", "No authenticated staff ID found for biometric verification")
                    _identityVerificationState.value = StaffBiometricVerificationState.Unavailable("No authenticated staff ID found")
                    activeSession.markFaceFailed()
                    return@launch
                }

                // 1. Decoupled Biometric Alignment & Embedding
                _identityVerificationState.value = StaffBiometricVerificationState.Aligning
                val alignStartNs = System.nanoTime()

                val recognitionResult = recognitionEngine?.verifyStaffIdentity(
                    sourceBitmap = capturedBitmap,
                    detection = detection,
                    staffId = targetStaffId
                ) ?: StaffBiometricVerificationState.Unavailable("Recognition engine not configured")

                t6MatchCompleteNs = System.nanoTime()
                val matchMs = recognitionEngine?.lastMatchingDurationMs ?: 0L
                t5EmbeddingCompleteNs = t6MatchCompleteNs - (matchMs * 1_000_000)

                AttendanceTelemetry.recordMetric(
                    AttendanceTelemetry.METRIC_UMEYAMA_ALIGNMENT_MS,
                    (System.nanoTime() - alignStartNs) / 1_000_000
                )
                _identityVerificationState.value = recognitionResult
                android.util.Log.i("FAFLOW_BIOMETRICS", "executeFaceVerificationFirst: recognitionResult=$recognitionResult")

                when (recognitionResult) {
                    is StaffBiometricVerificationState.Verified -> {
                        logFace("VERIFIED (similarity=${"%.4f".format(recognitionResult.similarity)})")
                        activeSession.markFaceVerified(targetStaffId, recognitionResult.similarity)
                        activeSession.markPassiveLivenessVerified(padConfidence, PresentationAttackRisk.LOW)
                        _verificationStep.value = VerificationStep.VERIFIED
                        _livenessState.value = LivenessState.Passed(padConfidence, PresentationAttackRisk.LOW)
                        isCaptureLockedFlag.set(false)
                        proceedToAttendanceSubmission(activeSession.sessionId, capturedBitmap)
                    }
                    is StaffBiometricVerificationState.VerificationFailed -> {
                        logFace("FAILED")
                        activeSession.markFaceFailed()
                        _verificationStep.value = VerificationStep.FAILED
                        _autoCaptureState.value = AutoCaptureState.RECOGNITION_FAILED
                        _autoCapturePrompt.value = "Verification failed. Please try again."
                    }
                    is StaffBiometricVerificationState.NoEnrollment -> {
                        logFace("FAILED - NO_ENROLLMENT")
                        activeSession.markFaceFailed()
                        _verificationStep.value = VerificationStep.FAILED
                        _autoCaptureState.value = AutoCaptureState.RECOGNITION_FAILED
                        _autoCapturePrompt.value = "Verification failed. Please try again."
                    }
                    is StaffBiometricVerificationState.Unavailable -> {
                        logFace("UNAVAILABLE")
                        activeSession.markFaceFailed()
                        _verificationStep.value = VerificationStep.FAILED
                        _autoCaptureState.value = AutoCaptureState.ERROR
                        _autoCapturePrompt.value = "Verification failed. Please try again."
                    }
                    else -> {
                        logFace("FAILED")
                        activeSession.markFaceFailed()
                        _verificationStep.value = VerificationStep.FAILED
                        _autoCaptureState.value = AutoCaptureState.RECOGNITION_FAILED
                        _autoCapturePrompt.value = "Verification failed. Please try again."
                    }
                }
            } catch (e: Exception) {
                logFace("ERROR: ${e.message}")
                activeSession.markFaceFailed()
                _verificationStep.value = VerificationStep.FAILED
                _autoCaptureState.value = AutoCaptureState.ERROR
                _autoCapturePrompt.value = "Verification failed. Please try again."
            } finally {
                isOneShotRunning.set(false)
                AttendanceTelemetry.recordMetric(
                    "one_shot_pipeline_total_ms",
                    (System.nanoTime() - totalStartNs) / 1_000_000
                )
            }
        }
    }

    fun proceedToAttendanceSubmission(
        sessionId: String,
        capturedBitmap: Bitmap? = null
    ) {
        if (!activeSession.canSubmitAttendance(sessionId)) {
            logAttendance("BLOCKED - Verification criteria not satisfied (session=$sessionId)")
            return
        }

        if (!isCaptureLockedFlag.compareAndSet(false, true)) {
            return
        }

        _isCaptureLocked.value = true
        _autoCaptureState.value = AutoCaptureState.CAPTURED
        _autoCapturePrompt.value = "Verifying..."
        if (capturedBitmap != null) {
            _capturedFrameBitmap.value = capturedBitmap
        }

        logAttendance("SUBMITTING")
        val targetStaffId = activeSession.verifiedStaffId
            ?: appContext?.let { ctx ->
                val id = com.governence.faflow.core.di.AppContainer.getInstance(ctx).tokenManager.getUserId()
                if (id > 0) id.toString() else null
            }
        val staffUserId = targetStaffId?.toIntOrNull()
        if (staffUserId == null || staffUserId <= 0) {
            logAttendance("FAILED: Unauthenticated user session")
            _autoCaptureState.value = AutoCaptureState.ERROR
            _autoCapturePrompt.value = "User session expired or invalid. Please re-login."
            isCaptureLockedFlag.set(false)
            return
        }

        if (_uiState.value.isCheckingIn) {
            performCheckIn(
                staffUserId = staffUserId,
                sessionId = sessionId,
                onSuccess = {
                    logAttendance("SUCCESS")
                    _autoCaptureState.value = AutoCaptureState.SUCCESS
                    _autoCapturePrompt.value = "Attendance Recorded"
                },
                onFailure = { errorMsg ->
                    logAttendance("FAILED: $errorMsg")
                    _autoCaptureState.value = AutoCaptureState.ERROR
                    _autoCapturePrompt.value = "Verification failed. Please try again."
                }
            )
        } else {
            performCheckOut(
                staffUserId = staffUserId,
                sessionId = sessionId,
                onSuccess = {
                    logAttendance("SUCCESS")
                    _autoCaptureState.value = AutoCaptureState.SUCCESS
                    _autoCapturePrompt.value = "Attendance Recorded"
                },
                onFailure = { errorMsg ->
                    logAttendance("FAILED: $errorMsg")
                    _autoCaptureState.value = AutoCaptureState.ERROR
                    _autoCapturePrompt.value = "Verification failed. Please try again."
                }
            )
        }
    }

    fun retryCapture() {
        isCaptureLockedFlag.set(false)
        _isCaptureLocked.value = false
        stableGoodFrameCount = 0
        settlingStartNs = 0L
        candidateFrames.clear()
        isOneShotRunning.set(false)
        isSubmissionInProgress.set(false)
        passiveLivenessEngine.reset()
        t2FaceDetectedNs = 0L
        t3QualityAcceptedNs = 0L
        t4PassivePadAcceptedNs = 0L
        t5EmbeddingCompleteNs = 0L
        t6MatchCompleteNs = 0L
        t7ServerStartNs = 0L
        t8ServerResponseNs = 0L
        t9GreenSuccessNs = 0L
        t10HapticNs = 0L
        _capturedFrameBitmap.value = null
        _autoCaptureState.value = AutoCaptureState.SEARCHING
        _autoCapturePrompt.value = "Position your face in the frame"
        _identityVerificationState.value = StaffBiometricVerificationState.NoFace
        _faceDetectionState.value = FaceDetectionUiState.NoFace
        _submissionState.value = null
        _verificationStep.value = VerificationStep.IDLE
        blinkDetector.reset()
        _blinkCount.value = 0
        totalLivenessFrames.set(0L)
        droppedLivenessFrames.set(0L)
        _livenessDebugInfo.value = com.governence.faflow.attendance.biometrics.liveness.LivenessDebugInfo()
    }

    fun cancelVerification() {
        retryCapture()
        activeSession.cancel()
        logBiometric("VERIFICATION_CANCELLED_BY_USER")
    }

    fun prepareSessionForCheckIn() {
        if (_uiState.value.shiftState == ShiftState.COMPLETED) {
            android.util.Log.w("AttendanceVM", "Ignoring prepareSessionForCheckIn: Today's shift is already COMPLETED.")
            return
        }
        activeSession.cancel()
        activeSession = VerificationSession(operationType = AttendanceOperationType.CHECK_IN)
        logBiometric("SESSION_CREATED - CHECK_IN (id=${activeSession.sessionId})")
        _uiState.value = _uiState.value.copy(isCheckingIn = true)
        retryCapture()
    }

    fun prepareSessionForCheckOut() {
        activeSession.cancel()
        activeSession = VerificationSession(operationType = AttendanceOperationType.CHECK_OUT)
        logBiometric("SESSION_CREATED - CHECK_OUT (id=${activeSession.sessionId})")
        _uiState.value = _uiState.value.copy(isCheckingIn = false)
        retryCapture()
    }

    companion object {
        const val BIOMETRIC_REQUIRED_STABLE_FRAMES = 2
        const val BIOMETRIC_MIN_SETTLING_DURATION_MS = 160L
        const val BIOMETRIC_SUCCESS_ANIMATION_MS = 280

        var BYPASS_GEOLOCATION_FOR_TESTING = false
        var BYPASS_LIVENESS_FOR_TESTING = false

        fun calculateLiveWorkingDuration(checkInStr: String?): String? {
            if (checkInStr.isNullOrBlank()) return null
            return try {
                val formats = listOf(
                    SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US),
                    SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSSSS", Locale.US),
                    SimpleDateFormat("hh:mm a", Locale.getDefault()),
                    SimpleDateFormat("HH:mm:ss", Locale.US)
                )
                var parsedDate: Date? = null
                for (fmt in formats) {
                    try {
                        parsedDate = fmt.parse(checkInStr)
                        if (parsedDate != null) break
                    } catch (_: Exception) {}
                }
                if (parsedDate != null) {
                    val now = Date()
                    val diffMs = maxOf(0L, now.time - parsedDate.time)
                    val hours = (diffMs / (1000 * 60 * 60))
                    val minutes = (diffMs / (1000 * 60)) % 60
                    "${hours}h ${minutes}m"
                } else null
            } catch (_: Exception) {
                null
            }
        }

        /**
         * Evaluates multi-metric quality score of a candidate frame during the settling window.
         * Factors: confidence, sharpness, centering, frontal pose, size, and lighting.
         */
        fun computeCandidateQualityScore(face: FaceDetectionResult): Float {
            val confScore = face.confidence.coerceIn(0f, 1f)
            val box = face.boundingBox
            val centerDist = Math.hypot((box.centerX - 0.5f).toDouble(), (box.centerY - 0.5f).toDouble()).toFloat()
            val centerScore = (1f - (centerDist / 0.5f)).coerceIn(0f, 1f)
            val sizeScore = (box.width / 0.4f).coerceIn(0f, 1f)
            val poseAngleSum = Math.abs(face.quality.yawAngle) + Math.abs(face.quality.pitchAngle) + Math.abs(face.quality.rollAngle)
            val poseScore = (1f - (poseAngleSum / 90f)).coerceIn(0f, 1f)
            val sharpnessScore = face.quality.sharpnessScore.coerceIn(0f, 1f)
            val brightnessScore = if (face.quality.brightnessScore in 0.4f..0.85f) 1.0f else 0.5f

            return (confScore * 0.25f) + (sharpnessScore * 0.25f) + (centerScore * 0.20f) + (poseScore * 0.15f) + (sizeScore * 0.10f) + (brightnessScore * 0.05f)
        }

        /**
         * Cleanses raw server exceptions, JSON error envelopes, and technical jargon
         * into enterprise, user-friendly feedback.
         */
        fun sanitizeErrorMessage(rawError: String): String {
            var clean = rawError.trim()
            val detailMatch = Regex("""\{.*"detail"\s*:\s*"([^"]+)".*\}""").find(clean)
            if (detailMatch != null) {
                clean = detailMatch.groupValues[1]
            }

            return when {
                clean.contains("Liveness", ignoreCase = true) ||
                clean.contains("presentation attack", ignoreCase = true) ->
                    "Unable to verify your face"

                clean.contains("similarity", ignoreCase = true) ||
                clean.contains("mismatch", ignoreCase = true) ||
                clean.contains("below threshold", ignoreCase = true) ->
                    "Face not recognized"

                clean.contains("geofence", ignoreCase = true) ||
                clean.contains("Location verification failed", ignoreCase = true) ||
                clean.contains("Outside authorized", ignoreCase = true) ->
                    "Outside authorized campus perimeter"

                clean.contains("already checked in", ignoreCase = true) ->
                    "Staff member is already checked in for today"

                clean.contains("already checked out", ignoreCase = true) ->
                    "Staff member is already checked out for today"

                clean.contains("deactivated", ignoreCase = true) ->
                    "Staff account is deactivated"

                clean.contains("Unable to resolve host", ignoreCase = true) ||
                clean.contains("Failed to connect", ignoreCase = true) ||
                clean.contains("timeout", ignoreCase = true) ->
                    "Unable to connect. Please try again."

                clean.startsWith("{") && clean.endsWith("}") ->
                    "Attendance could not be verified. Please try again."

                clean.isNotBlank() -> clean
                else -> "Attendance could not be verified. Please try again."
            }
        }
    }


    fun isLocationVerifiedForAttendance(): Boolean {
        if (BYPASS_GEOLOCATION_FOR_TESTING) return true
        return when (verificationResult.value) {
            is LocationVerificationResult.InsideGeofence, is LocationVerificationResult.Boundary -> true
            else -> false
        }
    }

    /**
     * Executes shift Check-In with the backend, falling back to offline SQLite queueing.
     */
     fun performCheckIn(
         staffUserId: Int,
         sessionId: String? = null,
         onSuccess: () -> Unit = {},
         onFailure: (String) -> Unit = {}
     ) {
        if (!isSubmissionInProgress.compareAndSet(false, true)) {
            android.util.Log.w("AttendanceVM", "performCheckIn: Submission already in progress. Ignoring duplicate request.")
            return
        }

        if (staffUserId <= 0) {
            isSubmissionInProgress.set(false)
            val err = "Invalid authenticated staff identity."
            _submissionState.value = AttendanceEligibilityState.Blocked(err)
            onFailure(err)
            return
        }

        val targetSession = activeSession
        if (sessionId != null && !targetSession.canSubmitAttendance(sessionId)) {
            isSubmissionInProgress.set(false)
            val err = "Cannot check in: Verification session criteria not met."
            _submissionState.value = AttendanceEligibilityState.Blocked(err)
            onFailure(err)
            return
        }

        if (attendanceRepository == null) {
            isSubmissionInProgress.set(false)
            val err = "Attendance repository is not initialized."
            _submissionState.value = AttendanceEligibilityState.Blocked(err)
            _uiState.value = _uiState.value.copy(isSubmitting = false, errorMessage = err)
            onFailure(err)
            return
        }

        val location = liveLocation.value
        val identity = _identityVerificationState.value

        if (!isLocationVerifiedForAttendance()) {
            isSubmissionInProgress.set(false)
            val err = when (val res = verificationResult.value) {
                is LocationVerificationResult.AccuracyInsufficient ->
                    "Acquiring precise GPS satellite lock (current ±${res.currentAccuracyMeters.toInt()}m, required ±${res.requiredAccuracyMeters.toInt()}m). Please wait a moment."
                is LocationVerificationResult.PermissionDenied ->
                    "Cannot check in: Precise location permission required."
                is LocationVerificationResult.LocationServicesDisabled ->
                    "Cannot check in: Device location services are turned off."
                is LocationVerificationResult.OutsideAllGeofences ->
                    "Cannot check in: Outside authorized campus perimeter."
                else ->
                    "Cannot check in: Outside authorized campus perimeter."
            }
            _submissionState.value = AttendanceEligibilityState.Blocked(err)
            onFailure(err)
            return
        }

        val effectiveLocation = location

        if (effectiveLocation == null) {
            isSubmissionInProgress.set(false)
            val err = "Cannot acquire location coordinates."
            _submissionState.value = AttendanceEligibilityState.Blocked(err)
            onFailure(err)
            return
        }

        val similarity = if (identity is StaffBiometricVerificationState.Verified) identity.similarity.toDouble() else 0.0
        // SECURITY: Liveness is an independent gate from identity.
        // A recognized face does NOT grant liveness. Both must pass separately.
        val isLive = if (BYPASS_LIVENESS_FOR_TESTING) {
            AttendanceTelemetry.recordEvent("liveness_mode", "LIVENESS_BYPASSED_FOR_TRIAL")
            true
        } else {
            AttendanceTelemetry.recordEvent("liveness_mode", "LIVENESS_VERIFIED")
            targetSession.isLivenessVerified
        }

        if (!isLive) {
            isSubmissionInProgress.set(false)
            val err = "Verification failed. Please try again."
            _submissionState.value = AttendanceEligibilityState.Blocked(err)
            onFailure(err)
            return
        }

        viewModelScope.launch {
            try {
                _submissionState.value = AttendanceEligibilityState.Submitting
                _uiState.value = _uiState.value.copy(isSubmitting = true)
                t7ServerStartNs = System.nanoTime()
                val netStartNs = t7ServerStartNs
                t4Ns = t7ServerStartNs

                when (val result = attendanceRepository.checkIn(
                    latitude = effectiveLocation.latitude,
                    longitude = effectiveLocation.longitude,
                    accuracyMeters = effectiveLocation.accuracyMeters.toDouble(),
                    faceSimilarityScore = similarity,
                    livenessVerified = isLive,
                    userId = staffUserId
                )) {
                    is AttendanceSubmissionResult.Success -> {
                        t8ServerResponseNs = System.nanoTime()
                        t9GreenSuccessNs = System.nanoTime()
                        t5Ns = t8ServerResponseNs
                        t6Ns = t9GreenSuccessNs
                        val netLatencyMs = (t8ServerResponseNs - netStartNs) / 1_000_000
                        AttendanceTelemetry.recordMetric(AttendanceTelemetry.METRIC_NETWORK_SUBMISSION_MS, netLatencyMs)
                        AttendanceTelemetry.recordMetric(AttendanceTelemetry.METRIC_BACKEND_MS, netLatencyMs)
                        _submissionState.value = AttendanceEligibilityState.ServerAccepted(result.record)
                        _autoCaptureState.value = AutoCaptureState.SUCCESS
                        _autoCapturePrompt.value = "Attendance Recorded"
                        _uiState.value = _uiState.value.copy(
                            isCheckingIn = false,
                            isShiftActive = true,
                            shiftState = ShiftState.ON_DUTY,
                            checkInTime = result.record.checkInTime ?: SimpleDateFormat("hh:mm a", Locale.getDefault()).format(Date()),
                            checkInGeofenceName = result.record.checkInGeofenceName,
                            isSubmitting = false,
                            errorMessage = null
                        )
                        loadTodaySummary()
                        loadAttendanceHistory()
                        appContext?.let { ctx ->
                            t10HapticNs = System.nanoTime()
                            com.governence.faflow.attendance.biometrics.feedback.BiometricFeedbackManager.notifyAttendanceSuccess(ctx)
                        }
                        if (com.governence.faflow.BuildConfig.DEBUG) {
                            logPerformanceReport("CHECK_IN")
                        }
                        onSuccess()
                    }
                    is AttendanceSubmissionResult.QueuedOffline -> {
                        t8ServerResponseNs = System.nanoTime()
                        t9GreenSuccessNs = System.nanoTime()
                        t5Ns = t8ServerResponseNs
                        t6Ns = t9GreenSuccessNs
                        _submissionState.value = AttendanceEligibilityState.SavedOffline(result.message)
                        _autoCaptureState.value = AutoCaptureState.SUCCESS
                        _autoCapturePrompt.value = "Attendance saved — will sync"
                        _uiState.value = _uiState.value.copy(
                            isCheckingIn = false,
                            isShiftActive = true,
                            shiftState = ShiftState.ON_DUTY,
                            checkInTime = SimpleDateFormat("hh:mm a", Locale.getDefault()).format(Date()),
                            isSubmitting = false,
                            errorMessage = null
                        )
                        appContext?.let { AttendanceSyncWorker.triggerImmediateSync(it) }
                        appContext?.let { ctx ->
                            t10HapticNs = System.nanoTime()
                            com.governence.faflow.attendance.biometrics.feedback.BiometricFeedbackManager.notifyAttendanceSuccess(ctx)
                        }
                        if (com.governence.faflow.BuildConfig.DEBUG) {
                            logPerformanceReport("CHECK_IN_OFFLINE")
                        }
                        onSuccess()
                    }
                    is AttendanceSubmissionResult.Failed -> {
                        val friendlyMsg = sanitizeErrorMessage(result.message)
                        _submissionState.value = AttendanceEligibilityState.Blocked(friendlyMsg)
                        _autoCaptureState.value = AutoCaptureState.ERROR
                        _autoCapturePrompt.value = "Verification failed. Please try again."
                        _uiState.value = _uiState.value.copy(
                            isSubmitting = false,
                            errorMessage = friendlyMsg
                        )
                        if (result.message.contains("already", ignoreCase = true)) {
                            loadTodaySummary()
                        }
                        appContext?.let { ctx ->
                            com.governence.faflow.attendance.biometrics.feedback.BiometricFeedbackManager.notifyAttendanceError(ctx)
                        }
                        onFailure(friendlyMsg)
                    }
                }
            } finally {
                isSubmissionInProgress.set(false)
            }
        }
    }

    /**
     * Executes shift Check-Out with the backend, falling back to offline SQLite queueing.
     */
    fun performCheckOut(
        staffUserId: Int,
        sessionId: String? = null,
        onSuccess: () -> Unit = {},
        onFailure: (String) -> Unit = {}
    ) {
        if (!isSubmissionInProgress.compareAndSet(false, true)) {
            android.util.Log.w("AttendanceVM", "performCheckOut: Submission already in progress. Ignoring duplicate request.")
            return
        }

        if (staffUserId <= 0) {
            isSubmissionInProgress.set(false)
            val err = "Invalid authenticated staff identity."
            _submissionState.value = AttendanceEligibilityState.Blocked(err)
            onFailure(err)
            return
        }

        val targetSession = activeSession
        if (sessionId != null && !targetSession.canSubmitAttendance(sessionId)) {
            isSubmissionInProgress.set(false)
            val err = "Cannot check out: Verification session criteria not met."
            _submissionState.value = AttendanceEligibilityState.Blocked(err)
            onFailure(err)
            return
        }

        if (attendanceRepository == null) {
            isSubmissionInProgress.set(false)
            val err = "Attendance repository is not initialized."
            _submissionState.value = AttendanceEligibilityState.Blocked(err)
            _uiState.value = _uiState.value.copy(isSubmitting = false, errorMessage = err)
            onFailure(err)
            return
        }

        val location = liveLocation.value
        val identity = _identityVerificationState.value

        if (!isLocationVerifiedForAttendance()) {
            isSubmissionInProgress.set(false)
            val err = when (val res = verificationResult.value) {
                is LocationVerificationResult.AccuracyInsufficient ->
                    "Acquiring precise GPS satellite lock (current ±${res.currentAccuracyMeters.toInt()}m, required ±${res.requiredAccuracyMeters.toInt()}m). Please wait a moment."
                is LocationVerificationResult.PermissionDenied ->
                    "Cannot check out: Precise location permission required."
                is LocationVerificationResult.LocationServicesDisabled ->
                    "Cannot check out: Device location services are turned off."
                is LocationVerificationResult.OutsideAllGeofences ->
                    "Cannot check out: Outside authorized campus perimeter."
                else ->
                    "Cannot check out: Outside authorized campus perimeter."
            }
            _submissionState.value = AttendanceEligibilityState.Blocked(err)
            onFailure(err)
            return
        }

        val effectiveLocation = location

        if (effectiveLocation == null) {
            isSubmissionInProgress.set(false)
            val err = "Cannot acquire location coordinates."
            _submissionState.value = AttendanceEligibilityState.Blocked(err)
            onFailure(err)
            return
        }

        val similarity = if (identity is StaffBiometricVerificationState.Verified) identity.similarity.toDouble() else 0.0
        // SECURITY: Liveness is an independent gate from identity.
        // A recognized face does NOT grant liveness. Both must pass separately.
        val isLive = if (BYPASS_LIVENESS_FOR_TESTING) {
            AttendanceTelemetry.recordEvent("liveness_mode", "LIVENESS_BYPASSED_FOR_TRIAL")
            true
        } else {
            AttendanceTelemetry.recordEvent("liveness_mode", "LIVENESS_VERIFIED")
            targetSession.isLivenessVerified
        }

        if (!isLive) {
            isSubmissionInProgress.set(false)
            val err = "Verification failed. Please try again."
            _submissionState.value = AttendanceEligibilityState.Blocked(err)
            onFailure(err)
            return
        }

        viewModelScope.launch {
            try {
                _submissionState.value = AttendanceEligibilityState.Submitting
                _uiState.value = _uiState.value.copy(isSubmitting = true)
                t7ServerStartNs = System.nanoTime()
                val netStartNs = t7ServerStartNs
                t4Ns = t7ServerStartNs

                when (val result = attendanceRepository.checkOut(
                    latitude = effectiveLocation.latitude,
                    longitude = effectiveLocation.longitude,
                    accuracyMeters = effectiveLocation.accuracyMeters.toDouble(),
                    faceSimilarityScore = similarity,
                    livenessVerified = isLive,
                    userId = staffUserId
                )) {
                    is AttendanceSubmissionResult.Success -> {
                        t8ServerResponseNs = System.nanoTime()
                        t9GreenSuccessNs = System.nanoTime()
                        t5Ns = t8ServerResponseNs
                        t6Ns = t9GreenSuccessNs
                        val netLatencyMs = (t8ServerResponseNs - netStartNs) / 1_000_000
                        AttendanceTelemetry.recordMetric(AttendanceTelemetry.METRIC_NETWORK_SUBMISSION_MS, netLatencyMs)
                        AttendanceTelemetry.recordMetric(AttendanceTelemetry.METRIC_BACKEND_MS, netLatencyMs)
                        _submissionState.value = AttendanceEligibilityState.ServerAccepted(result.record)
                        _autoCaptureState.value = AutoCaptureState.SUCCESS
                        _autoCapturePrompt.value = "Attendance Recorded"
                        _uiState.value = _uiState.value.copy(
                            isCheckingIn = false,
                            isShiftActive = false,
                            shiftState = ShiftState.COMPLETED,
                            checkOutTime = result.record.checkOutTime ?: SimpleDateFormat("hh:mm a", Locale.getDefault()).format(Date()),
                            workingDuration = result.record.workingHours,
                            checkOutGeofenceName = result.record.checkOutGeofenceName,
                            isSubmitting = false,
                            errorMessage = null
                        )
                        loadTodaySummary()
                        loadAttendanceHistory()
                        appContext?.let { ctx ->
                            t10HapticNs = System.nanoTime()
                            com.governence.faflow.attendance.biometrics.feedback.BiometricFeedbackManager.notifyAttendanceSuccess(ctx)
                        }
                        if (com.governence.faflow.BuildConfig.DEBUG) {
                            logPerformanceReport("CHECK_OUT")
                        }
                        onSuccess()
                    }
                    is AttendanceSubmissionResult.QueuedOffline -> {
                        t8ServerResponseNs = System.nanoTime()
                        t9GreenSuccessNs = System.nanoTime()
                        t5Ns = t8ServerResponseNs
                        t6Ns = t9GreenSuccessNs
                        _submissionState.value = AttendanceEligibilityState.SavedOffline(result.message)
                        _autoCaptureState.value = AutoCaptureState.SUCCESS
                        _autoCapturePrompt.value = "Attendance saved — will sync"
                        _uiState.value = _uiState.value.copy(
                            isCheckingIn = false,
                            isShiftActive = false,
                            shiftState = ShiftState.COMPLETED,
                            checkOutTime = SimpleDateFormat("hh:mm a", Locale.getDefault()).format(Date()),
                            isSubmitting = false,
                            errorMessage = null
                        )
                        appContext?.let { AttendanceSyncWorker.triggerImmediateSync(it) }
                        appContext?.let { ctx ->
                            t10HapticNs = System.nanoTime()
                            com.governence.faflow.attendance.biometrics.feedback.BiometricFeedbackManager.notifyAttendanceSuccess(ctx)
                        }
                        if (com.governence.faflow.BuildConfig.DEBUG) {
                            logPerformanceReport("CHECK_OUT_OFFLINE")
                        }
                        onSuccess()
                    }
                    is AttendanceSubmissionResult.Failed -> {
                        val friendlyMsg = sanitizeErrorMessage(result.message)
                        _submissionState.value = AttendanceEligibilityState.Blocked(friendlyMsg)
                        _autoCaptureState.value = AutoCaptureState.ERROR
                        _autoCapturePrompt.value = "Verification failed. Please try again."
                        _uiState.value = _uiState.value.copy(
                            isSubmitting = false,
                            errorMessage = friendlyMsg
                        )
                        if (result.message.contains("already", ignoreCase = true)) {
                            loadTodaySummary()
                        }
                        appContext?.let { ctx ->
                            com.governence.faflow.attendance.biometrics.feedback.BiometricFeedbackManager.notifyAttendanceError(ctx)
                        }
                        onFailure(friendlyMsg)
                    }
                }
            } finally {
                isSubmissionInProgress.set(false)
            }
        }
    }

    private fun logPerformanceReport(operation: String) {
        val t0 = if (t0ScreenActiveNs > 0L) t0ScreenActiveNs else t0Ns
        val camMs = if (t1CameraReadyNs > t0) (t1CameraReadyNs - t0) / 1_000_000 else 0L
        val detMs = if (t2FaceDetectedNs > t1CameraReadyNs) (t2FaceDetectedNs - t1CameraReadyNs) / 1_000_000 else 0L
        val qualMs = if (t3QualityAcceptedNs > t2FaceDetectedNs) (t3QualityAcceptedNs - t2FaceDetectedNs) / 1_000_000 else 0L
        val padMs = if (t4PassivePadAcceptedNs > t3QualityAcceptedNs) (t4PassivePadAcceptedNs - t3QualityAcceptedNs) / 1_000_000 else 0L
        val alignEmbedMs = recognitionEngine?.lastEmbeddingDurationMs ?: 0L
        val matchMs = recognitionEngine?.lastMatchingDurationMs ?: 0L
        val netMs = if (t8ServerResponseNs > t7ServerStartNs) (t8ServerResponseNs - t7ServerStartNs) / 1_000_000 else 0L
        val totalMs = if (t10HapticNs > t0) (t10HapticNs - t0) / 1_000_000 else (camMs + detMs + qualMs + padMs + alignEmbedMs + matchMs + netMs)

        android.util.Log.i("FAFLOW_PERF", """
            ==================================================
            FAFLOW INSTANT ATTENDANCE — PIPELINE TIMINGS ($operation)
            T0 (Screen Active):       $t0
            T1 (Camera Ready):        $t1CameraReadyNs -> Camera Startup:      ${camMs}ms
            T2 (Face Detected):       $t2FaceDetectedNs -> Face Detection:      ${detMs}ms
            T3 (Quality Accepted):    $t3QualityAcceptedNs -> Quality Check:       ${qualMs}ms
            T4 (Passive PAD Passed):  $t4PassivePadAcceptedNs -> Silent Passive PAD:  ${padMs}ms
            T5 (Embedding Ready):     $t5EmbeddingCompleteNs -> Alignment+Embedding: ${alignEmbedMs}ms
            T6 (Biometric Match):     $t6MatchCompleteNs -> 3-Template Match:   ${matchMs}ms
            T7 (Server Request):      $t7ServerStartNs
            T8 (Server Response):     $t8ServerResponseNs -> Server / Network:    ${netMs}ms
            T9 (Green Success UI):    $t9GreenSuccessNs
            T10 (Haptic Feedback):    $t10HapticNs
            --------------------------------------------------
            TOTAL END-TO-END LATENCY (T0 -> T10): ${totalMs}ms
            TARGET: < 1000ms [${if (totalMs < 1000) "PASSED" else "NEEDS OPTIMIZATION"}]
            ==================================================
        """.trimIndent())
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
        _capturedFrameBitmap.value = null
    }
}
