package com.governence.faflow

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.navigation.compose.rememberNavController
import com.governence.faflow.attendance.sync.NotificationSyncWorker
import com.governence.faflow.core.notifications.FaflowNotificationManager
import com.governence.faflow.ui.navigation.NavGraph
import com.governence.faflow.ui.theme.FAFLOWTheme

class MainActivity : ComponentActivity() {

    private val requestNotificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            NotificationSyncWorker.triggerImmediateSync(this)
        }
    }

    private val pendingRoute = kotlinx.coroutines.flow.MutableStateFlow<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.isNavigationBarContrastEnforced = false
        }

        // Initialize Android system notification channels
        FaflowNotificationManager.initChannels(this)

        // Request POST_NOTIFICATIONS runtime permission on Android 13+ (API 33+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestNotificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }

        // Schedule periodic notification polling worker & trigger immediate sync
        NotificationSyncWorker.schedulePeriodicSync(this)
        NotificationSyncWorker.triggerImmediateSync(this)

        // Schedule durable attendance sync workers (safety net) and trigger immediate sync
        com.governence.faflow.attendance.sync.AttendanceSyncWorker.schedulePeriodicSync(this)
        com.governence.faflow.attendance.sync.StudentAttendanceSyncWorker.schedulePeriodicSync(this)
        com.governence.faflow.attendance.sync.AttendanceSyncWorker.triggerImmediateSync(this)
        com.governence.faflow.attendance.sync.StudentAttendanceSyncWorker.triggerImmediateSync(this)

        // Capture initial notification deep link route
        intent?.getStringExtra("EXTRA_ROUTE")?.let { route ->
            pendingRoute.value = route
        }

        setContent {
            FAFLOWTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = com.governence.faflow.ui.theme.FaflowBg
                ) {
                    val navController = rememberNavController()
                    val deepLinkRoute by pendingRoute.collectAsState()

                    NavGraph(
                        navController = navController,
                        deepLinkRoute = deepLinkRoute.also {
                            // Clear after passing so it doesn't re-fire on recomposition
                            if (!it.isNullOrBlank()) {
                                androidx.compose.runtime.LaunchedEffect(it) {
                                    pendingRoute.value = null
                                }
                            }
                        }
                    )
                }
            }
        }
    }

    override fun onNewIntent(intent: android.content.Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        intent.getStringExtra("EXTRA_ROUTE")?.let { route ->
            pendingRoute.value = route
        }
    }
}