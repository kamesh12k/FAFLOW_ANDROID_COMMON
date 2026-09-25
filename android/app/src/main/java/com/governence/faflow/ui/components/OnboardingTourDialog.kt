package com.governence.faflow.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.governence.faflow.auth.data.AuthRepository
import com.governence.faflow.ui.theme.*
import kotlinx.coroutines.launch

data class MobileTourStep(
    val title: String,
    val description: String,
    val iconEmoji: String,
    val isInteractiveSandbox: Boolean = false
)

data class DemoStudent(
    val id: Int,
    val name: String,
    val roll: String,
    var status: String
)

@Composable
fun OnboardingTourDialog(
    isOpen: Boolean,
    userRole: String,
    authRepository: AuthRepository,
    onTourFinished: () -> Unit
) {
    if (!isOpen) return

    val scope = rememberCoroutineScope()
    val isHod = userRole.lowercase() == "admin" || userRole.lowercase() == "hod"

    val steps = remember(isHod) {
        if (isHod) {
            listOf(
                MobileTourStep(
                    title = "Welcome, HOD!",
                    description = "FAFLOW Mobile gives you complete department visibility: timetable coverage, daily attendance, and real-time leave approvals on the go.",
                    iconEmoji = "🏛️"
                ),
                MobileTourStep(
                    title = "Department Dashboard & Tabs",
                    description = "Switch between Home Overview, Leave Approvals, Timetable lookup, and Staff Attendance using the bottom navigation bar.",
                    iconEmoji = "📱"
                ),
                MobileTourStep(
                    title = "Instant Leave Approval",
                    description = "Open pending staff leave applications, verify substitute arrangements, and approve or reject with one tap.",
                    iconEmoji = "✅"
                ),
                MobileTourStep(
                    title = "Daily Timetable & Coverage",
                    description = "Monitor ongoing classes, unattended periods, and substitution duties across your department.",
                    iconEmoji = "📅"
                )
            )
        } else {
            listOf(
                MobileTourStep(
                    title = "Welcome to FAFLOW!",
                    description = "Your official mobile workspace for daily class schedules, student attendance, and leave management.",
                    iconEmoji = "🎓"
                ),
                MobileTourStep(
                    title = "Daily Timetable",
                    description = "Check your periods, rooms, and assigned subjects dynamically resolved based on the college day order.",
                    iconEmoji = "📅"
                ),
                MobileTourStep(
                    title = "Fast Attendance Simulator",
                    description = "Try it out! Tap a student card below to practice marking Present, Absent, or On-Duty in this safe simulator.",
                    iconEmoji = "⚡",
                    isInteractiveSandbox = true
                ),
                MobileTourStep(
                    title = "Leave & Substitution Alerts",
                    description = "Apply for single-day or custom-period leaves and receive instant notifications when substitution duties are assigned.",
                    iconEmoji = "🔔"
                ),
                MobileTourStep(
                    title = "Credits & Rewards",
                    description = "Earn faculty credits for substitution assistance. Track your total balance under More > Credits.",
                    iconEmoji = "⭐"
                )
            )
        }
    }

    var currentStepIndex by remember { mutableIntStateOf(0) }
    var demoStudents by remember {
        mutableStateOf(
            listOf(
                DemoStudent(1, "Aravind K.", "22CS01", "present"),
                DemoStudent(2, "Bhavani S.", "22CS02", "present"),
                DemoStudent(3, "Chandran M.", "22CS03", "absent")
            )
        )
    }
    var sandboxToggled by remember { mutableStateOf(false) }
    var isCompleting by remember { mutableStateOf(false) }

    val currentStep = steps.getOrNull(currentStepIndex) ?: steps.first()

    fun finishTour() {
        isCompleting = true
        scope.launch {
            authRepository.completeOnboarding()
            isCompleting = false
            onTourFinished()
        }
    }

    Dialog(
        onDismissRequest = { finishTour() },
        properties = DialogProperties(
            dismissOnBackPress = true,
            dismissOnClickOutside = false,
            usePlatformDefaultWidth = false
        )
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth(0.92f)
                .wrapContentHeight()
                .clip(RoundedCornerShape(20.dp)),
            color = Color.White,
            tonalElevation = 8.dp
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp)
            ) {
                // Header Progress
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = "Step ${currentStepIndex + 1} of ${steps.size}",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = FaflowNavy,
                        modifier = Modifier
                            .background(FaflowNavy.copy(alpha = 0.1f), RoundedCornerShape(10.dp))
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                    )

                    TextButton(
                        onClick = { finishTour() },
                        contentPadding = PaddingValues(0.dp)
                    ) {
                        Text(
                            text = "Skip Tour",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = FaflowText2
                        )
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Step Visual & Icon
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = currentStep.iconEmoji,
                        fontSize = 28.sp,
                        modifier = Modifier.padding(end = 12.dp)
                    )
                    Text(
                        text = currentStep.title,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = FaflowText1
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = currentStep.description,
                    fontSize = 12.sp,
                    lineHeight = 17.sp,
                    color = FaflowText2
                )

                // Interactive Simulator if applicable
                if (currentStep.isInteractiveSandbox) {
                    Spacer(modifier = Modifier.height(12.dp))
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(FaflowBg, RoundedCornerShape(12.dp))
                            .padding(10.dp)
                    ) {
                        Text(
                            text = "SIMULATOR: Tap a card to toggle status",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = FaflowNavy
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            demoStudents.forEach { s ->
                                val (bg, textCol, label) = when (s.status) {
                                    "present" -> Triple(Color(0xFFDCFCE7), Color(0xFF166534), "✓ P")
                                    "absent" -> Triple(Color(0xFFFFE4E6), Color(0xFF991B1B), "✗ A")
                                    else -> Triple(Color(0xFFFEF3C7), Color(0xFF92400E), "★ OD")
                                }
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(bg)
                                        .clickable {
                                            val next = if (s.status == "present") "absent" else if (s.status == "absent") "od" else "present"
                                            demoStudents = demoStudents.map { if (it.id == s.id) it.copy(status = next) else it }
                                            sandboxToggled = true
                                        }
                                        .padding(8.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                        Text(text = s.roll, fontSize = 9.sp, fontWeight = FontWeight.Bold, color = textCol)
                                        Text(text = s.name.take(7), fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = textCol)
                                        Text(text = label, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = textCol)
                                    }
                                }
                            }
                        }
                        if (sandboxToggled) {
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = "🎉 Perfect! You now know how to toggle student attendance.",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF15803D)
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(18.dp))

                // Actions
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (currentStepIndex > 0) {
                        OutlinedButton(
                            onClick = { currentStepIndex-- },
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.height(42.dp)
                        ) {
                            Text(text = "← Back", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                        }
                    } else {
                        Spacer(modifier = Modifier.width(1.dp))
                    }

                    Button(
                        onClick = {
                            if (currentStepIndex < steps.size - 1) {
                                currentStepIndex++
                            } else {
                                finishTour()
                            }
                        },
                        enabled = !isCompleting,
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = FaflowNavy),
                        modifier = Modifier.height(42.dp)
                    ) {
                        if (isCompleting) {
                            CircularProgressIndicator(
                                color = Color.White,
                                modifier = Modifier.size(16.dp),
                                strokeWidth = 2.dp
                            )
                        } else if (currentStepIndex == steps.size - 1) {
                            Text(text = "Finish ✓", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        } else {
                            Text(text = "Next →", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}
