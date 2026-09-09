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
import androidx.compose.foundation.layout.size
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

data class HodLeaveGroup(
    val key: String,
    val teacherId: Int,
    val teacherName: String,
    val department: String?,
    val date: String,
    val dayOrder: Int,
    val status: String,
    val reason: String?,
    val isEmergency: Boolean,
    val createdAt: String?,
    val leaves: List<LeaveOutDto>
) {
    val isFullDay: Boolean get() = leaves.size >= 5 || leaves.map { it.periodNumber }.containsAll(listOf(1, 2, 3, 4, 5))
    val periodSummary: String
        get() = if (isFullDay) "Full Day (P1–P5)"
        else "${leaves.size} ${if (leaves.size == 1) "Period" else "Periods"} · P${leaves.map { it.periodNumber }.sorted().joinToString(", P")}"
}

fun groupDepartmentLeaves(leaves: List<LeaveOutDto>): List<HodLeaveGroup> {
    val map = linkedMapOf<String, MutableList<LeaveOutDto>>()
    for (leave in leaves) {
        val createdDate = leave.createdAt?.substringBefore("T") ?: ""
        val key = "${leave.teacherId}__${leave.date}__${leave.status.lowercase()}__${leave.reason ?: ""}__${createdDate}"
        map.getOrPut(key) { mutableListOf() }.add(leave)
    }
    return map.map { (key, groupLeaves) ->
        val first = groupLeaves.first()
        val sorted = groupLeaves.sortedBy { it.periodNumber }
        HodLeaveGroup(
            key = key,
            teacherId = first.teacherId,
            teacherName = first.teacherName ?: "Faculty ID: ${first.teacherId}",
            department = null,
            date = first.date,
            dayOrder = first.dayOrder,
            status = first.status,
            reason = first.reason,
            isEmergency = groupLeaves.any { it.isEmergency },
            createdAt = first.createdAt,
            leaves = sorted
        )
    }.sortedWith(compareByDescending<HodLeaveGroup> { it.date }.thenByDescending { it.createdAt ?: "" })
}

