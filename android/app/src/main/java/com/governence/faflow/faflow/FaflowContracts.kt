package com.governence.faflow.faflow

import com.governence.faflow.core.network.NetworkResult
import com.governence.faflow.core.network.RecommendationOutDto
import com.governence.faflow.domain.model.CreditTransaction
import com.governence.faflow.domain.model.LeaveRequest
import com.governence.faflow.domain.model.TimetableSlot

interface TimetableRepository {
    suspend fun getTimetableForTeacher(teacherId: Int): NetworkResult<List<TimetableSlot>>
    suspend fun getTimetableByDayOrder(teacherId: Int, dayOrder: Int): NetworkResult<List<TimetableSlot>>
}

interface LeaveRepository {
    suspend fun getMyLeaves(): NetworkResult<List<LeaveRequest>>
    suspend fun applyLeave(date: String, periodNumber: Int, reason: String): NetworkResult<LeaveRequest>
    suspend fun cancelLeave(leaveId: Int): NetworkResult<Boolean>
}

interface CreditRepository {
    suspend fun getCreditBalance(teacherId: Int): NetworkResult<Int>
    suspend fun getCreditTransactions(): NetworkResult<List<CreditTransaction>>
}

interface SubstitutionRepository {
    suspend fun getMyDuties(): NetworkResult<List<LeaveRequest>>
    suspend fun assignSubstitute(leaveId: Int, substituteTeacherId: Int): NetworkResult<Boolean>
}
