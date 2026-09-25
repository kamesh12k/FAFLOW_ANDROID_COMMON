package com.governence.faflow.ui.viewmodels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.governence.faflow.auth.data.AuthRepository
import com.governence.faflow.core.network.LeavePolicyOutDto
import com.governence.faflow.core.network.LeaveValidationOutDto
import com.governence.faflow.core.network.NetworkResult
import com.governence.faflow.core.network.NotificationOutDto
import com.governence.faflow.core.network.RecommendationOutDto
import com.governence.faflow.core.network.SubstitutionPreferenceOutDto
import com.governence.faflow.core.network.SubstitutionPreferenceUpdateDto
import com.governence.faflow.core.network.TeacherLeaveBalanceSummaryDto
import com.governence.faflow.domain.model.CreditTransaction
import com.governence.faflow.domain.model.LeaveHistoryDay
import com.governence.faflow.domain.model.LeaveRequest
import com.governence.faflow.domain.model.LeaveStatus
import com.governence.faflow.domain.model.TimetableSlot
import com.governence.faflow.faflow.CreditRepository
import com.governence.faflow.faflow.TimetableRepository
import com.governence.faflow.faflow.data.AcademicSummaryRepository
import com.governence.faflow.faflow.data.LeaveRepositoryImpl
import com.governence.faflow.faflow.data.NotificationRepositoryImpl
import com.governence.faflow.faflow.data.PreferencesRepositoryImpl
import com.governence.faflow.faflow.data.SubstitutionRepositoryImpl
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

// ---------- Leave ViewModel ----------

data class LeaveUiState(
    val isLoading: Boolean = false,
    val myLeaves: List<LeaveRequest> = emptyList(),
    val groupedLeaves: List<LeaveHistoryDay> = emptyList(),
    val isSubmittedSuccessfully: Boolean = false,
    val resolvedDayOrder: Int? = null,
    val isBlockedDate: Boolean = false,
    val dayType: String? = null,
    val hasExistingLeaveOnDate: Boolean = false,
    val existingLeavePeriods: List<Int> = emptyList(),
    val errorMessage: String? = null,
    // Flexible Mode
    val isFlexibleMode: Boolean = false,
    val slotCandidates: List<RecommendationOutDto> = emptyList(),
    val candidatesPerPeriod: Map<Int, List<RecommendationOutDto>> = emptyMap(),
    val isLoadingCandidates: Boolean = false,
    val includeCrossDepartment: Boolean = false,
    val onlyHandlesClass: Boolean = false,
    val candidateSearchQuery: String = "",
    // Map<periodNumber, selectedSubstituteId>
    val selectedSubstitutePerPeriod: Map<Int, Int> = emptyMap(),
    // Teacher schedule awareness
    val teacherSlots: List<TimetableSlot> = emptyList(),
    val scheduledPeriodsForDate: Set<Int> = emptySet(),
    val scheduledSlotsForDate: List<TimetableSlot> = emptyList(),
    val isTimetableLoaded: Boolean = false,
    val sameDayCutoffTime: String = "09:00",
    // Institutional Leave Policy & Balance state
    val activePolicies: List<LeavePolicyOutDto> = emptyList(),
    val selectedPolicy: LeavePolicyOutDto? = null,
    val leaveBalancesSummary: TeacherLeaveBalanceSummaryDto? = null,
    val validationResult: LeaveValidationOutDto? = null,
    val isValidatingPolicy: Boolean = false,
    val documentUrl: String? = null,
    val policyWarningAcknowledged: Boolean = false
)

