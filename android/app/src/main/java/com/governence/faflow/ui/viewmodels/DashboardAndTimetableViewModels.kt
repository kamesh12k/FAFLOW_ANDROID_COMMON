package com.governence.faflow.ui.viewmodels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.governence.faflow.auth.data.AuthRepository
import com.governence.faflow.core.network.NetworkResult
import com.governence.faflow.core.network.TeacherTodaySummaryDto
import com.governence.faflow.domain.model.StaffMember
import com.governence.faflow.domain.model.TimetableSlot
import com.governence.faflow.faflow.CreditRepository
import com.governence.faflow.faflow.SubstitutionRepository
import com.governence.faflow.faflow.TimetableRepository
import com.governence.faflow.faflow.data.AcademicSummaryRepository
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class DashboardUiState(
    val isLoading: Boolean = false,
    val isRefreshing: Boolean = false,
    val staff: StaffMember? = null,
    val todaySummary: TeacherTodaySummaryDto? = null,
    val isSummaryLoading: Boolean = false,
    val todaySlots: List<TimetableSlot> = emptyList(),
    val isTimetableLoading: Boolean = false,
    val creditBalance: Int = 0,
    val isCreditsLoading: Boolean = false,
    val activeDutiesCount: Int = 0,
    val isDutiesLoading: Boolean = false,
    val errorMessage: String? = null,
    val isOfflineOrUnreachable: Boolean = false
)

class DashboardViewModel(
    private val authRepository: AuthRepository,
    private val academicSummaryRepository: AcademicSummaryRepository,
    private val timetableRepository: TimetableRepository,
    private val creditRepository: CreditRepository,
    private val substitutionRepository: SubstitutionRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(DashboardUiState())
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    init {
        // Stage 1: Load cached local profile shell immediately
        val cachedStaff = authRepository.getStoredStaffInfo()
        _uiState.value = _uiState.value.copy(staff = cachedStaff)
        loadDashboardData(isRefresh = false)
    }

    fun retry() {
        loadDashboardData(isRefresh = false)
    }

    fun refresh() {
        loadDashboardData(isRefresh = true)
    }

    fun loadDashboardData(isRefresh: Boolean = false) {
        val currentStaff = authRepository.getStoredStaffInfo()
        _uiState.value = _uiState.value.copy(
            isLoading = !isRefresh,
            isRefreshing = isRefresh,
            staff = currentStaff,
            errorMessage = null,
            isOfflineOrUnreachable = false,
            isSummaryLoading = true,
            isCreditsLoading = true,
            isDutiesLoading = true
        )

        viewModelScope.launch {
            val staffId = currentStaff?.id
            if (staffId == null) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    isRefreshing = false,
                    isSummaryLoading = false,
                    isCreditsLoading = false,
                    isDutiesLoading = false
                )
                return@launch
            }

            // Stage 2: Staged concurrent requests for independent sections
            val summaryDeferred = async { academicSummaryRepository.getMyTodaySummary() }
            val creditDeferred = async { creditRepository.getCreditBalance(staffId) }
            val dutyDeferred = async { substitutionRepository.getMyDuties() }

            var hasConnectionError = false

            // Process Summary & Timetable
            val summaryRes = summaryDeferred.await()
            when (summaryRes) {
                is NetworkResult.Success -> {
                    val summary = summaryRes.data
                    _uiState.value = _uiState.value.copy(
                        todaySummary = summary,
                        isSummaryLoading = false
                    )

                    // Asynchronously fetch timetable for today's Day Order
                    if (summary.dayOrder != null) {
                        _uiState.value = _uiState.value.copy(isTimetableLoading = true)
                        when (val ttRes = timetableRepository.getTimetableByDayOrder(staffId, summary.dayOrder)) {
                            is NetworkResult.Success -> {
                                _uiState.value = _uiState.value.copy(
                                    todaySlots = ttRes.data,
                                    isTimetableLoading = false
                                )
                            }
                            is NetworkResult.Error -> {
                                _uiState.value = _uiState.value.copy(isTimetableLoading = false)
                            }
                            NetworkResult.Loading -> Unit
                        }
                    }
                }
                is NetworkResult.Error -> {
                    if (summaryRes.code == -1) hasConnectionError = true
                    _uiState.value = _uiState.value.copy(isSummaryLoading = false)
                }
                NetworkResult.Loading -> Unit
            }

            // Process Credits
            when (val creditRes = creditDeferred.await()) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        creditBalance = creditRes.data,
                        isCreditsLoading = false
                    )
                }
                is NetworkResult.Error -> {
                    if (creditRes.code == -1) hasConnectionError = true
                    _uiState.value = _uiState.value.copy(isCreditsLoading = false)
                }
                NetworkResult.Loading -> Unit
            }

            // Process Substitution Duties
            when (val dutyRes = dutyDeferred.await()) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        activeDutiesCount = dutyRes.data.size,
                        isDutiesLoading = false
                    )
                }
                is NetworkResult.Error -> {
                    if (dutyRes.code == -1) hasConnectionError = true
                    _uiState.value = _uiState.value.copy(isDutiesLoading = false)
                }
                NetworkResult.Loading -> Unit
            }

            _uiState.value = _uiState.value.copy(
                isLoading = false,
                isRefreshing = false,
                isOfflineOrUnreachable = hasConnectionError,
                errorMessage = if (hasConnectionError) "Unable to connect to FAFLOW server. Please check your network connection." else null
            )
        }
    }
}

data class TimetableUiState(
    val isLoading: Boolean = false,
    val selectedDayOrder: Int = 1,
    val allSlots: List<TimetableSlot> = emptyList(),
    val daySlots: List<TimetableSlot> = emptyList(),
    val errorMessage: String? = null
)

class TimetableViewModel(
    private val authRepository: AuthRepository,
    private val timetableRepository: TimetableRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(TimetableUiState())
    val uiState: StateFlow<TimetableUiState> = _uiState.asStateFlow()

    init {
        loadTimetable()
    }

    fun retry() {
        loadTimetable()
    }

    fun loadTimetable() {
        val staffId = authRepository.getStoredStaffInfo()?.id ?: return
        _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)

        viewModelScope.launch {
            when (val res = timetableRepository.getTimetableForTeacher(staffId)) {
                is NetworkResult.Success -> {
                    val slots = res.data
                    val filtered = slots.filter { it.dayOrder == _uiState.value.selectedDayOrder }
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        allSlots = slots,
                        daySlots = filtered
                    )
                }
                is NetworkResult.Error -> {
                    val msg = if (res.code == -1) "Unable to connect to server. Check connection." else res.message
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = msg
                    )
                }
                NetworkResult.Loading -> Unit
            }
        }
    }

    fun selectDayOrder(dayOrder: Int) {
        val filtered = _uiState.value.allSlots.filter { it.dayOrder == dayOrder }
        _uiState.value = _uiState.value.copy(
            selectedDayOrder = dayOrder,
            daySlots = filtered
        )
    }
}
