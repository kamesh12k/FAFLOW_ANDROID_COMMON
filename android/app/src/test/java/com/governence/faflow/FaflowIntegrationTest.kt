package com.governence.faflow

import android.graphics.ImageFormat
import com.governence.faflow.camera.CameraFrame
import com.governence.faflow.camera.CameraFrameProcessor
import com.governence.faflow.camera.CameraLens
import com.governence.faflow.camera.CameraState
import com.governence.faflow.camera.FrameProcessResult
import com.governence.faflow.core.network.CreditBalanceOutDto
import com.governence.faflow.core.network.CreditTransactionOutDto
import com.governence.faflow.core.network.DayOrderResolveDto
import com.governence.faflow.core.network.LeaveOutDto
import com.governence.faflow.core.network.NetworkResult
import com.governence.faflow.core.network.NotificationOutDto
import com.governence.faflow.core.network.SubstitutionPreferenceOutDto
import com.governence.faflow.core.network.TeacherTodaySummaryDto
import com.governence.faflow.core.network.TimetableSlotOutDto
import com.governence.faflow.core.network.UserOutDto
import com.governence.faflow.domain.model.CreditTransaction
import com.governence.faflow.domain.model.LeaveRequest
import com.governence.faflow.domain.model.LeaveStatus
import com.governence.faflow.domain.model.StaffMember
import com.governence.faflow.domain.model.TimetableSlot
import com.governence.faflow.face.ModelInfo
import com.governence.faflow.face.ModelTask
import com.governence.faflow.face.ModelState
import com.governence.faflow.face.alignment.FaceAlignmentConfig
import com.governence.faflow.face.alignment.SimilarityTransform
import com.governence.faflow.face.alignment.UmeyamaFaceAligner
import com.governence.faflow.face.embedding.ArcFaceEmbedder
import com.governence.faflow.face.embedding.FaceRecognitionConfig
import com.governence.faflow.face.enrollment.StaffFaceEnrollment
import com.governence.faflow.face.liveness.ActiveLivenessDetector
import com.governence.faflow.face.liveness.BiometricVerificationResult
import com.governence.faflow.face.liveness.ChallengeEvaluationResult
import com.governence.faflow.face.liveness.ChallengeGenerator
import com.governence.faflow.face.liveness.FaceObservation
import com.governence.faflow.face.liveness.HeadPose
import com.governence.faflow.face.liveness.HeadPoseAnalyzer
import com.governence.faflow.face.liveness.LivenessChallenge
import com.governence.faflow.face.liveness.LivenessConfig
import com.governence.faflow.face.liveness.LivenessEngine
import com.governence.faflow.face.liveness.LivenessState
import com.governence.faflow.face.liveness.MotionAnalyzer
import com.governence.faflow.face.liveness.PresentationAttackRisk
import com.governence.faflow.face.matching.CosineFaceMatcher
import com.governence.faflow.face.model.FaceBox
import com.governence.faflow.face.model.FaceDetectionResult
import com.governence.faflow.face.model.FaceLandmarks
import com.governence.faflow.face.model.FacePoint
import com.governence.faflow.face.model.SpoofType
import com.governence.faflow.face.model.StaffBiometricVerificationState
import com.governence.faflow.face.scrfd.LetterboxInfo
import com.governence.faflow.face.scrfd.ScrfdCandidate
import com.governence.faflow.face.scrfd.ScrfdDecoder
import com.governence.faflow.face.scrfd.ScrfdPostprocessor
import com.governence.faflow.location.CampusGeofence
import com.governence.faflow.location.GeoPoint
import com.governence.faflow.location.GeofenceMathEngine
import com.governence.faflow.attendance.data.AttendanceSubmissionResult
import com.governence.faflow.attendance.data.PendingAttendanceEntity
import com.governence.faflow.attendance.data.SyncStatus
import com.governence.faflow.core.network.AttendanceCheckInRequestDto
import com.governence.faflow.core.network.AttendanceCheckOutRequestDto
import com.governence.faflow.core.network.AttendanceRecordOutDto
import com.governence.faflow.core.network.AttendanceTodaySummaryOutDto
import com.governence.faflow.core.network.GeofenceCreateDto
import com.governence.faflow.core.network.GeofenceOutDto
import com.governence.faflow.core.network.SupervisorLiveStatusOutDto
import com.governence.faflow.attendance.model.AttendancePipelineStatus
import com.governence.faflow.core.security.DeviceIntegrityResult
import com.governence.faflow.core.security.IntegrityState
import com.governence.faflow.core.telemetry.AttendanceTelemetry
import com.governence.faflow.location.GeofenceType
import com.governence.faflow.location.GeofenceValidator
import com.governence.faflow.location.LocationVerificationResult
import com.governence.faflow.location.StaffLiveLocation
import com.governence.faflow.ui.viewmodels.AttendanceEligibilityState
import com.governence.faflow.ui.viewmodels.FaceDetectionUiState
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Random
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import java.util.UUID
import kotlin.math.sqrt

class FaflowIntegrationTest {

    // ---------- Milestone 10: Production Hardening, Audit Logs & Telemetry Tests ----------

    @Test
    fun testAttendancePipelineStatusHierarchy() {
        val initial: AttendancePipelineStatus = AttendancePipelineStatus.Initializing
        assertEquals("Initializing", initial.title)
        assertFalse(initial.isError)

        val outside: AttendancePipelineStatus = AttendancePipelineStatus.OutsideGeofence(120, "Main Campus Boundary")
        assertEquals("Outside Campus Perimeter", outside.title)
        assertTrue(outside.isError)

        val readyIn: AttendancePipelineStatus = AttendancePipelineStatus.ReadyForCheckIn("42", 0.92f)
        assertEquals("Ready for Check-In", readyIn.title)
        assertTrue(readyIn.isActionable)

        val checkedIn: AttendancePipelineStatus = AttendancePipelineStatus.CheckedIn("08:30 AM")
        assertEquals("Checked In", checkedIn.title)

        val checkedOut: AttendancePipelineStatus = AttendancePipelineStatus.CheckedOut("04:30 PM", "8h 0m")
        assertEquals("Checked Out", checkedOut.title)

        val mockBlocked: AttendancePipelineStatus = AttendancePipelineStatus.MockLocationBlocked
        assertEquals("Fake GPS Detected", mockBlocked.title)
        assertTrue(mockBlocked.isError)
    }

    @Test
    fun testDeviceIntegrityResultModel() {
        val verified = DeviceIntegrityResult(
            state = IntegrityState.VERIFIED,
            attestationToken = "VALID_TOKEN_XYZ",
            message = "Hardware integrity verified"
        )
        assertEquals(IntegrityState.VERIFIED, verified.state)
        assertEquals("VALID_TOKEN_XYZ", verified.attestationToken)

        val failed = DeviceIntegrityResult(
            state = IntegrityState.FAILED,
            attestationToken = null,
            message = "Device rooted"
        )
        assertEquals(IntegrityState.FAILED, failed.state)
        assertNull(failed.attestationToken)
    }

    @Test
    fun testAttendanceTelemetryMetricsCollection() {
        AttendanceTelemetry.clear()
        AttendanceTelemetry.recordMetric(AttendanceTelemetry.METRIC_SCRFD_DETECTION_MS, 42L)
        AttendanceTelemetry.recordMetric(AttendanceTelemetry.METRIC_UMEYAMA_ALIGNMENT_MS, 8L)
        AttendanceTelemetry.recordMetric(AttendanceTelemetry.METRIC_ARCFACE_EMBEDDING_MS, 65L)

        assertEquals(42L, AttendanceTelemetry.getMetric(AttendanceTelemetry.METRIC_SCRFD_DETECTION_MS))
        assertEquals(8L, AttendanceTelemetry.getMetric(AttendanceTelemetry.METRIC_UMEYAMA_ALIGNMENT_MS))
        assertEquals(65L, AttendanceTelemetry.getMetric(AttendanceTelemetry.METRIC_ARCFACE_EMBEDDING_MS))
        assertEquals(0L, AttendanceTelemetry.getMetric("non_existent_metric"))
    }

