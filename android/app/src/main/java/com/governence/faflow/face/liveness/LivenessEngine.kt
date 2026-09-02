package com.governence.faflow.face.liveness

import com.governence.faflow.face.model.FaceDetectionResult
import com.governence.faflow.face.model.SpoofType
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * High-performance liveness and presentation attack defense engine.
 */
class LivenessEngine(
    private val config: LivenessConfig = LivenessConfig.DEFAULT,
    private val motionAnalyzer: MotionAnalyzer = MotionAnalyzer(config),
    private val challengeGenerator: ChallengeGenerator = ChallengeGenerator(),
    private val activeDetector: ActiveLivenessDetector = ActiveLivenessDetector(config),
    private val antiSpoofModel: AntiSpoofModel = DefaultAntiSpoofModel()
) {

    private val _livenessState = MutableStateFlow<LivenessState>(LivenessState.WaitingForFace)
    val livenessState: StateFlow<LivenessState> = _livenessState.asStateFlow()

    private var isSessionActive = false

    fun startSession() {
        motionAnalyzer.clear()
        val challenges = challengeGenerator.generateChallenges(config.challengeCount)
        activeDetector.startNewSession(challenges)
        isSessionActive = true
        _livenessState.value = LivenessState.PreparingChallenge(challenges.first())
    }

    fun reset() {
        motionAnalyzer.clear()
        isSessionActive = false
        _livenessState.value = LivenessState.WaitingForFace
    }

    /**
     * Processes a live frame detection result through the multi-layer liveness pipeline.
     */
    fun processFrame(
        detection: FaceDetectionResult?,
        currentTimeMs: Long = System.currentTimeMillis()
    ): LivenessState {
        if (detection == null) {
            _livenessState.value = LivenessState.WaitingForFace
            return _livenessState.value
        }

        val landmarks = detection.landmarks
        if (landmarks == null) {
            _livenessState.value = LivenessState.FaceNotSuitable("Landmarks unavailable")
            return _livenessState.value
        }

        // 1. Calculate Head Pose
        val headPose = HeadPoseAnalyzer.estimateHeadPose(landmarks)

        // 2. Track Temporal Observation & Passive Motion Defense
        val observation = FaceObservation(
            timestamp = currentTimeMs,
            boundingBox = detection.boundingBox,
            landmarks = landmarks,
            headPose = headPose
        )
        motionAnalyzer.addObservation(observation)

        val motionRisk = motionAnalyzer.evaluateMotionRisk()
        if (motionRisk == PresentationAttackRisk.HIGH && motionAnalyzer.observationCount >= config.minimumObservations) {
            _livenessState.value = LivenessState.SpoofSuspected(
                spoofType = SpoofType.PRINT_ATTACK,
                reason = "Suspicious static landmark pattern detected (potential 2D photo attack)"
            )
            return _livenessState.value
        }

        if (!isSessionActive) {
            startSession()
        }

        // 3. Evaluate Active Challenge Progress
        val evalResult = activeDetector.processFrame(landmarks, headPose, currentTimeMs)
        val newState = when (evalResult) {
            is ChallengeEvaluationResult.InProgress -> {
                LivenessState.ChallengeActive(
                    challenge = evalResult.challenge,
                    progress = evalResult.progress,
                    instructions = evalResult.challenge.prompt,
                    timeRemainingMs = evalResult.timeRemainingMs
                )
            }
            is ChallengeEvaluationResult.Advanced -> {
                LivenessState.ChallengeActive(
                    challenge = evalResult.nextChallenge,
                    progress = activeDetector.progress,
                    instructions = evalResult.nextChallenge.prompt,
                    timeRemainingMs = config.challengeTimeoutMs
                )
            }
            is ChallengeEvaluationResult.SessionComplete -> {
                isSessionActive = false
                LivenessState.Passed(
                    livenessScore = 0.95f,
                    risk = PresentationAttackRisk.LOW
                )
            }
            is ChallengeEvaluationResult.TimedOut -> {
                isSessionActive = false
                LivenessState.TimedOut(evalResult.challenge)
            }
        }

        _livenessState.value = newState
        return newState
    }
}
