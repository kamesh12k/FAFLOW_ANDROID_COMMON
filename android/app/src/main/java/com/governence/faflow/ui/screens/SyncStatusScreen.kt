package com.governence.faflow.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.CloudDone
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.governence.faflow.attendance.student.data.StudentAttendanceLocalDb
import com.governence.faflow.attendance.sync.StudentAttendanceSyncWorker
import com.governence.faflow.ui.components.AppTopBar
import com.governence.faflow.ui.components.PrimaryGradientButton
import com.governence.faflow.ui.components.ResultRow
import com.governence.faflow.ui.theme.StatusSuccess
import com.governence.faflow.ui.theme.StatusWarning

@Composable
fun SyncStatusScreen(
    onNavigateBack: () -> Unit
) {
    val context = LocalContext.current

    // Read real pending count and item summaries from local SQLite outbox
    val localDb = remember { StudentAttendanceLocalDb(context) }
    var pendingCount by remember { mutableIntStateOf(localDb.getPendingCount()) }
    var pendingItems by remember { mutableStateOf(localDb.getPendingItemSummaries()) }
    var syncTriggered by remember { mutableStateOf(false) }

    // Auto-refresh when sync is triggered or when screen stays open
    androidx.compose.runtime.LaunchedEffect(syncTriggered) {
        if (syncTriggered) {
            for (i in 1..8) {
                kotlinx.coroutines.delay(1000)
                pendingCount = localDb.getPendingCount()
                pendingItems = localDb.getPendingItemSummaries()
                if (pendingCount == 0) break
            }
            syncTriggered = false
        }
    }

    val allSynced = pendingCount == 0

    Scaffold(
        topBar = {
            AppTopBar(
                title = "Sync & Connectivity",
                canNavigateBack = true,
                onNavigateBack = onNavigateBack
            )
        },
        containerColor = com.governence.faflow.ui.theme.FaflowBg
    ) { innerPadding ->
        val scrollState = rememberScrollState()
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(com.governence.faflow.ui.theme.FaflowBg)
                .padding(innerPadding)
                .padding(20.dp)
                .verticalScroll(scrollState)
        ) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = androidx.compose.foundation.BorderStroke(
                    1.dp,
                    if (allSynced) com.governence.faflow.ui.theme.FaflowBorder
                    else StatusWarning.copy(alpha = 0.5f)
                ),
                elevation = CardDefaults.cardElevation(defaultElevation = 0.5.dp)
            ) {
                Column(modifier = Modifier.padding(20.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = if (allSynced) Icons.Default.CloudDone else Icons.Default.CloudOff,
                            contentDescription = null,
                            tint = if (allSynced) StatusSuccess else StatusWarning,
                            modifier = Modifier.size(24.dp)
                        )
                        Spacer(modifier = Modifier.padding(6.dp))
                        Text(
                            text = if (allSynced) "All Records Synchronized" else "Pending Records Waiting",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = if (allSynced) StatusSuccess else StatusWarning
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))
                    ResultRow(
                        "Pending Sync Queue",
                        if (allSynced) "0 items" else "$pendingCount item(s) pending upload"
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    ResultRow(
                        "Status",
                        if (syncTriggered) "Sync in progress..."
                        else if (allSynced) "Fully synchronized with server" else "Waiting for network upload"
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    ResultRow("WorkManager Strategy", "Periodic (15 min) + On Network Available")
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            PrimaryGradientButton(
                text = if (syncTriggered) "Syncing..." else "Trigger Immediate Sync",
                icon = Icons.Default.Sync,
                onClick = {
                    localDb.resetStuckSyncingRecords()
                    StudentAttendanceSyncWorker.triggerImmediateSync(context)
                    pendingCount = localDb.getPendingCount()
                    pendingItems = localDb.getPendingItemSummaries()
                    syncTriggered = true
                }
            )

            if (pendingItems.isNotEmpty()) {
                Spacer(modifier = Modifier.height(24.dp))
                Text(
                    text = "Pending Outbox Items",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = com.governence.faflow.ui.theme.FaflowText1
                )
                Spacer(modifier = Modifier.height(8.dp))

                pendingItems.forEach { item ->
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        border = androidx.compose.foundation.BorderStroke(1.dp, com.governence.faflow.ui.theme.FaflowBorder)
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = androidx.compose.foundation.layout.Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "${item.operationType} Attendance",
                                    fontWeight = FontWeight.Bold,
                                    style = MaterialTheme.typography.bodyMedium
                                )
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(
                                        text = item.syncStatus,
                                        style = MaterialTheme.typography.labelSmall,
                                        color = if (item.syncStatus == "SYNCED") StatusSuccess else StatusWarning
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    androidx.compose.material3.IconButton(
                                        onClick = {
                                            localDb.deleteOperation(item.operationId)
                                            pendingCount = localDb.getPendingCount()
                                            pendingItems = localDb.getPendingItemSummaries()
                                            android.widget.Toast.makeText(context, "Record removed from outbox", android.widget.Toast.LENGTH_SHORT).show()
                                        },
                                        modifier = Modifier.size(24.dp)
                                    ) {
                                        Icon(
                                            androidx.compose.material.icons.Icons.Default.Close,
                                            contentDescription = "Discard",
                                            tint = Color(0xFFEF4444),
                                            modifier = Modifier.size(16.dp)
                                        )
                                    }
                                }
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            if (item.classId != null) {
                                Text(
                                    text = "Class ID: ${item.classId}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = com.governence.faflow.ui.theme.FaflowText2
                                )
                            }
                            if (!item.lastError.isNullOrBlank()) {
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = "Last Info: ${item.lastError}",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = Color(0xFFD32F2F)
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))
                androidx.compose.material3.OutlinedButton(
                    onClick = {
                        try {
                            androidx.work.WorkManager.getInstance(context).cancelUniqueWork("faflow_student_attendance_sync_immediate")
                        } catch (_: Exception) {}
                        localDb.clearSyncQueue()
                        pendingCount = localDb.getPendingCount()
                        pendingItems = localDb.getPendingItemSummaries()
                        android.widget.Toast.makeText(context, "Sync queue cleared", android.widget.Toast.LENGTH_SHORT).show()
                    },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = androidx.compose.material3.ButtonDefaults.outlinedButtonColors(
                        contentColor = Color(0xFFD32F2F)
                    ),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFD32F2F).copy(alpha = 0.5f))
                ) {
                    Text("Clear / Discard Stuck Queue")
                }
            }
        }
    }
}
