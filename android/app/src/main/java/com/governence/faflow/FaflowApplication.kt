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
        applicationScope.launch(Dispatchers.IO) {
            try {
                val container = AppContainer.getInstance(applicationContext)
                // Eagerly access tokenManager so EncryptedSharedPreferences is initialized
                // on this background thread rather than the main thread.
                container.initializeTokenManager()
                Log.i("FAFLOW_APP", "AppContainer pre-warm complete. isLoggedIn=${container.tokenManager.isLoggedIn.value}")
            } catch (e: Exception) {
                Log.e("FAFLOW_APP", "AppContainer pre-warm failed (non-fatal): ${e.message}", e)
            }
        }
    }
}
