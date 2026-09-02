package com.governence.faflow.faflow.data

import com.governence.faflow.core.network.FaflowApiService
import com.governence.faflow.core.network.LeaveBatchCreateDto
import com.governence.faflow.core.network.LeaveCreateDto
import com.governence.faflow.core.network.NetworkResult
import com.governence.faflow.core.network.SubstitutionPreferenceUpdateDto
import com.governence.faflow.domain.model.CreditTransaction
import com.governence.faflow.domain.model.LeaveRequest
import com.governence.faflow.domain.model.LeaveStatus
import com.governence.faflow.domain.model.TimetableSlot
import com.governence.faflow.faflow.CreditRepository
import com.governence.faflow.faflow.LeaveRepository
import com.governence.faflow.faflow.SubstitutionRepository
import com.governence.faflow.faflow.TimetableRepository

/**
 * Timetable repository fetching real faculty schedules from FAFLOW.
 */
class TimetableRepositoryImpl(
    private val apiService: FaflowApiService
) : TimetableRepository {

    override suspend fun getTimetableForTeacher(teacherId: Int): NetworkResult<List<TimetableSlot>> {
        return try {
            val response = apiService.getTimetableByTeacher(teacherId)
            if (response.isSuccessful && response.body() != null) {
                val list = response.body()!!.map { dto ->
                    TimetableSlot(
                        id = dto.id,
                        teacherId = dto.teacherId,
                        subjectName = dto.subjectName ?: "Subject ${dto.subjectId ?: ""}",
                        subjectCode = dto.subjectCode ?: "CS-${dto.subjectId ?: ""}",
                        className = dto.className ?: "Class ${dto.classId}",
                        section = dto.classSection ?: "A",
                        roomNumber = dto.roomNumber ?: "Room ${dto.roomId ?: ""}",
                        dayOrder = dto.dayOrder,
                        periodNumber = dto.periodNumber
                    )
                }
                NetworkResult.Success(list)
            } else {
                NetworkResult.Error(response.code(), "Failed to load timetable (${response.code()})")
            }
        } catch (e: Exception) {
            NetworkResult.Error(-1, e.localizedMessage ?: "Network error loading timetable", e)
        }
    }

    override suspend fun getTimetableByDayOrder(teacherId: Int, dayOrder: Int): NetworkResult<List<TimetableSlot>> {
        return when (val res = getTimetableForTeacher(teacherId)) {
            is NetworkResult.Success -> {
                val filtered = res.data.filter { it.dayOrder == dayOrder }.sortedBy { it.periodNumber }
                NetworkResult.Success(filtered)
            }
            is NetworkResult.Error -> res
            NetworkResult.Loading -> NetworkResult.Loading
        }
    }
}

/**
 * Leave repository interfacing with /leaves/ APIs.
 */
class LeaveRepositoryImpl(
    private val apiService: FaflowApiService
) : LeaveRepository {

    override suspend fun getMyLeaves(): NetworkResult<List<LeaveRequest>> {
        return try {
            val response = apiService.getMyLeaves(includeExpired = true)
            if (response.isSuccessful && response.body() != null) {
                val leaves = response.body()!!.map { dto ->
                    val status = when (dto.status.lowercase()) {
                        "approved" -> LeaveStatus.APPROVED
                        "rejected" -> LeaveStatus.REJECTED
                        "cancelled" -> LeaveStatus.CANCELLED
                        else -> LeaveStatus.PENDING
                    }
                    LeaveRequest(
                        id = dto.id,
                        teacherId = dto.teacherId,
                        date = dto.date,
                        dayOrder = dto.dayOrder,
                        periodNumber = dto.periodNumber,
                        reason = dto.reason,
                        status = status,
                        isEmergency = dto.isEmergency,
                        substituteTeacherName = dto.alterAssignment?.substituteName
                    )
                }
                NetworkResult.Success(leaves)
            } else {
                NetworkResult.Error(response.code(), "Failed to fetch leave history (${response.code()})")
            }
        } catch (e: Exception) {
            NetworkResult.Error(-1, e.localizedMessage ?: "Network error fetching leaves", e)
        }
    }

    override suspend fun applyLeave(date: String, periodNumber: Int, reason: String): NetworkResult<LeaveRequest> {
        return try {
            val response = apiService.applyLeave(
                LeaveCreateDto(date = date, periodNumber = periodNumber, reason = reason)
            )
            if (response.isSuccessful && response.body() != null) {
                val dto = response.body()!!
                val req = LeaveRequest(
                    id = dto.id,
                    teacherId = dto.teacherId,
                    date = dto.date,
                    dayOrder = dto.dayOrder,
                    periodNumber = dto.periodNumber,
                    reason = dto.reason,
                    status = LeaveStatus.PENDING,
                    isEmergency = dto.isEmergency
                )
                NetworkResult.Success(req)
            } else {
                NetworkResult.Error(response.code(), "Leave submission failed (${response.code()})")
            }
        } catch (e: Exception) {
            NetworkResult.Error(-1, e.localizedMessage ?: "Failed to submit leave", e)
        }
    }

    suspend fun applyLeaveBatch(date: String, periodNumbers: List<Int>, reason: String): NetworkResult<List<LeaveRequest>> {
        return try {
            val response = apiService.applyLeaveBatch(
                LeaveBatchCreateDto(date = date, periodNumbers = periodNumbers, reason = reason)
            )
            if (response.isSuccessful && response.body() != null) {
                val list = response.body()!!.map { dto ->
                    LeaveRequest(
                        id = dto.id,
                        teacherId = dto.teacherId,
                        date = dto.date,
                        dayOrder = dto.dayOrder,
                        periodNumber = dto.periodNumber,
                        reason = dto.reason,
                        status = LeaveStatus.PENDING,
                        isEmergency = dto.isEmergency
                    )
                }
                NetworkResult.Success(list)
            } else {
                NetworkResult.Error(response.code(), "Batch leave submission failed (${response.code()})")
            }
        } catch (e: Exception) {
            NetworkResult.Error(-1, e.localizedMessage ?: "Failed to submit batch leave", e)
        }
    }

    override suspend fun cancelLeave(leaveId: Int): NetworkResult<Boolean> {
        return try {
            val response = apiService.cancelLeave(leaveId)
            if (response.isSuccessful) {
                NetworkResult.Success(true)
            } else {
                NetworkResult.Error(response.code(), "Failed to cancel leave (${response.code()})")
            }
        } catch (e: Exception) {
            NetworkResult.Error(-1, e.localizedMessage ?: "Failed to cancel leave", e)
        }
    }
}

