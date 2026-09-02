package com.governence.faflow.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.governence.faflow.core.network.LeaveOutDto
import com.governence.faflow.core.network.TeacherOutDto
import com.governence.faflow.ui.components.PremiumTopBar
import com.governence.faflow.ui.components.StatusBadge
import com.governence.faflow.ui.theme.FaflowRoleColors
import com.governence.faflow.ui.theme.FaflowShapes
import com.governence.faflow.ui.theme.FaflowSpacing
import com.governence.faflow.ui.theme.FaflowStatusColors
import com.governence.faflow.ui.viewmodels.HodViewModel

@Composable
fun HodLeaveApprovalScreen(
    hodViewModel: HodViewModel,
    onNavigateBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    val leavesState by hodViewModel.leavesState.collectAsState()
    var selectedTab by remember { mutableStateOf("pending") }
    var selectedLeaveForAssign by remember { mutableStateOf<LeaveOutDto?>(null) }

    LaunchedEffect(Unit) {
        hodViewModel.loadDepartmentLeaves()
    }

    Scaffold(
        topBar = {
            PremiumTopBar(
                title = "Leave Requests",
                subtitle = "Department Leave Review & Assignment",
                onNavigateBack = onNavigateBack,
                actions = {
                    IconButton(onClick = { hodViewModel.loadDepartmentLeaves() }) {
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
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = FaflowSpacing.lg)
            ) {
                Spacer(modifier = Modifier.height(FaflowSpacing.sm))

                // Status Filter Chips
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(FaflowSpacing.sm)
                ) {
                    listOf("pending", "approved", "rejected", "all").forEach { tab ->
                        val isSelected = selectedTab == tab
                        FilterChip(
                            selected = isSelected,
                            onClick = { selectedTab = tab },
                            label = {
                                Text(
                                    text = tab.replaceFirstChar { it.uppercase() },
                                    fontWeight = FontWeight.Bold
                                )
                            },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = FaflowRoleColors.HodPrimary,
                                selectedLabelColor = Color.White
                            ),
                            shape = FaflowShapes.pill
                        )
                    }
                }

                Spacer(modifier = Modifier.height(FaflowSpacing.md))

                if (leavesState.isLoading) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = FaflowRoleColors.HodPrimary)
                    }
                } else if (leavesState.errorMessage != null) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(FaflowSpacing.xl),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = leavesState.errorMessage ?: "Failed to load leaves",
                            color = MaterialTheme.colorScheme.error
                        )
                    }
                } else {
                    val filteredLeaves = leavesState.leaves.filter { leave ->
                        if (selectedTab == "all") true else leave.status.lowercase() == selectedTab
                    }

                    if (filteredLeaves.isEmpty()) {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(FaflowSpacing.xxl),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "No ${selectedTab} leave requests found.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    } else {
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            verticalArrangement = Arrangement.spacedBy(FaflowSpacing.md)
                        ) {
                            items(filteredLeaves) { leave ->
                                HodLeaveItemCard(
                                    leave = leave,
                                    onApprove = { hodViewModel.approveLeave(leave.id) },
                                    onReject = { hodViewModel.rejectLeave(leave.id) },
                                    onAssignSubstitute = { selectedLeaveForAssign = leave }
                                )
                            }
                            item {
                                Spacer(modifier = Modifier.height(FaflowSpacing.xl))
                            }
                        }
                    }
                }
            }
        }
    }

    // Assign Substitute Dialog
    if (selectedLeaveForAssign != null) {
        AssignSubstituteDialog(
            leave = selectedLeaveForAssign!!,
            facultyList = leavesState.facultyList.filter { it.id != selectedLeaveForAssign!!.teacherId },
            onDismiss = { selectedLeaveForAssign = null },
            onConfirm = { substituteId ->
                hodViewModel.assignSubstitute(
                    leaveId = selectedLeaveForAssign!!.id,
                    substituteTeacherId = substituteId,
                    periodNumber = selectedLeaveForAssign!!.periodNumber,
                    date = selectedLeaveForAssign!!.date
                )
                selectedLeaveForAssign = null
            }
        )
    }
}

