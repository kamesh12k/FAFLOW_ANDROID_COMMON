package com.governence.faflow.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AssignmentTurnedIn
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.EventBusy
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.SwapHoriz
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import com.governence.faflow.ui.components.ActionCard
import com.governence.faflow.ui.components.DayOrderBadge
import com.governence.faflow.ui.components.MetricCard
import com.governence.faflow.ui.components.PremiumTopBar
import com.governence.faflow.ui.components.SectionHeader
import com.governence.faflow.ui.theme.FaflowRoleColors
import com.governence.faflow.ui.theme.FaflowShapes
import com.governence.faflow.ui.theme.FaflowSpacing
import com.governence.faflow.ui.theme.FaflowStatusColors
import com.governence.faflow.ui.viewmodels.HodViewModel

@Composable
fun HodDashboardScreen(
    hodViewModel: HodViewModel,
    onNavigateToLeaveApprovals: () -> Unit,
    onNavigateToCoverage: () -> Unit,
    onNavigateToDepartmentTimetable: () -> Unit,
    onNavigateToFacultyDirectory: () -> Unit,
    onNavigateToLiveAttendance: () -> Unit,
    onNavigateToNotifications: () -> Unit,
    modifier: Modifier = Modifier
) {
    val dashboardState by hodViewModel.dashboardState.collectAsState()

    LaunchedEffect(Unit) {
        hodViewModel.loadDashboardData()
    }

    Scaffold(
        topBar = {
            PremiumTopBar(
                title = "HOD Overview",
                subtitle = "Department Management Portal",
                role = "HOD",
                actions = {
                    IconButton(onClick = onNavigateToNotifications) {
                        Icon(
                            imageVector = Icons.Default.Notifications,
                            contentDescription = "Notifications",
                            tint = MaterialTheme.colorScheme.onSurface
                        )
                    }
                    IconButton(onClick = { hodViewModel.loadDashboardData() }) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Refresh",
                            tint = MaterialTheme.colorScheme.onSurface
                        )
                    }
                }
            )
        }
    ) { innerPadding ->
        Box(
            modifier = modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(MaterialTheme.colorScheme.background)
        ) {
            if (dashboardState.isLoading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = FaflowRoleColors.HodPrimary)
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
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "DEPARTMENT METRICS",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            DayOrderBadge(
                                dayOrder = dashboardState.dayOrder,
                                isWorkingDay = dashboardState.isWorkingDay
                            )
                        }
                    }

                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(FaflowSpacing.md)
                        ) {
                            MetricCard(
                                title = "Pending Leaves",
                                value = dashboardState.pendingLeavesCount.toString(),
                                subtitle = "Awaiting review",
                                icon = Icons.Default.EventBusy,
                                iconTint = if (dashboardState.pendingLeavesCount > 0) FaflowStatusColors.Pending else FaflowStatusColors.Approved,
                                modifier = Modifier.weight(1f),
                                onClick = onNavigateToLeaveApprovals
                            )
                            MetricCard(
                                title = "Faculty Active",
                                value = dashboardState.livePresentCount.toString(),
                                subtitle = "Total ${dashboardState.totalFacultyCount}",
                                icon = Icons.Default.People,
                                iconTint = FaflowStatusColors.Approved,
                                modifier = Modifier.weight(1f),
                                onClick = onNavigateToLiveAttendance
                            )
                        }
                    }

                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(FaflowSpacing.md)
                        ) {
                            MetricCard(
                                title = "Slots Covered",
                                value = dashboardState.todayCoveredCount.toString(),
                                subtitle = "${dashboardState.todayUncoveredCount} unassigned",
                                icon = Icons.Default.SwapHoriz,
                                iconTint = FaflowRoleColors.HodPrimary,
                                modifier = Modifier.weight(1f),
                                onClick = onNavigateToCoverage
                            )
                            MetricCard(
                                title = "Dept Absences",
                                value = dashboardState.liveAbsentCount.toString(),
                                subtitle = "Today",
                                icon = Icons.Default.Fingerprint,
                                iconTint = if (dashboardState.liveAbsentCount > 0) FaflowStatusColors.Rejected else FaflowStatusColors.Approved,
                                modifier = Modifier.weight(1f),
                                onClick = onNavigateToLiveAttendance
                            )
                        }
                    }

                    item {
                        SectionHeader(title = "Department Management")
                    }

                    item {
                        ActionCard(
                            title = "Leave Approvals",
                            subtitle = "${dashboardState.pendingLeavesCount} pending requests requiring action",
                            icon = Icons.Default.AssignmentTurnedIn,
                            iconTint = FaflowRoleColors.HodPrimary,
                            badgeText = if (dashboardState.pendingLeavesCount > 0) "${dashboardState.pendingLeavesCount} Pending" else null,
                            onClick = onNavigateToLeaveApprovals
                        )
                    }

                    item {
                        ActionCard(
                            title = "Today's Slot Coverage",
                            subtitle = "Assign and manage substitute teachers for absent faculty",
                            icon = Icons.Default.SwapHoriz,
                            iconTint = FaflowStatusColors.Pending,
                            onClick = onNavigateToCoverage
                        )
                    }

                    item {
                        ActionCard(
                            title = "Department Timetable",
                            subtitle = "View schedules by class, day order, and department faculty",
                            icon = Icons.Default.CalendarMonth,
                            iconTint = MaterialTheme.colorScheme.primary,
                            onClick = onNavigateToDepartmentTimetable
                        )
                    }

                    item {
                        ActionCard(
                            title = "Faculty Directory",
                            subtitle = "View all department teachers, workloads, and contact details",
                            icon = Icons.Default.Groups,
                            iconTint = FaflowRoleColors.HodPrimary,
                            onClick = onNavigateToFacultyDirectory
                        )
                    }

                    item {
                        ActionCard(
                            title = "Live Attendance Status",
                            subtitle = "Real-time biometric punch and premise status for department",
                            icon = Icons.Default.Fingerprint,
                            iconTint = FaflowStatusColors.Approved,
                            onClick = onNavigateToLiveAttendance
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
