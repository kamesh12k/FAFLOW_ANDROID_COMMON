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
import androidx.navigation.compose.currentBackStackEntryAsState
import com.governence.faflow.auth.ui.AuthViewModel
import com.governence.faflow.core.di.AppContainer
import com.governence.faflow.ui.components.MainBottomNavigation
import com.governence.faflow.ui.screens.ApplyLeaveScreen
import com.governence.faflow.ui.screens.AttendanceCheckInOutScreen
import com.governence.faflow.ui.screens.AttendanceHistoryScreen
import com.governence.faflow.ui.screens.AttendancePlaceholderScreen
import com.governence.faflow.ui.screens.ClasswiseTimetableScreen
import com.governence.faflow.ui.screens.CreditsScreen
import com.governence.faflow.ui.screens.DashboardScreen
import com.governence.faflow.ui.screens.FaceEnrollmentScreen
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
import com.governence.faflow.ui.screens.SubstitutionScreen
import com.governence.faflow.ui.screens.SyncStatusScreen
import com.governence.faflow.ui.screens.TimetableScreen
import com.governence.faflow.ui.screens.TodayCoverageScreen
import com.governence.faflow.ui.viewmodels.AttendanceViewModel
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

    val authViewModel = remember { AuthViewModel(appContainer.authRepository) }
    val dashboardViewModel = remember {
        DashboardViewModel(
            authRepository = appContainer.authRepository,
            academicSummaryRepository = appContainer.academicSummaryRepository,
            timetableRepository = appContainer.timetableRepository,
            creditRepository = appContainer.creditRepository,
            substitutionRepository = appContainer.substitutionRepository
        )
    }
    val timetableViewModel = remember {
        TimetableViewModel(
            authRepository = appContainer.authRepository,
            timetableRepository = appContainer.timetableRepository
        )
    }
    val leaveViewModel = remember {
        LeaveViewModel(
            leaveRepository = appContainer.leaveRepository,
            academicSummaryRepository = appContainer.academicSummaryRepository
        )
    }
    val creditsViewModel = remember {
        CreditsViewModel(
            authRepository = appContainer.authRepository,
            creditRepository = appContainer.creditRepository
        )
    }
    val substitutionViewModel = remember {
        SubstitutionViewModel(
            substitutionRepository = appContainer.substitutionRepository
        )
    }
    val preferencesViewModel = remember {
        PreferencesViewModel(
            preferencesRepository = appContainer.preferencesRepository
        )
    }
    val notificationsViewModel = remember {
        NotificationsViewModel(
            notificationRepository = appContainer.notificationRepository
        )
    }
    val attendanceViewModel = remember {
        AttendanceViewModel(
            geofenceRepository = appContainer.geofenceRepository
        )
    }
    val hodViewModel = remember {
        HodViewModel(
            hodRepository = appContainer.hodRepository,
            authRepository = appContainer.authRepository,
            academicSummaryRepository = appContainer.academicSummaryRepository
        )
    }

    val storedUser = appContainer.authRepository.getStoredStaffInfo()
    val userRole = storedUser?.role ?: "teacher"
    val isHod = userRole.lowercase() == "admin" || userRole.lowercase() == "hod"

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
            composable(Screen.Splash.route) {
                SplashScreen(
                    onNavigateToLogin = {
                        navController.navigate(Screen.Login.route) {
                            popUpTo(Screen.Splash.route) { inclusive = true }
                        }
                    },
                    onNavigateToDashboard = {
                        val destination = if (isHod) Screen.HodDashboard.route else Screen.Home.route
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
                        
                        dashboardViewModel.loadDashboardData()
                        timetableViewModel.loadTimetable()
                        leaveViewModel.loadMyLeaves()
                        creditsViewModel.loadCredits()
                        substitutionViewModel.loadDuties()
                        preferencesViewModel.loadPreferences()
                        notificationsViewModel.loadNotifications()
                        if (loggedInIsHod) {
                            hodViewModel.loadDashboardData()
                        }

                        val targetDest = if (loggedInIsHod) Screen.HodDashboard.route else Screen.Home.route
                        navController.navigate(targetDest) {
                            popUpTo(Screen.Login.route) { inclusive = true }
                        }
                    }
                )
            }

            // Primary Bottom Nav Tab 1: Home (Teacher Dashboard)
            composable(Screen.Home.route) {
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
            composable(Screen.Timetable.route) {
                TimetableScreen(
                    viewModel = timetableViewModel,
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            // Primary Bottom Nav Tab 3: Attendance (Staff Attendance)
            composable(Screen.Attendance.route) {
                AttendancePlaceholderScreen(
                    viewModel = attendanceViewModel,
                    onNavigateToCheckIn = { navController.navigate(Screen.AttendanceCheckInOut.route) },
                    onNavigateToHistory = { navController.navigate(Screen.AttendanceHistory.route) }
                )
            }

            // Primary Bottom Nav Tab 4: More (Faculty Hub)
            composable(Screen.More.route) {
                MoreScreen(
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
                    onNavigateToSettings = { navController.navigate(Screen.Settings.route) }
                )
            }

            // HOD Dedicated Screens
            composable(Screen.HodDashboard.route) {
                HodDashboardScreen(
                    hodViewModel = hodViewModel,
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
                    hodViewModel = hodViewModel,
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            composable(Screen.HodCoverage.route) {
                TodayCoverageScreen(
                    hodViewModel = hodViewModel,
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            composable(Screen.HodFacultyDirectory.route) {
                HodFacultyDirectoryScreen(
                    hodViewModel = hodViewModel,
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            composable(Screen.HodAttendance.route) {
                HodAttendanceScreen(
                    hodViewModel = hodViewModel,
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            // Shared / Parity Feature Sub-Screens
            composable(Screen.ClasswiseTimetable.route) {
                ClasswiseTimetableScreen(
                    hodViewModel = hodViewModel,
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            composable(Screen.TodayCoverage.route) {
                TodayCoverageScreen(
                    hodViewModel = hodViewModel,
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            composable(Screen.ApplyLeave.route) {
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

            composable(Screen.LeaveHistory.route) {
                LeaveHistoryScreen(
                    viewModel = leaveViewModel,
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            composable(Screen.Credits.route) {
                CreditsScreen(
                    viewModel = creditsViewModel,
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            composable(Screen.Substitution.route) {
                SubstitutionScreen(
                    viewModel = substitutionViewModel,
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            composable(Screen.Preferences.route) {
                PreferencesScreen(
                    viewModel = preferencesViewModel,
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            composable(Screen.Notifications.route) {
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

            composable(Screen.AttendanceHistory.route) {
                AttendanceHistoryScreen(
                    viewModel = attendanceViewModel,
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            composable(Screen.AttendanceCheckInOut.route) {
                AttendanceCheckInOutScreen(
                    viewModel = attendanceViewModel,
                    onNavigateBack = { navController.popBackStack() },
                    onAttendanceSuccess = {
                        val homeDest = if (isHod) Screen.HodDashboard.route else Screen.Home.route
                        navController.navigate(homeDest) {
                            popUpTo(homeDest) { inclusive = true }
                        }
                    }
                )
            }

            composable(Screen.FaceEnrollment.route) {
                FaceEnrollmentScreen(
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
        }
    }
}
