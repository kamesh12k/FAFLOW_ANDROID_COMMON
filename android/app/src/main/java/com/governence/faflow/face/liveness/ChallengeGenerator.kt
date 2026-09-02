package com.governence.faflow.face.liveness

import java.util.Random

/**
 * Generates dynamic, randomized active liveness challenge sequences.
 */
class ChallengeGenerator(
    private val random: Random = Random()
) {

    private val headPoseChallenges = listOf(
        LivenessChallenge.TURN_LEFT,
        LivenessChallenge.TURN_RIGHT,
        LivenessChallenge.LOOK_UP,
        LivenessChallenge.LOOK_DOWN
    )

    /**
     * Generates a randomized list of challenges of length [count].
     * Guarantees no two consecutive identical challenges.
     */
    fun generateChallenges(count: Int = 2): List<LivenessChallenge> {
        val result = ArrayList<LivenessChallenge>(count)
        var lastChallenge: LivenessChallenge? = null

        for (i in 0 until count) {
            val available = headPoseChallenges.filter { it != lastChallenge }
            val next = available[random.nextInt(available.size)]
            result.add(next)
            lastChallenge = next
        }

        return result
    }
}
