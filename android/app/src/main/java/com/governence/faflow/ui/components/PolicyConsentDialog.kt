package com.governence.faflow.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import com.governence.faflow.core.network.NetworkResult
import com.governence.faflow.core.network.PolicySectionDto
import com.governence.faflow.domain.model.StaffMember
import com.governence.faflow.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun PolicyConsentDialog(
    isOpen: Boolean,
    authRepository: AuthRepository,
    onConsentAccepted: (StaffMember) -> Unit
) {
    if (!isOpen) return

    val scope = rememberCoroutineScope()
    var sections by remember { mutableStateOf<List<PolicySectionDto>>(emptyList()) }
    var policyVersion by remember { mutableStateOf("v1.0.0") }
    var effectiveDate by remember { mutableStateOf("2026-09-01") }
    var activeTabId by remember { mutableStateOf("privacy") }
    var hasAgreed by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(true) }
    var isSubmitting by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(isOpen) {
        isLoading = true
        errorMessage = null
        when (val result = authRepository.getCurrentPolicy()) {
            is NetworkResult.Success -> {
                sections = result.data.sections
                policyVersion = result.data.version
                effectiveDate = result.data.effectiveDate
                if (sections.isNotEmpty()) {
                    activeTabId = sections.first().id
                }
            }
            is NetworkResult.Error -> {
                errorMessage = result.message
            }
            else -> {}
        }
        isLoading = false
    }

    Dialog(
        onDismissRequest = { /* Modal: Mandatory acceptance */ },
        properties = DialogProperties(
            dismissOnBackPress = false,
            dismissOnClickOutside = false,
            usePlatformDefaultWidth = false
        )
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth(0.95f)
                .fillMaxHeight(0.85f)
                .clip(RoundedCornerShape(20.dp)),
            color = Color.White,
            tonalElevation = 8.dp
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(20.dp)
            ) {
                // Header
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "🛡️",
                            fontSize = 24.sp,
                            modifier = Modifier.padding(end = 10.dp)
                        )
                        Column {
                            Text(
                                text = "Institutional Policies",
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold,
                                color = FaflowText1
                            )
                            Text(
                                text = "Version: $policyVersion",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = FaflowNavy
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                if (isLoading) {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth(),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = FaflowNavy)
                    }
                } else {
                    // Section Selector Chips
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 6.dp),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        sections.forEach { section ->
                            val selected = section.id == activeTabId
                            FilterChip(
                                selected = selected,
                                onClick = { activeTabId = section.id },
                                label = {
                                    Text(
                                        text = when (section.id) {
                                            "privacy" -> "Privacy"
                                            "terms" -> "Terms"
                                            "geofence_attendance" -> "Location"
                                            "biometric" -> "Biometrics"
                                            else -> section.title.take(10)
                                        },
                                        fontSize = 11.sp,
                                        fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal
                                    )
                                },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = FaflowNavy.copy(alpha = 0.15f),
                                    selectedLabelColor = FaflowNavy
                                )
                            )
                        }
                    }

                    // Active Section Content
                    val activeSection = sections.find { it.id == activeTabId } ?: sections.firstOrNull()
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth()
                            .background(FaflowBg, RoundedCornerShape(12.dp))
                            .padding(14.dp)
                            .verticalScroll(rememberScrollState())
                    ) {
                        if (activeSection != null) {
                            Text(
                                text = activeSection.title,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = FaflowText1
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = activeSection.content,
                                fontSize = 12.sp,
                                lineHeight = 18.sp,
                                color = FaflowText2
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    // Explicit Checkbox
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .clickable { hasAgreed = !hasAgreed }
                            .padding(4.dp)
                    ) {
                        Checkbox(
                            checked = hasAgreed,
                            onCheckedChange = { hasAgreed = it },
                            colors = CheckboxDefaults.colors(checkedColor = FaflowNavy)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "I have read, understood, and agree to the institutional data and usage policies.",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Medium,
                            color = FaflowText1,
                            lineHeight = 15.sp
                        )
                    }
                }

                if (errorMessage != null) {
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = errorMessage ?: "",
                        color = Color(0xFFDC2626),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Actions
                Button(
                    onClick = {
                        if (hasAgreed) {
                            isSubmitting = true
                            errorMessage = null
                            scope.launch {
                                when (val res = authRepository.acceptPolicy(policyVersion)) {
                                    is NetworkResult.Success -> {
                                        onConsentAccepted(res.data)
                                    }
                                    is NetworkResult.Error -> {
                                        errorMessage = res.message
                                    }
                                    else -> {}
                                }
                                isSubmitting = false
                            }
                        }
                    },
                    enabled = hasAgreed && !isSubmitting && !isLoading,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = FaflowNavy,
                        disabledContainerColor = Color(0xFFCBD5E1)
                    )
                ) {
                    if (isSubmitting) {
                        CircularProgressIndicator(
                            color = Color.White,
                            modifier = Modifier.size(20.dp),
                            strokeWidth = 2.dp
                        )
                    } else {
                        Text(
                            text = "Accept & Continue →",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                    }
                }
            }
        }
    }
}
