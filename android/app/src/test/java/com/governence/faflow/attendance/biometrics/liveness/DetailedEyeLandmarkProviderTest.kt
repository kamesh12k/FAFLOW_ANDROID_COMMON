package com.governence.faflow.attendance.biometrics.liveness

import com.governence.faflow.attendance.biometrics.model.FaceBox
import com.governence.faflow.attendance.biometrics.model.FaceDetectionResult
import com.governence.faflow.attendance.biometrics.model.FaceLandmarks
import com.governence.faflow.attendance.biometrics.model.FacePoint
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class DetailedEyeLandmarkProviderTest {

    private lateinit var provider: DetailedEyeLandmarkProvider

    @Before
    fun setUp() {
        provider = DetailedEyeLandmarkProvider(
            closedThreshold = 0.135f,
            openThreshold = 0.165f
        )
    }

    @Test
    fun testOpenEyeProducesHighEarCrossingOpenThreshold() {
        // Mock open eye: center pixels dark (low luma e.g. 30), lateral sclera bright (e.g. 230), lid intermediate (e.g. 170)
        val openEyeReader = PixelReader { x, y ->
            val dx = if (x < 240) Math.abs(x - 180) else Math.abs(x - 300)
            val dy = Math.abs(y - 250)

            val luma = if (dx < 8 && dy < 6) {
                30 // Dark pupil/iris
            } else if (dy < 6) {
                230 // White sclera flanks
            } else {
                170 // Eyelids
            }
            // Pack into ARGB color
            (0xFF shl 24) or (luma shl 16) or (luma shl 8) or luma
        }

        val leftEyeCenter = FacePoint(180f, 250f)
        val rightEyeCenter = FacePoint(300f, 250f)

        val detection = FaceDetectionResult(
            boundingBox = FaceBox(100f, 180f, 380f, 480f),
            confidence = 0.95f,
            landmarks = FaceLandmarks(
                leftEye = leftEyeCenter,
                rightEye = rightEyeCenter,
                nose = FacePoint(240f, 320f),
                leftMouth = FacePoint(190f, 400f),
                rightMouth = FacePoint(290f, 400f)
            )
        )

        val result = provider.computeEyeStateFromReader(
            reader = openEyeReader,
            imageWidth = 480,
            imageHeight = 640,
            face = detection
        )
        assertNotNull("Result should not be null", result)
        assertTrue(
            "Open eye EAR (${result!!.ear}) should be >= openThreshold (0.165)",
            result.ear >= 0.165f
        )
        assertTrue("isEyesOpen should be true", result.isEyesOpen)
    }

    @Test
    fun testClosedEyeProducesLowEarCrossingClosedThreshold() {
        // Mock closed eye: continuous uniform skin tone everywhere (e.g. 175)
        val closedEyeReader = PixelReader { _, _ ->
            val luma = 175
            (0xFF shl 24) or (luma shl 16) or (luma shl 8) or luma
        }

        val leftEyeCenter = FacePoint(180f, 250f)
        val rightEyeCenter = FacePoint(300f, 250f)

        val detection = FaceDetectionResult(
            boundingBox = FaceBox(100f, 180f, 380f, 480f),
            confidence = 0.95f,
            landmarks = FaceLandmarks(
                leftEye = leftEyeCenter,
                rightEye = rightEyeCenter,
                nose = FacePoint(240f, 320f),
                leftMouth = FacePoint(190f, 400f),
                rightMouth = FacePoint(290f, 400f)
            )
        )

        val result = provider.computeEyeStateFromReader(
            reader = closedEyeReader,
            imageWidth = 480,
            imageHeight = 640,
            face = detection
        )
        assertNotNull("Result should not be null", result)
        assertTrue(
            "Closed eye EAR (${result!!.ear}) should be <= closedThreshold (0.135)",
            result.ear <= 0.135f
        )
        assertTrue("isEyesClosed should be true", result.isEyesClosed)
    }
}
