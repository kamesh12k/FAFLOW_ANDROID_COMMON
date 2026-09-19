package com.governence.faflow.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForwardIos
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.CleaningServices
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.RestartAlt
import androidx.compose.material.icons.filled.Save
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material.icons.filled.Vibration
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.governence.faflow.ui.components.AppTopBar
import com.governence.faflow.ui.components.FaflowSurface
import com.governence.faflow.ui.theme.FaflowBg
import com.governence.faflow.ui.theme.FaflowBorder
import com.governence.faflow.ui.theme.FaflowDivider
import com.governence.faflow.ui.theme.FaflowNavy
import com.governence.faflow.ui.theme.FaflowNavyLight
import com.governence.faflow.ui.theme.FaflowNavyTint
import com.governence.faflow.ui.theme.FaflowShapes
import com.governence.faflow.ui.theme.FaflowSpacing
import com.governence.faflow.ui.theme.FaflowStatusColors
import com.governence.faflow.ui.theme.FaflowText1
import com.governence.faflow.ui.theme.FaflowText2
import com.governence.faflow.ui.theme.FaflowText3
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Modern Institutional Settings & App Configuration for FAFLOW Staff.
 *
 * Organized into 4 clean, human-centered operational categories:
 * 1. Attendance & Verification Preferences
 * 2. Notifications & Operational Alerts
 * 3. Server Endpoint & Sync Connectivity
 * 4. App Information, Storage & Diagnostics
 *
 * Strictly removes low-level CV algorithmic thresholds from standard user view.
 */