class LeaveViewModel(
    private val leaveRepository: LeaveRepositoryImpl,
    private val academicSummaryRepository: AcademicSummaryRepository,
    private val timetableRepository: TimetableRepository? = null,
    private val authRepository: AuthRepository? = null
) : ViewModel() {

    private val _uiState = MutableStateFlow(LeaveUiState())
    val uiState: StateFlow<LeaveUiState> = _uiState.asStateFlow()

    init {
        loadMyLeaves()
        loadCampusMode()
        loadTeacherTimetable()
        loadLeavePolicy()
        loadActivePolicies()
        loadLeaveBalances()
    }

    fun loadActivePolicies() {
        viewModelScope.launch {
            when (val res = leaveRepository.getActiveLeavePolicies()) {
                is NetworkResult.Success -> {
                    val policies = res.data
                    val defaultPolicy = policies.firstOrNull { it.code == "AL" } ?: policies.firstOrNull()
                    _uiState.value = _uiState.value.copy(
                        activePolicies = policies,
                        selectedPolicy = defaultPolicy
                    )
                }
                else -> Unit
            }
        }
    }

    fun loadLeaveBalances() {
        viewModelScope.launch {
            when (val res = leaveRepository.getMyLeaveBalances()) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        leaveBalancesSummary = res.data
                    )
                }
                else -> Unit
            }
        }
    }

    fun selectPolicy(policy: LeavePolicyOutDto, date: String = "") {
        _uiState.value = _uiState.value.copy(
            selectedPolicy = policy,
            validationResult = null
        )
        if (date.isNotBlank()) {
            validateLeavePolicy(policy.id, date)
        }
    }

    fun validateLeavePolicy(policyId: Int, date: String, days: Double = 1.0) {
        if (date.isBlank()) return
        _uiState.value = _uiState.value.copy(isValidatingPolicy = true)
        viewModelScope.launch {
            when (val res = leaveRepository.validateLeaveApplication(policyId, date, days)) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        validationResult = res.data,
                        isValidatingPolicy = false
                    )
                }
                is NetworkResult.Error -> {
                    _uiState.value = _uiState.value.copy(
                        validationResult = LeaveValidationOutDto(
                            allowed = false,
                            message = res.message
                        ),
                        isValidatingPolicy = false
                    )
                }
                NetworkResult.Loading -> Unit
            }
        }
    }

    /** Load institutional leave application cutoff time from governance policy. */
    fun loadLeavePolicy() {
        viewModelScope.launch {
            val cutoff = leaveRepository.getSameDayLeaveCutoffTime()
            _uiState.value = _uiState.value.copy(sameDayCutoffTime = cutoff)
        }
    }

    /** Load complete timetable slots for the authenticated teacher. */
    fun loadTeacherTimetable() {
        val staffId = authRepository?.getStoredStaffInfo()?.id ?: return
        viewModelScope.launch {
            when (val res = timetableRepository?.getTimetableForTeacher(staffId)) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        teacherSlots = res.data,
                        isTimetableLoaded = true
                    )
                    val currentDayOrder = _uiState.value.resolvedDayOrder
                    if (currentDayOrder != null) {
                        updateScheduledPeriodsForDayOrder(currentDayOrder, res.data)
                    }
                }
                else -> {
                    _uiState.value = _uiState.value.copy(isTimetableLoaded = true)
                }
            }
        }
    }

    private fun updateScheduledPeriodsForDayOrder(
        dayOrder: Int,
        allSlots: List<TimetableSlot>
    ) {
        val daySlots = allSlots.filter { it.dayOrder == dayOrder }.sortedBy { it.periodNumber }
        val periods = daySlots.map { it.periodNumber }.toSet()
        _uiState.value = _uiState.value.copy(
            scheduledPeriodsForDate = periods,
            scheduledSlotsForDate = daySlots
        )
    }

    /** Detect if the campus is currently in Flexible mode. */
    fun loadCampusMode() {
        viewModelScope.launch {
            when (val res = leaveRepository.getCampusOperationsMode()) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isFlexibleMode = res.data.equals("flexible", ignoreCase = true)
                    )
                }
                else -> Unit
            }
        }
    }

    fun loadMyLeaves() {
        _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
        viewModelScope.launch {
            when (val res = leaveRepository.getMyLeaves()) {
                is NetworkResult.Success -> {
                    val grouped = leaveRepository.groupLeavesByDay(res.data)
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        myLeaves = res.data,
                        groupedLeaves = grouped
                    )
                }
                is NetworkResult.Error -> {
                    _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = res.message)
                }
                NetworkResult.Loading -> Unit
            }
        }
    }

    fun resolveDateDayOrder(date: String) {
        val existing = _uiState.value.myLeaves.filter { 
            it.date == date && (it.status == LeaveStatus.PENDING || it.status == LeaveStatus.APPROVED)
        }
        val hasConflict = existing.isNotEmpty()
        val conflictPeriods = existing.map { it.periodNumber }

        _uiState.value = _uiState.value.copy(
            hasExistingLeaveOnDate = hasConflict,
            existingLeavePeriods = conflictPeriods
        )

        viewModelScope.launch {
            when (val res = academicSummaryRepository.resolveDate(date)) {
                is NetworkResult.Success -> {
                    val isBlocked = res.data.blocksOperations || res.data.dayType.contains("HOLIDAY", ignoreCase = true)
                    val dayOrder = res.data.dayOrder
                    _uiState.value = _uiState.value.copy(
                        resolvedDayOrder = dayOrder,
                        isBlockedDate = isBlocked,
                        dayType = res.data.dayType
                    )
                    if (dayOrder != null) {
                        var slots = _uiState.value.teacherSlots
                        if (slots.isEmpty()) {
                            val staffId = authRepository?.getStoredStaffInfo()?.id
                            if (staffId != null && timetableRepository != null) {
                                when (val ttRes = timetableRepository.getTimetableForTeacher(staffId)) {
                                    is NetworkResult.Success -> {
                                        slots = ttRes.data
                                        _uiState.value = _uiState.value.copy(
                                            teacherSlots = slots,
                                            isTimetableLoaded = true
                                        )
                                    }
                                    else -> Unit
                                }
                            }
                        }
                        updateScheduledPeriodsForDayOrder(dayOrder, slots)
                    }
                }
                is NetworkResult.Error -> Unit
                NetworkResult.Loading -> Unit
            }
        }
    }

    fun setPolicyWarningAcknowledged(acknowledged: Boolean) {
        _uiState.value = _uiState.value.copy(policyWarningAcknowledged = acknowledged)
    }

    fun submitLeave(
        date: String,
        periodNumber: Int,
        reason: String,
        onComplete: () -> Unit,
        proposedSubstituteId: Int? = null
    ) {
        _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
        viewModelScope.launch {
            when (val res = leaveRepository.applyLeave(
                date = date,
                periodNumber = periodNumber,
                reason = reason,
                proposedSubstituteId = proposedSubstituteId,
                policyWarningAcknowledged = _uiState.value.policyWarningAcknowledged
            )) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        isSubmittedSuccessfully = true,
                        selectedSubstitutePerPeriod = emptyMap(),
                        policyWarningAcknowledged = false
                    )
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

    fun submitLeaveBatch(
        date: String,
        periodNumbers: List<Int>,
        reason: String,
        onComplete: () -> Unit,
        periodSubstitutes: Map<String, Int>? = null,
        wholeDay: Boolean = false,
        leavePolicyId: Int? = null,
        leaveType: String? = null,
        documentUrl: String? = null
    ) {
        val policyIdToUse = leavePolicyId ?: _uiState.value.selectedPolicy?.id
        val leaveTypeToUse = leaveType ?: _uiState.value.selectedPolicy?.code?.lowercase()
        val docUrlToUse = documentUrl ?: _uiState.value.documentUrl

        _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
        viewModelScope.launch {
            when (val res = leaveRepository.applyLeaveBatch(
                date = date,
                periodNumbers = periodNumbers,
                reason = reason,
                periodSubstitutes = periodSubstitutes,
                wholeDay = wholeDay,
                leavePolicyId = policyIdToUse,
                leaveType = leaveTypeToUse,
                documentUrl = docUrlToUse,
                policyWarningAcknowledged = _uiState.value.policyWarningAcknowledged
            )) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        isSubmittedSuccessfully = true,
                        selectedSubstitutePerPeriod = emptyMap(),
                        policyWarningAcknowledged = false
                    )
                    loadMyLeaves()
                    loadLeaveBalances()
                    onComplete()
                }
                is NetworkResult.Error -> {
                    _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = res.message)
                }
                NetworkResult.Loading -> Unit
            }
        }
    }

    fun submitLeaveRange(
        startDate: String,
        endDate: String,
        leaveType: String,
        reason: String,
        selectedPeriods: List<Int>,
        isWholeDay: Boolean,
        onComplete: () -> Unit,
        periodSubstitutes: Map<String, Int>? = null
    ) {
        val formattedReason = if (leaveType.isNotBlank()) "[$leaveType] $reason".trim() else reason
        if (startDate == endDate) {
            if (isWholeDay || selectedPeriods.size > 1) {
                submitLeaveBatch(
                    startDate,
                    selectedPeriods,
                    formattedReason,
                    onComplete,
                    periodSubstitutes = periodSubstitutes,
                    wholeDay = isWholeDay
                )
            } else {
                val proposedId = periodSubstitutes?.values?.firstOrNull()
                submitLeave(
                    startDate,
                    selectedPeriods.firstOrNull() ?: 1,
                    formattedReason,
                    onComplete,
                    proposedSubstituteId = proposedId
                )
            }
            return
        }

        // Multi-day range submission
        _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
        viewModelScope.launch {
            try {
                val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US)
                val start = sdf.parse(startDate) ?: Date()
                val end = sdf.parse(endDate) ?: Date()
                val cal = Calendar.getInstance()
                cal.time = start

                var anyFailure: String? = null
                var successCount = 0
                while (!cal.time.after(end)) {
                    val dayOfWeek = cal.get(Calendar.DAY_OF_WEEK)
                    if (dayOfWeek != Calendar.SUNDAY) {
                        val dateStr = sdf.format(cal.time)
                        val res = leaveRepository.applyLeaveBatch(
                            date = dateStr,
                            periodNumbers = selectedPeriods.ifEmpty { listOf(1, 2, 3, 4, 5) },
                            reason = formattedReason,
                            periodSubstitutes = null,
                            wholeDay = true,
                            policyWarningAcknowledged = _uiState.value.policyWarningAcknowledged
                        )
                        if (res is NetworkResult.Error) {
                            anyFailure = if (successCount > 0) {
                                "Submitted $successCount day(s). Failed for $dateStr: ${res.message}"
                            } else {
                                res.message
                            }
                            break
                        } else {
                            successCount++
                        }
                    }
                    cal.add(Calendar.DAY_OF_MONTH, 1)
                }

                if (anyFailure != null) {
                    _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = anyFailure)
                    if (successCount > 0) {
                        loadMyLeaves()
                    }
                } else {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        isSubmittedSuccessfully = true,
                        selectedSubstitutePerPeriod = emptyMap()
                    )
                    loadMyLeaves()
                    onComplete()
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    errorMessage = e.localizedMessage ?: "Failed to submit date range leave"
                )
            }
        }
    }

    /** Load ranked slot candidates for a specific date + period (Flexible Mode only). */
    fun loadSlotCandidates(
        date: String,
        periodNumber: Int,
        crossDept: Boolean = _uiState.value.includeCrossDepartment,
        handlesClass: Boolean = _uiState.value.onlyHandlesClass
    ) {
        _uiState.value = _uiState.value.copy(isLoadingCandidates = true, slotCandidates = emptyList())
        viewModelScope.launch {
            when (val res = leaveRepository.getSlotCandidates(date, periodNumber, crossDept, handlesClass)) {
                is NetworkResult.Success -> {
                    val currentMap = _uiState.value.candidatesPerPeriod.toMutableMap()
                    currentMap[periodNumber] = res.data
                    _uiState.value = _uiState.value.copy(
                        isLoadingCandidates = false,
                        slotCandidates = res.data,
                        candidatesPerPeriod = currentMap
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

    /** Load ranked slot candidates for multiple periods (Flexible Mode). */
    fun loadCandidatesForPeriods(
        date: String,
        periods: Set<Int>,
        crossDept: Boolean = _uiState.value.includeCrossDepartment,
        handlesClass: Boolean = _uiState.value.onlyHandlesClass
    ) {
        if (date.length != 10 || periods.isEmpty()) return
        _uiState.value = _uiState.value.copy(isLoadingCandidates = true)
        viewModelScope.launch {
            val currentMap = _uiState.value.candidatesPerPeriod.toMutableMap()
            var crossDeptForbidden = false

            for (period in periods) {
                when (val res = leaveRepository.getSlotCandidates(date, period, crossDept, handlesClass)) {
                    is NetworkResult.Success -> {
                        currentMap[period] = res.data
                    }
                    is NetworkResult.Error -> {
                        if (res.code == 403 && crossDept) {
                            crossDeptForbidden = true
                        }
                    }
                    NetworkResult.Loading -> Unit
                }
            }

            if (crossDeptForbidden) {
                // Server policy forbids cross-department substitutions for this department.
                // Automatically fall back to fetching same-department candidates so user isn't left stranded.
                for (period in periods) {
                    val fallback = leaveRepository.getSlotCandidates(date, period, includeCrossDepartment = false, onlyHandlesClass = handlesClass)
                    if (fallback is NetworkResult.Success) {
                        currentMap[period] = fallback.data
                    }
                }
                _uiState.value = _uiState.value.copy(
                    isLoadingCandidates = false,
                    includeCrossDepartment = false,
                    errorMessage = "Cross-department substitutions are disabled by administration for your department.",
                    candidatesPerPeriod = currentMap,
                    slotCandidates = currentMap[periods.firstOrNull() ?: 1] ?: emptyList()
                )
                return@launch
            }

            _uiState.value = _uiState.value.copy(
                isLoadingCandidates = false,
                errorMessage = null,
                candidatesPerPeriod = currentMap,
                slotCandidates = currentMap[periods.firstOrNull() ?: 1] ?: emptyList()
            )
        }
    }

    fun dismissErrorMessage() {
        _uiState.value = _uiState.value.copy(errorMessage = null)
    }

    fun toggleCrossDepartment(date: String, periods: Set<Int>) {
        val currentHandlesClass = _uiState.value.onlyHandlesClass
        val next = !_uiState.value.includeCrossDepartment
        // Clear any stale error from a previous attempt before re-fetching
        _uiState.value = _uiState.value.copy(includeCrossDepartment = next, errorMessage = null)
        loadCandidatesForPeriods(date, periods, crossDept = next, handlesClass = currentHandlesClass)
    }

    fun toggleOnlyHandlesClass(date: String, periods: Set<Int>) {
        val currentCrossDept = _uiState.value.includeCrossDepartment
        val next = !_uiState.value.onlyHandlesClass
        // Clear any stale error (e.g. a prior 403) so the UI is not stuck showing the banner
        _uiState.value = _uiState.value.copy(onlyHandlesClass = next, errorMessage = null)
        loadCandidatesForPeriods(date, periods, crossDept = currentCrossDept, handlesClass = next)
    }

    fun setCandidateSearchQuery(query: String) {
        _uiState.value = _uiState.value.copy(candidateSearchQuery = query)
    }

    fun selectSubstituteForPeriod(periodNumber: Int, substituteId: Int) {
        val updated = _uiState.value.selectedSubstitutePerPeriod.toMutableMap()
        updated[periodNumber] = substituteId
        _uiState.value = _uiState.value.copy(selectedSubstitutePerPeriod = updated)
    }

    fun clearSubstituteForPeriod(periodNumber: Int) {
        val updated = _uiState.value.selectedSubstitutePerPeriod.toMutableMap()
        updated.remove(periodNumber)
        _uiState.value = _uiState.value.copy(selectedSubstitutePerPeriod = updated)
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

    fun cancelLeaveGroup(dayGroup: LeaveHistoryDay, onComplete: () -> Unit = {}) {
        _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
        viewModelScope.launch {
            val cancellableIds = dayGroup.periods
                .filter { it.status == LeaveStatus.PENDING || it.status == LeaveStatus.APPROVED }
                .map { it.id }
            if (cancellableIds.isNotEmpty()) {
                leaveRepository.cancelLeaves(cancellableIds)
            }
            loadMyLeaves()
            onComplete()
        }
    }
}

// ---------- Credits ViewModel ----------

data class CreditTransactionWithRunning(
    val transaction: CreditTransaction,
    val runningBalance: Int
)

data class CreditsUiState(
    val isLoading: Boolean = false,
    val balance: Int = 0,
    val transactions: List<CreditTransaction> = emptyList(),
    val enhancedTransactions: List<CreditTransactionWithRunning> = emptyList(),
    val activeFilterTab: String = "ALL", // "ALL", "EARNED", "DEDUCTED", "ADJUSTMENTS"
    val searchQuery: String = "",
    val totalEarned: Int = 0,
    val totalDeducted: Int = 0,
    val errorMessage: String? = null
)

class CreditsViewModel(
    private val authRepository: AuthRepository,
    private val creditRepository: CreditRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(CreditsUiState())
    val uiState: StateFlow<CreditsUiState> = _uiState.asStateFlow()

    private var rawTransactions: List<CreditTransaction> = emptyList()

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
                    rawTransactions = tRes.data
                    applyFiltersAndCompute()
                }
                is NetworkResult.Error -> {
                    _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = tRes.message)
                }
                NetworkResult.Loading -> Unit
            }
        }
    }

    fun setFilterTab(tab: String) {
        _uiState.value = _uiState.value.copy(activeFilterTab = tab)
        applyFiltersAndCompute()
    }

    fun setSearchQuery(query: String) {
        _uiState.value = _uiState.value.copy(searchQuery = query)
        applyFiltersAndCompute()
    }

    private fun applyFiltersAndCompute() {
        var earned = 0
        var deducted = 0

        rawTransactions.forEach { tx ->
            if (tx.change > 0) earned += tx.change
            else if (tx.change < 0) deducted += Math.abs(tx.change)
        }

        // Chronological running balance calculation
        var running = 0
        val withRunning = rawTransactions.sortedBy { it.createdAt }.map { tx ->
            running += tx.change
            CreditTransactionWithRunning(transaction = tx, runningBalance = running)
        }.reversed()

        // Filter based on active tab & query
        val tab = _uiState.value.activeFilterTab
        val q = _uiState.value.searchQuery.trim().lowercase()

        val filtered = withRunning.filter { item ->
            val matchesTab = when (tab) {
                "EARNED" -> item.transaction.change > 0
                "DEDUCTED" -> item.transaction.change < 0
                "ADJUSTMENTS" -> item.transaction.change == 0 || item.transaction.category.contains("adjustment", ignoreCase = true)
                else -> true
            }
            val matchesQuery = q.isEmpty() ||
                    item.transaction.reason.lowercase().contains(q) ||
                    item.transaction.category.lowercase().contains(q)

            matchesTab && matchesQuery
        }

        _uiState.value = _uiState.value.copy(
            isLoading = false,
            transactions = rawTransactions,
            enhancedTransactions = filtered,
            totalEarned = earned,
            totalDeducted = deducted
        )
    }
}

