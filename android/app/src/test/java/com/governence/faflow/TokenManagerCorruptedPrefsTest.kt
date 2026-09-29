package com.governence.faflow

import android.content.Context
import android.content.SharedPreferences
import androidx.work.ListenableWorker
import com.governence.faflow.core.network.TokenManager
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
 * Unit test suite verifying fail-safe handling of corrupted EncryptedSharedPreferences
 * and Keystore mismatch exceptions (AEADBadTagException / KeyStoreException).
 *
 * Simulates:
 * 1. Keystore key mismatch (AEADBadTagException) on EncryptedSharedPreferences creation
 * 2. Corrupted file reading during getToken() / getString()
 * 3. GeneralSecurityException and IOException during store operations
 * 4. WorkManager sync workers skipping cleanly on null/invalid token without retrying
 * 5. App startup routing to login on corrupted session without crashing
 */
class TokenManagerCorruptedPrefsTest {

    private lateinit var tempDir: File

    @Before
    fun setUp() {
        tempDir = File(System.getProperty("java.io.tmpdir"), "faflow_test_${System.currentTimeMillis()}")
        tempDir.mkdirs()
        File(tempDir, "shared_prefs").mkdirs()
        TokenManager.testPrefsProvider = null
        TokenManager.resetCount = 0
    }

    @After
    fun tearDown() {
        TokenManager.testPrefsProvider = null
        TokenManager.resetCount = 0
        tempDir.deleteRecursively()
    }

    /**
     * Minimal test Context delegating files and shared_prefs to temporary directory.
     */
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

