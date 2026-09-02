package com.governence.faflow.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.governence.faflow.ui.theme.FaflowRoleColors
import com.governence.faflow.ui.theme.FaflowShapes
import com.governence.faflow.ui.theme.FaflowStatusColors

@Composable
fun DayOrderBadge(
    dayOrder: Int?,
    modifier: Modifier = Modifier,
    isWorkingDay: Boolean = true
) {
    val bgColor = if (isWorkingDay && dayOrder != null) Color(0xFF4F46E5) else FaflowStatusColors.Holiday
    val text = if (isWorkingDay && dayOrder != null) "DO $dayOrder" else "HOLIDAY"
    
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(bgColor)
            .padding(horizontal = 10.dp, vertical = 6.dp)
    ) {
        Text(
            text = text,
            color = Color.White,
            fontWeight = FontWeight.ExtraBold,
            fontSize = 12.sp,
            letterSpacing = 0.5.sp
        )
    }
}

@Composable
fun RoleBadge(
    role: String,
    modifier: Modifier = Modifier
) {
    val (bgColor, textColor, label) = when (role.lowercase()) {
        "admin", "hod" -> Triple(FaflowRoleColors.HodBackground, FaflowRoleColors.HodPrimary, "HOD / Dept Admin")
        "principal" -> Triple(FaflowRoleColors.PrincipalBackground, FaflowRoleColors.PrincipalPrimary, "Principal")
        "governance" -> Triple(FaflowRoleColors.GovernanceBackground, FaflowRoleColors.GovernancePrimary, "Governance")
        else -> Triple(FaflowRoleColors.TeacherBackground, FaflowRoleColors.TeacherPrimary, "Faculty")
    }

    Box(
        modifier = modifier
            .clip(FaflowShapes.pill)
            .background(bgColor)
            .border(1.dp, textColor.copy(alpha = 0.3f), FaflowShapes.pill)
            .padding(horizontal = 10.dp, vertical = 4.dp)
    ) {
        Text(
            text = label,
            color = textColor,
            fontWeight = FontWeight.Bold,
            fontSize = 11.sp
        )
    }
}

@Composable
fun StatusBadge(
    status: String,
    modifier: Modifier = Modifier
) {
    val (bgColor, textColor) = when (status.lowercase()) {
        "approved", "verified", "active", "present" -> Pair(FaflowStatusColors.ApprovedBg, FaflowStatusColors.Approved)
        "pending", "needs_substitute", "partial" -> Pair(FaflowStatusColors.PendingBg, FaflowStatusColors.Pending)
        "rejected", "absent", "failed" -> Pair(FaflowStatusColors.RejectedBg, FaflowStatusColors.Rejected)
        "cancelled" -> Pair(FaflowStatusColors.CancelledBg, FaflowStatusColors.Cancelled)
        else -> Pair(MaterialTheme.colorScheme.surfaceVariant, MaterialTheme.colorScheme.onSurfaceVariant)
    }

    Box(
        modifier = modifier
            .clip(FaflowShapes.pill)
            .background(bgColor)
            .border(1.dp, textColor.copy(alpha = 0.25f), FaflowShapes.pill)
            .padding(horizontal = 8.dp, vertical = 3.dp)
    ) {
        Text(
            text = status.replace('_', ' ').replaceFirstChar { it.uppercase() },
            color = textColor,
            fontWeight = FontWeight.Bold,
            fontSize = 11.sp
        )
    }
}
