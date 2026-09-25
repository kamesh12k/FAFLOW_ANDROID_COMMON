package com.governence.faflow.attendance.biometrics.enrollment

import android.graphics.Bitmap
import com.governence.faflow.attendance.biometrics.FaceMatcher
import com.governence.faflow.attendance.biometrics.matching.CosineFaceMatcher
import com.governence.faflow.attendance.biometrics.model.FaceBox
import com.governence.faflow.attendance.biometrics.model.FaceDetectionResult
import com.governence.faflow.attendance.biometrics.model.FaceQuality
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import kotlin.math.sqrt

class FaceEnrollmentEngineTest {

    private lateinit var engine: FaceEnrollmentEngine
    private lateinit var matcher: FaceMatcher

    @Before
    fun setUp() {
        engine = FaceEnrollmentEngine(
            requiredHoldFrames = 4,
            minCrossSimilarity = 0.55f
        )
        matcher = CosineFaceMatcher()
    }

    private fun createFaceDetection(
        yaw: Float,
        roll: Float = 0f,
        brightness: Float = 0.8f
    ): FaceDetectionResult {
        return FaceDetectionResult(
            trackingId = 1,
            boundingBox = FaceBox(100f, 100f, 300f, 350f),
            confidence = 0.95f,
            quality = FaceQuality(
                brightnessScore = brightness,
                sharpnessScore = 0.90f,
                yawAngle = yaw,
                rollAngle = roll,
                isFrontal = Math.abs(yaw) <= 15f
            )
        )
    }

    private fun createNormalizedEmbedding(seed: Float): FloatArray {
        val emb = FloatArray(512) { i -> (seed + i * 0.01f) }
        var sumSquares = 0.0
        for (v in emb) sumSquares += (v * v).toDouble()
        val norm = sqrt(sumSquares).toFloat()
        for (i in emb.indices) emb[i] /= norm
        return emb
    }

    @Test
    fun testFrontalPoseEvaluationValid() {
        val detection = createFaceDetection(yaw = 2.0f)
        val result = engine.evaluatePose(detection, EnrollmentPoseTarget.FRONTAL)
        assertTrue(result is PoseEvaluationResult.ValidPose)
    }

    @Test
    fun testFrontalPoseEvaluationYawTooLarge() {
        val detection = createFaceDetection(yaw = 18.0f)
        val result = engine.evaluatePose(detection, EnrollmentPoseTarget.FRONTAL)
        assertTrue(result is PoseEvaluationResult.AdjustPose)
        val adjust = result as PoseEvaluationResult.AdjustPose
        assertTrue(adjust.guidance.contains("Turn slightly right"))
    }

    @Test
    fun testLeftAnglePoseEvaluationValid() {
        val detection = createFaceDetection(yaw = 16.0f)
        val result = engine.evaluatePose(detection, EnrollmentPoseTarget.LEFT_ANGLE)
        assertTrue(result is PoseEvaluationResult.ValidPose)
    }

    @Test
    fun testLeftAnglePoseEvaluationNeedsMoreTurn() {
        val detection = createFaceDetection(yaw = 3.0f)
        val result = engine.evaluatePose(detection, EnrollmentPoseTarget.LEFT_ANGLE)
        assertTrue(result is PoseEvaluationResult.AdjustPose)
    }

    @Test
    fun testRightAnglePoseEvaluationValid() {
        val detection = createFaceDetection(yaw = -16.0f)
        val result = engine.evaluatePose(detection, EnrollmentPoseTarget.RIGHT_ANGLE)
        assertTrue(result is PoseEvaluationResult.ValidPose)
    }

    @Test
    fun testLightingTooDarkRejected() {
        val detection = createFaceDetection(yaw = 0f, brightness = 0.15f)
        val result = engine.evaluatePose(detection, EnrollmentPoseTarget.FRONTAL)
        assertTrue(result is PoseEvaluationResult.QualityIssue)
        val issue = result as PoseEvaluationResult.QualityIssue
        assertTrue(issue.reason.contains("Lighting is too dark"))
    }

    @Test
    fun testRollTiltRejected() {
        val detection = createFaceDetection(yaw = 0f, roll = 30f)
        val result = engine.evaluatePose(detection, EnrollmentPoseTarget.FRONTAL)
        assertTrue(result is PoseEvaluationResult.AdjustPose)
        val adjust = result as PoseEvaluationResult.AdjustPose
        assertTrue(adjust.guidance.contains("level"))
    }

    @Test
    fun testConsolidateAllThreeConsistentPosesSucceeds() {
        val e1 = createNormalizedEmbedding(1.0f)
        val e2 = createNormalizedEmbedding(1.02f)
        val e3 = createNormalizedEmbedding(0.98f)

        val captures = listOf(
            PoseCapture(EnrollmentPoseTarget.FRONTAL, null, e1),
            PoseCapture(EnrollmentPoseTarget.LEFT_ANGLE, null, e2),
            PoseCapture(EnrollmentPoseTarget.RIGHT_ANGLE, null, e3)
        )

        val result = engine.validateAndConsolidate(captures, matcher)
        assertTrue("Consistent samples should produce Success", result is EnrollmentValidationResult.Success)
        val success = result as EnrollmentValidationResult.Success
        assertEquals(3, success.templates.size)
        assertEquals(512, success.masterEmbedding.size)

        // Verify master embedding is unit normalized
        var sumSquares = 0.0
        for (v in success.masterEmbedding) sumSquares += (v * v).toDouble()
        assertEquals(1.0f, sqrt(sumSquares).toFloat(), 0.01f)
    }

    @Test
    fun testConsolidateInconsistentPosesRejected() {
        // Person A
        val e1 = createNormalizedEmbedding(1.0f)
        val e2 = createNormalizedEmbedding(1.02f)
        // Completely different vector (person B)
        val e3 = FloatArray(512) { i -> if (i % 2 == 0) -0.5f else 0.5f }
        var sumSq = 0.0
        for (v in e3) sumSq += (v * v).toDouble()
        val norm = sqrt(sumSq).toFloat()
        for (i in e3.indices) e3[i] /= norm

        val captures = listOf(
            PoseCapture(EnrollmentPoseTarget.FRONTAL, null, e1),
            PoseCapture(EnrollmentPoseTarget.LEFT_ANGLE, null, e2),
            PoseCapture(EnrollmentPoseTarget.RIGHT_ANGLE, null, e3)
        )

        val result = engine.validateAndConsolidate(captures, matcher)
        assertTrue("Inconsistent samples should produce InconsistentIdentity", result is EnrollmentValidationResult.InconsistentIdentity)
    }

    @Test
    fun testComputeMasterEmbeddingDimensionAndNorm() {
        val e1 = createNormalizedEmbedding(1.0f)
        val e2 = createNormalizedEmbedding(2.0f)
        val master = engine.computeMasterEmbedding(listOf(e1, e2))
        assertEquals(512, master.size)

        var sumSq = 0.0
        for (v in master) sumSq += (v * v).toDouble()
        assertEquals(1.0f, sqrt(sumSq).toFloat(), 0.01f)
    }
}
