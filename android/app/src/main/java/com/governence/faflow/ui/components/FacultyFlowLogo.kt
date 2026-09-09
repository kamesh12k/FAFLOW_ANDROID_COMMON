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
    // Parse vector paths once in remember block
    val arrowPath = remember {
        PathParser().parsePathString("M 64 165 C 45 135 48 82 82 48 L 74 42 L 102 36 L 96 66 L 89 59 C 62 88 58 132 75 152 Z").toPath()
    }
    val leafPath = remember {
        PathParser().parsePathString("M 68 152 C 58 128 66 84 87 72 C 77 96 74 126 84 140 Z").toPath()
    }
    val leftBookPath = remember {
        PathParser().parsePathString("M 76 68 C 84 66 91 69 91 69 L 91 91 C 91 91 84 88 76 90 Z").toPath()
    }
    val rightBookPath = remember {
        PathParser().parsePathString("M 94 69 C 94 69 101 66 109 68 L 109 90 C 101 88 94 91 94 91 Z").toPath()
    }
    val facultyWavePath = remember {
        PathParser().parsePathString("M 65 178 C 65 178 78 140 102 118 C 114 107 122 88 126 73 C 132 84 139 74 144 63 C 150 74 158 64 167 52 C 176 44 179 46 181 48 C 173 60 162 68 155 76 C 138 95 106 122 75 186 Z").toPath()
    }
    val cyanWavePath = remember {
        PathParser().parsePathString("M 65 186 C 85 160 120 126 142 108 C 160 93 170 76 174 65 C 167 80 148 100 128 116 C 102 137 76 170 65 186 Z").toPath()
    }
    val greenWavePath = remember {
        PathParser().parsePathString("M 67 195 C 72 178 88 150 110 135 C 134 118 160 98 169 77 C 166 94 140 118 118 135 C 92 155 73 186 67 195 Z").toPath()
    }

    val blueGrad = Brush.linearGradient(
        colors = listOf(Color(0xFF0072BC), Color(0xFF0D3B66)),
        start = Offset(20f, 20f),
        end = Offset(100f, 180f)
    )
    val cyanGrad = Brush.linearGradient(
        colors = listOf(Color(0xFF0284C7), Color(0xFF0EA5E9), Color(0xFF10B981)),
        start = Offset(40f, 60f),
        end = Offset(160f, 120f)
    )
    val greenGrad = Brush.linearGradient(
        colors = listOf(Color(0xFF059669), Color(0xFF10B981), Color(0xFF34D399)),
        start = Offset(50f, 120f),
        end = Offset(170f, 60f)
    )

    Canvas(modifier = modifier.size(size)) {
        val scaleFactor = this.size.minDimension / 200f
        scale(scaleFactor, pivot = Offset.Zero) {
            // Main upward swooping arrow
            drawPath(arrowPath, brush = blueGrad)
            // Inner leaf curve
            drawPath(leafPath, color = Color(0xFF0284C7))
            // Open book symbol
            drawPath(leftBookPath, color = Color(0xFF14B8A6))
            drawPath(rightBookPath, color = Color(0xFF14B8A6))
            // Faculty head circles
            drawCircle(Color(0xFF1E4E79), radius = 7.5f, center = Offset(130f, 62f))
            drawCircle(Color(0xFF1C598A), radius = 8f, center = Offset(147f, 50f))
            drawCircle(Color(0xFF1A6296), radius = 9f, center = Offset(165f, 38f))
            // Ascending waves & ribbons
            drawPath(facultyWavePath, brush = blueGrad)
            drawPath(cyanWavePath, brush = cyanGrad)
            drawPath(greenWavePath, brush = greenGrad)
        }
    }
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
