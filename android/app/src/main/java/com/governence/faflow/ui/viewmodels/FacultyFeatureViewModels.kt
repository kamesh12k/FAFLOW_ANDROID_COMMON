package com.governence.faflow.ui.viewmodels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.governence.faflow.auth.data.AuthRepository
import com.governence.faflow.core.network.NetworkResult
import com.governence.faflow.core.network.NotificationOutDto
import com.governence.faflow.core.network.SubstitutionPreferenceUpdateDto
import com.governence.faflow.domain.model.CreditTransaction
import com.governence.faflow.domain.model.LeaveRequest
import com.governence.faflow.faflow.CreditRepository
import com.governence.faflow.faflow.data.AcademicSummaryRepository
import com.governence.faflow.faflow.data.LeaveRepositoryImpl
import com.governence.faflow.faflow.data.NotificationRepositoryImpl
import com.governence.faflow.faflow.data.PreferencesRepositoryImpl
import com.governence.faflow.faflow.data.SubstitutionRepositoryImpl
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

// ---------- Leave ViewModel ----------

data class LeaveUiState(
    val isLoading: Boolean = false,
    val myLeaves: List<LeaveRequest> = emptyList(),
    val isSubmittedSuccessfully: Boolean = false,
    val resolvedDayOrder: Int? = null,
    val errorMessage: String? = null
)

class LeaveViewModel(
    private val leaveRepository: LeaveRepositoryImpl,
    private val academicSummaryRepository: AcademicSummaryRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(LeaveUiState())
    val uiState: StateFlow<LeaveUiState> = _uiState.asStateFlow()

    init {
        loadMyLeaves()
    }

    fun loadMyLeaves() {
        _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
        viewModelScope.launch {
            when (val res = leaveRepository.getMyLeaves()) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(isLoading = false, myLeaves = res.data)
                }
                is NetworkResult.Error -> {
                    _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = res.message)
                }
                NetworkResult.Loading -> Unit
            }
        }
    }

    fun resolveDateDayOrder(date: String) {
        viewModelScope.launch {
            when (val res = academicSummaryRepository.resolveDate(date)) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(resolvedDayOrder = res.data.dayOrder)
                }
                is NetworkResult.Error -> Unit
                NetworkResult.Loading -> Unit
            }
        }
    }

    fun submitLeave(date: String, periodNumber: Int, reason: String, onComplete: () -> Unit) {
        _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
        viewModelScope.launch {
            when (val res = leaveRepository.applyLeave(date, periodNumber, reason)) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(isLoading = false, isSubmittedSuccessfully = true)
                    loadMyLeaves()
                    onComplete()
                }
                is NetworkResult.Error -> {
                    _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = res.message)
                }
                NetworkResult.Loading -> Unit
            }
        }
    }

    fun cancelLeave(leaveId: Int) {
        viewModelScope.launch {
            when (leaveRepository.cancelLeave(leaveId)) {
                is NetworkResult.Success -> loadMyLeaves()
                is NetworkResult.Error -> Unit
                NetworkResult.Loading -> Unit
            }
        }
    }
}

// ---------- Credits ViewModel ----------

data class CreditsUiState(
    val isLoading: Boolean = false,
    val balance: Int = 0,
    val transactions: List<CreditTransaction> = emptyList(),
    val errorMessage: String? = null
)

class CreditsViewModel(
    private val authRepository: AuthRepository,
    private val creditRepository: CreditRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(CreditsUiState())
    val uiState: StateFlow<CreditsUiState> = _uiState.asStateFlow()

    init {
        loadCredits()
    }

    fun loadCredits() {
        val staffId = authRepository.getStoredStaffInfo()?.id ?: return
        _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
        viewModelScope.launch {
            // Load balance
            when (val bRes = creditRepository.getCreditBalance(staffId)) {
                is NetworkResult.Success -> _uiState.value = _uiState.value.copy(balance = bRes.data)
                is NetworkResult.Error -> Unit
                NetworkResult.Loading -> Unit
            }

            // Load transactions
            when (val tRes = creditRepository.getCreditTransactions()) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(isLoading = false, transactions = tRes.data)
                }
                is NetworkResult.Error -> {
                    _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = tRes.message)
                }
                NetworkResult.Loading -> Unit
            }
        }
    }
}

