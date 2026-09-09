package com.governence.faflow.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.currentBackStackEntryAsState
import com.governence.faflow.ui.navigation.BottomNavItem
import com.governence.faflow.ui.theme.FaflowBorder
import com.governence.faflow.ui.theme.FaflowNavy
import com.governence.faflow.ui.theme.FaflowSurface
import com.governence.faflow.ui.theme.FaflowText3

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
        val activeColor = FaflowNavy

        Surface(
            color = FaflowSurface,
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .navigationBarsPadding()
            ) {
                // Hairline top border from reference UI (border-top: 1px solid var(--border))
                HorizontalDivider(
                    thickness = 1.dp,
                    color = FaflowBorder
                )

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 0.dp, bottom = 8.dp),
                    horizontalArrangement = Arrangement.SpaceAround,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    items.forEach { item ->
                        val selected = currentRoute == item.route
                        val itemColor = if (selected) activeColor else FaflowText3

                        Column(
                            modifier = Modifier
                                .weight(1f)
                                .clickable(
                                    interactionSource = remember { MutableInteractionSource() },
                                    indication = null
                                ) {
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
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            // Top indicator pill (18px x 2.5px, border-radius 2px)
                            Box(
                                modifier = Modifier
                                    .width(18.dp)
                                    .height(2.5.dp)
                                    .clip(RoundedCornerShape(2.dp))
                                    .background(if (selected) activeColor else Color.Transparent)
                            )

                            Spacer(modifier = Modifier.height(7.dp))

                            Icon(
                                imageVector = item.icon,
                                contentDescription = item.title,
                                tint = itemColor,
                                modifier = Modifier.size(20.dp)
                            )

                            Spacer(modifier = Modifier.height(4.dp))

                            Text(
                                text = item.title,
                                color = itemColor,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.SemiBold,
                                letterSpacing = (-0.01).sp
                            )
                        }
                    }
                }
            }
        }
    }
}

