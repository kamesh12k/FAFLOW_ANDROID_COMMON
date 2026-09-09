package com.governence.faflow.ui.viewmodels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.governence.faflow.auth.data.AuthRepository
import com.governence.faflow.core.network.NetworkResult
import com.governence.faflow.core.network.NotificationOutDto
import com.governence.faflow.core.network.SubstitutionPreferenceOutDto
import com.governence.faflow.core.network.SubstitutionPreferenceUpdateDto
import com.governence.faflow.domain.model.CreditTransaction
import com.governence.faflow.domain.model.LeaveHistoryDay
import com.governence.faflow.domain.model.LeaveRequest
import com.governence.faflow.domain.model.LeaveStatus
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
    val groupedLeaves: List<LeaveHistoryDay> = emptyList(),
    val isSubmittedSuccessfully: Boolean = false,
    val resolvedDayOrder: Int? = null,
    val isBlockedDate: Boolean = false,
    val dayType: String? = null,
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
        viewModelScope.launch {
            when (val res = academicSummaryRepository.resolveDate(date)) {
                is NetworkResult.Success -> {
                    val isBlocked = res.data.blocksOperations || res.data.dayType.contains("HOLIDAY", ignoreCase = true)
                    _uiState.value = _uiState.value.copy(
                        resolvedDayOrder = res.data.dayOrder,
                        isBlockedDate = isBlocked,
                        dayType = res.data.dayType
                    )
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

    fun submitLeaveBatch(date: String, periodNumbers: List<Int>, reason: String, onComplete: () -> Unit) {
        _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
        viewModelScope.launch {
            when (val res = leaveRepository.applyLeaveBatch(date, periodNumbers, reason)) {
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
    // Tab 1: My leaves that need a substitute assigned (pending or unassigned)
    val activeTab: String = "NEEDS_COVER", // "NEEDS_COVER" vs "COVERED"
    // All my leaves from teacher/substitution/my-leaves
    val allMySubstitutionLeaves: List<LeaveRequest> = emptyList(),
    // Leaves without an assigned substitute (Needs Cover tab)
    val leavesNeedingCoverage: List<LeaveRequest> = emptyList(),
    // Leaves already covered (Assigned/Covered tab)
    val coveredLeaves: List<LeaveRequest> = emptyList(),
    val selectedLeaveForCandidates: LeaveRequest? = null,
    val candidates: List<com.governence.faflow.core.network.RecommendationOutDto> = emptyList(),
    val isLoadingCandidates: Boolean = false,
    val isAssignmentInProgress: Boolean = false,
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
            when (val res = substitutionRepository.getMyLeavesNeedingCoverage()) {
                is NetworkResult.Success -> {
                    val all = res.data
                    // Needs Cover: leaves without a substitute assigned
                    val needsCover = all.filter { it.substituteTeacherName == null }
                    // Covered: leaves that already have a substitute assigned
                    val covered = all.filter { it.substituteTeacherName != null }
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        allMySubstitutionLeaves = all,
                        leavesNeedingCoverage = needsCover,
                        coveredLeaves = covered
                    )
                }
                is NetworkResult.Error -> {
                    _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = res.message)
                }
                NetworkResult.Loading -> Unit
            }
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
}
