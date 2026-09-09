package com.governence.faflow.attendance.biometrics.recognition

import android.graphics.Bitmap
import com.governence.faflow.attendance.biometrics.FaceEmbedder
import com.governence.faflow.attendance.biometrics.FaceMatcher
import com.governence.faflow.attendance.biometrics.alignment.FaceAligner
import com.governence.faflow.attendance.biometrics.alignment.SimilarityFaceAligner
import com.governence.faflow.attendance.biometrics.embedding.FaceRecognitionConfig
import com.governence.faflow.attendance.biometrics.enrollment.FaceEnrollmentRepository
import com.governence.faflow.attendance.biometrics.liveness.BiometricVerificationResult
import com.governence.faflow.attendance.biometrics.liveness.LivenessEngine
import com.governence.faflow.attendance.biometrics.liveness.LivenessState
import com.governence.faflow.attendance.biometrics.liveness.PresentationAttackRisk
import com.governence.faflow.attendance.biometrics.matching.CosineFaceMatcher
import com.governence.faflow.attendance.biometrics.model.FaceDetectionResult
import com.governence.faflow.attendance.biometrics.model.StaffBiometricVerificationState
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * End-to-end on-device biometric verification engine.
 * Orchestrates: Quality Check -> 5-Point Similarity Alignment -> MobileFaceNet Embedding -> Cosine Verification -> Presentation Attack Defense.
 */
