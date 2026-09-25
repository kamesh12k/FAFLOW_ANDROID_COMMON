package com.governence.faflow.ui.viewmodels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.governence.faflow.core.network.*
import com.governence.faflow.faflow.data.CampusStructureRepositoryImpl
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class CampusStructureUiState(
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val successMessage: String? = null,
    val tree: CampusStructureTreeResponse? = null,
    val metrics: CampusStructureMetricsDto? = null,
    val searchQuery: String = "",
    val searchResults: List<CampusSearchResultItemDto> = emptyList(),
    val isSearching: Boolean = false,
    val expandedBlockIds: Set<Int> = emptySet(),
    val expandedFloorIds: Set<Int> = emptySet(),
    val selectedRoom: CampusRoomDto? = null,
    val selectedRoomIds: Set<Int> = emptySet(),
    val isSmartAutofillOpen: Boolean = false,
    val isBulkAssignOpen: Boolean = false,
    val isDuplicateBlockOpen: Boolean = false,
    val duplicatingBlock: StructureBlockNode? = null,
    val patternPreview: PatternPreviewResponseDto? = null,
    val isPreviewLoading: Boolean = false
)

class CampusStructureViewModel(
    private val repository: CampusStructureRepositoryImpl
) : ViewModel() {

    private val _uiState = MutableStateFlow(CampusStructureUiState())
    val uiState: StateFlow<CampusStructureUiState> = _uiState.asStateFlow()

    init {
        loadStructure()
    }

    fun loadStructure() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            
            val treeResult = repository.getCampusStructureTree()
            val metricsResult = repository.getCampusStructureMetrics()

            var newTree: CampusStructureTreeResponse? = null
            var newMetrics: CampusStructureMetricsDto? = null
            var error: String? = null

            when (treeResult) {
                is NetworkResult.Success -> newTree = treeResult.data
                is NetworkResult.Error -> error = treeResult.message
                else -> {}
            }

            when (metricsResult) {
                is NetworkResult.Success -> newMetrics = metricsResult.data
                is NetworkResult.Error -> if (error == null) error = metricsResult.message
                else -> {}
            }

            val defaultExpandedBlocks = newTree?.blocks?.map { it.id }?.toSet() ?: emptySet()

            _uiState.update {
                it.copy(
                    isLoading = false,
                    tree = newTree ?: it.tree,
                    metrics = newMetrics ?: it.metrics,
                    errorMessage = error,
                    expandedBlockIds = if (it.expandedBlockIds.isEmpty()) defaultExpandedBlocks else it.expandedBlockIds
                )
            }
        }
    }

    fun toggleBlockExpanded(blockId: Int) {
        _uiState.update { state ->
            val updated = if (state.expandedBlockIds.contains(blockId)) {
                state.expandedBlockIds - blockId
            } else {
                state.expandedBlockIds + blockId
            }
            state.copy(expandedBlockIds = updated)
        }
    }

    fun toggleFloorExpanded(floorId: Int) {
        _uiState.update { state ->
            val updated = if (state.expandedFloorIds.contains(floorId)) {
                state.expandedFloorIds - floorId
            } else {
                state.expandedFloorIds + floorId
            }
            state.copy(expandedFloorIds = updated)
        }
    }

    fun toggleRoomSelected(roomId: Int) {
        _uiState.update { state ->
            val updated = if (state.selectedRoomIds.contains(roomId)) {
                state.selectedRoomIds - roomId
            } else {
                state.selectedRoomIds + roomId
            }
            state.copy(selectedRoomIds = updated)
        }
    }

    fun selectAllRoomsInFloor(floor: StructureFloorNode) {
        _uiState.update { state ->
            val floorRoomIds = floor.rooms.map { it.id }.toSet()
            val allSelected = floorRoomIds.all { state.selectedRoomIds.contains(it) }
            val updated = if (allSelected) {
                state.selectedRoomIds - floorRoomIds
            } else {
                state.selectedRoomIds + floorRoomIds
            }
            state.copy(selectedRoomIds = updated)
        }
    }

    fun clearRoomSelection() {
        _uiState.update { it.copy(selectedRoomIds = emptySet()) }
    }

    fun selectRoom(room: CampusRoomDto?) {
        _uiState.update { it.copy(selectedRoom = room) }
    }

    fun onSearchQueryChange(query: String) {
        _uiState.update { it.copy(searchQuery = query) }
        if (query.trim().length >= 2) {
            performSearch(query.trim())
        } else if (query.isBlank()) {
            _uiState.update { it.copy(searchResults = emptyList(), isSearching = false) }
        }
    }

    fun performSearch(query: String = _uiState.value.searchQuery) {
        if (query.isBlank()) return
        viewModelScope.launch {
            _uiState.update { it.copy(isSearching = true) }
            when (val res = repository.searchCampus(query)) {
                is NetworkResult.Success -> {
                    _uiState.update { it.copy(isSearching = false, searchResults = res.data.results) }
                }
                is NetworkResult.Error -> {
                    _uiState.update { it.copy(isSearching = false, errorMessage = res.message) }
                }
                else -> {
                    _uiState.update { it.copy(isSearching = false) }
                }
            }
        }
    }

    fun clearSearch() {
        _uiState.update { it.copy(searchQuery = "", searchResults = emptyList(), isSearching = false) }
    }

    fun openSmartAutofill() {
        _uiState.update { it.copy(isSmartAutofillOpen = true, patternPreview = null) }
    }

    fun closeSmartAutofill() {
        _uiState.update { it.copy(isSmartAutofillOpen = false, patternPreview = null) }
    }

    fun openBulkAssign() {
        if (_uiState.value.selectedRoomIds.isNotEmpty()) {
            _uiState.update { it.copy(isBulkAssignOpen = true) }
        }
    }

    fun closeBulkAssign() {
        _uiState.update { it.copy(isBulkAssignOpen = false) }
    }

    fun openDuplicateBlock(block: StructureBlockNode) {
        _uiState.update { it.copy(isDuplicateBlockOpen = true, duplicatingBlock = block) }
    }

    fun closeDuplicateBlock() {
        _uiState.update { it.copy(isDuplicateBlockOpen = false, duplicatingBlock = null) }
    }

    fun previewPattern(pattern: String, startNum: Int, count: Int, roomType: String, capacity: Int) {
        viewModelScope.launch {
            _uiState.update { it.copy(isPreviewLoading = true) }
            val req = RoomPatternPreviewRequestDto(
                pattern = pattern,
                startNum = startNum,
                count = count,
                roomType = roomType,
                capacity = capacity
            )
            when (val res = repository.previewRoomPattern(req)) {
                is NetworkResult.Success -> {
                    _uiState.update { it.copy(isPreviewLoading = false, patternPreview = res.data) }
                }
                is NetworkResult.Error -> {
                    _uiState.update { it.copy(isPreviewLoading = false, errorMessage = res.message) }
                }
                else -> {
                    _uiState.update { it.copy(isPreviewLoading = false) }
                }
            }
        }
    }

    fun submitSmartAutofill(request: SmartBlockAutoFillRequestDto, onSuccess: () -> Unit) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            when (val res = repository.smartAutofillBlock(request)) {
                is NetworkResult.Success -> {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            isSmartAutofillOpen = false,
                            successMessage = res.data.message
                        )
                    }
                    loadStructure()
                    onSuccess()
                }
                is NetworkResult.Error -> {
                    _uiState.update { it.copy(isLoading = false, errorMessage = res.message) }
                }
                else -> {
                    _uiState.update { it.copy(isLoading = false) }
                }
            }
        }
    }

    fun submitBulkAssign(request: BulkRoomAssignRequestDto, onSuccess: () -> Unit) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            when (val res = repository.bulkAssignRooms(request)) {
                is NetworkResult.Success -> {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            isBulkAssignOpen = false,
                            selectedRoomIds = emptySet(),
                            successMessage = res.data.message
                        )
                    }
                    loadStructure()
                    onSuccess()
                }
                is NetworkResult.Error -> {
                    _uiState.update { it.copy(isLoading = false, errorMessage = res.message) }
                }
                else -> {
                    _uiState.update { it.copy(isLoading = false) }
                }
            }
        }
    }

    fun submitDuplicateBlock(blockId: Int, request: DuplicateBlockRequestDto, onSuccess: () -> Unit) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            when (val res = repository.duplicateBlock(blockId, request)) {
                is NetworkResult.Success -> {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            isDuplicateBlockOpen = false,
                            duplicatingBlock = null,
                            successMessage = res.data.message
                        )
                    }
                    loadStructure()
                    onSuccess()
                }
                is NetworkResult.Error -> {
                    _uiState.update { it.copy(isLoading = false, errorMessage = res.message) }
                }
                else -> {
                    _uiState.update { it.copy(isLoading = false) }
                }
            }
        }
    }

    fun clearMessages() {
        _uiState.update { it.copy(errorMessage = null, successMessage = null) }
    }
}