/**
 * Credit repository querying /credits/ and /teachers/{id}/credits.
 */
class CreditRepositoryImpl(
    private val apiService: FaflowApiService
) : CreditRepository {

    override suspend fun getCreditBalance(teacherId: Int): NetworkResult<Int> {
        return try {
            val response = apiService.getTeacherCredits(teacherId)
            if (response.isSuccessful && response.body() != null) {
                NetworkResult.Success(response.body()!!.balance)
            } else {
                NetworkResult.Error(response.code(), "Failed to get credit balance")
            }
        } catch (e: Exception) {
            NetworkResult.Error(-1, e.localizedMessage ?: "Credit balance fetch error", e)
        }
    }

    override suspend fun getCreditTransactions(): NetworkResult<List<CreditTransaction>> {
        return try {
            val response = apiService.getMyCreditTransactions()
            if (response.isSuccessful && response.body() != null) {
                val list = response.body()!!.map { dto ->
                    CreditTransaction(
                        id = dto.id,
                        teacherId = dto.teacherId,
                        change = dto.change,
                        category = dto.category ?: "other",
                        reason = dto.reason,
                        createdAt = dto.createdAt
                    )
                }
                NetworkResult.Success(list)
            } else {
                NetworkResult.Error(response.code(), "Failed to fetch credit ledger")
            }
        } catch (e: Exception) {
            NetworkResult.Error(-1, e.localizedMessage ?: "Credit transactions fetch error", e)
        }
    }
}

/**
 * Substitution repository managing substitute duties, recommendations, and assignments.
 */
class SubstitutionRepositoryImpl(
    private val apiService: FaflowApiService
) : SubstitutionRepository {

    override suspend fun getMyDuties(): NetworkResult<List<LeaveRequest>> {
        return try {
            val response = apiService.getTeacherSubstitutionDuties()
            if (response.isSuccessful && response.body() != null) {
                val duties = response.body()!!.map { dto ->
                    LeaveRequest(
                        id = dto.id,
                        teacherId = dto.teacherId,
                        date = dto.date,
                        dayOrder = dto.dayOrder,
                        periodNumber = dto.periodNumber,
                        reason = dto.reason,
                        status = LeaveStatus.APPROVED,
                        isEmergency = dto.isEmergency,
                        substituteTeacherName = dto.alterAssignment?.substituteName
                    )
                }
                NetworkResult.Success(duties)
            } else {
                NetworkResult.Error(response.code(), "Failed to load substitution duties")
            }
        } catch (e: Exception) {
            NetworkResult.Error(-1, e.localizedMessage ?: "Failed to load substitution duties", e)
        }
    }

    override suspend fun assignSubstitute(leaveId: Int, substituteTeacherId: Int): NetworkResult<Boolean> {
        return try {
            val response = apiService.assignSubstitute(leaveId, substituteTeacherId)
            if (response.isSuccessful) {
                NetworkResult.Success(true)
            } else {
                NetworkResult.Error(response.code(), "Failed to assign substitute (${response.code()})")
            }
        } catch (e: Exception) {
            NetworkResult.Error(-1, e.localizedMessage ?: "Error assigning substitute", e)
        }
    }

    suspend fun undoAssignment(leaveId: Int): NetworkResult<Boolean> {
        return try {
            val response = apiService.undoSubstitutionAssignment(leaveId)
            if (response.isSuccessful) {
                NetworkResult.Success(true)
            } else {
                NetworkResult.Error(response.code(), "Failed to undo assignment")
            }
        } catch (e: Exception) {
            NetworkResult.Error(-1, e.localizedMessage ?: "Error undoing assignment", e)
        }
    }
}