// ---------- Substitution ViewModel ----------

data class SubstitutionUiState(
    val isLoading: Boolean = false,
    val activeTab: String = "MY_DUTIES", // "MY_DUTIES", "NEEDS_COVER", "COVERED"
    val allMySubstitutionLeaves: List<LeaveRequest> = emptyList(),
    val leavesNeedingCoverage: List<LeaveRequest> = emptyList(),
    val coveredLeaves: List<LeaveRequest> = emptyList(),
    val myAssignedDuties: List<LeaveRequest> = emptyList(),
    val selectedLeaveForCandidates: LeaveRequest? = null,
    val candidates: List<com.governence.faflow.core.network.RecommendationOutDto> = emptyList(),
    val isLoadingCandidates: Boolean = false,
    val isAssignmentInProgress: Boolean = false,
    val acceptedDutyIds: Set<Int> = emptySet(),
    val actionMessage: String? = null,
    val errorMessage: String? = null
)

class SubstitutionViewModel(
    private val substitutionRepository: SubstitutionRepositoryImpl
) : ViewModel() {

    private val _uiState = MutableStateFlow(SubstitutionUiState())
    val uiState: StateFlow<SubstitutionUiState> = _uiState.asStateFlow()

    init {
        loadData()
    }

    fun setActiveTab(tab: String) {
        _uiState.value = _uiState.value.copy(activeTab = tab)
    }

    fun loadData() {
        _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null, actionMessage = null)
        viewModelScope.launch {
            val leavesDeferred = async { substitutionRepository.getMyLeavesNeedingCoverage() }
            val dutiesDeferred = async { substitutionRepository.getMyDuties() }

            val leavesRes = leavesDeferred.await()
            val dutiesRes = dutiesDeferred.await()

            val all = if (leavesRes is NetworkResult.Success) leavesRes.data else emptyList()
            val duties = if (dutiesRes is NetworkResult.Success) dutiesRes.data else emptyList()

            val needsCover = all.filter { it.substituteTeacherName == null }
            val covered = all.filter { it.substituteTeacherName != null }

            val errorMsg = (leavesRes as? NetworkResult.Error)?.message
                ?: (dutiesRes as? NetworkResult.Error)?.message

            val resolvedTab = if (duties.isNotEmpty() && _uiState.value.activeTab == "MY_DUTIES") "MY_DUTIES"
                else if (needsCover.isNotEmpty() && _uiState.value.activeTab == "MY_DUTIES") "NEEDS_COVER"
                else _uiState.value.activeTab

            _uiState.value = _uiState.value.copy(
                isLoading = false,
                activeTab = resolvedTab,
                allMySubstitutionLeaves = all,
                leavesNeedingCoverage = needsCover,
                coveredLeaves = covered,
                myAssignedDuties = duties,
                errorMessage = errorMsg
            )
        }
    }

    fun selectLeaveForCandidates(leave: LeaveRequest, includeCrossDept: Boolean = false) {
        _uiState.value = _uiState.value.copy(
            selectedLeaveForCandidates = leave,
            isLoadingCandidates = true,
            candidates = emptyList()
        )
        viewModelScope.launch {
            when (val res = substitutionRepository.getCandidates(leave.id, includeCrossDept)) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isLoadingCandidates = false,
                        candidates = res.data
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

    fun dismissCandidateModal() {
        _uiState.value = _uiState.value.copy(
            selectedLeaveForCandidates = null,
            candidates = emptyList(),
            isLoadingCandidates = false
        )
    }

    fun assignCandidate(leaveId: Int, substituteTeacherId: Int) {
        _uiState.value = _uiState.value.copy(isAssignmentInProgress = true)
        viewModelScope.launch {
            when (val res = substitutionRepository.assignSubstitute(leaveId, substituteTeacherId)) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isAssignmentInProgress = false,
                        selectedLeaveForCandidates = null,
                        actionMessage = "Substitute assigned successfully!"
                    )
                    loadData()
                }
                is NetworkResult.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isAssignmentInProgress = false,
                        errorMessage = res.message
                    )
                }
                NetworkResult.Loading -> Unit
            }
        }
    }

    fun undoAssignment(leaveId: Int) {
        _uiState.value = _uiState.value.copy(isAssignmentInProgress = true)
        viewModelScope.launch {
            when (val res = substitutionRepository.undoAssignment(leaveId)) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isAssignmentInProgress = false,
                        actionMessage = "Substitution assignment undone"
                    )
                    loadData()
                }
                is NetworkResult.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isAssignmentInProgress = false,
                        errorMessage = res.message
                    )
                }
                NetworkResult.Loading -> Unit
            }
        }
    }

    fun loadDuties() {
        loadData()
    }

    fun acceptDuty(dutyId: Int) {
        _uiState.value = _uiState.value.copy(
            acceptedDutyIds = _uiState.value.acceptedDutyIds + dutyId,
            actionMessage = "Substitution duty accepted! +1.0 Credit upon attendance/completion."
        )
    }

    fun clearActionMessage() {
        _uiState.value = _uiState.value.copy(actionMessage = null)
    }
}

