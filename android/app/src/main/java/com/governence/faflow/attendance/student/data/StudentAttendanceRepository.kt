package com.governence.faflow.attendance.student.data

import com.governence.faflow.core.network.AttendanceSessionCreateDto
import com.governence.faflow.core.network.AttendanceSessionDto
import com.governence.faflow.core.network.AttendanceSubmitRequestDto
import com.governence.faflow.core.network.ClassOutDto
import com.governence.faflow.core.network.ClassRosterDto
import com.governence.faflow.core.network.EmergencyAttendanceRequestDto
import com.governence.faflow.core.network.FaflowApiService
import com.governence.faflow.core.network.NetworkResult
import com.governence.faflow.core.network.OfflineBatchSyncRequestDto
import com.governence.faflow.core.network.OfflineSyncOperationDto
import com.governence.faflow.core.network.StudentExceptionItemDto
import com.governence.faflow.core.network.TeacherTodayScheduleDto
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID

sealed interface StudentAttendanceResult {
    data class Success(val session: AttendanceSessionDto, val isOnline: Boolean) : StudentAttendanceResult
    data class QueuedOffline(val operationId: String, val message: String) : StudentAttendanceResult
    data class Error(val message: String) : StudentAttendanceResult
}

open class StudentAttendanceRepository(
    private val apiService: FaflowApiService? = null,
    private val localDb: StudentAttendanceLocalDb? = null
) {

    private fun getIsoUtcTimestamp(): String {
        return SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }.format(Date())
    }

    /**
     * Retrieves today's schedule. Offline-first: returns cached schedule if network is unavailable.
     */
    open suspend fun getTodaySchedule(targetDate: String? = null): NetworkResult<TeacherTodayScheduleDto> = withContext(Dispatchers.IO) {
        val service = apiService ?: return@withContext NetworkResult.Error(-1, "No API Service")
        val db = localDb ?: return@withContext NetworkResult.Error(-1, "No Local DB")
        try {
            val response = service.getStudentAttendanceToday(targetDate)
            if (response.isSuccessful && response.body() != null) {
                val data = response.body()!!
                db.saveTodaySchedule(data)
                NetworkResult.Success(data)
            } else {
                // Fallback to local cache if network call fails
                val cached = db.getCachedTodaySchedule()
                if (cached != null) {
                    NetworkResult.Success(cached)
                } else {
                    NetworkResult.Error(response.code(), response.message() ?: "Failed to fetch today's schedule")
                }
            }
        } catch (e: Exception) {
            val cached = db.getCachedTodaySchedule()
            if (cached != null) {
                NetworkResult.Success(cached)
            } else {
                NetworkResult.Error(-1, e.localizedMessage ?: "Network error", e)
            }
        }
    }

    /**
     * Retrieves class roster. Offline-first: caches and falls back to local DB.
     */
    open suspend fun getClassRoster(classId: Int): NetworkResult<ClassRosterDto> = withContext(Dispatchers.IO) {
        val service = apiService ?: return@withContext NetworkResult.Error(-1, "No API Service")
        val db = localDb ?: return@withContext NetworkResult.Error(-1, "No Local DB")
        try {
            val response = service.getStudentClassRoster(classId)
            if (response.isSuccessful && response.body() != null) {
                val data = response.body()!!
                db.saveClassRoster(data)
                NetworkResult.Success(data)
            } else {
                val cached = db.getCachedClassRoster(classId)
                if (cached != null) {
                    NetworkResult.Success(cached)
                } else {
                    NetworkResult.Error(response.code(), "Failed to load class roster")
                }
            }
        } catch (e: Exception) {
            val cached = db.getCachedClassRoster(classId)
            if (cached != null) {
                NetworkResult.Success(cached)
            } else {
                NetworkResult.Error(-1, e.localizedMessage ?: "Offline: No cached roster for this class", e)
            }
        }
    }

    /**
     * Retrieves all classes for emergency attendance selector.
     */
    open suspend fun getAllClasses(): NetworkResult<List<ClassOutDto>> = withContext(Dispatchers.IO) {
        val service = apiService ?: return@withContext NetworkResult.Error(-1, "No API Service")
        val db = localDb ?: return@withContext NetworkResult.Error(-1, "No Local DB")
        try {
            val response = service.getClasses()
            if (response.isSuccessful && response.body() != null) {
                val list = response.body()!!
                db.saveClasses(list)
                NetworkResult.Success(list)
            } else {
                val cached = db.getCachedClasses()
                NetworkResult.Success(cached)
            }
        } catch (e: Exception) {
            val cached = db.getCachedClasses()
            NetworkResult.Success(cached)
        }
    }

    /**
     * Submits student attendance for a normal session or registered substitution.
     * Offline-first: creates a durable outbox operation first. Tries immediate sync.
     */
    open suspend fun submitAttendance(
        sessionId: Int,
        classId: Int,
        absentSuffixes: List<String>,
        exceptions: List<StudentExceptionItemDto>
    ): StudentAttendanceResult = withContext(Dispatchers.IO) {
        val service = apiService ?: return@withContext StudentAttendanceResult.Error("No API Service")
        val db = localDb ?: return@withContext StudentAttendanceResult.Error("No Local DB")
        val opId = UUID.randomUUID().toString()
        val timestamp = getIsoUtcTimestamp()

        val op = OfflineSyncOperationDto(
            operationId = opId,
            operationType = "SUBMIT",
            sessionId = sessionId,
            classId = classId,
            absentRollSuffixes = absentSuffixes,
            studentExceptions = exceptions,
            clientTimestamp = timestamp
        )

        // 1. Durably enqueue in local SQLite outbox
        db.enqueueOperation(op)

        // 2. Try online sync immediately
        try {
            val submitReq = AttendanceSubmitRequestDto(
                absentRollSuffixes = absentSuffixes,
                studentExceptions = exceptions,
                clientTimestamp = timestamp
            )
            val response = service.submitStudentAttendance(sessionId, submitReq)
            if (response.isSuccessful && response.body() != null) {
                db.markOperationSynced(opId)
                db.saveAttendanceSession(response.body()!!)
                StudentAttendanceResult.Success(response.body()!!, isOnline = true)
            } else {
                db.updateOperationAttempt(opId, response.message())
                StudentAttendanceResult.QueuedOffline(opId, "Saved on device — will sync automatically")
            }
        } catch (e: Exception) {
            db.updateOperationAttempt(opId, e.localizedMessage)
            StudentAttendanceResult.QueuedOffline(opId, "Saved on device — will sync automatically")
        }
    }

    /**
     * Submits emergency attendance.
     * Offline-first: creates a durable outbox operation first. Tries immediate sync.
     */
    open suspend fun submitEmergencyAttendance(
        classId: Int,
        periodNumber: Int,
        absentSuffixes: List<String>,
        exceptions: List<StudentExceptionItemDto>
    ): StudentAttendanceResult = withContext(Dispatchers.IO) {
        val service = apiService ?: return@withContext StudentAttendanceResult.Error("No API Service")
        val db = localDb ?: return@withContext StudentAttendanceResult.Error("No Local DB")
        val opId = UUID.randomUUID().toString()
        val timestamp = getIsoUtcTimestamp()

        val op = OfflineSyncOperationDto(
            operationId = opId,
            operationType = "EMERGENCY",
            sessionId = null,
            classId = classId,
            periodNumber = periodNumber,
            absentRollSuffixes = absentSuffixes,
            studentExceptions = exceptions,
            clientTimestamp = timestamp
        )

        db.enqueueOperation(op)

        try {
            val emergencyReq = EmergencyAttendanceRequestDto(
                classId = classId,
                periodNumber = periodNumber,
                subjectId = null,
                absentRollSuffixes = absentSuffixes,
                studentExceptions = exceptions
            )
            val response = service.emergencyStudentAttendance(emergencyReq)
            if (response.isSuccessful && response.body() != null) {
                db.markOperationSynced(opId)
                db.saveAttendanceSession(response.body()!!)
                StudentAttendanceResult.Success(response.body()!!, isOnline = true)
            } else {
                db.updateOperationAttempt(opId, response.message())
                StudentAttendanceResult.QueuedOffline(opId, "Saved on device — will sync automatically")
            }
        } catch (e: Exception) {
            db.updateOperationAttempt(opId, e.localizedMessage)
            StudentAttendanceResult.QueuedOffline(opId, "Saved on device — will sync automatically")
        }
    }

    /**
     * Creates or retrieves attendance session online.
     */
    open suspend fun getOrCreateSession(
        slotId: Int,
        classId: Int,
        subjectId: Int,
        substitutionId: Int? = null,
        isSubstitution: Boolean = false
    ): AttendanceSessionDto? = withContext(Dispatchers.IO) {
        val service = apiService ?: return@withContext null
        val db = localDb ?: return@withContext null
        try {
            val createReq = AttendanceSessionCreateDto(
                timetableSlotId = slotId,
                classId = classId,
                subjectId = subjectId,
                substitutionId = substitutionId,
                attendanceType = if (isSubstitution) "REGISTERED_SUBSTITUTION" else "NORMAL"
            )
            val res = service.createStudentAttendanceSession(createReq)
            if (res.isSuccessful && res.body() != null) {
                db.saveAttendanceSession(res.body()!!)
                res.body()
            } else {
                null
            }
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Synchronizes all pending offline operations with the server.
     */
    open suspend fun syncPendingOperations(deviceId: String = "ANDROID_DEVICE"): Int = withContext(Dispatchers.IO) {
        val service = apiService ?: return@withContext 0
        val db = localDb ?: return@withContext 0
        val pending = db.getPendingOperations()
        if (pending.isEmpty()) return@withContext 0

        try {
            val batchReq = OfflineBatchSyncRequestDto(
                deviceId = deviceId,
                operations = pending
            )
            val response = service.syncOfflineAttendanceBatch(batchReq)
            if (response.isSuccessful && response.body() != null) {
                val batchRes = response.body()!!
                for (result in batchRes.results) {
                    if (result.success) {
                        db.markOperationSynced(result.operationId)
                    } else {
                        db.updateOperationAttempt(result.operationId, result.error)
                    }
                }
                batchRes.successCount
            } else {
                0
            }
        } catch (e: Exception) {
            0
        }
    }

    open fun getPendingCount(): Int {
        return localDb?.getPendingCount() ?: 0
    }
}