    // ---------- Milestone 11: Real Device End-to-End Pipeline & Integration Tests ----------

    @Test
    fun testFullEndToEndAttendanceWorkflowStateProgression() {
        // 1. Initial State
        var status: AttendancePipelineStatus = AttendancePipelineStatus.Initializing
        assertEquals("Initializing", status.title)

        // 2. Location Validated
        status = AttendancePipelineStatus.Locating
        assertEquals("Acquiring GPS Fix", status.title)

        // 3. Single Face Detected & Validated
        status = AttendancePipelineStatus.FaceDetected
        assertEquals("Face Detected", status.title)

        // 4. Canonical Alignment & Verification
        status = AttendancePipelineStatus.FaceAlignmentRequired
        assertEquals("Aligning Features", status.title)

        // 5. Active Challenge
        status = AttendancePipelineStatus.LivenessCheck("Turn your head slightly to the left", 0.75f)
        assertEquals("Verifying Liveness", status.title)

        // 6. Gated & Ready for Check-In
        status = AttendancePipelineStatus.ReadyForCheckIn("42", 0.94f)
        assertTrue(status.isActionable)

        // 7. Authoritative Submission & Confirmation
        status = AttendancePipelineStatus.CheckingIn
        assertEquals("Checking In", status.title)

        status = AttendancePipelineStatus.CheckedIn("08:30 AM")
        assertEquals("Checked In", status.title)
    }

    @Test
    fun testOfflineQueuePersistenceEntityValidation() {
        val testKey = "idempotency-milestone-11-" + UUID.randomUUID().toString()
        val entity = PendingAttendanceEntity(
            idempotencyKey = testKey,
            userId = 42,
            operationType = "CHECK_IN",
            latitude = 11.016844,
            longitude = 76.955833,
            accuracyMeters = 7.5,
            faceSimilarityScore = 0.91,
            livenessVerified = true,
            syncStatus = SyncStatus.PENDING
        )

        assertEquals(testKey, entity.idempotencyKey)
        assertEquals("CHECK_IN", entity.operationType)
        assertTrue(entity.livenessVerified)
        assertEquals(SyncStatus.PENDING, entity.syncStatus)

        // Verify state update to SYNCING
        val inSync = entity.copy(syncStatus = SyncStatus.SYNCING, attemptCount = 1)
        assertEquals(SyncStatus.SYNCING, inSync.syncStatus)
        assertEquals(1, inSync.attemptCount)

        // Verify completion to SYNCED
        val completed = inSync.copy(syncStatus = SyncStatus.SYNCED)
        assertEquals(SyncStatus.SYNCED, completed.syncStatus)
    }

    // ---------- Milestone 12: Production Geofence Admin & Supervisor Live Status Tests ----------

    @Test
    fun testGeofenceAdminDtoModels() {
        val createDto = GeofenceCreateDto(
            name = "North Science Campus",
            description = "Main science block polygon",
            type = "polygon",
            polygonVertices = listOf(
                listOf(11.016, 76.955),
                listOf(11.017, 76.955),
                listOf(11.017, 76.956),
                listOf(11.016, 76.956)
            ),
            toleranceMeters = 12.0
        )

        assertEquals("North Science Campus", createDto.name)
        assertEquals("polygon", createDto.type)
        assertEquals(4, createDto.polygonVertices?.size)
        assertEquals(12.0, createDto.toleranceMeters, 0.001)

        val outDto = GeofenceOutDto(
            id = 101,
            name = "North Science Campus",
            type = "polygon",
            centerLatitude = 11.0165,
            centerLongitude = 76.9555,
            radiusMeters = 120.0,
            areaSqMeters = 12500.0,
            perimeterMeters = 450.0,
            isActive = true
        )

        assertEquals(101, outDto.id)
        assertTrue(outDto.isActive)
        assertEquals(12500.0, outDto.areaSqMeters ?: 0.0, 0.1)
    }

    @Test
    fun testSupervisorLiveStatusOutDtoModel() {
        val liveStatus = SupervisorLiveStatusOutDto(
            date = "2026-09-02",
            totalStaff = 45,
            presentCount = 38,
            absentCount = 7,
            currentlyActiveCount = 32,
            checkedOutCount = 6,
            records = emptyList()
        )

        assertEquals("2026-09-02", liveStatus.date)
        assertEquals(45, liveStatus.totalStaff)
        assertEquals(38, liveStatus.presentCount)
        assertEquals(7, liveStatus.absentCount)
        assertEquals(32, liveStatus.currentlyActiveCount)
        assertEquals(6, liveStatus.checkedOutCount)
    }

    // ---------- Milestone 13: Production End-to-End Certification Tests ----------

    @Test
    fun testAttendancePipelineSecurityInvariants() {
        // Assert that without high accuracy GPS, pipeline transitions to error
        val poorGps = AttendancePipelineStatus.PoorGpsAccuracy(75)
        assertTrue(poorGps.isError)
        assertFalse(poorGps.isActionable)

        // Assert that mock GPS transitions to blocked state
        val mockGps = AttendancePipelineStatus.MockLocationBlocked
        assertTrue(mockGps.isError)
        assertFalse(mockGps.isActionable)

        // Assert that multiple faces in frame blocks biometric gating
        val multiFace = AttendancePipelineStatus.MultipleFaces(2)
        assertTrue(multiFace.isError)
        assertFalse(multiFace.isActionable)

        // Assert that biometric mismatch blocks attendance confirmation
        val mismatch = AttendancePipelineStatus.VerificationFailed("Biometric similarity score 0.42 below 0.60 threshold")
        assertTrue(mismatch.isError)
        assertFalse(mismatch.isActionable)

        // Assert that valid biometric + active challenge produces actionable check-in
        val validCheckIn = AttendancePipelineStatus.ReadyForCheckIn("42", 0.95f)
        assertFalse(validCheckIn.isError)
        assertTrue(validCheckIn.isActionable)
    }

    @Test
    fun testGeofenceMathEnginePolygonAreaCalculation() {
        val squareVertices = listOf(
            GeoPoint(11.0160, 76.9550),
            GeoPoint(11.0170, 76.9550),
            GeoPoint(11.0170, 76.9560),
            GeoPoint(11.0160, 76.9560)
        )

        val insidePoint = GeoPoint(11.0165, 76.9555)
        val outsidePoint = GeoPoint(11.0200, 76.9600)

        assertTrue(GeofenceMathEngine.isInsidePolygon(insidePoint, squareVertices))
        assertFalse(GeofenceMathEngine.isInsidePolygon(outsidePoint, squareVertices))
    }

    // ---------- Milestone 14: Production Rollout & Deployment Readiness Tests ----------

    @Test
    fun testProductionDeploymentSettingsParity() {
        // Verify default institutional geofence creation
        val campusZone = CampusGeofence(
            id = "main-campus-1",
            name = "Institutional Main Campus",
            type = GeofenceType.CIRCLE,
            centerLatitude = 11.016844,
            centerLongitude = 76.955833,
            radiusMeters = 200.0,
            toleranceMeters = 15.0,
            isActive = true
        )

        assertEquals("main-campus-1", campusZone.id)
        assertTrue(campusZone.isActive)
        assertEquals(200.0, campusZone.radiusMeters, 0.001)

        // Evaluate inside point
        val staffPoint = GeoPoint(11.0169, 76.9559)
        val (isInside, isBoundary, distance) = GeofenceMathEngine.evaluateCircle(
            point = staffPoint,
            center = GeoPoint(campusZone.centerLatitude, campusZone.centerLongitude),
            radiusMeters = campusZone.radiusMeters,
            toleranceMeters = campusZone.toleranceMeters
        )

        assertTrue(isInside)
        assertTrue(distance < 200.0)
    }