@Composable
fun HodLeaveApprovalScreen(
    hodViewModel: HodViewModel,
    onNavigateBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    val leavesState by hodViewModel.leavesState.collectAsState()
    var selectedTab by remember { mutableStateOf("pending") }
    var selectedLeaveForAssign by remember { mutableStateOf<LeaveOutDto?>(null) }
    var groupToApprove by remember { mutableStateOf<HodLeaveGroup?>(null) }
    var groupToReject by remember { mutableStateOf<HodLeaveGroup?>(null) }
    var expandedGroupKeys by remember { mutableStateOf(setOf<String>()) }

    // Batch Approve confirmation
    if (groupToApprove != null) {
        val group = groupToApprove!!
        AlertDialog(
            onDismissRequest = { groupToApprove = null },
            icon = {
                Icon(Icons.Default.Check, contentDescription = null,
                    tint = FaflowStatusColors.Approved, modifier = Modifier.size(28.dp))
            },
            title = { Text("Approve Leave?", fontWeight = FontWeight.Bold) },
            text = {
                Text(
                    "Approve ${if (group.isFullDay) "Full Day" else "${group.leaves.size} periods"} leave for ${group.teacherName} on ${group.date} (DO ${group.dayOrder})?\n\nSubstitution coverage will be required.",
                    fontSize = 14.sp
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        hodViewModel.approveLeaves(group.leaves.map { it.id })
                        groupToApprove = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = FaflowStatusColors.Approved)
                ) { Text("Approve All", fontWeight = FontWeight.Bold) }
            },
            dismissButton = {
                TextButton(onClick = { groupToApprove = null }) { Text("Cancel") }
            }
        )
    }

    // Batch Reject confirmation
    if (groupToReject != null) {
        val group = groupToReject!!
        AlertDialog(
            onDismissRequest = { groupToReject = null },
            icon = {
                Icon(Icons.Default.Close, contentDescription = null,
                    tint = FaflowStatusColors.Rejected, modifier = Modifier.size(28.dp))
            },
            title = { Text("Reject Leave?", fontWeight = FontWeight.Bold) },
            text = {
                Text(
                    "Reject leave request (${group.periodSummary}) for ${group.teacherName} on ${group.date}?",
                    fontSize = 14.sp
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        hodViewModel.rejectLeaves(group.leaves.map { it.id })
                        groupToReject = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = FaflowStatusColors.Rejected)
                ) { Text("Reject All", fontWeight = FontWeight.Bold, color = Color.White) }
            },
            dismissButton = {
                TextButton(onClick = { groupToReject = null }) { Text("Keep Pending") }
            }
        )
    }

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

                // Status Filter Chips — horizontally scrollable
                androidx.compose.foundation.lazy.LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(FaflowSpacing.sm),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    val tabs = listOf(
                        "pending" to "Pending",
                        "approved" to "Approved",
                        "rejected" to "Rejected",
                        "all" to "All"
                    )
                    items(tabs) { (key, label) ->
                        val count = if (key == "all") leavesState.leaves.size
                        else leavesState.leaves.count { it.status.lowercase() == key }

                        FilterChip(
                            selected = selectedTab == key,
                            onClick = { selectedTab = key },
                            label = {
                                Text(
                                    text = "$label ($count)",
                                    style = MaterialTheme.typography.labelMedium,
                                    fontWeight = if (selectedTab == key) FontWeight.Bold else FontWeight.Normal
                                )
                            },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = FaflowRoleColors.HodPrimary,
                                selectedLabelColor = MaterialTheme.colorScheme.onPrimary
                            )
                        )
                    }
                }

                Spacer(modifier = Modifier.height(FaflowSpacing.md))

                if (leavesState.isLoading) {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
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
                    val groupedLeaves = groupDepartmentLeaves(filteredLeaves)

                    if (groupedLeaves.isEmpty()) {
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
                            items(groupedLeaves, key = { it.key }) { group ->
                                val isExpanded = expandedGroupKeys.contains(group.key)
                                HodLeaveGroupItemCard(
                                    group = group,
                                    isExpanded = isExpanded,
                                    onToggleExpand = {
                                        expandedGroupKeys = if (isExpanded) {
                                            expandedGroupKeys - group.key
                                        } else {
                                            expandedGroupKeys + group.key
                                        }
                                    },
                                    onApproveAll = { groupToApprove = group },
                                    onRejectAll = { groupToReject = group },
                                    onAssignSubstitute = { leave -> selectedLeaveForAssign = leave }
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
fun HodLeaveGroupItemCard(
    group: HodLeaveGroup,
    isExpanded: Boolean,
    onToggleExpand: () -> Unit,
    onApproveAll: () -> Unit,
    onRejectAll: () -> Unit,
    onAssignSubstitute: (LeaveOutDto) -> Unit,
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
            // Header Row: Teacher Name, Department, Date, Day Order, Status
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = group.teacherName,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.ExtraBold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        text = "${group.date} • DO ${group.dayOrder} • ${group.periodSummary}",
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                StatusBadge(status = group.status)
            }

            Spacer(modifier = Modifier.height(FaflowSpacing.sm))

            if (!group.reason.isNullOrBlank()) {
                Text(
                    text = "Reason: ${group.reason}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }

            if (group.isEmergency) {
                Spacer(modifier = Modifier.height(FaflowSpacing.xs))
                Text(
                    text = "⚠️ Emergency Leave Request",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = FaflowStatusColors.Rejected
                )
            }

            // Summary of substitute assignments across periods
            val coveredCount = group.leaves.count { it.alterAssignment?.substituteName != null }
            if (coveredCount > 0) {
                Spacer(modifier = Modifier.height(FaflowSpacing.xs))
                Text(
                    text = "Coverage: $coveredCount of ${group.leaves.size} periods covered",
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.Bold,
                    color = FaflowStatusColors.Approved
                )
            }

            // Group Action Buttons (for Pending requests)
            if (group.status.lowercase() == "pending") {
                Spacer(modifier = Modifier.height(FaflowSpacing.md))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(FaflowSpacing.sm)
                ) {
                    Button(
                        onClick = onApproveAll,
                        colors = ButtonDefaults.buttonColors(containerColor = FaflowStatusColors.Approved),
                        shape = FaflowShapes.small,
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(imageVector = Icons.Default.Check, contentDescription = null, modifier = Modifier.padding(end = 4.dp))
                        Text(if (group.isFullDay) "Approve Full Day" else "Approve All", fontWeight = FontWeight.Bold)
                    }

                    OutlinedButton(
                        onClick = onRejectAll,
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = FaflowStatusColors.Rejected),
                        shape = FaflowShapes.small,
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(imageVector = Icons.Default.Close, contentDescription = null, modifier = Modifier.padding(end = 4.dp))
                        Text("Reject", fontWeight = FontWeight.Bold)
                    }
                }
            }

            // Expand / Collapse Details Toggle
            Spacer(modifier = Modifier.height(FaflowSpacing.sm))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onToggleExpand() }
                    .padding(vertical = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = if (isExpanded) "Hide period breakdown ▲" else "View ${group.leaves.size} period details ▼",
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold,
                    color = FaflowRoleColors.HodPrimary
                )
            }

            // Detailed period breakdown when expanded
            if (isExpanded) {
                Spacer(modifier = Modifier.height(FaflowSpacing.sm))
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f), FaflowShapes.small)
                        .padding(FaflowSpacing.md),
                    verticalArrangement = Arrangement.spacedBy(FaflowSpacing.sm)
                ) {
                    group.leaves.forEach { leave ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "Period ${leave.periodNumber}",
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.Bold
                                )
                                val subName = leave.alterAssignment?.substituteName
                                if (subName != null) {
                                    Text(
                                        text = "Substitute: $subName",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = FaflowStatusColors.Approved
                                    )
                                } else {
                                    Text(
                                        text = "No substitute assigned",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                            OutlinedButton(
                                onClick = { onAssignSubstitute(leave) },
                                shape = FaflowShapes.small
                            ) {
                                Icon(imageVector = Icons.Default.PersonAdd, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(if (leave.alterAssignment != null) "Reassign" else "Assign", fontSize = 12.sp)
                            }
                        }
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