class FaceRecognitionEngine(
    private val aligner: FaceAligner = SimilarityFaceAligner(),
    private val embedder: FaceEmbedder,
    private val matcher: FaceMatcher = CosineFaceMatcher(),
    private val enrollmentRepository: FaceEnrollmentRepository,
    val livenessEngine: LivenessEngine = LivenessEngine(),
    private val config: FaceRecognitionConfig = FaceRecognitionConfig.DEFAULT
) {

    /**
     * Executes 1-to-1 biometric identity verification against enrolled staff template.
     */
    suspend fun verifyStaffIdentity(
        sourceBitmap: Bitmap,
        detection: FaceDetectionResult,
        staffId: String
    ): StaffBiometricVerificationState = withContext(Dispatchers.Default) {
        // 1. Verify Local Staff Enrollment Exists
        val enrollment = enrollmentRepository.getEnrollment(staffId)
        if (enrollment == null) {
            android.util.Log.w("FAFLOW_BIOMETRICS", "No enrollment template found for staffId=$staffId")
            return@withContext StaffBiometricVerificationState.NoEnrollment(staffId)
        }

        // 2. Validate Detection Landmarks
        val landmarks = detection.landmarks
        if (landmarks == null) {
            android.util.Log.w("FAFLOW_BIOMETRICS", "Landmarks missing from detection result for staffId=$staffId")
            return@withContext StaffBiometricVerificationState.VerificationFailed(
                similarity = 0f,
                threshold = config.similarityThreshold,
                reason = "Facial landmarks missing from detection result"
            )
        }

        // 3. 5-Point Canonical Face Alignment
        val alignmentResult = aligner.align(sourceBitmap, landmarks)
        val alignedFace = if (alignmentResult.isValidGeometry && alignmentResult.alignedBitmap != null) {
            alignmentResult.alignedBitmap
        } else if (sourceBitmap.width == 112 && sourceBitmap.height == 112) {
            sourceBitmap
        } else {
            android.graphics.Bitmap.createScaledBitmap(sourceBitmap, 112, 112, true)
        }

        // 4. ArcFace Feature Embedding Extraction
        val liveEmbedding = try {
            embedder.extractEmbedding(alignedFace)
        } catch (e: Exception) {
            android.util.Log.e("FAFLOW_BIOMETRICS", "Feature extractor error: ${e.message}", e)
            return@withContext StaffBiometricVerificationState.Unavailable(
                reason = "Feature extractor error: ${e.localizedMessage}"
            )
        }

        // 5. Cosine Similarity Verification
        val similarity = matcher.computeCosineSimilarity(liveEmbedding, enrollment.embedding)
        val isVerified = similarity >= config.similarityThreshold

        android.util.Log.i(
            "FAFLOW_BIOMETRICS",
            "verifyStaffIdentity: staffId=$staffId, similarity=${"%.4f".format(similarity)}, threshold=${config.similarityThreshold}, verified=$isVerified"
        )

        return@withContext if (isVerified) {
            StaffBiometricVerificationState.Verified(
                staffId = staffId,
                similarity = similarity,
                threshold = config.similarityThreshold
            )
        } else {
            StaffBiometricVerificationState.VerificationFailed(
                similarity = similarity,
                threshold = config.similarityThreshold,
                reason = "Biometric mismatch: similarity score ${"%.2f".format(similarity)} below threshold ${config.similarityThreshold}"
            )
        }
    }

    /**
     * Returns true only when the ONNX ArcFace embedder session is fully loaded and ready.
     * Settling must not trigger until this is true — otherwise the deterministic fallback
     * embedder produces vectors incompatible with enrolled ArcFace embeddings (near-zero similarity).
     */
    fun isEmbedderReady(): Boolean = embedder.isInitialized

    /**
     * Synthesizes full biometric verification result combining identity match with liveness result.
     */
    fun evaluateBiometricAuthorization(
        staffId: String,
        identityState: StaffBiometricVerificationState,
        livenessState: LivenessState
    ): BiometricVerificationResult {
        val (isIdentityValid, similarity) = when (identityState) {
            is StaffBiometricVerificationState.Verified -> Pair(true, identityState.similarity)
            is StaffBiometricVerificationState.VerificationFailed -> Pair(false, identityState.similarity)
            else -> Pair(false, 0f)
        }

        val (isLivenessValid, livenessScore, risk) = when (livenessState) {
            is LivenessState.Passed -> Triple(true, livenessState.livenessScore, livenessState.risk)
            is LivenessState.SpoofSuspected -> Triple(false, 0f, PresentationAttackRisk.HIGH)
            is LivenessState.TimedOut, is LivenessState.Failed -> Triple(false, 0f, PresentationAttackRisk.MEDIUM)
            else -> Triple(false, 0f, PresentationAttackRisk.LOW)
        }

        return BiometricVerificationResult(
            staffId = staffId,
            identityVerified = isIdentityValid,
            similarityScore = similarity,
            livenessVerified = isLivenessValid,
            livenessScore = livenessScore,
            presentationAttackRisk = risk
        )
    }

    /**
     * Enrolls a new staff biometric profile with explicit user confirmation.
     */
    suspend fun enrollStaff(
        sourceBitmap: Bitmap,
        detection: FaceDetectionResult,
        staffId: String,
        staffName: String
    ): Result<FloatArray> = withContext(Dispatchers.Default) {
        val landmarks = detection.landmarks
            ?: return@withContext Result.failure(IllegalArgumentException("Detection landmarks are missing"))

        val alignmentResult = aligner.align(sourceBitmap, landmarks)
        if (!alignmentResult.isValidGeometry || alignmentResult.alignedBitmap == null) {
            return@withContext Result.failure(
                IllegalArgumentException(alignmentResult.errorMessage ?: "Landmark alignment failed")
            )
        }

        val embedding = try {
            embedder.extractEmbedding(alignmentResult.alignedBitmap)
        } catch (e: Exception) {
            return@withContext Result.failure(e)
        }

        val saved = enrollmentRepository.saveEnrollment(
            staffId = staffId,
            staffName = staffName,
            embedding = embedding,
            modelVersion = config.modelVersion,
            alignmentVersion = config.alignmentVersion
        )

        if (saved) {
            Result.success(embedding)
        } else {
            Result.failure(IllegalStateException("Failed to securely store biometric enrollment"))
        }
    }
}
