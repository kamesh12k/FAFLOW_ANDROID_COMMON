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
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class DashboardUiState(
    val isLoading: Boolean = false,
    val isRefreshing: Boolean = false,
    val staff: StaffMember? = null,
    val todaySummary: TeacherTodaySummaryDto? = null,
    val todaySlots: List<TimetableSlot> = emptyList(),
    val creditBalance: Int = 0,
    val activeDutiesCount: Int = 0,
    val errorMessage: String? = null
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
            errorMessage = null
        )

        viewModelScope.launch {
            val staffId = currentStaff?.id ?: return@launch

            // 1. Fetch Today's Day Order & Summary from FAFLOW
            when (val summaryRes = academicSummaryRepository.getMyTodaySummary()) {
                is NetworkResult.Success -> {
                    val summary = summaryRes.data
                    _uiState.value = _uiState.value.copy(todaySummary = summary)

                    // 2. Fetch Timetable for Today's Day Order
                    if (summary.dayOrder != null) {
                        when (val ttRes = timetableRepository.getTimetableByDayOrder(staffId, summary.dayOrder)) {
                            is NetworkResult.Success -> {
                                _uiState.value = _uiState.value.copy(todaySlots = ttRes.data)
                            }
                            is NetworkResult.Error -> Unit
                            NetworkResult.Loading -> Unit
                        }
                    }
                }
                is NetworkResult.Error -> {
                    val msg = if (summaryRes.code == -1) "Unable to connect to FAFLOW server. Check network." else summaryRes.message
                    _uiState.value = _uiState.value.copy(errorMessage = msg)
                }
                NetworkResult.Loading -> Unit
            }

            // 3. Fetch Credit Balance
            when (val creditRes = creditRepository.getCreditBalance(staffId)) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(creditBalance = creditRes.data)
                }
                is NetworkResult.Error -> Unit
                NetworkResult.Loading -> Unit
            }

            // 4. Fetch Substitution Duties Count
            when (val dutyRes = substitutionRepository.getMyDuties()) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(activeDutiesCount = dutyRes.data.size)
                }
                is NetworkResult.Error -> Unit
                NetworkResult.Loading -> Unit
            }

            _uiState.value = _uiState.value.copy(isLoading = false, isRefreshing = false)
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
            when (val result = timetableRepository.getTimetableForTeacher(staffId)) {
                is NetworkResult.Success -> {
                    val slots = result.data
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        allSlots = slots,
                        daySlots = filterByDay(slots, _uiState.value.selectedDayOrder)
                    )
                }
                is NetworkResult.Error -> {
                    val msg = if (result.code == -1) "Unable to connect to server. Check network." else result.message
                    _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = msg)
                }
                NetworkResult.Loading -> Unit
            }
        }
    }

    fun selectDayOrder(dayOrder: Int) {
        _uiState.value = _uiState.value.copy(
            selectedDayOrder = dayOrder,
            daySlots = filterByDay(_uiState.value.allSlots, dayOrder)
        )
    }

    private fun filterByDay(slots: List<TimetableSlot>, dayOrder: Int): List<TimetableSlot> {
        return slots.filter { it.dayOrder == dayOrder }.sortedBy { it.periodNumber }
    }
}
