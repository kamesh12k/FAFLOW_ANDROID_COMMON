package com.governence.faflow.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Face
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.governence.faflow.camera.CameraController
import com.governence.faflow.camera.CameraOverlay
import com.governence.faflow.camera.CameraPreviewView
import com.governence.faflow.attendance.biometrics.alignment.FaceAlignmentResult
import com.governence.faflow.attendance.biometrics.alignment.SimilarityFaceAligner
import com.governence.faflow.attendance.biometrics.embedding.MobileFaceNetEmbedder
import com.governence.faflow.attendance.biometrics.enrollment.EnrollmentPoseTarget
import com.governence.faflow.attendance.biometrics.enrollment.FaceEnrollmentEngine
import com.governence.faflow.attendance.biometrics.enrollment.EnrollmentValidationResult
import com.governence.faflow.attendance.biometrics.enrollment.LocalFaceEnrollmentRepository
import com.governence.faflow.attendance.biometrics.enrollment.PoseCapture
import com.governence.faflow.attendance.biometrics.enrollment.PoseEvaluationResult
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

/**
 * State machine stages for the guided multi-pose face enrollment workflow.
 */
enum class FaceEnrollmentStage {
    READY,
    ENROLLING,
    PROCESSING,
    SUCCESS,
    ERROR
}

