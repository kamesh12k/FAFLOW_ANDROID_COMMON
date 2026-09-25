package com.governence.faflow.ui.screens

import android.content.Intent
import android.net.Uri
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Attachment
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.OpenInNew
import androidx.compose.material.icons.filled.PictureAsPdf
import androidx.compose.material.icons.filled.PinDrop
import androidx.compose.material.icons.filled.PushPin
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.governence.faflow.core.network.AnnouncementAttachmentDto
import com.governence.faflow.core.network.AnnouncementListItemDto
import com.governence.faflow.ui.components.AppTopBar
import com.governence.faflow.ui.theme.FaflowBg
import com.governence.faflow.ui.theme.FaflowBorder
import com.governence.faflow.ui.theme.FaflowNavy
import com.governence.faflow.ui.theme.FaflowNavyTint
import com.governence.faflow.ui.theme.FaflowShapes
import com.governence.faflow.ui.theme.FaflowSpacing
import com.governence.faflow.ui.theme.FaflowText1
import com.governence.faflow.ui.theme.FaflowText2
import com.governence.faflow.ui.theme.FaflowText3
import com.governence.faflow.ui.theme.PrimaryBlue
import com.governence.faflow.ui.theme.StatusError
import com.governence.faflow.ui.theme.StatusSuccess
import com.governence.faflow.ui.theme.StatusWarning
import com.governence.faflow.ui.viewmodels.AnnouncementsViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AnnouncementsScreen(
    viewModel: AnnouncementsViewModel,
    onNavigateBack: () -> Unit,
    onNavigateToDetail: ((Int) -> Unit)? = null
) {
    val context = LocalContext.current
    val uiState by viewModel.uiState.collectAsState()
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    Scaffold(
        topBar = {
            AppTopBar(
                title = "Announcements",
                subtitle = "Circulars, notices & department broadcasts",
                canNavigateBack = true,
                onNavigateBack = onNavigateBack,
                actions = {
                    IconButton(onClick = { viewModel.loadAnnouncements() }) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Refresh",
                            tint = FaflowNavy
                        )
                    }
                }
            )
        },
        containerColor = FaflowBg
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(FaflowBg)
        ) {
            // Search Box & Filter Chips Bar
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color.White)
                    .padding(horizontal = 16.dp, vertical = 12.dp)
            ) {
                OutlinedTextField(
                    value = uiState.searchQuery,
                    onValueChange = { viewModel.setSearchQuery(it) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp),
                    placeholder = { Text("Search circulars by title or author...", fontSize = 13.sp, color = FaflowText3) },
                    leadingIcon = {
                        Icon(Icons.Default.Search, contentDescription = null, tint = FaflowText3, modifier = Modifier.size(18.dp))
                    },
                    trailingIcon = {
                        if (uiState.searchQuery.isNotBlank()) {
                            IconButton(onClick = { viewModel.setSearchQuery("") }) {
                                Icon(Icons.Default.Close, contentDescription = "Clear", tint = FaflowText3, modifier = Modifier.size(16.dp))
                            }
                        }
                    },
                    shape = RoundedCornerShape(10.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = PrimaryBlue,
                        unfocusedBorderColor = FaflowBorder
                    ),
                    singleLine = true
                )

                Spacer(modifier = Modifier.height(10.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    listOf("all" to "All", "unread" to "Unread (${uiState.unreadCount})", "important" to "Important").forEach { (tabKey, tabLabel) ->
                        val isSelected = uiState.selectedTab == tabKey
                        FilterChip(
                            selected = isSelected,
                            onClick = { viewModel.setTab(tabKey) },
                            label = {
                                Text(
                                    text = tabLabel,
                                    fontSize = 12.sp,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
                                )
                            },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = FaflowNavy,
                                selectedLabelColor = Color.White,
                                containerColor = Color(0xFFF1F5F9),
                                labelColor = FaflowText2
                            ),
                            shape = RoundedCornerShape(8.dp),
                            border = null
                        )
                    }
                }
            }

            HorizontalDivider(color = FaflowBorder)

            // Content Feed
            if (uiState.isLoading && uiState.announcements.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = PrimaryBlue, strokeWidth = 2.5.dp)
                }
            } else if (uiState.errorMessage != null && uiState.announcements.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Default.ErrorOutline, contentDescription = null, tint = StatusError, modifier = Modifier.size(48.dp))
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(text = uiState.errorMessage ?: "Failed to load announcements", color = FaflowText1, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(12.dp))
                        Button(onClick = { viewModel.loadAnnouncements() }, colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue)) {
                            Text("Retry")
                        }
                    }
                }
            } else if (uiState.filteredAnnouncements.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Default.Campaign, contentDescription = null, tint = FaflowText3, modifier = Modifier.size(54.dp))
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = if (uiState.searchQuery.isNotBlank()) "No circulars match your search" else "No announcements in this category",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = FaflowText2
                        )
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 14.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(uiState.filteredAnnouncements, key = { it.id }) { item ->
                        AnnouncementCard(
                            item = item,
                            onClick = {
                                if (onNavigateToDetail != null) {
                                    onNavigateToDetail(item.id)
                                } else {
                                    viewModel.loadDetail(item.id)
                                }
                            }
                        )
                    }
                }
            }
        }

        // Announcement Detail Bottom Sheet
        if (uiState.selectedDetail != null || uiState.isLoadingDetail) {
            ModalBottomSheet(
                onDismissRequest = { viewModel.dismissDetail() },
                sheetState = sheetState,
                containerColor = Color.White
            ) {
                if (uiState.isLoadingDetail) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(200.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = PrimaryBlue, strokeWidth = 2.dp)
                    }
                } else if (uiState.selectedDetail != null) {
                    val detail = uiState.selectedDetail!!
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            // Bug #4 fix: make content scrollable so long announcements don't clip
                            .fillMaxHeight(0.92f)
                            .verticalScroll(rememberScrollState())
                            .padding(horizontal = 24.dp, vertical = 8.dp)
                            .padding(bottom = 32.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                if (detail.isPinned) {
                                    Icon(Icons.Default.PushPin, contentDescription = "Pinned", tint = PrimaryBlue, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                }
                                PriorityBadge(priority = detail.priority)
                            }
                            Text(
                                text = detail.publishedAt?.take(10) ?: detail.createdAt.take(10),
                                fontSize = 11.5.sp,
                                color = FaflowText3
                            )
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        Text(
                            text = detail.title,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = FaflowNavy
                        )

                        Spacer(modifier = Modifier.height(6.dp))

                        Text(
                            text = "Published by ${detail.authorName} (${detail.authorRole})" +
                                    if (detail.departmentName != null) " • ${detail.departmentName}" else "",
                            fontSize = 12.sp,
                            color = FaflowText2,
                            fontWeight = FontWeight.Medium
                        )

                        HorizontalDivider(modifier = Modifier.padding(vertical = 14.dp), color = FaflowBorder)

                        Text(
                            text = detail.body,
                            fontSize = 14.sp,
                            color = FaflowText1,
                            lineHeight = 22.sp
                        )

                        // Attachments
                        if (detail.attachments.isNotEmpty()) {
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                text = "Attachments (${detail.attachments.size})",
                                fontSize = 12.5.sp,
                                fontWeight = FontWeight.Bold,
                                color = FaflowNavy
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            detail.attachments.forEach { att ->
                                AttachmentRow(attachment = att)
                            }
                        }

                        // Acknowledgment Action
                        if (detail.requiresAcknowledgement) {
                            Spacer(modifier = Modifier.height(20.dp))
                            if (detail.isAcknowledged) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(StatusSuccess.copy(alpha = 0.12f))
                                        .padding(vertical = 10.dp, horizontal = 14.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(Icons.Default.Verified, contentDescription = null, tint = StatusSuccess, modifier = Modifier.size(18.dp))
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text("You have formally acknowledged this circular.", fontSize = 12.5.sp, color = StatusSuccess, fontWeight = FontWeight.SemiBold)
                                }
                            } else {
                                Button(
                                    onClick = { viewModel.acknowledgeAnnouncement(detail.id) },
                                    enabled = !uiState.isAcknowledging,
                                    modifier = Modifier.fillMaxWidth().height(46.dp),
                                    shape = RoundedCornerShape(10.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue)
                                ) {
                                    if (uiState.isAcknowledging) {
                                        CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(18.dp))
                                    } else {
                                        Text("I Acknowledge This Circular", fontWeight = FontWeight.Bold, fontSize = 13.5.sp)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun AnnouncementCard(
    item: AnnouncementListItemDto,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = FaflowShapes.medium,
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = androidx.compose.foundation.BorderStroke(1.dp, if (!item.isRead) PrimaryBlue.copy(alpha = 0.5f) else FaflowBorder),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.5.dp)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (item.isPinned) {
                        Icon(Icons.Default.PushPin, contentDescription = "Pinned", tint = PrimaryBlue, modifier = Modifier.size(14.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                    }
                    PriorityBadge(priority = item.priority)
                    if (!item.isRead) {
                        Spacer(modifier = Modifier.width(6.dp))
                        Box(
                            modifier = Modifier
                                .size(7.dp)
                                .clip(CircleShape)
                                .background(PrimaryBlue)
                        )
                    }
                }
                Text(
                    text = item.publishedAt?.take(10) ?: item.createdAt.take(10),
                    fontSize = 11.sp,
                    color = FaflowText3
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = item.title,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = FaflowNavy,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )

            Spacer(modifier = Modifier.height(4.dp))

            Text(
                text = item.bodySnippet,
                fontSize = 12.5.sp,
                color = FaflowText2,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                lineHeight = 17.sp
            )

            Spacer(modifier = Modifier.height(10.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "${item.authorName} • ${item.departmentName ?: item.targetSummary}",
                    fontSize = 11.sp,
                    color = FaflowText3
                )

                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    if (item.attachmentCount > 0) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .clip(RoundedCornerShape(4.dp))
                                .background(Color(0xFFF1F5F9))
                                .padding(horizontal = 6.dp, vertical = 2.dp)
                        ) {
                            Icon(Icons.Default.Attachment, contentDescription = null, tint = FaflowText2, modifier = Modifier.size(11.dp))
                            Spacer(modifier = Modifier.width(3.dp))
                            Text("${item.attachmentCount}", fontSize = 10.5.sp, color = FaflowText2, fontWeight = FontWeight.Bold)
                        }
                    }
                    if (item.requiresAcknowledgement) {
                        val ackBg = if (item.isAcknowledged) StatusSuccess.copy(alpha = 0.12f) else StatusWarning.copy(alpha = 0.12f)
                        val ackColor = if (item.isAcknowledged) StatusSuccess else StatusWarning
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(4.dp))
                                .background(ackBg)
                                .padding(horizontal = 6.dp, vertical = 2.dp)
                        ) {
                            Text(
                                text = if (item.isAcknowledged) "Acknowledged" else "Action Required",
                                fontSize = 10.sp,
                                color = ackColor,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun PriorityBadge(priority: String) {
    val (bgColor, textColor, label) = when (priority.uppercase()) {
        "URGENT" -> Triple(StatusError.copy(alpha = 0.12f), StatusError, "URGENT")
        "HIGH" -> Triple(StatusWarning.copy(alpha = 0.12f), StatusWarning, "HIGH")
        else -> Triple(Color(0xFFF1F5F9), FaflowText2, "NORMAL")
    }

    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(4.dp))
            .background(bgColor)
            .padding(horizontal = 6.dp, vertical = 2.dp)
    ) {
        Text(text = label, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = textColor)
    }
}

// ---------- Helper: detect file type from filename/URL ----------
private fun isImageFile(fileName: String): Boolean {
    val ext = fileName.substringAfterLast('.', "").lowercase()
    return ext in listOf("jpg", "jpeg", "png", "gif", "webp", "bmp", "svg")
}

private fun isPdfOrDoc(fileName: String): Boolean {
    val ext = fileName.substringAfterLast('.', "").lowercase()
    return ext in listOf("pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt")
}

// ---------- In-App Image Viewer (WebView-based — no extra library needed) ----------
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FullScreenImageDialog(url: String, onDismiss: () -> Unit) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = Color.Black
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.92f)
        ) {
            AndroidView(
                factory = { ctx ->
                    WebView(ctx).apply {
                        webViewClient = WebViewClient()
                        settings.javaScriptEnabled = false
                        settings.loadWithOverviewMode = true
                        settings.useWideViewPort = true
                        settings.builtInZoomControls = true
                        settings.displayZoomControls = false
                        // Load image directly — WebView renders it natively
                        loadUrl(url)
                    }
                },
                modifier = Modifier.fillMaxSize()
            )
            IconButton(
                onClick = onDismiss,
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(8.dp)
            ) {
                Icon(
                    Icons.Default.Close,
                    contentDescription = "Close",
                    tint = Color.White,
                    modifier = Modifier.size(28.dp)
                )
            }
        }
    }
}

