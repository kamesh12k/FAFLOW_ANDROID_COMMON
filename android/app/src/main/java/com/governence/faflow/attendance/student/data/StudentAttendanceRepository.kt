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
import com.governence.faflow.core.network.PublicGovernanceConfigDto
import com.governence.faflow.core.network.StudentExceptionItemDto
import com.governence.faflow.core.network.TeacherTodayScheduleDto
import com.governence.faflow.domain.model.InstitutionalSchedule
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
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
    private val localDb: StudentAttendanceLocalDb? = null,
    private val context: android.content.Context? = null
) {

    private fun getIsoUtcTimestamp(): String {
        return SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }.format(Date())
    }

    /**
     * Synchronizes and applies the dynamic institutional governance configuration (periods & timing windows).
     * Offline-first: if remote call fails, falls back to local SQLite cache, and applies to InstitutionalSchedule.
     */
    open suspend fun syncGovernanceConfig(): NetworkResult<PublicGovernanceConfigDto> = withContext(Dispatchers.IO) {
        val db = localDb
        val service = apiService

        if (service != null) {
            try {
                val response = service.getPublicGovernanceConfig()
                if (response.isSuccessful && response.body() != null) {
                    val config = response.body()!!
                    db?.saveGovernanceConfig(config)
                    applyGovernanceConfig(config)
                    return@withContext NetworkResult.Success(config)
                }
            } catch (e: Exception) {
                // Fall through to cached config
            }
        }

        val cached = db?.getCachedGovernanceConfig()
        if (cached != null) {
            applyGovernanceConfig(cached)
            return@withContext NetworkResult.Success(cached)
        }

        NetworkResult.Error(-1, "Using default institutional schedule")
    }

    private fun applyGovernanceConfig(config: PublicGovernanceConfigDto) {
        InstitutionalSchedule.updateFromConfig(
            periodList = config.periodSchedule,
            leadTime = config.suggestionLeadTimeMinutes,
            startWindow = config.suggestionStartWindowMinutes,
            expirationWindow = config.suggestionExpirationWindowMinutes,
            tolerance = config.currentPeriodToleranceMinutes,
            submissionWindow = config.studentAttendanceSubmissionWindowMinutes
        )
    }

    /**
     * Retrieves today's schedule. Offline-first: returns cached schedule if network is unavailable.
     */
    open suspend fun getTodaySchedule(targetDate: String? = null): NetworkResult<TeacherTodayScheduleDto> = withContext(Dispatchers.IO) {
        val service = apiService ?: return@withContext NetworkResult.Error(-1, "No API Service")
        val db = localDb ?: return@withContext NetworkResult.Error(-1, "No Local DB")

        try {
            // Opportunistically sync governance config
            try {
                syncGovernanceConfig()
            } catch (_: Exception) {}

            val response = service.getStudentAttendanceToday(targetDate)
            if (response.isSuccessful && response.body() != null) {
                val dto = response.body()!!
                db.saveTodaySchedule(dto)
                NetworkResult.Success(dto)
            } else {
                val cached = db.getCachedTodaySchedule()
                if (cached != null) {
                    NetworkResult.Success(cached)
                } else {
                    NetworkResult.Error(response.code(), response.message())
                }
            }
        } catch (e: Exception) {
            val cached = db.getCachedTodaySchedule()
            if (cached != null) {
                NetworkResult.Success(cached)
            } else {
                NetworkResult.Error(0, e.localizedMessage ?: "Offline: No cached schedule available", e)
            }
        }
    }

    /**
     * Retrieves active classes.
     */
    open suspend fun getClasses(): NetworkResult<List<ClassOutDto>> = withContext(Dispatchers.IO) {
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
                if (cached.isNotEmpty()) NetworkResult.Success(cached)
                else NetworkResult.Error(response.code(), response.message())
            }
        } catch (e: Exception) {
            val cached = db.getCachedClasses()
            if (cached.isNotEmpty()) NetworkResult.Success(cached)
            else NetworkResult.Error(0, e.localizedMessage ?: "Offline: No cached classes", e)
        }
    }

    /**
     * Alias for getClasses for compatibility.
     */
    open suspend fun getAllClasses(): NetworkResult<List<ClassOutDto>> = getClasses()

    /**
     * Initializes or retrieves an attendance session for the given slot.
     */
    open suspend fun getOrCreateSession(
        slotId: Int?,
        classId: Int,
        subjectId: Int?,
        substitutionId: Int?,
        isSubstitution: Boolean
    ): AttendanceSessionDto? = withContext(Dispatchers.IO) {
        val service = apiService
        val db = localDb

        // 1. If online, attempt to create/fetch from server
        if (service != null) {
            try {
                val createReq = AttendanceSessionCreateDto(
                    timetableSlotId = if (slotId != null && slotId > 0) slotId else null,
                    classId = classId,
                    subjectId = subjectId,
                    substitutionId = substitutionId,
                    attendanceType = if (isSubstitution) "REGISTERED_SUBSTITUTION" else "NORMAL"
                )
                val response = service.createStudentAttendanceSession(createReq)
                if (response.isSuccessful && response.body() != null) {
                    val sess = response.body()!!
                    db?.saveAttendanceSession(sess)
                    return@withContext sess
                }
            } catch (_: Exception) {
                // Offline fallback
            }
        }

        // 2. Check cached sessions if any matches classId and slotId
        val cachedId = db?.getCachedTodaySchedule()?.scheduledClasses?.find { it.timetableSlotId == slotId }?.sessionId
            ?: db?.getCachedTodaySchedule()?.substitutions?.find { it.timetableSlotId == slotId }?.sessionId
        if (cachedId != null && cachedId > 0) {
            val session = db?.getCachedAttendanceSession(cachedId)
            if (session != null) return@withContext session
        }

        // 3. Synthesize a local session for offline attendance taking
        val localSession = AttendanceSessionDto(
            id = if (slotId != null && slotId > 0) -slotId else -classId,
            attendanceDate = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date()),
            periodNumber = 1,
            classId = classId,
            className = "Class $classId",
            section = "",
            subjectId = subjectId,
            attendanceType = if (isSubstitution) "REGISTERED_SUBSTITUTION" else "NORMAL",
            status = "OPEN",
            canEdit = true
        )
        db?.saveAttendanceSession(localSession)
        return@withContext localSession
    }


    /**
     * Retrieves class roster with students.
     */
    open suspend fun getClassRoster(classId: Int): NetworkResult<ClassRosterDto> = withContext(Dispatchers.IO) {
        val service = apiService ?: return@withContext NetworkResult.Error(-1, "No API Service")
        val db = localDb ?: return@withContext NetworkResult.Error(-1, "No Local DB")

        try {
            val response = service.getStudentClassRoster(classId)
            if (response.isSuccessful && response.body() != null) {
                val roster = response.body()!!
                db.saveClassRoster(roster)
                NetworkResult.Success(roster)
            } else {
                val cached = db.getCachedClassRoster(classId)
                if (cached != null) NetworkResult.Success(cached)
                else NetworkResult.Error(response.code(), response.message())
            }
        } catch (e: Exception) {
            val cached = db.getCachedClassRoster(classId)
            if (cached != null) NetworkResult.Success(cached)
            else NetworkResult.Error(0, e.localizedMessage ?: "Offline: No cached roster", e)
        }
    }

    /**
     * Retrieves existing attendance session details.
     */
    open suspend fun getSession(sessionId: Int): NetworkResult<AttendanceSessionDto> = withContext(Dispatchers.IO) {
        val service = apiService ?: return@withContext NetworkResult.Error(-1, "No API Service")
        val db = localDb ?: return@withContext NetworkResult.Error(-1, "No Local DB")

        try {
            val response = service.getStudentAttendanceSession(sessionId)
            if (response.isSuccessful && response.body() != null) {
                val session = response.body()!!
                db.saveAttendanceSession(session)
                NetworkResult.Success(session)
            } else {
                val cached = db.getCachedAttendanceSession(sessionId)
                if (cached != null) NetworkResult.Success(cached)
                else NetworkResult.Error(response.code(), response.message())
            }
        } catch (e: Exception) {
            val cached = db.getCachedAttendanceSession(sessionId)
            if (cached != null) NetworkResult.Success(cached)
            else NetworkResult.Error(0, e.localizedMessage ?: "Offline: No cached session", e)
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
        exceptions: List<StudentExceptionItemDto>,
        periodNumber: Int? = null,
        subjectId: Int? = null
    ): StudentAttendanceResult = withContext(Dispatchers.IO) {
        val db = localDb ?: return@withContext StudentAttendanceResult.Error("No Local DB")
        val opId = UUID.randomUUID().toString()
        val idempotencyKey = "student-attendance-$opId"
        val timestamp = getIsoUtcTimestamp()

        val payload = com.governence.faflow.core.network.StudentAttendanceSyncPayloadDto(
            sessionId = if (sessionId > 0) sessionId else null,
            classId = classId,
            periodNumber = periodNumber,
            subjectId = subjectId,
            absentRollSuffixes = absentSuffixes,
            studentExceptions = exceptions,
            clientTimestamp = timestamp
        )

        val op = OfflineSyncOperationDto(
            operationId = opId,
            idempotencyKey = idempotencyKey,
            operationType = "SUBMIT_ATTENDANCE",
            payload = payload,
            clientTimestamp = timestamp
        )

        // 1. Durably enqueue in local SQLite outbox immediately
        db.enqueueOperation(op)

        // 2. Mark local cached session as SUBMITTED immediately so UI reflects it without delay
        val cachedSession = db.getCachedAttendanceSession(sessionId)
        val optimisticSession = (cachedSession ?: AttendanceSessionDto(
            id = sessionId,
            attendanceDate = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date()),
            periodNumber = periodNumber ?: 1,
            classId = classId,
            className = "Class $classId",
            section = "",
            subjectId = subjectId,
            attendanceType = "NORMAL",
            status = "SUBMITTED",
            canEdit = true
        )).copy(status = "SUBMITTED")
        db.saveAttendanceSession(optimisticSession)

        // 3. Fast online sync attempt (2.5s max) - if fast network, sync immediately
        val service = apiService
        if (service != null) {
            try {
                withTimeoutOrNull(2500L) {
                    if (sessionId > 0) {
                        val submitReq = AttendanceSubmitRequestDto(
                            absentRollSuffixes = absentSuffixes,
                            studentExceptions = exceptions,
                            clientTimestamp = timestamp
                        )
                        val response = service.submitStudentAttendance(sessionId, submitReq)
                        if (response.isSuccessful && response.body() != null) {
                            db.markOperationSynced(opId)
                            db.saveAttendanceSession(response.body()!!)
                            return@withTimeoutOrNull StudentAttendanceResult.Success(response.body()!!, isOnline = true)
                        }
                    } else {
                        val batchReq = OfflineBatchSyncRequestDto(
                            deviceId = "ANDROID_${android.os.Build.MODEL}",
                            operations = listOf(op)
                        )
                        val response = service.syncOfflineAttendanceBatch(batchReq)
                        if (response.isSuccessful && response.body()?.results?.firstOrNull()?.success == true) {
                            db.markOperationSynced(opId)
                            val serverSessionId = response.body()?.results?.firstOrNull()?.sessionId
                            val updatedSession = if (serverSessionId != null && serverSessionId > 0) {
                                optimisticSession.copy(id = serverSessionId)
                            } else optimisticSession
                            db.saveAttendanceSession(updatedSession)
                            return@withTimeoutOrNull StudentAttendanceResult.Success(updatedSession, isOnline = true)
                        }
                    }
                    null
                }?.let { return@withContext it }
            } catch (e: Exception) {
                android.util.Log.i("StudentAttendanceRepo", "Online sync skipped/timed out (${e.message}), continuing optimistically.")
            }
        }

        // Fast online attempt timed out or network unavailable:
        // Trigger background sync worker and return optimistic Success immediately!
        context?.let { com.governence.faflow.attendance.sync.StudentAttendanceSyncWorker.triggerImmediateSync(it) }
        StudentAttendanceResult.Success(optimisticSession, isOnline = false)
    }

    /**
     * Submits emergency attendance.
     * Offline-first: creates a durable outbox operation first. Tries fast sync, never hangs.
     */
    open suspend fun submitEmergencyAttendance(
        classId: Int,
        periodNumber: Int,
        absentSuffixes: List<String>,
        exceptions: List<StudentExceptionItemDto>
    ): StudentAttendanceResult = withContext(Dispatchers.IO) {
        val db = localDb ?: return@withContext StudentAttendanceResult.Error("No Local DB")
        val opId = UUID.randomUUID().toString()
        val idempotencyKey = "student-attendance-emergency-$opId"
        val timestamp = getIsoUtcTimestamp()

        val payload = com.governence.faflow.core.network.StudentAttendanceSyncPayloadDto(
            classId = classId,
            periodNumber = periodNumber,
            absentRollSuffixes = absentSuffixes,
            studentExceptions = exceptions,
            clientTimestamp = timestamp
        )

        val op = OfflineSyncOperationDto(
            operationId = opId,
            idempotencyKey = idempotencyKey,
            operationType = "EMERGENCY_ATTENDANCE",
            payload = payload,
            clientTimestamp = timestamp
        )

        db.enqueueOperation(op)

        val optimisticSession = AttendanceSessionDto(
            id = -classId,
            attendanceDate = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date()),
            periodNumber = periodNumber,
            classId = classId,
            className = "Class $classId",
            section = "",
            subjectId = null,
            attendanceType = "EMERGENCY",
            status = "SUBMITTED",
            canEdit = true
        )
        db.saveAttendanceSession(optimisticSession)

        val service = apiService
        if (service != null) {
            try {
                withTimeoutOrNull(2500L) {
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
                        return@withTimeoutOrNull StudentAttendanceResult.Success(response.body()!!, isOnline = true)
                    } else if (response.code() == 409) {
                        db.markOperationSynced(opId)
                        return@withTimeoutOrNull StudentAttendanceResult.Success(optimisticSession, isOnline = true)
                    }
                    null
                }?.let { return@withContext it }
            } catch (e: Exception) {
                android.util.Log.i("StudentAttendanceRepo", "Emergency online sync skipped/timed out (${e.message}), continuing optimistically.")
            }
        }

        context?.let { com.governence.faflow.attendance.sync.StudentAttendanceSyncWorker.triggerImmediateSync(it) }
        StudentAttendanceResult.Success(optimisticSession, isOnline = false)
    }

    /**
     * Creates an attendance session on demand if missing (online only).
     */
    open suspend fun createSession(
        classId: Int,
        periodNumber: Int,
        subjectId: Int? = null,
        substitutionId: Int? = null,
        isSubstitution: Boolean = false
    ): AttendanceSessionDto? = withContext(Dispatchers.IO) {
        val service = apiService ?: return@withContext null
        val db = localDb ?: return@withContext null

        try {
            val createReq = AttendanceSessionCreateDto(
                classId = classId,
                periodNumber = periodNumber,
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
        android.util.Log.i("StudentAttendanceRepo", "[syncPendingOperations] Found ${pending.size} pending operations in local SQLite.")
        if (pending.isEmpty()) return@withContext 0

        // Transition pending -> syncing
        for (op in pending) {
            db.markOperationSyncing(op.operationId)
        }

        try {
            val batchReq = OfflineBatchSyncRequestDto(
                deviceId = deviceId,
                operations = pending
            )
            android.util.Log.i("StudentAttendanceRepo", "[syncPendingOperations] POSTing batch of ${pending.size} operations to /student-attendance/sync...")
            val response = service.syncOfflineAttendanceBatch(batchReq)
            if (response.isSuccessful && response.body() != null) {
                val batchRes = response.body()!!
                android.util.Log.i("StudentAttendanceRepo", "[syncPendingOperations] Server responded HTTP 200: processed=${batchRes.processed}, success=${batchRes.effectiveSuccessCount}, results=${batchRes.results.size}")
                for (result in batchRes.results) {
                    val isAlreadySubmitted = result.errorOrMessage?.contains("already been submitted", ignoreCase = true) == true
                    if (result.success || isAlreadySubmitted) {
                        android.util.Log.i("StudentAttendanceRepo", "[syncPendingOperations] Op ${result.operationId} resolved (success=${result.success}, alreadySubmitted=$isAlreadySubmitted). Clearing from outbox.")
                        db.markOperationSynced(result.operationId)
                    } else {
                        android.util.Log.w("StudentAttendanceRepo", "[syncPendingOperations] Op ${result.operationId} failed: ${result.errorOrMessage}")
                        db.updateOperationAttempt(result.operationId, result.errorOrMessage)
                    }
                }
                batchRes.effectiveSuccessCount
            } else {
                val err = response.errorBody()?.string() ?: response.message()
                android.util.Log.e("StudentAttendanceRepo", "[syncPendingOperations] Server error ${response.code()}: $err")
                for (op in pending) {
                    db.updateOperationAttempt(op.operationId, err)
                }
                0
            }
        } catch (e: Exception) {
            android.util.Log.e("StudentAttendanceRepo", "[syncPendingOperations] Network/unexpected exception: ${e.message}", e)
            for (op in pending) {
                db.updateOperationAttempt(op.operationId, e.localizedMessage)
            }
            0
        }
    }

    open fun getPendingCount(): Int {
        return localDb?.getPendingCount() ?: 0
    }
}
