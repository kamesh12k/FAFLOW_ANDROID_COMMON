package com.governence.faflow.faflow

import com.governence.faflow.core.network.NetworkResult
import com.governence.faflow.core.network.RecommendationOutDto
import com.governence.faflow.domain.model.CreditTransaction
import com.governence.faflow.domain.model.LeaveHistoryDay
import com.governence.faflow.domain.model.LeaveRequest
import com.governence.faflow.domain.model.TimetableSlot

interface TimetableRepository {
    suspend fun getTimetableForTeacher(teacherId: Int): NetworkResult<List<TimetableSlot>>
    suspend fun getTimetableByDayOrder(teacherId: Int, dayOrder: Int): NetworkResult<List<TimetableSlot>>
}

interface LeaveRepository {
    suspend fun getMyLeaves(): NetworkResult<List<LeaveRequest>>
    suspend fun getGroupedLeaves(): NetworkResult<List<LeaveHistoryDay>>
    suspend fun applyLeave(date: String, periodNumber: Int, reason: String): NetworkResult<LeaveRequest>
    suspend fun cancelLeave(leaveId: Int): NetworkResult<Boolean>
    suspend fun cancelLeaves(leaveIds: List<Int>): NetworkResult<Boolean>
}

interface CreditRepository {
    suspend fun getCreditBalance(teacherId: Int): NetworkResult<Int>
    suspend fun getCreditTransactions(): NetworkResult<List<CreditTransaction>>
}

interface SubstitutionRepository {
    suspend fun getMyDuties(): NetworkResult<List<LeaveRequest>>
    suspend fun getMyLeavesNeedingCoverage(): NetworkResult<List<LeaveRequest>>
    suspend fun getCandidates(leaveId: Int, includeCrossDept: Boolean = false): NetworkResult<List<RecommendationOutDto>>
    suspend fun assignSubstitute(leaveId: Int, substituteTeacherId: Int): NetworkResult<Boolean>
    suspend fun undoAssignment(leaveId: Int): NetworkResult<Boolean>
}
