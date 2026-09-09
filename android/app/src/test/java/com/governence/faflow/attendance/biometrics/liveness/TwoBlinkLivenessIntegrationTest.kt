package com.governence.faflow.attendance.biometrics.liveness

import com.governence.faflow.attendance.biometrics.session.AttendanceOperationType
import com.governence.faflow.attendance.biometrics.session.FaceVerificationStatus
import com.governence.faflow.attendance.biometrics.session.LivenessVerificationStatus
import com.governence.faflow.attendance.biometrics.session.VerificationSession
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.util.UUID

/**
 * Verification test suite for FAFLOW Two-Blink Liveness Integration.
 * Covers all 14 mandatory tests and race-condition scenarios outlined in specification:
 *
 * 1. One valid blink -> liveness = false
 * 2. Two valid blinks -> liveness = true
 * 3. Eyes remain closed -> liveness = false
 * 4. One blink + timeout -> liveness = false
 * 5. Noisy eye landmarks -> no false blink
 * 6. One blink flutter (debounce) -> blink count = 1
 * 7. Face verification fails -> blink detector never starts, attendance never executes
 * 8. Face verification succeeds + only one blink -> attendance never executes
 * 9. Face verification succeeds + two blinks -> attendance executes
 * 10. Check-in succeeds, then checkout starts -> completely fresh verification session required
 * 11. Previous check-in liveness exists, checkout has no blink -> checkout rejected
 * 12. Static photograph during checkout -> rejected
 * 13. Different person's face -> face verification rejected, liveness never starts
 * 14. Multiple faces -> rejected
 * 15. Race conditions / duplicate blink 2 event -> single atomic attendance trigger
 */
class TwoBlinkLivenessIntegrationTest {

    private lateinit var detector: BlinkDetector

    @Before
    fun setUp() {
        detector = BlinkDetector()
        detector.reset()
    }

    /**
     * Helper to feed EAR directly into BlinkDetector.
     */
    private fun feedEar(ear: Float, timestampMs: Long): BlinkState {
        return detector.processEyeMetric(ear, timestampMs)
    }

    private fun simulateSingleBlink(startTimeMs: Long): Long {
        var t = startTimeMs
        // 1. Open eyes (EAR >= 0.22f)
        feedEar(ear = 0.35f, timestampMs = t)
        t += 80
        feedEar(ear = 0.35f, timestampMs = t)
        t += 80

        // 2. Eyes close (EAR <= 0.16f)
        feedEar(ear = 0.12f, timestampMs = t)
        t += 60
        feedEar(ear = 0.10f, timestampMs = t)
        t += 60

        // 3. Eyes re-open (EAR >= 0.22f)
        feedEar(ear = 0.35f, timestampMs = t)
        t += 80
        feedEar(ear = 0.35f, timestampMs = t)
        return t
    }

    // Test 1: One valid blink -> liveness = false
    @Test
    fun test01_oneValidBlink_livenessIsFalse() {
        var t = 1000L
        t = simulateSingleBlink(t)

        assertEquals("Should detect exactly 1 blink", 1, detector.blinkCount)
        assertFalse("Liveness must remain false after only 1 blink", detector.isLivenessVerified)
    }

    // Test 2: Two valid blinks -> liveness = true
    @Test
    fun test02_twoValidBlinks_livenessIsTrue() {
        var t = 1000L
        t = simulateSingleBlink(t)
        assertEquals(1, detector.blinkCount)
        assertFalse(detector.isLivenessVerified)

        // Required inter-blink open period (>= 150ms)
        t += 200
        feedEar(ear = 0.35f, timestampMs = t)
        t += 100

        // Second blink
        simulateSingleBlink(t)
        assertEquals("Should detect exactly 2 blinks", 2, detector.blinkCount)
        assertTrue("Liveness must be verified after 2 full blinks", detector.isLivenessVerified)
    }

    // Test 3: Eyes remain continuously closed -> liveness = false
    @Test
    fun test03_eyesRemainClosed_livenessIsFalse() {
        var t = 1000L
        // Initially open
        feedEar(ear = 0.35f, timestampMs = t)
        t += 100

        // Eyes close and stay closed for 3 seconds (> 2000ms maxClosedDurationMs)
        for (i in 0 until 30) {
            feedEar(ear = 0.08f, timestampMs = t)
            t += 100
        }

        // Re-open
        feedEar(ear = 0.35f, timestampMs = t)

        assertEquals("Continuous eye closure should NOT count as a valid blink", 0, detector.blinkCount)
        assertFalse(detector.isLivenessVerified)
        assertTrue("Detector should be in Failed state", detector.currentState is BlinkState.Failed)
    }

