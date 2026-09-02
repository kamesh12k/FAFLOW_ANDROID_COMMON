package com.governence.faflow.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Institutional Design System Tokens for FAFLOW Staff Mobile (Milestone 17).
 * Provides calm, mature, professional, and accessible UI constants.
 */
object FaflowSpacing {
    val xxs: Dp = 2.dp
    val xs: Dp = 4.dp
    val sm: Dp = 8.dp
    val md: Dp = 12.dp
    val lg: Dp = 16.dp
    val xl: Dp = 20.dp
    val xxl: Dp = 24.dp
    val xxxl: Dp = 32.dp
}

object FaflowShapes {
    val small = RoundedCornerShape(8.dp)
    val medium = RoundedCornerShape(12.dp)
    val card = RoundedCornerShape(16.dp)
    val large = RoundedCornerShape(20.dp)
    val sheet = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)
    val pill = RoundedCornerShape(percent = 50)
}

object FaflowRoleColors {
    val TeacherPrimary = Color(0xFF4F46E5)       // Indigo 600
    val TeacherBackground = Color(0xFFEEF2FF)    // Indigo 50
    val HodPrimary = Color(0xFF7C3AED)           // Purple 600
    val HodBackground = Color(0xFFF5F3FF)        // Purple 50
    val PrincipalPrimary = Color(0xFFD97706)     // Amber 600
    val PrincipalBackground = Color(0xFFFFFBEB)  // Amber 50
    val GovernancePrimary = Color(0xFF0284C7)    // Sky 600
    val GovernanceBackground = Color(0xFFF0F9FF) // Sky 50
}

object FaflowStatusColors {
    val Approved = Color(0xFF059669)             // Emerald 600
    val ApprovedBg = Color(0xFFECFDF5)           // Emerald 50
    val Pending = Color(0xFFD97706)              // Amber 600
    val PendingBg = Color(0xFFFFFBEB)            // Amber 50
    val Rejected = Color(0xFFDC2626)             // Red 600
    val RejectedBg = Color(0xFFFEF2F2)           // Red 50
    val Cancelled = Color(0xFF64748B)            // Slate 500
    val CancelledBg = Color(0xFFF8FAFC)          // Slate 50
    
    val WorkingDay = Color(0xFF4F46E5)           // Indigo
    val Holiday = Color(0xFFEA580C)              // Orange 600
    val HolidayBg = Color(0xFFFFF7ED)            // Orange 50
}
