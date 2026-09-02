package com.governence.faflow.ui.components

import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.navigation.NavController
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.currentBackStackEntryAsState
import com.governence.faflow.ui.navigation.BottomNavItem
import com.governence.faflow.ui.theme.FaflowRoleColors
import com.governence.faflow.ui.theme.PrimaryBlue

@Composable
fun MainBottomNavigation(
    navController: NavController,
    userRole: String? = "teacher"
) {
    val isHod = userRole?.lowercase() == "admin" || userRole?.lowercase() == "hod"

    val items = if (isHod) {
        listOf(
            BottomNavItem.HodHome,
            BottomNavItem.HodLeaves,
            BottomNavItem.HodTimetable,
            BottomNavItem.HodAttendanceTab,
            BottomNavItem.HodMore
        )
    } else {
        listOf(
            BottomNavItem.Home,
            BottomNavItem.Timetable,
            BottomNavItem.Attendance,
            BottomNavItem.More
        )
    }

    val navBackStackEntry = navController.currentBackStackEntryAsState().value
    val currentRoute = navBackStackEntry?.destination?.route

    // Only show bottom bar on top-level tabs
    val isTopLevelDestination = items.any { it.route == currentRoute }

    if (isTopLevelDestination) {
        val activeColor = if (isHod) FaflowRoleColors.HodPrimary else PrimaryBlue
        NavigationBar(
            containerColor = MaterialTheme.colorScheme.surface,
            contentColor = MaterialTheme.colorScheme.onSurface
        ) {
            items.forEach { item ->
                val selected = currentRoute == item.route
                NavigationBarItem(
                    icon = { Icon(imageVector = item.icon, contentDescription = item.title) },
                    label = { Text(text = item.title, style = MaterialTheme.typography.labelSmall) },
                    selected = selected,
                    onClick = {
                        if (currentRoute != item.route) {
                            navController.navigate(item.route) {
                                popUpTo(navController.graph.findStartDestination().id) {
                                    saveState = true
                                }
                                launchSingleTop = true
                                restoreState = true
                            }
                        }
                    },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = activeColor,
                        selectedTextColor = activeColor,
                        indicatorColor = activeColor.copy(alpha = 0.15f),
                        unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                        unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                )
            }
        }
    }
}