// ---------- In-App PDF/Doc WebView Bottom Sheet ----------
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InAppDocViewerSheet(url: String, fileName: String, onDismiss: () -> Unit) {
    val context = LocalContext.current
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    // Wrap in Google Docs viewer so PDF renders without downloading
    val viewerUrl = "https://docs.google.com/gviewer?embedded=true&url=${Uri.encode(url)}"
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = Color.White
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.9f)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = fileName,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = FaflowNavy,
                    modifier = Modifier.weight(1f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = { downloadAttachment(context, url, fileName) }) {
                        Icon(Icons.Default.Download, contentDescription = "Download file", tint = PrimaryBlue)
                    }
                    IconButton(onClick = {
                        try {
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                            context.startActivity(intent)
                        } catch (_: Exception) {
                            downloadAttachment(context, url, fileName)
                        }
                    }) {
                        Icon(Icons.Default.OpenInNew, contentDescription = "Open in browser", tint = PrimaryBlue)
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, contentDescription = "Close", tint = FaflowText2)
                    }
                }
            }
            HorizontalDivider(color = FaflowBorder)
            AndroidView(
                factory = { ctx ->
                    WebView(ctx).apply {
                        webViewClient = WebViewClient()
                        settings.javaScriptEnabled = true
                        settings.domStorageEnabled = true
                        settings.loadWithOverviewMode = true
                        settings.useWideViewPort = true
                        loadUrl(viewerUrl)
                    }
                },
                modifier = Modifier.fillMaxSize()
            )
        }
    }
}

