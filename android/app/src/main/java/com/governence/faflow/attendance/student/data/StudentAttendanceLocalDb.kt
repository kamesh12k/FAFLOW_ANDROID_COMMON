package com.governence.faflow.attendance.student.data

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import com.governence.faflow.core.network.ClassOutDto
import com.governence.faflow.core.network.ClassRosterDto
import com.governence.faflow.core.network.FaflowApiClient
import com.governence.faflow.core.network.OfflineSyncOperationDto
import com.governence.faflow.core.network.AttendanceSessionDto
import com.governence.faflow.core.network.PublicGovernanceConfigDto
import com.governence.faflow.core.network.TeacherTodayScheduleDto
import com.squareup.moshi.Types

/**
 * Thread-safe persistent local database for offline-first Student Attendance.
 * Provides caching for today's schedule, class rosters, sessions, and durable sync outbox queue.
 */
class StudentAttendanceLocalDb(context: Context) : SQLiteOpenHelper(context, DATABASE_NAME, null, DATABASE_VERSION) {

    private val moshi = FaflowApiClient.moshi
    private val scheduleAdapter = moshi.adapter(TeacherTodayScheduleDto::class.java).lenient()
    private val classListAdapter = moshi.adapter<List<ClassOutDto>>(
        Types.newParameterizedType(List::class.java, ClassOutDto::class.java)
    ).lenient()
    private val rosterAdapter = moshi.adapter(ClassRosterDto::class.java).lenient()
    private val sessionAdapter = moshi.adapter(AttendanceSessionDto::class.java).lenient()
    private val operationAdapter = moshi.adapter(OfflineSyncOperationDto::class.java).lenient()
    private val governanceConfigAdapter = moshi.adapter(PublicGovernanceConfigDto::class.java).lenient()

    override fun onCreate(db: SQLiteDatabase) {
        // 1. Cached Schedule
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS cached_schedule (
                cache_key TEXT PRIMARY KEY,
                date TEXT NOT NULL,
                json_data TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            )
            """.trimIndent()
        )

        // 2. Cached Classes
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS cached_classes (
                cache_key TEXT PRIMARY KEY,
                json_data TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            )
            """.trimIndent()
        )

