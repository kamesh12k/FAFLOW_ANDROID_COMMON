#!/usr/bin/env python3
"""
generate_design_tokens.py - Single-source generator for FAFLOW Design System Tokens.

Source of Truth: design/tokens/faflow_design_tokens.json

Outputs:
  1. frontend/src/tokens/designTokens.js       (ESM JavaScript Token Export)
  2. frontend/src/tokens/designTokens.css      (CSS Custom Properties :root)
  3. android/app/src/main/java/com/governence/faflow/ui/theme/FaflowDesignTokens.kt
  4. android/app/src/main/java/com/governence/faflow/ui/theme/Color.kt

Usage:
  python scripts/generate_design_tokens.py [--check]
"""
import os
import sys
import json
import re
import argparse

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
TOKEN_JSON_PATH = os.path.join(REPO_ROOT, "design", "tokens", "faflow_design_tokens.json")

JS_OUT_PATH = os.path.join(REPO_ROOT, "frontend", "src", "tokens", "designTokens.js")
CSS_OUT_PATH = os.path.join(REPO_ROOT, "frontend", "src", "tokens", "designTokens.css")
TAILWIND_OUT_PATH = os.path.join(REPO_ROOT, "frontend", "src", "tokens", "tailwindTheme.js")
KT_TOKENS_PATH = os.path.join(REPO_ROOT, "android", "app", "src", "main", "java", "com", "governence", "faflow", "ui", "theme", "FaflowDesignTokens.kt")
KT_COLOR_PATH = os.path.join(REPO_ROOT, "android", "app", "src", "main", "java", "com", "governence", "faflow", "ui", "theme", "Color.kt")


def resolve_ref(ref_str: str, data: dict):
    """Resolve a token reference like {primitive.color.navy.600}."""
    if not isinstance(ref_str, str) or not ref_str.startswith("{") or not ref_str.endswith("}"):
        return ref_str
    path = ref_str[1:-1].split(".")
    curr = data
    for part in path:
        if isinstance(curr, dict) and part in curr:
            curr = curr[part]
        else:
            return ref_str
    if isinstance(curr, str) and curr.startswith("{") and curr.endswith("}"):
        return resolve_ref(curr, data)
    return curr