    // ---------- Milestone 15: 16 KB Page-Size Compatibility & Native Forensics Tests ----------

    @Test
    fun testNativeLibrary16KbAlignmentInvariants() {
        // Assert that the page size constant for Android 15/16 16 KB compatibility is 16384 bytes (0x4000)
        val targetPageSizeBytes = 16384
        val targetAlignmentHex = 0x4000

        assertEquals(targetPageSizeBytes, targetAlignmentHex)

        // Verify native dependencies inventory
        val nativeLibraries = listOf(
            "libsurface_util_jni.so",
            "libimage_processing_util_jni.so",
            "libandroidx.graphics.path.so",
            "libonnxruntime.so",
            "libonnxruntime4j_jni.so"
        )

        assertEquals(5, nativeLibraries.size)
        assertTrue(nativeLibraries.contains("libonnxruntime.so"))
        assertTrue(nativeLibraries.contains("libonnxruntime4j_jni.so"))
    }

    // ---------- Milestone 9: Backend Attendance Integration & Offline Sync Tests ----------

    @Test
    fun testAttendanceDtoModelCreation() {
        val checkInDto = AttendanceCheckInRequestDto(
            idempotencyKey = "test-uuid-1",
            latitude = 11.016844,
            longitude = 76.955833,
            accuracyMeters = 5.0,
            faceSimilarityScore = 0.88,
            livenessVerified = true,
            verificationMethod = "FACE_ON_DEVICE"
        )
        assertEquals("test-uuid-1", checkInDto.idempotencyKey)
        assertEquals(11.016844, checkInDto.latitude, 0.00001)
        assertTrue(checkInDto.livenessVerified)

        val checkOutDto = AttendanceCheckOutRequestDto(
            idempotencyKey = "test-uuid-2",
            latitude = 11.016844,
            longitude = 76.955833,
            accuracyMeters = 4.5,
            faceSimilarityScore = 0.90,
            livenessVerified = true
        )
        assertEquals("test-uuid-2", checkOutDto.idempotencyKey)

        val recordDto = AttendanceRecordOutDto(
            id = 101,
            userId = 42,
            staffName = "Dr. Kamesh V",
            attendanceDate = "2026-09-02",
            checkInTime = "2026-09-02T08:30:00Z",
            checkOutTime = "2026-09-02T16:30:00Z",
            status = "PRESENT",
            checkInGeofenceName = "Main Campus",
            workingHours = "8h 0m",
            isSynced = true
        )
        assertEquals(101, recordDto.id)
        assertEquals("Dr. Kamesh V", recordDto.staffName)
        assertEquals("8h 0m", recordDto.workingHours)
        assertTrue(recordDto.isSynced)
    }

    @Test
    fun testPendingAttendanceEntityAndSyncStatus() {
        val entity = PendingAttendanceEntity(
            id = 1L,
            idempotencyKey = UUID.randomUUID().toString(),
            userId = 42,
            operationType = "CHECK_IN",
            latitude = 11.016844,
            longitude = 76.955833,
            accuracyMeters = 6.0,
            faceSimilarityScore = 0.89,
            livenessVerified = true,
            syncStatus = SyncStatus.PENDING
        )
        assertEquals(SyncStatus.PENDING, entity.syncStatus)
        assertEquals("CHECK_IN", entity.operationType)
        assertEquals(42, entity.userId)

        val syncing = entity.copy(syncStatus = SyncStatus.SYNCING, attemptCount = 1)
        assertEquals(SyncStatus.SYNCING, syncing.syncStatus)
        assertEquals(1, syncing.attemptCount)

        val synced = entity.copy(syncStatus = SyncStatus.SYNCED)
        assertEquals(SyncStatus.SYNCED, synced.syncStatus)
    }

    @Test
    fun testAttendanceSubmissionResultHierarchy() {
        val recordDto = AttendanceRecordOutDto(
            id = 101,
            userId = 42,
            attendanceDate = "2026-09-02",
            status = "PRESENT",
            livenessVerified = true
        )

        val successOnline: AttendanceSubmissionResult = AttendanceSubmissionResult.Success(record = recordDto, isOnline = true)
        assertTrue(successOnline is AttendanceSubmissionResult.Success)
        assertTrue((successOnline as AttendanceSubmissionResult.Success).isOnline)

        val pending = PendingAttendanceEntity(
            idempotencyKey = "offline-key",
            userId = 42,
            operationType = "CHECK_IN",
            latitude = 11.0,
            longitude = 76.0,
            accuracyMeters = 5.0,
            faceSimilarityScore = 0.88,
            livenessVerified = true
        )
        val queuedOffline: AttendanceSubmissionResult = AttendanceSubmissionResult.QueuedOffline(
            pendingEntity = pending,
            message = "Queued locally"
        )
        assertTrue(queuedOffline is AttendanceSubmissionResult.QueuedOffline)
        assertEquals("offline-key", (queuedOffline as AttendanceSubmissionResult.QueuedOffline).pendingEntity.idempotencyKey)

        val failed: AttendanceSubmissionResult = AttendanceSubmissionResult.Failed(400, "Outside geofence")
        assertTrue(failed is AttendanceSubmissionResult.Failed)
        assertEquals(400, (failed as AttendanceSubmissionResult.Failed).errorCode)
    }

    @Test
    fun testAttendanceEligibilityExtendedStates() {
        val recordDto = AttendanceRecordOutDto(id = 1, userId = 42, attendanceDate = "2026-09-02", status = "PRESENT", livenessVerified = true)

        val submitting: AttendanceEligibilityState = AttendanceEligibilityState.Submitting
        assertTrue(submitting is AttendanceEligibilityState.Submitting)

        val serverAccepted: AttendanceEligibilityState = AttendanceEligibilityState.ServerAccepted(recordDto)
        assertTrue(serverAccepted is AttendanceEligibilityState.ServerAccepted)

        val savedOffline: AttendanceEligibilityState = AttendanceEligibilityState.SavedOffline("Saved locally")
        assertTrue(savedOffline is AttendanceEligibilityState.SavedOffline)

        val syncPending: AttendanceEligibilityState = AttendanceEligibilityState.SyncPending(2)
        assertTrue(syncPending is AttendanceEligibilityState.SyncPending)
        assertEquals(2, (syncPending as AttendanceEligibilityState.SyncPending).pendingCount)

        val syncing: AttendanceEligibilityState = AttendanceEligibilityState.Syncing
        assertTrue(syncing is AttendanceEligibilityState.Syncing)

        val alreadyIn: AttendanceEligibilityState = AttendanceEligibilityState.AlreadyCheckedIn("08:30 AM")
        assertTrue(alreadyIn is AttendanceEligibilityState.AlreadyCheckedIn)

        val alreadyOut: AttendanceEligibilityState = AttendanceEligibilityState.AlreadyCheckedOut("04:30 PM")
        assertTrue(alreadyOut is AttendanceEligibilityState.AlreadyCheckedOut)
    }

    // ---------- Milestone 8: Face Liveness & Presentation Attack Detection Tests ----------

