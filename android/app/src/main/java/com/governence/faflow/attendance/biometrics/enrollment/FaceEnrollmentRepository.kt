package com.governence.faflow.attendance.biometrics.enrollment

import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.governence.faflow.attendance.biometrics.alignment.FaceAlignmentConfig
import com.governence.faflow.attendance.biometrics.embedding.FaceRecognitionConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.security.GeneralSecurityException
import java.security.KeyStoreException
import javax.crypto.AEADBadTagException

/**
 * Enrolled biometric face template metadata for a staff member.
 */
data class StaffFaceEnrollment(
    val staffId: String,
    val staffName: String,
    val embedding: FloatArray,
    val modelVersion: String,
    val alignmentVersion: String,
    val createdAt: Long,
    val updatedAt: Long,
    val templates: List<FloatArray> = emptyList()
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is StaffFaceEnrollment) return false
        return staffId == other.staffId && embedding.contentEquals(other.embedding)
    }

    override fun hashCode(): Int {
        var result = staffId.hashCode()
        result = 31 * result + embedding.contentHashCode()
        return result
    }
}

/**
 * Contract for secure local on-device biometric template storage.
 */
interface FaceEnrollmentRepository {
    suspend fun saveEnrollment(
        staffId: String,
        staffName: String,
        embedding: FloatArray,
        modelVersion: String = FaceRecognitionConfig.DEFAULT.modelVersion,
        alignmentVersion: String = FaceAlignmentConfig.ALIGNMENT_VERSION,
        templates: List<FloatArray> = emptyList()
    ): Boolean

    suspend fun getEnrollment(staffId: String): StaffFaceEnrollment?
    suspend fun hasEnrollment(staffId: String): Boolean
    suspend fun deleteEnrollment(staffId: String): Boolean
}

/**
 * EncryptedSharedPreferences implementation of FaceEnrollmentRepository.
 * Hardened against AndroidKeyStore AEADBadTagException, KeyStoreException, and
 * corrupted XML cache on app updates / device restores.
 */