@Composable
fun AttachmentRow(attachment: AnnouncementAttachmentDto) {
    val context = LocalContext.current
    val rawUrl = attachment.downloadUrl ?: ""
    val fileName = attachment.fileName

    // Normalize relative URL against base URL to prevent file:/// URI access denied errors
    val url = remember(rawUrl) {
        when {
            rawUrl.isBlank() -> ""
            rawUrl.startsWith("http://") || rawUrl.startsWith("https://") -> rawUrl
            else -> com.governence.faflow.core.network.ApiConfig.getBaseUrl(context).trimEnd('/') + "/" + rawUrl.trimStart('/')
        }
    }

    var showImageDialog by remember { mutableStateOf(false) }
    var showDocSheet by remember { mutableStateOf(false) }

    // In-app viewers
    if (showImageDialog && url.isNotBlank()) {
        FullScreenImageDialog(url = url, onDismiss = { showImageDialog = false })
    }
    if (showDocSheet && url.isNotBlank()) {
        InAppDocViewerSheet(url = url, fileName = fileName, onDismiss = { showDocSheet = false })
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(Color(0xFFF8FAFC))
            .border(1.dp, FaflowBorder, RoundedCornerShape(8.dp))
            .clickable {
                when {
                    url.isBlank() -> {
                        Toast.makeText(context, "Attachment: $fileName", Toast.LENGTH_SHORT).show()
                    }
                    isImageFile(fileName) -> showImageDialog = true
                    isPdfOrDoc(fileName) -> showDocSheet = true
                    else -> {
                        // Unknown type — open in external app
                        try {
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                            context.startActivity(intent)
                        } catch (_: Exception) {
                            Toast.makeText(context, "Cannot open: $fileName", Toast.LENGTH_SHORT).show()
                        }
                    }
                }
            }
            .padding(horizontal = 12.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
            Icon(
                imageVector = if (isPdfOrDoc(fileName)) Icons.Default.PictureAsPdf else Icons.Default.Attachment,
                contentDescription = null,
                tint = PrimaryBlue,
                modifier = Modifier.size(16.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = fileName,
                fontSize = 12.5.sp,
                fontWeight = FontWeight.Medium,
                color = FaflowNavy,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(
                onClick = { downloadAttachment(context, url, fileName) },
                modifier = Modifier.size(28.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Download,
                    contentDescription = "Download",
                    tint = PrimaryBlue,
                    modifier = Modifier.size(16.dp)
                )
            }
            Spacer(modifier = Modifier.width(4.dp))
            Icon(
                imageVector = Icons.Default.OpenInNew,
                contentDescription = "Open",
                tint = FaflowText3,
                modifier = Modifier.size(16.dp)
            )
        }
    }
}

fun downloadAttachment(context: android.content.Context, url: String, fileName: String) {
    try {
        if (url.startsWith("http://") || url.startsWith("https://")) {
            val request = android.app.DownloadManager.Request(Uri.parse(url)).apply {
                setTitle(fileName)
                setDescription("Downloading $fileName")
                setNotificationVisibility(android.app.DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                setDestinationInExternalPublicDir(android.os.Environment.DIRECTORY_DOWNLOADS, fileName)
                setAllowedOverMetered(true)
                setAllowedOverRoaming(true)
            }
            val downloadManager = context.getSystemService(android.content.Context.DOWNLOAD_SERVICE) as android.app.DownloadManager
            downloadManager.enqueue(request)
            Toast.makeText(context, "Download started: $fileName", Toast.LENGTH_SHORT).show()
        } else {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
            context.startActivity(intent)
        }
    } catch (_: Exception) {
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
            context.startActivity(intent)
        } catch (_: Exception) {
            Toast.makeText(context, "Cannot download: $fileName", Toast.LENGTH_SHORT).show()
        }
    }
}

@Composable
fun AnnouncementDetailScreen(
    announcementId: Int,
    viewModel: AnnouncementsViewModel,
    onNavigateBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(announcementId) {
        if (announcementId > 0) {
            viewModel.loadDetail(announcementId)
        }
    }

    Scaffold(
        topBar = {
            AppTopBar(
                title = "Announcement",
                subtitle = "Institutional Circular",
                canNavigateBack = true,
                onNavigateBack = onNavigateBack
            )
        },
        containerColor = FaflowBg
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            if (uiState.isLoadingDetail && uiState.selectedDetail == null) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = PrimaryBlue, strokeWidth = 2.5.dp)
                }
            } else if (uiState.selectedDetail != null) {
                val detail = uiState.selectedDetail!!
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 20.dp, vertical = 16.dp)
                        .padding(bottom = 32.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            if (detail.isPinned) {
                                Icon(Icons.Default.PushPin, contentDescription = "Pinned", tint = PrimaryBlue, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                            }
                            PriorityBadge(priority = detail.priority)
                        }
                        Text(
                            text = detail.publishedAt?.take(10) ?: detail.createdAt.take(10),
                            fontSize = 12.sp,
                            color = FaflowText3
                        )
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    Text(
                        text = detail.title,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = FaflowNavy
                    )

                    Spacer(modifier = Modifier.height(6.dp))

                    Text(
                        text = "Published by ${detail.authorName} (${detail.authorRole})" +
                                if (detail.departmentName != null) " • ${detail.departmentName}" else "",
                        fontSize = 13.sp,
                        color = FaflowText2,
                        fontWeight = FontWeight.Medium
                    )

                    HorizontalDivider(modifier = Modifier.padding(vertical = 16.dp), color = FaflowBorder)

                    Text(
                        text = detail.body,
                        fontSize = 15.sp,
                        color = FaflowText1,
                        lineHeight = 24.sp
                    )

                    // Attachments
                    if (detail.attachments.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(20.dp))
                        Text(
                            text = "Attachments (${detail.attachments.size})",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            color = FaflowNavy
                        )
                        Spacer(modifier = Modifier.height(10.dp))
                        detail.attachments.forEach { att ->
                            AttachmentRow(attachment = att)
                            Spacer(modifier = Modifier.height(6.dp))
                        }
                    }

                    // Acknowledgment Action
                    if (detail.requiresAcknowledgement) {
                        Spacer(modifier = Modifier.height(24.dp))
                        if (detail.isAcknowledged) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(StatusSuccess.copy(alpha = 0.12f))
                                    .padding(vertical = 12.dp, horizontal = 16.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(Icons.Default.Verified, contentDescription = null, tint = StatusSuccess, modifier = Modifier.size(20.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "Acknowledged by you",
                                    fontSize = 13.5.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = StatusSuccess
                                )
                            }
                        } else {
                            Button(
                                onClick = { viewModel.acknowledgeAnnouncement(detail.id) },
                                modifier = Modifier.fillMaxWidth(),
                                shape = FaflowShapes.pill,
                                colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue),
                                enabled = !uiState.isAcknowledging
                            ) {
                                if (uiState.isAcknowledging) {
                                    CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = Color.White)
                                    Spacer(modifier = Modifier.width(8.dp))
                                }
                                Text("Acknowledge Notice", fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            } else {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("Announcement not found", color = FaflowText2)
                }
            }
        }
    }
}
