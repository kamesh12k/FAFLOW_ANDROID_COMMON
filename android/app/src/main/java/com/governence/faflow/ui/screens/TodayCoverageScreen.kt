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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.SwapHoriz
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
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
import com.governence.faflow.core.network.TodaySubstitutionItemDto
import com.governence.faflow.ui.components.DayOrderBadge
import com.governence.faflow.ui.components.MetricCard
import com.governence.faflow.ui.components.PremiumTopBar
import com.governence.faflow.ui.components.SectionHeader
import com.governence.faflow.ui.components.StatusBadge
import com.governence.faflow.ui.theme.FaflowShapes
import com.governence.faflow.ui.theme.FaflowSpacing
import com.governence.faflow.ui.theme.FaflowStatusColors
import com.governence.faflow.ui.viewmodels.HodViewModel

@Composable
fun TodayCoverageScreen(
    hodViewModel: HodViewModel,
    onNavigateBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    val coverageState by hodViewModel.coverageState.collectAsState()

    LaunchedEffect(Unit) {
        hodViewModel.loadCoverage()
    }

    Scaffold(
        topBar = {
            PremiumTopBar(
                title = "Today's Coverage",
                subtitle = "Active Substitution & Slot Coverage",
                onNavigateBack = onNavigateBack,
                actions = {
                    IconButton(onClick = { hodViewModel.loadCoverage() }) {
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
            if (coverageState.isLoading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                }
            } else if (coverageState.errorMessage != null) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(FaflowSpacing.xl),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = coverageState.errorMessage ?: "Failed to load coverage",
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            } else {
                val coverage = coverageState.coverage
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = FaflowSpacing.lg),
                    verticalArrangement = Arrangement.spacedBy(FaflowSpacing.md)
                ) {
                    item {
                        Spacer(modifier = Modifier.height(FaflowSpacing.xs))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(FaflowSpacing.md)
                        ) {
                            MetricCard(
                                title = "Covered Slots",
                                value = (coverage?.coveredSlots ?: 0).toString(),
                                icon = Icons.Default.CheckCircle,
                                iconTint = FaflowStatusColors.Approved,
                                modifier = Modifier.weight(1f)
                            )
                            MetricCard(
                                title = "Uncovered",
                                value = (coverage?.uncoveredSlots ?: 0).toString(),
                                icon = Icons.Default.Error,
                                iconTint = if ((coverage?.uncoveredSlots ?: 0) > 0) FaflowStatusColors.Rejected else FaflowStatusColors.Approved,
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }

                    item {
                        SectionHeader(title = "Scheduled Substitutions (${coverage?.substitutions?.size ?: 0})")
                    }

                    val substitutions = coverage?.substitutions ?: emptyList()
                    if (substitutions.isEmpty()) {
                        item {
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = FaflowShapes.card,
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(FaflowSpacing.xxl),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = "No substitutions required or scheduled today.",
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                        }
                    } else {
                        items(substitutions) { item ->
                            SubstitutionCoverageCard(item = item)
                        }
                    }

                    item {
                        Spacer(modifier = Modifier.height(FaflowSpacing.xl))
                    }
                }
            }
        }
    }
}

@Composable
fun SubstitutionCoverageCard(
    item: TodaySubstitutionItemDto,
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
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "Period ${item.periodNumber}",
                        fontWeight = FontWeight.ExtraBold,
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    if (item.className != null) {
                        Spacer(modifier = Modifier.padding(horizontal = 4.dp))
                        Text(
                            text = "• ${item.className}",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
                StatusBadge(status = item.status)
            }

            if (item.subjectName != null) {
                Spacer(modifier = Modifier.height(FaflowSpacing.xs))
                Text(
                    text = item.subjectName,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.SemiBold
                )
            }

            Spacer(modifier = Modifier.height(FaflowSpacing.md))

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "ABSENT FACULTY",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontSize = 10.sp
                    )
                    Text(
                        text = item.originalTeacherName ?: "Staff",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                }

                Icon(
                    imageVector = Icons.Default.SwapHoriz,
                    contentDescription = "Substituted by",
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(horizontal = FaflowSpacing.sm)
                )

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "SUBSTITUTE",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontSize = 10.sp
                    )
                    Text(
                        text = item.substituteTeacherName ?: "Unassigned",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Bold,
                        color = if (item.substituteTeacherName != null) FaflowStatusColors.Approved else FaflowStatusColors.Pending
                    )
                }
            }
        }
    }
}
