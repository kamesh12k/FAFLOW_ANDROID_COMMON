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
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.governence.faflow.core.network.AttendanceRecordOutDto
import com.governence.faflow.ui.components.MetricCard
import com.governence.faflow.ui.components.PremiumTopBar
import com.governence.faflow.ui.components.SectionHeader
import com.governence.faflow.ui.components.StatusBadge
import com.governence.faflow.ui.theme.FaflowShapes
import com.governence.faflow.ui.theme.FaflowSpacing
import com.governence.faflow.ui.theme.FaflowStatusColors
import com.governence.faflow.ui.viewmodels.HodViewModel

@Composable
fun HodAttendanceScreen(
    hodViewModel: HodViewModel,
    onNavigateBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    val attendanceState by hodViewModel.attendanceState.collectAsState()

    LaunchedEffect(Unit) {
        hodViewModel.loadLiveAttendance()
    }

    Scaffold(
        topBar = {
            PremiumTopBar(
                title = "Live Attendance",
                subtitle = "Department Attendance & Presence",
                onNavigateBack = onNavigateBack,
                actions = {
                    IconButton(onClick = { hodViewModel.loadLiveAttendance() }) {
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
            if (attendanceState.isLoading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                }
            } else if (attendanceState.errorMessage != null) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(FaflowSpacing.xl),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = attendanceState.errorMessage ?: "Failed to load live status",
                        color = MaterialTheme.colorScheme.error
                    )
                }
            } else {
                val live = attendanceState.liveStatus
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
                            horizontalArrangement = Arrangement.spacedBy(FaflowSpacing.md)
                        ) {
                            MetricCard(
                                title = "Present Today",
                                value = (live?.presentCount ?: 0).toString(),
                                subtitle = "Total ${live?.totalStaff ?: 0} staff",
                                icon = Icons.Default.CheckCircle,
                                iconTint = FaflowStatusColors.Approved,
                                modifier = Modifier.weight(1f)
                            )
                            MetricCard(
                                title = "Absent",
                                value = (live?.absentCount ?: 0).toString(),
                                subtitle = "Unmarked",
                                icon = Icons.Default.Warning,
                                iconTint = if ((live?.absentCount ?: 0) > 0) FaflowStatusColors.Rejected else FaflowStatusColors.Approved,
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }

                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(FaflowSpacing.md)
                        ) {
                            MetricCard(
                                title = "Active on Campus",
                                value = (live?.currentlyActiveCount ?: 0).toString(),
                                subtitle = "Checked in",
                                icon = Icons.Default.Fingerprint,
                                iconTint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.weight(1f)
                            )
                            MetricCard(
                                title = "Checked Out",
                                value = (live?.checkedOutCount ?: 0).toString(),
                                subtitle = "Completed shift",
                                icon = Icons.Default.Logout,
                                iconTint = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }

                    item {
                        SectionHeader(title = "Faculty Attendance Logs (${live?.records?.size ?: 0})")
                    }

                    val records = live?.records ?: emptyList()
                    if (records.isEmpty()) {
                        item {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(FaflowSpacing.xxl),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "No biometric records recorded yet today.",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    } else {
                        items(records) { record ->
                            SupervisorRecordCard(record = record)
                        }
                    }

                    item {
                        Spacer(modifier = Modifier.height(FaflowSpacing.xl))
                    }
                }
            }
        }
    }
}

@Composable
fun SupervisorRecordCard(
    record: AttendanceRecordOutDto,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = FaflowShapes.card,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(
            modifier = Modifier.padding(FaflowSpacing.lg)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = record.staffName ?: "Staff ID: ${record.staffId}",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface
                )
                StatusBadge(status = record.status)
            }

            Spacer(modifier = Modifier.height(FaflowSpacing.sm))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text(
                        text = "Check In",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = record.checkInTime ?: "--:--",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                }

                Column {
                    Text(
                        text = "Check Out",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = record.checkOutTime ?: "--:--",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                }

                Column {
                    Text(
                        text = "Duration",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = record.workingDuration ?: "--",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.primary
                    )
                }
            }
        }
    }
}