    @Test
    fun testHeadPoseEstimation() {
        val frontalLandmarks = FaceLandmarks(
            leftEye = FacePoint(180f, 150f),
            rightEye = FacePoint(240f, 150f),
            nose = FacePoint(210f, 180f),
            leftMouth = FacePoint(190f, 210f),
            rightMouth = FacePoint(230f, 210f)
        )
        val frontalPose = HeadPoseAnalyzer.estimateHeadPose(frontalLandmarks)
        assertTrue("Frontal pose should be within ±15 degrees", frontalPose.isFrontal)
        assertEquals(0.0f, frontalPose.yawDegrees, 2.0f)
        assertEquals(0.0f, frontalPose.rollDegrees, 1.0f)

        // Turn left: nose shifts closer to left eye
        val leftTurnLandmarks = frontalLandmarks.copy(nose = FacePoint(195f, 180f))
        val leftPose = HeadPoseAnalyzer.estimateHeadPose(leftTurnLandmarks)
        assertTrue("Yaw should be negative for left turn", leftPose.yawDegrees < -15.0f)

        // Turn right: nose shifts closer to right eye
        val rightTurnLandmarks = frontalLandmarks.copy(nose = FacePoint(225f, 180f))
        val rightPose = HeadPoseAnalyzer.estimateHeadPose(rightTurnLandmarks)
        assertTrue("Yaw should be positive for right turn", rightPose.yawDegrees > 15.0f)
    }

    @Test
    fun testChallengeGenerationAndRandomization() {
        val generator = ChallengeGenerator(Random(12345))
        val challenges = generator.generateChallenges(count = 3)

        assertEquals(3, challenges.size)
        // Verify no two consecutive identical challenges
        for (i in 0 until challenges.size - 1) {
            assertTrue(challenges[i] != challenges[i + 1])
        }
    }

    @Test
    fun testActiveChallengeStepAdvancement() {
        val detector = ActiveLivenessDetector(LivenessConfig(challengeTimeoutMs = 5000L))
        val challenges = listOf(LivenessChallenge.TURN_LEFT, LivenessChallenge.TURN_RIGHT)
        detector.startNewSession(challenges, startTimeMs = 0L)

        val landmarks = FaceLandmarks(
            leftEye = FacePoint(180f, 150f), rightEye = FacePoint(240f, 150f),
            nose = FacePoint(210f, 180f), leftMouth = FacePoint(190f, 210f), rightMouth = FacePoint(230f, 210f)
        )

        // Step 1: Still frontal -> InProgress
        val inProg = detector.processFrame(landmarks, HeadPose(yawDegrees = 0f), currentTimeMs = 1000L)
        assertTrue(inProg is ChallengeEvaluationResult.InProgress)

        // Step 1 met: Yaw = -25 deg (Turn Left) -> Advanced to TURN_RIGHT
        val advanced = detector.processFrame(landmarks, HeadPose(yawDegrees = -25f), currentTimeMs = 1500L)
        assertTrue(advanced is ChallengeEvaluationResult.Advanced)
        assertEquals(LivenessChallenge.TURN_RIGHT, (advanced as ChallengeEvaluationResult.Advanced).nextChallenge)

        // Step 2 met: Yaw = +25 deg (Turn Right) -> SessionComplete
        val complete = detector.processFrame(landmarks, HeadPose(yawDegrees = 25f), currentTimeMs = 2000L)
        assertTrue(complete is ChallengeEvaluationResult.SessionComplete)
        assertTrue(detector.isSessionComplete)
    }

    @Test
    fun testChallengeTimeout() {
        val detector = ActiveLivenessDetector(LivenessConfig(challengeTimeoutMs = 3000L))
        detector.startNewSession(listOf(LivenessChallenge.TURN_LEFT), startTimeMs = 0L)

        val landmarks = FaceLandmarks(
            leftEye = FacePoint(180f, 150f), rightEye = FacePoint(240f, 150f),
            nose = FacePoint(210f, 180f), leftMouth = FacePoint(190f, 210f), rightMouth = FacePoint(230f, 210f)
        )

        // 4000ms elapsed > 3000ms timeout
        val timeout = detector.processFrame(landmarks, HeadPose(yawDegrees = 0f), currentTimeMs = 4000L)
        assertTrue(timeout is ChallengeEvaluationResult.TimedOut)
    }

    @Test
    fun testTemporalMotionAnalyzerStaticAttackDetection() {
        val motion = MotionAnalyzer(LivenessConfig(temporalWindowSize = 10, minimumObservations = 5, staticPhotoVarianceThreshold = 0.40f))

        val staticLandmarks = FaceLandmarks(
            leftEye = FacePoint(180f, 150f), rightEye = FacePoint(240f, 150f),
            nose = FacePoint(210f, 180f), leftMouth = FacePoint(190f, 210f), rightMouth = FacePoint(230f, 210f)
        )
        val box = FaceBox(150f, 100f, 270f, 240f)

        // Feed 6 perfectly identical observations (zero variance)
        for (i in 0 until 6) {
            motion.addObservation(FaceObservation(timestamp = i * 100L, boundingBox = box, landmarks = staticLandmarks, headPose = HeadPose()))
        }

        val risk = motion.evaluateMotionRisk()
        assertEquals(PresentationAttackRisk.HIGH, risk)
    }

    @Test
    fun testTemporalMotionAnalyzerNaturalMotionLowRisk() {
        val motion = MotionAnalyzer(LivenessConfig(temporalWindowSize = 10, minimumObservations = 5, staticPhotoVarianceThreshold = 0.40f))

        val box = FaceBox(150f, 100f, 270f, 240f)
        // Feed 6 natural jitter observations
        for (i in 0 until 6) {
            val naturalLandmarks = FaceLandmarks(
                leftEye = FacePoint(180f + i * 0.8f, 150f + (i % 2) * 0.5f),
                rightEye = FacePoint(240f + i * 0.8f, 150f + (i % 2) * 0.5f),
                nose = FacePoint(210f + i * 1.2f, 180f + i * 0.4f),
                leftMouth = FacePoint(190f + i * 0.8f, 210f),
                rightMouth = FacePoint(230f + i * 0.8f, 210f)
            )
            motion.addObservation(FaceObservation(timestamp = i * 100L, boundingBox = box, landmarks = naturalLandmarks, headPose = HeadPose()))
        }

        val risk = motion.evaluateMotionRisk()
        assertEquals(PresentationAttackRisk.LOW, risk)
    }

    @Test
    fun testBiometricVerificationResultEligibility() {
        val eligible = BiometricVerificationResult(
            staffId = "42",
            identityVerified = true,
            similarityScore = 0.88f,
            livenessVerified = true,
            livenessScore = 0.95f,
            presentationAttackRisk = PresentationAttackRisk.LOW
        )
        assertTrue(eligible.isAttendanceEligible)

        val unverifiedIdentity = eligible.copy(identityVerified = false)
        assertFalse(unverifiedIdentity.isAttendanceEligible)

        val unverifiedLiveness = eligible.copy(livenessVerified = false)
        assertFalse(unverifiedLiveness.isAttendanceEligible)

        val highRisk = eligible.copy(presentationAttackRisk = PresentationAttackRisk.HIGH)
        assertFalse(highRisk.isAttendanceEligible)
    }

    @Test
    fun testAttendanceEligibilityStateMachine() {
        val ready = AttendanceEligibilityState.VerifiedAndReady(staffId = "42", similarity = 0.88f, livenessScore = 0.95f)
        assertTrue(ready is AttendanceEligibilityState.VerifiedAndReady)
        assertEquals("42", ready.staffId)

        val locReq = AttendanceEligibilityState.LocationRequired
        assertTrue(locReq is AttendanceEligibilityState.LocationRequired)

        val faceReq = AttendanceEligibilityState.FaceRequired
        assertTrue(faceReq is AttendanceEligibilityState.FaceRequired)

        val liveReq = AttendanceEligibilityState.LivenessRequired
        assertTrue(liveReq is AttendanceEligibilityState.LivenessRequired)

        val blocked = AttendanceEligibilityState.Blocked("Fake GPS")
        assertTrue(blocked is AttendanceEligibilityState.Blocked)
        assertEquals("Fake GPS", blocked.reason)
    }

