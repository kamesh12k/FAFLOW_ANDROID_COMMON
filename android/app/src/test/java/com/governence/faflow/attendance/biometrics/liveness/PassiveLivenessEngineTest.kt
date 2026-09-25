package com.governence.faflow.attendance.biometrics.liveness

import com.governence.faflow.attendance.biometrics.model.FaceBox
import com.governence.faflow.attendance.biometrics.model.FaceDetectionResult
import com.governence.faflow.attendance.biometrics.model.FaceLandmarks
import com.governence.faflow.attendance.biometrics.model.FacePoint
import com.governence.faflow.attendance.biometrics.model.FaceQuality
import com.governence.faflow.attendance.biometrics.model.SpoofType
import com.governence.faflow.attendance.biometrics.session.AttendanceOperationType
import com.governence.faflow.attendance.biometrics.session.VerificationSession
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Production validation test suite for PassiveLivenessEngine (Zero-Challenge PAD).
 * Tests ISO/IEC 30107-3 presentation attack defenses:
 * 1. Live natural face variation -> early pass (< 250ms, >= 0.75 confidence)
 * 2. Static 2D photo attack -> rejected (planar rigidity)
 * 3. Extreme texture deficit / blurry print -> rejected
 * 4. Spatial discontinuity (abrupt phone swap / camera cut) -> rejected
 * 5. Multi-frame accumulation & adaptive window timing
 * 6. Atomic integration with VerificationSession -> authorizes attendance without bypass
 */
class PassiveLivenessEngineTest {

    private lateinit var engine: PassiveLivenessEngine

    @Before
    fun setUp() {
        engine = PassiveLivenessEngine(
            minSettlingFrames = 2,
            minSettlingWindowMs = 160L,
            earlyAcceptanceThreshold = 0.75f
        )
    }

    private fun createFaceDetection(
        leftEyeX: Float = 240f,
        leftEyeY: Float = 200f,
        rightEyeX: Float = 400f,
        rightEyeY: Float = 200f,
        noseX: Float = 320f,
        noseY: Float = 260f,
        leftMouthX: Float = 260f,
        leftMouthY: Float = 330f,
        rightMouthX: Float = 380f,
        rightMouthY: Float = 330f,
        boxLeft: Float = 170f,
        boxTop: Float = 90f,
        boxRight: Float = 470f,
        boxBottom: Float = 390f,
        confidence: Float = 0.95f,
        sharpnessScore: Float = 0.85f
    ): FaceDetectionResult {
        return FaceDetectionResult(
            boundingBox = FaceBox(boxLeft, boxTop, boxRight, boxBottom),
            landmarks = FaceLandmarks(
                leftEye = FacePoint(leftEyeX, leftEyeY),
                rightEye = FacePoint(rightEyeX, rightEyeY),
                nose = FacePoint(noseX, noseY),
                leftMouth = FacePoint(leftMouthX, leftMouthY),
                rightMouth = FacePoint(rightMouthX, rightMouthY)
            ),
            confidence = confidence,
            quality = FaceQuality(
                brightnessScore = 0.8f,
                sharpnessScore = sharpnessScore
            )
        )
    }

    // Test 1: Live face with subtle micro-tremor passes within early acceptance window
    @Test
    fun test01_liveFaceMicroTremor_earlyAcceptancePassed() {
        val t0 = 1000L
        val frame1 = createFaceDetection(noseX = 320.0f, confidence = 0.95f)
        val res1 = engine.processFrame(frame1, null, currentTimeMs = t0)
        assertTrue("Frame 1 should be analyzing", res1 is PassiveLivenessResult.Analyzing)

        // Frame 2 at t + 180ms with natural micro-variation (~0.5px involuntary tremor)
        val t1 = t0 + 180L
        val frame2 = createFaceDetection(noseX = 320.6f, leftEyeY = 200.3f, confidence = 0.95f)
        val res2 = engine.processFrame(frame2, null, currentTimeMs = t1)

        assertTrue("Frame 2 should achieve early acceptance", res2 is PassiveLivenessResult.Passed)
        val passed = res2 as PassiveLivenessResult.Passed
        assertTrue("Confidence should exceed early acceptance threshold", passed.confidence >= 0.75f)
        assertEquals("Risk must be LOW", PresentationAttackRisk.LOW, passed.risk)
    }

