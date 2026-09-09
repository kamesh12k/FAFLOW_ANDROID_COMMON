package com.governence.faflow.face

import com.governence.faflow.attendance.biometrics.alignment.SimilarityFaceAligner
import com.governence.faflow.attendance.biometrics.embedding.FaceRecognitionConfig
import com.governence.faflow.attendance.biometrics.embedding.MobileFaceNetEmbedder
import com.governence.faflow.attendance.biometrics.matching.CosineFaceMatcher
import com.governence.faflow.attendance.biometrics.model.FaceBox
import com.governence.faflow.attendance.biometrics.model.FaceDetectionResult
import com.governence.faflow.attendance.biometrics.model.FaceLandmarks
import com.governence.faflow.attendance.biometrics.model.FacePoint
import com.governence.faflow.attendance.biometrics.model.FaceQuality
import com.governence.faflow.attendance.biometrics.model.MobileFaceNetModelMetadata
import com.governence.faflow.attendance.biometrics.quality.FaceQualityCheckResult
import com.governence.faflow.attendance.biometrics.quality.FaceQualityValidator
import com.governence.faflow.attendance.biometrics.quality.QualityErrorCode
import com.governence.faflow.faflow.data.GeofenceRepository
import com.governence.faflow.attendance.geolocation.LocationProvider
import com.governence.faflow.attendance.geolocation.StaffLiveLocation
import com.governence.faflow.ui.viewmodels.AttendanceViewModel
import com.governence.faflow.ui.viewmodels.AutoCaptureState
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.sqrt

class FakeTestLocationProvider : LocationProvider {
    override val isLocationPermissionGranted: Boolean = true
    override val isLocationServiceEnabled: Boolean = true
    override fun getLocationUpdates(intervalMs: Long): Flow<StaffLiveLocation> = flowOf(
        StaffLiveLocation(11.016844, 76.955833, 5f, 0.0, 0f, false, System.currentTimeMillis())
    )
    override suspend fun getLastKnownLocation(): StaffLiveLocation = StaffLiveLocation(
        11.016844, 76.955833, 5f, 0.0, 0f, false, System.currentTimeMillis()
    )
}

/**
 * Production-grade verification test suite for the FAFLOW Face Recognition Subsystem:
 * - CosineFaceMatcher
 * - SimilarityFaceAligner
 * - MobileFaceNetEmbedder
 * - MobileFaceNetModelMetadata
 * - FaceQualityValidator
 */
class FaceRecognitionProductionTest {

