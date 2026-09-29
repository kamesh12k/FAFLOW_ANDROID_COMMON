package com.governence.faflow

import android.content.Context
import android.content.SharedPreferences
import com.governence.faflow.attendance.biometrics.enrollment.LocalFaceEnrollmentRepository
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.File
import java.io.IOException
import java.security.GeneralSecurityException
import java.security.KeyStoreException
import javax.crypto.AEADBadTagException

/**
 * Unit test suite verifying fail-safe handling of corrupted biometric EncryptedSharedPreferences
 * and Keystore mismatch exceptions (AEADBadTagException / KeyStoreException).
 */
class FaceEnrollmentCorruptedPrefsTest {

    private lateinit var tempDir: File

    @Before
    fun setUp() {
        tempDir = File(System.getProperty("java.io.tmpdir"), "faflow_face_test_${System.currentTimeMillis()}")
        tempDir.mkdirs()
        File(tempDir, "shared_prefs").mkdirs()
        LocalFaceEnrollmentRepository.testPrefsProvider = null
        LocalFaceEnrollmentRepository.resetCount = 0
    }

    @After
    fun tearDown() {
        LocalFaceEnrollmentRepository.testPrefsProvider = null
        LocalFaceEnrollmentRepository.resetCount = 0
        tempDir.deleteRecursively()
    }

    private inner class TestContext(private val rootDir: File) : android.content.ContextWrapper(null) {
        override fun getApplicationContext(): Context = this
        override fun getFilesDir(): File = File(rootDir, "files").apply { mkdirs() }
        override fun getPackageName(): String = "com.governence.faflow"
        override fun deleteSharedPreferences(name: String?): Boolean {
            val file = File(rootDir, "shared_prefs/$name.xml")
            val bak = File(rootDir, "shared_prefs/$name.bak")
            var deleted = true
            if (file.exists()) deleted = deleted && file.delete()
            if (bak.exists()) deleted = deleted && bak.delete()
            return deleted
        }
    }

