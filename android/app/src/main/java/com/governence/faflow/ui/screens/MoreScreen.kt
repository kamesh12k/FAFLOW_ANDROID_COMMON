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
import com.governence.faflow.ui.theme.FaflowStatusColors

@Composable
fun MoreScreen(
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
    onNavigateToSettings: () -> Unit
) {
    Scaffold(
        topBar = {
            PremiumTopBar(
                title = "Faculty Hub",
                subtitle = "Services, preferences & management",
                onNavigateBack = null
            )
        }
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(MaterialTheme.colorScheme.background),
            contentPadding = PaddingValues(FaflowSpacing.lg),
            verticalArrangement = Arrangement.spacedBy(FaflowSpacing.lg)
        ) {
            item {
                Text(
                    text = "ACADEMIC & SCHEDULE",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(FaflowSpacing.xs))
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = FaflowShapes.card,
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Column {
                        MoreMenuItem(
                            title = "Class Timetable",
                            subtitle = "View schedules by class, section, and day order",
                            icon = Icons.Default.CalendarMonth,
                            iconTint = MaterialTheme.colorScheme.primary,
                            onClick = onNavigateToClassTimetable
                        )
                        MoreMenuDivider()
                        MoreMenuItem(
                            title = "Today's Slot Coverage",
                            subtitle = "Substitution and coverage schedule",
                            icon = Icons.Default.SwapHoriz,
                            iconTint = FaflowStatusColors.Pending,
                            onClick = onNavigateToTodayCoverage
                        )
                    }
                }
            }

            item {
                Text(
                    text = "LEAVES & CREDITS",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(FaflowSpacing.xs))
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = FaflowShapes.card,
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Column {
                        MoreMenuItem(
                            title = "Apply for Leave",
                            subtitle = "Single period or full-day leave request",
                            icon = Icons.AutoMirrored.Filled.EventNote,
                            iconTint = FaflowRoleColors.TeacherPrimary,
                            onClick = onNavigateToApplyLeave
                        )
                        MoreMenuDivider()
                        MoreMenuItem(
                            title = "Leave History",
                            subtitle = "Review and track status of submitted leaves",
                            icon = Icons.Default.History,
                            iconTint = FaflowStatusColors.Approved,
                            onClick = onNavigateToLeaveHistory
                        )
                        MoreMenuDivider()
                        MoreMenuItem(
                            title = "Casual Leave Credits",
                            subtitle = "Credit ledger and transaction breakdown",
                            icon = Icons.Default.AccountBalanceWallet,
                            iconTint = FaflowStatusColors.Approved,
                            onClick = onNavigateToCredits
                        )
                    }
                }
            }

            item {
                Text(
                    text = "BIOMETRICS & PREFERENCES",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(FaflowSpacing.xs))
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = FaflowShapes.card,
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Column {
                        MoreMenuItem(
                            title = "Face Biometrics Enrollment",
                            subtitle = "Institutional face capture & template update",
                            icon = Icons.Default.Face,
                            iconTint = MaterialTheme.colorScheme.primary,
                            onClick = onNavigateToFaceEnrollment
                        )
                        MoreMenuDivider()
                        MoreMenuItem(
                            title = "Substitution Preferences",
                            subtitle = "Daily limits and cross-department options",
                            icon = Icons.Default.Tune,
                            iconTint = FaflowRoleColors.TeacherPrimary,
                            onClick = onNavigateToPreferences
                        )
                    }
                }
            }

            item {
                Text(
                    text = "ACCOUNT & SETTINGS",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(FaflowSpacing.xs))
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = FaflowShapes.card,
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Column {
                        MoreMenuItem(
                            title = "Staff Profile",
                            subtitle = "View personal, institutional, and role details",
                            icon = Icons.Default.Person,
                            iconTint = MaterialTheme.colorScheme.onSurface,
                            onClick = onNavigateToProfile
                        )
                        MoreMenuDivider()
                        MoreMenuItem(
                            title = "Notifications",
                            subtitle = "Review institutional alerts and status updates",
                            icon = Icons.Default.Notifications,
                            iconTint = FaflowStatusColors.Pending,
                            onClick = onNavigateToNotifications
                        )
                        MoreMenuDivider()
                        MoreMenuItem(
                            title = "App Settings",
                            subtitle = "Server endpoint, cache, and sync diagnostics",
                            icon = Icons.Default.Settings,
                            iconTint = MaterialTheme.colorScheme.onSurfaceVariant,
                            onClick = onNavigateToSettings
                        )
                    }
                }
            }

            item {
                Spacer(modifier = Modifier.height(FaflowSpacing.xl))
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
