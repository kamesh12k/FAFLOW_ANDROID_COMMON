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
import com.governence.faflow.core.network.TeacherTodayScheduleDto
import com.squareup.moshi.Types

/**
 * Thread-safe persistent local database for offline-first Student Attendance.
 * Provides caching for today's schedule, class rosters, sessions, and durable sync outbox queue.
 */
class StudentAttendanceLocalDb(context: Context) : SQLiteOpenHelper(context, DATABASE_NAME, null, DATABASE_VERSION) {

    private val moshi = FaflowApiClient.moshi
    private val scheduleAdapter = moshi.adapter(TeacherTodayScheduleDto::class.java)
    private val classListAdapter = moshi.adapter<List<ClassOutDto>>(
        Types.newParameterizedType(List::class.java, ClassOutDto::class.java)
    )
    private val rosterAdapter = moshi.adapter(ClassRosterDto::class.java)
    private val sessionAdapter = moshi.adapter(AttendanceSessionDto::class.java)
    private val operationAdapter = moshi.adapter(OfflineSyncOperationDto::class.java)

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
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        db.execSQL("DROP TABLE IF EXISTS cached_schedule")
        db.execSQL("DROP TABLE IF EXISTS cached_classes")
        db.execSQL("DROP TABLE IF EXISTS cached_rosters")
        db.execSQL("DROP TABLE IF EXISTS cached_sessions")
        db.execSQL("DROP TABLE IF EXISTS student_attendance_sync_queue")
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
            put("session_id", op.sessionId)
            put("class_id", op.classId)
            put("payload_json", payloadJson)
            put("created_at", System.currentTimeMillis())
            put("sync_status", "PENDING")
        }
        return db.insertWithOnConflict("student_attendance_sync_queue", null, values, SQLiteDatabase.CONFLICT_IGNORE)
    }

    @Synchronized
    fun getPendingOperations(): List<OfflineSyncOperationDto> {
        val db = readableDatabase
        val list = mutableListOf<OfflineSyncOperationDto>()
        val cursor = db.rawQuery(
            "SELECT payload_json FROM student_attendance_sync_queue WHERE sync_status IN ('PENDING', 'FAILED') ORDER BY created_at ASC",
            null
        )
        cursor.use {
            while (it.moveToNext()) {
                val json = it.getString(0)
                try {
                    operationAdapter.fromJson(json)?.let { op -> list.add(op) }
                } catch (e: Exception) {
                    // ignore malformed
                }
            }
        }
        return list
    }

    @Synchronized
    fun getPendingCount(): Int {
        val db = readableDatabase
        val cursor = db.rawQuery(
            "SELECT COUNT(*) FROM student_attendance_sync_queue WHERE sync_status IN ('PENDING', 'SYNCING')",
            null
        )
        cursor.use {
            if (it.moveToFirst()) {
                return it.getInt(0)
            }
        }
        return 0
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

    companion object {
        private const val DATABASE_NAME = "faflow_student_attendance.db"
        private const val DATABASE_VERSION = 1
    }
}