def resolve_all_refs(obj, root_data):
    if isinstance(obj, dict):
        return {k: resolve_all_refs(v, root_data) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [resolve_all_refs(item, root_data) for item in obj]
    elif isinstance(obj, str):
        return resolve_ref(obj, root_data)
    return obj


def generate_js(raw_data, resolved):
    """Generate frontend/src/tokens/designTokens.js."""
    prim_colors = resolved["primitive"]["color"]
    sem_colors = resolved["semantic"]["color"]
    spacing = resolved["primitive"]["spacing"]
    radius = resolved["primitive"]["radius"]
    elevation = resolved["semantic"]["elevation"]
    charts = resolved["semantic"]["color"].get("charts", [])
    roles = resolved["semantic"]["color"]["roles"]
    status = resolved["semantic"]["color"]["status"]

    lines = [
        "/**",
        " * FAFLOW Unified Design System Tokens",
        " * AUTO-GENERATED from design/tokens/faflow_design_tokens.json",
        " * DO NOT EDIT DIRECTLY. Run: python scripts/generate_design_tokens.py",
        " */",
        "",
        "export const FaflowColors = {",
        "  // Brand Primitives",
    ]

    for palette_name, shades in prim_colors.items():
        if isinstance(shades, dict):
            lines.append(f"  {palette_name}: {{")
            for shade, hex_code in sorted(shades.items(), key=lambda x: str(x[0])):
                lines.append(f"    '{shade}': '{hex_code}',")
            lines.append("  },")

    lines.extend([
        "",
        "  // Semantic Surfaces & Neutrals",
        f"  bg: '{sem_colors['surface']['background']}',",
        f"  surface: '{sem_colors['surface']['card']}',",
        f"  surfaceHover: '{sem_colors['surface']['cardHover']}',",
        f"  sidebar: '{sem_colors['surface']['sidebar']}',",
        f"  sidebarBorder: '{sem_colors['surface']['sidebarBorder']}',",
        f"  sidebarActive: '{sem_colors['surface']['sidebarActive']}',",
        f"  sidebarActiveText: '{sem_colors['surface']['sidebarActiveText']}',",
        "",
        "  // Borders",
        f"  border: '{sem_colors['border']['default']}',",
        f"  borderDivider: '{sem_colors['border']['divider']}',",
        f"  borderControl: '{sem_colors['border']['control']}',",
        f"  borderFocus: '{sem_colors['border']['focus']}',",
        "",
        "  // Typography",
        f"  text1: '{sem_colors['text']['primary']}',",
        f"  text2: '{sem_colors['text']['secondary']}',",
        f"  textMuted: '{sem_colors['text']['muted']}',",
        f"  textInverse: '{sem_colors['text']['inverse']}',",
        f"  textBrand: '{sem_colors['text']['brand']}',",
        "",
        "  // Disabled & Skeletons",
        f"  disabledText: '{sem_colors['disabled']['text']}',",
        f"  disabledBg: '{sem_colors['disabled']['bg']}',",
        f"  disabledBorder: '{sem_colors['disabled']['border']}',",
        f"  skeletonBase: '{sem_colors['skeleton']['base']}',",
        f"  skeletonHighlight: '{sem_colors['skeleton']['highlight']}',",
        "};",
        "",
        "export const FaflowRoleColors = {",
    ])

    role_labels = {
        "teacher": "Faculty / Teacher",
        "hod": "Head of Department (HOD)",
        "principal": "Principal / Dean",
        "governance": "Governance Control",
        "manager": "Operational Manager",
        "staff": "Support & Lab Staff",
    }
    for role_key, role_vals in roles.items():
        label = role_labels.get(role_key, role_key.capitalize())
        lines.append(
            f"  {role_key}: {{ primary: '{role_vals['primary']}', bg: '{role_vals['bg']}', border: '{role_vals.get('border', role_vals['bg'])}', label: '{label}' }},"
        )
    lines.append("};")
    lines.append("")

    lines.extend([
        "export const FaflowStatusColors = {",
        f"  success: {{ text: '{status['success']['text']}', bg: '{status['success']['bg']}', border: '{status['success']['border']}' }},",
        f"  warning: {{ text: '{status['warning']['text']}', bg: '{status['warning']['bg']}', border: '{status['warning']['border']}' }},",
        f"  error: {{ text: '{status['error']['text']}', bg: '{status['error']['bg']}', border: '{status['error']['border']}' }},",
        f"  info: {{ text: '{status['info']['text']}', bg: '{status['info']['bg']}', border: '{status['info']['border']}' }},",
        f"  neutral: {{ text: '{status['neutral']['text']}', bg: '{status['neutral']['bg']}', border: '{status['neutral']['border']}' }},",
        "};",
        "",
        f"export const FaflowCharts = {json.dumps(charts, indent=2)};",
        "",
        f"export const FaflowSpacing = {json.dumps(spacing, indent=2)};",
        "",
        f"export const FaflowRadius = {json.dumps(radius, indent=2)};",
        "",
        f"export const FaflowElevation = {json.dumps(elevation, indent=2)};",
        "",
    ])

    return "\n".join(lines) + "\n"


def generate_css(raw_data, resolved):
    """Generate frontend/src/tokens/designTokens.css."""
    prim_colors = resolved["primitive"]["color"]
    sem_colors = resolved["semantic"]["color"]
    elevation = resolved["semantic"]["elevation"]

    lines = [
        "/**",
        " * FAFLOW Unified Design System CSS Custom Properties",
        " * AUTO-GENERATED from design/tokens/faflow_design_tokens.json",
        " * DO NOT EDIT DIRECTLY. Run: python scripts/generate_design_tokens.py",
        " */",
        ":root {",
    ]

    for pal_name, shades in prim_colors.items():
        if isinstance(shades, dict):
            for shade, hex_code in shades.items():
                lines.append(f"  --faflow-{pal_name}-{shade}: {hex_code};")

    lines.extend([
        "",
        f"  --color-primary: {sem_colors['brand']['primary']};",
        f"  --color-primary-light: {sem_colors['brand']['primaryLight']};",
        f"  --color-primary-tint: {sem_colors['brand']['primaryTint']};",
        f"  --color-secondary: {sem_colors['brand']['secondary']};",
        f"  --color-secondary-tint: {sem_colors['brand']['secondaryTint']};",
        f"  --color-tertiary: {sem_colors['brand']['tertiary']};",
        f"  --color-tertiary-tint: {sem_colors['brand']['tertiaryTint']};",
        f"  --color-accent: {sem_colors['brand']['accent']};",
        f"  --color-accent-tint: {sem_colors['brand']['accentTint']};",
        "",
        f"  --color-bg: {sem_colors['surface']['background']};",
        f"  --color-card: {sem_colors['surface']['card']};",
        f"  --color-card-hover: {sem_colors['surface']['cardHover']};",
        f"  --color-sidebar: {sem_colors['surface']['sidebar']};",
        f"  --color-sidebar-border: {sem_colors['surface']['sidebarBorder']};",
        f"  --color-sidebar-active: {sem_colors['surface']['sidebarActive']};",
        f"  --color-sidebar-active-text: {sem_colors['surface']['sidebarActiveText']};",
        "",
        f"  --color-text-primary: {sem_colors['text']['primary']};",
        f"  --color-text-secondary: {sem_colors['text']['secondary']};",
        f"  --color-text-muted: {sem_colors['text']['muted']};",
        f"  --color-text-inverse: {sem_colors['text']['inverse']};",
        "",
        f"  --color-border-default: {sem_colors['border']['default']};",
        f"  --color-border-divider: {sem_colors['border']['divider']};",
        f"  --color-border-control: {sem_colors['border']['control']};",
        f"  --color-border-focus: {sem_colors['border']['focus']};",
        "",
        f"  --color-status-success-text: {sem_colors['status']['success']['text']};",
        f"  --color-status-success-bg: {sem_colors['status']['success']['bg']};",
        f"  --color-status-success-border: {sem_colors['status']['success']['border']};",
        f"  --color-status-warning-text: {sem_colors['status']['warning']['text']};",
        f"  --color-status-warning-bg: {sem_colors['status']['warning']['bg']};",
        f"  --color-status-warning-border: {sem_colors['status']['warning']['border']};",
        f"  --color-status-error-text: {sem_colors['status']['error']['text']};",
        f"  --color-status-error-bg: {sem_colors['status']['error']['bg']};",
        f"  --color-status-error-border: {sem_colors['status']['error']['border']};",
        f"  --color-status-info-text: {sem_colors['status']['info']['text']};",
        f"  --color-status-info-bg: {sem_colors['status']['info']['bg']};",
        f"  --color-status-info-border: {sem_colors['status']['info']['border']};",
        "",
        f"  --shadow-sm: {elevation['sm']};",
        f"  --shadow-card: {elevation['card']};",
        f"  --shadow-card-hover: {elevation['cardHover']};",
        f"  --shadow-raised: {elevation['raised']};",
        f"  --shadow-dialog: {elevation['dialog']};",
        "}",
        "",
    ])

    return "\n".join(lines)


def generate_kt_color(resolved):
    """Generate android Color.kt."""
    sem = resolved["semantic"]["color"]
    prim = resolved["primitive"]["color"]

    return f"""package com.governence.faflow.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * FAFLOW Core Color Palette
 * AUTO-GENERATED from design/tokens/faflow_design_tokens.json
 * DO NOT EDIT DIRECTLY. Run: python scripts/generate_design_tokens.py
 */

// Global Brand Palette
val PrimaryNavy = Color(0xFF{prim['navy']['600'].lstrip('#')})
val PrimaryNavyLight = Color(0xFF{prim['navy']['500'].lstrip('#')})
val SecondaryTeal = Color(0xFF{prim['teal']['600'].lstrip('#')})
val TertiaryViolet = Color(0xFF{prim['violet']['500'].lstrip('#')})
val AccentGold = Color(0xFF{prim['gold']['600'].lstrip('#')})
val AccentGoldDark = Color(0xFF{prim['gold']['700'].lstrip('#')})

// Status Colors (WCAG 2.2 AA Verified)
val StatusSuccess = Color(0xFF{sem['status']['success']['text'].lstrip('#')})
val StatusSuccessBg = Color(0xFF{sem['status']['success']['bg'].lstrip('#')})
val StatusSuccessBorder = Color(0xFF{sem['status']['success']['border'].lstrip('#')})

val StatusWarning = Color(0xFF{sem['status']['warning']['text'].lstrip('#')})
val StatusWarningBg = Color(0xFF{sem['status']['warning']['bg'].lstrip('#')})
val StatusWarningBorder = Color(0xFF{sem['status']['warning']['border'].lstrip('#')})

val StatusError = Color(0xFF{sem['status']['error']['text'].lstrip('#')})
val StatusErrorBg = Color(0xFF{sem['status']['error']['bg'].lstrip('#')})
val StatusErrorBorder = Color(0xFF{sem['status']['error']['border'].lstrip('#')})

val StatusInfo = Color(0xFF{sem['status']['info']['text'].lstrip('#')})
val StatusInfoBg = Color(0xFF{sem['status']['info']['bg'].lstrip('#')})
val StatusInfoBorder = Color(0xFF{sem['status']['info']['border'].lstrip('#')})

// Surfaces & Neutral Layout Colors (Light Theme Institutional)
val FaflowBg = Color(0xFF{sem['surface']['background'].lstrip('#')})
val FaflowSurface = Color(0xFF{sem['surface']['card'].lstrip('#')})
val FaflowSurfaceHover = Color(0xFF{sem['surface']['cardHover'].lstrip('#')})
val FaflowBorder = Color(0xFF{sem['border']['default'].lstrip('#')})
val FaflowBorderControl = Color(0xFF{sem['border']['control'].lstrip('#')})
val FaflowDivider = Color(0xFF{sem['border']['divider'].lstrip('#')})

// Typography Hierarchy (WCAG 2.2 AA Verified)
val FaflowText1 = Color(0xFF{sem['text']['primary'].lstrip('#')})
val FaflowText2 = Color(0xFF{sem['text']['secondary'].lstrip('#')})
val FaflowTextMuted = Color(0xFF{sem['text']['muted'].lstrip('#')})
val FaflowText3 = FaflowTextMuted // Backwards compatibility alias
val FaflowTextInverse = Color(0xFF{sem['text']['inverse'].lstrip('#')})

// Navy Tints
val FaflowNavy = PrimaryNavy
val FaflowNavyLight = PrimaryNavyLight
val FaflowNavyTint = Color(0xFF{prim['navy']['50'].lstrip('#')})

// Teal Tints
val FaflowTeal = SecondaryTeal
val FaflowTealTint = Color(0xFF{prim['teal']['50'].lstrip('#')})

// Violet Tints
val FaflowViolet = TertiaryViolet
val FaflowVioletTint = Color(0xFF{prim['violet']['50'].lstrip('#')})

// Gold Tints
val FaflowGold = AccentGold
val FaflowGoldDark = AccentGoldDark
val FaflowGoldTint = Color(0xFF{prim['gold']['50'].lstrip('#')})

// Slate Tints
val FaflowSlate = Color(0xFF{prim['slate']['600'].lstrip('#')})
val FaflowSlateTint = Color(0xFF{prim['slate']['100'].lstrip('#')})

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
"""


def generate_kt_tokens(resolved):
    """Generate android FaflowDesignTokens.kt."""
    sem = resolved["semantic"]["color"]
    roles = sem["roles"]
    status = sem["status"]

    return f"""package com.governence.faflow.ui.theme

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
object FaflowSpacing {{
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
}}

object FaflowShapes {{
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
}}

val FaflowMaterialShapes = Shapes(
    small = FaflowShapes.small,
    medium = FaflowShapes.medium,
    large = FaflowShapes.card
)

object FaflowDimensions {{
    val minTouchTarget: Dp = 48.dp
    val iconXs: Dp = 14.dp
    val iconSm: Dp = 16.dp
    val iconMd: Dp = 20.dp
    val iconLg: Dp = 24.dp
    val iconXl: Dp = 32.dp
    val avatarSm: Dp = 32.dp
    val avatarMd: Dp = 40.dp
    val avatarLg: Dp = 56.dp
}}

object FaflowElevation {{
    val flat: Dp = 0.dp
    val card: Dp = 1.dp
    val raised: Dp = 3.dp
    val dialog: Dp = 6.dp
    val sheet: Dp = 8.dp
}}

object FaflowRoleColors {{
    val TeacherPrimary = Color(0xFF{roles['teacher']['primary'].lstrip('#')})
    val TeacherBackground = Color(0xFF{roles['teacher']['bg'].lstrip('#')})
    val HodPrimary = Color(0xFF{roles['hod']['primary'].lstrip('#')})
    val HodBackground = Color(0xFF{roles['hod']['bg'].lstrip('#')})
    val PrincipalPrimary = Color(0xFF{roles['principal']['primary'].lstrip('#')})
    val PrincipalBackground = Color(0xFF{roles['principal']['bg'].lstrip('#')})
    val GovernancePrimary = Color(0xFF{roles['governance']['primary'].lstrip('#')})
    val GovernanceBackground = Color(0xFF{roles['governance']['bg'].lstrip('#')})
    val ManagerPrimary = Color(0xFF{roles['manager']['primary'].lstrip('#')})
    val ManagerBackground = Color(0xFF{roles['manager']['bg'].lstrip('#')})
    val StaffPrimary = Color(0xFF{roles['staff']['primary'].lstrip('#')})
    val StaffBackground = Color(0xFF{roles['staff']['bg'].lstrip('#')})
}}

object FaflowStatusColors {{
    val Approved = Color(0xFF{status['success']['text'].lstrip('#')})
    val ApprovedBg = Color(0xFF{status['success']['bg'].lstrip('#')})
    val Pending = Color(0xFF{status['warning']['text'].lstrip('#')})
    val PendingBg = Color(0xFF{status['warning']['bg'].lstrip('#')})
    val Rejected = Color(0xFF{status['error']['text'].lstrip('#')})
    val RejectedBg = Color(0xFF{status['error']['bg'].lstrip('#')})
    val Cancelled = Color(0xFF{status['neutral']['text'].lstrip('#')})
    val CancelledBg = Color(0xFF{status['neutral']['bg'].lstrip('#')})

    val WorkingDay = PrimaryNavy
    val Holiday = Color(0xFFEA580C)
    val HolidayBg = Color(0xFFFFF7ED)
}}

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
"""


def generate_tailwind_theme(resolved):
    """Generate frontend/src/tokens/tailwindTheme.js."""
    prim = resolved["primitive"]["color"]
    sem = resolved["semantic"]["color"]
    elevation = resolved["semantic"]["elevation"]

    return f"""/**
 * FAFLOW Tailwind Extended Theme Configuration
 * AUTO-GENERATED from design/tokens/faflow_design_tokens.json
 * DO NOT EDIT DIRECTLY. Run: python scripts/generate_design_tokens.py
 */

export const faflowTailwindTheme = {{
  colors: {{
    brand: {{
      navy: {json.dumps(prim['navy'], indent=8).strip()},
      teal: {json.dumps(prim['teal'], indent=8).strip()},
      violet: {json.dumps(prim['violet'], indent=8).strip()},
      gold: {json.dumps(prim['gold'], indent=8).strip()},
      slate: {json.dumps(prim['slate'], indent=8).strip()},
    }},
    surface: {{
      DEFAULT: '{sem['surface']['background']}',
      card: '{sem['surface']['card']}',
      cardHover: '{sem['surface']['cardHover']}',
      sidebar: '{sem['surface']['sidebar']}',
      sidebarBorder: '{sem['surface']['sidebarBorder']}',
      sidebarActive: '{sem['surface']['sidebarActive']}',
      sidebarActiveText: '{sem['surface']['sidebarActiveText']}',
    }},
    control: {{
      border: '{sem['border']['control']}',
      focus: '{sem['border']['focus']}',
    }},
  }},
  boxShadow: {{
    'card': '{elevation['card']}',
    'card-hover': '{elevation['cardHover']}',
    'raised': '{elevation['raised']}',
    'dialog': '{elevation['dialog']}',
  }}
}};
"""


def main():
    parser = argparse.ArgumentParser(description="FAFLOW Design Token Single-Source Generator")
    parser.add_argument("--check", action="store_true", help="Check committed files against generated output; fail on drift")
    args = parser.parse_args()

    print("=" * 60)
    print("FAFLOW Design System Token Generator")
    print("=" * 60)

    if not os.path.exists(TOKEN_JSON_PATH):
        print(f"[FAIL] Token source file not found: {TOKEN_JSON_PATH}")
        sys.exit(1)

    with open(TOKEN_JSON_PATH, "r", encoding="utf-8") as f:
        raw_data = json.load(f)

    resolved = resolve_all_refs(raw_data, raw_data)

    target_files = {
        JS_OUT_PATH: generate_js(raw_data, resolved),
        CSS_OUT_PATH: generate_css(raw_data, resolved),
        TAILWIND_OUT_PATH: generate_tailwind_theme(resolved),
        KT_COLOR_PATH: generate_kt_color(resolved),
        KT_TOKENS_PATH: generate_kt_tokens(resolved),
    }

    if args.check:
        drift_detected = False
        for path, generated_content in target_files.items():
            if not os.path.exists(path):
                print(f"[FAIL] Target file does not exist: {path}")
                drift_detected = True
                continue
            with open(path, "r", encoding="utf-8") as f:
                existing = f.read()
            # Normalize CRLF / LF for comparison
            if existing.replace("\r\n", "\n") != generated_content.replace("\r\n", "\n"):
                print(f"[FAIL] Drift detected in: {os.path.relpath(path, REPO_ROOT)}")
                drift_detected = True
            else:
                print(f"[PASS] In-sync: {os.path.relpath(path, REPO_ROOT)}")

        if drift_detected:
            print("\n[ERROR] Design token drift detected! Run: python scripts/generate_design_tokens.py")
            sys.exit(1)
        print("\n[SUCCESS] All design token files match design/tokens/faflow_design_tokens.json.")
        sys.exit(0)

    for path, content in target_files.items():
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            f.write(content)
        print(f"[INFO] Wrote: {os.path.relpath(path, REPO_ROOT)}")

    print("[SUCCESS] All token files generated from faflow_design_tokens.json successfully.")


if __name__ == "__main__":
    main()
