package com.governence.faflow.ui.screens

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.governence.faflow.ui.components.FaflowLogoMark
import com.governence.faflow.ui.theme.FaflowDivider
import com.governence.faflow.ui.theme.FaflowNavy
import com.governence.faflow.ui.theme.FaflowText3
import kotlinx.coroutines.delay

@Composable
fun SplashScreen(
    isLoggedIn: Boolean = false,
    onNavigateToLogin: () -> Unit,
    onNavigateToDashboard: () -> Unit
) {
    LaunchedEffect(isLoggedIn) {
        if (isLoggedIn) {
            onNavigateToDashboard()
        } else {
            onNavigateToLogin()
        }
    }

    val transition = rememberInfiniteTransition(label = "loadbar")
    val slideOffset by transition.animateFloat(
        initialValue = -50f,
        targetValue = 130f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1100, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "slide"
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.White),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.padding(24.dp)
        ) {
            // Big Logo Mark (76x76dp, 18dp radius)
            FaflowLogoMark(size = 76.dp, cornerRadius = 18.dp)

            Spacer(modifier = Modifier.height(22.dp))

            // Brand Text
            Text(
                text = "A GOVERNANCE PRODUCT",
                fontSize = 10.5.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.16.sp,
                color = FaflowText3
            )

            Spacer(modifier = Modifier.height(6.dp))

            Text(
                text = "FAFLOW",
                fontSize = 30.sp,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = (-0.02).sp,
                color = FaflowNavy
            )

            Spacer(modifier = Modifier.height(10.dp))

            Text(
                text = "Faculty Operations Platform",
                fontSize = 12.sp,
                color = FaflowText3
            )

            Spacer(modifier = Modifier.height(30.dp))

            // Loadbar (120px x 3px, divider track, navy sliding bar)
            Box(
                modifier = Modifier
                    .width(120.dp)
                    .height(3.dp)
                    .clip(RoundedCornerShape(3.dp))
                    .background(FaflowDivider)
            ) {
                Box(
                    modifier = Modifier
                        .offset(x = slideOffset.dp)
                        .width(46.dp)
                        .height(3.dp)
                        .clip(RoundedCornerShape(3.dp))
                        .background(FaflowNavy)
                )
            }
        }
    }
}
