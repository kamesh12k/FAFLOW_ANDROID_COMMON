package com.governence.faflow.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Shapes
import androidx.compose.material3.lightColorScheme
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Institutional Design System Tokens for FAFLOW Android Client.
 * AUTO-GENERATED from design/tokens/faflow_design_tokens.json
 * DO NOT EDIT DIRECTLY. Run: python scripts/generate_design_tokens.py
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
    val huge: Dp = 40.dp
    val giant: Dp = 48.dp
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
    val card = RoundedCornerShape(14.dp)
    val hero = RoundedCornerShape(16.dp)
    val checkinHero = RoundedCornerShape(16.dp)
    val large = RoundedCornerShape(20.dp)
    val sheet = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)
    val pill = RoundedCornerShape(percent = 50)
}

val FaflowMaterialShapes = Shapes(
    small = FaflowShapes.small,
    medium = FaflowShapes.medium,
    large = FaflowShapes.card
)

object FaflowDimensions {
    val minTouchTarget: Dp = 48.dp
    val iconXs: Dp = 14.dp
    val iconSm: Dp = 16.dp
    val iconMd: Dp = 20.dp
    val iconLg: Dp = 24.dp
    val iconXl: Dp = 32.dp
    val avatarSm: Dp = 32.dp
    val avatarMd: Dp = 40.dp
    val avatarLg: Dp = 56.dp
}

object FaflowElevation {
    val flat: Dp = 0.dp
    val card: Dp = 1.dp
    val raised: Dp = 3.dp
    val dialog: Dp = 6.dp
    val sheet: Dp = 8.dp
}

object FaflowRoleColors {
    val TeacherPrimary = Color(0xFF1B3A6B)
    val TeacherBackground = Color(0xFFEAF0F9)
    val HodPrimary = Color(0xFF6C4FCE)
    val HodBackground = Color(0xFFEFEBFC)
    val PrincipalPrimary = Color(0xFF7A5806)
    val PrincipalBackground = Color(0xFFFBF1DF)
    val GovernancePrimary = Color(0xFF0B665D)
    val GovernanceBackground = Color(0xFFE4F3F1)
    val ManagerPrimary = Color(0xFF334155)
    val ManagerBackground = Color(0xFFF1F5F9)
    val StaffPrimary = Color(0xFF1B3A6B)
    val StaffBackground = Color(0xFFEAF0F9)
}

object FaflowStatusColors {
    val Approved = Color(0xFF166B45)
    val ApprovedBg = Color(0xFFECFDF5)
    val Pending = Color(0xFF7A5806)
    val PendingBg = Color(0xFFFBF1DF)
    val Rejected = Color(0xFFB02A2A)
    val RejectedBg = Color(0xFFFFF1F2)
    val Cancelled = Color(0xFF475569)
    val CancelledBg = Color(0xFFF1F5F9)

    val WorkingDay = PrimaryNavy
    val Holiday = Color(0xFFEA580C)
    val HolidayBg = Color(0xFFFFF7ED)
}

/**
 * Standard Light ColorScheme adhering to institutional branding and WCAG 2.2 AA.
 */
val FaflowLightColorScheme = lightColorScheme(
    primary = PrimaryNavy,
    onPrimary = Color.White,
    primaryContainer = FaflowNavyTint,
    onPrimaryContainer = PrimaryNavy,
    secondary = SecondaryTeal,
    onSecondary = Color.White,
    tertiary = TertiaryViolet,
    background = FaflowBg,
    onBackground = FaflowText1,
    surface = FaflowSurface,
    onSurface = FaflowText1,
    surfaceVariant = FaflowDivider,
    onSurfaceVariant = FaflowText2,
    outline = FaflowBorderControl,
    error = StatusError,
    onError = Color.White
)
