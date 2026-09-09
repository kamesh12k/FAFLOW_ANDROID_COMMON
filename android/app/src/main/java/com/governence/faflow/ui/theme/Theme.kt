package com.governence.faflow.ui.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val DarkColorScheme = darkColorScheme(
    primary = PrimaryBlueDark,
    onPrimary = TextPrimaryDark,
    primaryContainer = PrimaryBlue,
    onPrimaryContainer = TextPrimaryDark,
    secondary = SecondaryTeal,
    onSecondary = DarkBackground,
    tertiary = TertiaryEmerald,
    background = DarkBackground,
    onBackground = TextPrimaryDark,
    surface = DarkSurface,
    onSurface = TextPrimaryDark,
    surfaceVariant = DarkSurfaceVariant,
    onSurfaceVariant = TextSecondaryDark,
    outline = DarkBorder,
    error = StatusError,
    onError = TextPrimaryDark
)

private val LightColorScheme = lightColorScheme(
    primary = FaflowNavy,
    onPrimary = FaflowSurface,
    primaryContainer = FaflowNavyTint,
    onPrimaryContainer = FaflowNavy,
    secondary = FaflowTeal,
    onSecondary = FaflowSurface,
    tertiary = FaflowViolet,
    background = FaflowBg,
    onBackground = FaflowText1,
    surface = FaflowSurface,
    onSurface = FaflowText1,
    surfaceVariant = FaflowNavyTint,
    onSurfaceVariant = FaflowText2,
    outline = FaflowBorder,
    error = FaflowDanger,
    onError = FaflowSurface
)

@Composable
fun FAFLOWTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}