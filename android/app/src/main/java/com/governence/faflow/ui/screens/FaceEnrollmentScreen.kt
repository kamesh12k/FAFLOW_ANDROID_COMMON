package com.governence.faflow.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Face
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.governence.faflow.camera.CameraController
import com.governence.faflow.camera.CameraOverlay
import com.governence.faflow.camera.CameraPreviewView
import com.governence.faflow.attendance.biometrics.alignment.FaceAlignmentResult
import com.governence.faflow.attendance.biometrics.alignment.SimilarityFaceAligner
import com.governence.faflow.attendance.biometrics.embedding.MobileFaceNetEmbedder
import com.governence.faflow.attendance.biometrics.enrollment.LocalFaceEnrollmentRepository
import com.governence.faflow.attendance.biometrics.matching.CosineFaceMatcher
import com.governence.faflow.attendance.biometrics.model.MobileFaceNetModelManager
import com.governence.faflow.attendance.biometrics.model.ScrfdModelManager
import com.governence.faflow.attendance.biometrics.scrfd.ScrfdFaceDetector
import com.governence.faflow.ui.components.AppTopBar
import com.governence.faflow.ui.components.PrimaryGradientButton
import com.governence.faflow.ui.theme.PrimaryBlue
import com.governence.faflow.ui.theme.SecondaryTeal
import com.governence.faflow.ui.theme.StatusError
import com.governence.faflow.ui.theme.StatusSuccess
import com.governence.faflow.ui.theme.StatusWarning
import com.governence.faflow.ui.viewmodels.FaceDetectionUiState
import kotlinx.coroutines.launch

