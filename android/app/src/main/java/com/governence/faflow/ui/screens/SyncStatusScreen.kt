package com.governence.faflow.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CloudDone
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.governence.faflow.ui.components.AppTopBar
import com.governence.faflow.ui.components.PrimaryGradientButton
import com.governence.faflow.ui.components.ResultRow
import com.governence.faflow.ui.theme.StatusSuccess

@Composable
fun SyncStatusScreen(
    onNavigateBack: () -> Unit
) {
    Scaffold(
        topBar = {
            AppTopBar(
                title = "Sync & Connectivity",
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
        ) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Column(modifier = Modifier.padding(20.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.CloudDone,
                            contentDescription = null,
                            tint = StatusSuccess
                        )
                        Spacer(modifier = Modifier.padding(6.dp))
                        Text(
                            text = "All Records Synchronized",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = StatusSuccess
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))
                    ResultRow("Pending Sync Queue", "0 items")
                    Spacer(modifier = Modifier.height(8.dp))
                    ResultRow("Last Successful Sync", "2 mins ago")
                    Spacer(modifier = Modifier.height(8.dp))
                    ResultRow("Offline SQLite Records", "142 verified")
                    Spacer(modifier = Modifier.height(8.dp))
                    ResultRow("WorkManager Strategy", "Periodic + On Network Available")
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            PrimaryGradientButton(
                text = "Trigger Immediate Sync",
                icon = Icons.Default.Sync,
                onClick = { /* Trigger WorkManager sync */ }
            )
        }
    }
}
