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
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.CloudDone
import androidx.compose.material.icons.filled.CloudSync
import androidx.compose.material.icons.filled.CrisisAlert
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.PersonOff
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.governence.faflow.attendance.student.ui.RosterFilter
import com.governence.faflow.attendance.student.ui.StudentAttendanceViewModel
import com.governence.faflow.core.network.ClassOutDto
import com.governence.faflow.core.network.StudentItemDto
import com.governence.faflow.core.network.TeacherPeriodSlotDto
import com.governence.faflow.ui.components.FaflowSurface
import com.governence.faflow.ui.theme.FaflowShapes
import com.governence.faflow.ui.theme.FaflowSpacing
import com.governence.faflow.ui.theme.PrimaryBlue
import com.governence.faflow.ui.theme.StatusError
import com.governence.faflow.ui.theme.StatusSuccess

@OptIn(ExperimentalLayoutApi::class, ExperimentalMaterial3Api::class)
@Composable
fun StudentAttendanceScreen(
    viewModel: StudentAttendanceViewModel,
    onNavigateBack: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()
    var emergencySearchText by remember { mutableStateOf("") }
    var showMarkAllAbsentDialog by remember { mutableStateOf(false) }

    val allRoster = state.roster?.students ?: emptyList()
    val totalStudents = allRoster.size

    val isSubmitted = state.activeSession?.status in listOf("SUBMITTED", "SUBMITTED_LATE", "LOCKED")
    val hasStarted = remember(state.selectedSlot, state.schedule?.date) {
        state.selectedSlot?.let {
            com.governence.faflow.domain.model.InstitutionalSchedule.hasPeriodStarted(it.periodNumber, state.schedule?.date)
        } ?: true
    }
    val canEdit = if (isSubmitted) {
        state.activeSession?.canEdit == true && state.activeSession?.correctionAllowed != false
    } else {
        hasStarted
    }

    val absentTokens = remember(state.absentInput) {
        state.absentInput.split(Regex("[\\s,]+")).filter { it.isNotBlank() }
    }
    val suffixes = remember(absentTokens) {
        absentTokens.map { it.padStart(3, '0').takeLast(3) }.toSet()
    }
    val validSuffixSet = remember(allRoster) {
        allRoster.map { it.rollSuffix.ifBlank { it.rollNumber.takeLast(3) } }.toSet()
    }
    val absentCount = remember(suffixes, validSuffixSet) {
        suffixes.count { validSuffixSet.contains(it) }
    }
    val specialCount = state.specialStatuses.size
    val presentCount = (totalStudents - absentCount - specialCount).coerceAtLeast(0)

    // Fast search and filter computation (memoized for 150+ students)
    val filteredRoster = remember(allRoster, state.searchQuery, state.selectedFilter, suffixes, state.specialStatuses) {
        allRoster.filter { student ->
            val suffix = student.rollSuffix.ifBlank { student.rollNumber.takeLast(3) }
            val isAbsent = suffixes.contains(suffix) || suffixes.contains(student.rollNumber)
            val hasSpecial = state.specialStatuses.containsKey(student.id)

            // 1. Filter match
            val matchesFilter = when (state.selectedFilter) {
                RosterFilter.ALL -> true
                RosterFilter.PRESENT -> !isAbsent && !hasSpecial
                RosterFilter.ABSENT -> isAbsent
                RosterFilter.EXCEPTIONS -> hasSpecial
            }

            // 2. Search match
            val matchesSearch = if (state.searchQuery.isBlank()) true else {
                val q = state.searchQuery.trim()
                student.name.contains(q, ignoreCase = true) ||
                student.rollNumber.contains(q, ignoreCase = true) ||
                suffix.contains(q, ignoreCase = true)
            }

            matchesFilter && matchesSearch
        }
    }

    Scaffold(
        topBar = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(com.governence.faflow.ui.theme.FaflowBg)
                    .statusBarsPadding()
                    .padding(horizontal = FaflowSpacing.md, vertical = FaflowSpacing.sm)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconButton(onClick = onNavigateBack) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = "Back",
                                tint = com.governence.faflow.ui.theme.FaflowText1
                            )
                        }
                        Spacer(modifier = Modifier.width(FaflowSpacing.xs))
                        Column {
                            Text(
                                text = "Student Attendance",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = com.governence.faflow.ui.theme.FaflowText1
                            )
                            Text(
                                text = state.schedule?.date ?: "Today's Schedule",
                                style = MaterialTheme.typography.bodySmall,
                                color = com.governence.faflow.ui.theme.FaflowText3
                            )
                        }
                    }

                    // Sync Status Badge with Tap to Sync
                    Row(
                        modifier = Modifier
                            .clip(FaflowShapes.pill)
                            .background(
                                if (state.pendingCount == 0) com.governence.faflow.ui.theme.FaflowSuccess.copy(alpha = 0.12f)
                                else com.governence.faflow.ui.theme.FaflowGold.copy(alpha = 0.12f)
                            )
                            .clickable { viewModel.syncPending() }
                            .padding(horizontal = 10.dp, vertical = 5.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Icon(
                            imageVector = if (state.pendingCount == 0) Icons.Default.CloudDone else Icons.Default.CloudSync,
                            contentDescription = "Sync Status",
                            tint = if (state.pendingCount == 0) com.governence.faflow.ui.theme.FaflowSuccess else com.governence.faflow.ui.theme.FaflowGold,
                            modifier = Modifier.size(14.dp)
                        )
                        Text(
                            text = if (state.pendingCount == 0) "Synced" else "${state.pendingCount} Offline",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (state.pendingCount == 0) com.governence.faflow.ui.theme.FaflowSuccess else com.governence.faflow.ui.theme.FaflowGold
                        )
                    }
                }

                // Sub-header with Day Order and Emergency Button
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = FaflowSpacing.xs, bottom = FaflowSpacing.xs, start = 48.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = if (state.schedule?.isHoliday == true) "Holiday" else "Day Order ${state.schedule?.dayOrder ?: "-"}",
                        color = com.governence.faflow.ui.theme.FaflowNavy,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )

                    Button(
                        onClick = { viewModel.openEmergencyModal() },
                        colors = ButtonDefaults.buttonColors(containerColor = com.governence.faflow.ui.theme.FaflowDanger),
                        shape = FaflowShapes.small,
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                        modifier = Modifier.height(30.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.CrisisAlert,
                            contentDescription = "Emergency Attendance",
                            tint = Color.White,
                            modifier = Modifier.size(13.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "Emergency",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                    }
                }
            }
        },
        bottomBar = {
            val selectedSlot = state.selectedSlot
            if (selectedSlot != null && totalStudents > 0) {
                val startTimeStr = selectedSlot.startTime?.ifBlank { com.governence.faflow.domain.model.InstitutionalSchedule.getPeriodStartTimeFormatted(selectedSlot.periodNumber) } ?: com.governence.faflow.domain.model.InstitutionalSchedule.getPeriodStartTimeFormatted(selectedSlot.periodNumber)
                Surface(
                    color = Color.White,
                    shadowElevation = 8.dp,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .navigationBarsPadding()
                            .padding(horizontal = FaflowSpacing.md, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Button(
                            onClick = { viewModel.openReviewSheet() },
                            enabled = !state.isSubmitting && (!isSubmitted || canEdit) && (isSubmitted || hasStarted),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if ((!isSubmitted || canEdit) && (isSubmitted || hasStarted)) PrimaryBlue else Color(0xFF94A3B8),
                                disabledContainerColor = Color(0xFFE2E8F0)
                            ),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(50.dp)
                        ) {
                            if (state.isSubmitting) {
                                CircularProgressIndicator(color = Color.White, modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Submitting...", fontWeight = FontWeight.Bold)
                            } else if (!isSubmitted && !hasStarted) {
                                Icon(imageVector = Icons.Default.Lock, contentDescription = null, tint = Color(0xFF64748B), modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "CLASS NOT STARTED (OPENS AT $startTimeStr)",
                                    fontWeight = FontWeight.Black,
                                    fontSize = 12.sp,
                                    color = Color(0xFF64748B),
                                    letterSpacing = 0.5.sp
                                )
                            } else if (isSubmitted && !canEdit) {
                                Icon(imageVector = Icons.Default.Clear, contentDescription = null, tint = Color(0xFF64748B), modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "CORRECTION CLOSED (PERIOD ENDED)",
                                    fontWeight = FontWeight.Black,
                                    fontSize = 13.sp,
                                    color = Color(0xFF64748B),
                                    letterSpacing = 0.5.sp
                                )
                            } else {
                                Icon(imageVector = Icons.Default.Check, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = if (isSubmitted) "REVIEW & UPDATE (${presentCount}P · ${absentCount}A)" else "REVIEW & SUBMIT (${presentCount}P · ${absentCount}A)",
                                    fontWeight = FontWeight.Black,
                                    fontSize = 13.sp,
                                    letterSpacing = 0.5.sp
                                )
                            }
                        }
                    }
                }
            }
        }
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(Color(0xFFF8FAFC)),
            contentPadding = PaddingValues(FaflowSpacing.md),
            verticalArrangement = Arrangement.spacedBy(FaflowSpacing.md)
        ) {
            // Alerts / Messages
            if (state.errorMessage != null) {
                item {
                    FaflowSurface(
                        modifier = Modifier.fillMaxWidth(),
                        backgroundColor = Color(0xFFFFF1F2),
                        borderColor = Color(0xFFFECDD3),
                        contentPadding = PaddingValues(FaflowSpacing.md)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(FaflowSpacing.sm)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Warning,
                                contentDescription = "Error",
                                tint = Color(0xFFE11D48),
                                modifier = Modifier.size(20.dp)
                            )
                            Text(
                                text = state.errorMessage!!,
                                color = Color(0xFF9F1239),
                                fontSize = 12.sp,
                                modifier = Modifier.weight(1f)
                            )
                            Text(
                                text = "✕",
                                modifier = Modifier.clickable { viewModel.dismissMessage() },
                                color = Color(0xFFE11D48),
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }

            if (state.successMessage != null) {
                item {
                    FaflowSurface(
                        modifier = Modifier.fillMaxWidth(),
                        backgroundColor = Color(0xFFECFDF5),
                        borderColor = Color(0xFFA7F3D0),
                        contentPadding = PaddingValues(FaflowSpacing.md)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(FaflowSpacing.sm)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Check,
                                contentDescription = "Success",
                                tint = Color(0xFF059669),
                                modifier = Modifier.size(20.dp)
                            )
                            Text(
                                text = state.successMessage!!,
                                color = Color(0xFF065F46),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.weight(1f)
                            )
                            Text(
                                text = "✕",
                                modifier = Modifier.clickable { viewModel.dismissMessage() },
                                color = Color(0xFF059669),
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }

            // 1. Periods Bar (Horizontal List of Today's Periods)
            item {
                Column(verticalArrangement = Arrangement.spacedBy(FaflowSpacing.sm)) {
                    Text(
                        text = "TODAY'S CLASSES",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Black,
                        color = Color(0xFF64748B),
                        letterSpacing = 1.sp
                    )

                    val periods = state.schedule?.periods ?: emptyList()
                    if (periods.isEmpty()) {
                        FaflowSurface(
                            modifier = Modifier.fillMaxWidth(),
                            contentPadding = PaddingValues(FaflowSpacing.md)
                        ) {
                            Text(
                                text = "No scheduled classes found for today.",
                                color = Color(0xFF94A3B8),
                                fontSize = 12.sp
                            )
                        }
                    } else {
                        LazyRow(
                            horizontalArrangement = Arrangement.spacedBy(FaflowSpacing.sm),
                            contentPadding = PaddingValues(vertical = 2.dp)
                        ) {
                            items(periods) { slot ->
                                val isSelected = state.selectedSlot?.timetableSlotId == slot.timetableSlotId
                                val isSubmitted = slot.sessionStatus == "SUBMITTED" || slot.sessionStatus == "SUBMITTED_LATE"

                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(
                                            if (isSelected) PrimaryBlue else Color.White
                                        )
                                        .border(
                                            1.dp,
                                            if (isSelected) PrimaryBlue else Color(0xFFE2E8F0),
                                            RoundedCornerShape(12.dp)
                                        )
                                        .clickable { viewModel.selectSlot(slot) }
                                        .padding(horizontal = 14.dp, vertical = 10.dp)
                                ) {
                                    Column {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                                        ) {
                                            Text(
                                                text = "P${slot.periodNumber}",
                                                fontWeight = FontWeight.Black,
                                                fontSize = 12.sp,
                                                color = if (isSelected) Color.White else Color(0xFF0F172A)
                                            )
                                            if (slot.isSubstitution) {
                                                Text(
                                                    text = "SUB",
                                                    fontSize = 9.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = if (isSelected) Color(0xFFDDD6FE) else Color(0xFF7C3AED),
                                                    modifier = Modifier
                                                        .background(
                                                            if (isSelected) Color(0x33FFFFFF) else Color(0xFFF3E8FF),
                                                            RoundedCornerShape(4.dp)
                                                        )
                                                        .padding(horizontal = 4.dp, vertical = 1.dp)
                                                )
                                            }
                                        }
                                        Spacer(modifier = Modifier.height(2.dp))
                                        Text(
                                            text = slot.className,
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = if (isSelected) Color.White else Color(0xFF334155)
                                        )
                                        Text(
                                            text = slot.subjectName ?: "No Subject",
                                            fontSize = 10.sp,
                                            color = if (isSelected) Color(0xFFE2E8F0) else Color(0xFF64748B)
                                        )
                                        if (isSubmitted) {
                                            Text(
                                                text = "✓ Submitted",
                                                fontSize = 9.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = if (isSelected) Color(0xFFA7F3D0) else Color(0xFF059669)
                                            )
                                        } else {
                                            val slotStarted = com.governence.faflow.domain.model.InstitutionalSchedule.hasPeriodStarted(slot.periodNumber, state.schedule?.date)
                                            if (!slotStarted) {
                                                val startStr = slot.startTime?.ifBlank { com.governence.faflow.domain.model.InstitutionalSchedule.getPeriodStartTimeFormatted(slot.periodNumber) } ?: com.governence.faflow.domain.model.InstitutionalSchedule.getPeriodStartTimeFormatted(slot.periodNumber)
                                                Text(
                                                    text = "Starts $startStr",
                                                    fontSize = 9.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = if (isSelected) Color(0xFFE2E8F0) else Color(0xFF94A3B8)
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

            // 2. Active Class Overview & Fast Input Card
            val selectedSlot = state.selectedSlot
            if (selectedSlot != null) {
                val periodStartStr = selectedSlot.startTime?.ifBlank { com.governence.faflow.domain.model.InstitutionalSchedule.getPeriodStartTimeFormatted(selectedSlot.periodNumber) } ?: com.governence.faflow.domain.model.InstitutionalSchedule.getPeriodStartTimeFormatted(selectedSlot.periodNumber)
                val periodEndStr = selectedSlot.endTime?.ifBlank { "Period End" } ?: "Period End"
                item {
                    FaflowSurface(
                        modifier = Modifier.fillMaxWidth(),
                        backgroundColor = Color.White,
                        borderColor = Color(0xFFE2E8F0),
                        shape = RoundedCornerShape(16.dp),
                        contentPadding = PaddingValues(FaflowSpacing.md)
                    ) {
                        Column {
                            // Header of Active Period
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                        Text(
                                            text = "Period ${selectedSlot.periodNumber}",
                                            fontWeight = FontWeight.Black,
                                            fontSize = 13.sp,
                                            color = PrimaryBlue
                                        )
                                        if (state.isEmergencyMode) {
                                            Text(
                                                text = "EMERGENCY",
                                                fontWeight = FontWeight.Black,
                                                fontSize = 9.sp,
                                                color = Color.White,
                                                modifier = Modifier
                                                    .background(Color(0xFFDC2626), RoundedCornerShape(4.dp))
                                                    .padding(horizontal = 4.dp, vertical = 1.dp)
                                            )
                                        }
                                    }
                                    Text(
                                        text = selectedSlot.className,
                                        fontWeight = FontWeight.Black,
                                        fontSize = 16.sp,
                                        color = Color(0xFF0F172A)
                                    )
                                    Text(
                                        text = selectedSlot.subjectName ?: "No Subject",
                                        fontSize = 12.sp,
                                        color = Color(0xFF64748B)
                                    )
                                    val calNow = java.util.Calendar.getInstance()
                                    val nowMins = calNow.get(java.util.Calendar.HOUR_OF_DAY) * 60 + calNow.get(java.util.Calendar.MINUTE)
                                    val isWithinWindow = com.governence.faflow.domain.model.InstitutionalSchedule.isWithin15MinuteWindow(selectedSlot.periodNumber, nowMins)

                                    Row(
                                        modifier = Modifier.padding(top = 4.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                                    ) {
                                        if (isSubmitted) {
                                            Box(
                                                modifier = Modifier
                                                    .background(
                                                        if (canEdit) Color(0xFFECFDF5) else Color(0xFFF1F5F9),
                                                        RoundedCornerShape(4.dp)
                                                    )
                                                    .padding(horizontal = 6.dp, vertical = 2.dp)
                                            ) {
                                                Text(
                                                    text = if (canEdit) "⏱ Corrections open until $periodEndStr" else "🔒 Correction closed (Ended $periodEndStr)",
                                                    fontSize = 10.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = if (canEdit) Color(0xFF059669) else Color(0xFF64748B)
                                                )
                                            }
                                        } else if (!hasStarted) {
                                            Box(
                                                modifier = Modifier
                                                    .background(Color(0xFFF1F5F9), RoundedCornerShape(4.dp))
                                                    .padding(horizontal = 6.dp, vertical = 2.dp)
                                            ) {
                                                Text(
                                                    text = "🔒 Class not started (Opens $periodStartStr)",
                                                    fontSize = 10.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = Color(0xFF64748B)
                                                )
                                            }
                                        } else {
                                            Box(
                                                modifier = Modifier
                                                    .background(
                                                        if (isWithinWindow) Color(0xFFECFDF5) else Color(0xFFFEF3C7),
                                                        RoundedCornerShape(4.dp)
                                                    )
                                                    .padding(horizontal = 6.dp, vertical = 2.dp)
                                            ) {
                                                Text(
                                                    text = if (isWithinWindow) "⏱ 15m Window (On-Time)" else "⏱ Late Submission (>15m)",
                                                    fontSize = 10.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = if (isWithinWindow) Color(0xFF059669) else Color(0xFFD97706)
                                                )
                                            }
                                        }
                                    }
                                }

                                Column(horizontalAlignment = Alignment.End) {
                                    Text(
                                        text = "$totalStudents",
                                        fontWeight = FontWeight.Black,
                                        fontSize = 24.sp,
                                        color = PrimaryBlue
                                    )
                                    Text(
                                        text = "STUDENTS",
                                        fontSize = 9.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Color(0xFF94A3B8)
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.height(FaflowSpacing.md))

                            // Counter summary
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .background(Color(0xFFECFDF5), RoundedCornerShape(10.dp))
                                        .padding(vertical = 8.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                        Text(text = "$presentCount", fontWeight = FontWeight.Black, fontSize = 18.sp, color = Color(0xFF047857))
                                        Text(text = "PRESENT", fontWeight = FontWeight.Bold, fontSize = 9.sp, color = Color(0xFF065F46))
                                    }
                                }
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .background(Color(0xFFFFF1F2), RoundedCornerShape(10.dp))
                                        .padding(vertical = 8.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                        Text(text = "$absentCount", fontWeight = FontWeight.Black, fontSize = 18.sp, color = Color(0xFFBE123C))
                                        Text(text = "ABSENT", fontWeight = FontWeight.Bold, fontSize = 9.sp, color = Color(0xFF9F1239))
                                    }
                                }
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .background(Color(0xFFFFFBEB), RoundedCornerShape(10.dp))
                                        .padding(vertical = 8.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                        Text(text = "$specialCount", fontWeight = FontWeight.Black, fontSize = 18.sp, color = Color(0xFFB45309))
                                        Text(text = "OTHER", fontWeight = FontWeight.Bold, fontSize = 9.sp, color = Color(0xFF78350F))
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(FaflowSpacing.md))

                            // Absent Roll Suffix Quick Entry (Keypad / text input option)
                            Text(
                                text = "QUICK SUFFIX ENTRY (OPTIONAL)",
                                fontWeight = FontWeight.Black,
                                fontSize = 11.sp,
                                color = Color(0xFF334155),
                                letterSpacing = 0.5.sp
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            OutlinedTextField(
                                value = state.absentInput,
                                onValueChange = { if (canEdit) viewModel.updateAbsentInput(it) },
                                enabled = canEdit,
                                placeholder = {
                                    Text(
                                        if (!isSubmitted && !hasStarted) "Class opens at $periodStartStr. Attendance cannot be taken yet."
                                        else if (isSubmitted && !canEdit) "Correction window closed for this period"
                                        else "Type suffixes or tap student rows below (e.g. 044 051)",
                                        color = Color(0xFF94A3B8),
                                        fontSize = 12.sp
                                    )
                                },
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(12.dp),
                                textStyle = MaterialTheme.typography.bodyMedium.copy(
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.Bold
                                ),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = PrimaryBlue,
                                    unfocusedBorderColor = Color(0xFFCBD5E1),
                                    focusedContainerColor = Color.White,
                                    unfocusedContainerColor = Color(0xFFF8FAFC),
                                    disabledContainerColor = Color(0xFFF1F5F9),
                                    disabledBorderColor = Color(0xFFE2E8F0)
                                ),
                                singleLine = true
                            )

                            // Chip preview for parsed numbers with 1-tap removal
                            if (suffixes.isNotEmpty()) {
                                Spacer(modifier = Modifier.height(FaflowSpacing.sm))
                                FlowRow(
                                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                                    verticalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    suffixes.forEach { suf ->
                                        val isValid = validSuffixSet.contains(suf)
                                        val studentMatch = allRoster.firstOrNull { (it.rollSuffix.ifBlank { it.rollNumber.takeLast(3) }) == suf }
                                        Box(
                                            modifier = Modifier
                                                .clip(RoundedCornerShape(6.dp))
                                                .background(if (isValid) Color(0xFFFECDD3) else Color(0xFFEF4444))
                                                .clickable(enabled = canEdit) {
                                                    if (studentMatch != null) {
                                                        viewModel.toggleStudentAttendance(studentMatch)
                                                    }
                                                }
                                                .padding(horizontal = 8.dp, vertical = 4.dp)
                                        ) {
                                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                                Text(
                                                    text = if (isValid) "$suf (${studentMatch?.name ?: ""})" else "$suf (Invalid)",
                                                    fontSize = 11.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = if (isValid) Color(0xFF881337) else Color.White
                                                )
                                                Text(
                                                    text = "✕",
                                                    fontSize = 10.sp,
                                                    fontWeight = FontWeight.Black,
                                                    color = if (isValid) Color(0xFF881337) else Color.White
                                                )
                                            }
                                        }
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(FaflowSpacing.md))

                            // Bulk Actions Toolbar
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                TextButton(
                                    onClick = { viewModel.markAllPresent() },
                                    enabled = canEdit,
                                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp)
                                ) {
                                    Icon(Icons.Default.DoneAll, contentDescription = null, modifier = Modifier.size(16.dp), tint = if (canEdit) Color(0xFF059669) else Color(0xFF94A3B8))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("All Present", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = if (canEdit) Color(0xFF059669) else Color(0xFF94A3B8))
                                }

                                TextButton(
                                    onClick = { showMarkAllAbsentDialog = true },
                                    enabled = canEdit,
                                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp)
                                ) {
                                    Icon(Icons.Default.PersonOff, contentDescription = null, modifier = Modifier.size(16.dp), tint = if (canEdit) Color(0xFFDC2626) else Color(0xFF94A3B8))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("All Absent", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = if (canEdit) Color(0xFFDC2626) else Color(0xFF94A3B8))
                                }

                                TextButton(
                                    onClick = { viewModel.clearAttendance() },
                                    enabled = canEdit,
                                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp)
                                ) {
                                    Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(14.dp), tint = if (canEdit) Color(0xFFE11D48) else Color(0xFF94A3B8))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("Clear All", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = if (canEdit) Color(0xFFE11D48) else Color(0xFF94A3B8))
                                }
                            }
                        }
                    }
                }

                // 3. Search and Filter Bar
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(FaflowSpacing.sm)) {
                        OutlinedTextField(
                            value = state.searchQuery,
                            onValueChange = { viewModel.updateSearchQuery(it) },
                            placeholder = { Text("Search by student name or roll number...", fontSize = 12.sp) },
                            leadingIcon = {
                                Icon(Icons.Default.Search, contentDescription = "Search", modifier = Modifier.size(18.dp), tint = Color(0xFF64748B))
                            },
                            trailingIcon = {
                                if (state.searchQuery.isNotBlank()) {
                                    IconButton(onClick = { viewModel.updateSearchQuery("") }) {
                                        Icon(Icons.Default.Clear, contentDescription = "Clear search", modifier = Modifier.size(16.dp))
                                    }
                                }
                            },
                            singleLine = true,
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth(),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = PrimaryBlue,
                                unfocusedBorderColor = Color(0xFFCBD5E1),
                                focusedContainerColor = Color.White,
                                unfocusedContainerColor = Color.White
                            )
                        )

                        // Filter Chips Row
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            FilterChip(
                                selected = state.selectedFilter == RosterFilter.ALL,
                                onClick = { viewModel.setFilter(RosterFilter.ALL) },
                                label = { Text("All ($totalStudents)", fontSize = 11.sp, fontWeight = FontWeight.Bold) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = PrimaryBlue,
                                    selectedLabelColor = Color.White
                                )
                            )
                            FilterChip(
                                selected = state.selectedFilter == RosterFilter.PRESENT,
                                onClick = { viewModel.setFilter(RosterFilter.PRESENT) },
                                label = { Text("Present ($presentCount)", fontSize = 11.sp, fontWeight = FontWeight.Bold) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = Color(0xFF059669),
                                    selectedLabelColor = Color.White
                                )
                            )
                            FilterChip(
                                selected = state.selectedFilter == RosterFilter.ABSENT,
                                onClick = { viewModel.setFilter(RosterFilter.ABSENT) },
                                label = { Text("Absent ($absentCount)", fontSize = 11.sp, fontWeight = FontWeight.Bold) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = Color(0xFFDC2626),
                                    selectedLabelColor = Color.White
                                )
                            )
                            FilterChip(
                                selected = state.selectedFilter == RosterFilter.EXCEPTIONS,
                                onClick = { viewModel.setFilter(RosterFilter.EXCEPTIONS) },
                                label = { Text("Other ($specialCount)", fontSize = 11.sp, fontWeight = FontWeight.Bold) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = Color(0xFFD97706),
                                    selectedLabelColor = Color.White
                                )
                            )
                            if (state.selectedFilter != RosterFilter.ALL || state.searchQuery.isNotBlank()) {
                                TextButton(
                                    onClick = {
                                        viewModel.setFilter(RosterFilter.ALL)
                                        viewModel.updateSearchQuery("")
                                    },
                                    contentPadding = PaddingValues(horizontal = 6.dp, vertical = 2.dp)
                                ) {
                                    Text("Clear All Filters", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFF64748B))
                                }
                            }
                        }
                    }
                }

                // 4. Interactive Student Roster (High-Performance Keyed Items)
                if (filteredRoster.isEmpty()) {
                    item {
                        FaflowSurface(
                            modifier = Modifier.fillMaxWidth(),
                            backgroundColor = Color.White,
                            contentPadding = PaddingValues(FaflowSpacing.xl)
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(
                                    text = if (state.searchQuery.isNotBlank()) "No students match '${state.searchQuery}'" else "No students match selected filter",
                                    color = Color(0xFF64748B),
                                    fontSize = 13.sp,
                                    textAlign = TextAlign.Center
                                )
                            }
                        }
                    }
                } else {
                    items(filteredRoster, key = { it.id }) { student ->
                        val suffix = student.rollSuffix.ifBlank { student.rollNumber.takeLast(3) }
                        val isAbsent = suffixes.contains(suffix) || suffixes.contains(student.rollNumber)
                        val special = state.specialStatuses[student.id]

                        FaflowSurface(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .clickable(enabled = canEdit) { viewModel.toggleStudentAttendance(student) }
                                .semantics {
                                    contentDescription = if (isAbsent) {
                                        "${student.name}, roll ${student.rollNumber}. Currently marked absent. Tap to mark present."
                                    } else {
                                        "${student.name}, roll ${student.rollNumber}. Currently marked present. Tap to mark absent."
                                    }
                                },
                            backgroundColor = when {
                                isAbsent -> Color(0xFFFFF1F2)
                                special != null -> Color(0xFFFFFBEB)
                                else -> Color.White
                            },
                            borderColor = when {
                                isAbsent -> Color(0xFFFECDD3)
                                special != null -> Color(0xFFFDE68A)
                                else -> Color(0xFFE2E8F0)
                            },
                            shape = RoundedCornerShape(12.dp),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 10.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                                    modifier = Modifier.weight(1f)
                                ) {
                                    // Suffix Badge
                                    Text(
                                        text = suffix,
                                        fontWeight = FontWeight.Black,
                                        fontFamily = FontFamily.Monospace,
                                        fontSize = 12.sp,
                                        color = if (isAbsent) Color(0xFFBE123C) else PrimaryBlue,
                                        modifier = Modifier
                                            .background(
                                                if (isAbsent) Color(0xFFFFE4E6) else Color(0xFFEFF6FF),
                                                RoundedCornerShape(6.dp)
                                            )
                                            .padding(horizontal = 7.dp, vertical = 3.dp)
                                    )

                                    Column {
                                        Text(
                                            text = student.name,
                                            fontSize = 13.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = Color(0xFF0F172A)
                                        )
                                        Text(
                                            text = student.rollNumber,
                                            fontSize = 11.sp,
                                            color = Color(0xFF64748B)
                                        )
                                    }
                                }

                                // Status Tag and Quick OD Button
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    val (label, tagBg, tagFg) = when {
                                        isAbsent -> Triple("ABSENT", Color(0xFFF43F5E), Color.White)
                                        special == "LATE" -> Triple("LATE", Color(0xFFF59E0B), Color.White)
                                        special == "ON_DUTY" -> Triple("OD", Color(0xFF3B82F6), Color.White)
                                        special == "LEAVE" -> Triple("LEAVE", Color(0xFF8B5CF6), Color.White)
                                        special == "MEDICAL" -> Triple("MED", Color(0xFFEC4899), Color.White)
                                        else -> Triple("PRESENT", Color(0xFF10B981), Color.White)
                                    }

                                    Box(
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(6.dp))
                                            .background(tagBg)
                                            .padding(horizontal = 8.dp, vertical = 4.dp)
                                    ) {
                                        Text(
                                            text = label,
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.Black,
                                            color = tagFg
                                        )
                                    }

                                    // Quick Special toggle
                                    IconButton(
                                        onClick = { viewModel.toggleSpecialStatus(student.id, "ON_DUTY") },
                                        enabled = canEdit,
                                        modifier = Modifier.size(32.dp)
                                    ) {
                                        Text(
                                            text = if (special == "ON_DUTY") "✕OD" else "+OD",
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = if (canEdit) PrimaryBlue else Color(0xFF94A3B8)
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

    // Pre-Submission Review Modal BottomSheet
    if (state.isReviewSheetOpen) {
        ModalBottomSheet(
            onDismissRequest = { viewModel.closeReviewSheet() },
            sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
            containerColor = Color.White
        ) {
            val selectedSlot = state.selectedSlot
            val absentStudents = remember(suffixes, allRoster) {
                allRoster.filter { suffixes.contains(it.rollSuffix.ifBlank { it.rollNumber.takeLast(3) }) || suffixes.contains(it.rollNumber) }
            }

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = FaflowSpacing.lg, vertical = FaflowSpacing.md)
                    .navigationBarsPadding()
            ) {
                Text(
                    text = "Attendance Review",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Black,
                    color = Color(0xFF0F172A)
                )
                Text(
                    text = "${selectedSlot?.className ?: ""} · Period ${selectedSlot?.periodNumber ?: ""}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color(0xFF64748B)
                )

                Spacer(modifier = Modifier.height(FaflowSpacing.md))

                // Breakdown metrics
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .background(Color(0xFFECFDF5), RoundedCornerShape(10.dp))
                            .padding(10.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(text = "$presentCount", fontWeight = FontWeight.Black, fontSize = 20.sp, color = Color(0xFF047857))
                            Text(text = "PRESENT (${if (totalStudents > 0) (presentCount * 100 / totalStudents) else 0}%)", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color(0xFF065F46))
                        }
                    }
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .background(Color(0xFFFFF1F2), RoundedCornerShape(10.dp))
                            .padding(10.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(text = "$absentCount", fontWeight = FontWeight.Black, fontSize = 20.sp, color = Color(0xFFBE123C))
                            Text(text = "ABSENT (${if (totalStudents > 0) (absentCount * 100 / totalStudents) else 0}%)", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color(0xFF9F1239))
                        }
                    }
                }

                Spacer(modifier = Modifier.height(FaflowSpacing.md))

                // Absent students list
                Text(
                    text = "ABSENT STUDENTS (${absentStudents.size})",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Black,
                    color = Color(0xFF64748B),
                    letterSpacing = 0.5.sp
                )
                Spacer(modifier = Modifier.height(6.dp))

                if (absentStudents.isEmpty()) {
                    Text(
                        text = "✓ All $totalStudents students are recorded as PRESENT.",
                        fontSize = 13.sp,
                        color = Color(0xFF047857),
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(vertical = 12.dp)
                    )
                } else {
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(200.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        items(absentStudents, key = { it.id }) { st ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(Color(0xFFF8FAFC), RoundedCornerShape(8.dp))
                                    .padding(8.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Text(
                                    text = st.rollSuffix.ifBlank { st.rollNumber.takeLast(3) },
                                    fontWeight = FontWeight.Black,
                                    fontSize = 11.sp,
                                    color = Color(0xFFBE123C)
                                )
                                Text(
                                    text = st.name,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 12.sp,
                                    color = Color(0xFF0F172A),
                                    modifier = Modifier.weight(1f)
                                )
                                Text(
                                    text = st.rollNumber,
                                    fontSize = 10.sp,
                                    color = Color(0xFF94A3B8)
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(FaflowSpacing.lg))

                // Action buttons
                Button(
                    onClick = { viewModel.submitAttendance() },
                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                ) {
                    Text(
                        text = if (isSubmitted) "CONFIRM & UPDATE ATTENDANCE" else "CONFIRM & SUBMIT ATTENDANCE",
                        fontWeight = FontWeight.Black,
                        fontSize = 13.sp
                    )
                }

                Spacer(modifier = Modifier.height(6.dp))

                TextButton(
                    onClick = { viewModel.closeReviewSheet() },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Back to Edit", color = Color(0xFF64748B))
                }
            }
        }
    }

    // Safety Alert Dialog for Mark All Absent
    if (showMarkAllAbsentDialog) {
        AlertDialog(
            onDismissRequest = { showMarkAllAbsentDialog = false },
            title = { Text("Mark All Students Absent?", fontWeight = FontWeight.Bold) },
            text = { Text("This will mark all $totalStudents students in ${state.selectedSlot?.className ?: "class"} as absent. You can still adjust individual students afterwards.") },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.markAllAbsent()
                        showMarkAllAbsentDialog = false
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = StatusError)
                ) {
                    Text("Mark All Absent")
                }
            },
            dismissButton = {
                TextButton(onClick = { showMarkAllAbsentDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    // Emergency Class Selector Dialog
    if (state.isEmergencyModalOpen) {
        val filteredClasses = state.allClasses.filter {
            it.name.contains(emergencySearchText, ignoreCase = true) ||
            (it.section?.contains(emergencySearchText, ignoreCase = true) == true)
        }

        AlertDialog(
            onDismissRequest = { viewModel.closeEmergencyModal() },
            title = {
                Text(
                    text = "🚨 Select Class for Emergency Attendance",
                    fontWeight = FontWeight.Black,
                    fontSize = 16.sp
                )
            },
            text = {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(320.dp)
                ) {
                    OutlinedTextField(
                        value = emergencySearchText,
                        onValueChange = { emergencySearchText = it },
                        placeholder = { Text("Search class or section...", fontSize = 12.sp) },
                        leadingIcon = { Icon(Icons.Default.Search, contentDescription = "Search") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        shape = RoundedCornerShape(8.dp)
                    )
                    Spacer(modifier = Modifier.height(8.dp))

                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        items(filteredClasses) { cls ->
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(Color(0xFFF8FAFC))
                                    .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(8.dp))
                                    .clickable { viewModel.selectEmergencyClass(cls) }
                                    .padding(10.dp)
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column {
                                        Text(text = cls.name, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                        Text(text = "Section ${cls.section ?: "A"}", fontSize = 11.sp, color = Color(0xFF64748B))
                                    }
                                    Text(text = "Select →", color = PrimaryBlue, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = {},
            dismissButton = {
                TextButton(onClick = { viewModel.closeEmergencyModal() }) {
                    Text("Cancel")
                }
            }
        )
    }
}
