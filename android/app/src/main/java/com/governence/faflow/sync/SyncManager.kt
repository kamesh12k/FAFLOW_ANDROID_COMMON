package com.governence.faflow.sync

import kotlinx.coroutines.flow.StateFlow

sealed interface SyncStatusState {
    data object Idle : SyncStatusState
    data class Syncing(val pendingCount: Int, val completedCount: Int) : SyncStatusState
    data class Success(val lastSyncTimestamp: Long, val syncedCount: Int) : SyncStatusState
    data class Error(val message: String, val pendingCount: Int) : SyncStatusState
}

/**
 * Contract for background network synchronization with backend endpoints.
 */
interface SyncManager {
    val syncState: StateFlow<SyncStatusState>
    val pendingRecordsCount: StateFlow<Int>

    suspend fun schedulePeriodicSync()
    suspend fun triggerImmediateSync(): Result<Int>
    suspend fun cancelSync()
}
