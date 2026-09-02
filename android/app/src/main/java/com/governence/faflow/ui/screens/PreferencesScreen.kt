package com.governence.faflow.ui.screens

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
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.governence.faflow.ui.components.AppTopBar
import com.governence.faflow.ui.components.PrimaryGradientButton
import com.governence.faflow.ui.viewmodels.PreferencesViewModel

@Composable
fun PreferencesScreen(
    viewModel: PreferencesViewModel,
    onNavigateBack: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()

    var maxSubsPerDay by remember { mutableFloatStateOf(2f) }
    var maxSubsPerWeek by remember { mutableFloatStateOf(6f) }
    var allowCrossDept by remember { mutableStateOf(false) }

    LaunchedEffect(state.maxPerDay, state.maxPerWeek, state.crossDept) {
        maxSubsPerDay = state.maxPerDay.toFloat()
        maxSubsPerWeek = state.maxPerWeek.toFloat()
        allowCrossDept = state.crossDept
    }

    Scaffold(
        topBar = {
            AppTopBar(
                title = "Substitution Preferences",
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
                .padding(20.dp)
                .verticalScroll(rememberScrollState())
        ) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Max Substitutions / Day: ${maxSubsPerDay.toInt()}",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                    Slider(
                        value = maxSubsPerDay,
                        onValueChange = { maxSubsPerDay = it },
                        valueRange = 1f..4f,
                        steps = 2
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    Text(
                        text = "Max Substitutions / Week: ${maxSubsPerWeek.toInt()}",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                    Slider(
                        value = maxSubsPerWeek,
                        onValueChange = { maxSubsPerWeek = it },
                        valueRange = 2f..10f,
                        steps = 7
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Cross-Department Duty", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                            Text("Allow substitution duties in other departments", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Switch(checked = allowCrossDept, onCheckedChange = { allowCrossDept = it })
                    }
                }
            }

            Spacer(modifier = Modifier.height(28.dp))

            if (state.isLoading) {
                CircularProgressIndicator(
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.align(Alignment.CenterHorizontally)
                )
            } else {
                PrimaryGradientButton(
                    text = "Save Preferences to FAFLOW",
                    onClick = {
                        viewModel.savePreferences(
                            day = maxSubsPerDay.toInt(),
                            week = maxSubsPerWeek.toInt(),
                            cross = allowCrossDept,
                            onComplete = onNavigateBack
                        )
                    }
                )
            }
        }
    }
}