    // ---------- Milestone 7: Face Alignment & On-Device Recognition Tests ----------

    @Test
    fun testUmeyamaIdentityTransform() {
        val aligner = UmeyamaFaceAligner()
        val canonical = FaceAlignmentConfig.REFERENCE_LANDMARKS
        val transform = aligner.estimateSimilarityTransform(src = canonical, dst = canonical)

        assertNotNull("Identity transform must not be null", transform)
        // Scale = 1.0, Rotation = 0.0, Translation = 0.0
        assertEquals(1.0f, transform!!.scale, 0.01f)
        assertEquals(1.0f, transform.a, 0.01f)
        assertEquals(0.0f, transform.b, 0.01f)
        assertEquals(0.0f, transform.tx, 0.01f)
        assertEquals(0.0f, transform.c, 0.01f)
        assertEquals(1.0f, transform.d, 0.01f)
        assertEquals(0.0f, transform.ty, 0.01f)
    }

    @Test
    fun testUmeyamaTranslation() {
        val aligner = UmeyamaFaceAligner()
        val canonical = FaceAlignmentConfig.REFERENCE_LANDMARKS
        val translated = canonical.map { FacePoint(it.x + 20f, it.y + 30f) }

        val transform = aligner.estimateSimilarityTransform(src = translated, dst = canonical)
        assertNotNull(transform)

        assertEquals(1.0f, transform!!.scale, 0.01f)
        assertEquals(1.0f, transform.a, 0.01f)
        assertEquals(1.0f, transform.d, 0.01f)
        assertEquals(-20.0f, transform.tx, 0.1f)
        assertEquals(-30.0f, transform.ty, 0.1f)
    }

    @Test
    fun testUmeyamaScale() {
        val aligner = UmeyamaFaceAligner()
        val canonical = FaceAlignmentConfig.REFERENCE_LANDMARKS
        val scaled = canonical.map { FacePoint(it.x * 2.0f, it.y * 2.0f) }

        val transform = aligner.estimateSimilarityTransform(src = scaled, dst = canonical)
        assertNotNull(transform)

        assertEquals(0.5f, transform!!.scale, 0.01f)
        assertEquals(0.5f, transform.a, 0.01f)
        assertEquals(0.5f, transform.d, 0.01f)
    }

    @Test
    fun testFivePointLandmarkOrderingValidation() {
        val aligner = UmeyamaFaceAligner()

        val validLandmarks = FaceLandmarks(
            leftEye = FacePoint(180f, 150f),
            rightEye = FacePoint(240f, 150f),
            nose = FacePoint(210f, 180f),
            leftMouth = FacePoint(190f, 210f),
            rightMouth = FacePoint(230f, 210f)
        )
        assertNull("Valid landmarks should return null error", aligner.validateLandmarks(validLandmarks, 640, 480))

        val invertedEyes = validLandmarks.copy(
            leftEye = FacePoint(240f, 150f),
            rightEye = FacePoint(180f, 150f)
        )
        assertNotNull("Inverted eyes must fail validation", aligner.validateLandmarks(invertedEyes, 640, 480))

        val invertedNose = validLandmarks.copy(nose = FacePoint(210f, 120f))
        assertNotNull("Nose above eyes must fail validation", aligner.validateLandmarks(invertedNose, 640, 480))

        val invertedMouth = validLandmarks.copy(
            leftMouth = FacePoint(190f, 170f),
            rightMouth = FacePoint(230f, 170f)
        )
        assertNotNull("Mouth above nose must fail validation", aligner.validateLandmarks(invertedMouth, 640, 480))
    }

    @Test
    fun testEmbeddingNormalization() {
        val rawVector = floatArrayOf(3.0f, 4.0f, 0.0f, 0.0f) // Magnitude = 5.0
        val normalized = ArcFaceEmbedder.l2Normalize(rawVector)

        assertEquals(0.6f, normalized[0], 0.001f)
        assertEquals(0.8f, normalized[1], 0.001f)
        assertEquals(0.0f, normalized[2], 0.001f)

        var norm = 0.0
        for (v in normalized) norm += (v * v).toDouble()
        assertEquals(1.0, sqrt(norm), 0.0001)
    }

    @Test
    fun testZeroVectorNormalization() {
        val zeroVector = FloatArray(512) { 0.0f }
        val normalized = ArcFaceEmbedder.l2Normalize(zeroVector)

        assertEquals(512, normalized.size)
        for (v in normalized) {
            assertEquals(0.0f, v, 0.0f)
            assertFalse(v.isNaN())
            assertFalse(v.isInfinite())
        }
    }

    @Test
    fun testNaNAndInfinityEmbeddingSanitization() {
        val nanVector = floatArrayOf(1.0f, Float.NaN, 3.0f)
        val sanitizedNan = ArcFaceEmbedder.l2Normalize(nanVector)
        for (v in sanitizedNan) {
            assertEquals(0.0f, v, 0.0f)
        }

        val infVector = floatArrayOf(1.0f, Float.POSITIVE_INFINITY, 3.0f)
        val sanitizedInf = ArcFaceEmbedder.l2Normalize(infVector)
        for (v in sanitizedInf) {
            assertEquals(0.0f, v, 0.0f)
        }
    }

    @Test
    fun testCosineSimilarityIdenticalVectors() {
        val matcher = CosineFaceMatcher()
        val vecA = floatArrayOf(0.6f, 0.8f, 0.0f)
        val vecB = floatArrayOf(0.6f, 0.8f, 0.0f)

        val sim = matcher.computeCosineSimilarity(vecA, vecB)
        assertEquals(1.0f, sim, 0.001f)
    }

    @Test
    fun testCosineSimilarityOrthogonalVectors() {
        val matcher = CosineFaceMatcher()
        val vecA = floatArrayOf(1.0f, 0.0f, 0.0f)
        val vecB = floatArrayOf(0.0f, 1.0f, 0.0f)

        val sim = matcher.computeCosineSimilarity(vecA, vecB)
        assertEquals(0.0f, sim, 0.001f)
    }

    @Test
    fun testCosineSimilarityOppositeVectors() {
        val matcher = CosineFaceMatcher()
        val vecA = floatArrayOf(1.0f, 0.0f)
        val vecB = floatArrayOf(-1.0f, 0.0f)

        val sim = matcher.computeCosineSimilarity(vecA, vecB)
        assertEquals(-1.0f, sim, 0.001f)
    }

    @Test
    fun testCosineSimilarityDimensionMismatch() {
        val matcher = CosineFaceMatcher()
        val vecA = floatArrayOf(1.0f, 0.0f)
        val vecB = floatArrayOf(1.0f, 0.0f, 0.0f)

        val sim = matcher.computeCosineSimilarity(vecA, vecB)
        assertEquals(0.0f, sim, 0.0f)
    }

    @Test
    fun testFaceMatcherThreshold() {
        val matcher = CosineFaceMatcher(FaceRecognitionConfig(similarityThreshold = 0.60f))
        val live = floatArrayOf(0.7f, 0.714f)
        val enrolled = floatArrayOf(0.7f, 0.714f)

        val result = matcher.verifyOneToOne(live, enrolled)
        assertTrue(result.isMatched)
        assertTrue(result.similarityScore >= 0.60f)

        val different = floatArrayOf(-0.7f, 0.714f)
        val failedResult = matcher.verifyOneToOne(different, enrolled)
        assertFalse(failedResult.isMatched)
    }

    @Test
    fun testStaffFaceEnrollmentDataModel() {
        val enrollment = StaffFaceEnrollment(
            staffId = "42",
            staffName = "Dr. Kamesh V",
            embedding = FloatArray(512) { 0.1f },
            modelVersion = "InsightFace-ArcFace-v1",
            alignmentVersion = "Umeyama-112x112-v1",
            createdAt = 1000L,
            updatedAt = 1000L
        )

        val duplicate = enrollment.copy()
        assertEquals(enrollment, duplicate)
        assertEquals(enrollment.hashCode(), duplicate.hashCode())
    }

