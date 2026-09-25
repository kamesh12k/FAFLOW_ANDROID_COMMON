package com.governence.faflow.ui.viewmodels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.governence.faflow.core.network.AnnouncementDetailDto
import com.governence.faflow.core.network.AnnouncementListItemDto
import com.governence.faflow.core.network.NetworkResult
import com.governence.faflow.faflow.data.AnnouncementRepositoryImpl
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class AnnouncementsUiState(
    val isLoading: Boolean = false,
    val announcements: List<AnnouncementListItemDto> = emptyList(),
    val filteredAnnouncements: List<AnnouncementListItemDto> = emptyList(),
    val selectedTab: String = "all", // "all", "unread", "important"
    val searchQuery: String = "",
    val unreadCount: Int = 0,
    val selectedDetail: AnnouncementDetailDto? = null,
    val isLoadingDetail: Boolean = false,
    val isAcknowledging: Boolean = false,
    val errorMessage: String? = null
)

class AnnouncementsViewModel(
    private val announcementRepository: AnnouncementRepositoryImpl
) : ViewModel() {

    private val _uiState = MutableStateFlow(AnnouncementsUiState())
    val uiState: StateFlow<AnnouncementsUiState> = _uiState.asStateFlow()

    init {
        loadAnnouncements()
    }

    fun loadAnnouncements() {
        _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
        viewModelScope.launch {
            // Load unread count
            when (val unreadRes = announcementRepository.getUnreadCount()) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(unreadCount = unreadRes.data)
                }
                else -> Unit
            }

            // Load feed
            when (val res = announcementRepository.getAnnouncements(
                tab = _uiState.value.selectedTab,
                search = _uiState.value.searchQuery.ifBlank { null }
            )) {
                is NetworkResult.Success -> {
                    val list = res.data
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        announcements = list,
                        filteredAnnouncements = applyLocalFilter(list, _uiState.value.selectedTab, _uiState.value.searchQuery)
                    )
                }
                is NetworkResult.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = res.message
                    )
                }
                NetworkResult.Loading -> Unit
            }
        }
    }

    fun setTab(tab: String) {
        _uiState.value = _uiState.value.copy(
            selectedTab = tab,
            filteredAnnouncements = applyLocalFilter(_uiState.value.announcements, tab, _uiState.value.searchQuery)
        )
        // Also trigger network query for tabs requiring server scoping
        loadAnnouncements()
    }

    fun setSearchQuery(query: String) {
        _uiState.value = _uiState.value.copy(
            searchQuery = query,
            filteredAnnouncements = applyLocalFilter(_uiState.value.announcements, _uiState.value.selectedTab, query)
        )
    }

    fun loadDetail(announcementId: Int) {
        _uiState.value = _uiState.value.copy(isLoadingDetail = true)
        viewModelScope.launch {
            when (val res = announcementRepository.getAnnouncementDetail(announcementId)) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isLoadingDetail = false,
                        selectedDetail = res.data
                    )
                    // Mark as read in local list
                    val updated = _uiState.value.announcements.map {
                        if (it.id == announcementId) it.copy(isRead = true) else it
                    }
                    _uiState.value = _uiState.value.copy(
                        announcements = updated,
                        filteredAnnouncements = applyLocalFilter(updated, _uiState.value.selectedTab, _uiState.value.searchQuery),
                        unreadCount = maxOf(0, _uiState.value.unreadCount - 1)
                    )
                }
                is NetworkResult.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isLoadingDetail = false,
                        errorMessage = res.message
                    )
                }
                NetworkResult.Loading -> Unit
            }
        }
    }

    fun dismissDetail() {
        _uiState.value = _uiState.value.copy(selectedDetail = null)
    }

    fun acknowledgeAnnouncement(announcementId: Int) {
        _uiState.value = _uiState.value.copy(isAcknowledging = true)
        viewModelScope.launch {
            when (val res = announcementRepository.acknowledgeAnnouncement(announcementId)) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isAcknowledging = false,
                        selectedDetail = res.data
                    )
                    val updated = _uiState.value.announcements.map {
                        if (it.id == announcementId) it.copy(isAcknowledged = true) else it
                    }
                    _uiState.value = _uiState.value.copy(
                        announcements = updated,
                        filteredAnnouncements = applyLocalFilter(updated, _uiState.value.selectedTab, _uiState.value.searchQuery)
                    )
                }
                is NetworkResult.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isAcknowledging = false,
                        errorMessage = res.message
                    )
                }
                NetworkResult.Loading -> Unit
            }
        }
    }

    private fun applyLocalFilter(
        list: List<AnnouncementListItemDto>,
        tab: String,
        query: String
    ): List<AnnouncementListItemDto> {
        return list.filter { item ->
            val matchesTab = when (tab) {
                "unread" -> !item.isRead
                "important" -> item.priority.equals("URGENT", ignoreCase = true) || item.priority.equals("HIGH", ignoreCase = true) || item.isPinned
                else -> true
            }
            val matchesQuery = query.isBlank() ||
                    item.title.contains(query, ignoreCase = true) ||
                    item.bodySnippet.contains(query, ignoreCase = true) ||
                    item.authorName.contains(query, ignoreCase = true)

            matchesTab && matchesQuery
        }
    }
}
