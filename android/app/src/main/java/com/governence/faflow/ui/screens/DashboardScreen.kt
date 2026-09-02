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
import androidx.compose.material.icons.automirrored.filled.EventNote
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.SwapHoriz
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import com.governence.faflow.ui.components.AppTopBar
import com.governence.faflow.ui.components.ErrorRetryView
import com.governence.faflow.ui.components.PrimaryGradientButton
import com.governence.faflow.ui.components.StatCard
import com.governence.faflow.ui.theme.CardHighlight
import com.governence.faflow.ui.theme.PrimaryBlue
import com.governence.faflow.ui.theme.SecondaryTeal
import com.governence.faflow.ui.theme.StatusInfo
import com.governence.faflow.ui.theme.StatusSuccess
import com.governence.faflow.ui.theme.StatusWarning
import com.governence.faflow.ui.viewmodels.DashboardViewModel
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun DashboardScreen(
    viewModel: DashboardViewModel,
    onNavigateToCheckIn: () -> Unit,
    onNavigateToTimetable: () -> Unit,
    onNavigateToApplyLeave: () -> Unit,
    onNavigateToLeaveHistory: () -> Unit,
    onNavigateToCredits: () -> Unit,
    onNavigateToSubstitution: () -> Unit,
    onNavigateToAttendanceHistory: () -> Unit,
    onNavigateToNotifications: () -> Unit,
    onNavigateToProfile: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()
    val todayDateFormatted = SimpleDateFormat("EEEE, d MMMM yyyy", Locale.getDefault()).format(Date())

    Scaffold(
        topBar = {
            AppTopBar(
                title = "FAFLOW Staff",
                canNavigateBack = false,
                actions = {
                    IconButton(onClick = onNavigateToNotifications) {
                        Icon(
                            imageVector = Icons.Default.Notifications,
                            contentDescription = "Notifications",
                            tint = MaterialTheme.colorScheme.onBackground
                        )
                    }
                    IconButton(onClick = onNavigateToProfile) {
                        Icon(
                            imageVector = Icons.Default.Person,
                            contentDescription = "Profile",
                            tint = MaterialTheme.colorScheme.onBackground
                        )
                    }
                }
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { innerPadding ->
        if (state.isLoading && state.staff == null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
            }
        } else if (state.errorMessage != null && state.staff == null) {
            ErrorRetryView(
                message = state.errorMessage!!,
                onRetry = { viewModel.retry() },
                modifier = Modifier.padding(innerPadding)
            )
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding),
                contentPadding = PaddingValues(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Staff Info & Day Order Banner
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(24.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surface
                        ),
                        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(20.dp)
                        ) {
                            Text(
                                text = todayDateFormatted,
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.primary,
                                fontWeight = FontWeight.SemiBold
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = state.staff?.name ?: "Faculty Member",
                                        style = MaterialTheme.typography.titleLarge,
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.onSurface
                                    )
                                    Text(
                                        text = "${state.staff?.role?.replaceFirstChar { it.uppercase() } ?: "Faculty"} • ${state.staff?.departmentName ?: "Academic Dept"}",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(PrimaryBlue.copy(alpha = 0.15f))
                                        .padding(horizontal = 12.dp, vertical = 6.dp)
                                ) {
                                    val dayOrderText = if (state.todaySummary?.dayOrder != null) {
                                        "DAY ORDER ${state.todaySummary?.dayOrder}"
                                    } else {
                                        state.todaySummary?.dayType?.replace("_", " ")?.uppercase() ?: "WORKING DAY"
                                    }
                                    Text(
                                        text = dayOrderText,
                                        style = MaterialTheme.typography.labelMedium,
                                        fontWeight = FontWeight.ExtraBold,
                                        color = PrimaryBlue
                                    )
                                }
                            }
                        }
                    }
                }

                // Palgeo Attendance Status Banner Placeholder
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
                                .padding(20.dp)
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(8.dp)
                                        .clip(CircleShape)
                                        .background(StatusSuccess)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = "Campus Geofence: Main Academic Block",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = StatusSuccess,
                                    fontWeight = FontWeight.Bold
                                )
                            }

                            Spacer(modifier = Modifier.height(8.dp))

                            Text(
                                text = "Staff Shift Attendance",
                                style = MaterialTheme.typography.headlineSmall,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurface
                            )

                            Spacer(modifier = Modifier.height(4.dp))

                            Text(
                                text = "Palgeo-style 1-touch biometric check-in with GPS geofencing.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )

                            Spacer(modifier = Modifier.height(16.dp))

                            PrimaryGradientButton(
                                text = "Check In (Biometric + Geofence)",
                                icon = Icons.Default.Fingerprint,
                                onClick = onNavigateToCheckIn
                            )
                        }
                    }
                }

                // Academic & Workload Modules
                item {
                    Text(
                        text = "Academic & Workload Modules",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onBackground
                    )
                }

                item {
                    val slotsCount = state.todaySlots.size
                    val subtitle = if (slotsCount > 0) {
                        "${slotsCount} teaching periods scheduled today"
                    } else {
                        "View full 6-day timetable matrix"
                    }
                    StatCard(
                        title = "Daily Timetable",
                        value = if (slotsCount > 0) "$slotsCount Teaching Periods" else "Timetable Matrix",
                        subtitle = subtitle,
                        icon = Icons.Default.CalendarMonth,
                        iconTint = PrimaryBlue,
                        iconBackground = CardHighlight,
                        onClick = onNavigateToTimetable
                    )
                }

                item {
                    StatCard(
                        title = "Faculty Leave Management",
                        value = "Apply / History",
                        subtitle = "Emergency leave detection & auto-substitution",
                        icon = Icons.AutoMirrored.Filled.EventNote,
                        iconTint = StatusWarning,
                        iconBackground = Color(0x1AF59E0B),
                        onClick = onNavigateToApplyLeave
                    )
                }

                item {
                    val bal = state.creditBalance
                    val balFormatted = if (bal >= 0) "+$bal Credits" else "$bal Credits"
                    StatCard(
                        title = "Workload Credit Balance",
                        value = balFormatted,
                        subtitle = "+1 for substitute duties / -1 for covered leaves",
                        icon = Icons.Default.AccountBalanceWallet,
                        iconTint = StatusSuccess,
                        iconBackground = Color(0x1A10B981),
                        onClick = onNavigateToCredits
                    )
                }

                item {
                    val duties = state.activeDutiesCount
                    StatCard(
                        title = "Substitution Duties",
                        value = if (duties > 0) "$duties Duties Assigned" else "0 Active Duties",
                        subtitle = "View substitute allocations and handover classes",
                        icon = Icons.Default.SwapHoriz,
                        iconTint = SecondaryTeal,
                        iconBackground = Color(0x1A06B6D4),
                        onClick = onNavigateToSubstitution
                    )
                }

                item {
                    StatCard(
                        title = "Monthly Attendance Ledger",
                        value = "Attendance Log",
                        subtitle = "View shift records, timestamps and status",
                        icon = Icons.Default.CheckCircle,
                        iconTint = StatusInfo,
                        iconBackground = Color(0x1A3B82F6),
                        onClick = onNavigateToAttendanceHistory
                    )
                }
            }
        }
    }
}