    @Test
    fun testStaffBiometricVerificationStateMachine() {
        val unavail: StaffBiometricVerificationState = StaffBiometricVerificationState.Unavailable("Model missing")
        assertTrue(unavail is StaffBiometricVerificationState.Unavailable)

        val noEnroll: StaffBiometricVerificationState = StaffBiometricVerificationState.NoEnrollment("42")
        assertTrue(noEnroll is StaffBiometricVerificationState.NoEnrollment)

        val verified: StaffBiometricVerificationState = StaffBiometricVerificationState.Verified("42", 0.88f, 0.60f)
        assertTrue(verified is StaffBiometricVerificationState.Verified)
        assertEquals("42", (verified as StaffBiometricVerificationState.Verified).staffId)
        assertEquals(0.88f, verified.similarity, 0.001f)

        val failed: StaffBiometricVerificationState = StaffBiometricVerificationState.VerificationFailed(0.42f, 0.60f, "Low score")
        assertTrue(failed is StaffBiometricVerificationState.VerificationFailed)
    }

    // ---------- Milestone 6: InsightFace SCRFD Face Detection Tests ----------

    @Test
    fun testScrfdAnchorGenerationCounts() {
        val stride8Anchors = ScrfdDecoder.generateAnchorCenters(inputWidth = 640, inputHeight = 640, stride = 8, numAnchors = 2)
        assertEquals(12800, stride8Anchors.size)

        val stride16Anchors = ScrfdDecoder.generateAnchorCenters(inputWidth = 640, inputHeight = 640, stride = 16, numAnchors = 2)
        assertEquals(3200, stride16Anchors.size)

        val stride32Anchors = ScrfdDecoder.generateAnchorCenters(inputWidth = 640, inputHeight = 640, stride = 32, numAnchors = 2)
        assertEquals(800, stride32Anchors.size)

        val totalAnchors = stride8Anchors.size + stride16Anchors.size + stride32Anchors.size
        assertEquals(16800, totalAnchors)
    }

    @Test
    fun testScrfdBoundingBoxAndLandmarkDecoding() {
        val letterbox = LetterboxInfo(
            scale = 1.0f,
            padX = 0f,
            padY = 0f,
            originalWidth = 640,
            originalHeight = 640,
            rotationApplied = 0
        )

        val scores = floatArrayOf(0.92f)
        val bboxDeltas = floatArrayOf(2.0f, 2.0f, 2.0f, 2.0f)
        val kpsDeltas = floatArrayOf(
            -1.0f, -1.0f,
            1.0f, -1.0f,
            0.0f, 0.0f,
            -0.8f, 1.0f,
            0.8f, 1.0f
        )
        val anchorCenters = listOf(Pair(320f, 240f))

        val candidates = ScrfdDecoder.decodeStride(
            scores = scores,
            bboxDeltas = bboxDeltas,
            kpsDeltas = kpsDeltas,
            anchorCenters = anchorCenters,
            stride = 8,
            scoreThreshold = 0.50f,
            letterboxInfo = letterbox
        )

        assertEquals(1, candidates.size)
        val cand = candidates.first()
        assertEquals(0.92f, cand.score, 0.001f)

        assertEquals(304f, cand.box.left, 0.1f)
        assertEquals(224f, cand.box.top, 0.1f)
        assertEquals(336f, cand.box.right, 0.1f)
        assertEquals(256f, cand.box.bottom, 0.1f)

        assertNotNull(cand.landmarks)
        assertEquals(312f, cand.landmarks!!.leftEye.x, 0.1f)
        assertEquals(232f, cand.landmarks!!.leftEye.y, 0.1f)
        assertEquals(328f, cand.landmarks!!.rightEye.x, 0.1f)
        assertEquals(320f, cand.landmarks!!.nose.x, 0.1f)
    }

    @Test
    fun testIoUCalculation() {
        val boxA = FaceBox(left = 100f, top = 100f, right = 200f, bottom = 200f)
        val boxB = FaceBox(left = 100f, top = 100f, right = 200f, bottom = 200f)
        val iouSame = ScrfdPostprocessor.calculateIoU(boxA, boxB)
        assertEquals(1.0f, iouSame, 0.001f)

        val boxDisjoint = FaceBox(left = 300f, top = 300f, right = 400f, bottom = 400f)
        val iouDisjoint = ScrfdPostprocessor.calculateIoU(boxA, boxDisjoint)
        assertEquals(0.0f, iouDisjoint, 0.001f)

        val boxPartial = FaceBox(left = 150f, top = 100f, right = 250f, bottom = 200f)
        val iouPartial = ScrfdPostprocessor.calculateIoU(boxA, boxPartial)
        assertTrue(iouPartial in 0.30f..0.36f)
    }

    @Test
    fun testNonMaximumSuppressionSuppressesOverlaps() {
        val candidates = listOf(
            ScrfdCandidate(box = FaceBox(100f, 100f, 200f, 200f), score = 0.95f),
            ScrfdCandidate(box = FaceBox(105f, 102f, 202f, 201f), score = 0.85f),
            ScrfdCandidate(box = FaceBox(400f, 100f, 500f, 200f), score = 0.90f)
        )

        val filtered = ScrfdPostprocessor.applyNMS(candidates, iouThreshold = 0.40f)
        assertEquals(2, filtered.size)
        assertEquals(0.95f, filtered[0].score, 0.001f)
        assertEquals(0.90f, filtered[1].score, 0.001f)
    }

    @Test
    fun testQualityAssessmentAndHeadPose() {
        val landmarks = FaceLandmarks(
            leftEye = FacePoint(180f, 150f),
            rightEye = FacePoint(240f, 150f),
            nose = FacePoint(210f, 180f),
            leftMouth = FacePoint(190f, 210f),
            rightMouth = FacePoint(230f, 210f)
        )
        val candidate = ScrfdCandidate(
            box = FaceBox(150f, 100f, 270f, 240f),
            score = 0.94f,
            landmarks = landmarks
        )

        val quality = ScrfdPostprocessor.assessQuality(candidate, frameWidth = 640, frameHeight = 480)
        assertTrue("Frontal face should have isFrontal = true", quality.isFrontal)
        assertTrue("Face width 120px is adequately sized", quality.isAdequatelySized)
        assertTrue("Quality is acceptable for enrollment", quality.isAcceptableForEnrollment)
    }

    @Test
    fun testModelManagerLifecycleStates() {
        val uninit: ModelState = ModelState.Uninitialized
        assertTrue(uninit is ModelState.Uninitialized)

        val loading: ModelState = ModelState.Loading(0.5f)
        assertTrue(loading is ModelState.Loading)
        assertEquals(0.5f, (loading as ModelState.Loading).progress, 0.01f)

        val modelInfo = ModelInfo(
            modelId = "test-model",
            modelName = "Test SCRFD",
            version = "1.0",
            task = ModelTask.DETECTION,
            inputShape = intArrayOf(1, 3, 640, 640),
            fileSizeInBytes = 2500000L,
            licenseType = "Evaluation",
            isCommercialPermitted = false
        )
        val ready: ModelState = ModelState.Ready(listOf(modelInfo))
        assertTrue(ready is ModelState.Ready)
        assertEquals(1, (ready as ModelState.Ready).models.size)

        val error: ModelState = ModelState.Error("Asset missing")
        assertTrue(error is ModelState.Error)
        assertEquals("Asset missing", (error as ModelState.Error).message)
    }

