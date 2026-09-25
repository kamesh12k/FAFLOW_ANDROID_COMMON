package com.governence.faflow.attendance.sync

import android.content.Context
import android.util.Log
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.governence.faflow.attendance.student.data.StudentAttendanceLocalDb
import com.governence.faflow.attendance.student.data.StudentAttendanceRepository
import com.governence.faflow.core.network.FaflowApiClient
import com.governence.faflow.core.network.TokenManager
import java.util.concurrent.TimeUnit

/**
 * Background WorkManager worker responsible for durable synchronization of offline
 * student attendance outbox items to the FAFLOW institutional server.
 *
 * Enforces:
 * - NetworkType.CONNECTED constraint
 * - Exponential backoff retry on transient HTTP/network failures
 * - Token availability check before attempting sync
 * - Zero loss of pending records on process death or network loss
 */
class StudentAttendanceSyncWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        val tag = "[StudentAttendanceSync]"
        Log.i(TAG, "$tag Worker started. attemptCount=$runAttemptCount")

        val tokenManager = TokenManager(applicationContext)
        val token = tokenManager.getToken()
        if (token.isNullOrBlank()) {
            Log.w(TAG, "$tag No valid authentication token present. Deferring sync.")
            return Result.retry()
        }

        // Ensure base URL is initialized in this worker process
        FaflowApiClient.initBaseUrl(applicationContext)

        val localDb = StudentAttendanceLocalDb(applicationContext)
        // Recover any records permanently stuck in SYNCING state from previous crashed runs.
        localDb.resetStuckSyncingRecords()
        val pendingCount = localDb.getPendingCount()
        Log.i(TAG, "$tag Checking pending student attendance records. count=$pendingCount")
        if (pendingCount == 0) {
            return Result.success()
        }

        val apiService = FaflowApiClient.create(tokenManager)
        val repository = StudentAttendanceRepository(apiService, localDb, applicationContext)

        return try {
            Log.i(TAG, "$tag Uploading $pendingCount pending student attendance operations to server...")
            val syncedCount = repository.syncPendingOperations("ANDROID_${android.os.Build.MODEL}")
            val remaining = repository.getPendingCount()
            Log.i(TAG, "$tag Batch sync finished. syncedCount=$syncedCount, remainingPending=$remaining")

            if (remaining == 0) {
                Log.i(TAG, "$tag All pending student attendance records synchronized successfully.")
                Result.success()
            } else {
                Log.w(TAG, "$tag Some records failed to synchronize. Requesting backoff retry.")
                Result.retry()
            }
        } catch (e: Exception) {
            Log.e(TAG, "$tag Unexpected exception during student attendance sync: ${e.message}", e)
            Result.retry()
        }
    }

    companion object {
        private const val TAG = "StudentSyncWorker"
        private const val UNIQUE_WORK_NAME_ONE_TIME = "faflow_student_attendance_sync_immediate"
        private const val UNIQUE_WORK_NAME_PERIODIC = "faflow_student_attendance_sync_periodic"

        fun triggerImmediateSync(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = OneTimeWorkRequestBuilder<StudentAttendanceSyncWorker>()
                .setConstraints(constraints)
                .setBackoffCriteria(
                    BackoffPolicy.EXPONENTIAL,
                    15,
                    TimeUnit.SECONDS
                )
                .build()

            WorkManager.getInstance(context).enqueueUniqueWork(
                UNIQUE_WORK_NAME_ONE_TIME,
                ExistingWorkPolicy.REPLACE,
                request
            )
            Log.i(TAG, "[StudentAttendanceSync] Enqueued immediate one-time sync worker.")
        }

        fun schedulePeriodicSync(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = PeriodicWorkRequestBuilder<StudentAttendanceSyncWorker>(15, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .setBackoffCriteria(
                    BackoffPolicy.EXPONENTIAL,
                    30,
                    TimeUnit.SECONDS
                )
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                UNIQUE_WORK_NAME_PERIODIC,
                ExistingPeriodicWorkPolicy.KEEP,
                request
            )
            Log.i(TAG, "[StudentAttendanceSync] Enqueued periodic 15-minute reconciliation worker.")
        }
    }
}