class LocalFaceEnrollmentRepository(
    private val context: Context,
    private val customPrefsProvider: ((Context) -> SharedPreferences)? = null
) : FaceEnrollmentRepository {

    companion object {
        private const val TAG = "FaceEnrollmentRepo"
        const val PREFS_FILE_NAME = "faflow_biometric_templates"

        @androidx.annotation.VisibleForTesting
        var testPrefsProvider: ((Context) -> SharedPreferences)? = null

        @androidx.annotation.VisibleForTesting
        var resetCount: Int = 0
    }

    private val appContext = context.applicationContext

    @Volatile
    private var cachedPrefs: SharedPreferences? = null

    private fun isSecurityOrIoException(t: Throwable): Boolean {
        var current: Throwable? = t
        while (current != null) {
            if (current is GeneralSecurityException ||
                current is IOException ||
                current is KeyStoreException ||
                current is AEADBadTagException ||
                current.javaClass.name.contains("KeyStore", ignoreCase = true) ||
                current.javaClass.name.contains("AEADBadTag", ignoreCase = true)
            ) {
                return true
            }
            current = current.cause
        }
        return false
    }

    private fun createEncryptedSharedPreferences(): SharedPreferences {
        val provider = customPrefsProvider ?: testPrefsProvider
        if (provider != null) {
            return provider(appContext)
        }

        val masterKey = MasterKey.Builder(appContext)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        return EncryptedSharedPreferences.create(
            appContext,
            PREFS_FILE_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    @Synchronized
    fun resetStore() {
        cachedPrefs = null
        resetCount++

        // 1. Delete SharedPreferences via context
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                appContext.deleteSharedPreferences(PREFS_FILE_NAME)
            }
        } catch (e: Throwable) {
            Log.w(TAG, "Failed deleting biometric shared preferences via context: ${e.message}")
        }

        // 2. Delete physical .xml and .bak files from disk
        try {
            val dataDir = appContext.applicationInfo?.dataDir ?: appContext.filesDir?.parent
            if (dataDir != null) {
                val sharedPrefsDir = File(dataDir, "shared_prefs")
                val xmlFile = File(sharedPrefsDir, "$PREFS_FILE_NAME.xml")
                if (xmlFile.exists()) xmlFile.delete()
                val bakFile = File(sharedPrefsDir, "$PREFS_FILE_NAME.bak")
                if (bakFile.exists()) bakFile.delete()
            }
        } catch (e: Throwable) {
            Log.w(TAG, "Failed deleting biometric shared preferences files: ${e.message}")
        }
    }

    @Synchronized
    private fun getPrefs(): SharedPreferences? {
        cachedPrefs?.let { return it }
        return try {
            createEncryptedSharedPreferences().also { cachedPrefs = it }
        } catch (e: Throwable) {
            if (isSecurityOrIoException(e)) {
                Log.w(TAG, "Biometric prefs corrupted or key mismatch, resetting store: ${e.message}")
                resetStore()
                try {
                    // Attempt fresh creation once after reset
                    createEncryptedSharedPreferences().also { cachedPrefs = it }
                } catch (retryEx: Throwable) {
                    Log.w(TAG, "Failed to re-initialize encrypted preferences after reset: ${retryEx.message}, falling back to unencrypted private prefs")
                    try {
                        appContext.getSharedPreferences(PREFS_FILE_NAME + "_fallback", Context.MODE_PRIVATE).also { cachedPrefs = it }
                    } catch (fallbackEx: Throwable) {
                        Log.e(TAG, "Failed to open fallback preferences: ${fallbackEx.message}")
                        null
                    }
                }
            } else {
                Log.w(TAG, "Unexpected error opening biometric prefs, resetting: ${e.message}")
                resetStore()
                null
            }
        }
    }

    private inline fun <T> safeRead(defaultValue: T, block: (SharedPreferences) -> T): T {
        val prefs = getPrefs() ?: return defaultValue
        return try {
            block(prefs)
        } catch (e: Throwable) {
            if (isSecurityOrIoException(e)) {
                Log.w(TAG, "Biometric prefs read corrupted: ${e.message}, resetting store")
                resetStore()
            } else {
                Log.e(TAG, "Error reading biometric preferences: ${e.message}", e)
            }
            defaultValue
        }
    }

    private inline fun safeWrite(block: (SharedPreferences.Editor) -> Unit): Boolean {
        val prefs = getPrefs() ?: return false
        return try {
            val editor = prefs.edit()
            block(editor)
            editor.commit()
        } catch (e: Throwable) {
            if (isSecurityOrIoException(e)) {
                Log.w(TAG, "Biometric prefs write failed with security exception: ${e.message}, resetting store")
                resetStore()
            } else {
                Log.e(TAG, "Error writing biometric preferences: ${e.message}", e)
            }
            false
        }
    }

    override suspend fun saveEnrollment(
        staffId: String,
        staffName: String,
        embedding: FloatArray,
        modelVersion: String,
        alignmentVersion: String,
        templates: List<FloatArray>
    ): Boolean = withContext(Dispatchers.IO) {
        try {
            val jsonArray = JSONArray()
            for (f in embedding) {
                jsonArray.put(f.toDouble())
            }

            val templatesArray = JSONArray()
            for (tmpl in templates) {
                val tmplArr = JSONArray()
                for (f in tmpl) {
                    tmplArr.put(f.toDouble())
                }
                templatesArray.put(tmplArr)
            }

            val now = System.currentTimeMillis()
            val existing = getEnrollment(staffId)
            val createdAt = existing?.createdAt ?: now

            val jsonObject = JSONObject().apply {
                put("staffId", staffId)
                put("staffName", staffName)
                put("embedding", jsonArray)
                if (templates.isNotEmpty()) {
                    put("templates", templatesArray)
                }
                put("modelVersion", modelVersion)
                put("alignmentVersion", alignmentVersion)
                put("createdAt", createdAt)
                put("updatedAt", now)
            }

            safeWrite { editor ->
                editor.putString("enrollment_$staffId", jsonObject.toString())
            }
        } catch (_: Exception) {
            false
        }
    }

    override suspend fun getEnrollment(staffId: String): StaffFaceEnrollment? = withContext(Dispatchers.IO) {
        val raw = safeRead<String?>(null) { prefs ->
            prefs.getString("enrollment_$staffId", null)
        } ?: return@withContext null

        try {
            val json = JSONObject(raw)
            val jsonArray = json.getJSONArray("embedding")
            val embedding = FloatArray(jsonArray.length())
            for (i in 0 until jsonArray.length()) {
                embedding[i] = jsonArray.getDouble(i).toFloat()
            }

            val parsedTemplates = mutableListOf<FloatArray>()
            val rawTemplates = json.optJSONArray("templates")
            if (rawTemplates != null) {
                for (i in 0 until rawTemplates.length()) {
                    val subArr = rawTemplates.optJSONArray(i)
                    if (subArr != null && subArr.length() > 0) {
                        val t = FloatArray(subArr.length())
                        for (j in 0 until subArr.length()) {
                            t[j] = subArr.getDouble(j).toFloat()
                        }
                        parsedTemplates.add(t)
                    }
                }
            }

            StaffFaceEnrollment(
                staffId = json.getString("staffId"),
                staffName = json.getString("staffName"),
                embedding = embedding,
                modelVersion = json.optString("modelVersion", FaceRecognitionConfig.DEFAULT.modelVersion),
                alignmentVersion = json.optString("alignmentVersion", FaceAlignmentConfig.ALIGNMENT_VERSION),
                createdAt = json.optLong("createdAt", 0L),
                updatedAt = json.optLong("updatedAt", 0L),
                templates = parsedTemplates
            )
        } catch (_: Exception) {
            null
        }
    }

    override suspend fun hasEnrollment(staffId: String): Boolean = withContext(Dispatchers.IO) {
        safeRead(false) { prefs ->
            prefs.contains("enrollment_$staffId")
        }
    }

    override suspend fun deleteEnrollment(staffId: String): Boolean = withContext(Dispatchers.IO) {
        safeWrite { editor ->
            editor.remove("enrollment_$staffId")
        }
    }
}
