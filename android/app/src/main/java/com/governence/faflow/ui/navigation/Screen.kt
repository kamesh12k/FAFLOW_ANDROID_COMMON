package com.governence.faflow.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.ui.graphics.vector.ImageVector

/**
 * Type-safe navigation routes for FAFLOW Staff Mobile application.
 */
sealed class Screen(val route: String) {
    data object Splash : Screen("splash")
    data object Login : Screen("login")
    
    // Bottom Bar Primary Tabs
    data object Home : Screen("home")
    data object Timetable : Screen("timetable")
    data object Attendance : Screen("attendance")
    data object More : Screen("more")
    
    // Secondary & Feature Screens
    data object AttendanceHistory : Screen("attendance_history")
    data object AttendanceCheckInOut : Screen("attendance_check_in_out")
    data object ApplyLeave : Screen("apply_leave")
    data object LeaveHistory : Screen("leave_history")
    data object Credits : Screen("credits")
    data object Substitution : Screen("substitution")
    data object Preferences : Screen("preferences")
    data object Notifications : Screen("notifications")
    data object Profile : Screen("profile")
    data object Settings : Screen("settings")
    data object SyncStatus : Screen("sync_status")
    data object FaceEnrollment : Screen("face_enrollment")
    data object GeofenceAdmin : Screen("geofence_admin")
    data object SupervisorLiveStatus : Screen("supervisor_live_status")
}

sealed class BottomNavItem(
    val route: String,
    val title: String,
    val icon: ImageVector
) {
    data object Home : BottomNavItem(Screen.Home.route, "Home", Icons.Default.Home)
    data object Timetable : BottomNavItem(Screen.Timetable.route, "Timetable", Icons.Default.CalendarMonth)
    data object Attendance : BottomNavItem(Screen.Attendance.route, "Attendance", Icons.Default.Fingerprint)
    data object More : BottomNavItem(Screen.More.route, "More", Icons.Default.MoreHoriz)
}
