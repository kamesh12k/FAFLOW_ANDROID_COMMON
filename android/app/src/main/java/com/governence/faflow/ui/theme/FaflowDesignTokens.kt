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
    val markSm = RoundedCornerShape(9.dp)
    val markMd = RoundedCornerShape(14.dp)
    val markBig = RoundedCornerShape(18.dp)
    val small = RoundedCornerShape(8.dp)
    val input = RoundedCornerShape(10.dp)
    val button = RoundedCornerShape(10.dp)
    val checkinButton = RoundedCornerShape(11.dp)
    val badge = RoundedCornerShape(11.dp)
    val medium = RoundedCornerShape(12.dp)
    val card = RoundedCornerShape(13.dp)
    val hero = RoundedCornerShape(14.dp)
    val checkinHero = RoundedCornerShape(16.dp)
    val large = RoundedCornerShape(20.dp)
    val sheet = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)
    val pill = RoundedCornerShape(percent = 50)
}

object FaflowRoleColors {
    val TeacherPrimary = FaflowNavy
    val TeacherBackground = FaflowNavyTint
    val HodPrimary = FaflowViolet
    val HodBackground = FaflowVioletTint
    val PrincipalPrimary = FaflowGold
    val PrincipalBackground = FaflowGoldTint
    val GovernancePrimary = FaflowTeal
    val GovernanceBackground = FaflowTealTint
}

object FaflowStatusColors {
    val Approved = FaflowSuccess
    val ApprovedBg = Color(0xFFE4F3F1)
    val Pending = FaflowGold
    val PendingBg = FaflowGoldTint
    val Rejected = FaflowDanger
    val RejectedBg = Color(0xFFFDE8E8)
    val Cancelled = FaflowSlate
    val CancelledBg = FaflowSlateTint
    
    val WorkingDay = FaflowNavy
    val Holiday = Color(0xFFEA580C)
    val HolidayBg = Color(0xFFFFF7ED)
}
