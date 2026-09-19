package com.governence.faflow.ui.components

import androidx.compose.foundation.layout.RowScope
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

/**
 * Top bar for FacultyFlow institutional screens.
 * Delegated to unified AppTopBar for seamless visual parity and insets handling.
 */
@Composable
fun PremiumTopBar(
    title: String,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    role: String? = null,
    onNavigateBack: (() -> Unit)? = null,
    actions: @Composable (RowScope.() -> Unit)? = null
) {
    AppTopBar(
        title = title,
        modifier = modifier,
        subtitle = subtitle,
        role = role,
        canNavigateBack = onNavigateBack != null,
        onNavigateBack = { onNavigateBack?.invoke() },
        showBottomDivider = true,
        actions = { actions?.invoke(this) }
    )
}
