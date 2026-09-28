# Phase 4 Deliverable: Android Institutional Light Redesign

> **Milestone 16 · UI/UX Modernization**  
> Branch: `redesign/light-professional`  
> Target: Android Client Material 3 Institutional Light Interface with WCAG 2.2 AA Compliance

---

## 1. Overview & Objectives

Phase 4 harmonizes the FAFLOW Android application (Kotlin + Jetpack Compose + Material 3) with the single-source design tokens (`design/tokens/faflow_design_tokens.json`) established in Phase 2 and the web application redesigned in Phase 3.

Key objectives achieved:
- **100% Light Institutional Aesthetic**: Eliminated lingering dark/inconsistent surfaces in favor of a crisp, academic palette (`#F5F6F8` background, `#FFFFFF` surfaces, `#1B3A6B` institutional navy).
- **WCAG 2.2 AA Non-Text Contrast (SC 1.4.11)**: All interactive form controls, text fields, and borders meet or exceed $\ge 3:1$ contrast against their canvas by utilizing `FaflowBorderControl` (`#828C99`, contrast ratio 3.41:1 against white).
- **Material 3 Integration**: Configured `FaflowLightColorScheme` and `FaflowMaterialShapes` into `FAFLOWTheme`, complete with edge-to-edge transparent system bars and light status/navigation bar icons.
- **Shared Design System Components**: Standardized reusable UI primitives including `FaflowTextField`, `FaflowHeroCard`, `FaflowStatCard`, `FaflowListCard`, `FaflowListRow`, `FaflowIconButton`, and `FaflowHeaderLockup`.
- **Previews & Living Styleguide**: Added comprehensive Jetpack Compose `@Preview` composables in `ComponentPreviews.kt` for rapid visual verification in Android Studio.

---

## 2. Material 3 Theme Architecture

### A. Color Scheme & Tokens
The Android color system is generated directly from `design/tokens/faflow_design_tokens.json` via `scripts/generate_design_tokens.py`:

```kotlin
val FaflowLightColorScheme = lightColorScheme(
    primary = PrimaryNavy,             // #1B3A6B
    onPrimary = Color.White,
    primaryContainer = FaflowNavyTint, // #EAF0F9
    onPrimaryContainer = PrimaryNavy,
    secondary = SecondaryTeal,         // #0E8074
    onSecondary = Color.White,
    tertiary = TertiaryViolet,         // #6C4FCE
    background = FaflowBg,             // #F5F6F8
    onBackground = FaflowText1,        // #1A1D21 (16.91:1 contrast)
    surface = FaflowSurface,           // #FFFFFF
    onSurface = FaflowText1,
    surfaceVariant = FaflowDivider,    // #EEF0F3
    onSurfaceVariant = FaflowText2,    // #5B6169 (6.25:1 contrast)
    outline = FaflowBorderControl,     // #828C99 (3.41:1 contrast)
    error = StatusError,               // #B02A2A
    onError = Color.White
)
```

### B. System Bar & Edge-to-Edge Configuration (`Theme.kt`)
`FAFLOWTheme` automatically configures Android system insets for a clean, borderless light appearance:
- `window.statusBarColor = Transparent`
- `window.navigationBarColor = Transparent`
- `controller.isAppearanceLightStatusBars = true` (dark status bar icons)
- `controller.isAppearanceLightNavigationBars = true` (dark navigation bar pill)

---

## 3. UI Component Enhancements (`DesignSystemComponents.kt`)

### A. Accessible Input Fields (`FaflowTextField`)
To eliminate low-contrast text fields that failed WCAG 2.2 AA SC 1.4.11 ($< 2:1$), `FaflowTextField` was engineered with:
- **Shape**: 10dp rounded corners (`FaflowShapes.input`).
- **Unfocused Border**: `FaflowBorderControl` (`#828C99`), guaranteeing 3.41:1 contrast on white and 3.15:1 on `#F5F6F8`.
- **Focused Border**: `PrimaryNavy` (`#1B3A6B`) with 11.27:1 contrast.
- **Placeholder**: `FaflowTextMuted` (`#667085`) with 4.97:1 contrast.
- **Error State**: `StatusError` (`#B02A2A`) border and descriptive inline error text.

### B. Institutional Hero & Metric Cards
- **`FaflowHeroCard`**: Used across Dashboard and Attendance screens. Features an institutional navy tint (`#EAF0F9`), white icon container with 11dp radius, bold uppercase category eyebrow, and clear primary headline.
- **`FaflowStatCard`**: 2-column metric cards with 13dp radius, tinted icon badge, 26sp bold number, and tokenized secondary labels.
- **`FaflowListCard` & `FaflowListRow`**: White card container with 13dp radius, 34dp rounded icon box, and `#EEF0F3` dividers.

---

## 4. Screen-Level Contrast & UX Updates

1. **`LoginScreen.kt`**:
   - Replaced faint `FaflowBorder` on username and password input fields with `FaflowBorderControl`.
   - Enforced pure white container fill (`FaflowSurface`) for input fields, ensuring maximum contrast against canvas `#F5F6F8`.
   - Updated login button and forgot password links to use institutional `PrimaryNavy` (`#1B3A6B`).

2. **`StudentAttendanceScreen.kt`**:
   - Replaced hardcoded low-contrast `Color(0xFFCBD5E1)` on absent roll number inputs with tokenized `FaflowBorderControl`.
   - Updated student search input border to `FaflowBorderControl`.
   - Harmonized summary chips with institutional status colors (`StatusSuccess`, `StatusWarning`, `StatusError`).

3. **`SettingsScreen.kt`**:
   - Upgraded API endpoint input field to use `FaflowBorderControl` for clear accessibility.
   - Cleaned up preference list rows with `FaflowDivider` (`#EEF0F3`) and high-contrast toggle tracks.

---

## 5. Verification & Test Suite Results

All unit tests and compilation pipelines pass with zero warnings or contract drift:

| Gate | Command | Result |
|---|---|---|
| **Design Token Verification** | `python scripts/generate_design_tokens.py --check` | **PASS** (No drift) |
| **Token Contrast Ratios** | `python scripts/test_design_tokens_contrast.py` | **PASS** (34/34 checks passed) |
| **Android Unit Tests** | `.\gradlew.bat testDebugUnitTest --no-daemon` | **PASS** (26 tasks executed, 0 failures) |
| **Android Debug Build** | `.\gradlew.bat assembleDebug --no-daemon` | **BUILD SUCCESSFUL** (APK generated) |
| **Contract Parity Gate** | `python scripts/ci_contract_check.py ...` | **PASS** (333/333 paths, 0 HIGH, 0 MEDIUM) |

---

## 6. Summary of Changed Files

- `android/app/src/main/java/com/governence/faflow/ui/components/DesignSystemComponents.kt`
- `android/app/src/main/java/com/governence/faflow/ui/components/ComponentPreviews.kt`
- `android/app/src/main/java/com/governence/faflow/ui/screens/LoginScreen.kt`
- `android/app/src/main/java/com/governence/faflow/ui/screens/SettingsScreen.kt`
- `android/app/src/main/java/com/governence/faflow/ui/screens/StudentAttendanceScreen.kt`
- `docs/redesign/04_ANDROID_REDESIGN.md`
