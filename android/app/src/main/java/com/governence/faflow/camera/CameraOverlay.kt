package com.governence.faflow.camera

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
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
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.CloudDone
import androidx.compose.material.icons.filled.Face
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.filled.ZoomIn
import androidx.compose.material.icons.filled.ZoomOut
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.governence.faflow.attendance.biometrics.liveness.LivenessState
import com.governence.faflow.ui.theme.PrimaryBlue
import com.governence.faflow.ui.theme.SecondaryTeal
import com.governence.faflow.ui.theme.StatusError
import com.governence.faflow.ui.theme.StatusSuccess
import com.governence.faflow.ui.theme.StatusWarning
import com.governence.faflow.ui.viewmodels.FaceDetectionUiState

/**
 * Reusable facial positioning guide overlay with SCRFD detection and active liveness challenge feedback.
 */
@Composable
fun CameraOverlay(
    cameraState: CameraState,
    faceDetectionState: FaceDetectionUiState = FaceDetectionUiState.NoFace,
    livenessState: LivenessState = LivenessState.WaitingForFace,
    showDebugOverlay: Boolean = false,
    inferenceLatencyMs: Long = 0L,
    livenessDebugInfo: com.governence.faflow.attendance.biometrics.liveness.LivenessDebugInfo? = null,
    isServerConfirmed: Boolean = false,
    isOfflineRecorded: Boolean = false,
    isVerifying: Boolean = false,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        // Oval Framing Guide
        val targetBorderColor = when {
            isServerConfirmed -> StatusSuccess
            isOfflineRecorded -> SecondaryTeal
            isVerifying -> PrimaryBlue
            livenessState is LivenessState.SpoofSuspected -> StatusError
            faceDetectionState is FaceDetectionUiState.FacePositionValid -> Color.White.copy(alpha = 0.85f)
            faceDetectionState is FaceDetectionUiState.FaceDetected -> Color.White.copy(alpha = 0.65f)
            faceDetectionState is FaceDetectionUiState.MultipleFaces -> StatusError
            faceDetectionState is FaceDetectionUiState.FaceTooSmall || faceDetectionState is FaceDetectionUiState.FaceTooLarge -> StatusWarning
            faceDetectionState is FaceDetectionUiState.FacePartiallyOutOfFrame -> StatusWarning
            else -> when (cameraState) {
                is CameraState.Ready, is CameraState.Processing -> Color.White.copy(alpha = 0.6f)
                is CameraState.Initializing -> Color.White.copy(alpha = 0.4f)
                else -> StatusError
            }
        }

        val borderColor by animateColorAsState(
            targetValue = targetBorderColor,
            animationSpec = tween(durationMillis = 280),
            label = "ReticleBorderColor"
        )

        val rippleProgress = remember { Animatable(0f) }
        LaunchedEffect(isServerConfirmed) {
            if (isServerConfirmed) {
                rippleProgress.animateTo(
                    targetValue = 1f,
                    animationSpec = tween(durationMillis = 320, easing = FastOutSlowInEasing)
                )
            } else {
                rippleProgress.snapTo(0f)
            }
        }

        // Subtle Glow on Server Confirmed
        if (isServerConfirmed) {
            Box(
                modifier = Modifier
                    .size(width = 246.dp, height = 306.dp)
                    .border(
                        width = 4.dp,
                        color = StatusSuccess.copy(alpha = 0.30f),
                        shape = RoundedCornerShape(123.dp)
                    )
            )
        }

        // Small expanding ripple on successful attendance confirmation
        if (isServerConfirmed && rippleProgress.value > 0f) {
            Box(
                modifier = Modifier
                    .size(width = 240.dp, height = 300.dp)
                    .scale(1.0f + (rippleProgress.value * 0.12f))
                    .border(
                        width = 2.dp,
                        color = StatusSuccess.copy(alpha = (1f - rippleProgress.value) * 0.6f),
                        shape = RoundedCornerShape(120.dp)
                    )
            )
        }

        Box(
            modifier = Modifier
                .size(width = 240.dp, height = 300.dp)
                .border(
                    width = if (isServerConfirmed) 4.dp else 3.dp,
                    color = borderColor,
                    shape = RoundedCornerShape(120.dp)
                ),
            contentAlignment = Alignment.Center
        ) {
            if (isServerConfirmed) {
                val checkScale by animateFloatAsState(
                    targetValue = 1f,
                    animationSpec = tween(durationMillis = 280, easing = FastOutSlowInEasing),
                    label = "CheckScale"
                )
                Box(
                    modifier = Modifier
                        .size(68.dp)
                        .scale(checkScale)
                        .clip(CircleShape)
                        .background(StatusSuccess),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Check,
                        contentDescription = "Success",
                        tint = Color.White,
                        modifier = Modifier.size(42.dp)
                    )
                }
            } else if (isOfflineRecorded) {
                Box(
                    modifier = Modifier
                        .size(68.dp)
                        .clip(CircleShape)
                        .background(SecondaryTeal),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.CloudDone,
                        contentDescription = "Offline Recorded",
                        tint = Color.White,
                        modifier = Modifier.size(40.dp)
                    )
                }
            } else {
                Icon(
                    imageVector = Icons.Default.Face,
                    contentDescription = null,
                    tint = Color.White.copy(alpha = 0.25f),
                    modifier = Modifier.size(100.dp)
                )
            }
        }


        // Developer Debug Overlay (Landmarks & Bounding Box)
        if (showDebugOverlay) {
            val face = when (faceDetectionState) {
                is FaceDetectionUiState.FacePositionValid -> faceDetectionState.primaryFace
                is FaceDetectionUiState.FaceDetected -> faceDetectionState.primaryFace
                else -> null
            }

            if (face != null) {
                Canvas(modifier = Modifier.fillMaxSize()) {
                    val scaleX = size.width / 640f
                    val scaleY = size.height / 480f

                    // Mirrored front-camera box
                    val left = (640f - face.boundingBox.right) * scaleX
                    val top = face.boundingBox.top * scaleY
                    val width = face.boundingBox.width * scaleX
                    val height = face.boundingBox.height * scaleY

                    drawRect(
                        color = Color.Green,
                        topLeft = Offset(left, top),
                        size = Size(width, height),
                        style = Stroke(width = 2.dp.toPx())
                    )

                    face.landmarks?.toPointList()?.forEach { pt ->
                        val lx = (640f - pt.x) * scaleX
                        val ly = pt.y * scaleY
                        drawCircle(color = Color.Yellow, radius = 4.dp.toPx(), center = Offset(lx, ly))
                    }
                }
            }

            // Developer Telemetry HUD
            livenessDebugInfo?.let { debug ->
                Box(
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(start = 16.dp, top = 56.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color(0xDD000000))
                        .border(1.dp, Color.White.copy(alpha = 0.2f), RoundedCornerShape(8.dp))
                        .padding(8.dp)
                ) {
                    Column {
                        Text("DEV TELEMETRY", style = MaterialTheme.typography.labelSmall, color = Color.Cyan, fontWeight = FontWeight.Bold)
                        Text("Face: ${debug.faceStatus}", style = MaterialTheme.typography.labelSmall, color = if (debug.faceStatus == "VALID") Color.Green else Color.Red)
                        Text("State: ${debug.livenessState}", style = MaterialTheme.typography.labelSmall, color = Color.White)
                        Text("Eye: ${debug.eyeState} (EAR: %.3f)".format(debug.ear), style = MaterialTheme.typography.labelSmall, color = if (debug.eyeState == "CLOSED") Color.Yellow else Color.White)
                        Text("L: %.3f | R: %.3f".format(debug.leftEar, debug.rightEar), style = MaterialTheme.typography.labelSmall, color = Color.Gray)
                        Text("Blinks: ${debug.blinkCount}/2", style = MaterialTheme.typography.labelSmall, color = if (debug.blinkCount >= 2) Color.Green else Color.Yellow, fontWeight = FontWeight.Bold)
                        Text("Frames: ${debug.totalFrames} (drop: ${debug.droppedFrames})", style = MaterialTheme.typography.labelSmall, color = Color.LightGray)
                        Text("Latency: ${debug.processingTimeMs}ms", style = MaterialTheme.typography.labelSmall, color = Color.LightGray)
                    }
                }
            }
        }

        // Bottom Status Badge Panel
        Box(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 24.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(Color(0xCC111827))
                .border(1.dp, Color.White.copy(alpha = 0.2f), RoundedCornerShape(16.dp))
                .padding(horizontal = 20.dp, vertical = 10.dp)
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                when {
                    isServerConfirmed -> {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(imageVector = Icons.Default.CheckCircle, contentDescription = null, tint = StatusSuccess, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Attendance Confirmed", style = MaterialTheme.typography.bodySmall, color = Color.White, fontWeight = FontWeight.Bold)
                        }
                    }

                    isOfflineRecorded -> {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(imageVector = Icons.Default.CloudDone, contentDescription = null, tint = SecondaryTeal, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Attendance Queued Offline • Will Sync", style = MaterialTheme.typography.bodySmall, color = Color.White, fontWeight = FontWeight.SemiBold)
                        }
                    }

                    isVerifying -> {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            CircularProgressIndicator(modifier = Modifier.size(16.dp), color = SecondaryTeal, strokeWidth = 2.dp)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Verifying Identity & Recording...", style = MaterialTheme.typography.bodySmall, color = Color.White, fontWeight = FontWeight.SemiBold)
                        }
                    }

                    livenessState is LivenessState.Passed -> {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(imageVector = Icons.Default.CheckCircle, contentDescription = null, tint = StatusSuccess, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Liveness Verified • Motion Active", style = MaterialTheme.typography.bodySmall, color = Color.White, fontWeight = FontWeight.SemiBold)
                        }
                    }

                    livenessState is LivenessState.SpoofSuspected -> {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(imageVector = Icons.Default.Warning, contentDescription = null, tint = StatusError, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(livenessState.reason, style = MaterialTheme.typography.bodySmall, color = Color.White, fontWeight = FontWeight.SemiBold)
                        }
                    }

                    livenessState is LivenessState.TimedOut -> {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(imageVector = Icons.Default.Refresh, contentDescription = null, tint = StatusWarning, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Re-centering face...", style = MaterialTheme.typography.bodySmall, color = Color.White, fontWeight = FontWeight.SemiBold)
                        }
                    }

                    faceDetectionState is FaceDetectionUiState.FacePositionValid -> {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(imageVector = Icons.Default.CheckCircle, contentDescription = null, tint = StatusSuccess, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Face positioned • Verifying...", style = MaterialTheme.typography.bodySmall, color = Color.White, fontWeight = FontWeight.SemiBold)
                        }
                    }

                    faceDetectionState is FaceDetectionUiState.FaceDetected -> {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(imageVector = Icons.Default.CheckCircle, contentDescription = null, tint = SecondaryTeal, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Face detected — position yourself inside the guide", style = MaterialTheme.typography.bodySmall, color = Color.White, fontWeight = FontWeight.SemiBold)
                        }
                    }

                    faceDetectionState is FaceDetectionUiState.MultipleFaces -> {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(imageVector = Icons.Default.Group, contentDescription = null, tint = StatusError, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Multiple faces detected — only one staff member should be visible", style = MaterialTheme.typography.bodySmall, color = Color.White, fontWeight = FontWeight.SemiBold)
                        }
                    }

                    faceDetectionState is FaceDetectionUiState.FaceTooSmall -> {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(imageVector = Icons.Default.ZoomIn, contentDescription = null, tint = StatusWarning, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Move closer", style = MaterialTheme.typography.bodySmall, color = Color.White, fontWeight = FontWeight.SemiBold)
                        }
                    }

                    faceDetectionState is FaceDetectionUiState.FaceTooLarge -> {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(imageVector = Icons.Default.ZoomOut, contentDescription = null, tint = StatusWarning, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Move farther away", style = MaterialTheme.typography.bodySmall, color = Color.White, fontWeight = FontWeight.SemiBold)
                        }
                    }

                    faceDetectionState is FaceDetectionUiState.FacePartiallyOutOfFrame -> {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(imageVector = Icons.Default.Warning, contentDescription = null, tint = StatusWarning, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Center your face", style = MaterialTheme.typography.bodySmall, color = Color.White, fontWeight = FontWeight.SemiBold)
                        }
                    }

                    else -> {
                        when (cameraState) {
                            is CameraState.Initializing -> {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Color.White, strokeWidth = 2.dp)
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text("Starting front camera...", style = MaterialTheme.typography.bodySmall, color = Color.White, fontWeight = FontWeight.SemiBold)
                                }
                            }
                            is CameraState.Ready, is CameraState.Processing -> {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(imageVector = Icons.Default.CameraAlt, contentDescription = null, tint = SecondaryTeal, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text("No face detected", style = MaterialTheme.typography.bodySmall, color = Color.White, fontWeight = FontWeight.SemiBold)
                                }
                            }
                            is CameraState.Unavailable -> {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(imageVector = Icons.Default.Warning, contentDescription = null, tint = StatusError, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(cameraState.reason, style = MaterialTheme.typography.bodySmall, color = Color.White, fontWeight = FontWeight.SemiBold)
                                }
                            }
                            is CameraState.Error -> {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(imageVector = Icons.Default.Warning, contentDescription = null, tint = StatusError, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(cameraState.message, style = MaterialTheme.typography.bodySmall, color = Color.White, fontWeight = FontWeight.SemiBold)
                                }
                            }
                            else -> {}
                        }
                    }
                }
            }
        }
    }
}
