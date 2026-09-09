package com.governence.faflow.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Block
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import com.governence.faflow.ui.components.FaflowPillButton
import com.governence.faflow.ui.components.FaflowStatusBadge
import com.governence.faflow.ui.components.FaflowSurface
import com.governence.faflow.ui.theme.FaflowShapes
import com.governence.faflow.ui.theme.FaflowSpacing
import com.governence.faflow.ui.theme.FaflowStatusColors
import com.governence.faflow.ui.theme.PrimaryBlue
import com.governence.faflow.ui.theme.StatusError
import com.governence.faflow.ui.viewmodels.LeaveViewModel
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private val PERIOD_TIME_MAP = mapOf(
    1 to "8:00–9:00",
    2 to "9:00–10:00",
    3 to "10:15–11:15",
    4 to "11:15–12:15",
    5 to "1:00–2:00"
)

private val REASON_PRESETS = listOf(
    "Personal reason",
    "Medical leave",
    "Conference attendance",
    "Family event"
)

/**
 * Mobile-First Leave Application Screen for FAFLOW.
 * Reinterprets web features natively:
 * - Whole Day vs Custom Periods segmented toggle
 * - Tactile multi-select period chips with period times
 * - Academic calendar holiday resolution & operation block notice
 * - One-tap reason preset chips
 * - Batch leave dispatch
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ApplyLeaveScreen(
    viewModel: LeaveViewModel,
    onNavigateBack: () -> Unit,
    onLeaveSubmitted: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()

    val todayStr = remember { SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date()) }
    var leaveDate by remember { mutableStateOf(todayStr) }
    var isWholeDay by remember { mutableStateOf(true) }
    var selectedPeriods by remember { mutableStateOf(setOf(1, 2, 3, 4, 5)) }
    var reason by remember { mutableStateOf("") }

    LaunchedEffect(leaveDate) {
        if (leaveDate.length == 10) {
            viewModel.resolveDateDayOrder(leaveDate)
        }
    }

    LaunchedEffect(isWholeDay) {
        if (isWholeDay) {
            selectedPeriods = setOf(1, 2, 3, 4, 5)
        } else if (selectedPeriods.size == 5) {
            selectedPeriods = setOf(1)
        }
    }

    Scaffold(
        topBar = {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = FaflowSpacing.md, vertical = FaflowSpacing.sm),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onNavigateBack) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Back",
                        tint = MaterialTheme.colorScheme.onSurface
                    )
                }
                Spacer(modifier = Modifier.width(FaflowSpacing.xs))
                Column {
                    Text(
                        text = "Apply for Leave",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        text = "Request single period or whole-day coverage",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = FaflowSpacing.lg)
                .verticalScroll(rememberScrollState())
        ) {
            Spacer(modifier = Modifier.height(FaflowSpacing.sm))

            // Holiday or Operation Blocked Warning Banner
            if (state.isBlockedDate) {
                FaflowSurface(
                    modifier = Modifier.fillMaxWidth(),
                    backgroundColor = FaflowStatusColors.RejectedBg,
                    borderColor = StatusError.copy(alpha = 0.4f),
                    contentPadding = PaddingValues(FaflowSpacing.md)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.Block,
                            contentDescription = null,
                            tint = StatusError,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(FaflowSpacing.sm))
                        Text(
                            text = "${leaveDate} is marked as a ${state.dayType ?: "Non-Working Day"}. Classes are not scheduled, so leave cannot be submitted.",
                            style = MaterialTheme.typography.bodySmall,
                            fontWeight = FontWeight.SemiBold,
                            color = StatusError
                        )
                    }
                }
                Spacer(modifier = Modifier.height(FaflowSpacing.md))
            } else {
                // Standard Contextual Guidance
                FaflowSurface(
                    modifier = Modifier.fillMaxWidth(),
                    backgroundColor = FaflowStatusColors.PendingBg,
                    borderColor = FaflowStatusColors.Pending.copy(alpha = 0.3f),
                    contentPadding = PaddingValues(FaflowSpacing.md)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.Info,
                            contentDescription = null,
                            tint = FaflowStatusColors.Pending,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(FaflowSpacing.sm))
                        Text(
                            text = "Leaves submitted close to slot time automatically trigger autonomous substitution candidate recommendations.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    }
                }
                Spacer(modifier = Modifier.height(FaflowSpacing.md))
            }

            if (state.errorMessage != null) {
                Text(
                    text = state.errorMessage!!,
                    style = MaterialTheme.typography.bodySmall,
                    color = StatusError,
                    modifier = Modifier.padding(bottom = FaflowSpacing.sm)
                )
            }

            // Mode Selector: Whole Day vs Custom Periods
            Text(
                text = "Absence Duration",
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface
            )
            Spacer(modifier = Modifier.height(FaflowSpacing.xs))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(FaflowShapes.pill)
                    .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
                    .padding(4.dp)
            ) {
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(FaflowShapes.pill)
                        .background(if (isWholeDay) MaterialTheme.colorScheme.primary else Color.Transparent)
                        .clickable { isWholeDay = true }
                        .padding(vertical = 8.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "Whole Day",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = if (isWholeDay) FontWeight.Bold else FontWeight.Medium,
                        color = if (isWholeDay) Color.White else MaterialTheme.colorScheme.onSurface
                    )
                }
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(FaflowShapes.pill)
                        .background(if (!isWholeDay) MaterialTheme.colorScheme.primary else Color.Transparent)
                        .clickable { isWholeDay = false }
                        .padding(vertical = 8.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "Custom Periods",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = if (!isWholeDay) FontWeight.Bold else FontWeight.Medium,
                        color = if (!isWholeDay) Color.White else MaterialTheme.colorScheme.onSurface
                    )
                }
            }

            Spacer(modifier = Modifier.height(FaflowSpacing.md))

            // Leave Date Field
            Text(
                text = "Leave Date (YYYY-MM-DD)",
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface
            )
            Spacer(modifier = Modifier.height(FaflowSpacing.xs))
            OutlinedTextField(
                value = leaveDate,
                onValueChange = { leaveDate = it },
                singleLine = true,
                shape = FaflowShapes.medium,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = PrimaryBlue,
                    unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.4f)
                ),
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(FaflowSpacing.sm))

            // Resolved Day Order Pill
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Calendar Day Order",
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface
                )
                if (state.resolvedDayOrder != null) {
                    FaflowStatusBadge(
                        text = "Day Order ${state.resolvedDayOrder}",
                        statusColor = PrimaryBlue,
                        showDot = true
                    )
                } else {
                    Text(
                        text = "Resolving day order…",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Spacer(modifier = Modifier.height(FaflowSpacing.lg))

            // Period Selector Chips
            Text(
                text = if (isWholeDay) "All Periods Included" else "Select Absence Periods",
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface
            )
            Spacer(modifier = Modifier.height(FaflowSpacing.xs))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                (1..5).forEach { period ->
                    val isSelected = selectedPeriods.contains(period)
                    val bg = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surface
                    val fg = if (isSelected) Color.White else MaterialTheme.colorScheme.onSurface
                    val border = if (isSelected) Color.Transparent else MaterialTheme.colorScheme.outline.copy(alpha = 0.35f)

                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .clip(FaflowShapes.medium)
                            .background(bg)
                            .border(width = 1.dp, color = border, shape = FaflowShapes.medium)
                            .clickable(enabled = !isWholeDay) {
                                selectedPeriods = if (selectedPeriods.contains(period)) {
                                    if (selectedPeriods.size > 1) selectedPeriods - period else selectedPeriods
                                } else {
                                    selectedPeriods + period
                                }
                            }
                            .padding(vertical = 8.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = "P$period",
                            fontSize = 13.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                            color = fg
                        )
                        Text(
                            text = PERIOD_TIME_MAP[period] ?: "",
                            fontSize = 8.sp,
                            color = if (isSelected) Color.White.copy(alpha = 0.85f) else MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(FaflowSpacing.lg))

            // Reason Presets
            Text(
                text = "Reason Presets",
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface
            )
            Spacer(modifier = Modifier.height(FaflowSpacing.xs))
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                REASON_PRESETS.forEach { preset ->
                    val isPicked = reason == preset
                    Box(
                        modifier = Modifier
                            .clip(FaflowShapes.pill)
                            .background(if (isPicked) MaterialTheme.colorScheme.primary.copy(alpha = 0.12f) else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f))
                            .border(
                                width = 1.dp,
                                color = if (isPicked) MaterialTheme.colorScheme.primary else Color.Transparent,
                                shape = FaflowShapes.pill
                            )
                            .clickable { reason = preset }
                            .padding(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            if (isPicked) {
                                Icon(
                                    imageVector = Icons.Default.Check,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.size(12.dp)
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                            }
                            Text(
                                text = preset,
                                style = MaterialTheme.typography.bodySmall,
                                fontWeight = if (isPicked) FontWeight.Bold else FontWeight.Normal,
                                color = if (isPicked) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(FaflowSpacing.md))

            // Detailed Reason Input
            Text(
                text = "Detailed Explanation",
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface
            )
            Spacer(modifier = Modifier.height(FaflowSpacing.xs))
            OutlinedTextField(
                value = reason,
                onValueChange = { reason = it },
                placeholder = { Text("Specify additional details for absence…", style = MaterialTheme.typography.bodySmall) },
                minLines = 3,
                maxLines = 5,
                shape = FaflowShapes.medium,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = PrimaryBlue,
                    unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.4f)
                ),
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(FaflowSpacing.xxl))

            // Submit Button
            val isSubmitEnabled = reason.isNotBlank() && selectedPeriods.isNotEmpty() && !state.isBlockedDate

            if (state.isLoading) {
                CircularProgressIndicator(
                    color = MaterialTheme.colorScheme.primary,
                    strokeWidth = 2.dp,
                    modifier = Modifier.align(Alignment.CenterHorizontally)
                )
            } else {
                FaflowPillButton(
                    text = if (isWholeDay || selectedPeriods.size > 1) "Submit Leave (${selectedPeriods.size} Periods)" else "Submit Leave (Period ${selectedPeriods.first()})",
                    onClick = {
                        if (isSubmitEnabled) {
                            val periodsList = selectedPeriods.toList().sorted()
                            if (periodsList.size > 1) {
                                viewModel.submitLeaveBatch(leaveDate, periodsList, reason, onLeaveSubmitted)
                            } else {
                                viewModel.submitLeave(leaveDate, periodsList.first(), reason, onLeaveSubmitted)
                            }
                        }
                    },
                    enabled = isSubmitEnabled,
                    isPrimary = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }

            Spacer(modifier = Modifier.height(FaflowSpacing.xxxl))
        }
    }
}
