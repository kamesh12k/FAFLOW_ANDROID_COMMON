package com.governence.faflow.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * FAFLOW Core Color Palette
 * AUTO-GENERATED from design/tokens/faflow_design_tokens.json
 * DO NOT EDIT DIRECTLY. Run: python scripts/generate_design_tokens.py
 */

// Global Brand Palette
val PrimaryNavy = Color(0xFF1B3A6B)
val PrimaryNavyLight = Color(0xFF2E5490)
val SecondaryTeal = Color(0xFF0E8074)
val TertiaryViolet = Color(0xFF6C4FCE)
val AccentGold = Color(0xFF876208)
val AccentGoldDark = Color(0xFF7A5806)

// Status Colors (WCAG 2.2 AA Verified)
val StatusSuccess = Color(0xFF166B45)
val StatusSuccessBg = Color(0xFFECFDF5)
val StatusSuccessBorder = Color(0xFFA7F3D0)

val StatusWarning = Color(0xFF7A5806)
val StatusWarningBg = Color(0xFFFBF1DF)
val StatusWarningBorder = Color(0xFFEDC87D)

val StatusError = Color(0xFFB02A2A)
val StatusErrorBg = Color(0xFFFFF1F2)
val StatusErrorBorder = Color(0xFFFECDD3)

val StatusInfo = Color(0xFF1B3A6B)
val StatusInfoBg = Color(0xFFEAF0F9)
val StatusInfoBorder = Color(0xFFABC4E9)

// Surfaces & Neutral Layout Colors (Light Theme Institutional)
val FaflowBg = Color(0xFFF5F6F8)
val FaflowSurface = Color(0xFFFFFFFF)
val FaflowSurfaceHover = Color(0xFFF9FAFC)
val FaflowBorder = Color(0xFFE6E8EC)
val FaflowBorderControl = Color(0xFF828C99)
val FaflowDivider = Color(0xFFEEF0F3)

// Typography Hierarchy (WCAG 2.2 AA Verified)
val FaflowText1 = Color(0xFF1A1D21)
val FaflowText2 = Color(0xFF5B6169)
val FaflowTextMuted = Color(0xFF667085)
val FaflowText3 = FaflowTextMuted // Backwards compatibility alias
val FaflowTextInverse = Color(0xFFFFFFFF)

// Navy Tints
val FaflowNavy = PrimaryNavy
val FaflowNavyLight = PrimaryNavyLight
val FaflowNavyTint = Color(0xFFEAF0F9)

// Teal Tints
val FaflowTeal = SecondaryTeal
val FaflowTealTint = Color(0xFFE4F3F1)

// Violet Tints
val FaflowViolet = TertiaryViolet
val FaflowVioletTint = Color(0xFFEFEBFC)

// Gold Tints
val FaflowGold = AccentGold
val FaflowGoldDark = AccentGoldDark
val FaflowGoldTint = Color(0xFFFBF1DF)

// Slate Tints
val FaflowSlate = Color(0xFF475569)
val FaflowSlateTint = Color(0xFFF1F5F9)

// Status Aliases
val FaflowSuccess = StatusSuccess
val FaflowDanger = StatusError

// Light Theme Surface Bindings
val LightBackground = FaflowBg
val LightSurface = FaflowSurface
val LightSurfaceVariant = FaflowDivider
val LightBorder = FaflowBorder
val TextPrimaryLight = FaflowText1
val TextSecondaryLight = FaflowText2

// Backward Compatibility & Semantic Aliases
val PrimaryBlue = PrimaryNavy
val PrimaryBlueDark = PrimaryNavyLight
val TertiaryEmerald = StatusSuccess
val DarkBackground = FaflowBg
val DarkSurface = FaflowSurface
val DarkSurfaceVariant = FaflowDivider
val DarkBorder = FaflowBorder
val TextPrimaryDark = FaflowText1
val TextSecondaryDark = FaflowText2
val GlassDark = Color(0xCC0F172A)
val GlassLight = Color(0xCCFFFFFF)

// Camera & Modal Scrims
val ScrimDark = Color(0xCC0F172A)
val ScrimGuidancePill = Color(0xCC1A1D21)
val CardHighlight = Color(0x0D1B3A6B)
