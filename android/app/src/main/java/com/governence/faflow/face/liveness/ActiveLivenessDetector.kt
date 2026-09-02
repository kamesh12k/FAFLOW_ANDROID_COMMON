package com.governence.faflow.face.liveness

import com.governence.faflow.face.model.FaceLandmarks

/**
 * State evaluator for active interactive liveness challenges.
 */
class ActiveLivenessDetector(
    private val config: LivenessConfig = LivenessConfig.DEFAULT
) {

    private var activeChallenges = listOf<LivenessChallenge>()
    private var currentChallengeIndex = 0
    private var challengeStartTimeMs = 0L

    fun startNewSession(
        challenges: List<LivenessChallenge>,
        startTimeMs: Long = System.currentTimeMillis()
    ) {
        activeChallenges = challenges
        currentChallengeIndex = 0
        challengeStartTimeMs = startTimeMs
    }

    val currentChallenge: LivenessChallenge?
        get() = activeChallenges.getOrNull(currentChallengeIndex)

    val isSessionComplete: Boolean
        get() = activeChallenges.isNotEmpty() && currentChallengeIndex >= activeChallenges.size

    val progress: Float
        get() = if (activeChallenges.isEmpty()) 0f else currentChallengeIndex.toFloat() / activeChallenges.size.toFloat()

    /**
     * Evaluates a frame against the current active challenge.
     * Returns true if the current challenge was successfully met, advancing to next challenge.
     */
    fun processFrame(
        landmarks: FaceLandmarks,
        headPose: HeadPose,
        currentTimeMs: Long = System.currentTimeMillis()
    ): ChallengeEvaluationResult {
        val challenge = currentChallenge ?: return ChallengeEvaluationResult.SessionComplete

        val elapsed = currentTimeMs - challengeStartTimeMs
        if (elapsed > config.challengeTimeoutMs) {
            return ChallengeEvaluationResult.TimedOut(challenge)
        }

        val isMet = when (challenge) {
            LivenessChallenge.TURN_LEFT -> headPose.yawDegrees <= config.leftTurnYawDegrees
            LivenessChallenge.TURN_RIGHT -> headPose.yawDegrees >= config.rightTurnYawDegrees
            LivenessChallenge.LOOK_UP -> headPose.pitchDegrees <= config.lookUpPitchDegrees
            LivenessChallenge.LOOK_DOWN -> headPose.pitchDegrees >= config.lookDownPitchDegrees
            LivenessChallenge.BLINK -> false // Handled via BlinkDetector if dense landmarks present
        }

        if (isMet) {
            currentChallengeIndex++
            challengeStartTimeMs = currentTimeMs

            return if (currentChallengeIndex >= activeChallenges.size) {
                ChallengeEvaluationResult.SessionComplete
            } else {
                ChallengeEvaluationResult.Advanced(activeChallenges[currentChallengeIndex])
            }
        }

        val timeRemaining = (config.challengeTimeoutMs - elapsed).coerceAtLeast(0L)
        return ChallengeEvaluationResult.InProgress(
            challenge = challenge,
            progress = progress,
            timeRemainingMs = timeRemaining
        )
    }
}

sealed interface ChallengeEvaluationResult {
    data class InProgress(val challenge: LivenessChallenge, val progress: Float, val timeRemainingMs: Long) : ChallengeEvaluationResult
    data class Advanced(val nextChallenge: LivenessChallenge) : ChallengeEvaluationResult
    data object SessionComplete : ChallengeEvaluationResult
    data class TimedOut(val challenge: LivenessChallenge) : ChallengeEvaluationResult
}
