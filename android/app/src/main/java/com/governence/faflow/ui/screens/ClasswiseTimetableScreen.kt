package com.governence.faflow.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MeetingRoom
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Refresh
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
import androidx.compose.material3.OutlinedTextField
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
import com.governence.faflow.core.network.TimetableSlotOutDto
import com.governence.faflow.ui.components.DayOrderBadge
import com.governence.faflow.ui.components.PremiumTopBar
import com.governence.faflow.ui.components.SectionHeader
import com.governence.faflow.ui.theme.FaflowShapes
import com.governence.faflow.ui.theme.FaflowSpacing
import com.governence.faflow.ui.viewmodels.HodViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ClasswiseTimetableScreen(
    hodViewModel: HodViewModel,
    onNavigateBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    val timetableState by hodViewModel.timetableState.collectAsState()
    var isDropdownExpanded by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        hodViewModel.loadClassesAndTimetable()
    }

    Scaffold(
        topBar = {
            PremiumTopBar(
                title = "Class Timetable",
                subtitle = "View Schedule by Class & Day Order",
                onNavigateBack = onNavigateBack,
                actions = {
                    IconButton(onClick = { hodViewModel.loadClassesAndTimetable() }) {
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

                // Class Selector Dropdown
                val selectedClass = timetableState.classes.find { it.id == timetableState.selectedClassId }
                ExposedDropdownMenuBox(
                    expanded = isDropdownExpanded,
                    onExpandedChange = { isDropdownExpanded = !isDropdownExpanded },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    OutlinedTextField(
                        value = selectedClass?.let { "${it.name} (${it.section ?: "A"})" } ?: "Select Class",
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Selected Class") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = isDropdownExpanded) },
                        modifier = Modifier
                            .menuAnchor()
                            .fillMaxWidth(),
                        shape = FaflowShapes.medium
                    )

                    ExposedDropdownMenu(
                        expanded = isDropdownExpanded,
                        onDismissRequest = { isDropdownExpanded = false }
                    ) {
                        timetableState.classes.forEach { classItem ->
                            DropdownMenuItem(
                                text = { Text("${classItem.name} (${classItem.section ?: "A"})") },
                                onClick = {
                                    hodViewModel.selectClass(classItem.id)
                                    isDropdownExpanded = false
                                }
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(FaflowSpacing.md))

                // Day Order Selector (1 to 6)
                Text(
                    text = "DAY ORDER",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(FaflowSpacing.xs))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(FaflowSpacing.sm)
                ) {
                    (1..6).forEach { day ->
                        val isSelected = timetableState.selectedDayOrder == day
                        FilterChip(
                            selected = isSelected,
                            onClick = { hodViewModel.selectDayOrder(day) },
                            label = { Text("Day $day", fontWeight = FontWeight.Bold) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = MaterialTheme.colorScheme.primary,
                                selectedLabelColor = Color.White
                            ),
                            shape = FaflowShapes.pill
                        )
                    }
                }

                Spacer(modifier = Modifier.height(FaflowSpacing.md))

                if (timetableState.isLoading) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                    }
                } else if (timetableState.errorMessage != null) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(FaflowSpacing.xl),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = timetableState.errorMessage ?: "Failed to load schedule",
                            color = MaterialTheme.colorScheme.error
                        )
                    }
                } else {
                    val slots = timetableState.timetableSlots
                    if (slots.isEmpty()) {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(FaflowSpacing.xxl),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "No classes scheduled for Day Order ${timetableState.selectedDayOrder}.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    } else {
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            verticalArrangement = Arrangement.spacedBy(FaflowSpacing.md)
                        ) {
                            items(slots.sortedBy { it.periodNumber }) { slot ->
                                ClassSlotCard(slot = slot)
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
}

@Composable
fun ClassSlotCard(
    slot: TimetableSlotOutDto,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = FaflowShapes.card,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(FaflowSpacing.lg),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .clip(FaflowShapes.medium)
                    .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.12f))
                    .padding(horizontal = 14.dp, vertical = 10.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "P${slot.periodNumber}",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.ExtraBold,
                    color = MaterialTheme.colorScheme.primary
                )
            }

            Spacer(modifier = Modifier.width(FaflowSpacing.md))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = slot.subjectName ?: "Subject ${slot.subjectId ?: ""}",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface
                )
                if (slot.subjectCode != null) {
                    Text(
                        text = slot.subjectCode,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary
                    )
                }
                Spacer(modifier = Modifier.height(FaflowSpacing.xs))
                Row(
                    horizontalArrangement = Arrangement.spacedBy(FaflowSpacing.md),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (slot.teacherName != null) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.Person,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(end = 4.dp).height(14.dp)
                            )
                            Text(
                                text = slot.teacherName,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                    if (slot.roomNumber != null) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.MeetingRoom,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(end = 4.dp).height(14.dp)
                            )
                            Text(
                                text = slot.roomNumber,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }
        }
    }
}
