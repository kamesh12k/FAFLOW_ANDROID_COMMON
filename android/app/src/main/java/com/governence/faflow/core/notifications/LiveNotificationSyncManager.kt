package com.governence.faflow.core.notifications

import android.content.Context
import android.util.Log
import com.governence.faflow.core.di.AppContainer
import com.governence.faflow.core.network.FaflowApiClient
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Real-time foreground notification synchronization engine for FAFLOW.
 *
 * Ensures live notification delivery while the app is active in the foreground,
 * polling the server periodically (every 15s) so announcements, substitution alerts,
 * and approvals arrive immediately rather than waiting for 15-45 minute WorkManager delays.
 */
object LiveNotificationSyncManager {

    private const val TAG = "LiveNotificationSync"
    private const val POLL_INTERVAL_MS = 15_000L

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var syncJob: Job? = null
    private val isRunning = AtomicBoolean(false)

    /**
     * Starts the live notification polling engine while app is in foreground.
     */
    fun start(context: Context) {
        val appContext = context.applicationContext
        if (isRunning.compareAndSet(false, true)) {
            Log.i(TAG, "Starting LiveNotificationSyncManager (15s interval)")
            syncJob = scope.launch {
                while (isActive && isRunning.get()) {
                    try {
                        performNotificationCheck(appContext)
                    } catch (e: CancellationException) {
                        break
                    } catch (e: Exception) {
                        Log.w(TAG, "Polling tick error: ${e.message}")
                    }
                    delay(POLL_INTERVAL_MS)
                }
            }
        }
    }

    /**
     * Stops the live foreground poller when app moves to background.
     */
    fun stop() {
        if (isRunning.compareAndSet(true, false)) {
            Log.i(TAG, "Stopping LiveNotificationSyncManager")
            syncJob?.cancel()
            syncJob = null
        }
    }

    /**
     * Triggers an immediate one-shot check (e.g. on resume, login, or network recovery).
     */
    fun triggerImmediateCheck(context: Context) {
        val appContext = context.applicationContext
        scope.launch {
            try {
                performNotificationCheck(appContext)
            } catch (e: Exception) {
                Log.w(TAG, "Immediate check failed: ${e.message}")
            }
        }
    }

    private suspend fun performNotificationCheck(context: Context) {
        val container = AppContainer.getInstance(context)
        val tokenManager = container.tokenManager

        if (!tokenManager.hasValidToken()) {
            return
        }

        val userId = tokenManager.getUserId()
        val apiService = FaflowApiClient.create(tokenManager)
        val response = apiService.listNotifications(unreadOnly = true)

        if (response.isSuccessful && response.body() != null) {
            val notifications = response.body()!!
            if (notifications.isNotEmpty()) {
                FaflowNotificationManager.showBatchNotifications(
                    context = context,
                    notifications = notifications,
                    userId = userId
                )
            }
        }
    }
}
