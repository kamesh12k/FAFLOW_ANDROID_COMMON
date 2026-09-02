package com.governence.faflow.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccessTime
import androidx.compose.material.icons.filled.BugReport
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.CloudDone
import androidx.compose.material.icons.filled.CloudUpload
import androidx.compose.material.icons.filled.GpsFixed
import androidx.compose.material.icons.filled.GpsNotFixed
import androidx.compose.material.icons.filled.GpsOff
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.governence.faflow.attendance.data.AttendanceLocalQueue
import com.governence.faflow.attendance.data.AttendanceRepository
import com.governence.faflow.camera.CameraController
import com.governence.faflow.camera.CameraOverlay
import com.governence.faflow.camera.CameraPreviewView
import com.governence.faflow.face.alignment.UmeyamaFaceAligner
import com.governence.faflow.face.embedding.ArcFaceEmbedder
import com.governence.faflow.face.enrollment.LocalFaceEnrollmentRepository
import com.governence.faflow.face.liveness.LivenessEngine
import com.governence.faflow.face.matching.CosineFaceMatcher
import com.governence.faflow.face.model.ArcFaceModelManager
import com.governence.faflow.face.model.ScrfdModelManager
import com.governence.faflow.face.recognition.FaceRecognitionEngine
import com.governence.faflow.face.scrfd.ScrfdFaceDetector
import com.governence.faflow.location.LocationVerificationResult
import com.governence.faflow.ui.components.AppTopBar
import com.governence.faflow.ui.theme.PrimaryBlue
import com.governence.faflow.ui.theme.SecondaryTeal
import com.governence.faflow.ui.theme.StatusError
import com.governence.faflow.ui.theme.StatusSuccess
import com.governence.faflow.ui.theme.StatusWarning
import com.governence.faflow.ui.viewmodels.AttendanceEligibilityState
import com.governence.faflow.ui.viewmodels.AttendanceViewModel

