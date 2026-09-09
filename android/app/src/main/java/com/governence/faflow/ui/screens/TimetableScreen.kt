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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.MeetingRoom
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.governence.faflow.domain.model.TimetableSlot
import com.governence.faflow.ui.components.ErrorRetryView
import com.governence.faflow.ui.components.FaflowSectionHeader
import com.governence.faflow.ui.components.FaflowStatusBadge
import com.governence.faflow.ui.components.FaflowSurface
import com.governence.faflow.ui.theme.FaflowShapes
import com.governence.faflow.ui.theme.FaflowSpacing
import com.governence.faflow.ui.theme.FaflowStatusColors
import com.governence.faflow.ui.theme.PrimaryBlue
import com.governence.faflow.ui.viewmodels.TimetableViewModel

/**
 * Modern Academic Timetable Screen for FAFLOW.
 * Clean, minimal schedule view with Day Order pill selectors,
 * explicit Room / Subject / Class hierarchy, and clear free-period states.
 */
@Composable
fun TimetableScreen(
    viewModel: TimetableViewModel,
    onNavigateBack: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(com.governence.faflow.ui.theme.FaflowBg)
                    .padding(horizontal = 18.dp, vertical = 12.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(
                        onClick = onNavigateBack,
                        modifier = Modifier.size(34.dp)
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back",
                            tint = com.governence.faflow.ui.theme.FaflowText1,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                    Spacer(modifier = Modifier.width(6.dp))
                    Column {
                        Text(
                            text = "Weekly timetable",
                            fontSize = 19.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = (-0.01).sp,
                            color = com.governence.faflow.ui.theme.FaflowText1
                        )
                        Text(
                            text = "Academic schedule by day order",
                            fontSize = 12.sp,
                            color = com.governence.faflow.ui.theme.FaflowText3
                        )
                    }
                }
            }
        },
        containerColor = com.governence.faflow.ui.theme.FaflowBg
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(com.governence.faflow.ui.theme.FaflowBg)
        ) {
            // Day tabs (.daytabs)
            LazyRow(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(com.governence.faflow.ui.theme.FaflowBg)
                    .padding(horizontal = 18.dp)
            ) {
                items((1..5).toList()) { day ->
                    val isSelected = day == state.selectedDayOrder
                    Column(
                        modifier = Modifier
                            .clickable { viewModel.selectDayOrder(day) }
                            .padding(horizontal = 14.dp, vertical = 10.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = "Day $day",
                            fontSize = 12.5.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = if (isSelected) com.governence.faflow.ui.theme.FaflowNavy else com.governence.faflow.ui.theme.FaflowText3
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Box(
                            modifier = Modifier
                                .width(36.dp)
                                .height(2.dp)
                                .background(if (isSelected) com.governence.faflow.ui.theme.FaflowNavy else Color.Transparent)
                        )
                    }
                }
            }

            androidx.compose.material3.HorizontalDivider(
                thickness = 1.dp,
                color = com.governence.faflow.ui.theme.FaflowBorder
            )

            if (state.isLoading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(
                        color = com.governence.faflow.ui.theme.FaflowNavy,
                        strokeWidth = 2.5.dp
                    )
                }
            } else if (state.errorMessage != null && state.allSlots.isEmpty()) {
                ErrorRetryView(
                    message = state.errorMessage!!,
                    onRetry = { viewModel.retry() }
                )
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 18.dp),
                    contentPadding = PaddingValues(top = 14.dp, bottom = 28.dp)
                ) {
                    item {
                        Text(
                            text = "${state.daySlots.size} teaching period assigned",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = com.governence.faflow.ui.theme.FaflowText1,
                            modifier = Modifier.padding(bottom = 12.dp)
                        )
                    }

                    items((1..5).toList()) { period ->
                        val slot = state.daySlots.find { it.periodNumber == period }
                        TimetablePeriodItem(period = period, slot = slot)
                    }
                }
            }
        }
    }
}

@Composable
fun TimetablePeriodItem(period: Int, slot: TimetableSlot?) {
    val periodTime = when (period) {
        1 -> "08:45"
        2 -> "09:40"
        3 -> "10:50"
        4 -> "11:45"
        5 -> "01:30"
        else -> "Slot $period"
    }

    val isBusy = slot != null

    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 14.dp),
            verticalAlignment = Alignment.Top
        ) {
            // Period Time column (width: 60dp)
            Column(
                modifier = Modifier.width(60.dp)
            ) {
                Text(
                    text = "P0$period",
                    fontSize = 10.5.sp,
                    fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
                    fontWeight = FontWeight.Medium,
                    color = com.governence.faflow.ui.theme.FaflowText3
                )
                Spacer(modifier = Modifier.height(3.dp))
                Text(
                    text = periodTime,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = com.governence.faflow.ui.theme.FaflowText2
                )
            }

            // Period Line (3px, rounded)
            Box(
                modifier = Modifier
                    .width(3.dp)
                    .height(48.dp)
                    .clip(RoundedCornerShape(3.dp))
                    .background(
                        if (isBusy) com.governence.faflow.ui.theme.FaflowViolet else com.governence.faflow.ui.theme.FaflowDivider
                    )
            )

            Spacer(modifier = Modifier.width(14.dp))

            // Period Body
            Column(modifier = Modifier.weight(1f)) {
                if (isBusy && slot != null) {
                    Text(
                        text = slot.subjectName,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = com.governence.faflow.ui.theme.FaflowText1
                    )
                    Spacer(modifier = Modifier.height(3.dp))
                    val roomDisplay = if (slot.roomNumber.startsWith("Room", ignoreCase = true)) {
                        slot.roomNumber
                    } else {
                        "Room ${slot.roomNumber}"
                    }
                    Text(
                        text = "${slot.className} (${slot.section}) · $roomDisplay",
                        fontSize = 11.5.sp,
                        color = com.governence.faflow.ui.theme.FaflowText3
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(5.dp))
                            .background(com.governence.faflow.ui.theme.FaflowVioletTint)
                            .padding(horizontal = 8.dp, vertical = 3.dp)
                    ) {
                        Text(
                            text = slot.subjectCode,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = com.governence.faflow.ui.theme.FaflowViolet
                        )
                    }
                } else {
                    Text(
                        text = "Free period",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium,
                        color = com.governence.faflow.ui.theme.FaflowText3
                    )
                    Spacer(modifier = Modifier.height(3.dp))
                    Text(
                        text = "Research, syllabus preparation & grading",
                        fontSize = 11.5.sp,
                        color = com.governence.faflow.ui.theme.FaflowText3
                    )
                }
            }
        }

        androidx.compose.material3.HorizontalDivider(
            thickness = 1.dp,
            color = com.governence.faflow.ui.theme.FaflowDivider
        )
    }
}