// ---------- Preferences ViewModel ----------

data class PreferencesUiState(
    val isLoading: Boolean = false,
    val acceptAutoAssignments: Boolean = true,
    val allowEmergencyAssignments: Boolean = false,
    val maxWeeklySubstitutions: Int? = null,
    val preferMorningClasses: Boolean = false,
    val preferSameDepartment: Boolean = true,
    val onlyMyClasses: Boolean = false,
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
                        acceptAutoAssignments = p.acceptAutoAssignments,
                        allowEmergencyAssignments = p.allowEmergencyAssignments,
                        maxWeeklySubstitutions = p.maxWeeklySubstitutions,
                        preferMorningClasses = p.preferMorningClasses,
                        preferSameDepartment = p.preferSameDepartment,
                        onlyMyClasses = p.onlyMyClasses,
                        maxPerDay = p.maxSubstitutionsPerDay ?: 2,
                        maxPerWeek = p.maxWeeklySubstitutions ?: (p.maxSubstitutionsPerWeek ?: 6),
                        crossDept = p.preferSameDepartment.not()
                    )
                }
                is NetworkResult.Error -> {
                    _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = res.message)
                }
                NetworkResult.Loading -> Unit
            }
        }
    }

    fun saveAll(
        acceptAuto: Boolean,
        allowEmergency: Boolean,
        maxWeekly: Int?,
        preferMorning: Boolean,
        preferSameDept: Boolean,
        onlyMyClasses: Boolean,
        onComplete: () -> Unit = {}
    ) {
        _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null, isSaved = false)
        viewModelScope.launch {
            val updateDto = SubstitutionPreferenceUpdateDto(
                acceptAutoAssignments = acceptAuto,
                allowEmergencyAssignments = allowEmergency,
                maxWeeklySubstitutions = maxWeekly,
                preferMorningClasses = preferMorning,
                preferSameDepartment = preferSameDept,
                onlyMyClasses = onlyMyClasses,
                maxSubstitutionsPerWeek = maxWeekly,
                willingForCrossDepartment = !preferSameDept
            )
            when (val res = preferencesRepository.updatePreferences(updateDto)) {
                is NetworkResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        isSaved = true,
                        acceptAutoAssignments = acceptAuto,
                        allowEmergencyAssignments = allowEmergency,
                        maxWeeklySubstitutions = maxWeekly,
                        preferMorningClasses = preferMorning,
                        preferSameDepartment = preferSameDept,
                        onlyMyClasses = onlyMyClasses,
                        maxPerWeek = maxWeekly ?: 6,
                        crossDept = !preferSameDept
                    )
                    onComplete()
                }
                is NetworkResult.Error -> {
                    _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = res.message)
                }
                NetworkResult.Loading -> Unit
            }
        }
    }

    fun savePreferences(day: Int, week: Int, cross: Boolean, onComplete: () -> Unit) {
        saveAll(
            acceptAuto = _uiState.value.acceptAutoAssignments,
            allowEmergency = _uiState.value.allowEmergencyAssignments,
            maxWeekly = week,
            preferMorning = _uiState.value.preferMorningClasses,
            preferSameDept = !cross,
            onlyMyClasses = _uiState.value.onlyMyClasses,
            onComplete = onComplete
        )
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

    fun markAllRead() {
        viewModelScope.launch {
            notificationRepository.markAllAsRead()
            loadNotifications()
        }
    }

    fun clearAll(context: android.content.Context? = null) {
        val currentIds = _uiState.value.notifications.map { it.id }
        _uiState.value = _uiState.value.copy(
            isLoading = false,
            notifications = emptyList(),
            unreadCount = 0
        )
        viewModelScope.launch {
            notificationRepository.clearAllNotifications(context, currentIds)
        }
    }
}