/**
 * Preferences repository for faculty substitution limits and policies.
 */
class PreferencesRepositoryImpl(
    private val apiService: FaflowApiService
) {
    suspend fun getPreferences(): NetworkResult<SubstitutionPreferenceUpdateDto> {
        return try {
            val response = apiService.getMyPreferences()
            if (response.isSuccessful && response.body() != null) {
                val b = response.body()!!
                NetworkResult.Success(
                    SubstitutionPreferenceUpdateDto(
                        maxSubstitutionsPerDay = b.maxSubstitutionsPerDay,
                        maxSubstitutionsPerWeek = b.maxSubstitutionsPerWeek,
                        willingForCrossDepartment = b.willingForCrossDepartment
                    )
                )
            } else {
                NetworkResult.Error(response.code(), "Failed to fetch preferences")
            }
        } catch (e: Exception) {
            NetworkResult.Error(-1, e.localizedMessage ?: "Preferences error", e)
        }
    }

    suspend fun updatePreferences(dayLimit: Int, weekLimit: Int, crossDept: Boolean): NetworkResult<Boolean> {
        return try {
            val response = apiService.updateMyPreferences(
                SubstitutionPreferenceUpdateDto(
                    maxSubstitutionsPerDay = dayLimit,
                    maxSubstitutionsPerWeek = weekLimit,
                    willingForCrossDepartment = crossDept
                )
            )
            if (response.isSuccessful) {
                NetworkResult.Success(true)
            } else {
                NetworkResult.Error(response.code(), "Failed to update preferences")
            }
        } catch (e: Exception) {
            NetworkResult.Error(-1, e.localizedMessage ?: "Preferences update error", e)
        }
    }
}

/**
 * Notifications repository querying and marking alerts read.
 */
class NotificationRepositoryImpl(
    private val apiService: FaflowApiService
) {
    suspend fun getNotifications(unreadOnly: Boolean = false) = try {
        val res = apiService.listNotifications(unreadOnly)
        if (res.isSuccessful && res.body() != null) {
            NetworkResult.Success(res.body()!!)
        } else {
            NetworkResult.Error(res.code(), "Failed to fetch notifications")
        }
    } catch (e: Exception) {
        NetworkResult.Error(-1, e.localizedMessage ?: "Notification fetch error", e)
    }

    suspend fun getUnreadCount() = try {
        val res = apiService.getUnreadCount()
        if (res.isSuccessful && res.body() != null) {
            NetworkResult.Success(res.body()!!.count)
        } else {
            NetworkResult.Error(res.code(), "Failed to fetch unread count")
        }
    } catch (e: Exception) {
        NetworkResult.Error(-1, e.localizedMessage ?: "Notification count error", e)
    }

    suspend fun markAsRead(notificationId: Int) = try {
        val res = apiService.markNotificationRead(notificationId)
        if (res.isSuccessful) NetworkResult.Success(true) else NetworkResult.Error(res.code(), "Mark read failed")
    } catch (e: Exception) {
        NetworkResult.Error(-1, e.localizedMessage ?: "Error marking notification as read", e)
    }
}

/**
 * Academic summary repository querying /academic-calendar/my-today-summary and /resolve.
 */
class AcademicSummaryRepository(
    private val apiService: FaflowApiService
) {
    suspend fun getMyTodaySummary() = try {
        val res = apiService.getMyTodaySummary()
        if (res.isSuccessful && res.body() != null) {
            NetworkResult.Success(res.body()!!)
        } else {
            NetworkResult.Error(res.code(), "Failed to load today's calendar summary")
        }
    } catch (e: Exception) {
        NetworkResult.Error(-1, e.localizedMessage ?: "Academic calendar error", e)
    }

    suspend fun resolveDate(date: String) = try {
        val res = apiService.resolveDayOrder(date)
        if (res.isSuccessful && res.body() != null) {
            NetworkResult.Success(res.body()!!)
        } else {
            NetworkResult.Error(res.code(), "Failed to resolve day order for $date")
        }
    } catch (e: Exception) {
        NetworkResult.Error(-1, e.localizedMessage ?: "Date resolution error", e)
    }
}
