package com.governence.faflow.face.matching

import com.governence.faflow.face.FaceMatcher
import com.governence.faflow.face.embedding.FaceRecognitionConfig
import kotlin.math.max
import kotlin.math.sqrt

/**
 * Result of 1-to-1 staff identity face verification.
 */
data class FaceVerificationResult(
    val isMatched: Boolean,
    val similarityScore: Float,
    val thresholdUsed: Float,
    val modelVersion: String,
    val reason: String
)

/**
 * Robust cosine similarity face matcher.
 */
class CosineFaceMatcher(
    private val config: FaceRecognitionConfig = FaceRecognitionConfig.DEFAULT
) : FaceMatcher {

    override var defaultThreshold: Float = config.similarityThreshold

    override fun computeCosineSimilarity(embedding1: FloatArray, embedding2: FloatArray): Float {
        if (embedding1.size != embedding2.size || embedding1.isEmpty()) {
            return 0.0f
        }

        var dotProduct = 0.0
        var normA = 0.0
        var normB = 0.0

        for (i in embedding1.indices) {
            val a = embedding1[i]
            val b = embedding2[i]

            if (a.isNaN() || a.isInfinite() || b.isNaN() || b.isInfinite()) {
                return 0.0f
            }

            dotProduct += (a * b).toDouble()
            normA += (a * a).toDouble()
            normB += (b * b).toDouble()
        }

        val denominator = sqrt(normA) * sqrt(normB)
        if (denominator <= 1e-12) {
            return 0.0f
        }

        val similarity = (dotProduct / denominator).toFloat()
        // Clamp numerical precision to [-1.0, 1.0]
        return similarity.coerceIn(-1.0f, 1.0f)
    }

    override fun findBestMatch(
        targetEmbedding: FloatArray,
        candidates: List<Pair<String, FloatArray>>,
        threshold: Float
    ): Pair<String, Float>? {
        var bestMatch: Pair<String, Float>? = null
        var highestScore = threshold

        for ((id, candidateEmbedding) in candidates) {
            val score = computeCosineSimilarity(targetEmbedding, candidateEmbedding)
            if (score >= highestScore) {
                highestScore = score
                bestMatch = Pair(id, score)
            }
        }

        return bestMatch
    }

    /**
     * Performs 1-to-1 verification against an enrolled staff template.
     */
    fun verifyOneToOne(
        liveEmbedding: FloatArray,
        enrolledEmbedding: FloatArray,
        threshold: Float = defaultThreshold
    ): FaceVerificationResult {
        if (liveEmbedding.size != enrolledEmbedding.size) {
            return FaceVerificationResult(
                isMatched = false,
                similarityScore = 0f,
                thresholdUsed = threshold,
                modelVersion = config.modelVersion,
                reason = "Dimension mismatch: live (${liveEmbedding.size}) vs enrolled (${enrolledEmbedding.size})"
            )
        }

        val similarity = computeCosineSimilarity(liveEmbedding, enrolledEmbedding)
        val isMatched = similarity >= threshold

        val reason = if (isMatched) {
            "Identity verified successfully (similarity $similarity >= threshold $threshold)"
        } else {
            "Verification failed: similarity $similarity below threshold $threshold"
        }

        return FaceVerificationResult(
            isMatched = isMatched,
            similarityScore = similarity,
            thresholdUsed = threshold,
            modelVersion = config.modelVersion,
            reason = reason
        )
    }
}
