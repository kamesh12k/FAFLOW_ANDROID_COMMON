package com.governence.faflow.ui.navigation

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.governence.faflow.auth.ui.AuthUiState
import com.governence.faflow.auth.ui.AuthViewModel
import com.governence.faflow.core.di.AppContainer
import com.governence.faflow.ui.components.MainBottomNavigation
import com.governence.faflow.ui.screens.ApplyLeaveScreen
import com.governence.faflow.ui.screens.AttendanceCheckInOutScreen
import com.governence.faflow.ui.screens.AttendanceHistoryScreen
import com.governence.faflow.ui.viewmodels.AttendanceViewModel
import com.governence.faflow.ui.screens.ClasswiseTimetableScreen
import com.governence.faflow.ui.screens.CreditsScreen
import com.governence.faflow.ui.screens.DashboardScreen
import com.governence.faflow.ui.screens.FaceEnrollmentScreen
import com.governence.faflow.ui.screens.GeofenceAdminScreen
import com.governence.faflow.ui.viewmodels.GeofenceAdminViewModel
import com.governence.faflow.ui.screens.HodAttendanceScreen
import com.governence.faflow.ui.screens.HodDashboardScreen
import com.governence.faflow.ui.screens.HodFacultyDirectoryScreen
import com.governence.faflow.ui.screens.HodLeaveApprovalScreen
import com.governence.faflow.ui.screens.LeaveHistoryScreen
import com.governence.faflow.ui.screens.LoginScreen
import com.governence.faflow.ui.screens.MoreScreen
import com.governence.faflow.ui.screens.NotificationsScreen
import com.governence.faflow.ui.screens.PreferencesScreen
import com.governence.faflow.ui.screens.ProfileScreen
import com.governence.faflow.ui.screens.SettingsScreen
import com.governence.faflow.ui.screens.SplashScreen
import com.governence.faflow.ui.screens.StaffAttendanceScreen
import com.governence.faflow.ui.screens.SubstitutionScreen
import com.governence.faflow.ui.screens.SyncStatusScreen
import com.governence.faflow.ui.screens.TimetableScreen
import com.governence.faflow.ui.screens.TodayCoverageScreen
import com.governence.faflow.ui.viewmodels.CreditsViewModel
import com.governence.faflow.ui.viewmodels.DashboardViewModel
import com.governence.faflow.ui.viewmodels.HodViewModel
import com.governence.faflow.ui.viewmodels.LeaveViewModel
import com.governence.faflow.ui.viewmodels.NotificationsViewModel
import com.governence.faflow.ui.viewmodels.PreferencesViewModel
import com.governence.faflow.ui.viewmodels.SubstitutionViewModel
import com.governence.faflow.ui.viewmodels.TimetableViewModel