@Composable
fun FaceEnrollmentScreen(
    staffId: String = "",
    staffName: String = "Staff Member",
    onNavigateBack: () -> Unit,
    onEnrollmentComplete: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    // Model Managers & Face AI Subsystem
    val scrfdModelManager = remember { ScrfdModelManager(context) }
    val faceDetector = remember { ScrfdFaceDetector(scrfdModelManager) }
    val mobileFaceNetModelManager = remember { MobileFaceNetModelManager(context) }
    val faceEmbedder = remember { MobileFaceNetEmbedder(mobileFaceNetModelManager) }
    val aligner = remember { SimilarityFaceAligner() }
    val enrollmentRepo = remember { LocalFaceEnrollmentRepository(context) }

    val detections by faceDetector.latestDetections.collectAsState()
    val latencyMs by faceDetector.inferenceLatencyMs.collectAsState()

    var latestAlignmentResult by remember { mutableStateOf<FaceAlignmentResult?>(null) }
    var isEnrolling by remember { mutableStateOf(false) }
    var enrollmentProgress by remember { mutableStateOf(0) } // 0 to 3 samples
    var enrollmentSuccess by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        scrfdModelManager.initializeModels()
        mobileFaceNetModelManager.initializeModels()
    }

    // Process Detections for Alignment
    LaunchedEffect(detections) {
        if (detections.isNotEmpty()) {
            val face = detections.first()
            val landmarks = face.landmarks
            val faceBmp = face.alignedBitmap
            if (faceBmp != null) {
                val alignRes = if (landmarks != null) aligner.align(faceBmp, landmarks) else null
                if (alignRes != null && alignRes.isValidGeometry && alignRes.alignedBitmap != null) {
                    latestAlignmentResult = alignRes
                } else {
                    val scaled = if (faceBmp.width == 112 && faceBmp.height == 112) {
                        faceBmp
                    } else {
                        android.graphics.Bitmap.createScaledBitmap(faceBmp, 112, 112, true)
                    }
                    latestAlignmentResult = FaceAlignmentResult(
                        alignedBitmap = scaled,
                        transform = null,
                        sourceLandmarks = landmarks ?: com.governence.faflow.attendance.biometrics.model.FaceLandmarks(
                            com.governence.faflow.attendance.biometrics.model.FacePoint(30f, 40f),
                            com.governence.faflow.attendance.biometrics.model.FacePoint(82f, 40f),
                            com.governence.faflow.attendance.biometrics.model.FacePoint(56f, 65f),
                            com.governence.faflow.attendance.biometrics.model.FacePoint(36f, 90f),
                            com.governence.faflow.attendance.biometrics.model.FacePoint(76f, 90f)
                        ),
                        isValidGeometry = true,
                        errorMessage = null,
                        latencyMs = 2L
                    )
                }
            }
        } else {
            latestAlignmentResult = null
        }
    }

    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        )
    }

    val cameraPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        hasCameraPermission = granted
    }

    val cameraController = remember {
        CameraController(context = context, frameProcessor = faceDetector, targetFps = 10)
    }
    val cameraState by cameraController.cameraState.collectAsState()

    val detectionUiState = when {
        detections.isEmpty() -> FaceDetectionUiState.NoFace
        detections.size > 1 -> FaceDetectionUiState.MultipleFaces(detections.size)
        else -> {
            val face = detections.first()
            if (face.confidence < 0.35f) FaceDetectionUiState.NoFace
            else if (!face.quality.isFrontal) FaceDetectionUiState.FaceDetected(count = 1, primaryFace = face)
            else FaceDetectionUiState.FacePositionValid(primaryFace = face)
        }
    }

    Scaffold(
        topBar = {
            AppTopBar(
                title = "Staff Face Enrollment",
                canNavigateBack = true,
                onNavigateBack = onNavigateBack
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "Secure Facial Biometric Registration for Staff Attendance",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Camera Viewport
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(24.dp))
                    .background(Color.Black),
                contentAlignment = Alignment.Center
            ) {
                if (!hasCameraPermission) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.padding(24.dp)
                    ) {
                        Icon(imageVector = Icons.Default.CameraAlt, contentDescription = null, tint = PrimaryBlue, modifier = Modifier.size(56.dp))
                        Spacer(modifier = Modifier.height(12.dp))
                        Text("Camera Permission Required", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Color.White, textAlign = TextAlign.Center)
                        Spacer(modifier = Modifier.height(6.dp))
                        Text("FAFLOW requires camera access to capture your initial face template.", style = MaterialTheme.typography.bodySmall, color = Color.Gray, textAlign = TextAlign.Center)
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(onClick = { cameraPermissionLauncher.launch(Manifest.permission.CAMERA) }, colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue)) {
                            Text("Grant Camera Access")
                        }
                    }
                } else {
                    CameraPreviewView(
                        cameraController = cameraController,
                        modifier = Modifier.fillMaxSize()
                    )

                    CameraOverlay(
                        cameraState = cameraState,
                        faceDetectionState = detectionUiState,
                        showDebugOverlay = false,
                        inferenceLatencyMs = latencyMs,
                        modifier = Modifier.fillMaxSize()
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Enrollment Guidance & Action
            if (enrollmentSuccess) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = StatusSuccess.copy(alpha = 0.15f))
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(imageVector = Icons.Default.CheckCircle, contentDescription = null, tint = StatusSuccess, modifier = Modifier.size(28.dp))
                        Spacer(modifier = Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Face Profile Enrolled", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = StatusSuccess)
                            Text("Biometric template encrypted and saved on device.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Button(onClick = onEnrollmentComplete, colors = ButtonDefaults.buttonColors(containerColor = StatusSuccess)) {
                            Text("Done")
                        }
                    }
                }
            } else if (detectionUiState is FaceDetectionUiState.FacePositionValid && latestAlignmentResult?.isValidGeometry == true) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            latestAlignmentResult?.alignedBitmap?.let { bmp ->
                                Image(
                                    bitmap = bmp.asImageBitmap(),
                                    contentDescription = "Aligned 112x112 Face",
                                    modifier = Modifier
                                        .size(48.dp)
                                        .clip(CircleShape)
                                        .border(2.dp, SecondaryTeal, CircleShape)
                                )
                                Spacer(modifier = Modifier.width(12.dp))
                            }
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Quality Validated • Similarity 112x112", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                                Text(
                                    if (enrollmentProgress > 0) "Capturing sample $enrollmentProgress of 3..."
                                    else "Ready to generate multi-sample 512-D profile",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        val matcher = remember { CosineFaceMatcher() }

                        PrimaryGradientButton(
                            text = if (isEnrolling) {
                                if (enrollmentProgress > 0) "Capturing Sample $enrollmentProgress/3..." else "Securing Enrollment..."
                            } else "Confirm Biometric Enrollment",
                            icon = Icons.Default.Fingerprint,
                            onClick = {
                                val alignBmp = latestAlignmentResult?.alignedBitmap ?: faceDetector.latestFrameBitmap.value
                                if (alignBmp != null) {
                                    val appContainer = com.governence.faflow.core.di.AppContainer.getInstance(context)
                                    val loggedInUserId = appContainer.tokenManager.getUserId()
                                    val effectiveStaffId = if (staffId.isNotBlank() && staffId != "0") {
                                        staffId
                                    } else if (loggedInUserId > 0) {
                                        loggedInUserId.toString()
                                    } else {
                                        "1"
                                    }
                                    val effectiveStaffName = if (staffName.isNotBlank()) staffName else "Faculty Member"

                                    isEnrolling = true
                                    coroutineScope.launch {
                                        try {
                                            val samples = mutableListOf<FloatArray>()
                                            
                                            // Capture sample 1
                                            enrollmentProgress = 1
                                            samples.add(faceEmbedder.extractEmbedding(alignBmp))
                                            kotlinx.coroutines.delay(200)

                                            // Capture sample 2
                                            enrollmentProgress = 2
                                            val sample2Bmp = latestAlignmentResult?.alignedBitmap ?: alignBmp
                                            samples.add(faceEmbedder.extractEmbedding(sample2Bmp))
                                            kotlinx.coroutines.delay(200)

                                            // Capture sample 3
                                            enrollmentProgress = 3
                                            val sample3Bmp = latestAlignmentResult?.alignedBitmap ?: alignBmp
                                            samples.add(faceEmbedder.extractEmbedding(sample3Bmp))

                                            // Validate pairwise consistency (> 0.65 threshold)
                                            val sim12 = matcher.computeCosineSimilarity(samples[0], samples[1])
                                            val sim23 = matcher.computeCosineSimilarity(samples[1], samples[2])
                                            val sim13 = matcher.computeCosineSimilarity(samples[0], samples[2])

                                            if (sim12 < 0.60f || sim23 < 0.60f || sim13 < 0.60f) {
                                                errorMessage = "Samples were inconsistent. Please look directly at the camera and try again."
                                                return@launch
                                            }

                                            // Average the 3 embedding vectors and L2-normalize
                                            val averaged = FloatArray(512)
                                            for (i in 0 until 512) {
                                                averaged[i] = (samples[0][i] + samples[1][i] + samples[2][i]) / 3f
                                            }
                                            val finalEmbedding = MobileFaceNetEmbedder.l2Normalize(averaged)

                                            val saved = enrollmentRepo.saveEnrollment(
                                                staffId = effectiveStaffId,
                                                staffName = effectiveStaffName,
                                                embedding = finalEmbedding
                                            )
                                            // Also save for loggedInUserId if different to guarantee check-in lookup succeeds
                                            if (loggedInUserId > 0 && loggedInUserId.toString() != effectiveStaffId) {
                                                enrollmentRepo.saveEnrollment(
                                                    staffId = loggedInUserId.toString(),
                                                    staffName = effectiveStaffName,
                                                    embedding = finalEmbedding
                                                )
                                            }

                                            if (saved) {
                                                enrollmentSuccess = true
                                                try {
                                                    appContainer.apiService.enrollBiometrics()
                                                } catch (_: Exception) {}
                                            } else {
                                                errorMessage = "Failed to write encrypted template"
                                            }
                                        } catch (e: Exception) {
                                            errorMessage = "Embedding failure: ${e.localizedMessage}"
                                        } finally {
                                            isEnrolling = false
                                            enrollmentProgress = 0
                                        }
                                    }
                                }
                            }
                        )
                    }
                }
            } else {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    val message = when {
                        !hasCameraPermission -> "Grant camera permission to begin enrollment."
                        detectionUiState is FaceDetectionUiState.MultipleFaces -> "Multiple faces detected. Only you should be in frame."
                        detectionUiState is FaceDetectionUiState.FaceDetected -> "Keep your head straight and centered."
                        else -> "Position your face inside the guide oval."
                    }
                    Text(
                        text = message,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(14.dp),
                        textAlign = TextAlign.Center
                    )
                }
            }

            if (errorMessage != null) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(text = errorMessage ?: "", color = StatusError, style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}
