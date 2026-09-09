package com.governence.faflow.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.ui.unit.sp
import com.governence.faflow.attendance.geolocation.LocationVerificationResult
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
    val todayDateFormatted = SimpleDateFormat("EEEE, d MMMM yyyy", Locale.getDefault()).format(Date())
    val hasCheckedIn = uiState.checkInTime != null
    val hasCheckedOut = uiState.checkOutTime != null

    androidx.compose.runtime.LaunchedEffect(Unit) {
        viewModel.loadTodaySummary()
    }

    Scaffold(
        topBar = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(com.governence.faflow.ui.theme.FaflowBg)
                    .padding(horizontal = 18.dp, vertical = 12.dp)
            ) {
                Text(
                    text = "Staff attendance",
                    fontSize = 19.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = (-0.01).sp,
                    color = com.governence.faflow.ui.theme.FaflowText1
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = todayDateFormatted,
                    fontSize = 12.sp,
                    color = com.governence.faflow.ui.theme.FaflowText3
                )
            }
        },
        containerColor = com.governence.faflow.ui.theme.FaflowBg
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(com.governence.faflow.ui.theme.FaflowBg)
                .padding(horizontal = 18.dp),
            contentPadding = PaddingValues(top = 4.dp, bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // 1. CHECK-IN HERO CARD (.checkin-hero)
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(com.governence.faflow.ui.theme.FaflowSurface)
                        .border(1.dp, com.governence.faflow.ui.theme.FaflowBorder, RoundedCornerShape(16.dp))
                        .padding(vertical = 28.dp, horizontal = 20.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        // Check-in Ring (80x80dp circle)
                        Box(
                            modifier = Modifier
                                .size(80.dp)
                                .clip(CircleShape)
                                .background(com.governence.faflow.ui.theme.FaflowNavyTint)
                                .border(1.5.dp, com.governence.faflow.ui.theme.FaflowBorder, CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Fingerprint,
                                contentDescription = null,
                                tint = com.governence.faflow.ui.theme.FaflowNavy,
                                modifier = Modifier.size(32.dp)
                            )
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        // Status line
                        val statusLine = when {
                            hasCheckedOut -> "SHIFT COMPLETED TODAY"
                            hasCheckedIn -> "CHECKED IN AT ${formatDisplayTime(uiState.checkInTime)}"
                            else -> "NOT RECORDED TODAY"
                        }
                        Text(
                            text = statusLine,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = com.governence.faflow.ui.theme.FaflowText3,
                            letterSpacing = 0.04.sp
                        )

                        Spacer(modifier = Modifier.height(3.dp))

                        // Headline
                        val headline = when {
                            hasCheckedOut -> "Shift Completed"
                            hasCheckedIn -> "Ready to check out"
                            else -> "Ready to check in"
                        }
                        Text(
                            text = headline,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = com.governence.faflow.ui.theme.FaflowText1
                        )

                        Spacer(modifier = Modifier.height(10.dp))

                        // Location status with pin icon
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.LocationOn,
                                contentDescription = null,
                                tint = if (isLocationValid) com.governence.faflow.ui.theme.FaflowSuccess else com.governence.faflow.ui.theme.FaflowText3,
                                modifier = Modifier.size(13.dp)
                            )
                            Spacer(modifier = Modifier.width(5.dp))
                            Text(
                                text = if (isLocationValid) "Campus perimeter verified" else "Verifying you're within campus range",
                                fontSize = 11.5.sp,
                                color = com.governence.faflow.ui.theme.FaflowText3
                            )
                        }
                    }
                }
            }

            // 2. TIME GRID (.time-grid: CHECK-IN and CHECK-OUT cells)
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(com.governence.faflow.ui.theme.FaflowBorder)
                        .border(1.dp, com.governence.faflow.ui.theme.FaflowBorder, RoundedCornerShape(12.dp))
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(1.dp)
                    ) {
                        // Check-in Cell
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .background(com.governence.faflow.ui.theme.FaflowSurface)
                                .padding(vertical = 14.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(
                                    text = "CHECK-IN",
                                    fontSize = 10.5.sp,
                                    fontWeight = FontWeight.Bold,
                                    letterSpacing = 0.04.sp,
                                    color = com.governence.faflow.ui.theme.FaflowText3
                                )
                                Spacer(modifier = Modifier.height(6.dp))
                                Text(
                                    text = formatDisplayTime(uiState.checkInTime),
                                    fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
                                    fontSize = 17.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = com.governence.faflow.ui.theme.FaflowText1
                                )
                            }
                        }

                        // Check-out Cell
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .background(com.governence.faflow.ui.theme.FaflowSurface)
                                .padding(vertical = 14.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(
                                    text = "CHECK-OUT",
                                    fontSize = 10.5.sp,
                                    fontWeight = FontWeight.Bold,
                                    letterSpacing = 0.04.sp,
                                    color = com.governence.faflow.ui.theme.FaflowText3
                                )
                                Spacer(modifier = Modifier.height(6.dp))
                                Text(
                                    text = formatDisplayTime(uiState.checkOutTime),
                                    fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
                                    fontSize = 17.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = com.governence.faflow.ui.theme.FaflowText1
                                )
                            }
                        }
                    }
                }
            }

            // 3. BIOMETRIC ACTION BUTTON (.btn-checkin)
            item {
                val buttonText = when {
                    hasCheckedOut -> "Test Another Check-In"
                    hasCheckedIn -> "Check out with biometrics"
                    else -> "Check in with biometrics"
                }

                Button(
                    onClick = {
                        if (!hasCheckedIn || hasCheckedOut) {
                            viewModel.prepareSessionForCheckIn()
                        } else {
                            viewModel.prepareSessionForCheckOut()
                        }
                        onNavigateToCheckIn()
                    },
                    enabled = true,
                    shape = RoundedCornerShape(11.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = com.governence.faflow.ui.theme.FaflowNavy,
                        contentColor = Color.White,
                        disabledContainerColor = com.governence.faflow.ui.theme.FaflowNavy.copy(alpha = 0.4f)
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Fingerprint,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = buttonText,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            // 4. ATTENDANCE LEDGER CARD (.list-card)
            item {
                com.governence.faflow.ui.components.FaflowListCard {
                    com.governence.faflow.ui.components.FaflowListRow(
                        icon = Icons.Default.History,
                        iconBg = com.governence.faflow.ui.theme.FaflowSlateTint,
                        iconTint = com.governence.faflow.ui.theme.FaflowSlate,
                        title = "Attendance ledger",
                        subtitle = "Full check-in and check-out history",
                        showDivider = false,
                        onClick = onNavigateToHistory
                    )
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

private fun formatDisplayTime(raw: String?): String {
    if (raw.isNullOrBlank()) return "— : —"
    return try {
        if (raw.contains("T")) {
            val timePart = raw.substringAfter("T").substringBefore("+").substringBefore("Z")
            val parts = timePart.split(":")
            if (parts.size >= 2) {
                "${parts[0].trim()}:${parts[1].trim()}"
            } else {
                timePart
            }
        } else if (raw.contains(":")) {
            val parts = raw.split(":")
            if (parts.size >= 2) {
                "${parts[0].trim()}:${parts[1].trim()}"
            } else {
                raw
            }
        } else {
            raw
        }
    } catch (e: Exception) {
        raw
    }
}

