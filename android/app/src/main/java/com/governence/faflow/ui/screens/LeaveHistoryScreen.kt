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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Block
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.EventBusy
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.governence.faflow.domain.model.LeaveHistoryDay
import com.governence.faflow.domain.model.LeaveRequest
import com.governence.faflow.domain.model.LeaveStatus
import com.governence.faflow.ui.components.AppTopBar
import com.governence.faflow.ui.components.EmptyStateView
import com.governence.faflow.ui.components.ErrorRetryView
import com.governence.faflow.ui.components.FaflowStatusBadge
import com.governence.faflow.ui.theme.FaflowBg
import com.governence.faflow.ui.theme.FaflowBorder
import com.governence.faflow.ui.theme.FaflowNavy
import com.governence.faflow.ui.theme.FaflowNavyTint
import com.governence.faflow.ui.theme.FaflowText1
import com.governence.faflow.ui.theme.FaflowText2
import com.governence.faflow.ui.theme.FaflowText3
import com.governence.faflow.ui.theme.StatusError
import com.governence.faflow.ui.theme.StatusSuccess
import com.governence.faflow.ui.theme.StatusWarning
import com.governence.faflow.ui.viewmodels.LeaveViewModel
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

private val PERIOD_TIME_MAP = mapOf(
    1 to "8:00–9:00",
    2 to "9:00–10:00",
    3 to "10:15–11:15",
    4 to "11:15–12:15",
    5 to "1:00–2:00"
)

private fun formatDisplayDate(isoStr: String): String {
    return try {
        val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        val dt = sdf.parse(isoStr) ?: return isoStr
        SimpleDateFormat("d MMM yyyy", Locale.getDefault()).format(dt)
    } catch (e: Exception) { isoStr }
}

private fun formatDayMonth(isoStr: String): String {
    return try {
        val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        val dt = sdf.parse(isoStr) ?: return isoStr
        SimpleDateFormat("dd MMM", Locale.getDefault()).format(dt).uppercase()
    } catch (e: Exception) { isoStr }
}

private fun formatDayOfWeek(isoStr: String): String {
    return try {
        val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        val dt = sdf.parse(isoStr) ?: return ""
        SimpleDateFormat("EEEE", Locale.getDefault()).format(dt)
    } catch (e: Exception) { "" }
}

/** Determines whether a leave request can be cancelled per FAFLOW business rules:
 * - Past dates: NOT cancellable
 * - Same-day after 10:00 AM: NOT cancellable
 * - Already cancelled / rejected: NOT cancellable
 * Returns Pair(allowed, reason)
 */
private fun getCancelability(leave: LeaveRequest): Pair<Boolean, String?> {
    if (leave.status == LeaveStatus.CANCELLED || leave.status == LeaveStatus.REJECTED) {
        return Pair(false, null)
    }
    val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
    return try {
        val leaveDate = dateFormat.parse(leave.date) ?: return Pair(false, "Invalid date")
        val now = Calendar.getInstance()
        val todayCal = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
        }
        val leaveCal = Calendar.getInstance().apply {
            time = leaveDate
            set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
        }
        when {
            leaveCal.before(todayCal) -> Pair(false, "Past leaves cannot be cancelled.")
            leaveCal == todayCal && now.get(Calendar.HOUR_OF_DAY) >= 10 ->
                Pair(false, "Same-day cancellation is only available before 10:00 AM.")
            else -> Pair(true, null)
        }
    } catch (e: Exception) {
        Pair(false, "Cannot determine cancellability.")
    }
}

