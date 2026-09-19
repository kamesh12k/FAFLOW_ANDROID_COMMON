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
import androidx.compose.material.icons.automirrored.filled.Login
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.CloudSync
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material.icons.filled.Groups
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
    onNavigateToProfile: () -> Unit,
    onNavigateToStudentAttendance: (periodNumber: Int?, classId: Int?) -> Unit = { _, _ -> }
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
                                                text = "Offline Mode Active",
                                                fontSize = 12.5.sp,
                                                fontWeight = FontWeight.SemiBold,
                                                color = com.governence.faflow.ui.theme.FaflowDanger
                                            )
                                            Text(
                                                text = "Working offline. Changes are saved securely on device.",
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

                    // Offline Sync Queue Notification (if records pending)
                    if (state.pendingSyncCount > 0) {
                        item {
                            FaflowSurface(
                                modifier = Modifier.fillMaxWidth(),
                                backgroundColor = com.governence.faflow.ui.theme.FaflowGoldTint,
                                borderColor = com.governence.faflow.ui.theme.FaflowGold.copy(alpha = 0.4f),
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
                                            imageVector = Icons.Default.CloudSync,
                                            contentDescription = null,
                                            tint = com.governence.faflow.ui.theme.FaflowGold,
                                            modifier = Modifier.size(20.dp)
                                        )
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Column {
                                            Text(
                                                text = "${state.pendingSyncCount} Records Pending Sync",
                                                fontSize = 12.5.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = com.governence.faflow.ui.theme.FaflowText1
                                            )
                                            Text(
                                                text = "Will automatically upload when connectivity restores.",
                                                fontSize = 11.sp,
                                                color = com.governence.faflow.ui.theme.FaflowText2
                                            )
                                        }
                                    }
                                    FaflowPillButton(
                                        text = "Sync",
                                        onClick = { viewModel.refresh() },
                                        icon = Icons.Default.Refresh,
                                        isPrimary = false
                                    )
                                }
                            }
                        }
                    }

                    // Urgent Substitution Duty Banner (Action Workflow)
                    if (state.urgentSubstituteDuties.isNotEmpty()) {
                        val duty = state.urgentSubstituteDuties.first()
                        item {
                            FaflowSurface(
                                modifier = Modifier.fillMaxWidth(),
                                backgroundColor = Color(0xFFEFF6FF),
                                borderColor = com.governence.faflow.ui.theme.PrimaryBlue.copy(alpha = 0.4f),
                                contentPadding = PaddingValues(14.dp)
                            ) {
                                Column(modifier = Modifier.fillMaxWidth()) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                                        ) {
                                            Box(
                                                modifier = Modifier
                                                    .clip(FaflowShapes.pill)
                                                    .background(com.governence.faflow.ui.theme.PrimaryBlue)
                                                    .padding(horizontal = 8.dp, vertical = 2.dp)
                                            ) {
                                                Text(
                                                    text = "ATTENTION",
                                                    fontSize = 10.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = Color.White
                                                )
                                            }
                                            Text(
                                                text = "Substitution Duty Today",
                                                fontSize = 12.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = com.governence.faflow.ui.theme.PrimaryBlue
                                            )
                                        }
                                        Text(
                                            text = "Period ${duty.periodNumber}",
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = com.governence.faflow.ui.theme.FaflowText1
                                        )
                                    }
                                    Spacer(modifier = Modifier.height(6.dp))
                                    Text(
                                        text = "${duty.className ?: "Assigned Class"} • Covering for ${duty.coveringForName ?: "Faculty"}",
                                        fontSize = 13.5.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = com.governence.faflow.ui.theme.FaflowText1
                                    )
                                    Spacer(modifier = Modifier.height(10.dp))
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        FaflowPillButton(
                                            text = "Mark Class Attendance",
                                            onClick = { onNavigateToStudentAttendance(duty.periodNumber, null) },
                                            icon = Icons.Default.Groups,
                                            isPrimary = true,
                                            modifier = Modifier.weight(1.3f)
                                        )
                                        FaflowPillButton(
                                            text = "View Duty",
                                            onClick = onNavigateToSubstitution,
                                            icon = Icons.Default.SwapHoriz,
                                            isPrimary = false,
                                            modifier = Modifier.weight(0.9f)
                                        )
                                    }
                                }
                            }
                        }
                    }

                    // 1. HERO CARD (Calendar badge, eyebrow, headline, subtext)
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

                    // 3. CONTEXTUAL ACTION HUB (Understands Shift Status + Class Schedule)
                    if (!(state.todaySummary?.blocksOperations ?: false)) {
                        when {
                            // Context 1: Morning Check-In Needed
                            state.shiftState == com.governence.faflow.ui.viewmodels.ShiftState.NOT_STARTED -> {
                                item {
                                    FaflowSurface(
                                        modifier = Modifier.fillMaxWidth(),
                                        backgroundColor = com.governence.faflow.ui.theme.FaflowNavyTint,
                                        borderColor = com.governence.faflow.ui.theme.FaflowNavy.copy(alpha = 0.25f),
                                        contentPadding = PaddingValues(16.dp),
                                        onClick = onNavigateToCheckIn
                                    ) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Column(modifier = Modifier.weight(1f)) {
                                                Box(
                                                    modifier = Modifier
                                                        .clip(FaflowShapes.pill)
                                                        .background(com.governence.faflow.ui.theme.FaflowNavy)
                                                        .padding(horizontal = 8.dp, vertical = 2.dp)
                                                ) {
                                                    Text(
                                                        text = "ATTENDANCE REQUIRED",
                                                        fontSize = 10.sp,
                                                        fontWeight = FontWeight.Bold,
                                                        color = Color.White
                                                    )
                                                }
                                                Spacer(modifier = Modifier.height(6.dp))
                                                Text(
                                                    text = "Morning Shift Check-In",
                                                    fontSize = 16.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = com.governence.faflow.ui.theme.FaflowNavy
                                                )
                                                Text(
                                                    text = "Verify campus presence with face recognition",
                                                    fontSize = 12.sp,
                                                    color = com.governence.faflow.ui.theme.FaflowText2
                                                )
                                            }
                                            Spacer(modifier = Modifier.width(12.dp))
                                            FaflowPillButton(
                                                text = "Check In",
                                                onClick = onNavigateToCheckIn,
                                                icon = Icons.AutoMirrored.Filled.Login,
                                                isPrimary = true
                                            )
                                        }
                                    }
                                }
                            }

                            // Context 2: Currently Teaching Class
                            state.activeSlot != null -> {
                                val currentSlot = state.activeSlot!!
                                item {
                                    FaflowSurface(
                                        modifier = Modifier.fillMaxWidth(),
                                        backgroundColor = com.governence.faflow.ui.theme.FaflowSurface,
                                        borderColor = com.governence.faflow.ui.theme.FaflowNavy.copy(alpha = 0.25f),
                                        contentPadding = PaddingValues(16.dp),
                                        onClick = onNavigateToTimetable
                                    ) {
                                        Column(modifier = Modifier.fillMaxWidth()) {
                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                horizontalArrangement = Arrangement.SpaceBetween,
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Row(
                                                    verticalAlignment = Alignment.CenterVertically,
                                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                                ) {
                                                    Box(
                                                        modifier = Modifier
                                                            .clip(FaflowShapes.pill)
                                                            .background(Color(0xFF059669))
                                                            .padding(horizontal = 8.dp, vertical = 3.dp)
                                                    ) {
                                                        Text(
                                                            text = "IN SESSION • PERIOD ${currentSlot.periodNumber}",
                                                            fontSize = 10.5.sp,
                                                            fontWeight = FontWeight.Bold,
                                                            color = Color.White
                                                        )
                                                    }
                                                }
                                                Text(
                                                    text = "Room ${currentSlot.roomNumber}",
                                                    fontSize = 12.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = com.governence.faflow.ui.theme.FaflowText1
                                                )
                                            }
                                            Spacer(modifier = Modifier.height(8.dp))
                                            Text(
                                                text = currentSlot.subjectName,
                                                fontSize = 16.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = com.governence.faflow.ui.theme.FaflowText1
                                            )
                                            Text(
                                                text = "${currentSlot.className} (${currentSlot.section})",
                                                fontSize = 13.sp,
                                                color = com.governence.faflow.ui.theme.FaflowText2
                                            )
                                            Spacer(modifier = Modifier.height(12.dp))
                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                horizontalArrangement = Arrangement.End
                                            ) {
                                                FaflowPillButton(
                                                    text = "Mark Period ${currentSlot.periodNumber} Attendance",
                                                    onClick = { onNavigateToStudentAttendance(currentSlot.periodNumber, null) },
                                                    icon = Icons.Default.Groups,
                                                    isPrimary = true
                                                )
                                            }
                                        }
                                    }
                                }
                            }

                            // Context 3: Free Period during teaching hours
                            state.isFreePeriod -> {
                                item {
                                    FaflowSurface(
                                        modifier = Modifier.fillMaxWidth(),
                                        backgroundColor = com.governence.faflow.ui.theme.FaflowSurface,
                                        borderColor = com.governence.faflow.ui.theme.FaflowBorder,
                                        contentPadding = PaddingValues(16.dp),
                                        onClick = onNavigateToTimetable
                                    ) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Column(modifier = Modifier.weight(1f)) {
                                                Box(
                                                    modifier = Modifier
                                                        .clip(FaflowShapes.pill)
                                                        .background(com.governence.faflow.ui.theme.FaflowTealTint)
                                                        .padding(horizontal = 8.dp, vertical = 2.dp)
                                                ) {
                                                    Text(
                                                        text = "FREE PERIOD • PERIOD ${state.currentPeriodNumber ?: "-"}",
                                                        fontSize = 10.5.sp,
                                                        fontWeight = FontWeight.Bold,
                                                        color = com.governence.faflow.ui.theme.FaflowTeal
                                                    )
                                                }
                                                Spacer(modifier = Modifier.height(6.dp))
                                                Text(
                                                    text = if (state.nextUpcomingSlot != null) "Next: ${state.nextUpcomingSlot!!.subjectName}" else "No remaining classes today",
                                                    fontSize = 14.5.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = com.governence.faflow.ui.theme.FaflowText1
                                                )
                                                Text(
                                                    text = if (state.nextUpcomingSlot != null) "Period ${state.nextUpcomingSlot!!.periodNumber} in Room ${state.nextUpcomingSlot!!.roomNumber}" else "Academic prep time",
                                                    fontSize = 12.sp,
                                                    color = com.governence.faflow.ui.theme.FaflowText2
                                                )
                                            }
                                            FaflowPillButton(
                                                text = "Timetable",
                                                onClick = onNavigateToTimetable,
                                                icon = Icons.Default.CalendarMonth,
                                                isPrimary = false
                                            )
                                        }
                                    }
                                }
                            }

                            // Context 4: Upcoming Next Activity
                            state.nextUpcomingSlot != null -> {
                                val upcoming = state.nextUpcomingSlot!!
                                item {
                                    FaflowSurface(
                                        modifier = Modifier.fillMaxWidth(),
                                        backgroundColor = com.governence.faflow.ui.theme.FaflowSurface,
                                        borderColor = com.governence.faflow.ui.theme.FaflowNavy.copy(alpha = 0.2f),
                                        contentPadding = PaddingValues(16.dp),
                                        onClick = onNavigateToTimetable
                                    ) {
                                        Column(modifier = Modifier.fillMaxWidth()) {
                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                horizontalArrangement = Arrangement.SpaceBetween,
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Row(
                                                    verticalAlignment = Alignment.CenterVertically,
                                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                                ) {
                                                    Box(
                                                        modifier = Modifier
                                                            .clip(FaflowShapes.pill)
                                                            .background(com.governence.faflow.ui.theme.FaflowNavyTint)
                                                            .padding(horizontal = 8.dp, vertical = 3.dp)
                                                    ) {
                                                        Text(
                                                            text = "PERIOD ${upcoming.periodNumber}",
                                                            fontSize = 11.sp,
                                                            fontWeight = FontWeight.Bold,
                                                            color = com.governence.faflow.ui.theme.FaflowNavy
                                                        )
                                                    }
                                                    Text(
                                                        text = "Upcoming Class",
                                                        fontSize = 12.sp,
                                                        fontWeight = FontWeight.SemiBold,
                                                        color = com.governence.faflow.ui.theme.FaflowText2
                                                    )
                                                }
                                                Text(
                                                    text = "Room ${upcoming.roomNumber}",
                                                    fontSize = 12.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = com.governence.faflow.ui.theme.FaflowText1
                                                )
                                            }
                                            Spacer(modifier = Modifier.height(8.dp))
                                            Text(
                                                text = upcoming.subjectName,
                                                fontSize = 16.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = com.governence.faflow.ui.theme.FaflowText1
                                            )
                                            Text(
                                                text = "${upcoming.className} (${upcoming.section})",
                                                fontSize = 13.sp,
                                                color = com.governence.faflow.ui.theme.FaflowText2
                                            )
                                            Spacer(modifier = Modifier.height(12.dp))
                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                horizontalArrangement = Arrangement.End
                                            ) {
                                                FaflowPillButton(
                                                    text = "Mark Attendance",
                                                    onClick = { onNavigateToStudentAttendance(upcoming.periodNumber, null) },
                                                    icon = Icons.Default.Groups,
                                                    isPrimary = true
                                                )
                                            }
                                        }
                                    }
                                }
                            }

                            // Context 5: Shift Completed
                            state.shiftState == com.governence.faflow.ui.viewmodels.ShiftState.COMPLETED -> {
                                item {
                                    FaflowSurface(
                                        modifier = Modifier.fillMaxWidth(),
                                        backgroundColor = Color(0xFFF0FDF4),
                                        borderColor = Color(0xFFBBF7D0),
                                        contentPadding = PaddingValues(16.dp),
                                        onClick = onNavigateToAttendanceHistory
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
                                                    imageVector = Icons.Default.CheckCircle,
                                                    contentDescription = null,
                                                    tint = Color(0xFF16A34A),
                                                    modifier = Modifier.size(24.dp)
                                                )
                                                Spacer(modifier = Modifier.width(10.dp))
                                                Column {
                                                    Text(
                                                        text = "Shift Attendance Complete",
                                                        fontSize = 14.sp,
                                                        fontWeight = FontWeight.Bold,
                                                        color = Color(0xFF15803D)
                                                    )
                                                    Text(
                                                        text = "Working Duration: ${state.todayWorkingDuration ?: "Standard Shift"}",
                                                        fontSize = 12.sp,
                                                        color = com.governence.faflow.ui.theme.FaflowText2
                                                    )
                                                }
                                            }
                                            FaflowPillButton(
                                                text = "Logs",
                                                onClick = onNavigateToAttendanceHistory,
                                                icon = Icons.Default.History,
                                                isPrimary = false
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // 4. TODAY'S SCHEDULE
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

                    // 5. UNIFIED FACULTY SERVICES
                    item {
                        FaflowSectionHeader(title = "Faculty Services")
                    }

                    item {
                        com.governence.faflow.ui.components.FaflowListCard {
                            com.governence.faflow.ui.components.FaflowListRow(
                                icon = Icons.Default.Groups,
                                iconBg = Color(0xFFEFF6FF),
                                iconTint = PrimaryBlue,
                                title = "Student Attendance",
                                subtitle = "Mark hourly attendance, emergency & substitutions",
                                showDivider = true,
                                onClick = { onNavigateToStudentAttendance(null, null) }
                            )
                            com.governence.faflow.ui.components.FaflowListRow(
                                icon = Icons.AutoMirrored.Filled.EventNote,
                                iconBg = com.governence.faflow.ui.theme.FaflowNavyTint,
                                iconTint = com.governence.faflow.ui.theme.FaflowNavy,
                                title = "Apply for Leave",
                                subtitle = "Single period or full-day leave request",
                                showDivider = true,
                                onClick = onNavigateToApplyLeave
                            )
                            com.governence.faflow.ui.components.FaflowListRow(
                                icon = Icons.Default.History,
                                iconBg = com.governence.faflow.ui.theme.FaflowTealTint,
                                iconTint = com.governence.faflow.ui.theme.FaflowTeal,
                                title = "Leave History",
                                subtitle = "Track approvals, statuses, and ledger deductions",
                                showDivider = true,
                                onClick = onNavigateToLeaveHistory
                            )
                            com.governence.faflow.ui.components.FaflowListRow(
                                icon = Icons.Default.SwapHoriz,
                                iconBg = com.governence.faflow.ui.theme.FaflowVioletTint,
                                iconTint = com.governence.faflow.ui.theme.FaflowViolet,
                                title = "Substitutions & Duties",
                                subtitle = "Review and accept coverage assignments",
                                showDivider = true,
                                onClick = onNavigateToSubstitution
                            )
                            com.governence.faflow.ui.components.FaflowListRow(
                                icon = Icons.Default.CalendarMonth,
                                iconBg = Color(0xFFFEF3C7),
                                iconTint = com.governence.faflow.ui.theme.FaflowGold,
                                title = "Classwise Timetable",
                                subtitle = "Explore student schedules across sections",
                                showDivider = false,
                                onClick = onNavigateToClassTimetable
                            )
                        }
                    }
                }
            }
        }
    }
}
