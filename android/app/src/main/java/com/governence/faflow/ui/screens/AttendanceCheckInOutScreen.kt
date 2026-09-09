package com.governence.faflow.ui.screens

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.provider.Settings
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
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
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Login
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.Assessment
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.CloudDone
import androidx.compose.material.icons.filled.CloudUpload
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.NearMe
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.RemoveRedEye
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.governence.faflow.attendance.biometrics.session.VerificationStep
import com.governence.faflow.attendance.geolocation.LocationVerificationResult
import com.governence.faflow.attendance.sync.AttendanceSyncWorker
import com.governence.faflow.camera.CameraController
import com.governence.faflow.camera.CameraOverlay
import com.governence.faflow.camera.CameraPreviewView
import com.governence.faflow.core.network.AttendanceRecordOutDto
import com.governence.faflow.core.network.SupervisorLiveStatusOutDto
import com.governence.faflow.ui.components.FaflowPillButton
import com.governence.faflow.ui.components.FaflowStatusBadge
import com.governence.faflow.ui.components.FaflowSurface
import com.governence.faflow.ui.components.MetricCard
import com.governence.faflow.ui.theme.FaflowShapes
import com.governence.faflow.ui.theme.FaflowSpacing
import com.governence.faflow.ui.theme.FaflowStatusColors
import com.governence.faflow.ui.theme.PrimaryBlue
import com.governence.faflow.ui.theme.SecondaryTeal
import com.governence.faflow.ui.theme.StatusError
import com.governence.faflow.ui.theme.StatusSuccess
import com.governence.faflow.ui.theme.StatusWarning
import com.governence.faflow.ui.viewmodels.AttendanceEligibilityState
import com.governence.faflow.ui.viewmodels.AttendanceViewModel
import com.governence.faflow.ui.viewmodels.AutoCaptureState
import com.governence.faflow.ui.viewmodels.ShiftState
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Mobile-First Native Attendance Check-In / Check-Out Experience for FAFLOW.
 *
 * Principles:
 * 1. Web Parity First: Respects server-authoritative shift states (Check-In -> On-Duty -> Shift Completed).
 * 2. Mobile-Native UX: Purpose-built for phones with single context-aware primary actions.
 * 3. Zero Technical Jargon: Never leaks cosine similarity, model names, raw thresholds, or coordinates.
 * 4. Transparent Biometrics: Clean face guidance oval + two-blink visual challenge.
 * 5. Full Offline Resilience: Clear "Saved securely • Sync pending" indicators with Room & WorkManager.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AttendanceCheckInOutScreen(
    viewModel: AttendanceViewModel,
    onNavigateBack: () -> Unit,
    onAttendanceSuccess: () -> Unit,
    onNavigateToFaceEnrollment: () -> Unit = {},
    userRole: String? = null
) {
    val context = LocalContext.current
    val uiState by viewModel.uiState.collectAsState()
    val verificationResult by viewModel.verificationResult.collectAsState()
    val faceDetectionState by viewModel.faceDetectionState.collectAsState()
    val livenessState by viewModel.livenessState.collectAsState()
    val eligibilityState by viewModel.attendanceEligibilityState.collectAsState()
    val autoCaptureState by viewModel.autoCaptureState.collectAsState()
    val autoCapturePrompt by viewModel.autoCapturePrompt.collectAsState()
    val capturedBitmap by viewModel.capturedFrameBitmap.collectAsState()
    val isCaptureLocked by viewModel.isCaptureLocked.collectAsState()
    val liveLocation by viewModel.liveLocation.collectAsState()
    val verificationStep by viewModel.verificationStep.collectAsState()
    val blinkCount by viewModel.blinkCount.collectAsState()
    val livenessDebugInfo by viewModel.livenessDebugInfo.collectAsState()
    val isLocationVerified = viewModel.isLocationVerifiedForAttendance()
    val coroutineScope = rememberCoroutineScope()

    // Supervisor verification (Admin, Principal, Manager, Governance, HOD)
    val appContainer = remember { com.governence.faflow.core.di.AppContainer.getInstance(context) }
    val effectiveRole = userRole ?: appContainer.tokenManager.getUserRole() ?: "teacher"
    val isSupervisor = listOf("admin", "system_admin", "principal", "manager", "governance", "hod").contains(effectiveRole.lowercase())

    // Shared Model Managers
    val scrfdModelManager = appContainer.scrfdModelManager
    val faceDetector = appContainer.faceDetector
    val mobileFaceNetModelManager = appContainer.mobileFaceNetModelManager

    val latencyMs by faceDetector.inferenceLatencyMs.collectAsState()
    val detections by faceDetector.latestDetections.collectAsState()
    val latestFrameBitmap by faceDetector.latestFrameBitmap.collectAsState()

    val cameraController = remember {
        CameraController(context = context, frameProcessor = faceDetector, targetFps = 10)
    }
    val cameraState by cameraController.cameraState.collectAsState()

    // Bottom sheet states
    var showHistorySheet by remember { mutableStateOf(false) }
    var showSupervisorSheet by remember { mutableStateOf(false) }
    val historySheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val supervisorSheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                viewModel.refreshLocation()
                viewModel.loadTodaySummary()
            } else if (event == Lifecycle.Event.ON_PAUSE || event == Lifecycle.Event.ON_STOP) {
                viewModel.retryCapture()
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
            cameraController.release()
            viewModel.cancelVerification()
        }
    }

    BackHandler {
        viewModel.cancelVerification()
        cameraController.stopCamera()
        onNavigateBack()
    }

    val locationPermissionsLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fineGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true
        val coarseGranted = permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        if (fineGranted || coarseGranted) {
            viewModel.refreshLocation()
        }
    }

    val openAppSettings = {
        try {
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.fromParts("package", context.packageName, null)
            }
            context.startActivity(intent)
        } catch (_: Exception) {}
    }

    val openLocationSettings = {
        try {
            context.startActivity(Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS))
        } catch (_: Exception) {}
    }

    val requestLocationPermission = {
        val fineGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val coarseGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        if (!fineGranted && !coarseGranted) {
            locationPermissionsLauncher.launch(
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                )
            )
        } else if (!viewModel.isLocationEnabled()) {
            openLocationSettings()
        } else {
            viewModel.refreshLocation()
        }
    }

    // Parallel warm-up and initial load on entry
    LaunchedEffect(Unit) {
        val openStartNs = System.nanoTime()
        viewModel.loadTodaySummary()
        viewModel.loadAttendanceHistory()
        if (isSupervisor) {
            viewModel.loadSupervisorLiveStatus()
        }
        viewModel.warmUpModels()
        scrfdModelManager.initializeModels()
        mobileFaceNetModelManager.initializeModels()

        val fineGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val coarseGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        if (!fineGranted && !coarseGranted) {
            locationPermissionsLauncher.launch(
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                )
            )
        }

        com.governence.faflow.core.telemetry.AttendanceTelemetry.recordMetric(
            com.governence.faflow.core.telemetry.AttendanceTelemetry.METRIC_ATTENDANCE_SCREEN_OPEN_MS,
            (System.nanoTime() - openStartNs) / 1_000_000
        )
    }

    // Auto-align session operation with shift state
    LaunchedEffect(uiState.shiftState) {
        when (uiState.shiftState) {
            ShiftState.NOT_STARTED -> viewModel.prepareSessionForCheckIn()
            ShiftState.ON_DUTY -> viewModel.prepareSessionForCheckOut()
            ShiftState.COMPLETED -> {}
        }
    }

    // Forward camera detections into ViewModel pipeline off the Main thread
    LaunchedEffect(detections) {
        if (detections.isNotEmpty() && uiState.shiftState != ShiftState.COMPLETED) {
            val bmp = latestFrameBitmap
            kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Default) {
                viewModel.updateDetections(
                    detections = detections,
                    sourceBitmap = bmp
                )
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

    // Synchronize capture lock with camera analyzer
    LaunchedEffect(isCaptureLocked) {
        cameraController.setCaptureLocked(isCaptureLocked)
    }

    // Auto-navigate or notify upon successful check-in/out
    LaunchedEffect(autoCaptureState) {
        if (autoCaptureState == AutoCaptureState.SUCCESS) {
            delay(1400)
            viewModel.loadTodaySummary()
            onAttendanceSuccess()
        }
    }

    val currentTimeFormatted = remember {
        SimpleDateFormat("hh:mm a", Locale.getDefault()).format(Date())
    }
    val todayDateFormatted = remember {
        SimpleDateFormat("EEEE, MMM d", Locale.getDefault()).format(Date())
    }

    Scaffold(
        topBar = {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = FaflowSpacing.md, vertical = FaflowSpacing.sm),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                IconButton(onClick = {
                    viewModel.cancelVerification()
                    cameraController.stopCamera()
                    onNavigateBack()
                }) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Back",
                        tint = MaterialTheme.colorScheme.onSurface
                    )
                }

                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "Attendance",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        text = "$todayDateFormatted • $currentTimeFormatted",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (isSupervisor) {
                        IconButton(onClick = {
                            viewModel.loadSupervisorLiveStatus()
                            showSupervisorSheet = true
                        }) {
                            Icon(
                                imageVector = Icons.Default.Assessment,
                                contentDescription = "Live Monitor",
                                tint = MaterialTheme.colorScheme.primary
                            )
                        }
                    }

                    IconButton(onClick = {
                        viewModel.loadAttendanceHistory()
                        showHistorySheet = true
                    }) {
                        Icon(
                            imageVector = Icons.Default.History,
                            contentDescription = "Attendance Logs",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    IconButton(onClick = { viewModel.toggleDebugOverlay() }) {
                        Icon(
                            imageVector = Icons.Default.Tune,
                            contentDescription = "Options",
                            tint = if (uiState.isDebugOverlayVisible) PrimaryBlue else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                        )
                    }
                }
            }
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = FaflowSpacing.lg),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // 1. Shift State Hero Banner
            ShiftStateBanner(
                shiftState = uiState.shiftState,
                checkInTime = uiState.checkInTime,
                checkOutTime = uiState.checkOutTime,
                workingDuration = uiState.workingDuration,
                liveWorkingDuration = uiState.liveWorkingDuration,
                checkInGeofenceName = uiState.checkInGeofenceName
            )

            Spacer(modifier = Modifier.height(FaflowSpacing.sm))

            // 2. Human-Friendly Campus Perimeter Location Banner (No raw coordinates)
            val (locationTitle, locationSub, locationColor) = if (isLocationVerified) {
                val geofenceName = (verificationResult as? LocationVerificationResult.InsideGeofence)?.geofenceName
                    ?: (verificationResult as? LocationVerificationResult.Boundary)?.let { "${it.geofenceName} (Perimeter)" }
                    ?: "Campus Perimeter Verified"
                Triple("Campus Perimeter Verified", geofenceName, StatusSuccess)
            } else when (val res = verificationResult) {
                is LocationVerificationResult.InsideGeofence -> Triple("Campus Perimeter Verified", res.geofenceName, StatusSuccess)
                is LocationVerificationResult.Boundary -> Triple("Campus Perimeter Verified", "${res.geofenceName} (Boundary)", StatusSuccess)
                is LocationVerificationResult.OutsideAllGeofences -> Triple("Outside Institutional Campus", "Please be inside campus to record attendance", StatusWarning)
                is LocationVerificationResult.AccuracyInsufficient -> Triple("Calibrating Satellite Lock", "Waiting for optimal GPS accuracy", StatusWarning)
                is LocationVerificationResult.MockLocationDetected -> Triple("Simulated Location Rejected", "Mock GPS prohibited for attendance integrity", StatusError)
                is LocationVerificationResult.PermissionDenied -> Triple("Location Access Required", "Tap to grant permission", StatusWarning)
                LocationVerificationResult.Loading -> Triple("Acquiring Campus Location…", "Connecting to GPS satellites", MaterialTheme.colorScheme.primary)
                else -> Triple("Checking Location…", "Locating campus perimeter", MaterialTheme.colorScheme.onSurfaceVariant)
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(FaflowShapes.medium)
                    .background(locationColor.copy(alpha = 0.08f))
                    .clickable {
                        if (!isLocationVerified) {
                            requestLocationPermission()
                        }
                    }
                    .padding(horizontal = FaflowSpacing.md, vertical = FaflowSpacing.sm),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .clip(CircleShape)
                        .background(locationColor)
                )
                Spacer(modifier = Modifier.width(FaflowSpacing.sm))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = locationTitle,
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold,
                        color = locationColor
                    )
                    Text(
                        text = locationSub,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                if (verificationResult is LocationVerificationResult.OutsideAllGeofences ||
                    verificationResult is LocationVerificationResult.AccuracyInsufficient
                ) {
                    IconButton(
                        onClick = { viewModel.refreshLocation() },
                        modifier = Modifier.size(28.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Retry Location",
                            tint = locationColor,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(FaflowSpacing.sm))

            // 3. Camera Viewfinder / Guidance Canvas
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(24.dp))
                    .background(if (isLocationVerified && hasCameraPermission && uiState.shiftState != ShiftState.COMPLETED) Color.Black else MaterialTheme.colorScheme.surface)
                    .border(
                        width = 1.dp,
                        color = if (isLocationVerified && hasCameraPermission && uiState.shiftState != ShiftState.COMPLETED) Color.Transparent else MaterialTheme.colorScheme.outline.copy(alpha = 0.3f),
                        shape = RoundedCornerShape(24.dp)
                    ),
                contentAlignment = Alignment.Center
            ) {
                when {
                    uiState.shiftState == ShiftState.COMPLETED -> {
                        // Shift Completed Celebration View
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier.padding(FaflowSpacing.xl)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(72.dp)
                                    .clip(CircleShape)
                                    .background(StatusSuccess.copy(alpha = 0.12f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.CheckCircle,
                                    contentDescription = null,
                                    tint = StatusSuccess,
                                    modifier = Modifier.size(40.dp)
                                )
                            }
                            Spacer(modifier = Modifier.height(FaflowSpacing.md))
                            Text(
                                text = "Shift Completed",
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                            Spacer(modifier = Modifier.height(FaflowSpacing.xs))
                            Text(
                                text = "Your shift attendance has been recorded and verified for today.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                textAlign = TextAlign.Center
                            )
                            Spacer(modifier = Modifier.height(FaflowSpacing.lg))
                            FaflowPillButton(
                                text = "View Attendance History",
                                onClick = {
                                    viewModel.loadAttendanceHistory()
                                    showHistorySheet = true
                                },
                                icon = Icons.Default.History,
                                isPrimary = true
                            )
                        }
                    }

                    !isLocationVerified -> {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier.padding(FaflowSpacing.xl)
                        ) {
                            when (val locRes = verificationResult) {
                                is LocationVerificationResult.PermissionDenied -> {
                                    Box(
                                        modifier = Modifier
                                            .size(64.dp)
                                            .clip(CircleShape)
                                            .background(StatusWarning.copy(alpha = 0.12f)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.LocationOn,
                                            contentDescription = null,
                                            tint = StatusWarning,
                                            modifier = Modifier.size(32.dp)
                                        )
                                    }
                                    Spacer(modifier = Modifier.height(FaflowSpacing.md))
                                    Text(
                                        text = "Location Permission Needed",
                                        style = MaterialTheme.typography.titleMedium,
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.onSurface,
                                        textAlign = TextAlign.Center
                                    )
                                    Spacer(modifier = Modifier.height(FaflowSpacing.xs))
                                    Text(
                                        text = "FAFLOW requires location access to verify attendance within institutional campus boundaries.",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        textAlign = TextAlign.Center
                                    )
                                    Spacer(modifier = Modifier.height(FaflowSpacing.lg))
                                    FaflowPillButton(
                                        text = "Grant Location Access",
                                        onClick = { requestLocationPermission() },
                                        icon = Icons.Default.LocationOn,
                                        isPrimary = true
                                    )
                                }

                                is LocationVerificationResult.LocationServicesDisabled -> {
                                    Box(
                                        modifier = Modifier
                                            .size(64.dp)
                                            .clip(CircleShape)
                                            .background(StatusWarning.copy(alpha = 0.12f)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.LocationOn,
                                            contentDescription = null,
                                            tint = StatusWarning,
                                            modifier = Modifier.size(32.dp)
                                        )
                                    }
                                    Spacer(modifier = Modifier.height(FaflowSpacing.md))
                                    Text(
                                        text = "Location Services Disabled",
                                        style = MaterialTheme.typography.titleMedium,
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.onSurface,
                                        textAlign = TextAlign.Center
                                    )
                                    Spacer(modifier = Modifier.height(FaflowSpacing.xs))
                                    Text(
                                        text = "Device GPS is turned off. Please turn on Location in settings to proceed.",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        textAlign = TextAlign.Center
                                    )
                                    Spacer(modifier = Modifier.height(FaflowSpacing.lg))
                                    FaflowPillButton(
                                        text = "Turn On Location",
                                        onClick = { openLocationSettings() },
                                        icon = Icons.Default.LocationOn,
                                        isPrimary = true
                                    )
                                }

                                is LocationVerificationResult.OutsideAllGeofences -> {
                                    Box(
                                        modifier = Modifier
                                            .size(64.dp)
                                            .clip(CircleShape)
                                            .background(StatusWarning.copy(alpha = 0.12f)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.NearMe,
                                            contentDescription = null,
                                            tint = StatusWarning,
                                            modifier = Modifier.size(32.dp)
                                        )
                                    }
                                    Spacer(modifier = Modifier.height(FaflowSpacing.md))
                                    Text(
                                        text = "Outside Campus Perimeter",
                                        style = MaterialTheme.typography.titleMedium,
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.onSurface,
                                        textAlign = TextAlign.Center
                                    )
                                    Spacer(modifier = Modifier.height(FaflowSpacing.xs))
                                    Text(
                                        text = "You are currently ${locRes.distanceToNearestMeters.toInt()}m outside the campus zone. Attendance must be logged on campus.",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        textAlign = TextAlign.Center
                                    )
                                    Spacer(modifier = Modifier.height(FaflowSpacing.lg))
                                    FaflowPillButton(
                                        text = "Refresh Location",
                                        onClick = { viewModel.refreshLocation() },
                                        icon = Icons.Default.Refresh,
                                        isPrimary = false
                                    )
                                }

                                is LocationVerificationResult.AccuracyInsufficient -> {
                                    Box(
                                        modifier = Modifier
                                            .size(64.dp)
                                            .clip(CircleShape)
                                            .background(StatusWarning.copy(alpha = 0.12f)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        CircularProgressIndicator(
                                            modifier = Modifier.size(32.dp),
                                            strokeWidth = 3.dp,
                                            color = StatusWarning
                                        )
                                    }
                                    Spacer(modifier = Modifier.height(FaflowSpacing.md))
                                    Text(
                                        text = "Calibrating GPS Precision",
                                        style = MaterialTheme.typography.titleMedium,
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.onSurface,
                                        textAlign = TextAlign.Center
                                    )
                                    Spacer(modifier = Modifier.height(FaflowSpacing.xs))
                                    Text(
                                        text = "Locking onto satellites. Please hold still or step outdoors for optimal accuracy.",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        textAlign = TextAlign.Center
                                    )
                                }

                                else -> {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(36.dp),
                                        strokeWidth = 3.dp,
                                        color = MaterialTheme.colorScheme.primary
                                    )
                                }
                            }
                        }
                    }

                    !hasCameraPermission -> {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier.padding(FaflowSpacing.xl)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(64.dp)
                                    .clip(CircleShape)
                                    .background(PrimaryBlue.copy(alpha = 0.12f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.CameraAlt,
                                    contentDescription = null,
                                    tint = PrimaryBlue,
                                    modifier = Modifier.size(32.dp)
                                )
                            }
                            Spacer(modifier = Modifier.height(FaflowSpacing.md))
                            Text(
                                text = "Camera Permission Needed",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurface,
                                textAlign = TextAlign.Center
                            )
                            Spacer(modifier = Modifier.height(FaflowSpacing.xs))
                            Text(
                                text = "Used strictly on-device to verify your face and liveness. No biometric photos are shared or uploaded.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                textAlign = TextAlign.Center
                            )
                            Spacer(modifier = Modifier.height(FaflowSpacing.lg))
                            FaflowPillButton(
                                text = "Enable Camera",
                                onClick = { cameraPermissionLauncher.launch(Manifest.permission.CAMERA) },
                                isPrimary = true
                            )
                        }
                    }

                    else -> {
                        Box(modifier = Modifier.fillMaxSize()) {
                            // 1. Live Feed or Frozen Captured Bitmap
                            if (capturedBitmap != null && verificationStep != VerificationStep.LIVENESS_VERIFYING) {
                                Image(
                                    bitmap = capturedBitmap!!.asImageBitmap(),
                                    contentDescription = "Captured Biometric Frame",
                                    modifier = Modifier.fillMaxSize(),
                                    contentScale = ContentScale.Crop
                                )
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
                                    livenessDebugInfo = livenessDebugInfo,
                                    modifier = Modifier.fillMaxSize()
                                )
                            }

                            // 2. Floating Viewfinder Guidance Pill (Top)
                            Box(
                                modifier = Modifier
                                    .align(Alignment.TopCenter)
                                    .padding(top = 16.dp)
                                    .clip(CircleShape)
                                    .background(Color.Black.copy(alpha = 0.72f))
                                    .padding(horizontal = 16.dp, vertical = 8.dp)
                            ) {
                                Text(
                                    text = autoCapturePrompt,
                                    style = MaterialTheme.typography.labelMedium,
                                    fontWeight = FontWeight.SemiBold,
                                    color = Color.White
                                )
                            }

                            // 3. Two-Blink Liveness Visual Challenge Row (Bottom inside camera)
                            if (verificationStep == VerificationStep.LIVENESS_VERIFYING) {
                                Box(
                                    modifier = Modifier
                                        .align(Alignment.BottomCenter)
                                        .padding(bottom = 16.dp)
                                        .clip(RoundedCornerShape(16.dp))
                                        .background(Color.Black.copy(alpha = 0.80f))
                                        .padding(horizontal = 16.dp, vertical = 10.dp)
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                                    ) {
                                        BlinkProgressBadge(
                                            stepNumber = 1,
                                            isCompleted = blinkCount >= 1
                                        )
                                        BlinkProgressBadge(
                                            stepNumber = 2,
                                            isCompleted = blinkCount >= 2
                                        )
                                        Text(
                                            text = if (blinkCount == 0) "Blink naturally" else if (blinkCount == 1) "One more blink" else "Verified!",
                                            style = MaterialTheme.typography.bodySmall,
                                            fontWeight = FontWeight.Bold,
                                            color = Color.White
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(FaflowSpacing.md))

            // 4. Primary Native Action Area
            when {
                uiState.shiftState == ShiftState.COMPLETED -> {
                    // Completed shift footer
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(FaflowShapes.card)
                            .background(StatusSuccess.copy(alpha = 0.08f))
                            .padding(FaflowSpacing.md),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.CheckCircle,
                            contentDescription = null,
                            tint = StatusSuccess,
                            modifier = Modifier.size(24.dp)
                        )
                        Spacer(modifier = Modifier.width(FaflowSpacing.md))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Today's Attendance Recorded",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Bold,
                                color = StatusSuccess
                            )
                            Text(
                                text = "Total Duration: ${uiState.workingDuration ?: "Full Shift"}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }

                autoCaptureState == AutoCaptureState.SUCCESS ||
                        eligibilityState is AttendanceEligibilityState.ServerAccepted -> {
                    FaflowSurface(
                        modifier = Modifier.fillMaxWidth(),
                        backgroundColor = StatusSuccess.copy(alpha = 0.08f),
                        borderColor = StatusSuccess.copy(alpha = 0.3f),
                        contentPadding = PaddingValues(FaflowSpacing.md)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Default.CloudDone,
                                contentDescription = null,
                                tint = StatusSuccess,
                                modifier = Modifier.size(28.dp)
                            )
                            Spacer(modifier = Modifier.width(FaflowSpacing.md))
                            Column {
                                Text(
                                    text = if (uiState.isShiftActive) "Check-In Confirmed" else "Check-Out Confirmed",
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = StatusSuccess
                                )
                                Text(
                                    text = autoCapturePrompt,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }
                }

                verificationStep == VerificationStep.LIVENESS_VERIFYING -> {
                    FaflowSurface(
                        modifier = Modifier.fillMaxWidth(),
                        contentPadding = PaddingValues(FaflowSpacing.md)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(FaflowSpacing.sm)
                            ) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(20.dp),
                                    color = SecondaryTeal,
                                    strokeWidth = 2.dp
                                )
                                Column {
                                    Text(
                                        text = "Liveness Check Active",
                                        style = MaterialTheme.typography.titleSmall,
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.onSurface
                                    )
                                    Text(
                                        text = if (blinkCount == 0) "Blink naturally to verify" else "1 blink recorded, one more to go",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                            androidx.compose.material3.TextButton(
                                onClick = { viewModel.retryCapture() }
                            ) {
                                Text("Cancel", color = MaterialTheme.colorScheme.error)
                            }
                        }
                    }
                }

                autoCaptureState == AutoCaptureState.CAPTURED ||
                        eligibilityState is AttendanceEligibilityState.Submitting ||
                        uiState.isSubmitting -> {
                    FaflowSurface(
                        modifier = Modifier.fillMaxWidth(),
                        contentPadding = PaddingValues(FaflowSpacing.md)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center
                        ) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                color = PrimaryBlue,
                                strokeWidth = 2.dp
                            )
                            Spacer(modifier = Modifier.width(FaflowSpacing.md))
                            Text(
                                text = autoCapturePrompt,
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.Medium,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                        }
                    }
                }

                autoCaptureState == AutoCaptureState.RECOGNITION_FAILED ||
                        autoCaptureState == AutoCaptureState.ERROR ||
                        eligibilityState is AttendanceEligibilityState.Blocked -> {
                    val errorReason = (eligibilityState as? AttendanceEligibilityState.Blocked)?.reason ?: autoCapturePrompt
                    FaflowSurface(
                        modifier = Modifier.fillMaxWidth(),
                        backgroundColor = StatusError.copy(alpha = 0.08f),
                        borderColor = StatusError.copy(alpha = 0.3f),
                        contentPadding = PaddingValues(FaflowSpacing.md)
                    ) {
                        Column(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Warning,
                                    contentDescription = null,
                                    tint = StatusError,
                                    modifier = Modifier.size(24.dp)
                                )
                                Spacer(modifier = Modifier.width(FaflowSpacing.md))
                                Column {
                                    Text(
                                        text = "Verification Unsuccessful",
                                        style = MaterialTheme.typography.titleSmall,
                                        fontWeight = FontWeight.Bold,
                                        color = StatusError
                                    )
                                    Text(
                                        text = errorReason,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                            Spacer(modifier = Modifier.height(FaflowSpacing.sm))
                            val isEnrollmentMissing = errorReason.contains("enrolled", ignoreCase = true) ||
                                    errorReason.contains("biometric", ignoreCase = true)
                            if (isEnrollmentMissing) {
                                FaflowPillButton(
                                    text = "Enroll Face Now",
                                    onClick = onNavigateToFaceEnrollment,
                                    icon = Icons.Default.CameraAlt,
                                    isPrimary = true,
                                    modifier = Modifier.fillMaxWidth()
                                )
                                Spacer(modifier = Modifier.height(FaflowSpacing.xs))
                            }
                            FaflowPillButton(
                                text = "Try Again",
                                onClick = { viewModel.retryCapture() },
                                icon = Icons.Default.Refresh,
                                isPrimary = !isEnrollmentMissing,
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                    }
                }

                else -> {
                    // Single Context-Aware Primary Action Button
                    val isActionCheckIn = uiState.shiftState == ShiftState.NOT_STARTED
                    val buttonColor = if (isActionCheckIn) Color(0xFF059669) else PrimaryBlue
                    val buttonText = if (isActionCheckIn) "Check In" else "Check Out"
                    val buttonIcon = if (isActionCheckIn) Icons.AutoMirrored.Filled.Login else Icons.AutoMirrored.Filled.Logout

                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(FaflowSpacing.sm)
                    ) {
                        Button(
                            onClick = {
                                viewModel.processSingleFrameAttendance(
                                    isCheckIn = isActionCheckIn,
                                    sourceBitmap = latestFrameBitmap,
                                    faceDetector = faceDetector
                                )
                            },
                            enabled = !isCaptureLocked && !uiState.isSubmitting && isLocationVerified && hasCameraPermission,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(54.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = buttonColor,
                                contentColor = Color.White,
                                disabledContainerColor = buttonColor.copy(alpha = 0.35f),
                                disabledContentColor = Color.White.copy(alpha = 0.6f)
                            ),
                            shape = RoundedCornerShape(14.dp)
                        ) {
                            Icon(
                                imageVector = buttonIcon,
                                contentDescription = null,
                                modifier = Modifier.size(22.dp)
                            )
                            Spacer(modifier = Modifier.width(10.dp))
                            Text(
                                text = buttonText,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        val hintText = when {
                            !hasCameraPermission -> "Camera permission required for face verification"
                            !isLocationVerified -> "Outside authorized perimeter • Campus presence required"
                            isActionCheckIn -> "Align face in the frame and tap Check In"
                            else -> "Align face in the frame and tap Check Out"
                        }
                        Text(
                            text = hintText,
                            style = MaterialTheme.typography.bodySmall,
                            color = if (!isLocationVerified && hasCameraPermission) StatusError else MaterialTheme.colorScheme.onSurfaceVariant,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(FaflowSpacing.lg))
        }

        // Attendance History Bottom Sheet
        if (showHistorySheet) {
            ModalBottomSheet(
                onDismissRequest = { showHistorySheet = false },
                sheetState = historySheetState,
                containerColor = MaterialTheme.colorScheme.surface
            ) {
                AttendanceHistorySheetContent(
                    records = uiState.attendanceRecords,
                    isLoading = uiState.isHistoryLoading,
                    onRefresh = { viewModel.loadAttendanceHistory() },
                    onClose = {
                        coroutineScope.launch { historySheetState.hide() }.invokeOnCompletion {
                            showHistorySheet = false
                        }
                    }
                )
            }
        }

        // Supervisor Institutional Live Status Bottom Sheet
        if (showSupervisorSheet && isSupervisor) {
            ModalBottomSheet(
                onDismissRequest = { showSupervisorSheet = false },
                sheetState = supervisorSheetState,
                containerColor = MaterialTheme.colorScheme.surface
            ) {
                SupervisorLiveStatusSheetContent(
                    liveStatus = uiState.supervisorLiveStatus,
                    isLoading = uiState.isSupervisorLoading,
                    onRefresh = { viewModel.loadSupervisorLiveStatus() },
                    onClose = {
                        coroutineScope.launch { supervisorSheetState.hide() }.invokeOnCompletion {
                            showSupervisorSheet = false
                        }
                    }
                )
            }
        }
    }
}

/**
 * Mobile Shift State Header Banner displaying on-duty timer or completion.
 */
@Composable
private fun ShiftStateBanner(
    shiftState: ShiftState,
    checkInTime: String?,
    checkOutTime: String?,
    workingDuration: String?,
    liveWorkingDuration: String?,
    checkInGeofenceName: String?
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(
            containerColor = when (shiftState) {
                ShiftState.ON_DUTY -> Color(0xFF065F46).copy(alpha = 0.08f)
                ShiftState.COMPLETED -> PrimaryBlue.copy(alpha = 0.08f)
                ShiftState.NOT_STARTED -> MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
            }
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(10.dp)
                            .clip(CircleShape)
                            .background(
                                when (shiftState) {
                                    ShiftState.ON_DUTY -> Color(0xFF059669)
                                    ShiftState.COMPLETED -> PrimaryBlue
                                    ShiftState.NOT_STARTED -> Color(0xFFF59E0B)
                                }
                            )
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = when (shiftState) {
                            ShiftState.ON_DUTY -> "On Duty"
                            ShiftState.COMPLETED -> "Shift Completed"
                            ShiftState.NOT_STARTED -> "Not Checked In"
                        },
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.Bold,
                        color = when (shiftState) {
                            ShiftState.ON_DUTY -> Color(0xFF059669)
                            ShiftState.COMPLETED -> PrimaryBlue
                            ShiftState.NOT_STARTED -> Color(0xFFB45309)
                        }
                    )
                }

                Spacer(modifier = Modifier.height(4.dp))

                when (shiftState) {
                    ShiftState.ON_DUTY -> {
                        Text(
                            text = "Checked in at ${checkInTime?.substringAfter("T")?.take(5) ?: checkInTime ?: "--:--"} • ${checkInGeofenceName ?: "Campus"}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    ShiftState.COMPLETED -> {
                        Text(
                            text = "In: ${checkInTime?.substringAfter("T")?.take(5) ?: "--:--"} • Out: ${checkOutTime?.substringAfter("T")?.take(5) ?: "--:--"}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    ShiftState.NOT_STARTED -> {
                        Text(
                            text = "Ready to start today's faculty shift",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            if (shiftState == ShiftState.ON_DUTY) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(10.dp))
                        .background(Color(0xFF059669))
                        .padding(horizontal = 10.dp, vertical = 6.dp)
                ) {
                    Text(
                        text = liveWorkingDuration ?: workingDuration ?: "In progress",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }
            } else if (shiftState == ShiftState.COMPLETED && workingDuration != null) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(10.dp))
                        .background(PrimaryBlue)
                        .padding(horizontal = 10.dp, vertical = 6.dp)
                ) {
                    Text(
                        text = workingDuration,
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }
            }
        }
    }
}

/**
 * Visual badge for the two-blink challenge.
 */
@Composable
private fun BlinkProgressBadge(
    stepNumber: Int,
    isCompleted: Boolean
) {
    Box(
        modifier = Modifier
            .size(32.dp)
            .clip(CircleShape)
            .background(if (isCompleted) Color(0xFF059669) else Color.White.copy(alpha = 0.2f)),
        contentAlignment = Alignment.Center
    ) {
        if (isCompleted) {
            Icon(
                imageVector = Icons.Default.Check,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.size(18.dp)
            )
        } else {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                Icon(
                    imageVector = Icons.Default.RemoveRedEye,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(14.dp)
                )
            }
        }
    }
}

/**
 * Native Bottom Sheet displaying the user's past 30 days of attendance.
 */
@Composable
private fun AttendanceHistorySheetContent(
    records: List<AttendanceRecordOutDto>,
    isLoading: Boolean,
    onRefresh: () -> Unit,
    onClose: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = FaflowSpacing.lg)
            .padding(bottom = FaflowSpacing.xl)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "Attendance History",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "Past 30 institutional shift records",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            IconButton(onClick = onRefresh) {
                Icon(imageVector = Icons.Default.Refresh, contentDescription = "Refresh")
            }
        }

        Spacer(modifier = Modifier.height(FaflowSpacing.md))

        if (isLoading) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(180.dp),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = PrimaryBlue)
            }
        } else if (records.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(160.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "No prior attendance records found.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(420.dp),
                verticalArrangement = Arrangement.spacedBy(FaflowSpacing.sm)
            ) {
                items(records) { record ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(14.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f))
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(14.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = record.attendanceDate,
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.Bold
                                )
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(
                                    text = "In: ${record.checkInTime?.substringAfter("T")?.take(5) ?: "--:--"} • Out: ${record.checkOutTime?.substringAfter("T")?.take(5) ?: "--:--"}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                if (record.checkInGeofenceName != null) {
                                    Text(
                                        text = record.checkInGeofenceName,
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                                    )
                                }
                            }

                            Column(horizontalAlignment = Alignment.End) {
                                FaflowStatusBadge(
                                    text = record.status,
                                    statusColor = if (record.status.contains("PRESENT", ignoreCase = true)) StatusSuccess else StatusWarning
                                )
                                if (record.workingHours != null) {
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = record.workingHours,
                                        style = MaterialTheme.typography.labelSmall,
                                        fontWeight = FontWeight.SemiBold,
                                        color = MaterialTheme.colorScheme.primary
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/**
 * Native Bottom Sheet for institutional supervisors (Admin, Principal, Manager, Governance).
 */
@Composable
private fun SupervisorLiveStatusSheetContent(
    liveStatus: SupervisorLiveStatusOutDto?,
    isLoading: Boolean,
    onRefresh: () -> Unit,
    onClose: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = FaflowSpacing.lg)
            .padding(bottom = FaflowSpacing.xl)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "Live Presence Monitor",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "Authoritative institutional shift tracking",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            IconButton(onClick = onRefresh) {
                Icon(imageVector = Icons.Default.Refresh, contentDescription = "Refresh")
            }
        }

        Spacer(modifier = Modifier.height(FaflowSpacing.md))

        if (isLoading) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(200.dp),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = PrimaryBlue)
            }
        } else if (liveStatus == null) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(160.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "Unable to load institutional live attendance status.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        } else {
            // Metrics grid
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(FaflowSpacing.sm)
            ) {
                MetricCard(
                    title = "On Campus",
                    value = liveStatus.currentlyActiveCount.toString(),
                    subtitle = "Active now",
                    icon = Icons.Default.CheckCircle,
                    iconTint = StatusSuccess,
                    modifier = Modifier.weight(1f)
                )
                MetricCard(
                    title = "Completed",
                    value = liveStatus.checkedOutCount.toString(),
                    subtitle = "Checked out",
                    icon = Icons.AutoMirrored.Filled.Logout,
                    iconTint = PrimaryBlue,
                    modifier = Modifier.weight(1f)
                )
            }

            Spacer(modifier = Modifier.height(FaflowSpacing.sm))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(FaflowSpacing.sm)
            ) {
                MetricCard(
                    title = "Not Reported",
                    value = liveStatus.absentCount.toString(),
                    subtitle = "Pending / on leave",
                    icon = Icons.Default.Warning,
                    iconTint = StatusWarning,
                    modifier = Modifier.weight(1f)
                )
                MetricCard(
                    title = "Total Staff",
                    value = liveStatus.totalStaff.toString(),
                    subtitle = "Registered",
                    icon = Icons.Default.People,
                    iconTint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.weight(1f)
                )
            }

            Spacer(modifier = Modifier.height(FaflowSpacing.md))

            Text(
                text = "Active On-Duty Shifts (${liveStatus.records.size})",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(FaflowSpacing.xs))

            if (liveStatus.records.isEmpty()) {
                Text(
                    text = "No faculty or staff currently checked in.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(vertical = 12.dp)
                )
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(200.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    items(liveStatus.records) { shift ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f))
                                .padding(horizontal = 12.dp, vertical = 8.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = shift.staffName ?: "Staff #${shift.userId}",
                                    style = MaterialTheme.typography.labelMedium,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = "In: ${shift.checkInTime?.substringAfter("T")?.take(5) ?: "--:--"}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            Text(
                                text = shift.checkInGeofenceName ?: "Campus",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                    }
                }
            }
        }
    }
}
