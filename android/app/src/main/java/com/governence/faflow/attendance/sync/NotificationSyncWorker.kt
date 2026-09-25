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
import com.governence.faflow.core.network.FaflowApiClient
import com.governence.faflow.core.network.TokenManager
import com.governence.faflow.core.notifications.FaflowNotificationManager
import java.util.concurrent.TimeUnit

/**
 * Background WorkManager worker that fetches unread notifications and announcements
 * from the FAFLOW server and posts native Android OS notifications.
 */
class NotificationSyncWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        val tokenManager = TokenManager(applicationContext)
        if (!tokenManager.hasValidToken()) {
            return Result.success()
        }

        return try {
            val apiService = FaflowApiClient.create(tokenManager)
            val response = apiService.listNotifications(unreadOnly = true)

            if (response.isSuccessful) {
                val notifications = response.body() ?: emptyList()
                val userId = tokenManager.getUserId()
                FaflowNotificationManager.showBatchNotifications(
                    context = applicationContext,
                    notifications = notifications,
                    userId = userId
                )
            }
            Result.success()
        } catch (_: Exception) {
            Result.retry()
        }
    }

    companion object {
        private const val UNIQUE_WORK_NAME_ONE_TIME = "faflow_notification_sync_immediate"
        private const val UNIQUE_WORK_NAME_PERIODIC = "faflow_notification_sync_periodic"

        fun triggerImmediateSync(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = OneTimeWorkRequestBuilder<NotificationSyncWorker>()
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

            val request = PeriodicWorkRequestBuilder<NotificationSyncWorker>(15, TimeUnit.MINUTES)
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
