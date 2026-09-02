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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForwardIos
import androidx.compose.material.icons.automirrored.filled.EventNote
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.Face
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
import com.governence.faflow.ui.components.AppTopBar
import com.governence.faflow.ui.theme.CardHighlight
import com.governence.faflow.ui.theme.PrimaryBlue
import com.governence.faflow.ui.theme.SecondaryTeal
import com.governence.faflow.ui.theme.StatusInfo
import com.governence.faflow.ui.theme.StatusSuccess
import com.governence.faflow.ui.theme.StatusWarning

@Composable
fun MoreScreen(
    onNavigateToApplyLeave: () -> Unit,
    onNavigateToLeaveHistory: () -> Unit,
    onNavigateToCredits: () -> Unit,
    onNavigateToSubstitution: () -> Unit,
    onNavigateToPreferences: () -> Unit,
    onNavigateToNotifications: () -> Unit,
    onNavigateToProfile: () -> Unit,
    onNavigateToSettings: () -> Unit,
    onNavigateToGeofenceAdmin: () -> Unit = {}
) {
    Scaffold(
        topBar = {
            AppTopBar(
                title = "Faculty Hub",
                canNavigateBack = false
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                Text(
                    text = "Leave & Workload",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Column {
                        MoreMenuItem(
                            title = "Apply Faculty Leave",
                            subtitle = "Period or Full-Day absence with auto-sub",
                            icon = Icons.AutoMirrored.Filled.EventNote,
                            iconTint = StatusWarning,
                            iconBg = Color(0x1AF59E0B),
                            onClick = onNavigateToApplyLeave
                        )
                        MoreMenuItem(
                            title = "Leave Request History",
                            subtitle = "View status, alter assignments & cancellation",
                            icon = Icons.Default.History,
                            iconTint = StatusInfo,
                            iconBg = Color(0x1A3B82F6),
                            onClick = onNavigateToLeaveHistory
                        )
                        MoreMenuItem(
                            title = "Workload Credit Ledger",
                            subtitle = "Duty credits (+1), leave deductions & balance",
                            icon = Icons.Default.AccountBalanceWallet,
                            iconTint = StatusSuccess,
                            iconBg = Color(0x1A10B981),
                            onClick = onNavigateToCredits
                        )
                        MoreMenuItem(
                            title = "Substitution Allocation",
                            subtitle = "Assigned substitute duties & handed over classes",
                            icon = Icons.Default.SwapHoriz,
                            iconTint = SecondaryTeal,
                            iconBg = Color(0x1A06B6D4),
                            onClick = onNavigateToSubstitution
                        )
                    }
                }
            }

            item {
                Text(
                    text = "Campus Operations & Administration",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Column {
                        MoreMenuItem(
                            title = "Campus Geofence Perimeters",
                            subtitle = "Configure circular & polygon attendance boundaries",
                            icon = Icons.Default.Tune,
                            iconTint = SecondaryTeal,
                            iconBg = Color(0x1A06B6D4),
                            onClick = onNavigateToGeofenceAdmin
                        )
                    }
                }
            }

            item {
                Text(
                    text = "Preferences & Communication",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Column {
                        MoreMenuItem(
                            title = "Substitution Preferences",
                            subtitle = "Daily/weekly limits & cross-department settings",
                            icon = Icons.Default.Tune,
                            iconTint = PrimaryBlue,
                            iconBg = CardHighlight,
                            onClick = onNavigateToPreferences
                        )
                        MoreMenuItem(
                            title = "Institutional Notifications",
                            subtitle = "Duty assignments, approvals and system alerts",
                            icon = Icons.Default.Notifications,
                            iconTint = PrimaryBlue,
                            iconBg = CardHighlight,
                            onClick = onNavigateToNotifications
                        )
                    }
                }
            }

            item {
                Text(
                    text = "Account & System",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Column {
                        MoreMenuItem(
                            title = "Faculty Profile",
                            subtitle = "Identity, department & biometric status",
                            icon = Icons.Default.Person,
                            iconTint = PrimaryBlue,
                            iconBg = CardHighlight,
                            onClick = onNavigateToProfile
                        )
                        MoreMenuItem(
                            title = "Server Connection & Settings",
                            subtitle = "FAFLOW API URL and network preferences",
                            icon = Icons.Default.Settings,
                            iconTint = Color.Gray,
                            iconBg = Color.Gray.copy(alpha = 0.15f),
                            onClick = onNavigateToSettings
                        )
                    }
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
    iconBg: Color,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(iconBg),
            contentAlignment = Alignment.Center
        ) {
            Icon(imageVector = icon, contentDescription = null, tint = iconTint, modifier = Modifier.size(22.dp))
        }

        Spacer(modifier = Modifier.width(16.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(text = title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
            Text(text = subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }

        Icon(
            imageVector = Icons.AutoMirrored.Filled.ArrowForwardIos,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
            modifier = Modifier.size(16.dp)
        )
    }
}
