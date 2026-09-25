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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Security
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
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
import androidx.compose.ui.unit.sp
import com.governence.faflow.core.network.CampusDutyDto
import com.governence.faflow.core.network.DutyAssignmentDto
import com.governence.faflow.ui.components.AppTopBar
import com.governence.faflow.ui.theme.FaflowBg
import com.governence.faflow.ui.theme.FaflowBorder
import com.governence.faflow.ui.theme.FaflowNavy
import com.governence.faflow.ui.theme.FaflowSpacing
import com.governence.faflow.ui.theme.FaflowText1
import com.governence.faflow.ui.theme.FaflowText2
import com.governence.faflow.ui.theme.FaflowText3
import com.governence.faflow.ui.theme.PrimaryBlue
import com.governence.faflow.ui.theme.StatusError
import com.governence.faflow.ui.theme.StatusSuccess
import com.governence.faflow.ui.viewmodels.DutyViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DutyDetailScreen(
    dutyId: Int,
    viewModel: DutyViewModel,
    onNavigateBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(dutyId) {
        viewModel.loadDutyDetail(dutyId)
    }

    val duty = uiState.selectedDuty

    Scaffold(
        topBar = {
            AppTopBar(
                title = "Duty Details",
                subtitle = duty?.title ?: "Campus Assignment",
                canNavigateBack = true,
                onNavigateBack = onNavigateBack,
                actions = {
                    IconButton(onClick = { viewModel.loadDutyDetail(dutyId) }) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Refresh",
                            tint = FaflowNavy
                        )
                    }
                }
            )
        },
        containerColor = FaflowBg
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(FaflowBg)
        ) {
            when {
                uiState.isLoadingDetail && duty == null -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = PrimaryBlue)
                    }
                }

                duty == null -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                imageVector = Icons.Default.ErrorOutline,
                                contentDescription = "Error",
                                tint = StatusError,
                                modifier = Modifier.size(48.dp)
                            )
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(
                                text = uiState.errorMessage ?: "Duty not found",
                                color = FaflowText1,
                                fontWeight = FontWeight.Bold,
                                fontSize = 15.sp
                            )
                        }
                    }
                }

                else -> {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState())
                            .padding(FaflowSpacing.md),
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        // Overview Card
                        OverviewCard(duty = duty)

                        // Instructions Card
                        if (!duty.instructions.isNullOrBlank()) {
                            InstructionsCard(instructions = duty.instructions)
                        }

                        // Faculty Assignments Section
                        AssignmentsSection(duty = duty)
                    }
                }
            }
        }
    }
}

@Composable
fun OverviewCard(duty: CampusDutyDto) {
    val (typeColor, typeBg) = when (duty.dutyType) {
        "DISCIPLINE_DUTY" -> Pair(Color(0xFF2563EB), Color(0xFFEFF6FF))
        "WING_DUTY" -> Pair(Color(0xFF7C3AED), Color(0xFFF5F3FF))
        "EXAM_DUTY" -> Pair(Color(0xFFEA580C), Color(0xFFFFF7ED))
        else -> Pair(Color(0xFF4B5563), Color(0xFFF3F4F6))
    }

    val typeLabel = when (duty.dutyType) {
        "DISCIPLINE_DUTY" -> "Discipline Duty"
        "WING_DUTY" -> "Wing Duty"
        "EXAM_DUTY" -> "Exam Duty"
        else -> "Special Duty"
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(
                    color = typeBg,
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        text = typeLabel,
                        color = typeColor,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)
                    )
                }

                Surface(
                    color = if (duty.assignedTeachers >= duty.requiredTeachers) Color(0xFFECFDF5) else Color(0xFFFFFBEB),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        text = "${duty.assignedTeachers} / ${duty.requiredTeachers} Assigned",
                        color = if (duty.assignedTeachers >= duty.requiredTeachers) Color(0xFF059669) else Color(0xFFD97706),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }

            Text(
                text = duty.title,
                color = FaflowText1,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold
            )

            HorizontalDivider(color = FaflowBorder, thickness = 0.5.dp)

            // Info rows
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.Schedule,
                    contentDescription = "Time",
                    tint = PrimaryBlue,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "${duty.dutyDate} • ${duty.startTime} – ${duty.endTime}",
                    color = FaflowText1,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium
                )
            }

            duty.areaName?.let { area ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.LocationOn,
                        contentDescription = "Area",
                        tint = PrimaryBlue,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Location: $area",
                        color = FaflowText1,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }

            duty.breakName?.let { bName ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.Info,
                        contentDescription = "Break",
                        tint = PrimaryBlue,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Campus Period: $bName",
                        color = FaflowText1,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
        }
    }
}

@Composable
fun InstructionsCard(instructions: String) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFFF8FAFC)),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.5.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Text(
                text = "Duty Instructions",
                color = FaflowText1,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = instructions,
                color = FaflowText2,
                fontSize = 13.sp,
                lineHeight = 18.sp
            )
        }
    }
}

@Composable
fun AssignmentsSection(duty: CampusDutyDto) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Text(
            text = "Assigned Faculty (${duty.assignments.size})",
            color = FaflowText1,
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold
        )

        if (duty.assignments.isEmpty()) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "No teachers have been assigned to this duty yet.",
                        color = FaflowText2,
                        fontSize = 13.sp
                    )
                }
            }
        } else {
            duty.assignments.forEach { assignment ->
                AssignmentCard(assignment = assignment)
            }
        }
    }
}

@Composable
fun AssignmentCard(assignment: DutyAssignmentDto) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Surface(
                        color = Color(0xFFEFF6FF),
                        shape = CircleShape,
                        modifier = Modifier.size(36.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = Icons.Default.Person,
                                contentDescription = "Teacher",
                                tint = PrimaryBlue,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    }
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(
                            text = assignment.teacherName,
                            color = FaflowText1,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold
                        )
                        assignment.department?.let { dept ->
                            Text(
                                text = dept,
                                color = FaflowText3,
                                fontSize = 11.sp
                            )
                        }
                    }
                }

                if (assignment.isLocked) {
                    Surface(
                        color = Color(0xFFF3F4F6),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Lock,
                                contentDescription = "Locked",
                                tint = Color(0xFF4B5563),
                                modifier = Modifier.size(12.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = "Locked",
                                color = Color(0xFF4B5563),
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }

            // Explainability Reason Badge
            assignment.selectionReason?.let { reason ->
                HorizontalDivider(color = FaflowBorder, thickness = 0.5.dp)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.CheckCircle,
                        contentDescription = "Selection Reason",
                        tint = StatusSuccess,
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "Assigned because: $reason",
                        color = StatusSuccess,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }

            if (assignment.isOverridden && !assignment.overrideReason.isNullOrBlank()) {
                Text(
                    text = "Overridden by ${assignment.overriddenBy ?: "HOD"}: ${assignment.overrideReason}",
                    color = Color(0xFFD97706),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }
}