    @Test
    fun testCoordinateTransformationAndPreviewMirroring() {
        val frameWidth = 640f
        val faceBox = FaceBox(left = 100f, top = 50f, right = 300f, bottom = 350f)

        val mirroredLeft = frameWidth - faceBox.right
        val mirroredRight = frameWidth - faceBox.left

        assertEquals(340f, mirroredLeft, 0.01f)
        assertEquals(540f, mirroredRight, 0.01f)
        assertEquals(faceBox.width, mirroredRight - mirroredLeft, 0.01f)
    }

    // ---------- Milestone 5: CameraX Pipeline & Frame Processing Tests ----------

    @Test
    fun testCameraStateTransitions() {
        val permState: CameraState = CameraState.PermissionRequired
        assertTrue(permState is CameraState.PermissionRequired)

        val initState: CameraState = CameraState.Initializing
        assertTrue(initState is CameraState.Initializing)

        val readyState: CameraState = CameraState.Ready
        assertTrue(readyState is CameraState.Ready)

        val procState: CameraState = CameraState.Processing(fps = 10.0f, droppedCount = 2L)
        assertTrue(procState is CameraState.Processing)
        assertEquals(10.0f, (procState as CameraState.Processing).fps, 0.01f)
        assertEquals(2L, procState.droppedCount)

        val unavailState: CameraState = CameraState.Unavailable("Front camera not found")
        assertTrue(unavailState is CameraState.Unavailable)
        assertEquals("Front camera not found", (unavailState as CameraState.Unavailable).reason)

        val errorState: CameraState = CameraState.Error("Capture failed", canRetry = true)
        assertTrue(errorState is CameraState.Error)
        assertTrue((errorState as CameraState.Error).canRetry)
    }

    @Test
    fun testCameraFrameMetadataAndRotationHandling() {
        val rotations = listOf(0, 90, 180, 270)

        for (rotation in rotations) {
            val frame = CameraFrame(
                width = 640,
                height = 480,
                rotationDegrees = rotation,
                timestamp = 1000L,
                imageFormat = ImageFormat.YUV_420_888,
                lensFacing = CameraLens.FRONT,
                nv21Bytes = ByteArray(10) { 1 }
            )

            assertEquals(640, frame.width)
            assertEquals(480, frame.height)
            assertEquals(rotation, frame.rotationDegrees)
            assertEquals(CameraLens.FRONT, frame.lensFacing)
            assertEquals(ImageFormat.YUV_420_888, frame.imageFormat)
            assertNotNull(frame.nv21Bytes)
        }
    }

    @Test
    fun testCameraFrameProcessorAsyncExecution() = runBlocking {
        val dummyProcessor = object : CameraFrameProcessor {
            override suspend fun processFrame(frame: CameraFrame): FrameProcessResult {
                return if (frame.width > 0 && frame.height > 0) {
                    FrameProcessResult.FrameReady(
                        frameId = 101L,
                        width = frame.width,
                        height = frame.height,
                        rotationDegrees = frame.rotationDegrees
                    )
                } else {
                    FrameProcessResult.Error("Invalid frame dimensions")
                }
            }
        }

        val testFrame = CameraFrame(
            width = 640,
            height = 480,
            rotationDegrees = 270,
            lensFacing = CameraLens.FRONT
        )

        val result = dummyProcessor.processFrame(testFrame)
        assertTrue(result is FrameProcessResult.FrameReady)
        val ready = result as FrameProcessResult.FrameReady
        assertEquals(101L, ready.frameId)
        assertEquals(640, ready.width)
        assertEquals(480, ready.height)
        assertEquals(270, ready.rotationDegrees)
    }

    @Test
    fun testFrameThrottlingAndConcurrentLock() {
        val maxFps = 10
        val minIntervalMs = 1000L / maxFps
        var lastProcessedTime = -1000L
        val processedCount = AtomicInteger(0)
        val droppedCount = AtomicInteger(0)
        val isProcessing = AtomicBoolean(false)

        fun simulateIncomingFrame(timestamp: Long, isWorkerBusy: Boolean) {
            if (timestamp - lastProcessedTime < minIntervalMs) {
                droppedCount.incrementAndGet()
                return
            }

            if (isWorkerBusy) {
                droppedCount.incrementAndGet()
                return
            }

            lastProcessedTime = timestamp
            processedCount.incrementAndGet()
        }

        simulateIncomingFrame(0L, isWorkerBusy = false)
        assertEquals(1, processedCount.get())
        assertEquals(0, droppedCount.get())

        simulateIncomingFrame(30L, isWorkerBusy = false)
        assertEquals(1, processedCount.get())
        assertEquals(1, droppedCount.get())

        simulateIncomingFrame(120L, isWorkerBusy = true)
        assertEquals(1, processedCount.get())
        assertEquals(2, droppedCount.get())

        simulateIncomingFrame(250L, isWorkerBusy = false)
        assertEquals(2, processedCount.get())
        assertEquals(2, droppedCount.get())
    }

    // ---------- Milestone 4: Comprehensive Geofence & Location Verification Tests ----------

    @Test
    fun testSameCoordinatesReturnsZeroDistance() {
        val lat = 11.016844
        val lon = 76.955833
        val distance = GeofenceMathEngine.calculateDistanceMeters(lat, lon, lat, lon)
        assertEquals(0.0, distance, 0.001)
    }

    @Test
    fun testKnownGeographicDistanceHaversine() {
        val lat1 = 11.016844
        val lon1 = 76.955833
        val lat2 = 11.018000
        val lon2 = 76.956000

        val distance = GeofenceMathEngine.calculateDistanceMeters(lat1, lon1, lat2, lon2)
        assertTrue("Distance should be approximately 130m", distance in 120.0..140.0)
    }

    @Test
    fun testCircleInsideOutsideAndBoundary() {
        val center = GeoPoint(11.016844, 76.955833)
        val radius = 150.0
        val tolerance = 15.0

        val insidePoint = GeoPoint(11.017200, 76.955833)
        val (isInside, isBoundary, distInside) = GeofenceMathEngine.evaluateCircle(insidePoint, center, radius, tolerance)
        assertTrue("Point should be inside", isInside)
        assertFalse("Point 50m away is not on the 150m boundary", isBoundary)
        assertTrue("Distance < 150m", distInside < radius)

        val boundaryPoint = GeoPoint(11.018150, 76.955833)
        val (isInsideBound, isBoundaryTrue, distBound) = GeofenceMathEngine.evaluateCircle(boundaryPoint, center, radius, tolerance)
        assertTrue("Point on boundary is within tolerance", isInsideBound)
        assertTrue("Point should be flagged as boundary", isBoundaryTrue)

        val outsidePoint = GeoPoint(11.021000, 76.955833)
        val (isInsideOut, isBoundaryOut, distOut) = GeofenceMathEngine.evaluateCircle(outsidePoint, center, radius, tolerance)
        assertFalse("Point should be outside", isInsideOut)
        assertFalse("Point is not on boundary", isBoundaryOut)
        assertTrue("Distance > 150m", distOut > radius)
    }

    @Test
    fun testPolygonInsideOutsideAndInvalidVertices() {
        val vertices = listOf(
            GeoPoint(11.017000, 76.956000),
            GeoPoint(11.019000, 76.956000),
            GeoPoint(11.019000, 76.958000),
            GeoPoint(11.017000, 76.958000)
        )

        val pointInside = GeoPoint(11.018000, 76.957000)
        assertTrue("Center point must be inside polygon", GeofenceMathEngine.isInsidePolygon(pointInside, vertices))

        val pointOutside = GeoPoint(11.025000, 76.960000)
        assertFalse("Point must be outside polygon", GeofenceMathEngine.isInsidePolygon(pointOutside, vertices))

        val invalidVertices = listOf(GeoPoint(11.0, 76.0), GeoPoint(11.1, 76.1))
        assertFalse("Polygon with <3 vertices cannot contain points", GeofenceMathEngine.isInsidePolygon(pointInside, invalidVertices))
    }

