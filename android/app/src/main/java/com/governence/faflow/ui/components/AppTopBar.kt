package com.governence.faflow.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.governence.faflow.ui.theme.FaflowBg
import com.governence.faflow.ui.theme.FaflowBorder
import com.governence.faflow.ui.theme.FaflowText1
import com.governence.faflow.ui.theme.FaflowText3

@Composable
fun AppTopBar(
    title: String,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    role: String? = null,
    canNavigateBack: Boolean = false,
    onNavigateBack: () -> Unit = {},
    showBottomDivider: Boolean = true,
    actions: @Composable RowScope.() -> Unit = {}
) {
    Surface(
        color = FaflowBg,
        modifier = modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp)
                    .padding(horizontal = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (canNavigateBack) {
                    IconButton(
                        onClick = onNavigateBack,
                        modifier = Modifier.size(44.dp)
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back",
                            tint = FaflowText1
                        )
                    }
                } else {
                    Spacer(modifier = Modifier.width(12.dp))
                }

                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.Center
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = title,
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Bold,
                            color = FaflowText1,
                            letterSpacing = (-0.01).sp
                        )
                        if (role != null) {
                            Spacer(modifier = Modifier.width(8.dp))
                            RoleBadge(role = role)
                        }
                    }
                    if (subtitle != null) {
                        Text(
                            text = subtitle,
                            fontSize = 11.5.sp,
                            fontWeight = FontWeight.Medium,
                            color = FaflowText3,
                            lineHeight = 14.sp
                        )
                    }
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.End,
                    content = actions
                )
            }
            if (showBottomDivider) {
                HorizontalDivider(
                    thickness = 1.dp,
                    color = FaflowBorder
                )
            }
        }
    }
}