@Composable
fun NavGraph(
    navController: NavHostController,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val appContainer = remember { AppContainer.getInstance(context) }

    // Root-level ViewModel for session lifecycle and authentication
    val authViewModel = remember { AuthViewModel(appContainer.authRepository) }

    // P0 FIX: Do NOT call authRepository.getStoredStaffInfo() directly in the composable
    // body — that triggers EncryptedSharedPreferences initialization on the main thread.
    // Instead, derive role from the AuthViewModel's StateFlow which is already populated
    // asynchronously (or pre-warmed by FaflowApplication on a background thread).
    val authState by authViewModel.uiState.collectAsState()
    val userRole = (authState as? AuthUiState.Authenticated)?.staff?.role ?: "teacher"
    val isHod = userRole.lowercase() == "admin" || userRole.lowercase() == "hod"

    // Lazy HodViewModel provider: only instantiated on-demand when an HOD screen or timetable/coverage is visited.
    // This prevents firing 5 parallel HTTP requests during splash/teacher startup.
    val getHodViewModel = remember {
        var vm: HodViewModel? = null
        {
            vm ?: HodViewModel(
                hodRepository = appContainer.hodRepository,
                authRepository = appContainer.authRepository,
                academicSummaryRepository = appContainer.academicSummaryRepository
            ).also { vm = it }
        }
    }

    // P1 FIX: Create ONE shared AttendanceViewModel at NavGraph level.
    // Previously, 3 attendance destinations each created their own instance.
    val attendanceViewModel = remember {
        AttendanceViewModel(
            geofenceRepository = appContainer.geofenceRepository,
            attendanceRepository = appContainer.attendanceRepository,
            recognitionEngine = appContainer.faceRecognitionEngine,
            integrityVerifier = appContainer.deviceIntegrityVerifier,
            appContext = context.applicationContext
        )
    }

    Scaffold(
        modifier = modifier.fillMaxSize(),
        bottomBar = {
            MainBottomNavigation(navController = navController, userRole = userRole)
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Screen.Splash.route,
            modifier = Modifier.padding(innerPadding)
        ) {
            // Auth & Splash
            // P0 FIX: Do NOT call getStoredStaffInfo() inside the composable body.
            // Use tokenManager.isLoggedIn StateFlow which was pre-warmed on the background thread
            // by FaflowApplication before this composable ever renders.
            composable(Screen.Splash.route) {
                val isLoggedIn by appContainer.tokenManager.isLoggedIn.collectAsState()
                SplashScreen(
                    isLoggedIn = isLoggedIn,
                    onNavigateToLogin = {
                        navController.navigate(Screen.Login.route) {
                            popUpTo(Screen.Splash.route) { inclusive = true }
                        }
                    },
                    onNavigateToDashboard = {
                        // Derive role from settled authState to ensure HOD users go to HodDashboard.
                        val settledRole = (authViewModel.uiState.value as? AuthUiState.Authenticated)?.staff?.role ?: "teacher"
                        val settledIsHod = settledRole.lowercase() == "admin" || settledRole.lowercase() == "hod"
                        val destination = if (settledIsHod) Screen.HodDashboard.route else Screen.Home.route
                        navController.navigate(destination) {
                            popUpTo(Screen.Splash.route) { inclusive = true }
                        }
                    }
                )
            }

            composable(Screen.Login.route) {
                LoginScreen(
                    authViewModel = authViewModel,
                    onLoginSuccess = {
                        val loggedInRole = appContainer.authRepository.getStoredStaffInfo()?.role ?: "teacher"
                        val loggedInIsHod = loggedInRole.lowercase() == "admin" || loggedInRole.lowercase() == "hod"
                        val targetDest = if (loggedInIsHod) Screen.HodDashboard.route else Screen.Home.route
                        navController.navigate(targetDest) {
                            popUpTo(Screen.Login.route) { inclusive = true }
                        }
                    }
                )
            }

            // Primary Bottom Nav Tab 1: Home (Teacher Dashboard)
            composable(Screen.Home.route) { backStackEntry ->
                val dashboardViewModel = remember(backStackEntry) {
                    DashboardViewModel(
                        authRepository = appContainer.authRepository,
                        academicSummaryRepository = appContainer.academicSummaryRepository,
                        timetableRepository = appContainer.timetableRepository,
                        creditRepository = appContainer.creditRepository,
                        substitutionRepository = appContainer.substitutionRepository
                    )
                }
                DashboardScreen(
                    viewModel = dashboardViewModel,
                    onNavigateToCheckIn = { navController.navigate(Screen.AttendanceCheckInOut.route) },
                    onNavigateToTimetable = { navController.navigate(Screen.Timetable.route) },
                    onNavigateToClassTimetable = { navController.navigate(Screen.ClasswiseTimetable.route) },
                    onNavigateToTodayCoverage = { navController.navigate(Screen.TodayCoverage.route) },
                    onNavigateToApplyLeave = { navController.navigate(Screen.ApplyLeave.route) },
                    onNavigateToLeaveHistory = { navController.navigate(Screen.LeaveHistory.route) },
                    onNavigateToCredits = { navController.navigate(Screen.Credits.route) },
                    onNavigateToSubstitution = { navController.navigate(Screen.Substitution.route) },
                    onNavigateToAttendanceHistory = { navController.navigate(Screen.AttendanceHistory.route) },
                    onNavigateToNotifications = { navController.navigate(Screen.Notifications.route) },
                    onNavigateToProfile = { navController.navigate(Screen.Profile.route) }
                )
            }

            // Primary Bottom Nav Tab 2: Timetable (Teacher Timetable)
            composable(Screen.Timetable.route) { backStackEntry ->
                val timetableViewModel = remember(backStackEntry) {
                    TimetableViewModel(
                        authRepository = appContainer.authRepository,
                        timetableRepository = appContainer.timetableRepository
                    )
                }
                TimetableScreen(
                    viewModel = timetableViewModel,
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            // Primary Bottom Nav Tab 3: Attendance (Staff Attendance)
            // Uses the shared attendanceViewModel created at NavGraph level.
            composable(Screen.Attendance.route) {
                StaffAttendanceScreen(
                    viewModel = attendanceViewModel,
                    onNavigateToCheckIn = { navController.navigate(Screen.AttendanceCheckInOut.route) },
                    onNavigateToHistory = { navController.navigate(Screen.AttendanceHistory.route) }
                )
            }

            // Primary Bottom Nav Tab 4: More (Faculty Hub)
            composable(Screen.More.route) {
                MoreScreen(
                    userRole = userRole,
                    onNavigateToApplyLeave = { navController.navigate(Screen.ApplyLeave.route) },
                    onNavigateToLeaveHistory = { navController.navigate(Screen.LeaveHistory.route) },
                    onNavigateToCredits = { navController.navigate(Screen.Credits.route) },
                    onNavigateToSubstitution = { navController.navigate(Screen.Substitution.route) },
                    onNavigateToClassTimetable = { navController.navigate(Screen.ClasswiseTimetable.route) },
                    onNavigateToTodayCoverage = { navController.navigate(Screen.TodayCoverage.route) },
                    onNavigateToFaceEnrollment = { navController.navigate(Screen.FaceEnrollment.route) },
                    onNavigateToPreferences = { navController.navigate(Screen.Preferences.route) },
                    onNavigateToNotifications = { navController.navigate(Screen.Notifications.route) },
                    onNavigateToProfile = { navController.navigate(Screen.Profile.route) },
                    onNavigateToGeofences = { navController.navigate(Screen.GeofenceAdmin.route) },
                    onNavigateToLeaveApprovals = { navController.navigate(Screen.HodLeaveApprovals.route) },
                    onNavigateToLiveAttendance = { navController.navigate(Screen.HodAttendance.route) },
                    onNavigateToFacultyDirectory = { navController.navigate(Screen.HodFacultyDirectory.route) }
                )
            }

            // HOD Dedicated Screens — all use the single shared hodViewModel on-demand.
            composable(Screen.HodDashboard.route) {
                HodDashboardScreen(
                    hodViewModel = getHodViewModel(),
                    onNavigateToLeaveApprovals = { navController.navigate(Screen.HodLeaveApprovals.route) },
                    onNavigateToCoverage = { navController.navigate(Screen.HodCoverage.route) },
                    onNavigateToDepartmentTimetable = { navController.navigate(Screen.ClasswiseTimetable.route) },
                    onNavigateToFacultyDirectory = { navController.navigate(Screen.HodFacultyDirectory.route) },
                    onNavigateToLiveAttendance = { navController.navigate(Screen.HodAttendance.route) },
                    onNavigateToNotifications = { navController.navigate(Screen.Notifications.route) }
                )
            }

            composable(Screen.HodLeaveApprovals.route) {
                HodLeaveApprovalScreen(
                    hodViewModel = getHodViewModel(),
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            composable(Screen.HodCoverage.route) {
                TodayCoverageScreen(
                    hodViewModel = getHodViewModel(),
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            composable(Screen.HodFacultyDirectory.route) {
                HodFacultyDirectoryScreen(
                    hodViewModel = getHodViewModel(),
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            composable(Screen.HodAttendance.route) {
                HodAttendanceScreen(
                    hodViewModel = getHodViewModel(),
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            // Shared / Parity Feature Sub-Screens
            composable(Screen.ClasswiseTimetable.route) {
                ClasswiseTimetableScreen(
                    hodViewModel = getHodViewModel(),
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            composable(Screen.TodayCoverage.route) {
                TodayCoverageScreen(
                    hodViewModel = getHodViewModel(),
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            composable(Screen.ApplyLeave.route) { backStackEntry ->
                val leaveViewModel = remember(backStackEntry) {
                    LeaveViewModel(
                        leaveRepository = appContainer.leaveRepository,
                        academicSummaryRepository = appContainer.academicSummaryRepository
                    )
                }
                ApplyLeaveScreen(
                    viewModel = leaveViewModel,
                    onNavigateBack = { navController.popBackStack() },
                    onLeaveSubmitted = {
                        navController.navigate(Screen.LeaveHistory.route) {
                            popUpTo(if (isHod) Screen.HodDashboard.route else Screen.Home.route)
                        }
                    }
                )
            }

            composable(Screen.LeaveHistory.route) { backStackEntry ->
                val leaveViewModel = remember(backStackEntry) {
                    LeaveViewModel(
                        leaveRepository = appContainer.leaveRepository,
                        academicSummaryRepository = appContainer.academicSummaryRepository
                    )
                }
                LeaveHistoryScreen(
                    viewModel = leaveViewModel,
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            composable(Screen.Credits.route) { backStackEntry ->
                val creditsViewModel = remember(backStackEntry) {
                    CreditsViewModel(
                        authRepository = appContainer.authRepository,
                        creditRepository = appContainer.creditRepository
                    )
                }
                CreditsScreen(
                    viewModel = creditsViewModel,
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            composable(Screen.Substitution.route) { backStackEntry ->
                val substitutionViewModel = remember(backStackEntry) {
                    SubstitutionViewModel(
                        substitutionRepository = appContainer.substitutionRepository
                    )
                }
                SubstitutionScreen(
                    viewModel = substitutionViewModel,
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            composable(Screen.Preferences.route) { backStackEntry ->
                val preferencesViewModel = remember(backStackEntry) {
                    PreferencesViewModel(
                        preferencesRepository = appContainer.preferencesRepository
                    )
                }
                PreferencesScreen(
                    viewModel = preferencesViewModel,
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            composable(Screen.Notifications.route) { backStackEntry ->
                val notificationsViewModel = remember(backStackEntry) {
                    NotificationsViewModel(
                        notificationRepository = appContainer.notificationRepository
                    )
                }
                NotificationsScreen(
                    viewModel = notificationsViewModel,
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            composable(Screen.Profile.route) {
                ProfileScreen(
                    authViewModel = authViewModel,
                    onNavigateBack = { navController.popBackStack() },
                    onNavigateToFaceEnrollment = { navController.navigate(Screen.FaceEnrollment.route) },
                    onLogout = {
                        navController.navigate(Screen.Login.route) {
                            popUpTo(0) { inclusive = true }
                        }
                    }
                )
            }

            // Attendance History — uses shared attendanceViewModel
            composable(Screen.AttendanceHistory.route) {
                AttendanceHistoryScreen(
                    viewModel = attendanceViewModel,
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            // Attendance Check In/Out — uses shared attendanceViewModel.
            // Staff identity is derived inside the ViewModel from the authenticated session token.
            composable(Screen.AttendanceCheckInOut.route) {
                AttendanceCheckInOutScreen(
                    viewModel = attendanceViewModel,
                    onNavigateBack = { navController.popBackStack() },
                    onAttendanceSuccess = {
                        attendanceViewModel.loadTodaySummary()
                        val popped = navController.popBackStack(Screen.Attendance.route, inclusive = false)
                        if (!popped) {
                            navController.navigate(Screen.Attendance.route) {
                                val homeDest = if (isHod) Screen.HodDashboard.route else Screen.Home.route
                                popUpTo(homeDest) { inclusive = false }
                            }
                        }
                    },
                    onNavigateToFaceEnrollment = {
                        navController.navigate(Screen.FaceEnrollment.route)
                    },
                    userRole = userRole
                )
            }

            composable(Screen.FaceEnrollment.route) {
                val currentStaff = (authState as? AuthUiState.Authenticated)?.staff
                FaceEnrollmentScreen(
                    staffId = currentStaff?.id?.toString() ?: "",
                    staffName = currentStaff?.name ?: "Faculty Member",
                    onNavigateBack = { navController.popBackStack() },
                    onEnrollmentComplete = {
                        val homeDest = if (isHod) Screen.HodDashboard.route else Screen.Home.route
                        navController.navigate(homeDest) {
                            popUpTo(homeDest) { inclusive = true }
                        }
                    }
                )
            }

            composable(Screen.Settings.route) {
                SettingsScreen(
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            composable(Screen.SyncStatus.route) {
                SyncStatusScreen(
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            composable(Screen.GeofenceAdmin.route) { backStackEntry ->
                val geofenceViewModel = remember(backStackEntry) {
                    GeofenceAdminViewModel(
                        apiService = appContainer.apiService
                    )
                }
                GeofenceAdminScreen(
                    viewModel = geofenceViewModel,
                    onNavigateBack = { navController.popBackStack() }
                )
            }
        }
    }
}