@Composable
fun HodLeaveItemCard(
    leave: LeaveOutDto,
    onApprove: () -> Unit,
    onReject: () -> Unit,
    onAssignSubstitute: () -> Unit,
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
                Column {
                    Text(
                        text = leave.teacherName ?: "Faculty ID: ${leave.teacherId}",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.ExtraBold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        text = "${leave.date} • Period ${leave.periodNumber} (DO ${leave.dayOrder})",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                StatusBadge(status = leave.status)
            }

            Spacer(modifier = Modifier.height(FaflowSpacing.sm))

            Text(
                text = "Reason: ${leave.reason}",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface
            )

            if (leave.alterAssignment?.substituteName != null) {
                Spacer(modifier = Modifier.height(FaflowSpacing.xs))
                Text(
                    text = "Substitute: ${leave.alterAssignment.substituteName}",
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.Bold,
                    color = FaflowStatusColors.Approved
                )
            }

            if (leave.status.lowercase() == "pending") {
                Spacer(modifier = Modifier.height(FaflowSpacing.md))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(FaflowSpacing.sm)
                ) {
                    Button(
                        onClick = onApprove,
                        colors = ButtonDefaults.buttonColors(containerColor = FaflowStatusColors.Approved),
                        shape = FaflowShapes.small,
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(imageVector = Icons.Default.Check, contentDescription = null, modifier = Modifier.padding(end = 4.dp))
                        Text("Approve", fontWeight = FontWeight.Bold)
                    }

                    OutlinedButton(
                        onClick = onReject,
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = FaflowStatusColors.Rejected),
                        shape = FaflowShapes.small,
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(imageVector = Icons.Default.Close, contentDescription = null, modifier = Modifier.padding(end = 4.dp))
                        Text("Reject", fontWeight = FontWeight.Bold)
                    }

                    OutlinedButton(
                        onClick = onAssignSubstitute,
                        shape = FaflowShapes.small,
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(imageVector = Icons.Default.PersonAdd, contentDescription = null, modifier = Modifier.padding(end = 4.dp))
                        Text("Assign", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AssignSubstituteDialog(
    leave: LeaveOutDto,
    facultyList: List<TeacherOutDto>,
    onDismiss: () -> Unit,
    onConfirm: (substituteId: Int) -> Unit
) {
    var selectedFaculty by remember { mutableStateOf(facultyList.firstOrNull()) }
    var isDropdownExpanded by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(text = "Assign Substitute", fontWeight = FontWeight.Bold)
        },
        text = {
            Column {
                Text(
                    text = "Assigning replacement for ${leave.teacherName ?: "Faculty"} on ${leave.date} (Period ${leave.periodNumber}):",
                    style = MaterialTheme.typography.bodyMedium
                )
                Spacer(modifier = Modifier.height(FaflowSpacing.md))

                ExposedDropdownMenuBox(
                    expanded = isDropdownExpanded,
                    onExpandedChange = { isDropdownExpanded = !isDropdownExpanded }
                ) {
                    OutlinedTextField(
                        value = selectedFaculty?.name ?: "Select Faculty",
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Substitute Faculty") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = isDropdownExpanded) },
                        modifier = Modifier.menuAnchor().fillMaxWidth(),
                        shape = FaflowShapes.medium
                    )
                    ExposedDropdownMenu(
                        expanded = isDropdownExpanded,
                        onDismissRequest = { isDropdownExpanded = false }
                    ) {
                        facultyList.forEach { faculty ->
                            DropdownMenuItem(
                                text = { Text(faculty.name) },
                                onClick = {
                                    selectedFaculty = faculty
                                    isDropdownExpanded = false
                                }
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    selectedFaculty?.let { onConfirm(it.id) }
                },
                enabled = selectedFaculty != null,
                colors = ButtonDefaults.buttonColors(containerColor = FaflowRoleColors.HodPrimary)
            ) {
                Text("Confirm Assignment")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}