    private val testDispatcher = StandardTestDispatcher()

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        AttendanceViewModel.BYPASS_LIVENESS_FOR_TESTING = true
    }

    @After
    fun tearDown() {
        AttendanceViewModel.BYPASS_LIVENESS_FOR_TESTING = false
        Dispatchers.resetMain()
    }

    // ==========================================
    // 1. Face Matcher Tests
    // ==========================================

    @Test
    fun testCosineSimilarityIdenticalVectors() {
        val matcher = CosineFaceMatcher()
        val vectorA = floatArrayOf(0.6f, 0.8f, 0.0f)
        val vectorB = floatArrayOf(0.6f, 0.8f, 0.0f)

        val similarity = matcher.computeCosineSimilarity(vectorA, vectorB)
        assertEquals(1.0f, similarity, 0.0001f)
    }

    @Test
    fun testCosineSimilarityOppositeVectors() {
        val matcher = CosineFaceMatcher()
        val vectorA = floatArrayOf(1.0f, 0.0f, 0.0f)
        val vectorB = floatArrayOf(-1.0f, 0.0f, 0.0f)

        val similarity = matcher.computeCosineSimilarity(vectorA, vectorB)
        assertEquals(-1.0f, similarity, 0.0001f)
    }

    @Test
    fun testCosineSimilarityOrthogonalVectors() {
        val matcher = CosineFaceMatcher()
        val vectorA = floatArrayOf(1.0f, 0.0f, 0.0f)
        val vectorB = floatArrayOf(0.0f, 1.0f, 0.0f)

        val similarity = matcher.computeCosineSimilarity(vectorA, vectorB)
        assertEquals(0.0f, similarity, 0.0001f)
    }

    @Test
    fun testCosineSimilarityZeroVectorHandledSafely() {
        val matcher = CosineFaceMatcher()
        val zeroVector = FloatArray(512) { 0.0f }
        val validVector = FloatArray(512) { 0.1f }

        val similarity = matcher.computeCosineSimilarity(zeroVector, validVector)
        assertEquals(0.0f, similarity, 0.0f)
        assertFalse(similarity.isNaN())
    }

    @Test
    fun testCosineSimilarityNaNAndInfSanitization() {
        val matcher = CosineFaceMatcher()
        val nanVector = floatArrayOf(1.0f, Float.NaN, 0.5f)
        val infVector = floatArrayOf(1.0f, Float.POSITIVE_INFINITY, 0.5f)
        val validVector = floatArrayOf(1.0f, 0.0f, 0.5f)

        assertEquals(0.0f, matcher.computeCosineSimilarity(nanVector, validVector), 0.0f)
        assertEquals(0.0f, matcher.computeCosineSimilarity(infVector, validVector), 0.0f)
    }

    @Test
    fun testCosineSimilarityClampedRange() {
        val matcher = CosineFaceMatcher()
        // Numerically imperfect values that might otherwise compute to 1.0000002
        val a = FloatArray(512) { 1.0f / sqrt(512.0).toFloat() }
        val similarity = matcher.computeCosineSimilarity(a, a)
        assertTrue(similarity in -1.0f..1.0f)
    }

    @Test
    fun testCosineMatcherThresholdBoundary() {
        val config = FaceRecognitionConfig(similarityThreshold = 0.60f)
        val matcher = CosineFaceMatcher(config)

        val base = floatArrayOf(1.0f, 0.0f, 0.0f)
        val closeCandidate = floatArrayOf(0.8f, 0.6f, 0.0f) // Cosine similarity = 0.80 >= 0.60
        val farCandidate = floatArrayOf(0.4f, 0.9165f, 0.0f) // Cosine similarity = 0.40 < 0.60

        val matchClose = matcher.verifyOneToOne(base, closeCandidate, threshold = 0.60f)
        assertTrue(matchClose.isMatched)
        assertEquals(0.80f, matchClose.similarityScore, 0.01f)

        val matchFar = matcher.verifyOneToOne(base, farCandidate, threshold = 0.60f)
        assertFalse(matchFar.isMatched)
        assertEquals(0.40f, matchFar.similarityScore, 0.01f)
    }

    @Test
    fun testFindBestMatchMultipleCandidates() {
        val matcher = CosineFaceMatcher()
        val target = floatArrayOf(1.0f, 0.0f, 0.0f)

        val candidates = listOf(
            "staff_101" to floatArrayOf(0.2f, 0.979f, 0.0f), // similarity = 0.20
            "staff_102" to floatArrayOf(0.92f, 0.39f, 0.0f), // similarity = 0.92
            "staff_103" to floatArrayOf(0.75f, 0.66f, 0.0f)  // similarity = 0.75
        )

        val best = matcher.findBestMatch(target, candidates, threshold = 0.60f)
        assertNotNull(best)
        assertEquals("staff_102", best!!.first)
        assertEquals(0.92f, best.second, 0.01f)
    }

    // ==========================================
    // 2. Similarity Alignment Tests
    // ==========================================

    @Test
    fun testSimilarityReferenceLandmarks() {
        val ref112 = SimilarityFaceAligner.referencePoints(112)
        assertEquals(5, ref112.size)

        // Left eye, right eye, nose, left mouth, right mouth
        assertEquals(38.2946f, ref112[0].first, 0.001f)
        assertEquals(73.5318f, ref112[1].first, 0.001f)
        assertEquals(56.0252f, ref112[2].first, 0.001f)
        assertEquals(41.5493f, ref112[3].first, 0.001f)
        assertEquals(70.7299f, ref112[4].first, 0.001f)
    }

    @Test
    fun testLandmarkBiologicalValidation() {
        val aligner = SimilarityFaceAligner()

        val valid = FaceLandmarks(
            leftEye = FacePoint(180f, 150f),
            rightEye = FacePoint(240f, 150f),
            nose = FacePoint(210f, 180f),
            leftMouth = FacePoint(190f, 210f),
            rightMouth = FacePoint(230f, 210f)
        )
        assertNull(aligner.validateLandmarks(valid, 640, 480))

        // Inverted eyes: left eye x >= right eye x
        val invertedEyes = valid.copy(leftEye = FacePoint(250f, 150f))
        assertNotNull(aligner.validateLandmarks(invertedEyes, 640, 480))

        // Inverted nose: nose tip above eye midpoint
        val invertedNose = valid.copy(nose = FacePoint(210f, 140f))
        assertNotNull(aligner.validateLandmarks(invertedNose, 640, 480))

        // Inverted mouth: mouth corners above nose tip
        val invertedMouth = valid.copy(leftMouth = FacePoint(190f, 170f), rightMouth = FacePoint(230f, 170f))
        assertNotNull(aligner.validateLandmarks(invertedMouth, 640, 480))

        // Small inter-pupillary distance (< 20px)
        val tinyEyes = valid.copy(rightEye = FacePoint(190f, 150f))
        assertNotNull(aligner.validateLandmarks(tinyEyes, 640, 480))
    }

    // ==========================================
    // 3. Model & Feature Embedder Tests
    // ==========================================

    @Test
    fun testMobileFaceNetMetadataConstants() {
        assertEquals("models/w600k_mbf.onnx", MobileFaceNetModelMetadata.MODEL_FILE_NAME)
        assertEquals(112, MobileFaceNetModelMetadata.INPUT_SIZE)
        assertEquals(512, MobileFaceNetModelMetadata.EMBEDDING_DIM)
        assertEquals("w600k_mbf_v1", MobileFaceNetModelMetadata.MODEL_VERSION)
    }

    @Test
    fun testL2NormalizeVector() {
        val raw = floatArrayOf(3.0f, 4.0f, 0.0f) // Magnitude = 5.0
        val normalized = MobileFaceNetEmbedder.l2Normalize(raw)

        assertEquals(0.6f, normalized[0], 0.001f)
        assertEquals(0.8f, normalized[1], 0.001f)
        assertEquals(0.0f, normalized[2], 0.001f)

        var magSq = 0.0
        for (v in normalized) magSq += (v * v).toDouble()
        assertEquals(1.0, sqrt(magSq), 0.0001)
    }

    @Test
    fun testL2NormalizeZeroAndNan() {
        val zero = FloatArray(512) { 0.0f }
        val normZero = MobileFaceNetEmbedder.l2Normalize(zero)
        assertEquals(512, normZero.size)
        for (v in normZero) assertEquals(0.0f, v, 0.0f)

        val nan = floatArrayOf(1.0f, Float.NaN, 2.0f)
        val normNan = MobileFaceNetEmbedder.l2Normalize(nan)
        for (v in normNan) assertEquals(0.0f, v, 0.0f)
    }

    // ==========================================
    // 4. Face Quality & Multi-Face Gating Tests
    // ==========================================

    @Test
    fun testQualityZeroFacesRejected() {
        val validator = FaceQualityValidator()
        val result = validator.validate(emptyList())

        assertTrue(result is FaceQualityCheckResult.Rejected)
        val rejected = result as FaceQualityCheckResult.Rejected
        assertEquals(QualityErrorCode.NO_FACE, rejected.code)
        assertEquals("Face not detected", rejected.reason)
    }

    @Test
    fun testQualityMultipleFacesRejected() {
        val validator = FaceQualityValidator()
        val face1 = FaceDetectionResult(
            boundingBox = FaceBox(200f, 150f, 350f, 300f),
            confidence = 0.90f
        )
        val face2 = FaceDetectionResult(
            boundingBox = FaceBox(400f, 150f, 550f, 300f),
            confidence = 0.85f
        )

        val result = validator.validate(listOf(face1, face2))
        assertTrue(result is FaceQualityCheckResult.Rejected)
        val rejected = result as FaceQualityCheckResult.Rejected
        assertEquals(QualityErrorCode.MULTIPLE_FACES, rejected.code)
        assertEquals("Only one person should be visible", rejected.reason)
    }

    @Test
    fun testQualityFaceTooFar() {
        val validator = FaceQualityValidator()
        // Frame width 640, face box width 80 (ratio 80/640 = 0.125 < 0.22)
        val tinyFace = FaceDetectionResult(
            boundingBox = FaceBox(280f, 200f, 360f, 280f),
            confidence = 0.88f
        )

        val result = validator.validate(listOf(tinyFace), frameWidth = 640, frameHeight = 480)
        assertTrue(result is FaceQualityCheckResult.Rejected)
        val rejected = result as FaceQualityCheckResult.Rejected
        assertEquals(QualityErrorCode.TOO_FAR, rejected.code)
        assertEquals("Move closer", rejected.reason)
    }

    @Test
    fun testQualityFaceTooClose() {
        val validator = FaceQualityValidator()
        // Frame width 640, face box width 550 (ratio 550/640 = 0.86 > 0.80)
        val hugeFace = FaceDetectionResult(
            boundingBox = FaceBox(45f, 20f, 595f, 460f),
            confidence = 0.92f
        )

        val result = validator.validate(listOf(hugeFace), frameWidth = 640, frameHeight = 480)
        assertTrue(result is FaceQualityCheckResult.Rejected)
        val rejected = result as FaceQualityCheckResult.Rejected
        assertEquals(QualityErrorCode.TOO_CLOSE, rejected.code)
        assertEquals("Move farther away", rejected.reason)
    }

    @Test
    fun testQualityFaceTiltedPose() {
        val validator = FaceQualityValidator()
        // Good size, but head turned 30 degrees yaw
        val turnedFace = FaceDetectionResult(
            boundingBox = FaceBox(220f, 140f, 420f, 340f),
            confidence = 0.91f,
            quality = FaceQuality(yawAngle = 30f)
        )

        val result = validator.validate(listOf(turnedFace), frameWidth = 640, frameHeight = 480)
        assertTrue(result is FaceQualityCheckResult.Rejected)
        val rejected = result as FaceQualityCheckResult.Rejected
        assertEquals(QualityErrorCode.TILTED_POSE, rejected.code)
        assertEquals("Look directly at the camera", rejected.reason)
    }

    @Test
    fun testQualityValidFaceAccepted() {
        val validator = FaceQualityValidator()
        val centeredFace = FaceDetectionResult(
            boundingBox = FaceBox(220f, 140f, 420f, 340f), // Width = 200/640 = 0.3125, Centered
            confidence = 0.94f,
            quality = FaceQuality(
                brightnessScore = 0.65f,
                sharpnessScore = 0.85f,
                yawAngle = 2f,
                pitchAngle = -1f,
                rollAngle = 0f,
                isFrontal = true
            )
        )

        val result = validator.validate(listOf(centeredFace), frameWidth = 640, frameHeight = 480)
        assertTrue(result is FaceQualityCheckResult.Valid)
        val valid = result as FaceQualityCheckResult.Valid
        assertEquals(0.94f, valid.primaryFace.confidence, 0.001f)
    }

    // ==========================================
    // 6. Auto-Capture & Micro-Stability Tests
    // ==========================================

    @Test
    fun testAutoCaptureMicroStabilityGate() {
        val geofenceRepo = GeofenceRepository(locationProvider = FakeTestLocationProvider())
        val viewModel = AttendanceViewModel(geofenceRepository = geofenceRepo)

        val centeredFace = FaceDetectionResult(
            boundingBox = FaceBox(220f, 140f, 420f, 340f),
            confidence = 0.95f,
            quality = FaceQuality(
                brightnessScore = 0.70f,
                sharpnessScore = 0.85f,
                yawAngle = 0f,
                pitchAngle = 0f,
                isFrontal = true
            )
        )

        // Initial State
        assertEquals(AutoCaptureState.SEARCHING, viewModel.autoCaptureState.value)
        assertEquals("Positioning...", viewModel.autoCapturePrompt.value)
        assertFalse(viewModel.isCaptureLocked.value)

        // Smart Settling: minSettlingDurationMs = 300ms, minSettlingFrames = 4
        // Frame 1: Detected -> Settling starts -> State = SETTLING, prompt = "Hold still"
        viewModel.updateDetections(listOf(centeredFace), frameWidth = 640, frameHeight = 480)
        assertEquals(AutoCaptureState.SETTLING, viewModel.autoCaptureState.value)
        assertEquals("Hold still", viewModel.autoCapturePrompt.value)
        assertFalse(viewModel.isCaptureLocked.value)

        // Frames 2 & 3 arriving too quickly (< 300ms elapsed) -> must NOT trigger capture prematurely
        viewModel.updateDetections(listOf(centeredFace), frameWidth = 640, frameHeight = 480)
        viewModel.updateDetections(listOf(centeredFace), frameWidth = 640, frameHeight = 480)
        assertEquals(AutoCaptureState.SETTLING, viewModel.autoCaptureState.value)
        assertFalse(viewModel.isCaptureLocked.value)

        // When settling duration requirement is met (e.g. minSettlingDurationMs = 0 in unit test)
        viewModel.minSettlingDurationMs = 0L
        viewModel.updateDetections(listOf(centeredFace), frameWidth = 640, frameHeight = 480)
        // Now stableGoodFrameCount >= 4 and duration met -> CAPTURED & LOCKED
        assertEquals(AutoCaptureState.CAPTURED, viewModel.autoCaptureState.value)
        assertEquals("Checking...", viewModel.autoCapturePrompt.value)
        assertTrue(viewModel.isCaptureLocked.value)

        // Subsequent frame when locked is bypassed
        val badFace = FaceDetectionResult(
            boundingBox = FaceBox(50f, 50f, 100f, 100f),
            confidence = 0.2f
        )
        viewModel.updateDetections(listOf(badFace), frameWidth = 640, frameHeight = 480)
        assertTrue(viewModel.isCaptureLocked.value)
        assertEquals(AutoCaptureState.CAPTURED, viewModel.autoCaptureState.value)
    }

    @Test
    fun testBestCandidateFrameScoringSelection() {
        val sharpCenteredFace = FaceDetectionResult(
            boundingBox = FaceBox(220f, 140f, 420f, 340f),
            confidence = 0.98f,
            quality = FaceQuality(
                brightnessScore = 0.75f,
                sharpnessScore = 0.90f,
                yawAngle = 2f,
                pitchAngle = -1f,
                rollAngle = 0f,
                isFrontal = true
            )
        )

        val blurryOffCenterFace = FaceDetectionResult(
            boundingBox = FaceBox(10f, 10f, 100f, 100f),
            confidence = 0.65f,
            quality = FaceQuality(
                brightnessScore = 0.25f,
                sharpnessScore = 0.30f,
                yawAngle = 25f,
                pitchAngle = 15f,
                rollAngle = 10f,
                isFrontal = false
            )
        )

        val sharpScore = AttendanceViewModel.computeCandidateQualityScore(sharpCenteredFace)
        val blurryScore = AttendanceViewModel.computeCandidateQualityScore(blurryOffCenterFace)

        assertTrue("Sharp centered face must score higher than blurry off-center face", sharpScore > blurryScore)
        assertTrue("Sharp score should be > 0.65", sharpScore > 0.65f)
        assertTrue("Blurry score should be < 0.50", blurryScore < 0.50f)
    }

    @Test
    fun testErrorMessageSanitization() {
        // 1. Raw backend JSON with liveness error
        val rawLiveness = """{"detail":"Liveness / presentation attack verification failed"}"""
        assertEquals("Unable to verify your face", AttendanceViewModel.sanitizeErrorMessage(rawLiveness))

        // 2. Similarity error
        val rawSim = """{"detail":"Biometric face similarity score (0.52) below threshold 0.60"}"""
        assertEquals("Face not recognized", AttendanceViewModel.sanitizeErrorMessage(rawSim))

        // 3. Geofence error
        val rawGeofence = """{"detail":"Location verification failed: Staff member is outside institutional campus geofence perimeters"}"""
        assertEquals("Outside authorized campus perimeter", AttendanceViewModel.sanitizeErrorMessage(rawGeofence))

        // 4. Duplicate attendance error
        val rawDup = """{"detail":"Staff member is already checked in for today (2026-09-05)"}"""
        assertEquals("Staff member is already checked in for today", AttendanceViewModel.sanitizeErrorMessage(rawDup))

        // 5. Network connectivity error
        val rawNet = "java.net.UnknownHostException: Unable to resolve host 'example.com': No address associated with hostname"
        assertEquals("Unable to connect. Please try again.", AttendanceViewModel.sanitizeErrorMessage(rawNet))
    }

    @Test
    fun testQualityRejectionResetsStability() {
        val geofenceRepo = GeofenceRepository(locationProvider = FakeTestLocationProvider())
        val viewModel = AttendanceViewModel(geofenceRepository = geofenceRepo)

        val centeredFace = FaceDetectionResult(
            boundingBox = FaceBox(220f, 140f, 420f, 340f),
            confidence = 0.95f,
            quality = FaceQuality(
                brightnessScore = 0.70f,
                sharpnessScore = 0.85f,
                yawAngle = 0f,
                pitchAngle = 0f,
                isFrontal = true
            )
        )

        // Frame 1: Valid -> "Hold still"
        viewModel.updateDetections(listOf(centeredFace), frameWidth = 640, frameHeight = 480)
        assertEquals(AutoCaptureState.SETTLING, viewModel.autoCaptureState.value)
        assertEquals("Hold still", viewModel.autoCapturePrompt.value)

        // Frame 2: Rejected (multiple faces) -> settling reset to 0
        val faceA = FaceDetectionResult(boundingBox = FaceBox(100f, 100f, 200f, 200f), confidence = 0.9f)
        val faceB = FaceDetectionResult(boundingBox = FaceBox(300f, 100f, 400f, 200f), confidence = 0.9f)
        viewModel.updateDetections(listOf(faceA, faceB), frameWidth = 640, frameHeight = 480)
        assertEquals(AutoCaptureState.SEARCHING, viewModel.autoCaptureState.value)
        assertEquals("Only one person should be visible", viewModel.autoCapturePrompt.value)
        assertFalse(viewModel.isCaptureLocked.value)
    }

    @Test
    fun testRetryCaptureResetsLockedState() {
        val geofenceRepo = GeofenceRepository(locationProvider = FakeTestLocationProvider())
        val viewModel = AttendanceViewModel(geofenceRepository = geofenceRepo)
        viewModel.minSettlingDurationMs = 0L
        viewModel.minSettlingFrames = 2

        val centeredFace = FaceDetectionResult(
            boundingBox = FaceBox(220f, 140f, 420f, 340f),
            confidence = 0.95f,
            quality = FaceQuality(
                brightnessScore = 0.70f,
                sharpnessScore = 0.85f,
                yawAngle = 0f,
                pitchAngle = 0f,
                isFrontal = true
            )
        )

        // Trigger capture
        viewModel.updateDetections(listOf(centeredFace), frameWidth = 640, frameHeight = 480)
        viewModel.updateDetections(listOf(centeredFace), frameWidth = 640, frameHeight = 480)
        assertTrue(viewModel.isCaptureLocked.value)

        // Retry
        viewModel.retryCapture()
        assertFalse(viewModel.isCaptureLocked.value)
        assertNull(viewModel.capturedFrameBitmap.value)
        assertEquals(AutoCaptureState.SEARCHING, viewModel.autoCaptureState.value)
        assertEquals("Positioning...", viewModel.autoCapturePrompt.value)
    }
}

