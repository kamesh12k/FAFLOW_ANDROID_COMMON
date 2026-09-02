package com.governence.faflow.ui.viewmodels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.governence.faflow.auth.data.AuthRepository
import com.governence.faflow.core.network.ClassOutDto
import com.governence.faflow.core.network.LeaveOutDto
import com.governence.faflow.core.network.NetworkResult
import com.governence.faflow.core.network.SupervisorLiveStatusOutDto
import com.governence.faflow.core.network.TeacherOutDto
import com.governence.faflow.core.network.TimetableSlotOutDto
import com.governence.faflow.core.network.TodaySubstitutionCoverageDto
import com.governence.faflow.faflow.data.AcademicSummaryRepository
import com.governence.faflow.faflow.data.HodRepositoryImpl
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class HodDashboardUiState(
    val isLoading: Boolean = false,
    val pendingLeavesCount: Int = 0,
    val totalFacultyCount: Int = 0,
    val todayCoveredCount: Int = 0,
    val todayUncoveredCount: Int = 0,
    val livePresentCount: Int = 0,
    val liveAbsentCount: Int = 0,
    val dayOrder: Int? = null,
    val isWorkingDay: Boolean = true,
    val errorMessage: String? = null
)

data class HodLeavesUiState(
    val isLoading: Boolean = false,
    val leaves: List<LeaveOutDto> = emptyList(),
    val facultyList: List<TeacherOutDto> = emptyList(),
    val actionMessage: String? = null,
    val errorMessage: String? = null
)

data class HodCoverageUiState(
    val isLoading: Boolean = false,
    val coverage: TodaySubstitutionCoverageDto? = null,
    val facultyList: List<TeacherOutDto> = emptyList(),
    val actionMessage: String? = null,
    val errorMessage: String? = null
)

data class HodTimetableUiState(
    val isLoading: Boolean = false,
    val classes: List<ClassOutDto> = emptyList(),
    val selectedClassId: Int? = null,
    val selectedDayOrder: Int = 1,
    val timetableSlots: List<TimetableSlotOutDto> = emptyList(),
    val errorMessage: String? = null
)

data class HodFacultyDirectoryUiState(
    val isLoading: Boolean = false,
    val facultyList: List<TeacherOutDto> = emptyList(),
    val searchQuery: String = "",
    val errorMessage: String? = null
)

data class HodAttendanceUiState(
    val isLoading: Boolean = false,
    val liveStatus: SupervisorLiveStatusOutDto? = null,
    val errorMessage: String? = null
)

