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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material.icons.filled.GpsFixed
import androidx.compose.material.icons.filled.GpsNotFixed
import androidx.compose.material.icons.filled.GpsOff
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Refresh
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
import com.governence.faflow.location.GeofenceType
import com.governence.faflow.location.LocationVerificationResult
import com.governence.faflow.ui.components.AppTopBar
import com.governence.faflow.ui.components.PrimaryGradientButton
import com.governence.faflow.ui.theme.PrimaryBlue
import com.governence.faflow.ui.theme.StatusError
import com.governence.faflow.ui.theme.StatusSuccess
import com.governence.faflow.ui.theme.StatusWarning
import com.governence.faflow.ui.viewmodels.AttendanceViewModel

@Composable
fun AttendancePlaceholderScreen(
    viewModel: AttendanceViewModel,
    onNavigateToCheckIn: () -> Unit,
    onNavigateToHistory: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    val verificationResult by viewModel.verificationResult.collectAsState()
    val liveLocation by viewModel.liveLocation.collectAsState()
    val geofences by viewModel.geofences.collectAsState()

    Scaffold(
        topBar = {
            AppTopBar(
                title = "Palgeo Attendance",
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
            // Live Geofence Status Card
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
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
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            val (icon, tint, title) = when (verificationResult) {
                                is LocationVerificationResult.InsideGeofence -> Triple(
                                    Icons.Default.GpsFixed,
                                    StatusSuccess,
                                    "✓ Inside ${(verificationResult as LocationVerificationResult.InsideGeofence).geofenceName}"
                                )
                                is LocationVerificationResult.Boundary -> Triple(
                                    Icons.Default.GpsFixed,
                                    StatusSuccess,
                                    "✓ Near Boundary of ${(verificationResult as LocationVerificationResult.Boundary).geofenceName}"
                                )
                                is LocationVerificationResult.OutsideAllGeofences -> Triple(
                                    Icons.Default.LocationOn,
                                    StatusWarning,
                                    "✕ Outside Allowed Attendance Area"
                                )
                                is LocationVerificationResult.AccuracyInsufficient -> Triple(
                                    Icons.Default.GpsNotFixed,
                                    StatusWarning,
                                    "⚠ Location Accuracy Too Low"
                                )
                                is LocationVerificationResult.MockLocationDetected -> Triple(
                                    Icons.Default.Warning,
                                    StatusError,
                                    "⚠ Mock Location / Fake GPS Detected"
                                )
                                is LocationVerificationResult.StaleLocation -> Triple(
                                    Icons.Default.Warning,
                                    StatusWarning,
                                    "⚠ Stale GPS Fix"
                                )
                                is LocationVerificationResult.LocationServicesDisabled -> Triple(
                                    Icons.Default.GpsOff,
                                    StatusError,
                                    "GPS Services Disabled"
                                )
                                is LocationVerificationResult.PermissionDenied -> Triple(
                                    Icons.Default.GpsOff,
                                    StatusError,
                                    "Location Permission Required"
                                )
                                is LocationVerificationResult.PermissionPermanentlyDenied -> Triple(
                                    Icons.Default.GpsOff,
                                    StatusError,
                                    "Location Permission Blocked"
                                )
                                is LocationVerificationResult.LocationUnavailable -> Triple(
                                    Icons.Default.GpsOff,
                                    StatusError,
                                    "Location Signal Unavailable"
                                )
                                is LocationVerificationResult.NoActiveGeofences -> Triple(
                                    Icons.Default.LocationOn,
                                    StatusWarning,
                                    "No Active Campus Boundaries"
                                )
                                LocationVerificationResult.Loading -> Triple(
                                    Icons.Default.GpsFixed,
                                    PrimaryBlue,
                                    "Acquiring GPS Fix..."
                                )
                            }

                            Icon(imageVector = icon, contentDescription = null, tint = tint, modifier = Modifier.size(24.dp))
                            Spacer(modifier = Modifier.width(10.dp))
                            Text(
                                text = title,
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Bold,
                                color = tint
                            )
                        }

                        Spacer(modifier = Modifier.height(6.dp))

                        val detailText = when (val res = verificationResult) {
                            is LocationVerificationResult.InsideGeofence ->
                                "Distance: ${res.distanceToCenterMeters.toInt()}m • Accuracy: ±${res.accuracyMeters.toInt()}m • Status: READY"
                            is LocationVerificationResult.Boundary ->
                                "Within tolerance margin of campus boundary • Accuracy: ±${res.accuracyMeters.toInt()}m • Status: READY"
                            is LocationVerificationResult.OutsideAllGeofences ->
                                "Nearest: ${res.nearestGeofenceName ?: "Campus"} (${res.distanceToNearestMeters.toInt()}m away). Move inside campus to check in."
                            is LocationVerificationResult.AccuracyInsufficient ->
                                "Accuracy is ±${res.currentAccuracyMeters.toInt()}m (Max allowed: ${res.requiredAccuracyMeters.toInt()}m). Move to an open area."
                            is LocationVerificationResult.MockLocationDetected ->
                                "Anti-spoofing engine rejected mock location from ${res.provider}"
                            is LocationVerificationResult.StaleLocation ->
                                "Location data is ${res.ageSeconds}s old. Tap Refresh Location to get a fresh satellite fix."
                            is LocationVerificationResult.LocationServicesDisabled ->
                                "Enable High-Accuracy Location Services in device settings."
                            is LocationVerificationResult.PermissionDenied ->
                                "Grant Location permission in Android Settings to verify campus attendance."
                            is LocationVerificationResult.PermissionPermanentlyDenied ->
                                "Location permission permanently denied. Open App Settings to enable."
                            is LocationVerificationResult.LocationUnavailable ->
                                "Unable to receive GPS signals. Ensure unobstructed view of the sky."
                            is LocationVerificationResult.NoActiveGeofences ->
                                "No active institutional attendance geofences found."
                            LocationVerificationResult.Loading ->
                                "Listening for satellite signals and computing geodesic boundary..."
                        }

                        Text(
                            text = detailText,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )

                        Spacer(modifier = Modifier.height(10.dp))

                        Button(
                            onClick = { viewModel.refreshLocation() },
                            colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue.copy(alpha = 0.15f), contentColor = PrimaryBlue)
                        ) {
                            Icon(imageVector = Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Refresh Location", style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }
            }

            // Shift Status Card
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(24.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.primaryContainer
                    )
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Box(
                            modifier = Modifier
                                .size(70.dp)
                                .clip(CircleShape)
                                .background(PrimaryBlue.copy(alpha = 0.2f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Fingerprint,
                                contentDescription = null,
                                tint = PrimaryBlue,
                                modifier = Modifier.size(40.dp)
                            )
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        val statusText = if (uiState.isShiftActive) "Shift Status: Checked In" else "Shift Status: Not Checked In"
                        Text(
                            text = statusText,
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface
                        )

                        Spacer(modifier = Modifier.height(4.dp))

                        val shiftTimeText = if (uiState.isShiftActive && uiState.checkInTime != null) {
                            "Checked in today at ${uiState.checkInTime}"
                        } else {
                            "Morning Shift • 08:30 AM - 04:30 PM"
                        }

                        Text(
                            text = shiftTimeText,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )

                        Spacer(modifier = Modifier.height(20.dp))

                        PrimaryGradientButton(
                            text = if (uiState.isShiftActive) "Check Out" else "Check In (Face + Geofence)",
                            icon = Icons.Default.Fingerprint,
                            onClick = onNavigateToCheckIn
                        )
                    }
                }
            }

            // Active Campus Geofences Section (Circle & Polygon)
            item {
                Text(
                    text = "Active Institutional Geofences",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onBackground
                )
            }

            items(geofences) { geofence ->
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
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(PrimaryBlue.copy(alpha = 0.15f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(imageVector = Icons.Default.LocationOn, contentDescription = null, tint = PrimaryBlue)
                        }

                        Spacer(modifier = Modifier.width(14.dp))

                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = geofence.name,
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            val geoDesc = if (geofence.type == GeofenceType.CIRCLE) {
                                "Circular Boundary • Radius: ${geofence.radiusMeters.toInt()}m (±${geofence.toleranceMeters.toInt()}m)"
                            } else {
                                "Polygonal Boundary • ${geofence.polygonVertices.size} Coordinate Vertices"
                            }
                            Text(
                                text = geoDesc,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }

                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(StatusSuccess.copy(alpha = 0.15f))
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Text(
                                text = "ACTIVE",
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Bold,
                                color = StatusSuccess
                            )
                        }
                    }
                }
            }

            item {
                PrimaryGradientButton(
                    text = "View Monthly Attendance Ledger",
                    icon = Icons.Default.History,
                    onClick = onNavigateToHistory
                )
            }
        }
    }
}
