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
    val isOfflineOrUnreachable: Boolean = false,
    // Contextual Phase 2 Intelligence
    val activeSlot: TimetableSlot? = null,
    val nextUpcomingSlot: TimetableSlot? = null,
    val currentPeriodNumber: Int? = null,
    val isFreePeriod: Boolean = false,
    val shiftState: ShiftState = ShiftState.NOT_STARTED,
    val todayCheckInTime: String? = null,
    val todayWorkingDuration: String? = null,
    val pendingSyncCount: Int = 0,
    val urgentSubstituteDuties: List<com.governence.faflow.core.network.SubstituteDutyDto> = emptyList()
)

class DashboardViewModel(
    private val authRepository: AuthRepository,
    private val academicSummaryRepository: AcademicSummaryRepository,
    private val timetableRepository: TimetableRepository,
    private val creditRepository: CreditRepository,
    private val substitutionRepository: SubstitutionRepository,
    private val attendanceRepository: com.governence.faflow.attendance.data.AttendanceRepository? = null,
    private val studentAttendanceRepository: com.governence.faflow.attendance.student.data.StudentAttendanceRepository? = null
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

    private fun resolvePeriodIntelligence(
        slots: List<TimetableSlot>,
        serverCurrentPeriod: Int?
    ): Triple<Int?, TimetableSlot?, TimetableSlot?> {
        val cal = java.util.Calendar.getInstance()
        val minutesSinceMidnight = cal.get(java.util.Calendar.HOUR_OF_DAY) * 60 + cal.get(java.util.Calendar.MINUTE)

        // Calculate period based on standard academic timings or server authority
        val period = serverCurrentPeriod ?: when (minutesSinceMidnight) {
            in (8 * 60 + 15)..(9 * 60 + 25) -> 1
            in (9 * 60 + 25)..(10 * 60 + 20) -> 2
            in (10 * 60 + 20)..(11 * 60 + 30) -> 3
            in (11 * 60 + 30)..(12 * 60 + 25) -> 4
            in (12 * 60 + 25)..(14 * 60 + 10) -> 5
            in (14 * 60 + 10)..(15 * 60 + 5) -> 6
            in (15 * 60 + 5)..(16 * 60) -> 7
            in (16 * 60)..(16 * 60 + 50) -> 8
            else -> null
        }

        val active = if (period != null) slots.firstOrNull { it.periodNumber == period } else null
        val nextUpcoming = if (period != null) {
            slots.filter { it.periodNumber > period }.minByOrNull { it.periodNumber }
        } else if (minutesSinceMidnight < (8 * 60 + 15)) {
            slots.minByOrNull { it.periodNumber }
        } else {
            null
        }

        return Triple(period, active, nextUpcoming)
    }

    fun loadDashboardData(isRefresh: Boolean = false) {
        val currentStaff = authRepository.getStoredStaffInfo()
        val pendingCount = studentAttendanceRepository?.getPendingCount() ?: 0
        _uiState.value = _uiState.value.copy(
            isLoading = !isRefresh,
            isRefreshing = isRefresh,
            staff = currentStaff,
            errorMessage = null,
            isOfflineOrUnreachable = false,
            isSummaryLoading = true,
            isCreditsLoading = true,
            isDutiesLoading = true,
            pendingSyncCount = pendingCount
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
            val attendanceDeferred = async { attendanceRepository?.getTodaySummary() }

            var hasConnectionError = false
            var fetchedSlots = _uiState.value.todaySlots

            // Process Summary & Timetable
            val summaryRes = summaryDeferred.await()
            when (summaryRes) {
                is NetworkResult.Success -> {
                    val summary = summaryRes.data
                    _uiState.value = _uiState.value.copy(
                        todaySummary = summary,
                        urgentSubstituteDuties = summary.substituteDutiesToday,
                        isSummaryLoading = false
                    )

                    // Asynchronously fetch timetable for today's Day Order
                    if (summary.dayOrder != null) {
                        _uiState.value = _uiState.value.copy(isTimetableLoading = true)
                        when (val ttRes = timetableRepository.getTimetableByDayOrder(staffId, summary.dayOrder)) {
                            is NetworkResult.Success -> {
                                fetchedSlots = ttRes.data
                                val (period, active, nextUp) = resolvePeriodIntelligence(fetchedSlots, null)
                                _uiState.value = _uiState.value.copy(
                                    todaySlots = fetchedSlots,
                                    activeSlot = active,
                                    nextUpcomingSlot = nextUp,
                                    currentPeriodNumber = period,
                                    isFreePeriod = period != null && active == null && fetchedSlots.isNotEmpty(),
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

            // Process Shift Attendance Status
            val attRes = attendanceDeferred.await()
            if (attRes is NetworkResult.Success) {
                val attData = attRes.data
                val shift = when {
                    attData.isCheckedOut -> ShiftState.COMPLETED
                    attData.isCheckedIn -> ShiftState.ON_DUTY
                    else -> ShiftState.NOT_STARTED
                }
                _uiState.value = _uiState.value.copy(
                    shiftState = shift,
                    todayCheckInTime = attData.checkInTime,
                    todayWorkingDuration = attData.workingDuration
                )
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

            // Fallback period resolution if slots exist
            if (_uiState.value.activeSlot == null && fetchedSlots.isNotEmpty()) {
                val (period, active, nextUp) = resolvePeriodIntelligence(fetchedSlots, null)
                _uiState.value = _uiState.value.copy(
                    activeSlot = active,
                    nextUpcomingSlot = nextUp,
                    currentPeriodNumber = period,
                    isFreePeriod = period != null && active == null && fetchedSlots.isNotEmpty()
                )
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
