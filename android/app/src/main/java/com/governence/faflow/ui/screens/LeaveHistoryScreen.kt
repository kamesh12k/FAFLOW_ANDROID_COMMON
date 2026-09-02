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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.EventBusy
import androidx.compose.material3.AlertDialog
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
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.governence.faflow.domain.model.LeaveRequest
import com.governence.faflow.domain.model.LeaveStatus
import com.governence.faflow.ui.components.AppTopBar
import com.governence.faflow.ui.components.EmptyStateView
import com.governence.faflow.ui.components.ErrorRetryView
import com.governence.faflow.ui.theme.StatusError
import com.governence.faflow.ui.theme.StatusSuccess
import com.governence.faflow.ui.theme.StatusWarning
import com.governence.faflow.ui.viewmodels.LeaveViewModel

@Composable
fun LeaveHistoryScreen(
    viewModel: LeaveViewModel,
    onNavigateBack: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()
    var leaveToCancel by remember { mutableStateOf<LeaveRequest?>(null) }

    if (leaveToCancel != null) {
        AlertDialog(
            onDismissRequest = { leaveToCancel = null },
            title = { Text("Cancel Leave Request") },
            text = { Text("Are you sure you want to cancel your leave request for ${leaveToCancel?.date} (Period ${leaveToCancel?.periodNumber})?") },
            confirmButton = {
                Button(
                    onClick = {
                        leaveToCancel?.let { viewModel.cancelLeave(it.id) }
                        leaveToCancel = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = StatusError)
                ) {
                    Text("Confirm Cancel")
                }
            },
            dismissButton = {
                TextButton(onClick = { leaveToCancel = null }) {
                    Text("Keep Leave")
                }
            }
        )
    }

    Scaffold(
        topBar = {
            AppTopBar(
                title = "Leave Request History",
                canNavigateBack = true,
                onNavigateBack = onNavigateBack
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { innerPadding ->
        if (state.isLoading) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
            }
        } else if (state.errorMessage != null && state.myLeaves.isEmpty()) {
            ErrorRetryView(
                message = state.errorMessage!!,
                onRetry = { viewModel.loadMyLeaves() },
                modifier = Modifier.padding(innerPadding)
            )
        } else if (state.myLeaves.isEmpty()) {
            EmptyStateView(
                title = "No Leave History",
                description = "You have not submitted any faculty leave requests yet.",
                icon = Icons.Default.EventBusy,
                modifier = Modifier.padding(innerPadding)
            )
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(state.myLeaves) { leave ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surface
                        ),
                        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "${leave.date} • Period ${leave.periodNumber} (Day Order ${leave.dayOrder})",
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    LeaveStatusBadge(status = leave.status)
                                    if (leave.status == LeaveStatus.PENDING) {
                                        IconButton(onClick = { leaveToCancel = leave }) {
                                            Icon(
                                                imageVector = Icons.Default.Delete,
                                                contentDescription = "Cancel Leave",
                                                tint = StatusError
                                            )
                                        }
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(6.dp))

                            Text(
                                text = "Reason: ${leave.reason}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )

                            if (leave.substituteTeacherName != null) {
                                Spacer(modifier = Modifier.height(6.dp))
                                Text(
                                    text = "Covered By: ${leave.substituteTeacherName}",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.primary,
                                    fontWeight = FontWeight.SemiBold
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
fun LeaveStatusBadge(status: LeaveStatus) {
    val (bgColor, textColor, label) = when (status) {
        LeaveStatus.APPROVED -> Triple(Color(0x1A10B981), StatusSuccess, "APPROVED")
        LeaveStatus.PENDING -> Triple(Color(0x1AF59E0B), StatusWarning, "PENDING")
        LeaveStatus.REJECTED -> Triple(Color(0x1AEF4444), StatusError, "REJECTED")
        LeaveStatus.CANCELLED -> Triple(Color.Gray.copy(alpha = 0.15f), Color.Gray, "CANCELLED")
    }

    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(bgColor)
            .padding(horizontal = 8.dp, vertical = 4.dp)
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            color = textColor
        )
    }
}
