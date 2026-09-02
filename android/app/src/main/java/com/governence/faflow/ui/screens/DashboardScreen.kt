package com.governence.faflow.ui.screens

import androidx.compose.foundation.background
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.EventNote
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.MeetingRoom
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.SwapHoriz
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
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.governence.faflow.domain.model.TimetableSlot
import com.governence.faflow.ui.components.ActionCard
import com.governence.faflow.ui.components.DayOrderBadge
import com.governence.faflow.ui.components.MetricCard
import com.governence.faflow.ui.components.PremiumTopBar
import com.governence.faflow.ui.components.RoleBadge
import com.governence.faflow.ui.components.SectionHeader
import com.governence.faflow.ui.theme.FaflowRoleColors
import com.governence.faflow.ui.theme.FaflowShapes
import com.governence.faflow.ui.theme.FaflowSpacing
import com.governence.faflow.ui.theme.FaflowStatusColors
import com.governence.faflow.ui.viewmodels.DashboardViewModel
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun DashboardScreen(
    viewModel: DashboardViewModel,
    onNavigateToCheckIn: () -> Unit,
    onNavigateToTimetable: () -> Unit,
    onNavigateToClassTimetable: () -> Unit,
    onNavigateToTodayCoverage: () -> Unit,
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
            PremiumTopBar(
                title = "FAFLOW Staff",
                subtitle = todayDateFormatted,
                role = state.staff?.role ?: "Faculty",
                actions = {
                    IconButton(onClick = onNavigateToNotifications) {
                        Icon(
                            imageVector = Icons.Default.Notifications,
                            contentDescription = "Notifications",
                            tint = MaterialTheme.colorScheme.onSurface
                        )
                    }
                    IconButton(onClick = onNavigateToProfile) {
                        Icon(
                            imageVector = Icons.Default.Person,
                            contentDescription = "Profile",
                            tint = MaterialTheme.colorScheme.onSurface
                        )
                    }
                }
            )
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(MaterialTheme.colorScheme.background)
        ) {
            if (state.isLoading && !state.isRefreshing) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = FaflowSpacing.lg),
                    verticalArrangement = Arrangement.spacedBy(FaflowSpacing.md)
                ) {
                    item {
                        Spacer(modifier = Modifier.height(FaflowSpacing.xs))
                        // Greeting Header with Day Order Badge
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = "Welcome back,",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                Text(
                                    text = state.staff?.name ?: "Faculty Member",
                                    style = MaterialTheme.typography.titleLarge,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                            }
                            DayOrderBadge(
                                dayOrder = state.todaySummary?.dayOrder,
                                isWorkingDay = !(state.todaySummary?.blocksOperations ?: false) && state.todaySummary?.dayOrder != null
                            )
                        }
                    }

                    // Biometric Attendance Punch Quick Banner
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = FaflowShapes.card,
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primary),
                            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(FaflowSpacing.lg),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(44.dp)
                                            .clip(CircleShape)
                                            .background(Color.White.copy(alpha = 0.2f)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.Fingerprint,
                                            contentDescription = null,
                                            tint = Color.White,
                                            modifier = Modifier.size(24.dp)
                                        )
                                    }
                                    Spacer(modifier = Modifier.width(FaflowSpacing.md))
                                    Column {
                                        Text(
                                            text = "Campus Attendance",
                                            style = MaterialTheme.typography.titleSmall,
                                            fontWeight = FontWeight.Bold,
                                            color = Color.White
                                        )
                                        Text(
                                            text = "Check in or check out with biometric verification",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = Color.White.copy(alpha = 0.85f),
                                            fontSize = 11.sp
                                        )
                                    }
                                }
                                Button(
                                    onClick = onNavigateToCheckIn,
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = Color.White,
                                        contentColor = MaterialTheme.colorScheme.primary
                                    ),
                                    shape = FaflowShapes.pill,
                                    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp)
                                ) {
                                    Text(
                                        text = "Punch",
                                        fontWeight = FontWeight.ExtraBold,
                                        fontSize = 12.sp
                                    )
                                }
                            }
                        }
                    }

                    // Metric Cards Row
                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(FaflowSpacing.md)
                        ) {
                            MetricCard(
                                title = "Casual Leaves",
                                value = "${state.creditBalance} Credits",
                                subtitle = "Available balance",
                                icon = Icons.Default.AccountBalanceWallet,
                                iconTint = FaflowStatusColors.Approved,
                                modifier = Modifier.weight(1f),
                                onClick = onNavigateToCredits
                            )
                            MetricCard(
                                title = "Classes Today",
                                value = "${state.todaySlots.size} Periods",
                                subtitle = if (state.activeDutiesCount > 0) "+${state.activeDutiesCount} Substitution" else "Scheduled",
                                icon = Icons.Default.CalendarMonth,
                                iconTint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.weight(1f),
                                onClick = onNavigateToTimetable
                            )
                        }
                    }

                    // Today's Schedule Section
                    item {
                        SectionHeader(
                            title = "Today's Schedule",
                            actionText = "Full Timetable",
                            onActionClick = onNavigateToTimetable
                        )
                    }

                    if (state.todaySlots.isEmpty()) {
                        item {
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = FaflowShapes.card,
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(FaflowSpacing.xl),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = if (state.todaySummary?.blocksOperations == true) "Holiday / Non-working day today." else "No classes scheduled for today.",
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                        }
                    } else {
                        items(state.todaySlots.size) { index ->
                            val slot = state.todaySlots[index]
                            TeacherSlotPreviewCard(slot = slot)
                        }
                    }

                    // Quick Actions Section
                    item {
                        SectionHeader(title = "Faculty Services")
                    }

                    item {
                        ActionCard(
                            title = "Apply for Leave",
                            subtitle = "Submit single period or full-day leave request",
                            icon = Icons.AutoMirrored.Filled.EventNote,
                            iconTint = FaflowRoleColors.TeacherPrimary,
                            onClick = onNavigateToApplyLeave
                        )
                    }

                    item {
                        ActionCard(
                            title = "Class Timetable",
                            subtitle = "View schedules by class, section, and day order",
                            icon = Icons.Default.CalendarMonth,
                            iconTint = MaterialTheme.colorScheme.primary,
                            onClick = onNavigateToClassTimetable
                        )
                    }

                    item {
                        ActionCard(
                            title = "Today's Slot Coverage",
                            subtitle = "View today's substitutions and coverage assignments",
                            icon = Icons.Default.SwapHoriz,
                            iconTint = FaflowStatusColors.Pending,
                            onClick = onNavigateToTodayCoverage
                        )
                    }

                    item {
                        ActionCard(
                            title = "Leave History",
                            subtitle = "Review status of previous leave submissions",
                            icon = Icons.Default.History,
                            iconTint = FaflowStatusColors.Approved,
                            onClick = onNavigateToLeaveHistory
                        )
                    }

                    item {
                        ActionCard(
                            title = "Attendance History",
                            subtitle = "Monthly punch logs, working hours, and verification status",
                            icon = Icons.Default.Fingerprint,
                            iconTint = MaterialTheme.colorScheme.primary,
                            onClick = onNavigateToAttendanceHistory
                        )
                    }

                    item {
                        Spacer(modifier = Modifier.height(FaflowSpacing.xxl))
                    }
                }
            }
        }
    }
}

@Composable
fun TeacherSlotPreviewCard(
    slot: TimetableSlot,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = FaflowShapes.card,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(FaflowSpacing.md),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .clip(FaflowShapes.small)
                    .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.12f))
                    .padding(horizontal = 10.dp, vertical = 8.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "P${slot.periodNumber}",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.ExtraBold,
                    color = MaterialTheme.colorScheme.primary
                )
            }
            Spacer(modifier = Modifier.width(FaflowSpacing.md))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = slot.subjectName,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Text(
                    text = "${slot.className} (${slot.section}) • ${slot.roomNumber}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}
