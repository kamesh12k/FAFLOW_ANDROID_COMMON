package com.governence.faflow.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.governence.faflow.core.network.*
import com.governence.faflow.ui.components.AppTopBar
import com.governence.faflow.ui.theme.*
import com.governence.faflow.ui.viewmodels.CampusStructureUiState
import com.governence.faflow.ui.viewmodels.CampusStructureViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CampusStructureScreen(
    viewModel: CampusStructureViewModel,
    onNavigateBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    var isSearchExpanded by remember { mutableStateOf(false) }

    LaunchedEffect(uiState.errorMessage) {
        uiState.errorMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearMessages()
        }
    }

    LaunchedEffect(uiState.successMessage) {
        uiState.successMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearMessages()
        }
    }

    Scaffold(
        topBar = {
            AppTopBar(
                title = "Campus Structure",
                canNavigateBack = true,
                onNavigateBack = onNavigateBack,
                actions = {
                    IconButton(onClick = { isSearchExpanded = !isSearchExpanded }) {
                        Icon(
                            imageVector = if (isSearchExpanded) Icons.Default.Close else Icons.Default.Search,
                            contentDescription = "Search",
                            tint = Color.White
                        )
                    }
                    IconButton(onClick = { viewModel.loadStructure() }) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Refresh",
                            tint = Color.White
                        )
                    }
                }
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { viewModel.openSmartAutofill() },
                containerColor = FaflowNavy,
                contentColor = Color.White,
                icon = { Icon(Icons.Default.Add, contentDescription = null) },
                text = { Text("Smart Auto-Fill", fontWeight = FontWeight.Bold) }
            )
        },
        bottomBar = {
            if (uiState.selectedRoomIds.isNotEmpty()) {
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    color = FaflowNavy,
                    shadowElevation = 8.dp
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = "${uiState.selectedRoomIds.size} rooms selected",
                            color = Color.White,
                            fontWeight = FontWeight.Bold
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            TextButton(
                                onClick = { viewModel.clearRoomSelection() },
                                colors = ButtonDefaults.textButtonColors(contentColor = Color.White.copy(alpha = 0.8f))
                            ) {
                                Text("Clear")
                            }
                            Button(
                                onClick = { viewModel.openBulkAssign() },
                                colors = ButtonDefaults.buttonColors(containerColor = Color.White, contentColor = FaflowNavy),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Text("Bulk Assign", fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
        containerColor = FaflowBg
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            if (uiState.isLoading && uiState.tree == null) {
                CircularProgressIndicator(
                    modifier = Modifier.align(Alignment.Center),
                    color = FaflowNavy
                )
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(bottom = 96.dp)
                ) {
                    // 1. Search Box
                    if (isSearchExpanded) {
                        item {
                            CampusSearchBar(
                                query = uiState.searchQuery,
                                onQueryChange = { viewModel.onSearchQueryChange(it) },
                                onClear = { viewModel.clearSearch() }
                            )
                        }
                    }

                    // 2. Search Results Mode (if query active)
                    if (uiState.searchQuery.isNotBlank()) {
                        item {
                            CampusSearchResultsSection(
                                results = uiState.searchResults,
                                isSearching = uiState.isSearching,
                                onRoomClick = { roomId ->
                                    // Find room in tree or fetch
                                    val r = findRoomInTree(uiState.tree, roomId)
                                    viewModel.selectRoom(r)
                                }
                            )
                        }
                    } else {
                        // 3. Structure Metrics Overview
                        item {
                            uiState.metrics?.let { metrics ->
                                StructureMetricsCard(metrics)
                            }
                        }

                        // 4. Actionable Warnings
                        if (!uiState.metrics?.warnings.isNullOrEmpty()) {
                            item {
                                ActionableWarningsCard(uiState.metrics!!.warnings)
                            }
                        }

                        // 5. Campus Tree Hierarchy Header
                        item {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 16.dp, vertical = 12.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        imageVector = Icons.Default.Apartment,
                                        contentDescription = null,
                                        tint = FaflowNavy,
                                        modifier = Modifier.size(20.dp)
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = uiState.tree?.institutionName ?: "PHYSICAL INFRASTRUCTURE",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp,
                                        color = FaflowNavy
                                    )
                                }
                                Text(
                                    text = "${uiState.tree?.blocks?.size ?: 0} Blocks",
                                    fontSize = 12.sp,
                                    color = Color.Gray,
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }

                        // 6. Tree Blocks
                        val blocks = uiState.tree?.blocks ?: emptyList()
                        if (blocks.isEmpty()) {
                            item {
                                EmptyStructureCard(onAddBlockClick = { viewModel.openSmartAutofill() })
                            }
                        } else {
                            items(blocks, key = { it.id }) { block ->
                                val isExpanded = uiState.expandedBlockIds.contains(block.id)
                                BlockTreeNode(
                                    block = block,
                                    isExpanded = isExpanded,
                                    expandedFloorIds = uiState.expandedFloorIds,
                                    selectedRoomIds = uiState.selectedRoomIds,
                                    onToggleBlock = { viewModel.toggleBlockExpanded(block.id) },
                                    onToggleFloor = { viewModel.toggleFloorExpanded(it) },
                                    onSelectFloorAll = { viewModel.selectAllRoomsInFloor(it) },
                                    onToggleRoom = { viewModel.toggleRoomSelected(it) },
                                    onRoomClick = { viewModel.selectRoom(it) },
                                    onDuplicateBlock = { viewModel.openDuplicateBlock(block) }
                                )
                            }
                        }
                    }
                }
            }

            // Bottom Sheets / Dialogs
            if (uiState.isSmartAutofillOpen) {
                SmartAutofillBottomSheet(
                    onDismiss = { viewModel.closeSmartAutofill() },
                    preview = uiState.patternPreview,
                    isPreviewLoading = uiState.isPreviewLoading,
                    onPreviewRequest = { pat, start, count, type, cap ->
                        viewModel.previewPattern(pat, start, count, type, cap)
                    },
                    onSubmit = { req ->
                        viewModel.submitSmartAutofill(req) {
                            viewModel.closeSmartAutofill()
                        }
                    }
                )
            }

            if (uiState.isBulkAssignOpen) {
                BulkAssignBottomSheet(
                    selectedCount = uiState.selectedRoomIds.size,
                    onDismiss = { viewModel.closeBulkAssign() },
                    onSubmit = { req ->
                        viewModel.submitBulkAssign(
                            req.copy(roomIds = uiState.selectedRoomIds.toList())
                        ) {
                            viewModel.closeBulkAssign()
                        }
                    }
                )
            }

            uiState.duplicatingBlock?.let { block ->
                if (uiState.isDuplicateBlockOpen) {
                    DuplicateBlockDialog(
                        sourceBlock = block,
                        onDismiss = { viewModel.closeDuplicateBlock() },
                        onSubmit = { req ->
                            viewModel.submitDuplicateBlock(block.id, req) {
                                viewModel.closeDuplicateBlock()
                            }
                        }
                    )
                }
            }

            uiState.selectedRoom?.let { room ->
                RoomDetailBottomSheet(
                    room = room,
                    onDismiss = { viewModel.selectRoom(null) }
                )
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────

@Composable
fun StructureMetricsCard(metrics: CampusStructureMetricsDto) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(12.dp),
        elevation = CardDefaults.cardElevation(2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "CAMPUS CAPACITY OVERVIEW",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = FaflowNavy,
                letterSpacing = 1.sp
            )
            Spacer(modifier = Modifier.height(12.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                MetricItem("Blocks", metrics.totalBlocks.toString())
                MetricItem("Floors", metrics.totalFloors.toString())
                MetricItem("Total Rooms", metrics.totalRooms.toString())
                MetricItem("Classrooms", metrics.totalClassrooms.toString())
                MetricItem("Labs", metrics.totalLabs.toString())
                MetricItem("Exam Halls", metrics.totalExamHalls.toString(), color = Color(0xFFE65100))
            }
        }
    }
}

@Composable
fun MetricItem(label: String, value: String, color: Color = FaflowNavy) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(text = value, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = color)
        Text(text = label, fontSize = 10.sp, color = Color.Gray)
    }
}