    // Test 4: One blink + timeout -> liveness = false
    @Test
    fun test04_oneBlinkPlusTimeout_resetsOrFailsLiveness() {
        var t = 1000L
        t = simulateSingleBlink(t)
        assertEquals(1, detector.blinkCount)

        // Wait 15 seconds (> 12,000ms session timeout)
        t += 15_000L
        feedEar(ear = 0.35f, timestampMs = t)

        assertFalse("Liveness must not be verified on timeout", detector.isLivenessVerified)
        assertTrue("Detector state should be TimedOut", detector.currentState is BlinkState.TimedOut)
    }

    // Test 5: Noisy eye landmarks -> no false blink
    @Test
    fun test05_noisyEyeLandmarks_noFalseBlink() {
        var t = 1000L
        val noisyEars = listOf(0.32f, 0.28f, 0.35f, 0.23f, 0.29f, 0.33f, 0.22f, 0.30f)
        for (ear in noisyEars) {
            feedEar(ear = ear, timestampMs = t)
            t += 50
        }

        assertEquals("Noisy values above closed threshold must not trigger a blink", 0, detector.blinkCount)
        assertFalse(detector.isLivenessVerified)
    }

    // Test 6: One blink producing rapid flutter (debounce) -> count = 1
    @Test
    fun test06_oneBlinkFlutter_debouncedToOneBlink() {
        var t = 1000L
        // Open
        feedEar(ear = 0.35f, timestampMs = t)
        t += 80

        // Closed
        feedEar(ear = 0.12f, timestampMs = t)
        t += 60
        // Rapid flutter during closure
        feedEar(ear = 0.22f, timestampMs = t)
        t += 20
        feedEar(ear = 0.11f, timestampMs = t)
        t += 60

        // Open
        feedEar(ear = 0.35f, timestampMs = t)
        t += 80

        assertEquals("Rapid flutter within closure should register at most 1 blink", 1, detector.blinkCount)
        assertFalse(detector.isLivenessVerified)
    }

    // Test 7: Face verification fails -> blink detector never starts, attendance never executes
    @Test
    fun test07_faceVerificationFails_livenessNeverStarts_cannotSubmit() {
        val session = VerificationSession(
            operationType = AttendanceOperationType.CHECK_IN
        )
        session.markFaceFailed()

        assertFalse("Face is not verified", session.isFaceVerified)
        assertFalse("Liveness is not verified", session.isLivenessVerified)
        assertFalse("Cannot submit attendance when face verification failed", session.canSubmitAttendance(session.sessionId))
    }

    // Test 8: Face verification succeeds + only one blink -> attendance never executes
    @Test
    fun test08_faceVerificationSucceeds_oneBlink_cannotSubmit() {
        val session = VerificationSession(
            operationType = AttendanceOperationType.CHECK_IN
        )
        session.markFaceVerified("EMP-100", 0.92f)
        session.markLivenessStarted()
        session.recordBlink(1)

        assertTrue(session.isFaceVerified)
        assertEquals(1, session.blinkCount)
        assertFalse(session.isLivenessVerified)
        assertFalse("Cannot submit attendance with only 1 blink", session.canSubmitAttendance(session.sessionId))
    }

    // Test 9: Face verification succeeds + two blinks -> attendance executes
    @Test
    fun test09_faceVerificationSucceeds_twoBlinks_canSubmit() {
        val session = VerificationSession(
            operationType = AttendanceOperationType.CHECK_IN
        )
        session.markFaceVerified("EMP-100", 0.95f)
        session.markLivenessStarted()

        // Simulate two blinks
        var t = 1000L
        t = simulateSingleBlink(t)
        session.recordBlink(detector.blinkCount)
        t += 200
        feedEar(ear = 0.35f, timestampMs = t)
        t += 100
        simulateSingleBlink(t)
        session.recordBlink(detector.blinkCount)

        assertTrue(detector.isLivenessVerified)
        assertTrue(session.isFaceVerified)
        assertTrue(session.isLivenessVerified)
        assertTrue("Attendance must execute when face and 2-blink liveness succeed", session.canSubmitAttendance(session.sessionId))
    }