    private class CorruptedSharedPreferences(
        private val throwOnRead: Boolean = true,
        private val throwOnWrite: Boolean = true
    ) : SharedPreferences {
        override fun getAll(): MutableMap<String, *> {
            if (throwOnRead) throw AEADBadTagException("Tag mismatch during decrypt")
            return mutableMapOf<String, Any>()
        }
        override fun getString(key: String?, defValue: String?): String? {
            if (throwOnRead) throw AEADBadTagException("Tag mismatch during decrypt")
            return defValue
        }
        override fun getStringSet(key: String?, defValues: MutableSet<String>?): MutableSet<String>? = null
        override fun getInt(key: String?, defValue: Int): Int = defValue
        override fun getLong(key: String?, defValue: Long): Long = defValue
        override fun getFloat(key: String?, defValue: Float): Float = defValue
        override fun getBoolean(key: String?, defValue: Boolean): Boolean = defValue
        override fun contains(key: String?): Boolean {
            if (throwOnRead) throw AEADBadTagException("Tag mismatch during contains")
            return false
        }
        override fun edit(): SharedPreferences.Editor = object : SharedPreferences.Editor {
            override fun putString(key: String?, value: String?): SharedPreferences.Editor = this
            override fun putStringSet(key: String?, values: MutableSet<String>?): SharedPreferences.Editor = this
            override fun putInt(key: String?, value: Int): SharedPreferences.Editor = this
            override fun putLong(key: String?, value: Long): SharedPreferences.Editor = this
            override fun putFloat(key: String?, value: Float): SharedPreferences.Editor = this
            override fun putBoolean(key: String?, value: Boolean): SharedPreferences.Editor = this
            override fun remove(key: String?): SharedPreferences.Editor = this
            override fun clear(): SharedPreferences.Editor = this
            override fun commit(): Boolean {
                if (throwOnWrite) throw KeyStoreException("Signature/MAC verification failed", AEADBadTagException("Tag mismatch"))
                return true
            }
            override fun apply() {
                if (throwOnWrite) throw KeyStoreException("Signature/MAC verification failed", AEADBadTagException("Tag mismatch"))
            }
        }
        override fun registerOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener?) {}
        override fun unregisterOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener?) {}
    }

    private class InMemorySharedPreferences : SharedPreferences {
        val map = mutableMapOf<String, Any?>()

        override fun getAll(): MutableMap<String, *> = HashMap(map)
        override fun getString(key: String?, defValue: String?): String? = map[key] as? String ?: defValue
        override fun getStringSet(key: String?, defValues: MutableSet<String>?): MutableSet<String>? = null
        override fun getInt(key: String?, defValue: Int): Int = map[key] as? Int ?: defValue
        override fun getLong(key: String?, defValue: Long): Long = map[key] as? Long ?: defValue
        override fun getFloat(key: String?, defValue: Float): Float = map[key] as? Float ?: defValue
        override fun getBoolean(key: String?, defValue: Boolean): Boolean = map[key] as? Boolean ?: defValue
        override fun contains(key: String?): Boolean = map.containsKey(key)
        override fun edit(): SharedPreferences.Editor = object : SharedPreferences.Editor {
            val pending = mutableMapOf<String, Any?>()
            val removes = mutableSetOf<String>()
            var clearAll = false

            override fun putString(key: String?, value: String?): SharedPreferences.Editor { key?.let { pending[it] = value }; return this }
            override fun putStringSet(key: String?, values: MutableSet<String>?): SharedPreferences.Editor = this
            override fun putInt(key: String?, value: Int): SharedPreferences.Editor { key?.let { pending[it] = value }; return this }
            override fun putLong(key: String?, value: Long): SharedPreferences.Editor { key?.let { pending[it] = value }; return this }
            override fun putFloat(key: String?, value: Float): SharedPreferences.Editor { key?.let { pending[it] = value }; return this }
            override fun putBoolean(key: String?, value: Boolean): SharedPreferences.Editor { key?.let { pending[it] = value }; return this }
            override fun remove(key: String?): SharedPreferences.Editor { key?.let { removes.add(it) }; return this }
            override fun clear(): SharedPreferences.Editor { clearAll = true; return this }
            override fun commit(): Boolean {
                if (clearAll) map.clear()
                removes.forEach { map.remove(it) }
                map.putAll(pending)
                return true
            }
            override fun apply() { commit() }
        }
        override fun registerOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener?) {}
        override fun unregisterOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener?) {}
    }

    @Test
    fun testCorruptedBiometricPrefsOnCreation_DoesNotCrashApp() = runBlocking {
        var attempts = 0
        val inMemory = InMemorySharedPreferences()
        LocalFaceEnrollmentRepository.testPrefsProvider = {
            attempts++
            if (attempts == 1) {
                throw AEADBadTagException("Signature/MAC verification failed: AndroidKeyStore master key does not match ciphertext")
            }
            inMemory
        }

        val context = TestContext(tempDir)
        // Construction must NOT throw
        val repo = LocalFaceEnrollmentRepository(context)

        // Operations must succeed safely after auto-reset
        val saved = repo.saveEnrollment(
            staffId = "EMP101",
            staffName = "Dr. Jane Smith",
            embedding = floatArrayOf(0.1f, 0.2f, 0.3f),
            modelVersion = "w600k_mbf_v1",
            alignmentVersion = "5pt_similarity_v1",
            templates = emptyList()
        )
        assertTrue("Enrollment save should succeed after recovery", saved)
        assertTrue(LocalFaceEnrollmentRepository.resetCount >= 1)

        val has = repo.hasEnrollment("EMP101")
        assertTrue("Enrollment should exist in store after recovery", has)
    }

    @Test
    fun testCorruptedBiometricPrefsRead_ReturnsNullWithoutCrashing() = runBlocking {
        LocalFaceEnrollmentRepository.testPrefsProvider = { CorruptedSharedPreferences(throwOnRead = true) }

        val context = TestContext(tempDir)
        val repo = LocalFaceEnrollmentRepository(context)

        val enrollment = repo.getEnrollment("ANY_ID")
        assertNull("Should return null instead of crashing on AEADBadTagException", enrollment)

        val has = repo.hasEnrollment("ANY_ID")
        assertFalse("Should return false instead of crashing on contains", has)
    }

    @Test
    fun testCorruptedBiometricPrefsWrite_ReturnsFalseWithoutCrashing() = runBlocking {
        LocalFaceEnrollmentRepository.testPrefsProvider = { CorruptedSharedPreferences(throwOnWrite = true) }

        val context = TestContext(tempDir)
        val repo = LocalFaceEnrollmentRepository(context)

        val saved = repo.saveEnrollment(
            staffId = "EMP102",
            staffName = "Staff User",
            embedding = floatArrayOf(0.5f),
            modelVersion = "w600k_mbf_v1",
            alignmentVersion = "5pt_similarity_v1"
        )
        assertFalse("Should return false instead of crashing on write failure", saved)
    }
}
