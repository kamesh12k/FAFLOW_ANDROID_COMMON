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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForwardIos
import androidx.compose.material.icons.automirrored.filled.EventNote
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.Apartment
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Face
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.SwapHoriz
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.governence.faflow.ui.components.PremiumTopBar
import com.governence.faflow.ui.theme.FaflowRoleColors
import com.governence.faflow.ui.theme.FaflowShapes
import com.governence.faflow.ui.theme.FaflowSpacing
import androidx.compose.material.icons.filled.AssignmentTurnedIn
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.SupervisorAccount
import androidx.compose.material.icons.filled.Sync
import com.governence.faflow.ui.theme.FaflowStatusColors
import com.governence.faflow.ui.theme.PrimaryBlue

@Composable
fun MoreScreen(
    userRole: String? = "teacher",
    onNavigateToApplyLeave: () -> Unit,
    onNavigateToLeaveHistory: () -> Unit,
    onNavigateToCredits: () -> Unit,
    onNavigateToSubstitution: () -> Unit,
    onNavigateToClassTimetable: () -> Unit,
    onNavigateToTodayCoverage: () -> Unit,
    onNavigateToFaceEnrollment: () -> Unit,
    onNavigateToPreferences: () -> Unit,
    onNavigateToNotifications: () -> Unit,
    onNavigateToProfile: () -> Unit,
    onNavigateToLeaveApprovals: () -> Unit = {},
    onNavigateToLiveAttendance: () -> Unit = {},
    onNavigateToFacultyDirectory: () -> Unit = {},
    onNavigateToStudentAttendance: () -> Unit = {},
    onNavigateToAnnouncements: () -> Unit = {},
    onNavigateToCampusDuties: () -> Unit = {},
    onNavigateToCampusStructure: () -> Unit = {},
    onNavigateToSettings: () -> Unit = {},
    onNavigateToSyncStatus: () -> Unit = {},
    onReplayTour: () -> Unit = {}
) {
    val roleLower = userRole?.lowercase() ?: "teacher"
    val isManagement = roleLower == "admin" || roleLower == "hod" || roleLower == "principal" || roleLower == "governance" || roleLower == "manager"

    Scaffold(
        topBar = {
            com.governence.faflow.ui.components.AppTopBar(
                title = if (isManagement) "Operations Hub" else "Faculty Hub",
                subtitle = if (isManagement) "Department administration & oversight" else "Services, preferences & management"
            )
        },
        containerColor = com.governence.faflow.ui.theme.FaflowBg
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(com.governence.faflow.ui.theme.FaflowBg)
                .padding(horizontal = 18.dp),
            contentPadding = PaddingValues(top = 0.dp, bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(0.dp)
        ) {
            if (isManagement) {
                item {
                    Text(
                        text = "DEPARTMENT & GOVERNANCE",
                        fontSize = 10.5.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.08.sp,
                        color = com.governence.faflow.ui.theme.FaflowText3,
                        modifier = Modifier.padding(start = 2.dp, top = 8.dp, bottom = 8.dp)
                    )
                    com.governence.faflow.ui.components.FaflowListCard {
                        com.governence.faflow.ui.components.FaflowListRow(
                            icon = Icons.Default.AssignmentTurnedIn,
                            iconBg = com.governence.faflow.ui.theme.FaflowNavyTint,
                            iconTint = com.governence.faflow.ui.theme.FaflowNavy,
                            title = "Leave approvals queue",
                            subtitle = "Review and approve faculty requests",
                            showDivider = true,
                            onClick = onNavigateToLeaveApprovals
                        )
                        com.governence.faflow.ui.components.FaflowListRow(
                            icon = Icons.Default.SupervisorAccount,
                            iconBg = com.governence.faflow.ui.theme.FaflowVioletTint,
                            iconTint = com.governence.faflow.ui.theme.FaflowViolet,
                            title = "Live attendance shifts",
                            subtitle = "Real-time presence across departments",
                            showDivider = true,
                            onClick = onNavigateToLiveAttendance
                        )
                        com.governence.faflow.ui.components.FaflowListRow(
                            icon = Icons.Default.Groups,
                            iconBg = com.governence.faflow.ui.theme.FaflowGoldTint,
                            iconTint = com.governence.faflow.ui.theme.FaflowGold,
                            title = "Faculty directory",
                            subtitle = "Workload and profile inspection",
                            showDivider = false,
                            onClick = onNavigateToFacultyDirectory
                        )
                    }
                }
            }

            // Group 0: STUDENT ATTENDANCE
            item {
                Text(
                    text = "ACADEMIC ATTENDANCE",
                    fontSize = 10.5.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.08.sp,
                    color = com.governence.faflow.ui.theme.FaflowText3,
                    modifier = Modifier.padding(start = 2.dp, top = if (isManagement) 20.dp else 8.dp, bottom = 8.dp)
                )
                com.governence.faflow.ui.components.FaflowListCard {
                    com.governence.faflow.ui.components.FaflowListRow(
                        icon = Icons.Default.Groups,
                        iconBg = Color(0xFFEFF6FF),
                        iconTint = com.governence.faflow.ui.theme.PrimaryBlue,
                        title = "Student attendance",
                        subtitle = "Per-hour marking, emergency classes & offline sync",
                        showDivider = false,
                        onClick = onNavigateToStudentAttendance
                    )
                }
            }

            // Group: CAMPUS OPERATIONS & DUTIES
            item {
                Text(
                    text = "CAMPUS OPERATIONS & DUTIES",
                    fontSize = 10.5.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.08.sp,
                    color = com.governence.faflow.ui.theme.FaflowText3,
                    modifier = Modifier.padding(start = 2.dp, top = 20.dp, bottom = 8.dp)
                )
                com.governence.faflow.ui.components.FaflowListCard {
                    if (isManagement) {
                        com.governence.faflow.ui.components.FaflowListRow(
                            icon = Icons.Default.Apartment,
                            iconBg = Color(0xFFF3E8FF),
                            iconTint = Color(0xFF7E22CE),
                            title = "Campus structure builder",
                            subtitle = "Map blocks, floors, rooms & exam halls",
                            showDivider = true,
                            onClick = onNavigateToCampusStructure
                        )
                    }
                    com.governence.faflow.ui.components.FaflowListRow(
                        icon = Icons.Default.Security,
                        iconBg = Color(0xFFEFF6FF),
                        iconTint = com.governence.faflow.ui.theme.PrimaryBlue,
                        title = "Campus duties & supervision",
                        subtitle = "Discipline, corridor surveillance & exam duties",
                        showDivider = false,
                        onClick = onNavigateToCampusDuties
                    )
                }
            }

            // Group 1: LEAVES & CREDITS
            item {
                Text(
                    text = "LEAVES & CREDITS",
                    fontSize = 10.5.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.08.sp,
                    color = com.governence.faflow.ui.theme.FaflowText3,
                    modifier = Modifier.padding(start = 2.dp, top = 20.dp, bottom = 8.dp)
                )
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
                        icon = Icons.Default.History,
                        iconBg = com.governence.faflow.ui.theme.FaflowSlateTint,
                        iconTint = com.governence.faflow.ui.theme.FaflowSlate,
                        title = "Leave history",
                        subtitle = "Track approvals and ledger deductions",
                        showDivider = true,
                        onClick = onNavigateToLeaveHistory
                    )
                    com.governence.faflow.ui.components.FaflowListRow(
                        icon = Icons.Default.AccountBalanceWallet,
                        iconBg = com.governence.faflow.ui.theme.FaflowGoldTint,
                        iconTint = com.governence.faflow.ui.theme.FaflowGold,
                        title = "Casual leave credits",
                        subtitle = "Credit ledger and transaction breakdown",
                        showDivider = false,
                        onClick = onNavigateToCredits
                    )
                }
            }

            // Group 2: BIOMETRICS & PREFERENCES
            item {
                Text(
                    text = "BIOMETRICS & PREFERENCES",
                    fontSize = 10.5.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.08.sp,
                    color = com.governence.faflow.ui.theme.FaflowText3,
                    modifier = Modifier.padding(start = 2.dp, top = 20.dp, bottom = 8.dp)
                )
                com.governence.faflow.ui.components.FaflowListCard {
                    com.governence.faflow.ui.components.FaflowListRow(
                        icon = Icons.Default.Face,
                        iconBg = com.governence.faflow.ui.theme.FaflowVioletTint,
                        iconTint = com.governence.faflow.ui.theme.FaflowViolet,
                        title = "Face biometrics enrollment",
                        subtitle = "Institutional face capture & template update",
                        showDivider = true,
                        onClick = onNavigateToFaceEnrollment
                    )
                    com.governence.faflow.ui.components.FaflowListRow(
                        icon = Icons.Default.Tune,
                        iconBg = com.governence.faflow.ui.theme.FaflowTealTint,
                        iconTint = com.governence.faflow.ui.theme.FaflowTeal,
                        title = "Substitution preferences",
                        subtitle = "Daily limits and cross-department options",
                        showDivider = false,
                        onClick = onNavigateToPreferences
                    )
                }
            }

            // Group 3: COMMUNICATIONS
            item {
                Text(
                    text = "COMMUNICATIONS",
                    fontSize = 10.5.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.08.sp,
                    color = com.governence.faflow.ui.theme.FaflowText3,
                    modifier = Modifier.padding(start = 2.dp, top = 20.dp, bottom = 8.dp)
                )
                com.governence.faflow.ui.components.FaflowListCard {
                    com.governence.faflow.ui.components.FaflowListRow(
                        icon = Icons.Default.Campaign,
                        iconBg = Color(0xFFEFF6FF),
                        iconTint = PrimaryBlue,
                        title = "Announcements & circulars",
                        subtitle = "Official institutional notices & broadcasts",
                        showDivider = false,
                        onClick = onNavigateToAnnouncements
                    )
                }
            }

            // Group 4: ACCOUNT & SYSTEM
            item {
                Text(
                    text = "ACCOUNT & SYSTEM",
                    fontSize = 10.5.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.08.sp,
                    color = com.governence.faflow.ui.theme.FaflowText3,
                    modifier = Modifier.padding(start = 2.dp, top = 20.dp, bottom = 8.dp)
                )
                com.governence.faflow.ui.components.FaflowListCard {
                    com.governence.faflow.ui.components.FaflowListRow(
                        icon = Icons.Default.Person,
                        iconBg = com.governence.faflow.ui.theme.FaflowSlateTint,
                        iconTint = com.governence.faflow.ui.theme.FaflowSlate,
                        title = "Staff profile",
                        subtitle = "Personal, institutional and role details",
                        showDivider = true,
                        onClick = onNavigateToProfile
                    )
                    com.governence.faflow.ui.components.FaflowListRow(
                        icon = Icons.Default.Settings,
                        iconBg = com.governence.faflow.ui.theme.FaflowNavyTint,
                        iconTint = com.governence.faflow.ui.theme.FaflowNavy,
                        title = "Application settings",
                        subtitle = "Preferences, server endpoint & theme",
                        showDivider = true,
                        onClick = onNavigateToSettings
                    )
                    com.governence.faflow.ui.components.FaflowListRow(
                        icon = Icons.Default.Sync,
                        iconBg = com.governence.faflow.ui.theme.FaflowTealTint,
                        iconTint = com.governence.faflow.ui.theme.FaflowTeal,
                        title = "Offline sync status",
                        subtitle = "View pending offline queue & sync logs",
                        showDivider = true,
                        onClick = onNavigateToSyncStatus
                    )
                    com.governence.faflow.ui.components.FaflowListRow(
                        icon = Icons.Default.Tune,
                        iconBg = com.governence.faflow.ui.theme.FaflowNavyTint,
                        iconTint = com.governence.faflow.ui.theme.FaflowNavy,
                        title = "Help & Guided Tour",
                        subtitle = "Replay interactive onboarding & view policies",
                        showDivider = false,
                        onClick = onReplayTour
                    )
                }
            }
        }
    }
}

@Composable
fun MoreMenuItem(
    title: String,
    subtitle: String,
    icon: ImageVector,
    iconTint: Color,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = FaflowSpacing.lg, vertical = FaflowSpacing.md),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(FaflowShapes.small)
                .background(iconTint.copy(alpha = 0.12f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = iconTint,
                modifier = Modifier.size(20.dp)
            )
        }
        Spacer(modifier = Modifier.width(FaflowSpacing.md))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
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
            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
            modifier = Modifier.size(12.dp)
        )
    }
}

@Composable
fun MoreMenuDivider() {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(1.dp)
            .padding(horizontal = FaflowSpacing.lg)
            .background(MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f))
    )
}