private fun getDayGroupCancelability(dayGroup: LeaveHistoryDay): Pair<Boolean, String?> {
    if (dayGroup.status == LeaveStatus.CANCELLED || dayGroup.status == LeaveStatus.REJECTED) {
        return Pair(false, null)
    }
    val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
    return try {
        val leaveDate = dateFormat.parse(dayGroup.date) ?: return Pair(false, "Invalid date")
        val now = Calendar.getInstance()
        val todayCal = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
        }
        val leaveCal = Calendar.getInstance().apply {
            time = leaveDate
            set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
        }
        when {
            leaveCal.before(todayCal) -> Pair(false, "Past leaves cannot be cancelled.")
            leaveCal == todayCal && now.get(Calendar.HOUR_OF_DAY) >= 10 ->
                Pair(false, "Same-day cancellation is only available before 10:00 AM.")
            else -> {
                val hasCancellable = dayGroup.periods.any {
                    it.status == LeaveStatus.PENDING || it.status == LeaveStatus.APPROVED
                }
                if (hasCancellable) Pair(true, null)
                else Pair(false, "All periods in this request are already processed or cancelled.")
            }
        }
    } catch (e: Exception) {
        Pair(false, "Cannot determine cancellability.")
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LeaveHistoryScreen(
    viewModel: LeaveViewModel,
    onNavigateBack: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()
    var groupToCancel by remember { mutableStateOf<LeaveHistoryDay?>(null) }
    var singleLeaveToCancel by remember { mutableStateOf<LeaveRequest?>(null) }
    var cancelBlockedReason by remember { mutableStateOf<String?>(null) }
    var selectedDetailGroup by remember { mutableStateOf<LeaveHistoryDay?>(null) }
    var selectedFilterTab by rememberSaveable { mutableStateOf("ALL") }
    var searchQuery by rememberSaveable { mutableStateOf("") }
    val bottomSheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    // Group cancellation confirmation dialog
    if (groupToCancel != null) {
        val group = groupToCancel!!
        AlertDialog(
            onDismissRequest = { groupToCancel = null },
            icon = {
                Icon(
                    imageVector = Icons.Default.Warning,
                    contentDescription = null,
                    tint = StatusError,
                    modifier = Modifier.size(28.dp)
                )
            },
            title = {
                Text(
                    "Cancel Leave Request",
                    fontWeight = FontWeight.Bold,
                    fontSize = 17.sp
                )
            },
            text = {
                Text(
                    "Cancel your ${group.leaveTypeDisplay.lowercase()} for ${formatDisplayDate(group.date)} " +
                    "(${group.periods.size} ${if (group.periods.size == 1) "period" else "periods"})?\n\n" +
                    "Any deducted credits or substitute reservations will be reverted.",
                    fontSize = 14.sp,
                    color = FaflowText2
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.cancelLeaveGroup(group)
                        groupToCancel = null
                        selectedDetailGroup = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = StatusError)
                ) {
                    Text("Confirm Cancel", color = Color.White, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { groupToCancel = null }) {
                    Text("Keep Leave")
                }
            }
        )
    }

    // Single period cancellation confirmation dialog
    if (singleLeaveToCancel != null) {
        val single = singleLeaveToCancel!!
        AlertDialog(
            onDismissRequest = { singleLeaveToCancel = null },
            icon = {
                Icon(
                    imageVector = Icons.Default.Warning,
                    contentDescription = null,
                    tint = StatusError,
                    modifier = Modifier.size(28.dp)
                )
            },
            title = {
                Text(
                    "Cancel Period P${single.periodNumber}",
                    fontWeight = FontWeight.Bold,
                    fontSize = 17.sp
                )
            },
            text = {
                Text(
                    "Cancel Period P${single.periodNumber} on ${formatDisplayDate(single.date)}?\n\n" +
                    "Any substitute coverage for this period will be reverted.",
                    fontSize = 14.sp,
                    color = FaflowText2
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.cancelLeave(single.id)
                        singleLeaveToCancel = null
                        selectedDetailGroup = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = StatusError)
                ) {
                    Text("Cancel Period", color = Color.White, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { singleLeaveToCancel = null }) {
                    Text("Keep Period")
                }
            }
        )
    }

    // Cancel-blocked explanation dialog
    if (cancelBlockedReason != null) {
        AlertDialog(
            onDismissRequest = { cancelBlockedReason = null },
            icon = {
                Icon(Icons.Default.Block, contentDescription = null,
                    tint = FaflowText2, modifier = Modifier.size(26.dp))
            },
            title = { Text("Cannot Cancel", fontWeight = FontWeight.Bold) },
            text = { Text(cancelBlockedReason!!, fontSize = 14.sp, color = FaflowText2) },
            confirmButton = {
                TextButton(onClick = { cancelBlockedReason = null }) { Text("OK") }
            }
        )
    }

    // Leave detail bottom sheet
    if (selectedDetailGroup != null) {
        val group = selectedDetailGroup!!
        val (canCancel, blockReason) = getDayGroupCancelability(group)

        ModalBottomSheet(
            onDismissRequest = { selectedDetailGroup = null },
            sheetState = bottomSheetState,
            containerColor = MaterialTheme.colorScheme.surface
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp)
                    .padding(bottom = 32.dp)
            ) {
                // Header Row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = formatDisplayDate(group.date),
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                            color = FaflowText1
                        )
                        Text(
                            text = "${group.leaveTypeDisplay} · ${if (group.dayOrder > 0) "Day Order ${group.dayOrder}" else "Teaching Day"}",
                            fontSize = 13.sp,
                            color = FaflowText2
                        )
                    }
                    LeaveStatusBadge(status = group.status)
                }

                Spacer(Modifier.height(16.dp))

                // Metadata Rows
                DetailRow(label = "Reason", value = group.reason.ifBlank { "—" })
                if (group.isEmergency) {
                    DetailRow(label = "Classification", value = "Emergency Leave", valueColor = StatusError)
                }

                Spacer(Modifier.height(16.dp))
                Text(
                    text = "Periods Covered (${group.periods.size})",
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    color = FaflowText1
                )
                Spacer(Modifier.height(8.dp))

                // Underlying Periods List
                group.periods.forEach { period ->
                    val (periodCanCancel, _) = getCancelability(period)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(FaflowBg)
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(32.dp)
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(FaflowNavyTint),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    "P${period.periodNumber}",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 12.sp,
                                    color = FaflowNavy
                                )
                            }
                            Spacer(Modifier.width(10.dp))
                            Column {
                                Text(
                                    text = PERIOD_TIME_MAP[period.periodNumber] ?: "Period ${period.periodNumber}",
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 12.sp,
                                    color = FaflowText1
                                )
                                if (!period.substituteTeacherName.isNullOrBlank()) {
                                    Text(
                                        text = "Cover: ${period.substituteTeacherName}",
                                        fontSize = 11.sp,
                                        color = StatusSuccess,
                                        fontWeight = FontWeight.Medium
                                    )
                                } else if (group.status == LeaveStatus.APPROVED) {
                                    Text(
                                        text = "Needs Coverage",
                                        fontSize = 11.sp,
                                        color = StatusWarning,
                                        fontWeight = FontWeight.Medium
                                    )
                                } else {
                                    Text(
                                        text = "Pending approval",
                                        fontSize = 11.sp,
                                        color = FaflowText3
                                    )
                                }
                            }
                        }

                        if (group.periods.size > 1 && periodCanCancel) {
                            TextButton(
                                onClick = { singleLeaveToCancel = period },
                                contentPadding = PaddingValues(horizontal = 6.dp, vertical = 2.dp)
                            ) {
                                Text("Cancel", fontSize = 11.sp, color = StatusError, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }

                // Group Cancel Action
                if (group.status == LeaveStatus.PENDING || group.status == LeaveStatus.APPROVED) {
                    Spacer(Modifier.height(20.dp))
                    HorizontalDivider(color = FaflowBorder)
                    Spacer(Modifier.height(16.dp))

                    if (canCancel) {
                        Button(
                            onClick = { groupToCancel = group },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(containerColor = StatusError),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Icon(Icons.Default.Cancel, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(8.dp))
                            Text(
                                text = "Cancel Leave (${group.periods.size} ${if (group.periods.size == 1) "period" else "periods"})",
                                fontWeight = FontWeight.Bold
                            )
                        }
                    } else if (blockReason != null) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .background(StatusError.copy(alpha = 0.08f))
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.Info, contentDescription = null,
                                tint = StatusError, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(8.dp))
                            Text(blockReason, fontSize = 12.sp, color = StatusError, fontWeight = FontWeight.Medium)
                        }
                    }
                }
                Spacer(Modifier.height(8.dp))
            }
        }
    }

    Scaffold(
        topBar = {
            AppTopBar(
                title = "Leave Request History",
                canNavigateBack = true,
                onNavigateBack = onNavigateBack
            )
        },
        containerColor = FaflowBg
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            if (state.isLoading && state.groupedLeaves.isEmpty() && state.myLeaves.isEmpty()) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = FaflowNavy, strokeWidth = 2.dp)
                }
                return@Scaffold
            }

            if (state.errorMessage != null && state.groupedLeaves.isEmpty() && state.myLeaves.isEmpty()) {
                ErrorRetryView(
                    message = state.errorMessage!!,
                    onRetry = { viewModel.loadMyLeaves() }
                )
                return@Scaffold
            }

            val dayGroups = state.groupedLeaves

            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(bottom = 24.dp)
            ) {
                // Summary Stats Bar (Day-Level)
                item {
                    LeaveSummaryStatsBar(dayGroups = dayGroups)
                }

                // Search Bar
                item {
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = { searchQuery = it },
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 8.dp),
                        placeholder = {
                            Text("Search by date, reason, or substitute…", fontSize = 14.sp, color = FaflowText3)
                        },
                        leadingIcon = {
                            Icon(Icons.Default.Search, contentDescription = null,
                                tint = FaflowText3, modifier = Modifier.size(20.dp))
                        },
                        trailingIcon = {
                            if (searchQuery.isNotEmpty()) {
                                IconButton(onClick = { searchQuery = "" }) {
                                    Icon(Icons.Default.Clear, contentDescription = "Clear",
                                        tint = FaflowText3, modifier = Modifier.size(18.dp))
                                }
                            }
                        },
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = FaflowNavy,
                            unfocusedBorderColor = FaflowBorder,
                            focusedContainerColor = Color.White,
                            unfocusedContainerColor = Color.White
                        )
                    )
                }

                // Filter Chips (Day-Level Counts)
                item {
                    val totalDays = dayGroups.size
                    val pendingDayCount = dayGroups.count { it.status == LeaveStatus.PENDING }
                    val approvedDayCount = dayGroups.count { it.status == LeaveStatus.APPROVED }
                    val rejectedDayCount = dayGroups.count { it.status == LeaveStatus.REJECTED }
                    val cancelledDayCount = dayGroups.count { it.status == LeaveStatus.CANCELLED }

                    LazyRow(
                        modifier = Modifier.fillMaxWidth(),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        val tabs = listOf(
                            "ALL" to "All ($totalDays)",
                            "PENDING" to "Pending ($pendingDayCount)",
                            "APPROVED" to "Approved ($approvedDayCount)",
                            "REJECTED" to "Rejected ($rejectedDayCount)",
                            "CANCELLED" to "Cancelled ($cancelledDayCount)"
                        )
                        items(tabs) { (key, label) ->
                            val isSelected = selectedFilterTab == key
                            FilterChip(
                                selected = isSelected,
                                onClick = { selectedFilterTab = key },
                                label = {
                                    Text(
                                        label,
                                        fontSize = 12.sp,
                                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                                    )
                                },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = FaflowNavy.copy(alpha = 0.12f),
                                    selectedLabelColor = FaflowNavy
                                )
                            )
                        }
                    }
                }

                // Filtered List
                val q = searchQuery.trim().lowercase()
                val filteredDayGroups = dayGroups.filter { group ->
                    val matchesTab = when (selectedFilterTab) {
                        "PENDING" -> group.status == LeaveStatus.PENDING
                        "APPROVED" -> group.status == LeaveStatus.APPROVED
                        "REJECTED" -> group.status == LeaveStatus.REJECTED
                        "CANCELLED" -> group.status == LeaveStatus.CANCELLED
                        else -> true
                    }
                    val matchesSearch = q.isEmpty() ||
                        group.date.contains(q) ||
                        group.reason.lowercase().contains(q) ||
                        group.dayOrder.toString() == q ||
                        group.leaveTypeDisplay.lowercase().contains(q) ||
                        group.periods.any { it.substituteTeacherName?.lowercase()?.contains(q) == true }

                    matchesTab && matchesSearch
                }

                if (filteredDayGroups.isEmpty()) {
                    item {
                        EmptyStateView(
                            title = if (searchQuery.isNotEmpty()) "No Matching Leaves"
                            else "No Leave Requests",
                            description = if (searchQuery.isNotEmpty())
                                "No leaves match your search \"$searchQuery\"."
                            else if (selectedFilterTab != "ALL")
                                "No $selectedFilterTab leave requests found."
                            else
                                "You have not submitted any leave requests yet.",
                            icon = Icons.Default.EventBusy
                        )
                    }
                } else {
                    items(filteredDayGroups, key = { it.id }) { group ->
                        LeaveHistoryDayCard(
                            dayGroup = group,
                            onClick = { selectedDetailGroup = group },
                            onCancelClick = {
                                val (can, reason) = getDayGroupCancelability(group)
                                if (can) groupToCancel = group
                                else reason?.let { cancelBlockedReason = it }
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun LeaveHistoryDayCard(
    dayGroup: LeaveHistoryDay,
    onClick: () -> Unit,
    onCancelClick: () -> Unit
) {
    val (canCancel, _) = getDayGroupCancelability(dayGroup)
    val dayOfWeek = formatDayOfWeek(dayGroup.date)
    val dayOrderText = if (dayGroup.dayOrder > 0) "$dayOfWeek · Day Order ${dayGroup.dayOrder}" else dayOfWeek

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 5.dp)
            .clickable { onClick() },
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.5.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            // Header Row: Date & Status Badge
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column {
                    Text(
                        text = formatDayMonth(dayGroup.date),
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 17.sp,
                        color = FaflowNavy,
                        letterSpacing = 0.5.sp
                    )
                    Text(
                        text = dayOrderText,
                        fontSize = 12.sp,
                        color = FaflowText3,
                        fontWeight = FontWeight.Medium
                    )
                }
                LeaveStatusBadge(status = dayGroup.status)
            }

            Spacer(Modifier.height(10.dp))

            // Body: Leave Type & Reason
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = dayGroup.leaveTypeDisplay,
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    color = FaflowText1
                )
                if (dayGroup.isEmergency) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(StatusError.copy(alpha = 0.1f))
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = "Emergency",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = StatusError
                        )
                    }
                }
            }

            if (dayGroup.reason.isNotBlank()) {
                Spacer(Modifier.height(2.dp))
                Text(
                    text = dayGroup.reason,
                    fontSize = 13.sp,
                    color = FaflowText2,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
            }

            Spacer(Modifier.height(12.dp))
            HorizontalDivider(color = FaflowBorder.copy(alpha = 0.6f), thickness = 0.5.dp)
            Spacer(Modifier.height(10.dp))

            // Footer Row: Period Count / Covered Chips & Cancel Action
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = dayGroup.periodSummarySubtitle,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = FaflowNavy
                    )
                    if (dayGroup.hasSubstitutes) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.CheckCircle,
                                contentDescription = null,
                                tint = StatusSuccess,
                                modifier = Modifier.size(13.dp)
                            )
                            Spacer(Modifier.width(3.dp))
                            Text(
                                text = "${dayGroup.coveredPeriodsCount}/${dayGroup.periods.size} Covered",
                                fontSize = 11.sp,
                                color = StatusSuccess,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                }

                if (canCancel) {
                    TextButton(
                        onClick = onCancelClick,
                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                    ) {
                        Text("Cancel", fontSize = 12.sp, color = StatusError, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

/**
 * Backward-compatible single-period card function.
 */
@Composable
fun LeaveHistoryCard(
    leave: LeaveRequest,
    onClick: () -> Unit,
    onCancelClick: () -> Unit
) {
    val (canCancel, _) = getCancelability(leave)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(Color.White)
            .clickable { onClick() }
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(44.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(FaflowNavyTint),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "P${leave.periodNumber}",
                fontWeight = FontWeight.ExtraBold,
                color = FaflowNavy,
                fontSize = 13.sp
            )
        }
        Spacer(Modifier.width(12.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = formatDisplayDate(leave.date),
                fontWeight = FontWeight.Bold,
                fontSize = 15.sp,
                color = FaflowText1
            )
            Text(
                text = if (leave.dayOrder > 0) "Day Order ${leave.dayOrder}" else "Teaching Period",
                fontSize = 11.sp,
                color = FaflowText3
            )
            if (leave.reason.isNotBlank()) {
                Text(
                    text = leave.reason,
                    fontSize = 12.sp,
                    color = FaflowText2,
                    maxLines = 1
                )
            }
            if (leave.substituteTeacherName != null) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Person, contentDescription = null,
                        tint = StatusSuccess, modifier = Modifier.size(12.dp))
                    Spacer(Modifier.width(3.dp))
                    Text(
                        text = leave.substituteTeacherName,
                        fontSize = 11.sp,
                        color = StatusSuccess,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }

        Column(horizontalAlignment = Alignment.End) {
            LeaveStatusBadge(status = leave.status)
            if ((leave.status == LeaveStatus.PENDING || leave.status == LeaveStatus.APPROVED) && canCancel) {
                Spacer(Modifier.height(6.dp))
                TextButton(
                    onClick = onCancelClick,
                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                ) {
                    Text("Cancel", fontSize = 11.sp, color = StatusError, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun LeaveSummaryStatsBar(dayGroups: List<LeaveHistoryDay>) {
    val totalDays = dayGroups.size
    val totalPeriods = dayGroups.sumOf { it.periods.size }
    val approvedDays = dayGroups.count { it.status == LeaveStatus.APPROVED }
    val pendingDays = dayGroups.count { it.status == LeaveStatus.PENDING }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        SummaryStatChip(
            label = "Total Days",
            value = "$totalDays ${if (totalDays == 1) "Day" else "Days"}",
            subValue = "$totalPeriods periods",
            modifier = Modifier.weight(1f)
        )
        SummaryStatChip(
            label = "Approved",
            value = "$approvedDays ${if (approvedDays == 1) "Day" else "Days"}",
            valueColor = StatusSuccess,
            modifier = Modifier.weight(1f)
        )
        SummaryStatChip(
            label = "Pending",
            value = "$pendingDays ${if (pendingDays == 1) "Day" else "Days"}",
            valueColor = StatusWarning,
            modifier = Modifier.weight(1f)
        )
    }
}

@Composable
private fun SummaryStatChip(
    label: String,
    value: String,
    subValue: String? = null,
    valueColor: Color = FaflowNavy,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White)
            .border(1.dp, FaflowBorder, RoundedCornerShape(12.dp))
            .padding(vertical = 10.dp, horizontal = 12.dp)
    ) {
        Column {
            Text(label, fontSize = 11.sp, color = FaflowText3, fontWeight = FontWeight.Medium)
            Spacer(Modifier.height(2.dp))
            Text(value, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = valueColor)
            if (subValue != null) {
                Text(subValue, fontSize = 10.sp, color = FaflowText3)
            }
        }
    }
}

@Composable
private fun DetailRow(
    label: String,
    value: String,
    valueColor: Color = FaflowText1
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, fontSize = 13.sp, color = FaflowText3, fontWeight = FontWeight.Medium,
            modifier = Modifier.weight(0.4f))
        Text(value, fontSize = 13.sp, color = valueColor, fontWeight = FontWeight.SemiBold,
            modifier = Modifier.weight(0.6f))
    }
    HorizontalDivider(color = FaflowBorder, thickness = 0.5.dp)
}

@Composable
fun LeaveStatusBadge(status: LeaveStatus) {
    val (label, color) = when (status) {
        LeaveStatus.APPROVED -> "Approved" to StatusSuccess
        LeaveStatus.PENDING -> "Pending" to StatusWarning
        LeaveStatus.REJECTED -> "Rejected" to StatusError
        LeaveStatus.CANCELLED -> "Cancelled" to FaflowText3
    }
    FaflowStatusBadge(
        text = label,
        statusColor = color,
        showDot = true
    )
}
