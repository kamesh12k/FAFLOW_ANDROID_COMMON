package com.governence.faflow.ui.screens

import android.widget.Toast
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.isImeVisible
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AlternateEmail
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Dns
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.airbnb.lottie.compose.LottieAnimation
import com.airbnb.lottie.compose.LottieCompositionSpec
import com.airbnb.lottie.compose.LottieConstants
import com.airbnb.lottie.compose.animateLottieCompositionAsState
import com.airbnb.lottie.compose.rememberLottieComposition
import com.governence.faflow.R
import com.governence.faflow.auth.ui.AuthUiState
import com.governence.faflow.auth.ui.AuthViewModel
import com.governence.faflow.core.network.FaflowApiClient
import com.governence.faflow.ui.components.FacultyFlowBrandHeader
import com.governence.faflow.ui.components.FaflowLogoMark
import com.governence.faflow.ui.components.FaflowPillButton
import com.governence.faflow.ui.components.FaflowStatusBadge
import com.governence.faflow.ui.components.FaflowSurface
import com.governence.faflow.ui.theme.PrimaryBlue
import com.governence.faflow.ui.theme.SecondaryTeal
import com.governence.faflow.ui.theme.StatusError
import com.governence.faflow.ui.theme.StatusSuccess
import kotlinx.coroutines.delay

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ElevatedCard
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun LoginScreen(
    authViewModel: AuthViewModel,
    onLoginSuccess: () -> Unit
) {
    val context = LocalContext.current
    val focusManager = LocalFocusManager.current
    val uiState by authViewModel.uiState.collectAsState()
    val isDark = isSystemInDarkTheme()

    var identifier by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    var isInputFocused by remember { mutableStateOf(false) }
    var showServerConfigDialog by remember { mutableStateOf(false) }
    var serverUrlInput by remember { mutableStateOf(FaflowApiClient.baseUrl) }

    // Adaptive height based on soft keyboard state
    val isImeOpen = WindowInsets.isImeVisible
    val lottieHeight by animateDpAsState(
        targetValue = if (isImeOpen) 70.dp else 150.dp,
        animationSpec = tween(durationMillis = 260),
        label = "lottieHeight"
    )

    // Local Lottie asset loading (zero network latency, 100% offline reliability)
    val compositionResult = rememberLottieComposition(
        LottieCompositionSpec.RawRes(R.raw.lottie_login)
    )
    val composition by compositionResult

    // Dynamic animation playback state
    val isAuthenticating = uiState is AuthUiState.Loading
    val isAuthenticated = uiState is AuthUiState.Authenticated

    val animationSpeed = when {
        isAuthenticated -> 2.0f
        isAuthenticating -> 1.5f
        isInputFocused -> 1.1f
        else -> 0.85f
    }

    val lottieProgress by animateLottieCompositionAsState(
        composition = composition,
        iterations = if (isAuthenticated) 1 else LottieConstants.IterateForever,
        speed = animationSpeed,
        isPlaying = true
    )

    // Graceful login success transition delay for smooth UX
    LaunchedEffect(uiState) {
        if (uiState is AuthUiState.Authenticated) {
            delay(400)
            onLoginSuccess()
        }
    }

    val backgroundBrush = if (isDark) {
        Brush.verticalGradient(
            colors = listOf(
                Color(0xFF0F172A),
                Color(0xFF090D16),
                Color(0xFF020617)
            )
        )
    } else {
        Brush.verticalGradient(
            colors = listOf(
                Color(0xFFEEF2FF), // Subtle soft indigo atmospheric tint
                Color(0xFFF1F5F9), // Slate 100
                Color(0xFFF8FAFC)  // Slate 50
            )
        )
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.White)
    ) {
        Scaffold(
            containerColor = Color.White,
            contentWindowInsets = WindowInsets(0, 0, 0, 0)
        ) { innerPadding ->
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .imePadding()
                    .padding(horizontal = 30.dp)
                    .verticalScroll(rememberScrollState()),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Spacer(modifier = Modifier.height(if (isImeOpen) 24.dp else 52.dp))

                // 56x56dp Navy Logo Mark (14dp radius) with white checkmark
                FaflowLogoMark(size = 56.dp, cornerRadius = 14.dp)

                Spacer(modifier = Modifier.height(20.dp))

                Text(
                    text = "GOVERNANCE",
                    fontSize = 10.5.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.14.sp,
                    color = com.governence.faflow.ui.theme.FaflowText3
                )

                Text(
                    text = "FAFLOW",
                    fontSize = 28.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = (-0.02).sp,
                    color = com.governence.faflow.ui.theme.FaflowNavy
                )

                Spacer(modifier = Modifier.height(6.dp))

                Text(
                    text = "Sign in to manage attendance, schedules\nand substitution duties",
                    fontSize = 12.5.sp,
                    color = com.governence.faflow.ui.theme.FaflowText2,
                    textAlign = TextAlign.Center,
                    lineHeight = 18.sp
                )

                Spacer(modifier = Modifier.height(28.dp))

                // Error Banner
                AnimatedVisibility(
                    visible = uiState is AuthUiState.Error,
                    enter = fadeIn() + scaleIn(),
                    exit = fadeOut() + scaleOut()
                ) {
                    if (uiState is AuthUiState.Error) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 14.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(com.governence.faflow.ui.theme.FaflowDanger.copy(alpha = 0.1f))
                                .border(1.dp, com.governence.faflow.ui.theme.FaflowDanger.copy(alpha = 0.3f), RoundedCornerShape(10.dp))
                                .padding(10.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = (uiState as AuthUiState.Error).message,
                                fontSize = 12.sp,
                                color = com.governence.faflow.ui.theme.FaflowDanger,
                                fontWeight = FontWeight.SemiBold,
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                }

                // Field 1: Institutional email
                Column(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = "Institutional email",
                        fontSize = 11.5.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = com.governence.faflow.ui.theme.FaflowText2
                    )
                    Spacer(modifier = Modifier.height(7.dp))
                    OutlinedTextField(
                        value = identifier,
                        onValueChange = {
                            identifier = it
                            authViewModel.clearError()
                        },
                        placeholder = {
                            Text(
                                text = "rekha.devi@college.edu",
                                fontSize = 14.sp,
                                color = com.governence.faflow.ui.theme.FaflowText3
                            )
                        },
                        leadingIcon = {
                            Icon(
                                imageVector = Icons.Default.AlternateEmail,
                                contentDescription = null,
                                tint = com.governence.faflow.ui.theme.FaflowText3,
                                modifier = Modifier.size(16.dp)
                            )
                        },
                        singleLine = true,
                        shape = RoundedCornerShape(10.dp),
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Email,
                            imeAction = ImeAction.Next
                        ),
                        keyboardActions = KeyboardActions(
                            onNext = { focusManager.moveFocus(FocusDirection.Down) }
                        ),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = Color.White,
                            unfocusedContainerColor = Color(0xFFFCFCFD),
                            focusedBorderColor = com.governence.faflow.ui.theme.FaflowNavy,
                            unfocusedBorderColor = com.governence.faflow.ui.theme.FaflowBorder,
                            focusedTextColor = com.governence.faflow.ui.theme.FaflowText1,
                            unfocusedTextColor = com.governence.faflow.ui.theme.FaflowText1
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .onFocusChanged { isInputFocused = it.isFocused }
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Field 2: Password
                Column(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = "Password",
                        fontSize = 11.5.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = com.governence.faflow.ui.theme.FaflowText2
                    )
                    Spacer(modifier = Modifier.height(7.dp))
                    OutlinedTextField(
                        value = password,
                        onValueChange = {
                            password = it
                            authViewModel.clearError()
                        },
                        placeholder = {
                            Text(
                                text = "Enter your password",
                                fontSize = 14.sp,
                                color = com.governence.faflow.ui.theme.FaflowText3
                            )
                        },
                        leadingIcon = {
                            Icon(
                                imageVector = Icons.Default.Lock,
                                contentDescription = null,
                                tint = com.governence.faflow.ui.theme.FaflowText3,
                                modifier = Modifier.size(16.dp)
                            )
                        },
                        trailingIcon = {
                            IconButton(onClick = { passwordVisible = !passwordVisible }) {
                                Icon(
                                    imageVector = if (passwordVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                                    contentDescription = if (passwordVisible) "Hide" else "Show",
                                    tint = com.governence.faflow.ui.theme.FaflowText3,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                        },
                        singleLine = true,
                        visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                        shape = RoundedCornerShape(10.dp),
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Password,
                            imeAction = ImeAction.Done
                        ),
                        keyboardActions = KeyboardActions(
                            onDone = {
                                focusManager.clearFocus()
                                if (identifier.isNotBlank() && password.isNotBlank()) {
                                    authViewModel.login(identifier, password)
                                }
                            }
                        ),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = Color.White,
                            unfocusedContainerColor = Color(0xFFFCFCFD),
                            focusedBorderColor = com.governence.faflow.ui.theme.FaflowNavy,
                            unfocusedBorderColor = com.governence.faflow.ui.theme.FaflowBorder,
                            focusedTextColor = com.governence.faflow.ui.theme.FaflowText1,
                            unfocusedTextColor = com.governence.faflow.ui.theme.FaflowText1
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .onFocusChanged { isInputFocused = it.isFocused }
                    )
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Sign In Button
                Button(
                    onClick = {
                        focusManager.clearFocus()
                        if (identifier.isBlank() || password.isBlank()) {
                            Toast.makeText(context, "Please enter both credentials", Toast.LENGTH_SHORT).show()
                        } else {
                            authViewModel.login(identifier, password)
                        }
                    },
                    enabled = !isAuthenticating,
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = com.governence.faflow.ui.theme.FaflowNavy,
                        contentColor = Color.White,
                        disabledContainerColor = com.governence.faflow.ui.theme.FaflowNavy.copy(alpha = 0.5f)
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                        .shadow(4.dp, RoundedCornerShape(10.dp), spotColor = com.governence.faflow.ui.theme.FaflowNavy.copy(alpha = 0.22f))
                ) {
                    if (isAuthenticating) {
                        CircularProgressIndicator(
                            color = Color.White,
                            strokeWidth = 2.5.dp,
                            modifier = Modifier.size(20.dp)
                        )
                    } else {
                        Text(
                            text = "Sign in",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                // Demo links (Faculty demo, Admin demo, HOD demo)
                Row(
                    horizontalArrangement = Arrangement.spacedBy(20.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Faculty demo
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.clickable {
                            identifier = "rekha.devi@college.edu"
                            password = "Password123"
                            authViewModel.clearError()
                        }
                    ) {
                        Text(
                            text = "Faculty demo",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = com.governence.faflow.ui.theme.FaflowText2
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Box(
                            modifier = Modifier
                                .width(70.dp)
                                .height(1.5.dp)
                                .background(com.governence.faflow.ui.theme.FaflowBorder)
                        )
                    }

                    // Admin demo
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.clickable {
                            identifier = "admin"
                            password = "admin"
                            authViewModel.clearError()
                        }
                    ) {
                        Text(
                            text = "Admin demo",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = com.governence.faflow.ui.theme.FaflowText2
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Box(
                            modifier = Modifier
                                .width(65.dp)
                                .height(1.5.dp)
                                .background(com.governence.faflow.ui.theme.FaflowBorder)
                        )
                    }

                    // HOD demo
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.clickable {
                            identifier = "hod_ece"
                            password = "Password123"
                            authViewModel.clearError()
                        }
                    ) {
                        Text(
                            text = "HOD demo",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = com.governence.faflow.ui.theme.FaflowText2
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Box(
                            modifier = Modifier
                                .width(56.dp)
                                .height(1.5.dp)
                                .background(com.governence.faflow.ui.theme.FaflowBorder)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(36.dp))

                // Server status indicator
                Row(
                    modifier = Modifier
                        .clickable {
                            serverUrlInput = FaflowApiClient.baseUrl
                            showServerConfigDialog = true
                        }
                        .padding(vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center
                ) {
                    Box(
                        modifier = Modifier
                            .size(6.dp)
                            .clip(CircleShape)
                            .background(com.governence.faflow.ui.theme.FaflowSuccess)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "Connected — ${FaflowApiClient.baseUrl.removePrefix("http://").removePrefix("https://").trimEnd('/')}",
                        fontSize = 10.5.sp,
                        fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
                        color = com.governence.faflow.ui.theme.FaflowText3
                    )
                }

                Spacer(modifier = Modifier.height(28.dp))
            }
        }
    }

    // Backend Server URL Configuration Modal
    if (showServerConfigDialog) {
        AlertDialog(
            onDismissRequest = { showServerConfigDialog = false },
            title = {
                Text(
                    text = "Backend Server URL",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            },
            text = {
                Column {
                    Text(
                        text = "Configure your FAFLOW FastAPI backend endpoint. Default for Android Emulator is 10.0.2.2:8000.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    OutlinedTextField(
                        value = serverUrlInput,
                        onValueChange = { serverUrlInput = it },
                        label = { Text("Server URL") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        TextButton(onClick = { serverUrlInput = FaflowApiClient.DEFAULT_EMULATOR_URL }) {
                            Text("10.0.2.2")
                        }
                        TextButton(onClick = { serverUrlInput = FaflowApiClient.DEFAULT_EMULATOR_LOOPBACK_URL }) {
                            Text("127.0.0.1")
                        }
                        TextButton(onClick = { serverUrlInput = FaflowApiClient.DEFAULT_LAN_URL }) {
                            Text("Wi-Fi LAN")
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        FaflowApiClient.setAndPersistBaseUrl(context, serverUrlInput)
                        Toast.makeText(context, "Server updated to: $serverUrlInput", Toast.LENGTH_SHORT).show()
                        showServerConfigDialog = false
                    }
                ) {
                    Text("Save & Apply", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showServerConfigDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}
