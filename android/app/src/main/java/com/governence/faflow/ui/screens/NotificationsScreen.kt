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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.NotificationsNone
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.governence.faflow.ui.theme.FaflowBg
import com.governence.faflow.ui.theme.FaflowBorder
import com.governence.faflow.ui.theme.FaflowNavy
import com.governence.faflow.ui.theme.FaflowNavyTint
import com.governence.faflow.ui.theme.FaflowShapes
import com.governence.faflow.ui.theme.FaflowText1
import com.governence.faflow.ui.theme.FaflowText2
import com.governence.faflow.ui.theme.FaflowText3
import com.governence.faflow.ui.theme.PrimaryBlue
import com.governence.faflow.ui.theme.StatusError
import com.governence.faflow.ui.viewmodels.NotificationsViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationsScreen(
    viewModel: NotificationsViewModel,
    onNavigateBack: () -> Unit,
    onNavigateToSubstitution: () -> Unit = {},
    onNavigateToLeaveHistory: () -> Unit = {},
    onNavigateToAttendance: () -> Unit = {}
) {
    val state by viewModel.uiState.collectAsState()
    val context = androidx.compose.ui.platform.LocalContext.current
    var selectedFilter by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf("ALL") }

    val needsAttention = state.notifications.filter { notif ->
        val type = notif.eventType?.lowercase() ?: ""
        val title = notif.title.lowercase()
        val body = notif.body.lowercase()
        type.contains("substitut") || type.contains("leave") || type.contains("action") ||
                title.contains("substitut") || title.contains("leave") || title.contains("urgent") ||
                title.contains("attendance") || notif.relatedLeaveId != null
    }
    val informationOnly = state.notifications.filter { it !in needsAttention }

    val displayedNotifications = when (selectedFilter) {
        "ATTENTION" -> needsAttention
        "INFO" -> informationOnly
        else -> state.notifications
    }

    Scaffold(
        topBar = {
            com.governence.faflow.ui.components.AppTopBar(
                title = "Notification Center",
                subtitle = if (state.unreadCount > 0) "${state.unreadCount} unread notices" else "All updates caught up",
                canNavigateBack = true,
                onNavigateBack = onNavigateBack,
                actions = {
                    if (state.notifications.isNotEmpty()) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            if (state.unreadCount > 0) {
                                TextButton(onClick = { viewModel.markAllRead() }) {
                                    Icon(
                                        Icons.Default.DoneAll,
                                        contentDescription = "Mark All as Read",
                                        tint = PrimaryBlue,
                                        modifier = Modifier.size(18.dp)
                                    )
                                    Spacer(Modifier.width(4.dp))
                                    Text(
                                        "Read All",
                                        color = PrimaryBlue,
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                            TextButton(onClick = { viewModel.clearAll(context) }) {
                                Icon(
                                    Icons.Default.Clear,
                                    contentDescription = "Clear All Notifications",
                                    tint = Color(0xFFE11D48),
                                    modifier = Modifier.size(18.dp)
                                )
                                Spacer(Modifier.width(4.dp))
                                Text(
                                    "Clear All",
                                    color = Color(0xFFE11D48),
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }
            )
        },
        containerColor = FaflowBg
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(FaflowBg)
        ) {
            // Category Segmented Tabs
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp)
                    .clip(FaflowShapes.pill)
                    .background(com.governence.faflow.ui.theme.FaflowDivider)
                    .padding(4.dp)
            ) {
                listOf(
                    "ALL" to "All (${state.notifications.size})",
                    "ATTENTION" to "Needs Attention (${needsAttention.size})",
                    "INFO" to "Information (${informationOnly.size})"
                ).forEach { (key, label) ->
                    val isSelected = selectedFilter == key
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(FaflowShapes.pill)
                            .background(if (isSelected) MaterialTheme.colorScheme.primary else Color.Transparent)
                            .clickable { selectedFilter = key }
                            .padding(vertical = 7.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = label,
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                            color = if (isSelected) Color.White else MaterialTheme.colorScheme.onSurface,
                            maxLines = 1
                        )
                    }
                }
            }

            if (state.isLoading) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = FaflowNavy)
                }
            } else if (displayedNotifications.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            Icons.Default.NotificationsNone,
                            contentDescription = null,
                            tint = FaflowText3,
                            modifier = Modifier.size(56.dp)
                        )
                        Spacer(Modifier.height(12.dp))
                        Text(
                            text = if (selectedFilter == "ATTENTION") "No Action Items" else "No Notifications",
                            fontWeight = FontWeight.Bold,
                            color = FaflowText2,
                            fontSize = 16.sp
                        )
                        Text(
                            text = if (selectedFilter == "ATTENTION") "Everything requiring your attention is cleared." else "You're all caught up!",
                            fontSize = 13.sp,
                            color = FaflowText3
                        )
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(displayedNotifications) { notif ->
                        val isActionRequired = notif in needsAttention
                        val isSubstitution = notif.title.contains("substitut", ignoreCase = true) ||
                                notif.body.contains("substitut", ignoreCase = true)
                        val isLeave = notif.title.contains("leave", ignoreCase = true) ||
                                notif.body.contains("leave", ignoreCase = true)
                        val isAttendance = notif.title.contains("attendance", ignoreCase = true) ||
                                notif.body.contains("attendance", ignoreCase = true)

                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(14.dp))
                                .background(Color.White)
                                .border(
                                    1.dp,
                                    if (isActionRequired) com.governence.faflow.ui.theme.PrimaryBlue.copy(alpha = 0.35f)
                                    else if (!notif.isRead) FaflowNavy.copy(alpha = 0.3f)
                                    else com.governence.faflow.ui.theme.FaflowBorder,
                                    RoundedCornerShape(14.dp)
                                )
                                .clickable {
                                    viewModel.markRead(notif.id)
                                    when {
                                        isSubstitution -> onNavigateToSubstitution()
                                        isLeave -> onNavigateToLeaveHistory()
                                        isAttendance -> onNavigateToAttendance()
                                    }
                                }
                                .padding(16.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.Top
                            ) {
                                // Dot
                                Box(
                                    modifier = Modifier
                                        .padding(top = 5.dp)
                                        .size(8.dp)
                                        .clip(CircleShape)
                                        .background(
                                            if (isActionRequired) com.governence.faflow.ui.theme.PrimaryBlue
                                            else if (!notif.isRead) FaflowNavy
                                            else Color.Transparent
                                        )
                                )
                                Spacer(Modifier.width(10.dp))

                                // Icon
                                Box(
                                    modifier = Modifier
                                        .size(38.dp)
                                        .clip(RoundedCornerShape(10.dp))
                                        .background(
                                            if (isActionRequired) com.governence.faflow.ui.theme.PrimaryBlue.copy(alpha = 0.12f)
                                            else if (!notif.isRead) FaflowNavy.copy(alpha = 0.12f)
                                            else FaflowBg
                                        ),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        Icons.Default.Notifications,
                                        contentDescription = null,
                                        tint = if (isActionRequired) com.governence.faflow.ui.theme.PrimaryBlue
                                        else if (!notif.isRead) FaflowNavy
                                        else FaflowText3,
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                                Spacer(Modifier.width(12.dp))

                                Column(modifier = Modifier.weight(1f)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = notif.title,
                                            fontWeight = if (!notif.isRead || isActionRequired) FontWeight.Bold else FontWeight.SemiBold,
                                            fontSize = 14.sp,
                                            color = if (!notif.isRead || isActionRequired) FaflowText1 else FaflowText2,
                                            modifier = Modifier.weight(1f)
                                        )
                                        if (isActionRequired) {
                                            Box(
                                                modifier = Modifier
                                                    .clip(FaflowShapes.pill)
                                                    .background(com.governence.faflow.ui.theme.PrimaryBlue.copy(alpha = 0.12f))
                                                    .padding(horizontal = 6.dp, vertical = 2.dp)
                                            ) {
                                                Text(
                                                    text = "ACTION",
                                                    fontSize = 9.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = com.governence.faflow.ui.theme.PrimaryBlue
                                                )
                                            }
                                        }
                                    }
                                    if (notif.body.isNotBlank()) {
                                        Spacer(Modifier.height(3.dp))
                                        Text(
                                            text = notif.body,
                                            fontSize = 12.5.sp,
                                            color = FaflowText2
                                        )
                                    }
                                    Spacer(Modifier.height(6.dp))
                                    Text(
                                        text = notif.createdAt,
                                        fontSize = 10.5.sp,
                                        color = FaflowText3
                                    )
                                }
                            }

                            // Contextual Action Row for actionable items
                            if (isActionRequired) {
                                Spacer(Modifier.height(12.dp))
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.End
                                ) {
                                    when {
                                        isSubstitution -> {
                                            com.governence.faflow.ui.components.FaflowPillButton(
                                                text = "Open Substitution",
                                                onClick = {
                                                    viewModel.markRead(notif.id)
                                                    onNavigateToSubstitution()
                                                },
                                                isPrimary = true
                                            )
                                        }
                                        isLeave -> {
                                            com.governence.faflow.ui.components.FaflowPillButton(
                                                text = "View Leave Request",
                                                onClick = {
                                                    viewModel.markRead(notif.id)
                                                    onNavigateToLeaveHistory()
                                                },
                                                isPrimary = true
                                            )
                                        }
                                        isAttendance -> {
                                            com.governence.faflow.ui.components.FaflowPillButton(
                                                text = "Open Attendance",
                                                onClick = {
                                                    viewModel.markRead(notif.id)
                                                    onNavigateToAttendance()
                                                },
                                                isPrimary = true
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
