package com.governence.faflow.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.governence.faflow.ui.theme.FAFLOWTheme
import com.governence.faflow.ui.theme.FaflowBg
import com.governence.faflow.ui.theme.FaflowNavy
import com.governence.faflow.ui.theme.FaflowNavyTint
import com.governence.faflow.ui.theme.FaflowSpacing
import com.governence.faflow.ui.theme.FaflowText1
import com.governence.faflow.ui.theme.FaflowText2
import com.governence.faflow.ui.theme.StatusSuccess
import com.governence.faflow.ui.theme.StatusSuccessBg

/**
 * Institutional Component Gallery and @Preview set for FAFLOW Android Client.
 * Demonstrates WCAG 2.2 AA compliant light-professional themes and single-sourced tokens.
 */

@Preview(name = "Buttons Gallery", showBackground = true, widthDp = 380)
@Composable
fun PreviewButtons() {
    FAFLOWTheme {
        Column(
            modifier = Modifier
                .background(FaflowBg)
                .padding(FaflowSpacing.lg),
            verticalArrangement = Arrangement.spacedBy(FaflowSpacing.md)
        ) {
            Text("Button Hierarchy", color = FaflowText1, fontSize = 16.sp)
            PrimaryGradientButton(
                text = "Primary Gradient (Navy)",
                onClick = {},
                icon = Icons.Default.Fingerprint
            )
            PrimaryGradientButton(
                text = "Loading Action",
                onClick = {},
                isLoading = true
            )
            PrimaryGradientButton(
                text = "Disabled State",
                onClick = {},
                enabled = false
            )
            Row(horizontalArrangement = Arrangement.spacedBy(FaflowSpacing.sm)) {
                FaflowPillButton(
                    text = "Pill Primary",
                    onClick = {},
                    isPrimary = true
                )
                FaflowPillButton(
                    text = "Pill Secondary",
                    onClick = {},
                    isPrimary = false
                )
            }
        }
    }
}

@Preview(name = "Badges & Chips", showBackground = true, widthDp = 380)
@Composable
fun PreviewBadges() {
    FAFLOWTheme {
        Column(
            modifier = Modifier
                .background(FaflowBg)
                .padding(FaflowSpacing.lg),
            verticalArrangement = Arrangement.spacedBy(FaflowSpacing.md)
        ) {
            Text("Role Badges (WCAG AA)", color = FaflowText1, fontSize = 14.sp)
            Row(horizontalArrangement = Arrangement.spacedBy(FaflowSpacing.sm)) {
                RoleBadge(role = "teacher")
                RoleBadge(role = "hod")
                RoleBadge(role = "principal")
            }
            Row(horizontalArrangement = Arrangement.spacedBy(FaflowSpacing.sm)) {
                RoleBadge(role = "governance")
                RoleBadge(role = "manager")
            }

            Spacer(modifier = Modifier.height(FaflowSpacing.sm))
            Text("Verification Status Badges", color = FaflowText1, fontSize = 14.sp)
            Row(horizontalArrangement = Arrangement.spacedBy(FaflowSpacing.sm)) {
                StatusBadge(status = "approved")
                StatusBadge(status = "pending")
                StatusBadge(status = "rejected")
            }
            Row(horizontalArrangement = Arrangement.spacedBy(FaflowSpacing.sm)) {
                StatusBadge(status = "cancelled")
                DayOrderBadge(dayOrder = 3, isWorkingDay = true)
                DayOrderBadge(dayOrder = null, isWorkingDay = false)
            }
        }
    }
}

@Preview(name = "Cards & Elevation", showBackground = true, widthDp = 380)
@Composable
fun PreviewCards() {
    FAFLOWTheme {
        Column(
            modifier = Modifier
                .background(FaflowBg)
                .padding(FaflowSpacing.lg),
            verticalArrangement = Arrangement.spacedBy(FaflowSpacing.md)
        ) {
            Text("Institutional Stat & Metric Cards", color = FaflowText1, fontSize = 16.sp)
            StatCard(
                title = "Total Attendance",
                value = "98.5%",
                subtitle = "142 of 144 present",
                icon = Icons.Default.CheckCircle,
                iconTint = StatusSuccess,
                iconBackground = StatusSuccessBg,
                onClick = {}
            )
            MetricCard(
                title = "Biometric Settling Window",
                value = "160 ms",
                subtitle = "2 minimum settling frames required",
                icon = Icons.Default.Fingerprint,
                iconTint = FaflowNavy
            )
        }
    }
}

@Preview(name = "Feedback States", showBackground = true, widthDp = 380)
@Composable
fun PreviewFeedbackStates() {
    FAFLOWTheme {
        Column(
            modifier = Modifier
                .background(FaflowBg)
                .padding(FaflowSpacing.lg),
            verticalArrangement = Arrangement.spacedBy(FaflowSpacing.md)
        ) {
            EmptyStateView(
                title = "No Pending Timetable Requests",
                description = "All scheduled lectures have verified faculty assignments for today."
            )
            ErrorRetryView(
                message = "Unable to connect to biometric synchronization endpoint. Offline queue active.",
                onRetry = {}
            )
        }
    }
}
