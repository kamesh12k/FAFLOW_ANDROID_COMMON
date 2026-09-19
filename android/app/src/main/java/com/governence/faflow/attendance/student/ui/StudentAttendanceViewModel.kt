package com.governence.faflow.attendance.student.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.governence.faflow.attendance.student.data.StudentAttendanceRepository
import com.governence.faflow.attendance.student.data.StudentAttendanceResult
import com.governence.faflow.core.network.AttendanceSessionDto
import com.governence.faflow.core.network.ClassOutDto
import com.governence.faflow.core.network.ClassRosterDto
import com.governence.faflow.core.network.NetworkResult
import com.governence.faflow.core.network.StudentExceptionItemDto
import com.governence.faflow.core.network.StudentItemDto
import com.governence.faflow.core.network.TeacherPeriodSlotDto
import com.governence.faflow.core.network.TeacherTodayScheduleDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class RosterFilter {
    ALL,
    PRESENT,
    ABSENT,
    EXCEPTIONS
}

data class StudentAttendanceUiState(
    val isLoading: Boolean = true,
    val schedule: TeacherTodayScheduleDto? = null,
    val selectedSlot: TeacherPeriodSlotDto? = null,
    val roster: ClassRosterDto? = null,
    val activeSession: AttendanceSessionDto? = null,
    val absentInput: String = "",
    val specialStatuses: Map<Int, String> = emptyMap(),
    val allClasses: List<ClassOutDto> = emptyList(),
    val isEmergencyModalOpen: Boolean = false,
    val isEmergencyMode: Boolean = false,
    val errorMessage: String? = null,
    val successMessage: String? = null,
    val isSubmitting: Boolean = false,
    val pendingCount: Int = 0,
    val syncStatusText: String = "✓ Synced",
    val searchQuery: String = "",
    val selectedFilter: RosterFilter = RosterFilter.ALL,
    val isReviewSheetOpen: Boolean = false
)