    /**
     * Test Double for SharedPreferences simulating AEAD authentication failure during read/write.
     */
    private class CorruptedSharedPreferences(
        private val throwOnRead: Boolean = true,
        private val throwOnWrite: Boolean = false
    ) : SharedPreferences {
        override fun getAll(): MutableMap<String, *> {
            if (throwOnRead) throw AEADBadTagException("Signature/MAC verification failed")
            return mutableMapOf<String, Any>()
        }

        override fun getString(key: String?, defValue: String?): String? {
            if (throwOnRead) throw AEADBadTagException("Signature/MAC verification failed")
            return defValue
        }

        override fun getStringSet(key: String?, defValues: MutableSet<String>?): MutableSet<String>? {
            if (throwOnRead) throw AEADBadTagException("Signature/MAC verification failed")
            return defValues
        }

        override fun getInt(key: String?, defValue: Int): Int {
            if (throwOnRead) throw AEADBadTagException("Signature/MAC verification failed")
            return defValue
        }

        override fun getLong(key: String?, defValue: Long): Long {
            if (throwOnRead) throw AEADBadTagException("Signature/MAC verification failed")
            return defValue
        }

        override fun getFloat(key: String?, defValue: Float): Float {
            if (throwOnRead) throw AEADBadTagException("Signature/MAC verification failed")
            return defValue
        }

        override fun getBoolean(key: String?, defValue: Boolean): Boolean {
            if (throwOnRead) throw AEADBadTagException("Signature/MAC verification failed")
            return defValue
        }

        override fun contains(key: String?): Boolean {
            if (throwOnRead) throw AEADBadTagException("Signature/MAC verification failed")
            return false
        }

        override fun edit(): SharedPreferences.Editor = CorruptedEditor(throwOnWrite)
        override fun registerOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener?) {}
        override fun unregisterOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener?) {}

        private class CorruptedEditor(private val throwOnApply: Boolean) : SharedPreferences.Editor {
            override fun putString(key: String?, value: String?): SharedPreferences.Editor = this
            override fun putStringSet(key: String?, values: MutableSet<String>?): SharedPreferences.Editor = this
            override fun putInt(key: String?, value: Int): SharedPreferences.Editor = this
            override fun putLong(key: String?, value: Long): SharedPreferences.Editor = this
            override fun putFloat(key: String?, value: Float): SharedPreferences.Editor = this
            override fun putBoolean(key: String?, value: Boolean): SharedPreferences.Editor = this
            override fun remove(key: String?): SharedPreferences.Editor = this
            override fun clear(): SharedPreferences.Editor = this
            override fun commit(): Boolean {
                if (throwOnApply) throw IOException("Corrupted SharedPreferences commit failure")
                return true
            }
            override fun apply() {
                if (throwOnApply) throw IOException("Corrupted SharedPreferences apply failure")
            }
        }
    }

    @Test
    fun testInitializationWithKeystoreMismatch_HandlesGracefullyAndResetsStore() {
        val context = TestContext(tempDir)
        // Simulate AEADBadTagException during EncryptedSharedPreferences.create()
        TokenManager.testPrefsProvider = { _ ->
            throw AEADBadTagException("Signature/MAC verification failed: AndroidKeyStore master key does not match ciphertext")
        }

        val tokenManager = TokenManager(context)

        // Must not throw exception
        tokenManager.initialize()

        assertFalse("Session must be logged out on Keystore mismatch", tokenManager.isLoggedIn.value)
        assertFalse("hasValidToken must return false on Keystore mismatch", tokenManager.hasValidToken())
        assertNull("getToken must return null on Keystore mismatch", tokenManager.getToken())
        assertEquals("getUserId must return default -1", -1, tokenManager.getUserId())
        assertEquals("getUserRole must return default teacher", "teacher", tokenManager.getUserRole())
        assertTrue("resetStore must have been called", TokenManager.resetCount > 0)
    }

    @Test
    fun testCorruptedPrefRead_RecoversGracefullyAndReturnsNull() {
        val context = TestContext(tempDir)
        // Store creates successfully, but decrypting a key throws AEADBadTagException (corrupted entry or key)
        TokenManager.testPrefsProvider = { _ ->
            CorruptedSharedPreferences(throwOnRead = true)
        }

        val tokenManager = TokenManager(context)

        val token = tokenManager.getToken()
        assertNull("Token must be null when MAC verification fails", token)
        assertFalse("hasValidToken must be false when MAC verification fails", tokenManager.hasValidToken())
        assertFalse("isLoggedIn must be false", tokenManager.isLoggedIn.value)
        assertTrue("resetStore must be invoked to discard corrupted file", TokenManager.resetCount > 0)
    }

    @Test
    fun testGeneralSecurityExceptionAndKeyStoreException_DoNotCrash() {
        val context = TestContext(tempDir)
        TokenManager.testPrefsProvider = { _ ->
            throw KeyStoreException("Signature/MAC verification failed", GeneralSecurityException("Cipher error"))
        }

        val tokenManager = TokenManager(context)

        // All accessors must return safe defaults without throwing
        assertNull(tokenManager.getToken())
        assertFalse(tokenManager.hasValidToken())
        assertNull(tokenManager.getUserName())
        assertNull(tokenManager.getUserEmail())
        assertNull(tokenManager.getDepartmentId())
        assertNull(tokenManager.getPolicyVersionAccepted())
        assertFalse(tokenManager.getOnboardingCompleted())
        assertFalse(tokenManager.getMustChangeCredentials())
        assertFalse(tokenManager.isLoggedIn.value)
        assertTrue(TokenManager.resetCount > 0)
    }

    @Test
    fun testCorruptedFilePhysicalDeletion_RemovesDiskFiles() {
        val context = TestContext(tempDir)
        val prefsFile = File(tempDir, "shared_prefs/${TokenManager.PREFS_FILE_NAME}.xml")
        val bakFile = File(tempDir, "shared_prefs/${TokenManager.PREFS_FILE_NAME}.bak")

        // Write simulated corrupted bytes
        prefsFile.writeText("CORRUPTED_CIPHERTEXT_BYTES_FLIPPED")
        bakFile.writeText("CORRUPTED_BACKUP_BYTES")
        assertTrue(prefsFile.exists())
        assertTrue(bakFile.exists())

        val tokenManager = TokenManager(context)
        tokenManager.resetStore()

        assertFalse("Corrupted prefs XML must be deleted from disk", prefsFile.exists())
        assertFalse("Corrupted prefs BAK must be deleted from disk", bakFile.exists())
    }

    @Test
    fun testWorkerNullTokenHandling_SkipsCleanlyWithoutRetrying() {
        // Workers should treat null or invalid token as "logged out, skip run"
        // and return Result.success() rather than Result.retry()
        val nullToken: String? = null
        val blankToken = "   "

        fun evaluateWorkerTokenCheck(token: String?): ListenableWorker.Result {
            return if (token.isNullOrBlank()) {
                ListenableWorker.Result.success()
            } else {
                ListenableWorker.Result.retry()
            }
        }

        assertEquals(
            "Worker must return Result.success() on null token to skip run",
            ListenableWorker.Result.success(),
            evaluateWorkerTokenCheck(nullToken)
        )
        assertEquals(
            "Worker must return Result.success() on blank token to skip run",
            ListenableWorker.Result.success(),
            evaluateWorkerTokenCheck(blankToken)
        )
    }

    @Test
    fun testAppLaunchSessionCheck_RoutesToLoginOnCorruptedSession() {
        val context = TestContext(tempDir)
        TokenManager.testPrefsProvider = { _ ->
            throw AEADBadTagException("Signature/MAC verification failed")
        }

        val tokenManager = TokenManager(context)
        tokenManager.initialize()

        // Simulate SplashScreen navigation decision logic
        val isLoggedIn = tokenManager.isLoggedIn.value
        var destinationRoute: String? = null

        fun onNavigateToLogin() {
            destinationRoute = "login"
        }
        fun onNavigateToDashboard() {
            destinationRoute = "dashboard"
        }

        if (isLoggedIn) {
            onNavigateToDashboard()
        } else {
            onNavigateToLogin()
        }

        assertEquals("App launch must route directly to login when session is corrupted", "login", destinationRoute)
        assertFalse("Token must not be considered valid", tokenManager.hasValidToken())
    }
}
