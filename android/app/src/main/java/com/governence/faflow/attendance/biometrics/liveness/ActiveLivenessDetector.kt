package com.governence.faflow.attendance.biometrics.liveness

import com.governence.faflow.attendance.biometrics.model.FaceLandmarks

/**
 * State evaluator for active interactive liveness challenges.
 *
 * Gesture detection uses DELTA from a captured baseline pose — not absolute thresholds.
 * "Did the head MOVE in the requested direction?" — not "Is the head at a fixed absolute angle?"
 *
 * Temporal debounce: a gesture must be sustained for GESTURE_CONFIRM_FRAMES consecutive
 * valid frames before it is accepted. A single noisy frame cannot advance or reset a challenge.
 */
class ActiveLivenessDetector(
    private val config: LivenessConfig = LivenessConfig.DEFAULT
) {

    private var activeChallenges = listOf<LivenessChallenge>()
    private var currentChallengeIndex = 0
    private var challengeStartTimeMs = 0L

    // Baseline pose captured at session start — all gestures are delta-relative to this
    private var baselineYaw = 0f
    private var baselinePitch = 0f
    @Suppress("unused") private var baselineRoll = 0f

    // Temporal debounce counter — decays on miss, increments on hit, advances only at GESTURE_CONFIRM_FRAMES
    private var gestureConfirmFrameCount = 0
    private val GESTURE_CONFIRM_FRAMES get() = config.gestureConfirmFrames

    fun startNewSession(
        challenges: List<LivenessChallenge>,
        baselinePose: HeadPose = HeadPose(),
        startTimeMs: Long = System.currentTimeMillis()
    ) {
        activeChallenges = challenges
        currentChallengeIndex = 0
        challengeStartTimeMs = startTimeMs
        gestureConfirmFrameCount = 0
        baselineYaw = baselinePose.yawDegrees
        baselinePitch = baselinePose.pitchDegrees
        baselineRoll = baselinePose.rollDegrees
    }

    val currentChallenge: LivenessChallenge?
        get() = activeChallenges.getOrNull(currentChallengeIndex)

    val isSessionComplete: Boolean
        get() = activeChallenges.isNotEmpty() && currentChallengeIndex >= activeChallenges.size

    val progress: Float
        get() = if (activeChallenges.isEmpty()) 0f else currentChallengeIndex.toFloat() / activeChallenges.size.toFloat()

    fun processFrame(
        landmarks: FaceLandmarks,
        headPose: HeadPose,
        currentTimeMs: Long = System.currentTimeMillis()
    ): ChallengeEvaluationResult {
        val challenge = currentChallenge ?: return ChallengeEvaluationResult.SessionComplete

        val elapsed = currentTimeMs - challengeStartTimeMs
        if (elapsed > config.challengeTimeoutMs) {
            gestureConfirmFrameCount = 0
            return ChallengeEvaluationResult.TimedOut(challenge)
        }

        // Delta from baseline — detects actual head MOVEMENT, not absolute pose
        val yawDelta = headPose.yawDegrees - baselineYaw
        val pitchDelta = headPose.pitchDegrees - baselinePitch

        val isMet = when (challenge) {
            LivenessChallenge.TURN_RIGHT -> yawDelta >= config.rightTurnYawDegrees
            LivenessChallenge.TURN_LEFT  -> yawDelta <= config.leftTurnYawDegrees
            LivenessChallenge.LOOK_UP    -> pitchDelta <= config.lookUpPitchDegrees
            LivenessChallenge.LOOK_DOWN  -> pitchDelta >= config.lookDownPitchDegrees
            LivenessChallenge.BLINK      -> false
        }

        val timeRemaining = (config.challengeTimeoutMs - elapsed).coerceAtLeast(0L)

        return if (isMet) {
            gestureConfirmFrameCount++
            if (gestureConfirmFrameCount >= GESTURE_CONFIRM_FRAMES) {
                gestureConfirmFrameCount = 0
                currentChallengeIndex++
                challengeStartTimeMs = currentTimeMs
                if (currentChallengeIndex >= activeChallenges.size) {
                    ChallengeEvaluationResult.SessionComplete
                } else {
                    ChallengeEvaluationResult.Advanced(activeChallenges[currentChallengeIndex])
                }
            } else {
                ChallengeEvaluationResult.InProgress(challenge, progress, timeRemaining,
                    gestureConfirmFrameCount.toFloat() / GESTURE_CONFIRM_FRAMES)
            }
        } else {
            // Decay — one bad frame reduces but does NOT reset the confirmation counter
            gestureConfirmFrameCount = (gestureConfirmFrameCount - 1).coerceAtLeast(0)
            ChallengeEvaluationResult.InProgress(challenge, progress, timeRemaining,
                gestureConfirmFrameCount.toFloat() / GESTURE_CONFIRM_FRAMES)
        }
    }
}

sealed interface ChallengeEvaluationResult {
    data class InProgress(
        val challenge: LivenessChallenge,
        val progress: Float,
        val timeRemainingMs: Long,
        val gestureConfirmProgress: Float = 0f
    ) : ChallengeEvaluationResult
    data class Advanced(val nextChallenge: LivenessChallenge) : ChallengeEvaluationResult
    data object SessionComplete : ChallengeEvaluationResult
    data class TimedOut(val challenge: LivenessChallenge) : ChallengeEvaluationResult
}

