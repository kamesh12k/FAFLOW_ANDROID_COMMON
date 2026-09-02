package com.governence.faflow.face

import android.graphics.Bitmap
import com.governence.faflow.face.model.FaceDetectionResult
import com.governence.faflow.face.model.FaceLandmarks
import com.governence.faflow.face.model.FaceMatchResult
import com.governence.faflow.face.model.LivenessResult

/**
 * Contract for mobile face detection (SCRFD / InsightFace compatible).
 */
interface FaceDetector {
    val isInitialized: Boolean
    val modelName: String

    suspend fun detectFaces(bitmap: Bitmap): List<FaceDetectionResult>
    fun release()
}

/**
 * Contract for 5-point and dense facial landmark extraction.
 */
interface FaceLandmarkDetector {
    suspend fun extractLandmarks(bitmap: Bitmap, detection: FaceDetectionResult): FaceLandmarks?
}

/**
 * Contract for Umeyama / Affine similarity transform face alignment to 112x112 canonical plane.
 */
interface FaceAligner {
    fun alignFace(bitmap: Bitmap, landmarks: FaceLandmarks): Bitmap
}

/**
 * Contract for deep feature vector extraction (ArcFace / MobileFaceNet).
 */
interface FaceEmbedder {
    val isInitialized: Boolean
    val modelName: String
    val modelVersion: String
    val embeddingDimension: Int

    suspend fun extractEmbedding(alignedFace: Bitmap): FloatArray
    fun release()
}

/**
 * Contract for vector similarity computation and threshold verification.
 */
interface FaceMatcher {
    var defaultThreshold: Float

    fun computeCosineSimilarity(embedding1: FloatArray, embedding2: FloatArray): Float
    fun findBestMatch(
        targetEmbedding: FloatArray,
        candidates: List<Pair<String, FloatArray>>,
        threshold: Float = defaultThreshold
    ): Pair<String, Float>?
}

/**
 * Contract for anti-spoofing and presentation attack rejection.
 */
interface LivenessDetector {
    val isInitialized: Boolean
    suspend fun verifyLiveness(bitmap: Bitmap, detection: FaceDetectionResult): LivenessResult
    fun release()
}

/**
 * High-level coordinator orchestrating the detection, alignment, embedding,
 * liveness, and matching pipeline.
 */
interface FaceEngine {
    val isReady: Boolean
    suspend fun processFrame(
        frameBitmap: Bitmap,
        registeredProfiles: List<Pair<String, FloatArray>>
    ): List<FaceMatchResult>
    suspend fun enrollFace(bitmap: Bitmap): Result<Pair<FloatArray, Bitmap>>
    fun release()
}
