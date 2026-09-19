package com.governence.faflow.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.governence.faflow.ui.theme.PrimaryBlue
import com.governence.faflow.ui.theme.SecondaryTeal

/**
 * FacultyFlowLogoMark
 * Faithfully reproduces the official FAFLOW brand emblem from the web app:
 * - Upward dynamic arrow
 * - Inner stream curve
 * - Open book icon
 * - Ascending faculty figures and flow waves
 */
@Composable
fun FacultyFlowLogoMark(
    modifier: Modifier = Modifier,
    size: Dp = 48.dp
) {
    androidx.compose.foundation.Image(
        painter = androidx.compose.ui.res.painterResource(id = com.governence.faflow.R.drawable.app_logo),
        contentDescription = "FAFLOW Logo",
        modifier = modifier
            .size(size)
            .clip(androidx.compose.foundation.shape.RoundedCornerShape(size * 0.22f)),
        contentScale = androidx.compose.ui.layout.ContentScale.Fit
    )
}

/**
 * Full FAFLOW Brand Header with official Mark, Title, and Subtitle
 */
@Composable
fun FacultyFlowBrandHeader(
    modifier: Modifier = Modifier,
    markSize: Dp = 56.dp
) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        FacultyFlowLogoMark(size = markSize)
        Spacer(modifier = Modifier.height(10.dp))
        Row(
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "FACULTY",
                style = MaterialTheme.typography.titleLarge.copy(
                    fontWeight = FontWeight.Black,
                    letterSpacing = 2.sp
                ),
                color = MaterialTheme.colorScheme.onBackground
            )
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                text = "FLOW",
                style = MaterialTheme.typography.titleLarge.copy(
                    fontWeight = FontWeight.Light,
                    letterSpacing = 3.sp
                ),
                color = PrimaryBlue
            )
        }
    }
}