    // Test 2: Static 2D photograph with zero landmark variance across 3+ frames is rejected as PRINT_ATTACK
    @Test
    fun test02_staticPhotoRigidPlanar_spoofDetected() {
        val t0 = 1000L
        // Feed mathematically identical frames (e.g. static printed picture or photo on another screen)
        val frame = createFaceDetection()

        engine.processFrame(frame, null, currentTimeMs = t0)
        engine.processFrame(frame, null, currentTimeMs = t0 + 100L)
        val res3 = engine.processFrame(frame, null, currentTimeMs = t0 + 200L)

        assertTrue("Planar rigid photo must be detected as spoof", res3 is PassiveLivenessResult.SpoofDetected)
        val spoof = res3 as PassiveLivenessResult.SpoofDetected
        assertEquals(SpoofType.PRINT_ATTACK, spoof.spoofType)
        assertTrue(spoof.reason.contains("2D static photo"))
    }

    // Test 3: Sub-threshold texture deficit (blurred print or photocopied paper) is rejected
    @Test
    fun test03_lowTextureBlurryPrint_spoofDetected() {
        val t0 = 1000L
        val blurryFrame = createFaceDetection(sharpnessScore = 0.08f)

        engine.processFrame(blurryFrame, null, currentTimeMs = t0)
        val res2 = engine.processFrame(blurryFrame, null, currentTimeMs = t0 + 180L)

        assertTrue("Extreme low texture blur must be rejected", res2 is PassiveLivenessResult.SpoofDetected)
        val spoof = res2 as PassiveLivenessResult.SpoofDetected
        assertEquals(SpoofType.PRINT_ATTACK, spoof.spoofType)
    }

    // Test 4: Abrupt spatial displacement (phone swap or replay cut) triggers anti-swap defense
    @Test
    fun test04_abruptSpatialDisplacement_replaySwapDetected() {
        val t0 = 1000L
        val frame1 = createFaceDetection(boxLeft = 100f, boxRight = 300f)
        engine.processFrame(frame1, null, currentTimeMs = t0)

        // Sudden jump of 250px (> maxAllowedDiscontinuityPx = 140px)
        val frame2 = createFaceDetection(boxLeft = 400f, boxRight = 600f)
        val res2 = engine.processFrame(frame2, null, currentTimeMs = t0 + 100L)

        assertTrue("Sudden displacement must trigger spoof detection", res2 is PassiveLivenessResult.SpoofDetected)
        val spoof = res2 as PassiveLivenessResult.SpoofDetected
        assertEquals(SpoofType.REPLAY_ATTACK, spoof.spoofType)
    }

    // Test 5: Null face detection returns Inconclusive
    @Test
    fun test05_nullFace_returnsInconclusive() {
        val res = engine.processFrame(null, null, 1000L)
        assertTrue(res is PassiveLivenessResult.Inconclusive)
    }

    // Test 6: VerificationSession integration: markPassiveLivenessVerified enables attendance submission
    @Test
    fun test06_verificationSession_passiveLivenessIntegration() {
        val session = VerificationSession(operationType = AttendanceOperationType.CHECK_IN)
        session.markFaceVerified("STAFF-001", 0.92f)

        assertFalse("Cannot submit before liveness", session.canSubmitAttendance(session.sessionId))

        // Mark passive liveness verified with score 0.88 and LOW risk
        session.markPassiveLivenessVerified(0.88f, PresentationAttackRisk.LOW)

        assertTrue("Liveness should be verified", session.isLivenessVerified)
        assertTrue("Attendance should be submittable with passive liveness and valid face match",
            session.canSubmitAttendance(session.sessionId))
    }

    // Test 7: VerificationSession rejects high-risk passive PAD
    @Test
    fun test07_verificationSession_rejectsHighRiskPassivePAD() {
        val session = VerificationSession(operationType = AttendanceOperationType.CHECK_IN)
        session.markFaceVerified("STAFF-001", 0.92f)

        // Mark passive liveness with HIGH risk
        session.markPassiveLivenessVerified(0.40f, PresentationAttackRisk.HIGH)

        assertFalse("High risk must NOT be marked verified", session.isLivenessVerified)
        assertFalse("Cannot submit with high attack risk", session.canSubmitAttendance(session.sessionId))
    }
}