// ---------- Substitution ViewModel ----------

data class SubstitutionUiState(
    val isLoading: Boolean = false,
    val duties: List<LeaveRequest> = emptyList(),
    val errorMessage: String? = null
)

class SubstitutionViewModel(
    private val substitutionRepository: SubstitutionRepositoryImpl
) : ViewModel() {

    private val _uiState = MutableStateFlow(SubstitutionUiState())
    val uiState: StateFlow<SubstitutionUiState> = _uiState.asStateFlow()

    init {
        loadDuties()
    }

    fun loadDuties() {
        _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
        viewModelScope.launch {
            when (val res = substitutionRepository.getMyDuties()) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(isLoading = false, duties = res.data)
                }
                is NetworkResult.Error -> {
                    _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = res.message)
                }
                NetworkResult.Loading -> Unit
            }
        }
    }
}

// ---------- Preferences ViewModel ----------

data class PreferencesUiState(
    val isLoading: Boolean = false,
    val maxPerDay: Int = 2,
    val maxPerWeek: Int = 6,
    val crossDept: Boolean = false,
    val isSaved: Boolean = false,
    val errorMessage: String? = null
)

class PreferencesViewModel(
    private val preferencesRepository: PreferencesRepositoryImpl
) : ViewModel() {

    private val _uiState = MutableStateFlow(PreferencesUiState())
    val uiState: StateFlow<PreferencesUiState> = _uiState.asStateFlow()

    init {
        loadPreferences()
    }

    fun loadPreferences() {
        _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
        viewModelScope.launch {
            when (val res = preferencesRepository.getPreferences()) {
                is NetworkResult.Success -> {
                    val p = res.data
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        maxPerDay = p.maxSubstitutionsPerDay ?: 2,
                        maxPerWeek = p.maxSubstitutionsPerWeek ?: 6,
                        crossDept = p.willingForCrossDepartment ?: false
                    )
                }
                is NetworkResult.Error -> {
                    _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = res.message)
                }
                NetworkResult.Loading -> Unit
            }
        }
    }

    fun savePreferences(day: Int, week: Int, cross: Boolean, onComplete: () -> Unit) {
        _uiState.value = _uiState.value.copy(isLoading = true)
        viewModelScope.launch {
            when (val res = preferencesRepository.updatePreferences(day, week, cross)) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(isLoading = false, isSaved = true)
                    onComplete()
                }
                is NetworkResult.Error -> {
                    _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = res.message)
                }
                NetworkResult.Loading -> Unit
            }
        }
    }
}

// ---------- Notifications ViewModel ----------

data class NotificationsUiState(
    val isLoading: Boolean = false,
    val notifications: List<NotificationOutDto> = emptyList(),
    val unreadCount: Int = 0,
    val errorMessage: String? = null
)

class NotificationsViewModel(
    private val notificationRepository: NotificationRepositoryImpl
) : ViewModel() {

    private val _uiState = MutableStateFlow(NotificationsUiState())
    val uiState: StateFlow<NotificationsUiState> = _uiState.asStateFlow()

    init {
        loadNotifications()
    }

    fun loadNotifications() {
        _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
        viewModelScope.launch {
            when (val res = notificationRepository.getNotifications()) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(isLoading = false, notifications = res.data)
                }
                is NetworkResult.Error -> {
                    _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = res.message)
                }
                NetworkResult.Loading -> Unit
            }

            when (val countRes = notificationRepository.getUnreadCount()) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(unreadCount = countRes.data)
                }
                is NetworkResult.Error -> Unit
                NetworkResult.Loading -> Unit
            }
        }
    }

    fun markRead(id: Int) {
        viewModelScope.launch {
            notificationRepository.markAsRead(id)
            loadNotifications()
        }
    }
}
