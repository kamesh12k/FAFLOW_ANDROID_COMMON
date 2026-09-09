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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.SwapHoriz
import androidx.compose.material.icons.filled.Undo
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
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
import androidx.compose.ui.unit.sp
import com.governence.faflow.domain.model.LeaveRequest
import com.governence.faflow.ui.components.AppTopBar
import com.governence.faflow.ui.components.EmptyStateView
import com.governence.faflow.ui.components.ErrorRetryView
import com.governence.faflow.ui.components.FaflowPillButton
import com.governence.faflow.ui.components.FaflowStatusBadge
import com.governence.faflow.ui.components.FaflowSurface
import com.governence.faflow.ui.theme.FaflowShapes
import com.governence.faflow.ui.theme.FaflowSpacing
import com.governence.faflow.ui.theme.FaflowStatusColors
import com.governence.faflow.ui.theme.PrimaryBlue
import com.governence.faflow.ui.theme.SecondaryTeal
import com.governence.faflow.ui.theme.StatusError
import com.governence.faflow.ui.theme.StatusSuccess
import com.governence.faflow.ui.theme.StatusWarning
import com.governence.faflow.ui.viewmodels.SubstitutionViewModel

/**
 * Mobile-First Substitution Allocation & Autonomous Matching Screen for FAFLOW.
 * Features:
 * - Two-tab native segmented control ("My Leaves (Find Substitute)" vs "Assigned to Me")
 * - Smart candidate recommendations bottom sheet with compatibility progress bars
 * - Real-time assign, undo, and cross-department filter
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SubstitutionScreen(
    viewModel: SubstitutionViewModel,
    onNavigateBack: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()
    var includeCrossDept by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            AppTopBar(
                title = "Substitution Allocation",
                canNavigateBack = true,
                onNavigateBack = onNavigateBack
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            // Segmented Tab Switcher
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = FaflowSpacing.lg, vertical = FaflowSpacing.sm)
                    .clip(FaflowShapes.pill)
                    .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
                    .padding(4.dp)
            ) {
                val isNeedsCover = state.activeTab == "NEEDS_COVER"
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(FaflowShapes.pill)
                        .background(if (isNeedsCover) MaterialTheme.colorScheme.primary else Color.Transparent)
                        .clickable { viewModel.setActiveTab("NEEDS_COVER") }
                        .padding(vertical = 8.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "Needs Cover (${state.leavesNeedingCoverage.size})",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = if (isNeedsCover) FontWeight.Bold else FontWeight.Medium,
                        color = if (isNeedsCover) Color.White else MaterialTheme.colorScheme.onSurface
                    )
                }
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(FaflowShapes.pill)
                        .background(if (!isNeedsCover) MaterialTheme.colorScheme.primary else Color.Transparent)
                        .clickable { viewModel.setActiveTab("COVERED") }
                        .padding(vertical = 8.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "Covered (${state.coveredLeaves.size})",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = if (!isNeedsCover) FontWeight.Bold else FontWeight.Medium,
                        color = if (!isNeedsCover) Color.White else MaterialTheme.colorScheme.onSurface
                    )
                }
            }

            // Action Feedback Notification Banner
            if (state.actionMessage != null) {
                FaflowSurface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = FaflowSpacing.lg, vertical = 4.dp),
                    backgroundColor = FaflowStatusColors.ApprovedBg,
                    borderColor = StatusSuccess.copy(alpha = 0.4f),
                    contentPadding = PaddingValues(FaflowSpacing.sm)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.CheckCircle,
                            contentDescription = null,
                            tint = StatusSuccess,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(FaflowSpacing.xs))
                        Text(
                            text = state.actionMessage!!,
                            style = MaterialTheme.typography.bodySmall,
                            color = StatusSuccess,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            }

            if (state.isLoading && state.leavesNeedingCoverage.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                }
            } else if (state.errorMessage != null && state.leavesNeedingCoverage.isEmpty()) {
                ErrorRetryView(
                    message = state.errorMessage!!,
                    onRetry = { viewModel.loadData() }
                )
            } else {
                val currentItems = if (state.activeTab == "NEEDS_COVER") state.leavesNeedingCoverage else state.coveredLeaves

                if (currentItems.isEmpty()) {
                    EmptyStateView(
                        title = if (state.activeTab == "NEEDS_COVER") "No Leaves Pending Cover" else "No Covered Leaves",
                        description = if (state.activeTab == "NEEDS_COVER")
                            "You have no active leave requests that still need a substitute."
                        else
                            "None of your current leaves have a substitute assigned yet.",
                        icon = Icons.Default.SwapHoriz
                    )
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(horizontal = FaflowSpacing.lg, vertical = FaflowSpacing.md),
                        verticalArrangement = Arrangement.spacedBy(FaflowSpacing.md)
                    ) {
                        items(currentItems) { leave ->
                            SubstitutionLeaveCard(
                                leave = leave,
                                isNeedsCover = state.activeTab == "NEEDS_COVER",
                                onFindSubstitute = { viewModel.selectLeaveForCandidates(leave, includeCrossDept) },
                                onUndoAssignment = { viewModel.undoAssignment(leave.id) }
                            )
                        }
                    }
                }
            }
        }

        // Candidate Recommendation Modal Bottom Sheet
        if (state.selectedLeaveForCandidates != null) {
            val selectedLeave = state.selectedLeaveForCandidates!!
            ModalBottomSheet(
                onDismissRequest = { viewModel.dismissCandidateModal() },
                sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = FaflowSpacing.lg)
                        .padding(bottom = FaflowSpacing.xxl)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = "Smart Substitute Match",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "Period ${selectedLeave.periodNumber} • ${selectedLeave.date}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        IconButton(onClick = { viewModel.dismissCandidateModal() }) {
                            Icon(Icons.Default.Close, contentDescription = "Close")
                        }
                    }

                    Spacer(modifier = Modifier.height(FaflowSpacing.sm))

                    // Cross-Department Filter Chip
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Matching Candidates",
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.SemiBold
                        )
                        FilterChip(
                            selected = includeCrossDept,
                            onClick = {
                                includeCrossDept = !includeCrossDept
                                viewModel.selectLeaveForCandidates(selectedLeave, includeCrossDept)
                            },
                            label = { Text("Cross-Dept", fontSize = 11.sp) },
                            leadingIcon = if (includeCrossDept) {
                                { Icon(Icons.Default.CheckCircle, contentDescription = null, modifier = Modifier.size(12.dp)) }
                            } else null,
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = SecondaryTeal.copy(alpha = 0.15f),
                                selectedLabelColor = SecondaryTeal
                            )
                        )
                    }

                    Spacer(modifier = Modifier.height(FaflowSpacing.md))

                    if (state.isLoadingCandidates) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(160.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            CircularProgressIndicator(color = MaterialTheme.colorScheme.primary, strokeWidth = 2.dp)
                        }
                    } else if (state.candidates.isEmpty()) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = FaflowSpacing.lg),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Text(
                                    text = if (includeCrossDept)
                                        "No available substitute faculty found for this slot across departments."
                                    else
                                        "No free faculty found in your department for this slot.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                                    modifier = Modifier.padding(horizontal = 16.dp)
                                )
                                if (!includeCrossDept) {
                                    androidx.compose.material3.OutlinedButton(
                                        onClick = {
                                            includeCrossDept = true
                                            viewModel.selectLeaveForCandidates(selectedLeave, true)
                                        }
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.SwapHoriz,
                                            contentDescription = null,
                                            modifier = Modifier.size(16.dp)
                                        )
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text("Search Cross-Dept Faculty", fontSize = 12.sp)
                                    }
                                }
                            }
                        }
                    } else {
                        LazyColumn(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(320.dp),
                            verticalArrangement = Arrangement.spacedBy(FaflowSpacing.sm)
                        ) {
                            items(state.candidates) { candidate ->
                                CandidateRecommendationRow(
                                    candidate = candidate,
                                    isAssigning = state.isAssignmentInProgress,
                                    onAssign = {
                                        viewModel.assignCandidate(selectedLeave.id, candidate.teacherId)
                                    }
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
fun SubstitutionLeaveCard(
    leave: LeaveRequest,
    isNeedsCover: Boolean,
    onFindSubstitute: () -> Unit,
    onUndoAssignment: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = FaflowShapes.large,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(FaflowSpacing.md)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(FaflowShapes.pill)
                            .background(PrimaryBlue.copy(alpha = 0.12f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "P${leave.periodNumber}",
                            fontWeight = FontWeight.Bold,
                            color = PrimaryBlue,
                            fontSize = 13.sp
                        )
                    }
                    Spacer(modifier = Modifier.width(FaflowSpacing.sm))
                    Column {
                        Text(
                            text = leave.date,
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = if (leave.dayOrder > 0) "Day Order ${leave.dayOrder}" else "Scheduled Class",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                if (leave.substituteTeacherName != null) {
                    FaflowStatusBadge(
                        text = "Covered",
                        statusColor = StatusSuccess,
                        showDot = true
                    )
                } else {
                    FaflowStatusBadge(
                        text = "Unassigned",
                        statusColor = StatusWarning,
                        showDot = true
                    )
                }
            }

            Spacer(modifier = Modifier.height(FaflowSpacing.sm))

            if (leave.reason.isNotBlank()) {
                Text(
                    text = "Reason: ${leave.reason}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2
                )
            }

            Spacer(modifier = Modifier.height(FaflowSpacing.sm))

            if (isNeedsCover) {
                if (leave.substituteTeacherName != null) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Assigned: ${leave.substituteTeacherName}",
                            style = MaterialTheme.typography.bodySmall,
                            fontWeight = FontWeight.SemiBold,
                            color = StatusSuccess
                        )
                        IconButton(onClick = onUndoAssignment) {
                            Icon(
                                imageVector = Icons.Default.Undo,
                                contentDescription = "Undo assignment",
                                tint = MaterialTheme.colorScheme.error,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }
                } else {
                    FaflowPillButton(
                        text = "Find Best Substitute",
                        onClick = onFindSubstitute,
                        isPrimary = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            } else {
                Text(
                    text = "You are assigned to cover this period.",
                    style = MaterialTheme.typography.bodySmall,
                    color = PrimaryBlue,
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }
}

@Composable
fun CandidateRecommendationRow(
    candidate: com.governence.faflow.core.network.RecommendationOutDto,
    isAssigning: Boolean,
    onAssign: () -> Unit
) {
    val score = (candidate.compatibilityScore * 100).toInt()
    val progress = candidate.compatibilityScore.coerceIn(0f, 1f)
    val todayLoad = candidate.todayWorkload
    val weekLoad = candidate.weekWorkload
    val contLoad = candidate.longestContinuousPeriods
    // Projected values after assignment
    val projToday = todayLoad?.let { it + 1 }
    val projWeek = weekLoad?.let { it + 1 }
    val projCont = contLoad?.let { it + 1 }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = FaflowShapes.medium,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f)),
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))
    ) {
        Column(modifier = Modifier.padding(FaflowSpacing.sm)) {
            // Header: Avatar, Name, Dept, Match Score, Assign Button
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                    Box(
                        modifier = Modifier
                            .size(38.dp)
                            .clip(FaflowShapes.pill)
                            .background(PrimaryBlue.copy(alpha = 0.15f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = candidate.teacherName.take(1).uppercase(),
                            fontWeight = FontWeight.Bold,
                            color = PrimaryBlue,
                            fontSize = 16.sp
                        )
                    }
                    Spacer(modifier = Modifier.width(FaflowSpacing.xs))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = candidate.teacherName,
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold
                        )
                        if (candidate.department != null) {
                            Text(
                                text = candidate.department!!,
                                fontSize = 10.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
                FaflowPillButton(
                    text = if (isAssigning) "…" else "Assign",
                    onClick = onAssign,
                    enabled = !isAssigning,
                    isPrimary = true,
                    modifier = Modifier.height(32.dp)
                )
            }

            Spacer(modifier = Modifier.height(FaflowSpacing.xs))

            // Match Score Bar
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                LinearProgressIndicator(
                    progress = { progress },
                    modifier = Modifier
                        .weight(1f)
                        .height(6.dp)
                        .clip(FaflowShapes.pill),
                    color = if (score >= 75) StatusSuccess else if (score >= 45) StatusWarning else MaterialTheme.colorScheme.primary,
                    trackColor = MaterialTheme.colorScheme.surfaceVariant
                )
                Spacer(modifier = Modifier.width(FaflowSpacing.xs))
                Text(
                    text = "$score% match",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (score >= 75) StatusSuccess else if (score >= 45) StatusWarning else MaterialTheme.colorScheme.primary
                )
            }

            // Workload Simulation Metrics Grid (matching web: Today / Back-to-Back / Weekly)
            if (todayLoad != null || weekLoad != null || contLoad != null) {
                Spacer(modifier = Modifier.height(FaflowSpacing.xs))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
                        .padding(vertical = 6.dp),
                    horizontalArrangement = Arrangement.SpaceEvenly
                ) {
                    // Today's load
                    Column(
                        modifier = Modifier.weight(1f),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text("Today", fontSize = 9.sp, color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontWeight = FontWeight.SemiBold)
                        Text(
                            text = if (todayLoad == 0) "Free" else "${todayLoad}→${projToday}",
                            fontSize = 11.sp, fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    }
                    // Vertical separator
                    Box(modifier = Modifier.width(0.5.dp).height(28.dp)
                        .background(MaterialTheme.colorScheme.outline.copy(alpha = 0.3f)))
                    // Back-to-back
                    Column(
                        modifier = Modifier.weight(1f),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text("B2B", fontSize = 9.sp, color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontWeight = FontWeight.SemiBold)
                        val isFatigue = (projCont ?: 0) >= 4
                        Text(
                            text = if (contLoad == null) "—" else "${contLoad}→${projCont}",
                            fontSize = 11.sp, fontWeight = FontWeight.Bold,
                            color = if (isFatigue) StatusWarning else MaterialTheme.colorScheme.onSurface
                        )
                        if (isFatigue) {
                            Text("⚠ fatigue", fontSize = 9.sp, color = StatusWarning,
                                fontWeight = FontWeight.Bold)
                        }
                    }
                    // Vertical separator
                    Box(modifier = Modifier.width(0.5.dp).height(28.dp)
                        .background(MaterialTheme.colorScheme.outline.copy(alpha = 0.3f)))
                    // Weekly
                    Column(
                        modifier = Modifier.weight(1f),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text("Weekly", fontSize = 9.sp, color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontWeight = FontWeight.SemiBold)
                        Text(
                            text = if (weekLoad == null) "—" else "${weekLoad}→${projWeek}",
                            fontSize = 11.sp, fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    }
                }
            }

            // Reason tags
            val reasons = candidate.reasons
            if (reasons.isNotEmpty()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = reasons.take(2).joinToString(" · "),
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1
                )
            }
        }
    }
}
