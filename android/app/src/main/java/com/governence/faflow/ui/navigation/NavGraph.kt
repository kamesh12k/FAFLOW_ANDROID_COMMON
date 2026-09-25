package com.governence.faflow.ui.navigation

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
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
import com.governence.faflow.ui.screens.AnnouncementDetailScreen
import com.governence.faflow.ui.screens.AnnouncementsScreen
import com.governence.faflow.ui.screens.ApplyLeaveScreen
import com.governence.faflow.ui.screens.AttendanceCheckInOutScreen
import com.governence.faflow.ui.screens.FirstLoginSetupScreen
import com.governence.faflow.ui.screens.AttendanceHistoryScreen
import com.governence.faflow.ui.viewmodels.AttendanceViewModel
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
    modifier: Modifier = Modifier,
    deepLinkRoute: String? = null
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

    val currentUserId = (authState as? AuthUiState.Authenticated)?.staff?.id ?: -1

    // Lazy HodViewModel provider: keyed to currentUserId so switching users discards stale state.
    // This prevents firing 5 parallel HTTP requests during splash/teacher startup.
    val getHodViewModel = remember(currentUserId) {
        var vm: HodViewModel? = null
        {
            vm ?: HodViewModel(
                hodRepository = appContainer.hodRepository,
                authRepository = appContainer.authRepository,
                academicSummaryRepository = appContainer.academicSummaryRepository
            ).also { vm = it }
        }
    }

    // P1 FIX: Create ONE shared AttendanceViewModel at NavGraph level, keyed to currentUserId.
    // Recreated fresh whenever user logs in, logs out, or switches accounts.
    val attendanceViewModel = remember(currentUserId) {
        AttendanceViewModel(
            geofenceRepository = appContainer.geofenceRepository,
            attendanceRepository = appContainer.attendanceRepository,
            recognitionEngine = appContainer.faceRecognitionEngine,
            integrityVerifier = appContainer.deviceIntegrityVerifier,
            appContext = context.applicationContext
        )
    }

    val studentAttendanceViewModel = remember(currentUserId) {
        com.governence.faflow.attendance.student.ui.StudentAttendanceViewModel(
            repository = appContainer.studentAttendanceRepository
        )
    }

    var showTourReplay by remember { androidx.compose.runtime.mutableStateOf(false) }
    var userAcceptedPolicyLocally by remember { androidx.compose.runtime.mutableStateOf<Boolean?>(null) }
    var userCompletedTourLocally by remember { androidx.compose.runtime.mutableStateOf<Boolean?>(null) }

    // Track whether we've delivered the notification deep-link to avoid double-firing
    var deepLinkConsumed by remember { androidx.compose.runtime.mutableStateOf(false) }

    val isLoggedIn by appContainer.tokenManager.isLoggedIn.collectAsState()
    androidx.compose.runtime.LaunchedEffect(isLoggedIn) {
        if (!isLoggedIn) {
            attendanceViewModel.resetSession()
            studentAttendanceViewModel.resetSession()
            val currentRoute = navController.currentBackStackEntry?.destination?.route
            if (currentRoute != null && currentRoute != Screen.Splash.route && currentRoute != Screen.Login.route) {
                navController.navigate(Screen.Login.route) {
                    popUpTo(0) { inclusive = true }
                }
            }
        }
    }

    val currentStaff = (authState as? AuthUiState.Authenticated)?.staff
    val needsPolicyConsent = currentStaff != null && (userAcceptedPolicyLocally == false || (userAcceptedPolicyLocally == null && currentStaff.policyVersionAccepted.isNullOrBlank()))
    val needsTour = currentStaff != null && !needsPolicyConsent && (userCompletedTourLocally == false || (userCompletedTourLocally == null && !currentStaff.onboardingCompleted))

    com.governence.faflow.ui.components.PolicyConsentDialog(
        isOpen = needsPolicyConsent,
        authRepository = appContainer.authRepository,
        onConsentAccepted = { updatedStaff ->
            userAcceptedPolicyLocally = true
            authViewModel.updateStaff(updatedStaff)
        }
    )

    com.governence.faflow.ui.components.OnboardingTourDialog(
        isOpen = showTourReplay || needsTour,
        userRole = userRole,
        authRepository = appContainer.authRepository,
        onTourFinished = {
            showTourReplay = false
            userCompletedTourLocally = true
            currentStaff?.let {
                authViewModel.updateStaff(it.copy(onboardingCompleted = true))
            }
        }
    )

    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = com.governence.faflow.ui.theme.FaflowBg,
        contentWindowInsets = androidx.compose.foundation.layout.WindowInsets(0, 0, 0, 0),
        bottomBar = {
            MainBottomNavigation(navController = navController, userRole = userRole)
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Screen.Splash.route,
            modifier = Modifier.padding(bottom = innerPadding.calculateBottomPadding())
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
                        val currentStaff = (authViewModel.uiState.value as? AuthUiState.Authenticated)?.staff
                        if (currentStaff?.mustChangeCredentials == true) {
                            navController.navigate(Screen.FirstLoginSetup.route) {
                                popUpTo(Screen.Splash.route) { inclusive = true }
                            }
                        } else {
                            val settledRole = currentStaff?.role ?: "teacher"
                            val settledIsHod = settledRole.lowercase() == "admin" || settledRole.lowercase() == "hod"
                            val destination = if (settledIsHod) Screen.HodDashboard.route else Screen.Home.route
                            navController.navigate(destination) {
                                popUpTo(Screen.Splash.route) { inclusive = true }
                            }
                        }
                    }
                )
            }

            composable(Screen.Login.route) {
                LoginScreen(
                    authViewModel = authViewModel,
                    onLoginSuccess = {
                        val storedStaff = appContainer.authRepository.getStoredStaffInfo()
                        if (storedStaff?.mustChangeCredentials == true) {
                            navController.navigate(Screen.FirstLoginSetup.route) {
                                popUpTo(Screen.Login.route) { inclusive = true }
                            }
                        } else {
                            val loggedInRole = storedStaff?.role ?: "teacher"
                            val loggedInIsHod = loggedInRole.lowercase() == "admin" || loggedInRole.lowercase() == "hod"
                            val targetDest = if (loggedInIsHod) Screen.HodDashboard.route else Screen.Home.route
                            navController.navigate(targetDest) {
                                popUpTo(Screen.Login.route) { inclusive = true }
                            }
                        }
                    }
                )
            }

            composable(Screen.FirstLoginSetup.route) {
                FirstLoginSetupScreen(
                    authViewModel = authViewModel,
                    onSetupSuccess = {
                        val loggedInRole = appContainer.authRepository.getStoredStaffInfo()?.role ?: "teacher"
                        val loggedInIsHod = loggedInRole.lowercase() == "admin" || loggedInRole.lowercase() == "hod"
                        val targetDest = if (loggedInIsHod) Screen.HodDashboard.route else Screen.Home.route
                        navController.navigate(targetDest) {
                            popUpTo(Screen.FirstLoginSetup.route) { inclusive = true }
                        }
                    }
                )
            }

            // Primary Bottom Nav Tab 1: Home (Teacher Dashboard)
            composable(Screen.Home.route) { backStackEntry ->
                // Consume any pending notification deep-link now that we are on a stable
                // authenticated screen. This avoids the route being swallowed during splash.
                androidx.compose.runtime.LaunchedEffect(deepLinkRoute, deepLinkConsumed) {
                    if (!deepLinkRoute.isNullOrBlank() && !deepLinkConsumed) {
                        deepLinkConsumed = true
                        try { navController.navigate(deepLinkRoute) } catch (_: Exception) {}
                    }
                }
                val dashboardViewModel = remember(backStackEntry) {
                    DashboardViewModel(
                        authRepository = appContainer.authRepository,
                        academicSummaryRepository = appContainer.academicSummaryRepository,
                        timetableRepository = appContainer.timetableRepository,
                        creditRepository = appContainer.creditRepository,
                        substitutionRepository = appContainer.substitutionRepository,
                        attendanceRepository = appContainer.attendanceRepository,
                        studentAttendanceRepository = appContainer.studentAttendanceRepository,
                        campusDutyRepository = appContainer.campusDutyRepository,
                        announcementRepository = appContainer.announcementRepository
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
                    onNavigateToProfile = { navController.navigate(Screen.Profile.route) },
                    onNavigateToCampusDuties = { navController.navigate(Screen.MyDuties.route) },
                    onNavigateToAnnouncements = { navController.navigate(Screen.Announcements.route) },
                    onNavigateToStudentAttendance = { periodNumber, classId ->
                        navController.navigate(Screen.StudentAttendance.createRoute(periodNumber, classId))
                    }
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
                    onNavigateToLeaveApprovals = { navController.navigate(Screen.HodLeaveApprovals.route) },
                    onNavigateToLiveAttendance = { navController.navigate(Screen.HodAttendance.route) },
                    onNavigateToFacultyDirectory = { navController.navigate(Screen.HodFacultyDirectory.route) },
                    onNavigateToStudentAttendance = { navController.navigate(Screen.StudentAttendance.route) },
                    onNavigateToAnnouncements = { navController.navigate(Screen.Announcements.route) },
                    onNavigateToCampusDuties = { navController.navigate(Screen.MyDuties.route) },
                    onNavigateToCampusStructure = { navController.navigate(Screen.CampusStructure.route) },
                    onNavigateToSettings = { navController.navigate(Screen.Settings.route) },
                    onNavigateToSyncStatus = { navController.navigate(Screen.SyncStatus.route) },
                    onReplayTour = { showTourReplay = true }
                )
            }

            // HOD Dedicated Screens — all use the single shared hodViewModel on-demand.
            composable(Screen.HodDashboard.route) {
                // Consume pending notification deep-link on HOD's first authenticated screen too
                androidx.compose.runtime.LaunchedEffect(deepLinkRoute, deepLinkConsumed) {
                    if (!deepLinkRoute.isNullOrBlank() && !deepLinkConsumed) {
                        deepLinkConsumed = true
                        try { navController.navigate(deepLinkRoute) } catch (_: Exception) {}
                    }
                }
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
                        academicSummaryRepository = appContainer.academicSummaryRepository,
                        timetableRepository = appContainer.timetableRepository,
                        authRepository = appContainer.authRepository
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
                        academicSummaryRepository = appContainer.academicSummaryRepository,
                        timetableRepository = appContainer.timetableRepository,
                        authRepository = appContainer.authRepository
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
                    onNavigateBack = { navController.popBackStack() },
                    onNavigateToStudentAttendance = { periodNumber, classId ->
                        navController.navigate(Screen.StudentAttendance.createRoute(periodNumber, classId))
                    }
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
                    onNavigateBack = { navController.popBackStack() },
                    onNavigateToSubstitution = { navController.navigate(Screen.Substitution.route) },
                    onNavigateToLeaveHistory = { navController.navigate(Screen.LeaveHistory.route) },
                    onNavigateToAttendance = { navController.navigate(Screen.AttendanceCheckInOut.route) }
                )
            }

            composable(Screen.Profile.route) {
                ProfileScreen(
                    authViewModel = authViewModel,
                    onNavigateBack = { navController.popBackStack() },
                    onNavigateToFaceEnrollment = { navController.navigate(Screen.FaceEnrollment.route) },
                    onLogout = {
                        attendanceViewModel.resetSession()
                        studentAttendanceViewModel.resetSession()
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

            composable(Screen.Announcements.route) { backStackEntry ->
                val announcementsViewModel = remember(backStackEntry) {
                    com.governence.faflow.ui.viewmodels.AnnouncementsViewModel(appContainer.announcementRepository)
                }
                AnnouncementsScreen(
                    viewModel = announcementsViewModel,
                    onNavigateBack = { navController.popBackStack() },
                    onNavigateToDetail = { id ->
                        navController.navigate(Screen.AnnouncementDetail.createRoute(id))
                    }
                )
            }

            composable(
                route = Screen.AnnouncementDetail.route,
                arguments = listOf(
                    androidx.navigation.navArgument("announcementId") {
                        type = androidx.navigation.NavType.IntType
                    }
                )
            ) { backStackEntry ->
                val announcementId = backStackEntry.arguments?.getInt("announcementId") ?: -1
                val announcementsViewModel = remember(backStackEntry) {
                    com.governence.faflow.ui.viewmodels.AnnouncementsViewModel(appContainer.announcementRepository)
                }
                AnnouncementDetailScreen(
                    announcementId = announcementId,
                    viewModel = announcementsViewModel,
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            composable(Screen.SyncStatus.route) {
                SyncStatusScreen(
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            composable(
                route = Screen.StudentAttendance.route,
                arguments = listOf(
                    androidx.navigation.navArgument("period") {
                        type = androidx.navigation.NavType.IntType
                        defaultValue = -1
                    },
                    androidx.navigation.navArgument("classId") {
                        type = androidx.navigation.NavType.IntType
                        defaultValue = -1
                    }
                )
            ) { backStackEntry ->
                val targetPeriod = backStackEntry.arguments?.getInt("period")?.takeIf { it != -1 }
                val targetClassId = backStackEntry.arguments?.getInt("classId")?.takeIf { it != -1 }

                androidx.compose.runtime.LaunchedEffect(targetPeriod, targetClassId) {
                    if (targetPeriod != null || targetClassId != null) {
                        studentAttendanceViewModel.preselectPeriod(targetPeriod, targetClassId)
                    }
                }

                com.governence.faflow.ui.screens.StudentAttendanceScreen(
                    viewModel = studentAttendanceViewModel,
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            composable(Screen.MyDuties.route) { backStackEntry ->
                val dutyViewModel = remember(backStackEntry) {
                    com.governence.faflow.ui.viewmodels.DutyViewModel(appContainer.campusDutyRepository)
                }
                com.governence.faflow.ui.screens.MyDutiesScreen(
                    viewModel = dutyViewModel,
                    onNavigateBack = { navController.popBackStack() },
                    onDutyClick = { dutyId ->
                        navController.navigate(Screen.DutyDetail.createRoute(dutyId))
                    }
                )
            }

            composable(
                route = Screen.DutyDetail.route,
                arguments = listOf(
                    androidx.navigation.navArgument("dutyId") {
                        type = androidx.navigation.NavType.IntType
                    }
                )
            ) { backStackEntry ->
                val dutyId = backStackEntry.arguments?.getInt("dutyId") ?: 0
                val dutyViewModel = remember(backStackEntry) {
                    com.governence.faflow.ui.viewmodels.DutyViewModel(appContainer.campusDutyRepository)
                }
                com.governence.faflow.ui.screens.DutyDetailScreen(
                    dutyId = dutyId,
                    viewModel = dutyViewModel,
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            composable(Screen.CampusStructure.route) { backStackEntry ->
                val structureViewModel = remember(backStackEntry) {
                    com.governence.faflow.ui.viewmodels.CampusStructureViewModel(appContainer.campusStructureRepository)
                }
                com.governence.faflow.ui.screens.CampusStructureScreen(
                    viewModel = structureViewModel,
                    onNavigateBack = { navController.popBackStack() }
                )
            }
        }
    }
}