        // 3. Cached Class Rosters
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS cached_rosters (
                class_id INTEGER PRIMARY KEY,
                class_name TEXT NOT NULL,
                total_students INTEGER NOT NULL,
                json_data TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            )
            """.trimIndent()
        )

        // 4. Cached Attendance Sessions
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS cached_sessions (
                session_id INTEGER PRIMARY KEY,
                attendance_date TEXT NOT NULL,
                period_number INTEGER NOT NULL,
                class_id INTEGER NOT NULL,
                json_data TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            )
            """.trimIndent()
        )

        // 5. Durable Sync Outbox Queue
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS student_attendance_sync_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                operation_id TEXT UNIQUE NOT NULL,
                operation_type TEXT NOT NULL,
                session_id INTEGER,
                class_id INTEGER,
                payload_json TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                attempt_count INTEGER NOT NULL DEFAULT 0,
                last_attempt_at INTEGER NOT NULL DEFAULT 0,
                sync_status TEXT NOT NULL DEFAULT 'PENDING',
                last_error TEXT
            )
            """.trimIndent()
        )
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_student_sync_status ON student_attendance_sync_queue (sync_status)")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_student_sync_op_id ON student_attendance_sync_queue (operation_id)")

        // 6. Cached Governance Business Rules & Period Config
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS cached_governance_config (
                cache_key TEXT PRIMARY KEY,
                json_data TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            )
            """.trimIndent()
        )
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        db.execSQL("DROP TABLE IF EXISTS cached_schedule")
        db.execSQL("DROP TABLE IF EXISTS cached_classes")
        db.execSQL("DROP TABLE IF EXISTS cached_rosters")
        db.execSQL("DROP TABLE IF EXISTS cached_sessions")
        db.execSQL("DROP TABLE IF EXISTS student_attendance_sync_queue")
        db.execSQL("DROP TABLE IF EXISTS cached_governance_config")
        onCreate(db)
    }

    // ---------- Schedule Cache ----------

    @Synchronized
    fun saveTodaySchedule(dto: TeacherTodayScheduleDto) {
        val db = writableDatabase
        val json = scheduleAdapter.toJson(dto)
        val values = ContentValues().apply {
            put("cache_key", "today_schedule")
            put("date", dto.date)
            put("json_data", json)
            put("updated_at", System.currentTimeMillis())
        }
        db.insertWithOnConflict("cached_schedule", null, values, SQLiteDatabase.CONFLICT_REPLACE)
    }

    @Synchronized
    fun getCachedTodaySchedule(): TeacherTodayScheduleDto? {
        val db = readableDatabase
        val cursor = db.rawQuery("SELECT json_data FROM cached_schedule WHERE cache_key = 'today_schedule'", null)
        cursor.use {
            if (it.moveToFirst()) {
                val json = it.getString(0)
                return try {
                    scheduleAdapter.fromJson(json)
                } catch (e: Exception) {
                    null
                }
            }
        }
        return null
    }

    // ---------- Classes Cache ----------

    @Synchronized
    fun saveClasses(classes: List<ClassOutDto>) {
        val db = writableDatabase
        val json = classListAdapter.toJson(classes)
        val values = ContentValues().apply {
            put("cache_key", "all_classes")
            put("json_data", json)
            put("updated_at", System.currentTimeMillis())
        }
        db.insertWithOnConflict("cached_classes", null, values, SQLiteDatabase.CONFLICT_REPLACE)
    }

    @Synchronized
    fun getCachedClasses(): List<ClassOutDto> {
        val db = readableDatabase
        val cursor = db.rawQuery("SELECT json_data FROM cached_classes WHERE cache_key = 'all_classes'", null)
        cursor.use {
            if (it.moveToFirst()) {
                val json = it.getString(0)
                return try {
                    classListAdapter.fromJson(json) ?: emptyList()
                } catch (e: Exception) {
                    emptyList()
                }
            }
        }
        return emptyList()
    }

    // ---------- Class Rosters Cache ----------

    @Synchronized
    fun saveClassRoster(roster: ClassRosterDto) {
        val db = writableDatabase
        val json = rosterAdapter.toJson(roster)
        val values = ContentValues().apply {
            put("class_id", roster.classId)
            put("class_name", roster.className)
            put("total_students", roster.totalStudents)
            put("json_data", json)
            put("updated_at", System.currentTimeMillis())
        }
        db.insertWithOnConflict("cached_rosters", null, values, SQLiteDatabase.CONFLICT_REPLACE)
    }

    @Synchronized
    fun getCachedClassRoster(classId: Int): ClassRosterDto? {
        val db = readableDatabase
        val cursor = db.rawQuery("SELECT json_data FROM cached_rosters WHERE class_id = ?", arrayOf(classId.toString()))
        cursor.use {
            if (it.moveToFirst()) {
                val json = it.getString(0)
                return try {
                    rosterAdapter.fromJson(json)
                } catch (e: Exception) {
                    null
                }
            }
        }
        return null
    }

    // ---------- Sessions Cache ----------

    @Synchronized
    fun saveAttendanceSession(session: AttendanceSessionDto) {
        val db = writableDatabase
        val json = sessionAdapter.toJson(session)
        val values = ContentValues().apply {
            put("session_id", session.id)
            put("attendance_date", session.attendanceDate)
            put("period_number", session.periodNumber)
            put("class_id", session.classId)
            put("json_data", json)
            put("updated_at", System.currentTimeMillis())
        }
        db.insertWithOnConflict("cached_sessions", null, values, SQLiteDatabase.CONFLICT_REPLACE)
    }

    @Synchronized
    fun getCachedAttendanceSession(sessionId: Int): AttendanceSessionDto? {
        val db = readableDatabase
        val cursor = db.rawQuery("SELECT json_data FROM cached_sessions WHERE session_id = ?", arrayOf(sessionId.toString()))
        cursor.use {
            if (it.moveToFirst()) {
                val json = it.getString(0)
                return try {
                    sessionAdapter.fromJson(json)
                } catch (e: Exception) {
                    null
                }
            }
        }
        return null
    }

    // ---------- Sync Queue Operations ----------

    @Synchronized
    fun enqueueOperation(op: OfflineSyncOperationDto): Long {
        val db = writableDatabase
        val payloadJson = operationAdapter.toJson(op)
        val values = ContentValues().apply {
            put("operation_id", op.operationId)
            put("operation_type", op.operationType)
            put("session_id", op.payload.sessionId)
            put("class_id", op.payload.classId)
            put("payload_json", payloadJson)
            put("created_at", System.currentTimeMillis())
            put("sync_status", "PENDING")
            put("attempt_count", 0)
        }
        return db.insertWithOnConflict("student_attendance_sync_queue", null, values, SQLiteDatabase.CONFLICT_IGNORE)
    }

    @Synchronized
    fun getPendingOperations(): List<OfflineSyncOperationDto> {
        val db = readableDatabase
        val list = mutableListOf<OfflineSyncOperationDto>()
        val cursor = db.rawQuery(
            "SELECT payload_json FROM student_attendance_sync_queue WHERE sync_status IN ('PENDING', 'FAILED', 'SYNCING') ORDER BY created_at ASC",
            null
        )
        cursor.use {
            while (it.moveToNext()) {
                val json = it.getString(0)
                val op = parseOperationJson(json)
                if (op != null) {
                    list.add(op)
                }
            }
        }
        return list
    }

    /**
     * Parses operation JSON with full backward compatibility:
     * 1. Attempts standard Moshi parsing with nested payload and idempotency_key.
     * 2. Falls back to parsing legacy flat JSON, synthesizing the required nested payload
     *    and idempotency_key, and auto-upgrading the SQLite row to the normalized schema.
     */
    private fun parseOperationJson(json: String): OfflineSyncOperationDto? {
        // Try pure Moshi first
        try {
            operationAdapter.fromJson(json)?.let { return it }
        } catch (_: Exception) {}

        // Fallback for legacy flat outbox JSON
        return try {
            val obj = org.json.JSONObject(json)
            val opId = obj.optString("operation_id", java.util.UUID.randomUUID().toString())
            val idemKey = if (obj.has("idempotency_key") && !obj.isNull("idempotency_key")) {
                obj.getString("idempotency_key")
            } else {
                opId
            }
            val opType = obj.optString("operation_type", "EMERGENCY")
            val devId = if (obj.has("device_id") && !obj.isNull("device_id")) obj.getString("device_id") else null
            val clientTs = if (obj.has("client_timestamp") && !obj.isNull("client_timestamp")) obj.getString("client_timestamp") else null

            val payloadDto: com.governence.faflow.core.network.StudentAttendanceSyncPayloadDto =
                if (obj.has("payload") && obj.get("payload") is org.json.JSONObject) {
                    parsePayloadObj(obj.getJSONObject("payload"))
                } else {
                    parsePayloadObj(obj)
                }

            val normalized = OfflineSyncOperationDto(
                operationId = opId,
                idempotencyKey = idemKey,
                operationType = opType,
                payload = payloadDto,
                deviceId = devId,
                clientTimestamp = clientTs
            )

            // Auto-heal the database record with the new normalized schema
            try {
                val newJson = operationAdapter.toJson(normalized)
                val values = ContentValues().apply {
                    put("payload_json", newJson)
                }
                writableDatabase.update(
                    "student_attendance_sync_queue",
                    values,
                    "operation_id = ?",
                    arrayOf(opId)
                )
            } catch (_: Exception) {}

            normalized
        } catch (e: Exception) {
            android.util.Log.e("StudentLocalDb", "Failed to deserialize operation JSON: $json", e)
            null
        }
    }

    private fun parsePayloadObj(obj: org.json.JSONObject): com.governence.faflow.core.network.StudentAttendanceSyncPayloadDto {
        val sessId = if (obj.has("session_id") && !obj.isNull("session_id")) obj.optInt("session_id") else null
        val clsId = if (obj.has("class_id") && !obj.isNull("class_id")) obj.optInt("class_id") else null
        val perNum = if (obj.has("period_number") && !obj.isNull("period_number")) obj.optInt("period_number") else null
        val subId = if (obj.has("subject_id") && !obj.isNull("subject_id")) obj.optInt("subject_id") else null
        val clientTs = if (obj.has("client_timestamp") && !obj.isNull("client_timestamp")) obj.getString("client_timestamp") else null

        val absentList = mutableListOf<String>()
        if (obj.has("absent_roll_suffixes")) {
            val arr = obj.getJSONArray("absent_roll_suffixes")
            for (i in 0 until arr.length()) {
                absentList.add(arr.getString(i))
            }
        }

        val exceptionsList = mutableListOf<com.governence.faflow.core.network.StudentExceptionItemDto>()
        if (obj.has("student_exceptions")) {
            val arr = obj.getJSONArray("student_exceptions")
            for (i in 0 until arr.length()) {
                val item = arr.getJSONObject(i)
                val sId = if (item.has("student_id") && !item.isNull("student_id")) item.optInt("student_id") else null
                val rSuf = if (item.has("roll_suffix") && !item.isNull("roll_suffix")) item.getString("roll_suffix") else null
                val st = item.optString("status", "present")
                exceptionsList.add(
                    com.governence.faflow.core.network.StudentExceptionItemDto(
                        studentId = sId,
                        rollSuffix = rSuf,
                        status = st
                    )
                )
            }
        }

        return com.governence.faflow.core.network.StudentAttendanceSyncPayloadDto(
            sessionId = sessId,
            classId = clsId,
            periodNumber = perNum,
            subjectId = subId,
            absentRollSuffixes = absentList,
            studentExceptions = exceptionsList,
            clientTimestamp = clientTs
        )
    }

    @Synchronized
    fun getPendingCount(): Int {
        val db = readableDatabase
        // Only count PENDING and FAILED — not SYNCING (in-flight) to avoid false positives
        // when a sync run is currently active.
        val cursor = db.rawQuery(
            "SELECT COUNT(*) FROM student_attendance_sync_queue WHERE sync_status IN ('PENDING', 'FAILED')",
            null
        )
        cursor.use {
            if (it.moveToFirst()) {
                return it.getInt(0)
            }
        }
        return 0
    }

    /**
     * Resets any records permanently stuck in SYNCING state (e.g. left over from a
     * killed process or a crashed sync run) back to PENDING so they are retried.
     * Call this at the START of every sync run, before fetching pending records.
     */
    @Synchronized
    fun resetStuckSyncingRecords() {
        val db = writableDatabase
        // Records that have been in SYNCING for more than 2 minutes are considered stuck
        val stuckThreshold = System.currentTimeMillis() - (2 * 60 * 1000L)
        val values = ContentValues().apply {
            put("sync_status", "PENDING")
        }
        val updated = db.update(
            "student_attendance_sync_queue",
            values,
            "sync_status = 'SYNCING' AND last_attempt_at < ?",
            arrayOf(stuckThreshold.toString())
        )
        if (updated > 0) {
            android.util.Log.w("StudentLocalDb", "[SyncRecovery] Reset $updated stuck SYNCING record(s) back to PENDING.")
        }
    }

    @Synchronized
    fun markOperationSyncing(operationId: String) {
        val db = writableDatabase
        val values = ContentValues().apply {
            put("sync_status", "SYNCING")
            put("last_attempt_at", System.currentTimeMillis())
        }
        db.update("student_attendance_sync_queue", values, "operation_id = ?", arrayOf(operationId))
    }

    @Synchronized
    fun markOperationSynced(operationId: String) {
        val db = writableDatabase
        val values = ContentValues().apply {
            put("sync_status", "SYNCED")
            put("last_error", null as String?)
        }
        db.update("student_attendance_sync_queue", values, "operation_id = ?", arrayOf(operationId))
    }

    @Synchronized
    fun updateOperationAttempt(operationId: String, error: String?) {
        val db = writableDatabase
        val values = ContentValues().apply {
            put("sync_status", "FAILED")
            put("last_attempt_at", System.currentTimeMillis())
            put("last_error", error)
        }
        db.execSQL("UPDATE student_attendance_sync_queue SET attempt_count = attempt_count + 1 WHERE operation_id = ?", arrayOf(operationId))
        db.update("student_attendance_sync_queue", values, "operation_id = ?", arrayOf(operationId))
    }

    @Synchronized
    fun deleteOperation(operationId: String): Int {
        val db = writableDatabase
        return db.delete("student_attendance_sync_queue", "operation_id = ?", arrayOf(operationId))
    }

    @Synchronized
    fun clearSyncQueue(): Int {
        val db = writableDatabase
        return db.delete("student_attendance_sync_queue", null, null)
    }

    data class QueueItemSummary(
        val operationId: String,
        val operationType: String,
        val classId: Int?,
        val sessionId: Int?,
        val createdAt: Long,
        val syncStatus: String,
        val attemptCount: Int,
        val lastError: String?
    )

    @Synchronized
    fun getPendingItemSummaries(): List<QueueItemSummary> {
        val db = readableDatabase
        val list = mutableListOf<QueueItemSummary>()
        val cursor = db.rawQuery(
            "SELECT operation_id, operation_type, class_id, session_id, created_at, sync_status, attempt_count, last_error FROM student_attendance_sync_queue WHERE sync_status IN ('PENDING', 'FAILED', 'SYNCING') ORDER BY created_at DESC",
            null
        )
        cursor.use {
            while (it.moveToNext()) {
                list.add(
                    QueueItemSummary(
                        operationId = it.getString(0),
                        operationType = it.getString(1) ?: "UNKNOWN",
                        classId = if (!it.isNull(2)) it.getInt(2) else null,
                        sessionId = if (!it.isNull(3)) it.getInt(3) else null,
                        createdAt = it.getLong(4),
                        syncStatus = it.getString(5) ?: "PENDING",
                        attemptCount = it.getInt(6),
                        lastError = if (!it.isNull(7)) it.getString(7) else null
                    )
                )
            }
        }
        return list
    }

    // ---------- Governance Public Config Cache ----------

    @Synchronized
    fun saveGovernanceConfig(config: PublicGovernanceConfigDto) {
        val db = writableDatabase
        val json = governanceConfigAdapter.toJson(config)
        val values = ContentValues().apply {
            put("cache_key", "governance_public_config")
            put("json_data", json)
            put("updated_at", System.currentTimeMillis())
        }
        db.insertWithOnConflict("cached_governance_config", null, values, SQLiteDatabase.CONFLICT_REPLACE)
    }

    @Synchronized
    fun getCachedGovernanceConfig(): PublicGovernanceConfigDto? {
        val db = readableDatabase
        val cursor = db.rawQuery("SELECT json_data FROM cached_governance_config WHERE cache_key = 'governance_public_config'", null)
        cursor.use {
            if (it.moveToFirst()) {
                val json = it.getString(0)
                return try {
                    governanceConfigAdapter.fromJson(json)
                } catch (e: Exception) {
                    null
                }
            }
        }
        return null
    }

    /**
     * Clears all user-specific data (schedule, classes, rosters, sessions, sync queue)
     * upon user logout or account switch, ensuring no data bleed across accounts.
     */
    @Synchronized
    fun clearAllUserData() {
        val db = writableDatabase
        db.delete("cached_schedule", null, null)
        db.delete("cached_classes", null, null)
        db.delete("cached_rosters", null, null)
        db.delete("cached_sessions", null, null)
        db.delete("student_attendance_sync_queue", null, null)
    }

    companion object {
        private const val DATABASE_NAME = "faflow_student_attendance.db"
        private const val DATABASE_VERSION = 2
    }
}
