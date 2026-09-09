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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.governence.faflow.ui.components.AppTopBar
import com.governence.faflow.ui.components.PrimaryGradientButton
import com.governence.faflow.ui.theme.PrimaryBlue
import com.governence.faflow.ui.theme.StatusSuccess
import com.governence.faflow.ui.viewmodels.PreferencesViewModel

@Composable
fun PreferencesScreen(
    viewModel: PreferencesViewModel,
    onNavigateBack: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    var acceptAuto by remember { mutableStateOf(state.acceptAutoAssignments) }
    var allowEmergency by remember { mutableStateOf(state.allowEmergencyAssignments) }
    var onlyMyClasses by remember { mutableStateOf(state.onlyMyClasses) }
    var preferMorning by remember { mutableStateOf(state.preferMorningClasses) }
    var preferSameDept by remember { mutableStateOf(state.preferSameDepartment) }
    var weeklyCap by remember { mutableFloatStateOf((state.maxWeeklySubstitutions ?: 0).toFloat()) }
    var hasNoLimit by remember { mutableStateOf(state.maxWeeklySubstitutions == null) }

    LaunchedEffect(state) {
        acceptAuto = state.acceptAutoAssignments
        allowEmergency = state.allowEmergencyAssignments
        onlyMyClasses = state.onlyMyClasses
        preferMorning = state.preferMorningClasses
        preferSameDept = state.preferSameDepartment
        hasNoLimit = state.maxWeeklySubstitutions == null
        weeklyCap = (state.maxWeeklySubstitutions ?: 0).toFloat()
    }

    LaunchedEffect(state.errorMessage) {
        state.errorMessage?.let { snackbarHostState.showSnackbar(it) }
    }

    Scaffold(
        topBar = {
            AppTopBar(
                title = "Substitution Preferences",
                canNavigateBack = true,
                onNavigateBack = onNavigateBack
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
        containerColor = MaterialTheme.colorScheme.background
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 18.dp, vertical = 12.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Success Feedback Banner
            if (state.isSaved) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFECFDF5))
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.CheckCircle,
                            contentDescription = null,
                            tint = StatusSuccess
                        )
                        Spacer(modifier = Modifier.padding(6.dp))
                        Text(
                            text = "Preferences successfully synchronized with server",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color(0xFF065F46),
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }

            // Description Header
            Text(
                text = "Control how FAFLOW assigns you as a substitute when colleagues take leave.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            // SECTION 1: ASSIGNMENT PERMISSIONS
            Text(
                text = "ASSIGNMENT PERMISSIONS",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.08.sp,
                color = MaterialTheme.colorScheme.primary
            )

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    PreferenceToggleRow(
                        title = "Accept automatic assignments",
                        description = "When off, the system will never automatically designate you without administrative intervention.",
                        checked = acceptAuto,
                        onCheckedChange = { acceptAuto = it }
                    )

                    HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp), color = MaterialTheme.colorScheme.outlineVariant)

                    PreferenceToggleRow(
                        title = "Allow emergency assignments",
                        description = "Permits assignment when leave is submitted shortly before class time.",
                        checked = allowEmergency && acceptAuto,
                        enabled = acceptAuto,
                        onCheckedChange = { allowEmergency = it }
                    )

                    HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp), color = MaterialTheme.colorScheme.outlineVariant)

                    PreferenceToggleRow(
                        title = "Only substitute for my regularly assigned classes",
                        description = "Hard restriction — you will only appear as a candidate for classes in your own syllabus.",
                        checked = onlyMyClasses,
                        onCheckedChange = { onlyMyClasses = it }
                    )
                }
            }

            // SECTION 2: SOFT PREFERENCES
            Text(
                text = "OPTIMIZATION PREFERENCES",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.08.sp,
                color = MaterialTheme.colorScheme.primary
            )

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    PreferenceToggleRow(
                        title = "Prefer morning classes",
                        description = "Nudges candidate ranking to prioritize Periods 1-2.",
                        checked = preferMorning,
                        onCheckedChange = { preferMorning = it }
                    )

                    HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp), color = MaterialTheme.colorScheme.outlineVariant)

                    PreferenceToggleRow(
                        title = "Prefer same department",
                        description = "Favors substitute opportunities within your own department faculty.",
                        checked = preferSameDept,
                        onCheckedChange = { preferSameDept = it }
                    )
                }
            }

            // SECTION 3: WORKLOAD CAPACITY LIMIT
            Text(
                text = "MAXIMUM SUBSTITUTIONS PER WEEK",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.08.sp,
                color = MaterialTheme.colorScheme.primary
            )

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = if (hasNoLimit) "Limit: No limit" else "Limit: ${weeklyCap.toInt()} classes / week",
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.SemiBold
                        )
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("No Limit", style = MaterialTheme.typography.bodySmall)
                            Switch(
                                checked = hasNoLimit,
                                onCheckedChange = {
                                    hasNoLimit = it
                                    if (it) weeklyCap = 0f else if (weeklyCap == 0f) weeklyCap = 4f
                                },
                                modifier = Modifier.padding(start = 8.dp)
                            )
                        }
                    }

                    if (!hasNoLimit) {
                        Spacer(modifier = Modifier.height(12.dp))
                        Slider(
                            value = weeklyCap,
                            onValueChange = { weeklyCap = it },
                            valueRange = 1f..10f,
                            steps = 8,
                            colors = androidx.compose.material3.SliderDefaults.colors(
                                thumbColor = PrimaryBlue,
                                activeTrackColor = PrimaryBlue
                            )
                        )
                    }
                    Text(
                        text = "Once reached within a rolling 7-day window, you will be excluded from automatic allocations.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            if (state.isLoading) {
                Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = PrimaryBlue)
                }
            } else {
                PrimaryGradientButton(
                    text = "Save Preferences",
                    icon = Icons.Default.Tune,
                    onClick = {
                        viewModel.saveAll(
                            acceptAuto = acceptAuto,
                            allowEmergency = allowEmergency,
                            maxWeekly = if (hasNoLimit) null else weeklyCap.toInt(),
                            preferMorning = preferMorning,
                            preferSameDept = preferSameDept,
                            onlyMyClasses = onlyMyClasses,
                            onComplete = onNavigateBack
                        )
                    }
                )
            }

            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

@Composable
private fun PreferenceToggleRow(
    title: String,
    description: String,
    checked: Boolean,
    enabled: Boolean = true,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Column(modifier = Modifier.weight(1f).padding(end = 12.dp)) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold,
                color = if (enabled) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
            )
            Text(
                text = description,
                style = MaterialTheme.typography.bodySmall,
                color = if (enabled) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
                lineHeight = 16.sp
            )
        }
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            enabled = enabled,
            colors = SwitchDefaults.colors(
                checkedThumbColor = Color.White,
                checkedTrackColor = PrimaryBlue
            )
        )
    }
}