@Composable
fun AttendanceCheckInOutScreen(
    viewModel: AttendanceViewModel,
    staffId: String = "42",
    onNavigateBack: () -> Unit,
    onAttendanceSuccess: () -> Unit
) {
    val context = LocalContext.current
    val uiState by viewModel.uiState.collectAsState()
    val verificationResult by viewModel.verificationResult.collectAsState()
    val faceDetectionState by viewModel.faceDetectionState.collectAsState()
    val identityState by viewModel.identityVerificationState.collectAsState()
    val livenessState by viewModel.livenessState.collectAsState()
    val eligibilityState by viewModel.attendanceEligibilityState.collectAsState()
    val isLocationVerified = viewModel.isLocationVerifiedForAttendance()

    // Model Managers & Face AI Subsystem
    val scrfdModelManager = remember { ScrfdModelManager(context) }
    val faceDetector = remember { ScrfdFaceDetector(scrfdModelManager) }
    val arcFaceModelManager = remember { ArcFaceModelManager(context) }
    val faceEmbedder = remember { ArcFaceEmbedder(arcFaceModelManager) }
    val aligner = remember { UmeyamaFaceAligner() }
    val enrollmentRepo = remember { LocalFaceEnrollmentRepository(context) }
    val matcher = remember { CosineFaceMatcher() }
    val livenessEngine = remember { LivenessEngine() }

    val recognitionEngine = remember {
        FaceRecognitionEngine(
            aligner = aligner,
            embedder = faceEmbedder,
            matcher = matcher,
            enrollmentRepository = enrollmentRepo,
            livenessEngine = livenessEngine
        )
    }

    val latencyMs by faceDetector.inferenceLatencyMs.collectAsState()
    val detections by faceDetector.latestDetections.collectAsState()

    LaunchedEffect(Unit) {
        scrfdModelManager.initializeModels()
        arcFaceModelManager.initializeModels()
    }

    LaunchedEffect(detections) {
        val face = detections.firstOrNull()
        viewModel.updateDetections(
            detections = detections,
            sourceBitmap = face?.alignedBitmap,
            staffId = staffId
        )
    }

    // Runtime Camera Permission Handling
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

    Scaffold(
        topBar = {
            AppTopBar(
                title = if (uiState.isCheckingIn) "Staff Shift Check-In" else "Staff Shift Check-Out",
                canNavigateBack = true,
                onNavigateBack = onNavigateBack,
                actions = {
                    IconButton(onClick = { viewModel.toggleDebugOverlay() }) {
                        Icon(
                            imageVector = Icons.Default.BugReport,
                            contentDescription = "Diagnostics",
                            tint = if (uiState.isDebugOverlayVisible) StatusSuccess else Color.White
                        )
                    }
                }
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
            // Live Geofence Status Banner
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(
                    containerColor = when (verificationResult) {
                        is LocationVerificationResult.InsideGeofence -> Color(0x1A10B981)
                        is LocationVerificationResult.Boundary -> Color(0x1A10B981)
                        is LocationVerificationResult.MockLocationDetected -> Color(0x1AEF4444)
                        is LocationVerificationResult.AccuracyInsufficient -> Color(0x1AF59E0B)
                        else -> MaterialTheme.colorScheme.surface
                    }
                )
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    val (icon, tint) = when (verificationResult) {
                        is LocationVerificationResult.InsideGeofence -> Pair(Icons.Default.GpsFixed, StatusSuccess)
                        is LocationVerificationResult.Boundary -> Pair(Icons.Default.GpsFixed, StatusSuccess)
                        is LocationVerificationResult.OutsideAllGeofences -> Pair(Icons.Default.LocationOn, StatusWarning)
                        is LocationVerificationResult.AccuracyInsufficient -> Pair(Icons.Default.GpsNotFixed, StatusWarning)
                        is LocationVerificationResult.MockLocationDetected -> Pair(Icons.Default.Warning, StatusError)
                        else -> Pair(Icons.Default.GpsOff, StatusError)
                    }

                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(tint.copy(alpha = 0.15f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(imageVector = icon, contentDescription = null, tint = tint, modifier = Modifier.size(20.dp))
                    }

                    Spacer(modifier = Modifier.width(12.dp))

                    Column(modifier = Modifier.weight(1f)) {
                        val titleText = when (val res = verificationResult) {
                            is LocationVerificationResult.InsideGeofence -> "Campus Verified: ${res.geofenceName}"
                            is LocationVerificationResult.Boundary -> "Boundary Verified: ${res.geofenceName}"
                            is LocationVerificationResult.OutsideAllGeofences -> "Outside Campus (${res.distanceToNearestMeters.toInt()}m away)"
                            is LocationVerificationResult.AccuracyInsufficient -> "GPS Accuracy Low (±${res.currentAccuracyMeters.toInt()}m)"
                            is LocationVerificationResult.MockLocationDetected -> "Fake GPS Spoofing Blocked"
                            is LocationVerificationResult.StaleLocation -> "Stale GPS Fix"
                            is LocationVerificationResult.LocationServicesDisabled -> "Location Services Disabled"
                            is LocationVerificationResult.PermissionDenied -> "Location Permission Required"
                            is LocationVerificationResult.PermissionPermanentlyDenied -> "Location Permission Blocked"
                            is LocationVerificationResult.LocationUnavailable -> "Location Unavailable"
                            is LocationVerificationResult.NoActiveGeofences -> "No Active Geofences"
                            LocationVerificationResult.Loading -> "Acquiring High-Accuracy GPS Fix..."
                        }

                        Text(
                            text = titleText,
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold,
                            color = tint
                        )

                        val subText = when (val res = verificationResult) {
                            is LocationVerificationResult.InsideGeofence -> "Accuracy: ±${res.accuracyMeters.toInt()}m • Server Geofence: Active"
                            is LocationVerificationResult.Boundary -> "Within tolerance margin (±${res.accuracyMeters.toInt()}m)"
                            is LocationVerificationResult.MockLocationDetected -> "Anti-spoofing engine rejected mock location"
                            else -> "Move inside institutional boundaries to activate camera"
                        }

                        Text(
                            text = subText,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Camera Viewport & Overlay
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(24.dp))
                    .background(Color.Black),
                contentAlignment = Alignment.Center
            ) {
                if (!isLocationVerified) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.padding(24.dp)
                    ) {
                        Icon(imageVector = Icons.Default.LocationOn, contentDescription = null, tint = StatusWarning, modifier = Modifier.size(56.dp))
                        Spacer(modifier = Modifier.height(12.dp))
                        Text("Campus Location Verification Required", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Color.White, textAlign = TextAlign.Center)
                        Spacer(modifier = Modifier.height(6.dp))
                        Text("Camera pipeline is active only when you are physically inside an authorized campus geofence perimeter.", style = MaterialTheme.typography.bodySmall, color = Color.Gray, textAlign = TextAlign.Center)
                    }
                } else if (!hasCameraPermission) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.padding(24.dp)
                    ) {
                        Icon(imageVector = Icons.Default.CameraAlt, contentDescription = null, tint = PrimaryBlue, modifier = Modifier.size(56.dp))
                        Spacer(modifier = Modifier.height(12.dp))
                        Text("Camera Permission Required", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Color.White, textAlign = TextAlign.Center)
                        Spacer(modifier = Modifier.height(6.dp))
                        Text("FAFLOW requires front-camera access to capture your facial attendance frame securely on device.", style = MaterialTheme.typography.bodySmall, color = Color.Gray, textAlign = TextAlign.Center)
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
                        faceDetectionState = faceDetectionState,
                        livenessState = livenessState,
                        showDebugOverlay = uiState.isDebugOverlayVisible,
                        inferenceLatencyMs = latencyMs,
                        modifier = Modifier.fillMaxSize()
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Action Status Card & Check-In / Check-Out Trigger Button
            when (val elig = eligibilityState) {
                is AttendanceEligibilityState.VerifiedAndReady -> {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = StatusSuccess.copy(alpha = 0.15f))
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(imageVector = Icons.Default.CheckCircle, contentDescription = null, tint = StatusSuccess, modifier = Modifier.size(24.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "Verified: Identity (${(elig.similarity * 100).toInt()}%) • Liveness (${(elig.livenessScore * 100).toInt()}%)",
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = StatusSuccess
                                )
                            }
                            Spacer(modifier = Modifier.height(12.dp))
                            Button(
                                onClick = {
                                    val staffIdInt = staffId.toIntOrNull() ?: 42
                                    if (uiState.isCheckingIn) {
                                        viewModel.performCheckIn(staffUserId = staffIdInt, onSuccess = onAttendanceSuccess)
                                    } else {
                                        viewModel.performCheckOut(staffUserId = staffIdInt, onSuccess = onAttendanceSuccess)
                                    }
                                },
                                modifier = Modifier.fillMaxWidth(),
                                colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Text(
                                    text = if (uiState.isCheckingIn) "CONFIRM CHECK-IN" else "CONFIRM CHECK-OUT",
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White
                                )
                            }
                        }
                    }
                }

                is AttendanceEligibilityState.Submitting -> {
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
                            CircularProgressIndicator(modifier = Modifier.size(24.dp), color = PrimaryBlue, strokeWidth = 2.dp)
                            Spacer(modifier = Modifier.width(12.dp))
                            Text(
                                text = "Submitting authoritative attendance transaction...",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                        }
                    }
                }

                is AttendanceEligibilityState.ServerAccepted -> {
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
                            Icon(imageVector = Icons.Default.CloudDone, contentDescription = null, tint = StatusSuccess, modifier = Modifier.size(28.dp))
                            Spacer(modifier = Modifier.width(12.dp))
                            Column {
                                Text("Attendance Confirmed", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = StatusSuccess)
                                Text("Recorded by institutional FAFLOW backend (Status: ${elig.record.status})", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                }

                is AttendanceEligibilityState.SavedOffline -> {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = StatusWarning.copy(alpha = 0.15f))
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(imageVector = Icons.Default.CloudUpload, contentDescription = null, tint = StatusWarning, modifier = Modifier.size(28.dp))
                            Spacer(modifier = Modifier.width(12.dp))
                            Column {
                                Text("Check-In Saved Locally", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = StatusWarning)
                                Text(elig.message, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                }

                is AttendanceEligibilityState.Blocked -> {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = StatusError.copy(alpha = 0.15f))
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(imageVector = Icons.Default.Warning, contentDescription = null, tint = StatusError, modifier = Modifier.size(24.dp))
                            Spacer(modifier = Modifier.width(12.dp))
                            Column {
                                Text(
                                    text = "Attendance Blocked",
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = StatusError
                                )
                                Text(
                                    text = elig.reason,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }
                }

                else -> {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                    ) {
                        val promptText = when (elig) {
                            AttendanceEligibilityState.LocationRequired -> "Shift attendance is gated by campus geofencing. Please verify location first."
                            AttendanceEligibilityState.SingleFaceRequired -> "Multiple faces detected — only one staff member should be visible."
                            AttendanceEligibilityState.FaceRequired -> "Position your face inside the guide oval."
                            AttendanceEligibilityState.IdentityVerificationRequired -> "Verifying staff identity..."
                            AttendanceEligibilityState.LivenessRequired -> "Complete active liveness motion challenge..."
                            else -> "Initializing biometric attendance subsystem..."
                        }
                        Text(
                            text = promptText,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(14.dp),
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }
        }
    }
}
