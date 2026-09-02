package com.governence.faflow.face.enrollment

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.governence.faflow.face.alignment.FaceAlignmentConfig
import com.governence.faflow.face.embedding.FaceRecognitionConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

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
    val updatedAt: Long
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
        alignmentVersion: String = FaceAlignmentConfig.ALIGNMENT_VERSION
    ): Boolean

    suspend fun getEnrollment(staffId: String): StaffFaceEnrollment?
    suspend fun hasEnrollment(staffId: String): Boolean
    suspend fun deleteEnrollment(staffId: String): Boolean
}

/**
 * EncryptedSharedPreferences implementation of FaceEnrollmentRepository.
 */
class LocalFaceEnrollmentRepository(
    private val context: Context
) : FaceEnrollmentRepository {

    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val sharedPreferences = EncryptedSharedPreferences.create(
        context,
        "faflow_biometric_templates",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    override suspend fun saveEnrollment(
        staffId: String,
        staffName: String,
        embedding: FloatArray,
        modelVersion: String,
        alignmentVersion: String
    ): Boolean = withContext(Dispatchers.IO) {
        try {
            val jsonArray = JSONArray()
            for (f in embedding) {
                jsonArray.put(f.toDouble())
            }

            val now = System.currentTimeMillis()
            val existing = getEnrollment(staffId)
            val createdAt = existing?.createdAt ?: now

            val jsonObject = JSONObject().apply {
                put("staffId", staffId)
                put("staffName", staffName)
                put("embedding", jsonArray)
                put("modelVersion", modelVersion)
                put("alignmentVersion", alignmentVersion)
                put("createdAt", createdAt)
                put("updatedAt", now)
            }

            sharedPreferences.edit()
                .putString("enrollment_$staffId", jsonObject.toString())
                .commit()
        } catch (_: Exception) {
            false
        }
    }

    override suspend fun getEnrollment(staffId: String): StaffFaceEnrollment? = withContext(Dispatchers.IO) {
        try {
            val raw = sharedPreferences.getString("enrollment_$staffId", null) ?: return@withContext null
            val json = JSONObject(raw)

            val jsonArray = json.getJSONArray("embedding")
            val embedding = FloatArray(jsonArray.length())
            for (i in 0 until jsonArray.length()) {
                embedding[i] = jsonArray.getDouble(i).toFloat()
            }

            StaffFaceEnrollment(
                staffId = json.getString("staffId"),
                staffName = json.getString("staffName"),
                embedding = embedding,
                modelVersion = json.optString("modelVersion", FaceRecognitionConfig.DEFAULT.modelVersion),
                alignmentVersion = json.optString("alignmentVersion", FaceAlignmentConfig.ALIGNMENT_VERSION),
                createdAt = json.optLong("createdAt", 0L),
                updatedAt = json.optLong("updatedAt", 0L)
            )
        } catch (_: Exception) {
            null
        }
    }

    override suspend fun hasEnrollment(staffId: String): Boolean = withContext(Dispatchers.IO) {
        sharedPreferences.contains("enrollment_$staffId")
    }

    override suspend fun deleteEnrollment(staffId: String): Boolean = withContext(Dispatchers.IO) {
        try {
            sharedPreferences.edit().remove("enrollment_$staffId").commit()
        } catch (_: Exception) {
            false
        }
    }
}