class HodViewModel(
    private val hodRepository: HodRepositoryImpl,
    private val authRepository: AuthRepository,
    private val academicSummaryRepository: AcademicSummaryRepository
) : ViewModel() {

    private val _dashboardState = MutableStateFlow(HodDashboardUiState())
    val dashboardState: StateFlow<HodDashboardUiState> = _dashboardState.asStateFlow()

    private val _leavesState = MutableStateFlow(HodLeavesUiState())
    val leavesState: StateFlow<HodLeavesUiState> = _leavesState.asStateFlow()

    private val _coverageState = MutableStateFlow(HodCoverageUiState())
    val coverageState: StateFlow<HodCoverageUiState> = _coverageState.asStateFlow()

    private val _timetableState = MutableStateFlow(HodTimetableUiState())
    val timetableState: StateFlow<HodTimetableUiState> = _timetableState.asStateFlow()

    private val _facultyState = MutableStateFlow(HodFacultyDirectoryUiState())
    val facultyState: StateFlow<HodFacultyDirectoryUiState> = _facultyState.asStateFlow()

    private val _attendanceState = MutableStateFlow(HodAttendanceUiState())
    val attendanceState: StateFlow<HodAttendanceUiState> = _attendanceState.asStateFlow()

    init {
        loadDashboardData()
    }

    fun loadDashboardData() {
        viewModelScope.launch {
            _dashboardState.value = _dashboardState.value.copy(isLoading = true, errorMessage = null)
            
            // 1. Academic calendar
            var dayOrder: Int? = null
            var isWorking = true
            when (val res = academicSummaryRepository.getMyTodaySummary()) {
                is NetworkResult.Success -> {
                    dayOrder = res.data.dayOrder
                    isWorking = !res.data.blocksOperations && dayOrder != null
                }
                else -> {}
            }

            // 2. Department Leaves
            var pendingCount = 0
            when (val res = hodRepository.getDepartmentLeaves()) {
                is NetworkResult.Success -> {
                    pendingCount = res.data.count { it.status.lowercase() == "pending" }
                }
                else -> {}
            }

            // 3. Department Faculty
            var facultyCount = 0
            when (val res = hodRepository.getDepartmentTeachers()) {
                is NetworkResult.Success -> {
                    facultyCount = res.data.size
                }
                else -> {}
            }

            // 4. Coverage
            var covered = 0
            var uncovered = 0
            when (val res = hodRepository.getTodayCoverage()) {
                is NetworkResult.Success -> {
                    covered = res.data.coveredSlots
                    uncovered = res.data.uncoveredSlots
                }
                else -> {}
            }

            // 5. Live Attendance
            var present = 0
            var absent = 0
            when (val res = hodRepository.getSupervisorLiveStatus()) {
                is NetworkResult.Success -> {
                    present = res.data.presentCount
                    absent = res.data.absentCount
                }
                else -> {}
            }

            _dashboardState.value = HodDashboardUiState(
                isLoading = false,
                pendingLeavesCount = pendingCount,
                totalFacultyCount = facultyCount,
                todayCoveredCount = covered,
                todayUncoveredCount = uncovered,
                livePresentCount = present,
                liveAbsentCount = absent,
                dayOrder = dayOrder,
                isWorkingDay = isWorking
            )
        }
    }

    fun loadDepartmentLeaves() {
        viewModelScope.launch {
            _leavesState.value = _leavesState.value.copy(isLoading = true, errorMessage = null)
            val leavesRes = hodRepository.getDepartmentLeaves()
            val teachersRes = hodRepository.getDepartmentTeachers()

            val leaves = if (leavesRes is NetworkResult.Success) leavesRes.data else emptyList()
            val teachers = if (teachersRes is NetworkResult.Success) teachersRes.data else emptyList()

            _leavesState.value = HodLeavesUiState(
                isLoading = false,
                leaves = leaves,
                facultyList = teachers,
                errorMessage = if (leavesRes is NetworkResult.Error) leavesRes.message else null
            )
        }
    }

    fun approveLeave(leaveId: Int) {
        viewModelScope.launch {
            _leavesState.value = _leavesState.value.copy(isLoading = true)
            when (val res = hodRepository.approveLeave(leaveId)) {
                is NetworkResult.Success -> {
                    loadDepartmentLeaves()
                    loadDashboardData()
                }
                is NetworkResult.Error -> {
                    _leavesState.value = _leavesState.value.copy(
                        isLoading = false,
                        errorMessage = res.message
                    )
                }
                NetworkResult.Loading -> {}
            }
        }
    }

    fun rejectLeave(leaveId: Int) {
        viewModelScope.launch {
            _leavesState.value = _leavesState.value.copy(isLoading = true)
            when (val res = hodRepository.rejectLeave(leaveId)) {
                is NetworkResult.Success -> {
                    loadDepartmentLeaves()
                    loadDashboardData()
                }
                is NetworkResult.Error -> {
                    _leavesState.value = _leavesState.value.copy(
                        isLoading = false,
                        errorMessage = res.message
                    )
                }
                NetworkResult.Loading -> {}
            }
        }
    }

    fun assignSubstitute(leaveId: Int, substituteTeacherId: Int, periodNumber: Int?, date: String?) {
        viewModelScope.launch {
            _leavesState.value = _leavesState.value.copy(isLoading = true)
            when (val res = hodRepository.assignSubstitute(
                leaveId = leaveId,
                substituteTeacherId = substituteTeacherId,
                periodNumber = periodNumber,
                date = date
            )) {
                is NetworkResult.Success -> {
                    loadDepartmentLeaves()
                    loadCoverage()
                    loadDashboardData()
                }
                is NetworkResult.Error -> {
                    _leavesState.value = _leavesState.value.copy(
                        isLoading = false,
                        errorMessage = res.message
                    )
                }
                NetworkResult.Loading -> {}
            }
        }
    }

    fun loadCoverage(date: String? = null) {
        viewModelScope.launch {
            _coverageState.value = _coverageState.value.copy(isLoading = true, errorMessage = null)
            val covRes = hodRepository.getTodayCoverage(date)
            val teachRes = hodRepository.getDepartmentTeachers()

            _coverageState.value = HodCoverageUiState(
                isLoading = false,
                coverage = if (covRes is NetworkResult.Success) covRes.data else null,
                facultyList = if (teachRes is NetworkResult.Success) teachRes.data else emptyList(),
                errorMessage = if (covRes is NetworkResult.Error) covRes.message else null
            )
        }
    }

    fun loadFacultyDirectory() {
        viewModelScope.launch {
            _facultyState.value = _facultyState.value.copy(isLoading = true, errorMessage = null)
            when (val res = hodRepository.getDepartmentTeachers()) {
                is NetworkResult.Success -> {
                    _facultyState.value = HodFacultyDirectoryUiState(
                        isLoading = false,
                        facultyList = res.data
                    )
                }
                is NetworkResult.Error -> {
                    _facultyState.value = HodFacultyDirectoryUiState(
                        isLoading = false,
                        errorMessage = res.message
                    )
                }
                NetworkResult.Loading -> {}
            }
        }
    }

    fun searchFaculty(query: String) {
        _facultyState.value = _facultyState.value.copy(searchQuery = query)
    }

    fun loadClassesAndTimetable(classId: Int? = null, dayOrder: Int = 1) {
        viewModelScope.launch {
            _timetableState.value = _timetableState.value.copy(isLoading = true, errorMessage = null)
            
            // Fetch classes if not already loaded
            var currentClasses = _timetableState.value.classes
            if (currentClasses.isEmpty()) {
                when (val res = hodRepository.getClasses()) {
                    is NetworkResult.Success -> currentClasses = res.data
                    else -> {}
                }
            }

            val targetClassId = classId ?: currentClasses.firstOrNull()?.id
            val timetableRes = if (targetClassId != null) {
                hodRepository.getTimetable(classId = targetClassId, dayOrder = dayOrder)
            } else {
                hodRepository.getTimetable(dayOrder = dayOrder)
            }

            _timetableState.value = HodTimetableUiState(
                isLoading = false,
                classes = currentClasses,
                selectedClassId = targetClassId,
                selectedDayOrder = dayOrder,
                timetableSlots = if (timetableRes is NetworkResult.Success) timetableRes.data else emptyList(),
                errorMessage = if (timetableRes is NetworkResult.Error) timetableRes.message else null
            )
        }
    }

    fun selectClass(classId: Int) {
        loadClassesAndTimetable(classId = classId, dayOrder = _timetableState.value.selectedDayOrder)
    }

    fun selectDayOrder(dayOrder: Int) {
        loadClassesAndTimetable(classId = _timetableState.value.selectedClassId, dayOrder = dayOrder)
    }

    fun loadLiveAttendance(date: String? = null) {
        viewModelScope.launch {
            _attendanceState.value = _attendanceState.value.copy(isLoading = true, errorMessage = null)
            when (val res = hodRepository.getSupervisorLiveStatus(date = date)) {
                is NetworkResult.Success -> {
                    _attendanceState.value = HodAttendanceUiState(
                        isLoading = false,
                        liveStatus = res.data
                    )
                }
                is NetworkResult.Error -> {
                    _attendanceState.value = HodAttendanceUiState(
                        isLoading = false,
                        errorMessage = res.message
                    )
                }
                NetworkResult.Loading -> {}
            }
        }
    }
}
