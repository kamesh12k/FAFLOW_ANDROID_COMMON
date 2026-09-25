package com.governence.faflow.ui.viewmodels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.governence.faflow.core.network.CampusDutyDto
import com.governence.faflow.core.network.DutyCandidateDto
import com.governence.faflow.core.network.NetworkResult
import com.governence.faflow.faflow.data.CampusDutyRepositoryImpl
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.LocalDate

data class DutyUiState(
    val isLoading: Boolean = false,
    val isRefreshing: Boolean = false,
    val duties: List<CampusDutyDto> = emptyList(),
    val filteredDuties: List<CampusDutyDto> = emptyList(),
    val selectedTab: String = "ALL", // "ALL", "TODAY", "UPCOMING"
    val selectedDuty: CampusDutyDto? = null,
    val isLoadingDetail: Boolean = false,
    val candidates: List<DutyCandidateDto> = emptyList(),
    val isLoadingCandidates: Boolean = false,
    val isActionLoading: Boolean = false,
    val errorMessage: String? = null,
    val successMessage: String? = null
)

class DutyViewModel(
    private val repository: CampusDutyRepositoryImpl
) : ViewModel() {

    private val _uiState = MutableStateFlow(DutyUiState())
    val uiState: StateFlow<DutyUiState> = _uiState.asStateFlow()

    init {
        loadMyDuties()
    }

    fun loadMyDuties() {
        _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
        viewModelScope.launch {
            when (val res = repository.getMyDuties()) {
                is NetworkResult.Success -> {
                    val duties = res.data
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        duties = duties,
                        filteredDuties = filterDuties(duties, _uiState.value.selectedTab)
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

    fun refreshDuties() {
        _uiState.value = _uiState.value.copy(isRefreshing = true, errorMessage = null)
        viewModelScope.launch {
            when (val res = repository.getMyDuties()) {
                is NetworkResult.Success -> {
                    val duties = res.data
                    _uiState.value = _uiState.value.copy(
                        isRefreshing = false,
                        duties = duties,
                        filteredDuties = filterDuties(duties, _uiState.value.selectedTab)
                    )
                }
                is NetworkResult.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isRefreshing = false,
                        errorMessage = res.message
                    )
                }
                NetworkResult.Loading -> Unit
            }
        }
    }

    fun setFilterTab(tab: String) {
        _uiState.value = _uiState.value.copy(
            selectedTab = tab,
            filteredDuties = filterDuties(_uiState.value.duties, tab)
        )
    }

    fun loadDutyDetail(dutyId: Int) {
        _uiState.value = _uiState.value.copy(isLoadingDetail = true, errorMessage = null)
        viewModelScope.launch {
            when (val res = repository.getDutyDetail(dutyId)) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isLoadingDetail = false,
                        selectedDuty = res.data
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

    fun loadCandidates(dutyId: Int) {
        _uiState.value = _uiState.value.copy(isLoadingCandidates = true, errorMessage = null)
        viewModelScope.launch {
            when (val res = repository.getDutyCandidates(dutyId)) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isLoadingCandidates = false,
                        candidates = res.data.candidates
                    )
                }
                is NetworkResult.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isLoadingCandidates = false,
                        errorMessage = res.message
                    )
                }
                NetworkResult.Loading -> Unit
            }
        }
    }

    fun autoAssign(dutyId: Int) {
        _uiState.value = _uiState.value.copy(isActionLoading = true, errorMessage = null, successMessage = null)
        viewModelScope.launch {
            when (val res = repository.autoAssignDuty(dutyId)) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isActionLoading = false,
                        selectedDuty = res.data,
                        successMessage = "Auto-assignment completed successfully!"
                    )
                    loadMyDuties()
                }
                is NetworkResult.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isActionLoading = false,
                        errorMessage = res.message
                    )
                }
                NetworkResult.Loading -> Unit
            }
        }
    }

    fun assignTeacher(dutyId: Int, teacherId: Int, reason: String? = null) {
        _uiState.value = _uiState.value.copy(isActionLoading = true, errorMessage = null)
        viewModelScope.launch {
            when (val res = repository.assignTeacher(dutyId, teacherId, reason)) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isActionLoading = false,
                        successMessage = "Teacher assigned successfully!"
                    )
                    loadDutyDetail(dutyId)
                    loadMyDuties()
                }
                is NetworkResult.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isActionLoading = false,
                        errorMessage = res.message
                    )
                }
                NetworkResult.Loading -> Unit
            }
        }
    }

    fun lockAssignment(dutyId: Int, assignmentId: Int, reason: String? = null) {
        _uiState.value = _uiState.value.copy(isActionLoading = true, errorMessage = null)
        viewModelScope.launch {
            when (val res = repository.lockAssignment(dutyId, assignmentId, reason)) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isActionLoading = false,
                        successMessage = "Assignment locked successfully."
                    )
                    loadDutyDetail(dutyId)
                    loadMyDuties()
                }
                is NetworkResult.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isActionLoading = false,
                        errorMessage = res.message
                    )
                }
                NetworkResult.Loading -> Unit
            }
        }
    }

    fun unlockAssignment(dutyId: Int, assignmentId: Int) {
        _uiState.value = _uiState.value.copy(isActionLoading = true, errorMessage = null)
        viewModelScope.launch {
            when (val res = repository.unlockAssignment(dutyId, assignmentId)) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isActionLoading = false,
                        successMessage = "Assignment unlocked."
                    )
                    loadDutyDetail(dutyId)
                    loadMyDuties()
                }
                is NetworkResult.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isActionLoading = false,
                        errorMessage = res.message
                    )
                }
                NetworkResult.Loading -> Unit
            }
        }
    }

    fun overrideAssignment(dutyId: Int, assignmentId: Int, newTeacherId: Int, reason: String) {
        _uiState.value = _uiState.value.copy(isActionLoading = true, errorMessage = null)
        viewModelScope.launch {
            when (val res = repository.overrideAssignment(dutyId, assignmentId, newTeacherId, reason)) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isActionLoading = false,
                        successMessage = "Assignment overridden successfully."
                    )
                    loadDutyDetail(dutyId)
                    loadMyDuties()
                }
                is NetworkResult.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isActionLoading = false,
                        errorMessage = res.message
                    )
                }
                NetworkResult.Loading -> Unit
            }
        }
    }

    fun replaceAssignment(dutyId: Int, assignmentId: Int, reason: String? = null) {
        _uiState.value = _uiState.value.copy(isActionLoading = true, errorMessage = null)
        viewModelScope.launch {
            when (val res = repository.replaceAssignment(dutyId, assignmentId, reason)) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isActionLoading = false,
                        successMessage = "Replacement assigned."
                    )
                    loadDutyDetail(dutyId)
                    loadMyDuties()
                }
                is NetworkResult.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isActionLoading = false,
                        errorMessage = res.message
                    )
                }
                NetworkResult.Loading -> Unit
            }
        }
    }

    fun clearMessages() {
        _uiState.value = _uiState.value.copy(errorMessage = null, successMessage = null)
    }

    private fun filterDuties(duties: List<CampusDutyDto>, tab: String): List<CampusDutyDto> {
        val todayStr = try {
            LocalDate.now().toString()
        } catch (e: Exception) {
            ""
        }
        return when (tab) {
            "TODAY" -> duties.filter { it.dutyDate == todayStr }
            "UPCOMING" -> duties.filter { it.dutyDate >= todayStr }
            else -> duties
        }
    }
}
