package com.governence.faflow

import android.app.Application
import android.util.Log
import com.governence.faflow.core.di.AppContainer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * FAFLOW Application class.
 *
 * Pre-warms the AppContainer (including EncryptedSharedPreferences / Android Keystore)
 * on a background coroutine so that the first Compose frame is not blocked by
 * synchronous I/O or cryptographic key derivation.
 *
 * Without this, AppContainer.getInstance() is first called from inside a @Composable
 * (NavGraph.kt), which executes on the main thread and triggers:
 *   TokenManager constructor
 *     -> EncryptedSharedPreferences.create()  <- Keystore I/O (can take 100-400ms)
 *     -> hasValidToken()                       <- reads encrypted prefs synchronously
 *   FaflowApiClient.initBaseUrl()             <- reads SharedPreferences synchronously
 *
 * By pre-warming here, those operations complete before the first Composable ever runs.
 */
class FaflowApplication : Application() {

    /** App-wide background scope — SupervisorJob prevents one failure from cancelling others. */
    val applicationScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    override fun onCreate() {
        super.onCreate()

        // Pre-warm AppContainer on a background thread.
        // This accesses: FaflowApiClient.initBaseUrl, TokenManager (EncryptedSharedPreferences),
        // and calls initializeTokenManager() to pre-populate the isLoggedIn StateFlow.
        // Schedule durable background periodic workers (safety-net reconciliation)
        com.governence.faflow.attendance.sync.AttendanceSyncWorker.schedulePeriodicSync(this)
        com.governence.faflow.attendance.sync.StudentAttendanceSyncWorker.schedulePeriodicSync(this)

        // 1. Automatic Reconnection Listener: Auto-sync outboxes as soon as internet connection is restored
        val connectivityManager = getSystemService(android.content.Context.CONNECTIVITY_SERVICE) as? android.net.ConnectivityManager
        connectivityManager?.let { cm ->
            try {
                cm.registerDefaultNetworkCallback(object : android.net.ConnectivityManager.NetworkCallback() {
                    override fun onAvailable(network: android.net.Network) {
                        Log.i("FAFLOW_APP", "[AutoSync] Network connection available/restored. Auto-triggering background sync.")
                        com.governence.faflow.attendance.sync.StudentAttendanceSyncWorker.triggerImmediateSync(applicationContext)
                        com.governence.faflow.attendance.sync.AttendanceSyncWorker.triggerImmediateSync(applicationContext)
                    }
                })
            } catch (e: Exception) {
                Log.w("FAFLOW_APP", "Could not register default network callback: ${e.message}")
            }
        }

        // 2. Automatic Foreground Sync & Live Notification Polling
        var activeActivityCount = 0
        registerActivityLifecycleCallbacks(object : android.app.Application.ActivityLifecycleCallbacks {
            override fun onActivityResumed(activity: android.app.Activity) {
                activeActivityCount++
                com.governence.faflow.core.notifications.LiveNotificationSyncManager.start(applicationContext)
                com.governence.faflow.core.notifications.LiveNotificationSyncManager.triggerImmediateCheck(applicationContext)

                applicationScope.launch(Dispatchers.IO) {
                    try {
                        val container = AppContainer.getInstance(applicationContext)
                        val pending = container.studentAttendanceLocalDb.getPendingCount()
                        if (pending > 0) {
                            Log.i("FAFLOW_APP", "[AutoSync] App resumed with $pending pending student records. Auto-triggering sync.")
                            com.governence.faflow.attendance.sync.StudentAttendanceSyncWorker.triggerImmediateSync(applicationContext)
                        }
                    } catch (_: Exception) {}
                }
            }
            override fun onActivityPaused(activity: android.app.Activity) {
                activeActivityCount = maxOf(0, activeActivityCount - 1)
                if (activeActivityCount == 0) {
                    com.governence.faflow.core.notifications.LiveNotificationSyncManager.stop()
                }
            }
            override fun onActivityCreated(activity: android.app.Activity, savedInstanceState: android.os.Bundle?) {}
            override fun onActivityStarted(activity: android.app.Activity) {}
            override fun onActivityStopped(activity: android.app.Activity) {}
            override fun onActivitySaveInstanceState(activity: android.app.Activity, outState: android.os.Bundle) {}
            override fun onActivityDestroyed(activity: android.app.Activity) {}
        })

        applicationScope.launch(Dispatchers.IO) {
            try {
                val container = AppContainer.getInstance(applicationContext)
                // Eagerly access tokenManager so EncryptedSharedPreferences is initialized
                // on this background thread rather than the main thread.
                container.initializeTokenManager()
                Log.i("FAFLOW_APP", "AppContainer pre-warm complete. isLoggedIn=${container.tokenManager.isLoggedIn.value}")

                // Startup reconciliation for student attendance and staff attendance outboxes
                val pendingStudent = container.studentAttendanceLocalDb.getPendingCount()
                if (pendingStudent > 0) {
                    Log.i("FAFLOW_APP", "Found $pendingStudent pending student attendance records on startup. Enqueueing sync.")
                    com.governence.faflow.attendance.sync.StudentAttendanceSyncWorker.triggerImmediateSync(applicationContext)
                }
                val pendingStaff = container.attendanceRepository.getPendingCount()
                if (pendingStaff > 0) {
                    Log.i("FAFLOW_APP", "Found $pendingStaff pending staff attendance records on startup. Enqueueing sync.")
                    com.governence.faflow.attendance.sync.AttendanceSyncWorker.triggerImmediateSync(applicationContext)
                }
            } catch (e: Exception) {
                Log.e("FAFLOW_APP", "AppContainer pre-warm failed (non-fatal): ${e.message}", e)
            }
        }
    }
}