@Composable
fun ActionableWarningsCard(warnings: List<String>) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFFFFF8E1)),
        border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(Color(0xFFFFE082))),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.WarningAmber,
                    contentDescription = null,
                    tint = Color(0xFFF57F17),
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = "ACTIONABLE CONFIGURATION GAPS",
                    fontWeight = FontWeight.Bold,
                    fontSize = 12.sp,
                    color = Color(0xFFF57F17)
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            warnings.take(4).forEach { warning ->
                Row(
                    modifier = Modifier.padding(vertical = 3.dp),
                    verticalAlignment = Alignment.Top
                ) {
                    Text(
                        text = "•",
                        fontSize = 13.sp,
                        color = Color(0xFFBF360C),
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(end = 6.dp)
                    )
                    Text(
                        text = warning,
                        fontSize = 12.sp,
                        color = Color(0xFF5D4037),
                        lineHeight = 16.sp
                    )
                }
            }
            if (warnings.size > 4) {
                Text(
                    text = "+${warnings.size - 4} more warnings...",
                    fontSize = 11.sp,
                    color = Color(0xFFF57F17),
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
        }
    }
}

@Composable
fun BlockTreeNode(
    block: StructureBlockNode,
    isExpanded: Boolean,
    expandedFloorIds: Set<Int>,
    selectedRoomIds: Set<Int>,
    onToggleBlock: () -> Unit,
    onToggleFloor: (Int) -> Unit,
    onSelectFloorAll: (StructureFloorNode) -> Unit,
    onToggleRoom: (Int) -> Unit,
    onRoomClick: (CampusRoomDto) -> Unit,
    onDuplicateBlock: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 6.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(12.dp),
        elevation = CardDefaults.cardElevation(1.dp)
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            // Block Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onToggleBlock() }
                    .padding(14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.weight(1f)
                ) {
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(FaflowNavyTint),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = block.code.take(2).uppercase(),
                            color = FaflowNavy,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp
                        )
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text(
                            text = block.name,
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp,
                            color = Color(0xFF212121)
                        )
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = "Code: ${block.code} · ${block.floors.size} Floors",
                                fontSize = 12.sp,
                                color = Color.Gray
                            )
                            block.departmentName?.let { dept ->
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = "· $dept",
                                    fontSize = 11.sp,
                                    color = FaflowNavy,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                        }
                    }
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(
                        onClick = onDuplicateBlock,
                        modifier = Modifier.size(32.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.ContentCopy,
                            contentDescription = "Duplicate Block",
                            tint = Color.Gray,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                    Icon(
                        imageVector = if (isExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                        contentDescription = null,
                        tint = Color.Gray
                    )
                }
            }

            // Floors (progressive disclosure)
            if (isExpanded) {
                HorizontalDivider(color = FaflowBorder)
                Column(modifier = Modifier.padding(start = 16.dp, end = 12.dp, top = 8.dp, bottom = 12.dp)) {
                    block.floors.forEach { floor ->
                        val isFloorExpanded = expandedFloorIds.contains(floor.id)
                        FloorTreeNode(
                            floor = floor,
                            isExpanded = isFloorExpanded,
                            selectedRoomIds = selectedRoomIds,
                            onToggleFloor = { onToggleFloor(floor.id) },
                            onSelectFloorAll = { onSelectFloorAll(floor) },
                            onToggleRoom = onToggleRoom,
                            onRoomClick = onRoomClick
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun FloorTreeNode(
    floor: StructureFloorNode,
    isExpanded: Boolean,
    selectedRoomIds: Set<Int>,
    onToggleFloor: () -> Unit,
    onSelectFloorAll: () -> Unit,
    onToggleRoom: (Int) -> Unit,
    onRoomClick: (CampusRoomDto) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
    ) {
        // Floor header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(8.dp))
                .background(Color(0xFFF5F7FA))
                .clickable { onToggleFloor() }
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.Layers,
                    contentDescription = null,
                    tint = Color.Gray,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = floor.floorName,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 13.sp,
                    color = Color(0xFF37474F)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = "(${floor.rooms.size} rooms)",
                    fontSize = 11.sp,
                    color = Color.Gray
                )
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "Select all",
                    fontSize = 11.sp,
                    color = FaflowNavy,
                    modifier = Modifier
                        .clickable { onSelectFloorAll() }
                        .padding(horizontal = 6.dp, vertical = 2.dp),
                    fontWeight = FontWeight.Medium
                )
                Icon(
                    imageVector = if (isExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                    contentDescription = null,
                    tint = Color.Gray,
                    modifier = Modifier.size(18.dp)
                )
            }
        }

        // Rooms Grid
        if (isExpanded) {
            if (floor.rooms.isEmpty()) {
                Text(
                    text = "No rooms on this floor yet.",
                    fontSize = 12.sp,
                    color = Color.Gray,
                    modifier = Modifier.padding(12.dp)
                )
            } else {
                FlowRoomRow(
                    rooms = floor.rooms,
                    selectedRoomIds = selectedRoomIds,
                    onToggleRoom = onToggleRoom,
                    onRoomClick = onRoomClick
                )
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun FlowRoomRow(
    rooms: List<CampusRoomDto>,
    selectedRoomIds: Set<Int>,
    onToggleRoom: (Int) -> Unit,
    onRoomClick: (CampusRoomDto) -> Unit
) {
    FlowRow(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp, horizontal = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        rooms.forEach { room ->
            val isSelected = selectedRoomIds.contains(room.id)
            RoomChip(
                room = room,
                isSelected = isSelected,
                onToggleSelect = { onToggleRoom(room.id) },
                onClick = { onRoomClick(room) }
            )
        }
    }
}

@Composable
fun RoomChip(
    room: CampusRoomDto,
    isSelected: Boolean,
    onToggleSelect: () -> Unit,
    onClick: () -> Unit
) {
    val typeColor = when (room.roomType.lowercase()) {
        "laboratory", "lab" -> Color(0xFF00897B)
        "examination_hall" -> Color(0xFFD84315)
        "seminar_hall", "auditorium" -> Color(0xFF6A1B9A)
        else -> FaflowNavy
    }

    Surface(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .border(
                width = if (isSelected) 2.dp else 1.dp,
                color = if (isSelected) FaflowNavy else Color(0xFFCFD8DC),
                shape = RoundedCornerShape(8.dp)
            )
            .clickable { onClick() },
        color = if (isSelected) FaflowNavyTint else Color.White,
        shape = RoundedCornerShape(8.dp)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Checkbox(
                checked = isSelected,
                onCheckedChange = { onToggleSelect() },
                modifier = Modifier.size(20.dp),
                colors = CheckboxDefaults.colors(checkedColor = FaflowNavy)
            )
            Spacer(modifier = Modifier.width(6.dp))
            Column {
                Text(
                    text = room.roomNumber,
                    fontWeight = FontWeight.Bold,
                    fontSize = 12.sp,
                    color = Color(0xFF263238)
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(6.dp)
                            .clip(CircleShape)
                            .background(typeColor)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = if (room.isExamEligible) "Exam (${room.examCapacity ?: room.capacity})" else room.roomType.replace("_", " "),
                        fontSize = 10.sp,
                        color = typeColor,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        }
    }
}

@Composable
fun CampusSearchBar(
    query: String,
    onQueryChange: (String) -> Unit,
    onClear: () -> Unit
) {
    OutlinedTextField(
        value = query,
        onValueChange = onQueryChange,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        placeholder = { Text("Search room (A-201), block, or department...") },
        leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = FaflowNavy) },
        trailingIcon = {
            if (query.isNotEmpty()) {
                IconButton(onClick = onClear) {
                    Icon(Icons.Default.Clear, contentDescription = "Clear")
                }
            }
        },
        shape = RoundedCornerShape(12.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = FaflowNavy,
            unfocusedBorderColor = Color(0xFFCFD8DC),
            focusedContainerColor = Color.White,
            unfocusedContainerColor = Color.White
        ),
        singleLine = true
    )
}

@Composable
fun CampusSearchResultsSection(
    results: List<CampusSearchResultItemDto>,
    isSearching: Boolean,
    onRoomClick: (Int) -> Unit
) {
    if (isSearching) {
        Box(modifier = Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = FaflowNavy)
        }
    } else if (results.isEmpty()) {
        Box(modifier = Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
            Text("No campus locations match your search.", color = Color.Gray, fontSize = 13.sp)
        }
    } else {
        Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
            Text(
                text = "SEARCH RESULTS (${results.size})",
                fontWeight = FontWeight.Bold,
                fontSize = 11.sp,
                color = FaflowNavy,
                modifier = Modifier.padding(bottom = 8.dp)
            )
            results.forEach { item ->
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp)
                        .clickable { item.roomId?.let { onRoomClick(it) } },
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = when (item.category) {
                                "ROOM" -> Icons.Default.MeetingRoom
                                "DEPARTMENT" -> Icons.Default.School
                                else -> Icons.Default.Apartment
                            },
                            contentDescription = null,
                            tint = FaflowNavy,
                            modifier = Modifier.size(24.dp)
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(text = item.title, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            Text(text = item.subtitle, fontSize = 12.sp, color = Color.Gray)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun EmptyStructureCard(onAddBlockClick: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                imageVector = Icons.Default.DomainAdd,
                contentDescription = null,
                tint = FaflowNavy,
                modifier = Modifier.size(54.dp)
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "No Campus Infrastructure Mapped",
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp,
                color = FaflowNavy
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Use Smart Auto-Fill to generate entire academic blocks with customizable floor counts and room numbering patterns.",
                fontSize = 12.sp,
                color = Color.Gray,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center
            )
            Spacer(modifier = Modifier.height(16.dp))
            Button(
                onClick = onAddBlockClick,
                colors = ButtonDefaults.buttonColors(containerColor = FaflowNavy),
                shape = RoundedCornerShape(8.dp)
            ) {
                Text("Generate First Block", fontWeight = FontWeight.Bold)
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────
// Dialogs & Bottom Sheets
// ─────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SmartAutofillBottomSheet(
    onDismiss: () -> Unit,
    preview: PatternPreviewResponseDto?,
    isPreviewLoading: Boolean,
    onPreviewRequest: (pattern: String, start: Int, count: Int, type: String, cap: Int) -> Unit,
    onSubmit: (SmartBlockAutoFillRequestDto) -> Unit
) {
    var blockName by remember { mutableStateOf("Main Academic Block") }
    var blockCode by remember { mutableStateOf("BLK-A") }
    var floorsCountStr by remember { mutableStateOf("3") }
    var roomsPerFloorStr by remember { mutableStateOf("10") }
    var startNumStr by remember { mutableStateOf("101") }
    var pattern by remember { mutableStateOf("A-{number}") }
    var selectedType by remember { mutableStateOf("classroom") }
    var capacityStr by remember { mutableStateOf("60") }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = Color.White
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 8.dp)
                .verticalScroll(rememberScrollState())
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Smart Campus Auto-Fill",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = FaflowNavy
                )
                IconButton(onClick = onDismiss) {
                    Icon(Icons.Default.Close, contentDescription = "Close")
                }
            }
            Text(
                text = "Generates complete block, floor hierarchies, and rooms in one atomic transaction.",
                fontSize = 12.sp,
                color = Color.Gray
            )
            Spacer(modifier = Modifier.height(16.dp))

            // Inputs
            OutlinedTextField(
                value = blockName,
                onValueChange = { blockName = it },
                label = { Text("Block Name") },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(8.dp)
            )
            Spacer(modifier = Modifier.height(8.dp))

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = blockCode,
                    onValueChange = { blockCode = it },
                    label = { Text("Block Code") },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(8.dp)
                )
                OutlinedTextField(
                    value = floorsCountStr,
                    onValueChange = { floorsCountStr = it },
                    label = { Text("Floors (1-10)") },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(8.dp)
                )
            }
            Spacer(modifier = Modifier.height(8.dp))

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = roomsPerFloorStr,
                    onValueChange = { roomsPerFloorStr = it },
                    label = { Text("Rooms/Floor") },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(8.dp)
                )
                OutlinedTextField(
                    value = startNumStr,
                    onValueChange = { startNumStr = it },
                    label = { Text("Start Number") },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(8.dp)
                )
            }
            Spacer(modifier = Modifier.height(8.dp))

            OutlinedTextField(
                value = pattern,
                onValueChange = { pattern = it },
                label = { Text("Numbering Pattern (e.g. A-{number} or CS-{number:02d})") },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(8.dp)
            )
            Spacer(modifier = Modifier.height(8.dp))

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = selectedType,
                    onValueChange = { selectedType = it },
                    label = { Text("Default Room Type") },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(8.dp)
                )
                OutlinedTextField(
                    value = capacityStr,
                    onValueChange = { capacityStr = it },
                    label = { Text("Capacity") },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(8.dp)
                )
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Live Preview Section
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "GENERATION PREVIEW",
                    fontWeight = FontWeight.Bold,
                    fontSize = 11.sp,
                    color = FaflowNavy
                )
                TextButton(onClick = {
                    val start = startNumStr.toIntOrNull() ?: 101
                    val count = roomsPerFloorStr.toIntOrNull() ?: 10
                    val cap = capacityStr.toIntOrNull() ?: 60
                    onPreviewRequest(pattern, start, count, selectedType, cap)
                }) {
                    Text("Test Pattern")
                }
            }

            if (isPreviewLoading) {
                LinearProgressIndicator(modifier = Modifier.fillMaxWidth(), color = FaflowNavy)
            } else if (preview != null) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFF5F7FA)),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Column(modifier = Modifier.padding(10.dp)) {
                        Text(
                            text = "Sample Room Numbers: ${preview.validCount} valid, ${preview.conflictCount} conflicts",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = if (preview.conflictCount > 0) Color.Red else Color(0xFF2E7D32)
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        val sampleText = preview.items.take(8).joinToString(", ") { it.roomNumber }
                        Text(text = sampleText, fontSize = 12.sp, color = Color.DarkGray)
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            Button(
                onClick = {
                    val floors = floorsCountStr.toIntOrNull() ?: 3
                    val roomsPerFloor = roomsPerFloorStr.toIntOrNull() ?: 10
                    val startNum = startNumStr.toIntOrNull() ?: 101
                    val cap = capacityStr.toIntOrNull() ?: 60

                    val floorConfigs = (0 until floors).map { fIndex ->
                        val fName = when (fIndex) {
                            0 -> "Ground Floor"
                            1 -> "First Floor"
                            2 -> "Second Floor"
                            3 -> "Third Floor"
                            else -> "Floor $fIndex"
                        }
                        val floorStart = if (fIndex == 0 && startNum >= 100) 1 else startNum + (fIndex * 100)
                        SmartFloorConfigDto(
                            floorNumber = fIndex,
                            floorName = fName,
                            roomCount = roomsPerFloor,
                            startNum = floorStart,
                            pattern = pattern,
                            roomType = selectedType,
                            capacity = cap
                        )
                    }

                    onSubmit(
                        SmartBlockAutoFillRequestDto(
                            blockName = blockName,
                            blockCode = blockCode,
                            floors = floorConfigs
                        )
                    )
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp),
                colors = ButtonDefaults.buttonColors(containerColor = FaflowNavy),
                shape = RoundedCornerShape(8.dp)
            ) {
                Text("Generate Structure", fontWeight = FontWeight.Bold, fontSize = 15.sp)
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BulkAssignBottomSheet(
    selectedCount: Int,
    onDismiss: () -> Unit,
    onSubmit: (BulkRoomAssignRequestDto) -> Unit
) {
    var roomType by remember { mutableStateOf("classroom") }
    var isExamEligible by remember { mutableStateOf(false) }
    var examCapacityStr by remember { mutableStateOf("55") }
    var requiredInvigilatorsStr by remember { mutableStateOf("2") }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = Color.White
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp)
        ) {
            Text(
                text = "Bulk Room Classification",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = FaflowNavy
            )
            Text(
                text = "Applying changes to $selectedCount selected rooms.",
                fontSize = 12.sp,
                color = Color.Gray
            )
            Spacer(modifier = Modifier.height(16.dp))

            // Room Types Row
            Text(text = "Target Room Type", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            Spacer(modifier = Modifier.height(6.dp))
            Row(modifier = Modifier.horizontalScroll(rememberScrollState())) {
                listOf("classroom", "laboratory", "examination_hall", "seminar_hall", "other").forEach { type ->
                    FilterChip(
                        selected = roomType == type,
                        onClick = {
                            roomType = type
                            if (type == "examination_hall") isExamEligible = true
                        },
                        label = { Text(type.replace("_", " ").capitalize()) },
                        modifier = Modifier.padding(end = 6.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            Row(verticalAlignment = Alignment.CenterVertically) {
                Checkbox(
                    checked = isExamEligible,
                    onCheckedChange = { isExamEligible = it },
                    colors = CheckboxDefaults.colors(checkedColor = FaflowNavy)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text("Mark as Exam Eligible Hall", fontSize = 13.sp, fontWeight = FontWeight.Medium)
            }

            if (isExamEligible) {
                Spacer(modifier = Modifier.height(8.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = examCapacityStr,
                        onValueChange = { examCapacityStr = it },
                        label = { Text("Exam Capacity") },
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = requiredInvigilatorsStr,
                        onValueChange = { requiredInvigilatorsStr = it },
                        label = { Text("Req. Invigilators") },
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            Button(
                onClick = {
                    onSubmit(
                        BulkRoomAssignRequestDto(
                            roomIds = emptyList(), // Filled by caller
                            roomType = roomType,
                            isExamEligible = isExamEligible,
                            examCapacity = if (isExamEligible) examCapacityStr.toIntOrNull() else null,
                            requiredInvigilators = if (isExamEligible) requiredInvigilatorsStr.toIntOrNull() else null
                        )
                    )
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp),
                colors = ButtonDefaults.buttonColors(containerColor = FaflowNavy),
                shape = RoundedCornerShape(8.dp)
            ) {
                Text("Apply to $selectedCount Rooms", fontWeight = FontWeight.Bold)
            }

            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

@Composable
fun DuplicateBlockDialog(
    sourceBlock: StructureBlockNode,
    onDismiss: () -> Unit,
    onSubmit: (DuplicateBlockRequestDto) -> Unit
) {
    var newName by remember { mutableStateOf("${sourceBlock.name} Clone") }
    var newCode by remember { mutableStateOf("${sourceBlock.code}-B") }
    var replaceFrom by remember { mutableStateOf(sourceBlock.code.take(1) + "-") }
    var replaceTo by remember { mutableStateOf("B-") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Duplicate Block Layout") },
        text = {
            Column {
                Text(
                    text = "Duplicates the ${sourceBlock.floors.size} floors and room structure without student/teacher data.",
                    fontSize = 12.sp,
                    color = Color.Gray
                )
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(
                    value = newName,
                    onValueChange = { newName = it },
                    label = { Text("New Block Name") },
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = newCode,
                    onValueChange = { newCode = it },
                    label = { Text("New Block Code") },
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = replaceFrom,
                        onValueChange = { replaceFrom = it },
                        label = { Text("Prefix From") },
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = replaceTo,
                        onValueChange = { replaceTo = it },
                        label = { Text("Prefix To") },
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    onSubmit(
                        DuplicateBlockRequestDto(
                            newBlockName = newName,
                            newBlockCode = newCode,
                            prefixReplaceFrom = replaceFrom.ifBlank { null },
                            prefixReplaceTo = replaceTo.ifBlank { null }
                        )
                    )
                },
                colors = ButtonDefaults.buttonColors(containerColor = FaflowNavy)
            ) {
                Text("Duplicate")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RoomDetailBottomSheet(
    room: CampusRoomDto,
    onDismiss: () -> Unit
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = Color.White
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = room.roomNumber,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = FaflowNavy
                    )
                    room.roomName?.let {
                        Text(text = it, fontSize = 13.sp, color = Color.Gray)
                    }
                }
                IconButton(onClick = onDismiss) {
                    Icon(Icons.Default.Close, contentDescription = "Close")
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            DetailItem("Hierarchy", room.locationHierarchy ?: "${room.blockName ?: "Block"} · ${room.floorName ?: "Floor"}")
            DetailItem("Room Type", room.roomType.replace("_", " ").capitalize())
            DetailItem("Standard Capacity", "${room.capacity} students")

            if (room.isExamEligible) {
                DetailItem("Exam Eligible", "Yes (Capacity: ${room.examCapacity ?: room.capacity})")
                DetailItem("Required Invigilators", "${room.requiredInvigilators} teachers")
            }

            room.departmentName?.let {
                DetailItem("Department", it)
            }
            room.primaryClassName?.let {
                DetailItem("Primary Class", it)
            }

            Spacer(modifier = Modifier.height(20.dp))
        }
    }
}

@Composable
fun DetailItem(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(text = label, fontSize = 12.sp, color = Color.Gray)
        Text(text = value, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = Color(0xFF263238))
    }
}

private fun findRoomInTree(tree: CampusStructureTreeResponse?, roomId: Int): CampusRoomDto? {
    if (tree == null) return null
    for (block in tree.blocks) {
        for (floor in block.floors) {
            for (room in floor.rooms) {
                if (room.id == roomId) return room
            }
        }
    }
    return null
}