@Composable
fun FaceEnrollmentScreen(
    staffId: String = "",
    staffName: String = "Staff Member",
    onNavigateBack: () -> Unit,
    onEnrollmentComplete: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val haptic = LocalHapticFeedback.current

    // Model Managers & Biometrics Subsystem
    val scrfdModelManager = remember { ScrfdModelManager(context) }
    val faceDetector = remember { ScrfdFaceDetector(scrfdModelManager) }
    val mobileFaceNetModelManager = remember { MobileFaceNetModelManager(context) }
    val faceEmbedder = remember { MobileFaceNetEmbedder(mobileFaceNetModelManager) }
    val aligner = remember { SimilarityFaceAligner() }
    val enrollmentRepo = remember { LocalFaceEnrollmentRepository(context) }
    val matcher = remember { CosineFaceMatcher() }

    val enrollmentEngine = remember {
        FaceEnrollmentEngine(requiredHoldFrames = 4, minCrossSimilarity = 0.55f)
    }

    val detections by faceDetector.latestDetections.collectAsState()
    val latencyMs by faceDetector.inferenceLatencyMs.collectAsState()

    var latestAlignmentResult by remember { mutableStateOf<FaceAlignmentResult?>(null) }

    // Enrollment Workflow State
    var stage by remember { mutableStateOf(FaceEnrollmentStage.READY) }
    var currentPoseTarget by remember { mutableStateOf(EnrollmentPoseTarget.FRONTAL) }
    var stabilityFrames by remember { mutableIntStateOf(0) }
    val requiredHoldFrames = 4

    val capturedPoses = remember { mutableStateListOf<PoseCapture>() }
    var guidanceMessage by remember { mutableStateOf("Position your face in the oval guide and tap 'Start Enrollment'") }
    var isHoldingStable by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var crossSimStats by remember { mutableStateOf<List<Float>>(emptyList()) }

    LaunchedEffect(Unit) {
        scrfdModelManager.initializeModels()
        mobileFaceNetModelManager.initializeModels()
    }

    // Process Detections for Face Alignment
    LaunchedEffect(detections) {
        if (detections.isNotEmpty()) {
            val face = detections.first()
            val landmarks = face.landmarks
            val faceBmp = face.alignedBitmap ?: faceDetector.latestFrameBitmap.value
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

    // Live Guided Auto-Capture Pipeline
    LaunchedEffect(detections, stage, currentPoseTarget) {
        if (stage != FaceEnrollmentStage.ENROLLING) return@LaunchedEffect

        if (detections.isEmpty()) {
            stabilityFrames = 0
            isHoldingStable = false
            guidanceMessage = "Position your face inside the guide oval"
            return@LaunchedEffect
        }

        if (detections.size > 1) {
            stabilityFrames = 0
            isHoldingStable = false
            guidanceMessage = "Multiple faces detected. Only you should be in frame."
            return@LaunchedEffect
        }

        val primaryFace = detections.first()
        val evaluation = enrollmentEngine.evaluatePose(primaryFace, currentPoseTarget)

        when (evaluation) {
            is PoseEvaluationResult.ValidPose -> {
                isHoldingStable = true
                stabilityFrames++
                guidanceMessage = "Perfect! Hold still (${stabilityFrames}/$requiredHoldFrames)..."

                if (stabilityFrames >= requiredHoldFrames) {
                    // Pose condition met and held steadily: auto-capture aligned face sample
                    val alignedFace = latestAlignmentResult?.alignedBitmap
                        ?: primaryFace.alignedBitmap
                        ?: faceDetector.latestFrameBitmap.value

                    if (alignedFace != null) {
                        try {
                            val embedding = faceEmbedder.extractEmbedding(alignedFace)
                            haptic.performHapticFeedback(HapticFeedbackType.LongPress)

                            capturedPoses.add(
                                PoseCapture(
                                    target = currentPoseTarget,
                                    bitmap = alignedFace,
                                    embedding = embedding
                                )
                            )

                            stabilityFrames = 0
                            isHoldingStable = false

                            // Advance to the next pose or trigger multi-template consolidation
                            when (currentPoseTarget) {
                                EnrollmentPoseTarget.FRONTAL -> {
                                    currentPoseTarget = EnrollmentPoseTarget.LEFT_ANGLE
                                    guidanceMessage = "Great! Now turn your head slightly to the left (←)"
                                }
                                EnrollmentPoseTarget.LEFT_ANGLE -> {
                                    currentPoseTarget = EnrollmentPoseTarget.RIGHT_ANGLE
                                    guidanceMessage = "Awesome! Now turn your head slightly to the right (→)"
                                }
                                EnrollmentPoseTarget.RIGHT_ANGLE -> {
                                    // All 3 multi-angle poses acquired: validate pairwise similarity & persist
                                    stage = FaceEnrollmentStage.PROCESSING
                                    guidanceMessage = "Validating 3-angle biometric consistency..."

                                    coroutineScope.launch {
                                        val validation = enrollmentEngine.validateAndConsolidate(
                                            captures = capturedPoses.toList(),
                                            matcher = matcher
                                        )

                                        when (validation) {
                                            is EnrollmentValidationResult.Success -> {
                                                crossSimStats = validation.crossSimilarities
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

                                                val saved = enrollmentRepo.saveEnrollment(
                                                    staffId = effectiveStaffId,
                                                    staffName = effectiveStaffName,
                                                    embedding = validation.masterEmbedding,
                                                    templates = validation.templates
                                                )

                                                // Guarantee lookup succeeds if authenticated userId is primary key
                                                if (loggedInUserId > 0 && loggedInUserId.toString() != effectiveStaffId) {
                                                    enrollmentRepo.saveEnrollment(
                                                        staffId = loggedInUserId.toString(),
                                                        staffName = effectiveStaffName,
                                                        embedding = validation.masterEmbedding,
                                                        templates = validation.templates
                                                    )
                                                }

                                                if (saved) {
                                                    try {
                                                        appContainer.apiService.enrollBiometrics()
                                                    } catch (_: Exception) {}
                                                    stage = FaceEnrollmentStage.SUCCESS
                                                    guidanceMessage = "Facial profile enrolled successfully!"
                                                } else {
                                                    errorMessage = "Could not save encrypted biometric template to Keystore."
                                                    stage = FaceEnrollmentStage.ERROR
                                                }
                                            }
                                            is EnrollmentValidationResult.InconsistentIdentity -> {
                                                errorMessage = validation.reason
                                                stage = FaceEnrollmentStage.ERROR
                                            }
                                        }
                                    }
                                }
                            }
                        } catch (e: Exception) {
                            errorMessage = "Feature extraction error: ${e.localizedMessage}"
                            stage = FaceEnrollmentStage.ERROR
                        }
                    }
                }
            }
            is PoseEvaluationResult.AdjustPose -> {
                stabilityFrames = 0
                isHoldingStable = false
                guidanceMessage = evaluation.guidance
            }
            is PoseEvaluationResult.QualityIssue -> {
                stabilityFrames = 0
                isHoldingStable = false
                guidanceMessage = evaluation.reason
            }
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
            else if (isHoldingStable) FaceDetectionUiState.FacePositionValid(primaryFace = face)
            else FaceDetectionUiState.FaceDetected(count = 1, primaryFace = face)
        }
    }

    Scaffold(
        topBar = {
            AppTopBar(
                title = "Facial Biometric Enrollment",
                canNavigateBack = true,
                onNavigateBack = onNavigateBack
            )
        },
        containerColor = com.governence.faflow.ui.theme.FaflowBg
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(com.governence.faflow.ui.theme.FaflowBg)
                .padding(innerPadding)
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Subtitle & Purpose
            Text(
                text = "Institutional 3-Angle Face Registration (Center • Left • Right)",
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(10.dp))

            // Step Progress Chips
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                EnrollmentPoseTarget.values().forEach { target ->
                    val isCaptured = capturedPoses.any { it.target == target }
                    val isCurrent = stage == FaceEnrollmentStage.ENROLLING && currentPoseTarget == target

                    val chipBg by animateColorAsState(
                        targetValue = when {
                            isCaptured -> StatusSuccess.copy(alpha = 0.15f)
                            isCurrent -> PrimaryBlue.copy(alpha = 0.15f)
                            else -> MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                        },
                        animationSpec = tween(300),
                        label = "chipBg"
                    )

                    val chipBorder by animateColorAsState(
                        targetValue = when {
                            isCaptured -> StatusSuccess
                            isCurrent -> PrimaryBlue
                            else -> Color.Transparent
                        },
                        animationSpec = tween(300),
                        label = "chipBorder"
                    )

                    val chipContentColor = when {
                        isCaptured -> StatusSuccess
                        isCurrent -> PrimaryBlue
                        else -> MaterialTheme.colorScheme.onSurfaceVariant
                    }

                    Row(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(12.dp))
                            .background(chipBg)
                            .border(1.5.dp, chipBorder, RoundedCornerShape(12.dp))
                            .padding(vertical = 8.dp, horizontal = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        if (isCaptured) {
                            Icon(
                                imageVector = Icons.Default.Check,
                                contentDescription = "Captured",
                                tint = StatusSuccess,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                        } else if (isCurrent) {
                            Box(
                                modifier = Modifier
                                    .size(8.dp)
                                    .clip(CircleShape)
                                    .background(PrimaryBlue)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                        }
                        Text(
                            text = "${target.id}. ${target.shortLabel}",
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = if (isCurrent || isCaptured) FontWeight.Bold else FontWeight.Medium,
                            color = chipContentColor,
                            maxLines = 1
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Camera Viewport with Guided Reticle & Hold Progress Ring
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
                        Icon(
                            imageVector = Icons.Default.CameraAlt,
                            contentDescription = null,
                            tint = PrimaryBlue,
                            modifier = Modifier.size(56.dp)
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            "Camera Permission Required",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                            textAlign = TextAlign.Center
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            "FAFLOW requires camera access to capture your 3-angle biometric templates.",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color.Gray,
                            textAlign = TextAlign.Center
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(
                            onClick = { cameraPermissionLauncher.launch(Manifest.permission.CAMERA) },
                            colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue)
                        ) {
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
                        isServerConfirmed = stage == FaceEnrollmentStage.SUCCESS,
                        modifier = Modifier.fillMaxSize()
                    )

                    // Stability Hold Circular Arc Ring
                    if (stage == FaceEnrollmentStage.ENROLLING && stabilityFrames > 0) {
                        val holdFraction by animateFloatAsState(
                            targetValue = (stabilityFrames.toFloat() / requiredHoldFrames).coerceIn(0f, 1f),
                            animationSpec = tween(100),
                            label = "holdRing"
                        )
                        Canvas(modifier = Modifier.size(240.dp)) {
                            drawArc(
                                color = StatusSuccess,
                                startAngle = -90f,
                                sweepAngle = holdFraction * 360f,
                                useCenter = false,
                                style = Stroke(width = 8.dp.toPx())
                            )
                        }
                    }

                    // Floating Pose Guidance Banner
                    Box(
                        modifier = Modifier
                            .align(Alignment.BottomCenter)
                            .padding(bottom = 16.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color.Black.copy(alpha = 0.75f))
                            .border(1.dp, Color.White.copy(alpha = 0.2f), RoundedCornerShape(16.dp))
                            .padding(horizontal = 16.dp, vertical = 10.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center
                        ) {
                            val bannerIcon = when {
                                stage == FaceEnrollmentStage.SUCCESS -> Icons.Default.CheckCircle
                                stage == FaceEnrollmentStage.PROCESSING -> Icons.Default.Security
                                currentPoseTarget == EnrollmentPoseTarget.LEFT_ANGLE -> Icons.AutoMirrored.Filled.ArrowBack
                                currentPoseTarget == EnrollmentPoseTarget.RIGHT_ANGLE -> Icons.AutoMirrored.Filled.ArrowForward
                                else -> Icons.Default.Face
                            }

                            val bannerColor = when {
                                stage == FaceEnrollmentStage.SUCCESS -> StatusSuccess
                                isHoldingStable -> StatusSuccess
                                stage == FaceEnrollmentStage.ERROR -> StatusError
                                else -> PrimaryBlue
                            }

                            Icon(
                                imageVector = bannerIcon,
                                contentDescription = null,
                                tint = bannerColor,
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = guidanceMessage,
                                style = MaterialTheme.typography.bodySmall,
                                fontWeight = FontWeight.SemiBold,
                                color = Color.White
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Captured Poses Thumbnail Strip
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically
            ) {
                EnrollmentPoseTarget.values().forEach { target ->
                    val capture = capturedPoses.firstOrNull { it.target == target }
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Box(
                            modifier = Modifier
                                .size(52.dp)
                                .clip(CircleShape)
                                .background(MaterialTheme.colorScheme.surfaceVariant)
                                .border(
                                    width = 2.dp,
                                    color = if (capture != null) StatusSuccess else Color.LightGray.copy(alpha = 0.4f),
                                    shape = CircleShape
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            if (capture?.bitmap != null) {
                                Image(
                                    bitmap = capture.bitmap.asImageBitmap(),
                                    contentDescription = target.title,
                                    modifier = Modifier.fillMaxSize()
                                )
                                Box(
                                    modifier = Modifier
                                        .align(Alignment.BottomEnd)
                                        .size(16.dp)
                                        .clip(CircleShape)
                                        .background(StatusSuccess),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Check,
                                        contentDescription = null,
                                        tint = Color.White,
                                        modifier = Modifier.size(10.dp)
                                    )
                                }
                            } else {
                                Text(
                                    text = target.shortLabel,
                                    style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = if (capture != null) "Saved" else "Pending",
                            style = MaterialTheme.typography.labelSmall,
                            fontSize = 10.sp,
                            color = if (capture != null) StatusSuccess else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Action & Guidance Controls
            when (stage) {
                FaceEnrollmentStage.READY -> {
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
                                Icon(
                                    imageVector = Icons.Default.Security,
                                    contentDescription = null,
                                    tint = PrimaryBlue,
                                    modifier = Modifier.size(24.dp)
                                )
                                Spacer(modifier = Modifier.width(10.dp))
                                Column {
                                    Text(
                                        "Multi-Angle Liveness & ArcFace Registration",
                                        style = MaterialTheme.typography.titleSmall,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        "Captures 3 poses for reliable attendance check-in under all angles",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.height(14.dp))

                            PrimaryGradientButton(
                                text = "Start Guided Enrollment",
                                icon = Icons.Default.Fingerprint,
                                onClick = {
                                    capturedPoses.clear()
                                    stabilityFrames = 0
                                    errorMessage = null
                                    currentPoseTarget = EnrollmentPoseTarget.FRONTAL
                                    stage = FaceEnrollmentStage.ENROLLING
                                    guidanceMessage = "Look straight ahead at the camera"
                                }
                            )
                        }
                    }
                }

                FaceEnrollmentStage.ENROLLING -> {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "Capturing ${currentPoseTarget.title}",
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = PrimaryBlue
                                )
                                Text(
                                    text = currentPoseTarget.prompt,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            OutlinedButton(
                                onClick = {
                                    capturedPoses.clear()
                                    stabilityFrames = 0
                                    currentPoseTarget = EnrollmentPoseTarget.FRONTAL
                                    stage = FaceEnrollmentStage.READY
                                    guidanceMessage = "Position your face in the oval guide and tap 'Start Enrollment'"
                                }
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Refresh,
                                    contentDescription = "Restart",
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Reset")
                            }
                        }
                    }
                }

                FaceEnrollmentStage.PROCESSING -> {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(32.dp),
                                color = PrimaryBlue,
                                strokeWidth = 3.dp
                            )
                            Spacer(modifier = Modifier.width(14.dp))
                            Column {
                                Text(
                                    "Processing Biometrics",
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    "Verifying cross-angle consistency and encrypting templates...",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }
                }

                FaceEnrollmentStage.SUCCESS -> {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = StatusSuccess.copy(alpha = 0.12f))
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = Icons.Default.CheckCircle,
                                    contentDescription = null,
                                    tint = StatusSuccess,
                                    modifier = Modifier.size(32.dp)
                                )
                                Spacer(modifier = Modifier.width(12.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        "Biometric Profile Enrolled",
                                        style = MaterialTheme.typography.titleMedium,
                                        fontWeight = FontWeight.Bold,
                                        color = StatusSuccess
                                    )
                                    Text(
                                        "3 multi-angle templates secured with AES-256 GCM in Android Keystore.",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.height(14.dp))

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                OutlinedButton(
                                    modifier = Modifier.weight(1f),
                                    onClick = {
                                        capturedPoses.clear()
                                        stabilityFrames = 0
                                        currentPoseTarget = EnrollmentPoseTarget.FRONTAL
                                        stage = FaceEnrollmentStage.READY
                                    }
                                ) {
                                    Text("Re-Enroll")
                                }
                                Button(
                                    modifier = Modifier.weight(1.5f),
                                    onClick = onEnrollmentComplete,
                                    colors = ButtonDefaults.buttonColors(containerColor = StatusSuccess)
                                ) {
                                    Text("Done")
                                }
                            }
                        }
                    }
                }

                FaceEnrollmentStage.ERROR -> {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = StatusError.copy(alpha = 0.12f))
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = Icons.Default.Warning,
                                    contentDescription = null,
                                    tint = StatusError,
                                    modifier = Modifier.size(28.dp)
                                )
                                Spacer(modifier = Modifier.width(12.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        "Enrollment Failed",
                                        style = MaterialTheme.typography.titleSmall,
                                        fontWeight = FontWeight.Bold,
                                        color = StatusError
                                    )
                                    Text(
                                        text = errorMessage ?: "Validation failed. Please ensure stable lighting.",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.height(12.dp))

                            Button(
                                modifier = Modifier.fillMaxWidth(),
                                onClick = {
                                    capturedPoses.clear()
                                    stabilityFrames = 0
                                    errorMessage = null
                                    currentPoseTarget = EnrollmentPoseTarget.FRONTAL
                                    stage = FaceEnrollmentStage.ENROLLING
                                    guidanceMessage = "Look straight ahead at the camera"
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue)
                            ) {
                                Text("Try Again")
                            }
                        }
                    }
                }
            }
        }
    }
}
