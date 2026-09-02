package com.governence.faflow.face.liveness

import com.governence.faflow.face.model.FaceLandmarks
import kotlin.math.atan2

/**
 * Geometric 3D head pose estimator analyzing yaw, pitch, and roll angles from 5-point facial landmarks.
 */
object HeadPoseAnalyzer {

    /**
     * Estimates head pose angles (degrees) from 5-point facial landmarks.
     */
    fun estimateHeadPose(landmarks: FaceLandmarks): HeadPose {
        val le = landmarks.leftEye
        val re = landmarks.rightEye
        val nose = landmarks.nose
        val lm = landmarks.leftMouth
        val rm = landmarks.rightMouth

        // 1. Roll Angle (tilt around Z-axis)
        val eyeDx = (re.x - le.x).toDouble()
        val eyeDy = (re.y - le.y).toDouble()
        val rollRad = atan2(eyeDy, eyeDx)
        val rollDeg = Math.toDegrees(rollRad).toFloat()

        // 2. Yaw Angle (horizontal turn around Y-axis)
        val distLeftEyeToNose = nose.x - le.x
        val distNoseToRightEye = re.x - nose.x
        val totalEyeSpan = distLeftEyeToNose + distNoseToRightEye

        val yawDeg = if (totalEyeSpan > 1e-4f) {
            val yawRatio = (distLeftEyeToNose - distNoseToRightEye) / totalEyeSpan
            (yawRatio * 90.0f).coerceIn(-90.0f, 90.0f)
        } else {
            0.0f
        }

        // 3. Pitch Angle (vertical tilt around X-axis)
        val eyeMidY = (le.y + re.y) / 2f
        val mouthMidY = (lm.y + rm.y) / 2f
        val upperFaceDist = nose.y - eyeMidY
        val lowerFaceDist = mouthMidY - nose.y
        val totalVerticalSpan = upperFaceDist + lowerFaceDist

        val pitchDeg = if (totalVerticalSpan > 1e-4f) {
            val pitchRatio = (upperFaceDist - lowerFaceDist) / totalVerticalSpan
            // Negative pitch = looking up, Positive pitch = looking down
            (pitchRatio * 60.0f).coerceIn(-60.0f, 60.0f)
        } else {
            0.0f
        }

        return HeadPose(
            yawDegrees = yawDeg,
            pitchDegrees = pitchDeg,
            rollDegrees = rollDeg
        )
    }
}