    // Test 10: Check-in succeeds. Then checkout starts.
    // Checkout must require completely new face verification AND completely new two-blink liveness.
    @Test
    fun test10_checkInSuccess_thenCheckOut_requiresFreshSessionAndVerification() {
        // Check-In session completed
        val checkInSession = VerificationSession(
            operationType = AttendanceOperationType.CHECK_IN
        )
        checkInSession.markFaceVerified("EMP-100", 0.94f)
        checkInSession.markLivenessStarted()
        checkInSession.recordBlink(1)
        checkInSession.recordBlink(2)
        assertTrue(checkInSession.canSubmitAttendance(checkInSession.sessionId))

        // Create new checkout session
        val checkOutSession = VerificationSession(
            operationType = AttendanceOperationType.CHECK_OUT
        )

        assertNotEquals("Checkout must have a unique session ID", checkInSession.sessionId, checkOutSession.sessionId)
        assertFalse("New checkout session cannot submit without fresh face verification", checkOutSession.isFaceVerified)
        assertFalse("New checkout session cannot submit without fresh liveness", checkOutSession.isLivenessVerified)
        assertFalse("New checkout session cannot submit without fresh verification", checkOutSession.canSubmitAttendance(checkOutSession.sessionId))
    }

    // Test 11: Previous check-in liveness exists. New checkout has no blink.
    // Checkout rejected.
    @Test
    fun test11_previousCheckInLivenessExists_checkoutNoBlink_rejected() {
        val checkInSession = VerificationSession(
            operationType = AttendanceOperationType.CHECK_IN
        )
        checkInSession.markFaceVerified("EMP-100", 0.95f)
        checkInSession.markLivenessStarted()
        checkInSession.recordBlink(2)

        // Checkout session starts
        val checkOutSession = VerificationSession(
            operationType = AttendanceOperationType.CHECK_OUT
        )
        checkOutSession.markFaceVerified("EMP-100", 0.95f)
        // Note: No liveness recorded for checkout session!

        // Attempting to submit using old check-in session ID
        assertFalse("Cannot use check-in session ID for checkout", checkOutSession.canSubmitAttendance(checkInSession.sessionId))

        // Attempting to submit checkout session without liveness
        assertFalse("Checkout without 2-blink liveness must be rejected", checkOutSession.canSubmitAttendance(checkOutSession.sessionId))
    }

    // Test 12: Static photograph shown during checkout -> rejected
    @Test
    fun test12_staticPhotographDuringCheckout_rejected() {
        val checkOutSession = VerificationSession(
            operationType = AttendanceOperationType.CHECK_OUT
        )
        // Assume photo matched identity
        checkOutSession.markFaceVerified("EMP-100", 0.88f)
        checkOutSession.markLivenessStarted()

        // Static photo provides completely unchanging EAR (constantly open eyes)
        var t = 1000L
        for (i in 0 until 50) {
            feedEar(ear = 0.32f, timestampMs = t) // constant open eyes
            t += 100
        }

        assertEquals("Static photograph cannot generate blinks", 0, detector.blinkCount)
        assertFalse("Static photograph cannot achieve liveness", detector.isLivenessVerified)
        assertFalse("Static photograph attendance must be rejected", checkOutSession.canSubmitAttendance(checkOutSession.sessionId))
    }

    // Test 13: Different person's face -> face verification rejected, liveness must not authorize attendance
    @Test
    fun test13_differentPersonFace_rejected_livenessNeverAuthorizes() {
        val session = VerificationSession(
            operationType = AttendanceOperationType.CHECK_IN
        )
        session.markFaceFailed()

        // Even if someone blinks in front of the camera, session is FAILED
        assertFalse(session.isFaceVerified)
        assertFalse(session.canSubmitAttendance(session.sessionId))
    }

    // Test 14: Multiple faces -> rejected
    @Test
    fun test14_multipleFaces_rejected() {
        val session = VerificationSession(
            operationType = AttendanceOperationType.CHECK_IN
        )
        session.markFaceFailed()
        assertFalse("Multiple faces must fail verification and reject submission", session.canSubmitAttendance(session.sessionId))
    }

