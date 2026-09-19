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

private val DarkColorScheme = lightColorScheme(
    primary = FaflowNavy,
    onPrimary = FaflowSurface,
    primaryContainer = FaflowDivider,
    onPrimaryContainer = FaflowNavy,
    secondary = FaflowTeal,
    onSecondary = FaflowSurface,
    tertiary = FaflowViolet,
    background = FaflowBg,
    onBackground = FaflowText1,
    surface = FaflowSurface,
    onSurface = FaflowText1,
    surfaceVariant = FaflowDivider,
    onSurfaceVariant = FaflowText2,
    outline = FaflowBorder,
    error = FaflowDanger,
    onError = FaflowSurface
)

private val LightColorScheme = lightColorScheme(
    primary = FaflowNavy,
    onPrimary = FaflowSurface,
    primaryContainer = FaflowDivider,
    onPrimaryContainer = FaflowNavy,
    secondary = FaflowTeal,
    onSecondary = FaflowSurface,
    tertiary = FaflowViolet,
    background = FaflowBg,
    onBackground = FaflowText1,
    surface = FaflowSurface,
    onSurface = FaflowText1,
    surfaceVariant = FaflowDivider,
    onSurfaceVariant = FaflowText2,
    outline = FaflowBorder,
    error = FaflowDanger,
    onError = FaflowSurface
)

@Composable
fun FAFLOWTheme(
    darkTheme: Boolean = false,
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit
) {
    val colorScheme = LightColorScheme

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as? Activity)?.window
            if (window != null) {
                window.statusBarColor = androidx.compose.ui.graphics.Color.Transparent.toArgb()
                window.navigationBarColor = androidx.compose.ui.graphics.Color.Transparent.toArgb()
                val controller = WindowCompat.getInsetsController(window, view)
                controller.isAppearanceLightStatusBars = !darkTheme
                controller.isAppearanceLightNavigationBars = !darkTheme
            }
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}