package com.governence.faflow.ui.screens

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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForwardIos
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
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.governence.faflow.domain.model.TimetableSlot
import com.governence.faflow.ui.components.DayOrderBadge
import com.governence.faflow.ui.components.FaflowEmptyState
import com.governence.faflow.ui.components.FaflowPillButton
import com.governence.faflow.ui.components.FaflowSectionHeader
import com.governence.faflow.ui.components.FaflowStatusBadge
import com.governence.faflow.ui.components.FaflowSurface
import com.governence.faflow.ui.components.PremiumTopBar
import com.governence.faflow.ui.theme.FaflowRoleColors
import com.governence.faflow.ui.theme.FaflowShapes
import com.governence.faflow.ui.theme.FaflowSpacing
import com.governence.faflow.ui.theme.FaflowStatusColors
import com.governence.faflow.ui.theme.PrimaryBlue
import com.governence.faflow.ui.theme.StatusSuccess
import com.governence.faflow.ui.viewmodels.DashboardViewModel
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Modern Teacher Productivity Dashboard for FAFLOW.
 * Clean, calm, minimal UI inspired by benchmark task management design.
 * Avoids card-overload by using generous whitespace, subtle surfaces, and hairline dividers.
 */
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
    val todayDateFormatted = SimpleDateFormat("EEEE, d MMMM", Locale.getDefault()).format(Date())

    Scaffold(
        topBar = {
            com.governence.faflow.ui.components.FaflowHeaderLockup(
                greeting = "Good morning, ${state.staff?.name ?: "Faculty"}",
                onBellClick = onNavigateToNotifications,
                onSettingsClick = onNavigateToProfile
            )
        },
        containerColor = com.governence.faflow.ui.theme.FaflowBg
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(com.governence.faflow.ui.theme.FaflowBg)
        ) {
            if (state.isLoading && state.staff == null) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(
                        color = com.governence.faflow.ui.theme.FaflowNavy,
                        strokeWidth = 2.5.dp
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 18.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                    contentPadding = PaddingValues(top = 4.dp, bottom = 24.dp)
                ) {
                    // Non-blocking Network Alert
                    if (state.isOfflineOrUnreachable || state.errorMessage != null) {
                        item {
                            FaflowSurface(
                                modifier = Modifier.fillMaxWidth(),
                                backgroundColor = Color(0xFFFEF2F2),
                                borderColor = Color(0xFFFECACA),
                                contentPadding = PaddingValues(12.dp)
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.Refresh,
                                            contentDescription = null,
                                            tint = com.governence.faflow.ui.theme.FaflowDanger,
                                            modifier = Modifier.size(20.dp)
                                        )
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Column {
                                            Text(
                                                text = "Unable to connect to server",
                                                fontSize = 12.5.sp,
                                                fontWeight = FontWeight.SemiBold,
                                                color = com.governence.faflow.ui.theme.FaflowDanger
                                            )
                                            Text(
                                                text = "Check connection or server settings.",
                                                fontSize = 11.sp,
                                                color = com.governence.faflow.ui.theme.FaflowText2
                                            )
                                        }
                                    }
                                    FaflowPillButton(
                                        text = "Retry",
                                        onClick = { viewModel.retry() },
                                        isPrimary = false
                                    )
                                }
                            }
                        }
                    }

                    // 1. HERO CARD (Navy tint, calendar badge, eyebrow, headline, subtext)
                    item {
                        val isClosed = state.todaySummary?.blocksOperations ?: false
                        val eyebrow = SimpleDateFormat("EEEE, d MMMM", Locale.getDefault()).format(Date())
                        val headline = if (isClosed) {
                            "Campus is closed today"
                        } else if (state.todaySlots.isNotEmpty()) {
                            "${state.todaySlots.size} teaching periods assigned"
                        } else {
                            "Campus is open today"
                        }
                        val subtitle = if (isClosed) {
                            "Attendance and duties resume on the next working day."
                        } else if (state.todaySlots.isNotEmpty()) {
                            "Review your period roster and duties below."
                        } else {
                            "Academic operations active. No teaching periods scheduled."
                        }

                        com.governence.faflow.ui.components.FaflowHeroCard(
                            eyebrow = eyebrow,
                            title = headline,
                            subtitle = subtitle,
                            icon = Icons.Default.CalendarMonth,
                            onClick = onNavigateToTimetable
                        )
                    }

                    // 2. STAT GRID (2 columns: Leave credits & Workload balance)
                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            com.governence.faflow.ui.components.FaflowStatCard(
                                icon = Icons.Default.AccountBalanceWallet,
                                iconBg = com.governence.faflow.ui.theme.FaflowGoldTint,
                                iconTint = com.governence.faflow.ui.theme.FaflowGold,
                                number = "${state.creditBalance}",
                                label = "Leave credits available",
                                modifier = Modifier
                                    .weight(1f)
                                    .clickable { onNavigateToCredits() }
                            )

                            com.governence.faflow.ui.components.FaflowStatCard(
                                icon = Icons.Default.SwapHoriz,
                                iconBg = com.governence.faflow.ui.theme.FaflowTealTint,
                                iconTint = com.governence.faflow.ui.theme.FaflowTeal,
                                number = if (state.todaySlots.isNotEmpty()) "+${state.todaySlots.size}" else "+8",
                                label = "Workload balance",
                                modifier = Modifier
                                    .weight(1f)
                                    .clickable { onNavigateToTimetable() }
                            )
                        }
                    }

                    // 3. SECTION HEAD: Faculty services
                    item {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 4.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Faculty services",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                color = com.governence.faflow.ui.theme.FaflowText1
                            )
                        }
                    }

                    // 4. LIST CARD: 3 rows with colored icons
                    item {
                        com.governence.faflow.ui.components.FaflowListCard {
                            com.governence.faflow.ui.components.FaflowListRow(
                                icon = Icons.AutoMirrored.Filled.EventNote,
                                iconBg = com.governence.faflow.ui.theme.FaflowNavyTint,
                                iconTint = com.governence.faflow.ui.theme.FaflowNavy,
                                title = "Apply for leave",
                                subtitle = "Single period or full-day request",
                                showDivider = true,
                                onClick = onNavigateToApplyLeave
                            )
                            com.governence.faflow.ui.components.FaflowListRow(
                                icon = Icons.Default.SwapHoriz,
                                iconBg = com.governence.faflow.ui.theme.FaflowVioletTint,
                                iconTint = com.governence.faflow.ui.theme.FaflowViolet,
                                title = "Substitutions & duties",
                                subtitle = "Review and accept coverage",
                                showDivider = true,
                                onClick = onNavigateToSubstitution
                            )
                            com.governence.faflow.ui.components.FaflowListRow(
                                icon = Icons.Default.CalendarMonth,
                                iconBg = com.governence.faflow.ui.theme.FaflowTealTint,
                                iconTint = com.governence.faflow.ui.theme.FaflowTeal,
                                title = "Classwise timetable",
                                subtitle = "Explore schedules across sections",
                                showDivider = false,
                                onClick = onNavigateToClassTimetable
                            )
                        }
                    }

                    // Today's Timetable Section
                    item {
                        FaflowSectionHeader(
                            title = "Today's Schedule",
                            actionText = "View Full Week",
                            onActionClick = onNavigateToTimetable
                        )
                    }

                    if (state.todaySlots.isEmpty()) {
                        item {
                            FaflowSurface(
                                modifier = Modifier.fillMaxWidth(),
                                contentPadding = PaddingValues(FaflowSpacing.xl)
                            ) {
                                FaflowEmptyState(
                                    title = if (state.todaySummary?.blocksOperations == true) "Non-Working Day" else "No Classes Today",
                                    description = if (state.todaySummary?.blocksOperations == true) "Campus operations are paused for today." else "You have no scheduled teaching periods for today.",
                                    icon = Icons.Default.CalendarMonth
                                )
                            }
                        }
                    } else {
                        item {
                            FaflowSurface(
                                modifier = Modifier.fillMaxWidth(),
                                contentPadding = PaddingValues(0.dp)
                            ) {
                                Column {
                                    state.todaySlots.forEachIndexed { index, slot ->
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .clickable { onNavigateToTimetable() }
                                                .padding(FaflowSpacing.md),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Box(
                                                modifier = Modifier
                                                    .size(36.dp)
                                                    .clip(FaflowShapes.small)
                                                    .background(PrimaryBlue.copy(alpha = 0.08f)),
                                                contentAlignment = Alignment.Center
                                            ) {
                                                Text(
                                                    text = "P${slot.periodNumber}",
                                                    style = MaterialTheme.typography.labelMedium,
                                                    fontWeight = FontWeight.Bold,
                                                    color = PrimaryBlue
                                                )
                                            }
                                            Spacer(modifier = Modifier.width(FaflowSpacing.md))
                                            Column(modifier = Modifier.weight(1f)) {
                                                Text(
                                                    text = slot.subjectName,
                                                    style = MaterialTheme.typography.titleSmall,
                                                    fontWeight = FontWeight.SemiBold,
                                                    color = MaterialTheme.colorScheme.onSurface
                                                )
                                                Text(
                                                    text = "${slot.className} (${slot.section}) • Room ${slot.roomNumber}",
                                                    style = MaterialTheme.typography.bodySmall,
                                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                                )
                                            }
                                            Icon(
                                                imageVector = Icons.AutoMirrored.Filled.ArrowForwardIos,
                                                contentDescription = null,
                                                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f),
                                                modifier = Modifier.size(12.dp)
                                            )
                                        }
                                        if (index < state.todaySlots.lastIndex) {
                                            HorizontalDivider(
                                                color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f),
                                                thickness = 1.dp,
                                                modifier = Modifier.padding(start = 64.dp)
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Faculty Services Group (Unified Surface with Hairline Dividers)
                    item {
                        FaflowSectionHeader(title = "Faculty Services")
                    }

                    item {
                        FaflowSurface(
                            modifier = Modifier.fillMaxWidth(),
                            contentPadding = PaddingValues(0.dp)
                        ) {
                            Column {
                                FacultyServiceRow(
                                    title = "Apply for Leave",
                                    subtitle = "Request day or period leave with instant credit preview",
                                    icon = Icons.AutoMirrored.Filled.EventNote,
                                    iconColor = PrimaryBlue,
                                    onClick = onNavigateToApplyLeave
                                )
                                HorizontalDivider(
                                    color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f),
                                    thickness = 1.dp,
                                    modifier = Modifier.padding(start = 56.dp)
                                )
                                FacultyServiceRow(
                                    title = "Substitutions & Duties",
                                    subtitle = "Review and accept coverage assignments",
                                    icon = Icons.Default.SwapHoriz,
                                    iconColor = FaflowStatusColors.Pending,
                                    onClick = onNavigateToSubstitution
                                )
                                HorizontalDivider(
                                    color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f),
                                    thickness = 1.dp,
                                    modifier = Modifier.padding(start = 56.dp)
                                )
                                FacultyServiceRow(
                                    title = "Leave History",
                                    subtitle = "Track approvals, statuses, and ledger deductions",
                                    icon = Icons.Default.History,
                                    iconColor = FaflowStatusColors.Approved,
                                    onClick = onNavigateToLeaveHistory
                                )
                                HorizontalDivider(
                                    color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f),
                                    thickness = 1.dp,
                                    modifier = Modifier.padding(start = 56.dp)
                                )
                                FacultyServiceRow(
                                    title = "Classwise Timetable",
                                    subtitle = "Explore student schedules across sections",
                                    icon = Icons.Default.CalendarMonth,
                                    iconColor = PrimaryBlue,
                                    onClick = onNavigateToClassTimetable
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun FacultyServiceRow(
    title: String,
    subtitle: String,
    icon: ImageVector,
    iconColor: Color,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .padding(horizontal = FaflowSpacing.md, vertical = FaflowSpacing.md),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .clip(CircleShape)
                .background(iconColor.copy(alpha = 0.1f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = iconColor,
                modifier = Modifier.size(18.dp)
            )
        }
        Spacer(modifier = Modifier.width(FaflowSpacing.md))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        Icon(
            imageVector = Icons.AutoMirrored.Filled.ArrowForwardIos,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f),
            modifier = Modifier.size(12.dp)
        )
    }
}
