package com.governence.faflow.attendance.sync

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.governence.faflow.attendance.data.AttendanceLocalQueue
import com.governence.faflow.attendance.data.AttendanceRepository
import com.governence.faflow.core.network.FaflowApiClient
import com.governence.faflow.core.network.TokenManager
import java.util.concurrent.TimeUnit

/**
 * Background WorkManager worker synchronizing offline pending attendance records
 * once an active internet connection is restored.
 */
class AttendanceSyncWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        val queue = AttendanceLocalQueue(applicationContext)
        val tokenManager = TokenManager(applicationContext)
        val apiService = FaflowApiClient.create(tokenManager)
        val repository = AttendanceRepository(apiService, queue)

        val pendingCount = repository.getPendingCount()
        if (pendingCount == 0) {
            return Result.success()
        }

        return try {
            val syncedCount = repository.synchronizePendingTransactions()
            if (repository.getPendingCount() == 0) {
                Result.success()
            } else {
                Result.retry()
            }
        } catch (_: Exception) {
            Result.retry()
        }
    }

    companion object {
        private const val UNIQUE_WORK_NAME_ONE_TIME = "faflow_attendance_sync_immediate"
        private const val UNIQUE_WORK_NAME_PERIODIC = "faflow_attendance_sync_periodic"

        fun triggerImmediateSync(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = OneTimeWorkRequestBuilder<AttendanceSyncWorker>()
                .setConstraints(constraints)
                .build()

            WorkManager.getInstance(context).enqueueUniqueWork(
                UNIQUE_WORK_NAME_ONE_TIME,
                ExistingWorkPolicy.REPLACE,
                request
            )
        }

        fun schedulePeriodicSync(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = PeriodicWorkRequestBuilder<AttendanceSyncWorker>(15, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                UNIQUE_WORK_NAME_PERIODIC,
                ExistingPeriodicWorkPolicy.KEEP,
                request
            )
        }
    }
}