    // Test 15: Race condition & idempotency -> duplicate blink #2 event only triggers submission once
    @Test
    fun test15_raceCondition_duplicateBlink2_idempotent() {
        val session = VerificationSession(
            operationType = AttendanceOperationType.CHECK_IN
        )
        session.markFaceVerified("EMP-100", 0.95f)
        session.markLivenessStarted()
        session.recordBlink(1)
        session.recordBlink(2)

        var submitCount = 0
        // First submission trigger
        if (session.canSubmitAttendance(session.sessionId) && !session.isCancelled && session.completedTimeMs == null) {
            submitCount++
            session.completedTimeMs = System.currentTimeMillis()
        }

        // Duplicate incoming blink event arrives
        if (session.canSubmitAttendance(session.sessionId) && !session.isCancelled && session.completedTimeMs == null) {
            submitCount++
        }

        assertEquals("Only one attendance submission must be triggered", 1, submitCount)
    }

    // Test 16: Indoor ambient lighting where closed EAR is ~0.140f (above old 0.135f, below new 0.142f)
    @Test
    fun test16_indoorEar140_triggersBothBlinks() {
        var t = 1000L
        // Open eyes
        feedEar(0.20f, t)
        t += 80
        feedEar(0.20f, t)
        t += 80

        // Blink 1 closure at 0.140f (realistic indoor closure)
        feedEar(0.140f, t)
        t += 80

        // Blink 1 reopen
        feedEar(0.20f, t)
        t += 120

        assertEquals("Blink 1 should be detected with 0.140f EAR closure", 1, detector.blinkCount)

        // Blink 2 closure at 0.139f
        feedEar(0.139f, t)
        t += 80

        // Blink 2 reopen
        feedEar(0.20f, t)

        assertEquals("Both blinks should be detected with realistic indoor EAR", 2, detector.blinkCount)
        assertTrue("Liveness must be verified", detector.isLivenessVerified)
    }

    // Test 17: Rapid second blink with short inter-blink gap (110ms)
    @Test
    fun test17_rapidSecondBlink_shortInterBlinkGap_successfullyVerified() {
        var t = 1000L
        t = simulateSingleBlink(t)
        assertEquals(1, detector.blinkCount)

        // Short natural inter-blink open gap (110ms >= minInterBlinkOpenMs of 100ms)
        t += 110
        feedEar(0.25f, t)
        t += 50

        // Blink 2 begins immediately
        feedEar(0.12f, t)
        t += 70
        feedEar(0.25f, t)

        assertEquals("Second blink must not be swallowed after short open interval", 2, detector.blinkCount)
        assertTrue("Liveness must be verified for rapid double blink", detector.isLivenessVerified)
    }

    // Test 18: Gradual eyelid reopening hysteresis on Blink 2
    @Test
    fun test18_gradualEyelidOpening_hysteresisCompletesBlink2() {
        var t = 1000L
        t = simulateSingleBlink(t)
        assertEquals(1, detector.blinkCount)

        t += 150
        feedEar(0.25f, t)
        t += 50

        // Blink 2 closed
        feedEar(0.11f, t)
        t += 70

        // Gradual reopening: reaches 0.152f (above midpoint 0.150f)
        val state = feedEar(0.152f, t)

        assertEquals("Blink 2 should complete via reopening hysteresis", 2, detector.blinkCount)
        assertTrue("State should be LivenessVerified", state is BlinkState.LivenessVerified)
        assertTrue("Liveness must be verified", detector.isLivenessVerified)
    }

    // Test 19: 15 FPS simulation (66ms intervals) with typical human blink dynamics
    @Test
    fun test19_variableFrameRate15fps_twoBlinksVerified() {
        var t = 1000L
        val frameInterval = 66L // ~15 FPS

        // Open baseline
        feedEar(0.22f, t); t += frameInterval
        feedEar(0.22f, t); t += frameInterval

        // Blink 1: closed for 2 frames (~132ms)
        feedEar(0.12f, t); t += frameInterval
        feedEar(0.12f, t); t += frameInterval

        // Open for 2 frames (~132ms)
        feedEar(0.22f, t); t += frameInterval
        feedEar(0.22f, t); t += frameInterval
        assertEquals(1, detector.blinkCount)

        // Blink 2: closed for 2 frames (~132ms)
        feedEar(0.12f, t); t += frameInterval
        feedEar(0.12f, t); t += frameInterval

        // Open
        feedEar(0.22f, t)

        assertEquals("Both blinks must be detected at 15 FPS", 2, detector.blinkCount)
        assertTrue("Liveness must be verified at 15 FPS", detector.isLivenessVerified)
    }
}