class StudentAttendanceViewModel(
    private val repository: StudentAttendanceRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(StudentAttendanceUiState())
    val uiState: StateFlow<StudentAttendanceUiState> = _uiState.asStateFlow()

    init {
        loadSchedule()
        loadClasses()
        updatePendingCount()
    }

    fun updatePendingCount() {
        val count = repository.getPendingCount()
        _uiState.update {
            it.copy(
                pendingCount = count,
                syncStatusText = if (count == 0) "✓ Synced" else "◷ Saved on device — will sync automatically ($count pending)"
            )
        }
    }

    fun loadSchedule(targetDate: String? = null, targetPeriod: Int? = null, targetClassId: Int? = null) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            when (val result = repository.getTodaySchedule(targetDate)) {
                is NetworkResult.Success -> {
                    val schedule = result.data
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            schedule = schedule,
                            errorMessage = null
                        )
                    }
                    // Contextual auto-selection: select explicitly requested slot, active period, or first slot
                    if (_uiState.value.selectedSlot == null && schedule.periods.isNotEmpty()) {
                        val matching = if (targetPeriod != null || targetClassId != null) {
                            schedule.periods.firstOrNull { slot ->
                                (targetPeriod == null || slot.periodNumber == targetPeriod) &&
                                (targetClassId == null || slot.classId == targetClassId)
                            } ?: schedule.periods.firstOrNull { it.periodNumber == schedule.currentPeriod }
                        } else {
                            schedule.periods.firstOrNull { it.periodNumber == schedule.currentPeriod }
                        } ?: schedule.periods.firstOrNull()

                        if (matching != null) {
                            selectSlot(matching)
                        }
                    }
                }
                is NetworkResult.Error -> {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = result.message
                        )
                    }
                }
                NetworkResult.Loading -> {}
            }
            updatePendingCount()
        }
    }

    fun preselectPeriod(periodNumber: Int?, classId: Int? = null) {
        val schedule = _uiState.value.schedule
        if (schedule != null && schedule.periods.isNotEmpty()) {
            val matching = schedule.periods.firstOrNull { slot ->
                (periodNumber == null || slot.periodNumber == periodNumber) &&
                (classId == null || slot.classId == classId)
            } ?: schedule.periods.firstOrNull { it.periodNumber == periodNumber }
              ?: schedule.periods.firstOrNull { it.periodNumber == schedule.currentPeriod }
              ?: schedule.periods.firstOrNull()

            if (matching != null && _uiState.value.selectedSlot?.timetableSlotId != matching.timetableSlotId) {
                selectSlot(matching)
            }
        } else {
            loadSchedule(targetPeriod = periodNumber, targetClassId = classId)
        }
    }

    private fun loadClasses() {
        viewModelScope.launch {
            when (val result = repository.getAllClasses()) {
                is NetworkResult.Success -> {
                    _uiState.update { it.copy(allClasses = result.data) }
                }
                else -> {}
            }
        }
    }

    fun selectSlot(slot: TeacherPeriodSlotDto) {
        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    selectedSlot = slot,
                    isEmergencyMode = false,
                    absentInput = "",
                    specialStatuses = emptyMap(),
                    errorMessage = null,
                    successMessage = null,
                    isLoading = true
                )
            }

            // Load class roster
            when (val rosterRes = repository.getClassRoster(slot.classId)) {
                is NetworkResult.Success -> {
                    _uiState.update { it.copy(roster = rosterRes.data) }
                }
                is NetworkResult.Error -> {
                    _uiState.update { it.copy(errorMessage = rosterRes.message) }
                }
                NetworkResult.Loading -> {}
            }

            // Initialize or load session
            val session = repository.getOrCreateSession(
                slotId = slot.timetableSlotId,
                classId = slot.classId,
                subjectId = slot.subjectId,
                substitutionId = slot.substitutionId,
                isSubstitution = slot.isSubstitution
            )
            _uiState.update {
                it.copy(
                    activeSession = session,
                    isLoading = false
                )
            }
        }
    }

    fun openEmergencyModal() {
        _uiState.update { it.copy(isEmergencyModalOpen = true) }
    }

    fun closeEmergencyModal() {
        _uiState.update { it.copy(isEmergencyModalOpen = false) }
    }

    fun selectEmergencyClass(classDto: ClassOutDto) {
        viewModelScope.launch {
            val curPeriod = _uiState.value.schedule?.currentPeriod ?: 1
            _uiState.update {
                it.copy(
                    isEmergencyModalOpen = false,
                    isEmergencyMode = true,
                    selectedSlot = TeacherPeriodSlotDto(
                        timetableSlotId = 0,
                        periodNumber = curPeriod,
                        startTime = "Current Period",
                        endTime = "",
                        classId = classDto.id,
                        className = classDto.name,
                        subjectId = 0,
                        subjectName = "Class Subject",
                        isSubstitution = false
                    ),
                    absentInput = "",
                    specialStatuses = emptyMap(),
                    errorMessage = null,
                    successMessage = null,
                    isLoading = true
                )
            }

            when (val rosterRes = repository.getClassRoster(classDto.id)) {
                is NetworkResult.Success -> {
                    _uiState.update { it.copy(roster = rosterRes.data, isLoading = false) }
                }
                is NetworkResult.Error -> {
                    _uiState.update { it.copy(errorMessage = rosterRes.message, isLoading = false) }
                }
                NetworkResult.Loading -> {}
            }
        }
    }

    fun updateAbsentInput(input: String) {
        _uiState.update { it.copy(absentInput = input) }
    }

    fun toggleStudentAttendance(student: StudentItemDto) {
        val suffix = student.rollSuffix.ifBlank { student.rollNumber.takeLast(3) }
        val currentTokens = _uiState.value.absentInput
            .split(Regex("[\\s,]+"))
            .filter { it.isNotBlank() }
            .map { it.padStart(3, '0').takeLast(3) }
            .toMutableList()

        if (currentTokens.contains(suffix)) {
            currentTokens.removeAll { it == suffix }
        } else {
            currentTokens.add(suffix)
        }

        // If student had a special status (OD/Leave), clear it so it's clean Absent/Present
        val currentSpecial = _uiState.value.specialStatuses.toMutableMap()
        currentSpecial.remove(student.id)

        _uiState.update {
            it.copy(
                absentInput = currentTokens.distinct().joinToString(" "),
                specialStatuses = currentSpecial
            )
        }
    }

    fun markAllPresent() {
        _uiState.update {
            it.copy(
                absentInput = "",
                specialStatuses = emptyMap()
            )
        }
    }

    fun markAllAbsent() {
        val roster = _uiState.value.roster?.students ?: emptyList()
        val allSuffixes = roster.map { it.rollSuffix.ifBlank { it.rollNumber.takeLast(3) } }.distinct()
        _uiState.update {
            it.copy(
                absentInput = allSuffixes.joinToString(" "),
                specialStatuses = emptyMap()
            )
        }
    }

    fun clearAttendance() {
        markAllPresent()
    }

    fun updateSearchQuery(query: String) {
        _uiState.update { it.copy(searchQuery = query) }
    }

    fun setFilter(filter: RosterFilter) {
        _uiState.update { it.copy(selectedFilter = filter) }
    }

    fun openReviewSheet() {
        val state = _uiState.value
        val rawTokens = state.absentInput.split(Regex("[\\s,]+")).filter { it.isNotBlank() }
        val suffixes = rawTokens.map { it.padStart(3, '0').takeLast(3) }.distinct()

        val rosterStudents = state.roster?.students ?: emptyList()
        val validSuffixMap = rosterStudents.associateBy { it.rollSuffix.ifBlank { it.rollNumber.takeLast(3) } }
        val invalidTokens = suffixes.filter { !validSuffixMap.containsKey(it) }

        if (invalidTokens.isNotEmpty()) {
            _uiState.update {
                it.copy(errorMessage = "Invalid roll suffix(es) not in class: ${invalidTokens.joinToString(", ")}")
            }
            return
        }

        _uiState.update { it.copy(isReviewSheetOpen = true, errorMessage = null) }
    }

    fun closeReviewSheet() {
        _uiState.update { it.copy(isReviewSheetOpen = false) }
    }

    fun toggleSpecialStatus(studentId: Int, status: String) {
        _uiState.update { current ->
            val updated = current.specialStatuses.toMutableMap()
            if (updated[studentId] == status) {
                updated.remove(studentId)
            } else {
                updated[studentId] = status
            }
            current.copy(specialStatuses = updated)
        }
    }

    fun submitAttendance() {
        val state = _uiState.value
        val slot = state.selectedSlot ?: return

        // 1. Parse absent suffixes (last 3 digits, deduplicated)
        val rawTokens = state.absentInput.split(Regex("[\\s,]+")).filter { it.isNotBlank() }
        val suffixes = rawTokens.map { it.padStart(3, '0').takeLast(3) }.distinct()

        // 2. Validate suffixes against class roster
        val rosterStudents = state.roster?.students ?: emptyList()
        val validSuffixMap = rosterStudents.associateBy { it.rollSuffix.ifBlank { it.rollNumber.takeLast(3) } }
        val invalidTokens = suffixes.filter { !validSuffixMap.containsKey(it) }

        if (invalidTokens.isNotEmpty()) {
            _uiState.update {
                it.copy(errorMessage = "Invalid roll suffix(es) not in class: ${invalidTokens.joinToString(", ")}")
            }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isSubmitting = true, isReviewSheetOpen = false, errorMessage = null) }

            val exceptions = state.specialStatuses.map { (stId, st) ->
                StudentExceptionItemDto(studentId = stId, status = st)
            }

            if (state.isEmergencyMode) {
                val res = repository.submitEmergencyAttendance(
                    classId = slot.classId,
                    periodNumber = slot.periodNumber,
                    absentSuffixes = suffixes,
                    exceptions = exceptions
                )
                when (res) {
                    is StudentAttendanceResult.Success -> {
                        _uiState.update {
                            it.copy(
                                isSubmitting = false,
                                activeSession = res.session,
                                successMessage = "Emergency attendance recorded successfully!"
                            )
                        }
                    }
                    is StudentAttendanceResult.QueuedOffline -> {
                        _uiState.update {
                            it.copy(
                                isSubmitting = false,
                                successMessage = res.message
                            )
                        }
                    }
                    is StudentAttendanceResult.Error -> {
                        _uiState.update {
                            it.copy(isSubmitting = false, errorMessage = res.message)
                        }
                    }
                }
            } else {
                val sessionId = state.activeSession?.id ?: 0
                val res = repository.submitAttendance(
                    sessionId = sessionId,
                    classId = slot.classId,
                    absentSuffixes = suffixes,
                    exceptions = exceptions
                )
                when (res) {
                    is StudentAttendanceResult.Success -> {
                        _uiState.update {
                            it.copy(
                                isSubmitting = false,
                                activeSession = res.session,
                                successMessage = "Attendance submitted successfully! Status: ${res.session.status}"
                            )
                        }
                    }
                    is StudentAttendanceResult.QueuedOffline -> {
                        _uiState.update {
                            it.copy(
                                isSubmitting = false,
                                successMessage = res.message
                            )
                        }
                    }
                    is StudentAttendanceResult.Error -> {
                        _uiState.update {
                            it.copy(isSubmitting = false, errorMessage = res.message)
                        }
                    }
                }
            }

            updatePendingCount()
            loadSchedule()
        }
    }

    fun syncPending() {
        viewModelScope.launch {
            val count = repository.syncPendingOperations()
            updatePendingCount()
            if (count > 0) {
                _uiState.update { it.copy(successMessage = "Successfully synced $count offline operation(s)!") }
            }
        }
    }

    fun dismissMessage() {
        _uiState.update { it.copy(errorMessage = null, successMessage = null) }
    }
}
