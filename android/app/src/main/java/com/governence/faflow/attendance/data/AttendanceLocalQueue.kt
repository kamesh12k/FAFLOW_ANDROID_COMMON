package com.governence.faflow.attendance.data

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

/**
 * Thread-safe persistent local queue for offline attendance synchronization.
 */
class AttendanceLocalQueue(context: Context) : SQLiteOpenHelper(context, DATABASE_NAME, null, DATABASE_VERSION) {

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS pending_attendance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                idempotency_key TEXT UNIQUE NOT NULL,
                user_id INTEGER NOT NULL,
                operation_type TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                accuracy_meters REAL NOT NULL,
                geofence_id TEXT,
                face_similarity_score REAL NOT NULL,
                liveness_verified INTEGER NOT NULL,
                verification_method TEXT NOT NULL,
                device_reference TEXT,
                attempt_count INTEGER NOT NULL DEFAULT 0,
                last_attempt_at INTEGER NOT NULL DEFAULT 0,
                sync_status TEXT NOT NULL DEFAULT 'PENDING',
                last_error TEXT
            )
            """.trimIndent()
        )
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_pending_sync ON pending_attendance (sync_status)")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_pending_idempotency ON pending_attendance (idempotency_key)")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        db.execSQL("DROP TABLE IF EXISTS pending_attendance")
        onCreate(db)
    }

    @Synchronized
    fun enqueue(entity: PendingAttendanceEntity): Long {
        val db = writableDatabase
        val values = ContentValues().apply {
            put("idempotency_key", entity.idempotencyKey)
            put("user_id", entity.userId)
            put("operation_type", entity.operationType)
            put("created_at", entity.createdAt)
            put("latitude", entity.latitude)
            put("longitude", entity.longitude)
            put("accuracy_meters", entity.accuracyMeters)
            put("geofence_id", entity.geofenceId)
            put("face_similarity_score", entity.faceSimilarityScore)
            put("liveness_verified", if (entity.livenessVerified) 1 else 0)
            put("verification_method", entity.verificationMethod)
            put("device_reference", entity.deviceReference)
            put("attempt_count", entity.attemptCount)
            put("last_attempt_at", entity.lastAttemptAt)
            put("sync_status", entity.syncStatus.name)
            put("last_error", entity.lastError)
        }
        return db.insertWithOnConflict(TABLE_NAME, null, values, SQLiteDatabase.CONFLICT_IGNORE)
    }

    @Synchronized
    fun getPendingTransactions(): List<PendingAttendanceEntity> {
        val db = readableDatabase
        val list = mutableListOf<PendingAttendanceEntity>()
        val cursor = db.rawQuery(
            "SELECT * FROM pending_attendance WHERE sync_status IN ('PENDING', 'SYNCING') ORDER BY created_at ASC",
            null
        )
        cursor.use {
            while (it.moveToNext()) {
                list.add(cursorToEntity(it))
            }
        }
        return list
    }

    @Synchronized
    fun getPendingCount(): Int {
        val db = readableDatabase
        val cursor = db.rawQuery("SELECT COUNT(*) FROM pending_attendance WHERE sync_status IN ('PENDING', 'SYNCING')", null)
        cursor.use {
            if (it.moveToFirst()) {
                return it.getInt(0)
            }
        }
        return 0
    }

    @Synchronized
    fun updateAttempt(id: Long, status: SyncStatus, error: String? = null) {
        val db = writableDatabase
        val values = ContentValues().apply {
            put("sync_status", status.name)
            put("last_attempt_at", System.currentTimeMillis())
            put("last_error", error)
        }
        db.execSQL("UPDATE pending_attendance SET attempt_count = attempt_count + 1 WHERE id = ?", arrayOf(id.toString()))
        db.update(TABLE_NAME, values, "id = ?", arrayOf(id.toString()))
    }

    @Synchronized
    fun markSynced(id: Long) {
        val db = writableDatabase
        val values = ContentValues().apply {
            put("sync_status", SyncStatus.SYNCED.name)
            put("last_error", null as String?)
        }
        db.update(TABLE_NAME, values, "id = ?", arrayOf(id.toString()))
    }

    @Synchronized
    fun clearAll() {
        val db = writableDatabase
        db.delete(TABLE_NAME, null, null)
    }

    private fun cursorToEntity(c: Cursor): PendingAttendanceEntity {
        return PendingAttendanceEntity(
            id = c.getLong(c.getColumnIndexOrThrow("id")),
            idempotencyKey = c.getString(c.getColumnIndexOrThrow("idempotency_key")),
            userId = c.getInt(c.getColumnIndexOrThrow("user_id")),
            operationType = c.getString(c.getColumnIndexOrThrow("operation_type")),
            createdAt = c.getLong(c.getColumnIndexOrThrow("created_at")),
            latitude = c.getDouble(c.getColumnIndexOrThrow("latitude")),
            longitude = c.getDouble(c.getColumnIndexOrThrow("longitude")),
            accuracyMeters = c.getDouble(c.getColumnIndexOrThrow("accuracy_meters")),
            geofenceId = c.getString(c.getColumnIndexOrThrow("geofence_id")),
            faceSimilarityScore = c.getDouble(c.getColumnIndexOrThrow("face_similarity_score")),
            livenessVerified = c.getInt(c.getColumnIndexOrThrow("liveness_verified")) == 1,
            verificationMethod = c.getString(c.getColumnIndexOrThrow("verification_method")),
            deviceReference = c.getString(c.getColumnIndexOrThrow("device_reference")),
            attemptCount = c.getInt(c.getColumnIndexOrThrow("attempt_count")),
            lastAttemptAt = c.getLong(c.getColumnIndexOrThrow("last_attempt_at")),
            syncStatus = SyncStatus.valueOf(c.getString(c.getColumnIndexOrThrow("sync_status"))),
            lastError = c.getString(c.getColumnIndexOrThrow("last_error"))
        )
    }

    companion object {
        private const val DATABASE_NAME = "faflow_attendance.db"
        private const val DATABASE_VERSION = 1
        private const val TABLE_NAME = "pending_attendance"
    }
}