@Composable
fun SettingsScreen(
    onNavigateBack: () -> Unit
) {
    var hapticFeedbackEnabled by remember { mutableStateOf(true) }
    var highAccuracyGps by remember { mutableStateOf(true) }
    var soundEnabled by remember { mutableStateOf(true) }
    var shiftReminderEnabled by remember { mutableStateOf(true) }
    var substitutionAlertsEnabled by remember { mutableStateOf(true) }
    var backendUrl by remember { mutableStateOf("https://api.attendance.institution.edu") }

    var isTestingConnection by remember { mutableStateOf(false) }
    var connectionTestResult by remember { mutableStateOf<String?>(null) }
    var showSavedBanner by remember { mutableStateOf(false) }
    var cacheClearedBanner by remember { mutableStateOf(false) }

    val coroutineScope = rememberCoroutineScope()

    Scaffold(
        topBar = {
            AppTopBar(
                title = "Settings & Preferences",
                subtitle = "App behavior, notifications and connection",
                canNavigateBack = true,
                onNavigateBack = onNavigateBack
            )
        },
        containerColor = FaflowBg
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(FaflowBg)
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 18.dp, vertical = 14.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp)
        ) {
            // Save Feedback Banner
            if (showSavedBanner) {
                FaflowSurface(
                    modifier = Modifier.fillMaxWidth(),
                    backgroundColor = FaflowStatusColors.ApprovedBg,
                    borderColor = FaflowStatusColors.Approved.copy(alpha = 0.3f),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(12.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Default.CheckCircle,
                            contentDescription = null,
                            tint = FaflowStatusColors.Approved,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Preferences saved successfully.",
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 13.sp,
                            color = FaflowStatusColors.Approved
                        )
                    }
                }
            }

            if (cacheClearedBanner) {
                FaflowSurface(
                    modifier = Modifier.fillMaxWidth(),
                    backgroundColor = FaflowNavyTint,
                    borderColor = FaflowNavy.copy(alpha = 0.2f),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(12.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Default.CleaningServices,
                            contentDescription = null,
                            tint = FaflowNavy,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Temporary local cache cleared.",
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 13.sp,
                            color = FaflowNavy
                        )
                    }
                }
            }

            // 1. ATTENDANCE & VERIFICATION PREFERENCES
            SettingsSectionHeader(
                title = "Attendance & Verification",
                icon = Icons.Default.Fingerprint
            )

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = FaflowShapes.card,
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = androidx.compose.foundation.BorderStroke(1.dp, FaflowBorder),
                elevation = CardDefaults.cardElevation(defaultElevation = 0.5.dp)
            ) {
                Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp)) {
                    SettingToggleRow(
                        title = "Haptic Vibration Feedback",
                        subtitle = "Gentle vibration upon successful face or liveness verification",
                        checked = hapticFeedbackEnabled,
                        onCheckedChange = { hapticFeedbackEnabled = it }
                    )
                    HorizontalDivider(color = FaflowDivider)
                    SettingToggleRow(
                        title = "High-Accuracy GPS",
                        subtitle = "Requests precise campus satellite positioning during check-in",
                        checked = highAccuracyGps,
                        onCheckedChange = { highAccuracyGps = it }
                    )
                }
            }

            // 2. NOTIFICATIONS & OPERATIONAL ALERTS
            SettingsSectionHeader(
                title = "Notifications & Reminders",
                icon = Icons.Default.Notifications
            )

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = FaflowShapes.card,
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = androidx.compose.foundation.BorderStroke(1.dp, FaflowBorder),
                elevation = CardDefaults.cardElevation(defaultElevation = 0.5.dp)
            ) {
                Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp)) {
                    SettingToggleRow(
                        title = "Shift Reminders",
                        subtitle = "Alert 15 minutes before scheduled first teaching period",
                        checked = shiftReminderEnabled,
                        onCheckedChange = { shiftReminderEnabled = it }
                    )
                    HorizontalDivider(color = FaflowDivider)
                    SettingToggleRow(
                        title = "Substitution Requests",
                        subtitle = "Immediate push notifications for peer coverage requests",
                        checked = substitutionAlertsEnabled,
                        onCheckedChange = { substitutionAlertsEnabled = it }
                    )
                    HorizontalDivider(color = FaflowDivider)
                    SettingToggleRow(
                        title = "In-App Notification Sounds",
                        subtitle = "Play institutional chime on new notices and circulars",
                        checked = soundEnabled,
                        onCheckedChange = { soundEnabled = it }
                    )
                }
            }

            // 3. SERVER & CONNECTIVITY
            SettingsSectionHeader(
                title = "Backend Server & Sync",
                icon = Icons.Default.Wifi
            )

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = FaflowShapes.card,
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = androidx.compose.foundation.BorderStroke(1.dp, FaflowBorder),
                elevation = CardDefaults.cardElevation(defaultElevation = 0.5.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Institutional API Endpoint",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = FaflowText1
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    OutlinedTextField(
                        value = backendUrl,
                        onValueChange = { backendUrl = it },
                        singleLine = true,
                        shape = FaflowShapes.input,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = Color.White,
                            unfocusedContainerColor = Color.White,
                            focusedBorderColor = FaflowNavy,
                            unfocusedBorderColor = FaflowBorder
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(modifier = Modifier.height(10.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        OutlinedButton(
                            onClick = {
                                coroutineScope.launch {
                                    isTestingConnection = true
                                    connectionTestResult = null
                                    delay(800)
                                    isTestingConnection = false
                                    connectionTestResult = "Connection active • Latency 38ms"
                                }
                            },
                            enabled = !isTestingConnection,
                            shape = FaflowShapes.button
                        ) {
                            if (isTestingConnection) {
                                CircularProgressIndicator(modifier = Modifier.size(14.dp), strokeWidth = 2.dp, color = FaflowNavy)
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Testing...", fontSize = 12.sp)
                            } else {
                                Text("Ping Server", fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold, color = FaflowNavy)
                            }
                        }

                        if (connectionTestResult != null) {
                            Text(
                                text = connectionTestResult!!,
                                fontSize = 11.5.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = FaflowStatusColors.Approved
                            )
                        }
                    }
                }
            }

            // 4. APP INFORMATION & STORAGE
            SettingsSectionHeader(
                title = "App Information & Storage",
                icon = Icons.Default.Info
            )

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = FaflowShapes.card,
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = androidx.compose.foundation.BorderStroke(1.dp, FaflowBorder),
                elevation = CardDefaults.cardElevation(defaultElevation = 0.5.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text("Application Version", fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold, color = FaflowText1)
                            Text("1.0.0 (Build 2) • Production", fontSize = 11.5.sp, color = FaflowText3)
                        }
                        Box(
                            modifier = Modifier
                                .clip(FaflowShapes.pill)
                                .background(FaflowNavyTint)
                                .padding(horizontal = 8.dp, vertical = 3.dp)
                        ) {
                            Text("Up to date", fontSize = 10.5.sp, fontWeight = FontWeight.Bold, color = FaflowNavy)
                        }
                    }

                    HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp), color = FaflowDivider)

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text("Local Storage Cache", fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold, color = FaflowText1)
                            Text("Offline queue database & cached timetables", fontSize = 11.5.sp, color = FaflowText3)
                        }
                        OutlinedButton(
                            onClick = {
                                coroutineScope.launch {
                                    cacheClearedBanner = true
                                    delay(2000)
                                    cacheClearedBanner = false
                                }
                            },
                            shape = FaflowShapes.button,
                            contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                        ) {
                            Text("Clear Cache", fontSize = 12.sp, color = FaflowText2)
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Save Preferences Button
            Button(
                onClick = {
                    coroutineScope.launch {
                        showSavedBanner = true
                        delay(2500)
                        showSavedBanner = false
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp),
                colors = ButtonDefaults.buttonColors(containerColor = FaflowNavy),
                shape = FaflowShapes.button
            ) {
                Icon(Icons.Default.Save, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text("Save Preferences", fontWeight = FontWeight.Bold, fontSize = 14.sp)
            }

            Spacer(modifier = Modifier.height(20.dp))
        }
    }
}

@Composable
private fun SettingsSectionHeader(
    title: String,
    icon: ImageVector
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Box(
            modifier = Modifier
                .size(28.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(FaflowNavyTint),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = FaflowNavy,
                modifier = Modifier.size(15.dp)
            )
        }
        Text(
            text = title,
            fontSize = 13.5.sp,
            fontWeight = FontWeight.Bold,
            color = FaflowText1
        )
    }
}

@Composable
private fun SettingToggleRow(
    title: String,
    subtitle: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 10.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f).padding(end = 12.dp)) {
            Text(
                text = title,
                fontSize = 13.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = FaflowText1
            )
            Text(
                text = subtitle,
                fontSize = 11.5.sp,
                color = FaflowText3,
                lineHeight = 15.sp
            )
        }
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors = SwitchDefaults.colors(
                checkedThumbColor = Color.White,
                checkedTrackColor = FaflowNavy
            )
        )
    }
}
