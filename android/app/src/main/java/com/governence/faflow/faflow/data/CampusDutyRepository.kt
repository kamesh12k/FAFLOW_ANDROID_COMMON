package com.governence.faflow.faflow.data

import com.governence.faflow.core.network.CampusDutyDto
import com.governence.faflow.core.network.DutyAssignRequestDto
import com.governence.faflow.core.network.DutyAssignmentDto
import com.governence.faflow.core.network.DutyCandidatesResponseDto
import com.governence.faflow.core.network.DutyCreateRequestDto
import com.governence.faflow.core.network.DutyDashboardMetricsDto
import com.governence.faflow.core.network.DutyLockRequestDto
import com.governence.faflow.core.network.DutyOverrideRequestDto
import com.governence.faflow.core.network.DutyReplaceRequestDto
import com.governence.faflow.core.network.FaflowApiService
import com.governence.faflow.core.network.NetworkResult

class CampusDutyRepositoryImpl(
    private val apiService: FaflowApiService
) {
    suspend fun getMyDuties(date: String? = null): NetworkResult<List<CampusDutyDto>> {
        return try {
            val response = apiService.getMyDuties(date)
            if (response.isSuccessful && response.body() != null) {
                NetworkResult.Success(response.body()!!)
            } else {
                NetworkResult.Error(response.code(), "Failed to retrieve assigned duties (${response.code()})")
            }
        } catch (e: Exception) {
            NetworkResult.Error(-1, e.localizedMessage ?: "Failed to connect to duty service", e)
        }
    }

    suspend fun getCampusDuties(
        date: String? = null,
        dutyType: String? = null,
        departmentId: Int? = null
    ): NetworkResult<List<CampusDutyDto>> {
        return try {
            val response = apiService.getCampusDuties(date, dutyType, departmentId)
            if (response.isSuccessful && response.body() != null) {
                NetworkResult.Success(response.body()!!)
            } else {
                NetworkResult.Error(response.code(), "Failed to load campus duties (${response.code()})")
            }
        } catch (e: Exception) {
            NetworkResult.Error(-1, e.localizedMessage ?: "Network error loading campus duties", e)
        }
    }

    suspend fun getDutyDetail(dutyId: Int): NetworkResult<CampusDutyDto> {
        return try {
            val response = apiService.getDutyDetail(dutyId)
            if (response.isSuccessful && response.body() != null) {
                NetworkResult.Success(response.body()!!)
            } else {
                NetworkResult.Error(response.code(), "Unable to fetch duty details (${response.code()})")
            }
        } catch (e: Exception) {
            NetworkResult.Error(-1, e.localizedMessage ?: "Failed to connect to server", e)
        }
    }

    suspend fun createDuty(request: DutyCreateRequestDto): NetworkResult<CampusDutyDto> {
        return try {
            val response = apiService.createDuty(request)
            if (response.isSuccessful && response.body() != null) {
                NetworkResult.Success(response.body()!!)
            } else {
                NetworkResult.Error(response.code(), "Unable to create duty (${response.code()})")
            }
        } catch (e: Exception) {
            NetworkResult.Error(-1, e.localizedMessage ?: "Failed to create duty", e)
        }
    }

    suspend fun autoAssignDuty(dutyId: Int): NetworkResult<CampusDutyDto> {
        return try {
            val response = apiService.autoAssignDuty(dutyId)
            if (response.isSuccessful && response.body() != null) {
                NetworkResult.Success(response.body()!!)
            } else {
                NetworkResult.Error(response.code(), "Auto-assignment failed (${response.code()})")
            }
        } catch (e: Exception) {
            NetworkResult.Error(-1, e.localizedMessage ?: "Auto-assignment request failed", e)
        }
    }

    suspend fun generateTodayDiscipline(
        targetDate: String? = null,
        departmentId: Int? = null
    ): NetworkResult<List<CampusDutyDto>> {
        return try {
            val response = apiService.generateTodayDiscipline(targetDate, departmentId)
            if (response.isSuccessful && response.body() != null) {
                NetworkResult.Success(response.body()!!)
            } else {
                NetworkResult.Error(response.code(), "Failed to generate today's discipline duties")
            }
        } catch (e: Exception) {
            NetworkResult.Error(-1, e.localizedMessage ?: "Generation failed", e)
        }
    }

    suspend fun getDutyCandidates(dutyId: Int): NetworkResult<DutyCandidatesResponseDto> {
        return try {
            val response = apiService.getDutyCandidates(dutyId)
            if (response.isSuccessful && response.body() != null) {
                NetworkResult.Success(response.body()!!)
            } else {
                NetworkResult.Error(response.code(), "Failed to load candidate evaluations")
            }
        } catch (e: Exception) {
            NetworkResult.Error(-1, e.localizedMessage ?: "Failed to fetch candidates", e)
        }
    }

    suspend fun assignTeacher(dutyId: Int, teacherId: Int, reason: String? = null): NetworkResult<DutyAssignmentDto> {
        return try {
            val response = apiService.assignTeacher(dutyId, DutyAssignRequestDto(teacherId, reason))
            if (response.isSuccessful && response.body() != null) {
                NetworkResult.Success(response.body()!!)
            } else {
                NetworkResult.Error(response.code(), "Failed to assign teacher")
            }
        } catch (e: Exception) {
            NetworkResult.Error(-1, e.localizedMessage ?: "Assignment error", e)
        }
    }

    suspend fun lockAssignment(dutyId: Int, assignmentId: Int, reason: String? = null): NetworkResult<DutyAssignmentDto> {
        return try {
            val response = apiService.lockAssignment(dutyId, assignmentId, DutyLockRequestDto(reason))
            if (response.isSuccessful && response.body() != null) {
                NetworkResult.Success(response.body()!!)
            } else {
                NetworkResult.Error(response.code(), "Failed to lock assignment")
            }
        } catch (e: Exception) {
            NetworkResult.Error(-1, e.localizedMessage ?: "Lock error", e)
        }
    }

    suspend fun unlockAssignment(dutyId: Int, assignmentId: Int): NetworkResult<DutyAssignmentDto> {
        return try {
            val response = apiService.unlockAssignment(dutyId, assignmentId)
            if (response.isSuccessful && response.body() != null) {
                NetworkResult.Success(response.body()!!)
            } else {
                NetworkResult.Error(response.code(), "Failed to unlock assignment")
            }
        } catch (e: Exception) {
            NetworkResult.Error(-1, e.localizedMessage ?: "Unlock error", e)
        }
    }

    suspend fun overrideAssignment(dutyId: Int, assignmentId: Int, newTeacherId: Int, reason: String): NetworkResult<DutyAssignmentDto> {
        return try {
            val response = apiService.overrideAssignment(dutyId, assignmentId, DutyOverrideRequestDto(newTeacherId, reason))
            if (response.isSuccessful && response.body() != null) {
                NetworkResult.Success(response.body()!!)
            } else {
                NetworkResult.Error(response.code(), "Failed to override assignment")
            }
        } catch (e: Exception) {
            NetworkResult.Error(-1, e.localizedMessage ?: "Override error", e)
        }
    }

    suspend fun replaceAssignment(dutyId: Int, assignmentId: Int, reason: String? = null): NetworkResult<DutyAssignmentDto> {
        return try {
            val response = apiService.replaceAssignment(dutyId, assignmentId, DutyReplaceRequestDto(reason))
            if (response.isSuccessful && response.body() != null) {
                NetworkResult.Success(response.body()!!)
            } else {
                NetworkResult.Error(response.code(), "Failed to replace assignment")
            }
        } catch (e: Exception) {
            NetworkResult.Error(-1, e.localizedMessage ?: "Replacement error", e)
        }
    }

    suspend fun getDutyMetrics(date: String? = null, departmentId: Int? = null): NetworkResult<DutyDashboardMetricsDto> {
        return try {
            val response = apiService.getDutyMetrics(date, departmentId)
            if (response.isSuccessful && response.body() != null) {
                NetworkResult.Success(response.body()!!)
            } else {
                NetworkResult.Error(response.code(), "Failed to load duty metrics")
            }
        } catch (e: Exception) {
            NetworkResult.Error(-1, e.localizedMessage ?: "Metrics error", e)
        }
    }
}
