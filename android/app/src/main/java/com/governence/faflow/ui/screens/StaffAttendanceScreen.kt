package com.governence.faflow.ui.screens

import androidx.compose.foundation.background
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.governence.faflow.location.LocationVerificationResult
import com.governence.faflow.ui.components.AppTopBar
import com.governence.faflow.ui.components.PrimaryGradientButton
import com.governence.faflow.ui.theme.PrimaryBlue
import com.governence.faflow.ui.theme.StatusError
import com.governence.faflow.ui.theme.StatusSuccess
import com.governence.faflow.ui.theme.StatusWarning
import com.governence.faflow.ui.viewmodels.AttendanceViewModel
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun StaffAttendanceScreen(
    viewModel: AttendanceViewModel,
    onNavigateToCheckIn: () -> Unit,
    onNavigateToHistory: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    val verificationResult by viewModel.verificationResult.collectAsState()
    val liveLocation by viewModel.liveLocation.collectAsState()
    val isLocationValid = viewModel.isLocationVerifiedForAttendance()
    val todayDateFormatted = SimpleDateFormat("EEEE, MMMM d, yyyy", Locale.getDefault()).format(Date())

    Scaffold(
        topBar = {
            AppTopBar(
                title = "Staff Attendance",
                canNavigateBack = false
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
            contentPadding = PaddingValues(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // 1. Location Verification Banner
            item {
                val (bgColor, borderColor, iconTint, titleText, subtitleText) = when (verificationResult) {
                    is LocationVerificationResult.InsideGeofence, is LocationVerificationResult.Boundary -> {
                        Tuple5(
                            Color(0xFFECFDF5),
                            Color(0xFFA7F3D0),
                            StatusSuccess,
                            "You're at campus",
                            "Location verified for attendance check-in."
                        )
                    }
                    is LocationVerificationResult.MockLocationDetected -> {
                        Tuple5(
                            Color(0xFFFEF2F2),
                            Color(0xFFFECACA),
                            StatusError,
                            "Location Spoofing Detected",
                            "Mock GPS provider detected. Disable mock locations to continue."
                        )
                    }
                    is LocationVerificationResult.AccuracyInsufficient -> {
                        Tuple5(
                            Color(0xFFFFFBEB),
                            Color(0xFFFDE68A),
                            StatusWarning,
                            "Acquiring GPS Precision",
                            "Current accuracy is low. Move closer to open sky."
                        )
                    }
                    is LocationVerificationResult.OutsideAllGeofences -> {
                        Tuple5(
                            Color(0xFFF8FAFC),
                            Color(0xFFE2E8F0),
                            Color(0xFF64748B),
                            "You're outside the campus",
                            "Move closer to your campus perimeter to record attendance."
                        )
                    }
                    else -> {
                        Tuple5(
                            Color(0xFFF8FAFC),
                            Color(0xFFE2E8F0),
                            PrimaryBlue,
                            "Verifying Campus Location...",
                            "Acquiring high-precision GPS coordinates."
                        )
                    }
                }

                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = bgColor)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(18.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(48.dp)
                                .clip(CircleShape)
                                .background(iconTint.copy(alpha = 0.15f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = if (isLocationValid) Icons.Default.CheckCircle else Icons.Default.LocationOn,
                                contentDescription = null,
                                tint = iconTint,
                                modifier = Modifier.size(26.dp)
                            )
                        }

                        Spacer(modifier = Modifier.width(16.dp))

                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = titleText,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = subtitleText,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            if (liveLocation != null) {
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = "Accuracy: ±${liveLocation?.accuracyMeters?.toInt() ?: 0}m",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                                )
                            }
                        }
                    }
                }
            }

            // 2. Today's Shift Summary Card
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(20.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = "Today's Attendance",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = todayDateFormatted,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }

                            val isPresent = uiState.checkInTime != null
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(if (isPresent) StatusSuccess.copy(alpha = 0.15f) else Color.Gray.copy(alpha = 0.15f))
                                    .padding(horizontal = 10.dp, vertical = 5.dp)
                            ) {
                                Text(
                                    text = if (isPresent) "PRESENT" else "NOT RECORDED",
                                    style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = if (isPresent) StatusSuccess else Color.Gray
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(18.dp))

                        Row(modifier = Modifier.fillMaxWidth()) {
                            // Check-in Time
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Check-In Time", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = uiState.checkInTime ?: "-- : --",
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.Bold
                                )
                            }

                            // Check-out Time
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Check-Out Time", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = uiState.checkOutTime ?: "-- : --",
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }
            }

            // 3. One-Touch Action Buttons
            item {
                val hasCheckedIn = uiState.checkInTime != null
                val hasCheckedOut = uiState.checkOutTime != null

                if (!hasCheckedIn) {
                    PrimaryGradientButton(
                        text = "Biometric Check-In",
                        icon = Icons.Default.Fingerprint,
                        onClick = onNavigateToCheckIn
                    )
                } else if (!hasCheckedOut) {
                    PrimaryGradientButton(
                        text = "Biometric Check-Out",
                        icon = Icons.Default.Fingerprint,
                        onClick = onNavigateToCheckIn
                    )
                } else {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = StatusSuccess.copy(alpha = 0.1f))
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.CheckCircle, contentDescription = null, tint = StatusSuccess)
                            Spacer(modifier = Modifier.width(12.dp))
                            Text(
                                text = "Shift Completed for Today",
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.Bold,
                                color = StatusSuccess
                            )
                        }
                    }
                }
            }

            // 4. Attendance History Button
            item {
                Button(
                    onClick = onNavigateToHistory,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant,
                        contentColor = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                ) {
                    Icon(Icons.Default.History, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("View Attendance Ledger & History", style = MaterialTheme.typography.labelLarge)
                }
            }
        }
    }
}

private data class Tuple5<A, B, C, D, E>(
    val a: A,
    val b: B,
    val c: C,
    val d: D,
    val e: E
)