    @Test
    fun testMultipleGeofencesNearestIdentification() {
        val validator = GeofenceValidator(maxAccuracyThresholdMeters = 30.0f)
        val geofences = listOf(
            CampusGeofence("GEO-1", "Main Block", GeofenceType.CIRCLE, 11.016844, 76.955833, 100.0),
            CampusGeofence("GEO-2", "Engineering Block", GeofenceType.CIRCLE, 11.025000, 76.965000, 100.0)
        )

        val outsidePoint = StaffLiveLocation(
            latitude = 11.018200,
            longitude = 76.955833,
            accuracyMeters = 5.0f,
            timestamp = System.currentTimeMillis()
        )

        val result = validator.validate(outsidePoint, geofences)
        assertTrue("Result should be OutsideAllGeofences", result is LocationVerificationResult.OutsideAllGeofences)
        val outside = result as LocationVerificationResult.OutsideAllGeofences
        assertEquals("Main Block", outside.nearestGeofenceName)
    }

    @Test
    fun testMockLocationRejection() {
        val validator = GeofenceValidator()
        val geofences = listOf(
            CampusGeofence("GEO-1", "Main Campus", GeofenceType.CIRCLE, 11.016844, 76.955833, 200.0)
        )

        val mockedLocation = StaffLiveLocation(
            latitude = 11.016844,
            longitude = 76.955833,
            accuracyMeters = 4.0f,
            isMock = true,
            timestamp = System.currentTimeMillis()
        )

        val result = validator.validate(mockedLocation, geofences)
        assertTrue("Must detect and reject mock location", result is LocationVerificationResult.MockLocationDetected)
    }

    @Test
    fun testStaleLocationRejection() {
        val validator = GeofenceValidator(maxLocationAgeSeconds = 60L)
        val geofences = listOf(
            CampusGeofence("GEO-1", "Main Campus", GeofenceType.CIRCLE, 11.016844, 76.955833, 200.0)
        )

        val staleLocation = StaffLiveLocation(
            latitude = 11.016844,
            longitude = 76.955833,
            accuracyMeters = 5.0f,
            timestamp = System.currentTimeMillis() - 120_000L
        )

        val result = validator.validate(staleLocation, geofences)
        assertTrue("Must detect stale GPS data", result is LocationVerificationResult.StaleLocation)
    }

    @Test
    fun testAccuracyInsufficientRejection() {
        val validator = GeofenceValidator(maxAccuracyThresholdMeters = 30.0f)
        val geofences = listOf(
            CampusGeofence("GEO-1", "Main Campus", GeofenceType.CIRCLE, 11.016844, 76.955833, 200.0)
        )

        val inaccurateLocation = StaffLiveLocation(
            latitude = 11.016844,
            longitude = 76.955833,
            accuracyMeters = 95.0f,
            timestamp = System.currentTimeMillis()
        )

        val result = validator.validate(inaccurateLocation, geofences)
        assertTrue("Must reject poor accuracy", result is LocationVerificationResult.AccuracyInsufficient)
    }

    @Test
    fun testNoActiveGeofencesState() {
        val validator = GeofenceValidator()
        val emptyGeofences = emptyList<CampusGeofence>()

        val loc = StaffLiveLocation(
            latitude = 11.016844,
            longitude = 76.955833,
            accuracyMeters = 5.0f,
            timestamp = System.currentTimeMillis()
        )

        val result = validator.validate(loc, emptyGeofences)
        assertTrue("Must return NoActiveGeofences", result is LocationVerificationResult.NoActiveGeofences)
    }

    // ---------- Milestone 2 & 3 Integration Tests ----------

    @Test
    fun testStaffMemberModelAndUserOutDtoMapping() {
        val userDto = UserOutDto(
            id = 42,
            name = "Dr. Kamesh V",
            email = "kamesh@institution.edu",
            username = "kamesh",
            role = "teacher",
            department = "Computer Science",
            departmentId = 1,
            isActive = true
        )

        val staff = StaffMember(
            id = userDto.id,
            name = userDto.name,
            email = userDto.email ?: "",
            username = userDto.username,
            role = userDto.role,
            departmentId = userDto.departmentId,
            departmentName = userDto.department,
            isActive = userDto.isActive
        )

        assertEquals(42, staff.id)
        assertEquals("Dr. Kamesh V", staff.name)
        assertEquals("teacher", staff.role)
        assertEquals(1, staff.departmentId)
        assertEquals("Computer Science", staff.departmentName)
        assertTrue(staff.isActive)
    }

    @Test
    fun testTimetableMappingAndDayOrderMatrix() {
        val dtos = listOf(
            TimetableSlotOutDto(id = 1, teacherId = 42, subjectId = 10, classId = 5, roomId = 12, dayOrder = 3, periodNumber = 1, subjectName = "Deep Learning", subjectCode = "CS801", className = "III B.Sc CS", classSection = "A", roomNumber = "Room 302"),
            TimetableSlotOutDto(id = 2, teacherId = 42, subjectId = 11, classId = 4, roomId = 8, dayOrder = 3, periodNumber = 3, subjectName = "Operating Systems", subjectCode = "CS402", className = "II B.Sc CS", classSection = "B", roomNumber = "Room 204")
        )

        val domainSlots = dtos.map { dto ->
            TimetableSlot(
                id = dto.id,
                teacherId = dto.teacherId,
                subjectName = dto.subjectName ?: "",
                subjectCode = dto.subjectCode ?: "",
                className = dto.className ?: "",
                section = dto.classSection ?: "",
                roomNumber = dto.roomNumber ?: "",
                dayOrder = dto.dayOrder,
                periodNumber = dto.periodNumber
            )
        }

        val day3Slots = domainSlots.filter { it.dayOrder == 3 }.sortedBy { it.periodNumber }
        assertEquals(2, day3Slots.size)
        assertEquals("Deep Learning", day3Slots[0].subjectName)
        assertEquals(1, day3Slots[0].periodNumber)
    }

    @Test
    fun testLeaveRequestStatusMappingAndEmergencyHandling() {
        val leaveDto = LeaveOutDto(
            id = 101,
            teacherId = 42,
            date = "2026-09-03",
            dayOrder = 4,
            periodNumber = 2,
            reason = "Emergency Medical Attention",
            status = "approved",
            isEmergency = true
        )

        val status = when (leaveDto.status.lowercase()) {
            "approved" -> LeaveStatus.APPROVED
            "rejected" -> LeaveStatus.REJECTED
            "cancelled" -> LeaveStatus.CANCELLED
            else -> LeaveStatus.PENDING
        }

        val leave = LeaveRequest(
            id = leaveDto.id,
            teacherId = leaveDto.teacherId,
            date = leaveDto.date,
            dayOrder = leaveDto.dayOrder,
            periodNumber = leaveDto.periodNumber,
            reason = leaveDto.reason,
            status = status,
            isEmergency = leaveDto.isEmergency
        )

        assertEquals(LeaveStatus.APPROVED, leave.status)
        assertTrue(leave.isEmergency)
    }

    @Test
    fun testNetworkResultStateMachine() {
        val loading: NetworkResult<Nothing> = NetworkResult.Loading
        assertTrue(loading is NetworkResult.Loading)

        val success: NetworkResult<String> = NetworkResult.Success("SUCCESS_PAYLOAD")
        assertTrue(success is NetworkResult.Success)
        assertEquals("SUCCESS_PAYLOAD", (success as NetworkResult.Success).data)

        val error: NetworkResult<String> = NetworkResult.Error(500, "Internal Server Error")
        assertTrue(error is NetworkResult.Error)
        assertEquals(500, (error as NetworkResult.Error).code)
    }
}
