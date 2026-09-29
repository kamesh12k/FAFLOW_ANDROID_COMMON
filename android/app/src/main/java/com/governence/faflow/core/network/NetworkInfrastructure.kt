package com.governence.faflow.core.network

import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import android.util.Log
import androidx.annotation.VisibleForTesting
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import okhttp3.Interceptor
import okhttp3.Response
import java.io.File
import java.io.IOException
import java.security.GeneralSecurityException
import java.security.KeyStore
import java.security.KeyStoreException

/**
 * Clean result wrapper for network and domain calls.
 */
sealed class NetworkResult<out T> {
    data class Success<out T>(val data: T) : NetworkResult<T>()
    data class Error(val code: Int, val message: String, val throwable: Throwable? = null) : NetworkResult<Nothing>()
    data object Loading : NetworkResult<Nothing>()
}

/**
 * Hardware Keystore-backed (AES-256-GCM) secure session token manager.
 *
 * Implements robust fail-safe exception handling against AEADBadTagException,
 * KeyStoreException, GeneralSecurityException, and IOException (e.g. from
 * Android Auto Backup restore without Keystore keys).
 *
 * IMPORTANT: EncryptedSharedPreferences and MasterKey are lazy-initialized to avoid
 * blocking the Android main thread. Call initialize() from a background thread
 * (e.g., FaflowApplication.onCreate()) to pre-warm the Keystore before first UI access.
 */
class TokenManager(
    context: Context,
    private val customPrefsProvider: ((Context) -> SharedPreferences)? = null
) {
    private val appContext = context.applicationContext ?: context

    @Volatile
    private var cachedPrefs: SharedPreferences? = null

    // Default false; updated via initialize() on a background thread before UI access.
    private val _isLoggedIn = MutableStateFlow(false)
    val isLoggedIn: StateFlow<Boolean> = _isLoggedIn.asStateFlow()

    private fun isSecurityOrIoException(e: Throwable): Boolean {
        var current: Throwable? = e
        while (current != null) {
            if (current is GeneralSecurityException ||
                current is IOException ||
                current is SecurityException ||
                current is KeyStoreException ||
                current.javaClass.name.contains("AEADBadTagException", ignoreCase = true) ||
                current.javaClass.name.contains("KeyStore", ignoreCase = true)
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

    /**
     * Completely deletes the corrupted SharedPreferences file and removes the Keystore
     * master key alias so a clean state can be generated on next access.
     */
    @Synchronized
    fun resetStore() {
        cachedPrefs = null
        _isLoggedIn.value = false
        resetCount++

        // 1. Delete SharedPreferences from ContextImpl cache
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                appContext.deleteSharedPreferences(PREFS_FILE_NAME)
            }
        } catch (e: Throwable) {
            Log.w(TAG, "Failed deleting shared preferences via context: ${e.message}")
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
            Log.w(TAG, "Failed deleting shared preferences files: ${e.message}")
        }

        // 3. Delete Keystore master key alias so a fresh one is generated
        try {
            val keyStore = KeyStore.getInstance("AndroidKeyStore")
            keyStore.load(null)
            val masterKeyAlias = MasterKey.DEFAULT_MASTER_KEY_ALIAS
            if (keyStore.containsAlias(masterKeyAlias)) {
                keyStore.deleteEntry(masterKeyAlias)
            }
        } catch (e: Throwable) {
            Log.w(TAG, "Failed deleting master key from AndroidKeyStore: ${e.message}")
        }
    }

    @Synchronized
    private fun getPrefs(): SharedPreferences? {
        cachedPrefs?.let { return it }
        return try {
            createEncryptedSharedPreferences().also { cachedPrefs = it }
        } catch (e: Throwable) {
            if (isSecurityOrIoException(e)) {
                Log.w(TAG, "token store reset, user must re-login: ${e.message}")
                resetStore()
                try {
                    // Attempt fresh creation once after reset
                    createEncryptedSharedPreferences().also { cachedPrefs = it }
                } catch (retryEx: Throwable) {
                    Log.w(TAG, "Failed to re-initialize encrypted preferences after reset: ${retryEx.message}")
                    null
                }
            } else {
                Log.w(TAG, "token store reset, user must re-login: ${e.message}")
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
                Log.w(TAG, "token store reset, user must re-login: ${e.message}")
                resetStore()
            } else {
                Log.w(TAG, "Unexpected error reading secure preferences: ${e.message}")
            }
            defaultValue
        }
    }

    private inline fun safeWrite(block: (SharedPreferences.Editor) -> Unit): Boolean {
        val prefs = getPrefs() ?: return false
        return try {
            val editor = prefs.edit()
            block(editor)
            editor.apply()
            true
        } catch (e: Throwable) {
            if (isSecurityOrIoException(e)) {
                Log.w(TAG, "token store reset, user must re-login: ${e.message}")
                resetStore()
            } else {
                Log.w(TAG, "Unexpected error writing secure preferences: ${e.message}")
            }
            false
        }
    }

    /**
     * Pre-warms EncryptedSharedPreferences and updates the isLoggedIn state.
     * MUST be called from a background thread (Dispatchers.IO) — never from main thread.
     * Called by FaflowApplication on app start.
     */
    fun initialize() {
        try {
            _isLoggedIn.value = hasValidToken()
        } catch (e: Throwable) {
            Log.w(TAG, "token store reset, user must re-login: ${e.message}")
            resetStore()
            _isLoggedIn.value = false
        }
    }

    fun saveToken(
        token: String,
        userId: Int,
        userName: String,
        userEmail: String,
        role: String,
        adminLevel: String? = null,
        departmentId: Int?,
        policyVersionAccepted: String? = null,
        policyAcceptedAt: String? = null,
        onboardingCompleted: Boolean = false,
        mustChangeCredentials: Boolean = false
    ) {
        val success = safeWrite { editor ->
            editor.putString(KEY_ACCESS_TOKEN, token)
                .putInt(KEY_USER_ID, userId)
                .putString(KEY_USER_NAME, userName)
                .putString(KEY_USER_EMAIL, userEmail)
                .putString(KEY_USER_ROLE, role)
                .putString(KEY_ADMIN_LEVEL, adminLevel)
                .putInt(KEY_DEPT_ID, departmentId ?: -1)
                .putString(KEY_POLICY_VERSION, policyVersionAccepted)
                .putString(KEY_POLICY_ACCEPTED_AT, policyAcceptedAt)
                .putBoolean(KEY_ONBOARDING_COMPLETED, onboardingCompleted)
                .putBoolean(KEY_MUST_CHANGE_CREDENTIALS, mustChangeCredentials)
        }
        _isLoggedIn.value = success
    }

    fun getToken(): String? = safeRead(null) { it.getString(KEY_ACCESS_TOKEN, null) }
    fun getUserId(): Int = safeRead(-1) { it.getInt(KEY_USER_ID, -1) }
    fun getUserName(): String? = safeRead(null) { it.getString(KEY_USER_NAME, null) }
    fun getUserEmail(): String? = safeRead(null) { it.getString(KEY_USER_EMAIL, null) }
    fun getUserRole(): String? = safeRead("teacher") { it.getString(KEY_USER_ROLE, "teacher") }
    fun getAdminLevel(): String? = safeRead(null) { it.getString(KEY_ADMIN_LEVEL, null) }
    fun getDepartmentId(): Int? = safeRead(null) {
        val id = it.getInt(KEY_DEPT_ID, -1)
        if (id != -1) id else null
    }
    fun getPolicyVersionAccepted(): String? = safeRead(null) { it.getString(KEY_POLICY_VERSION, null) }
    fun getPolicyAcceptedAt(): String? = safeRead(null) { it.getString(KEY_POLICY_ACCEPTED_AT, null) }
    fun getOnboardingCompleted(): Boolean = safeRead(false) { it.getBoolean(KEY_ONBOARDING_COMPLETED, false) }
    fun getMustChangeCredentials(): Boolean = safeRead(false) { it.getBoolean(KEY_MUST_CHANGE_CREDENTIALS, false) }

    fun updateMustChangeCredentials(mustChange: Boolean) {
        safeWrite { it.putBoolean(KEY_MUST_CHANGE_CREDENTIALS, mustChange) }
    }

    fun updatePolicyAccepted(version: String, acceptedAt: String? = null) {
        safeWrite { editor ->
            editor.putString(KEY_POLICY_VERSION, version)
            if (acceptedAt != null) {
                editor.putString(KEY_POLICY_ACCEPTED_AT, acceptedAt)
            }
        }
    }

    fun updateOnboardingCompleted(completed: Boolean) {
        safeWrite { it.putBoolean(KEY_ONBOARDING_COMPLETED, completed) }
    }

    fun hasValidToken(): Boolean = !getToken().isNullOrBlank()

    fun clearSession() {
        safeWrite { it.clear() }
        _isLoggedIn.value = false
    }

    companion object {
        private const val TAG = "TokenManager"
        const val PREFS_FILE_NAME = "faflow_secure_prefs"

        private const val KEY_ACCESS_TOKEN = "access_token"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_USER_NAME = "user_name"
        private const val KEY_USER_EMAIL = "user_email"
        private const val KEY_USER_ROLE = "user_role"
        private const val KEY_ADMIN_LEVEL = "admin_level"
        private const val KEY_DEPT_ID = "department_id"
        private const val KEY_POLICY_VERSION = "policy_version_accepted"
        private const val KEY_POLICY_ACCEPTED_AT = "policy_accepted_at"
        private const val KEY_ONBOARDING_COMPLETED = "onboarding_completed"
        private const val KEY_MUST_CHANGE_CREDENTIALS = "must_change_credentials"

        @VisibleForTesting
        var testPrefsProvider: ((Context) -> SharedPreferences)? = null

        @VisibleForTesting
        var resetCount: Int = 0
    }
}

/**
 * OkHttp Interceptor attaching Bearer JWT tokens to outgoing requests and handling 401s.
 */
class AuthInterceptor(
    private val tokenManager: TokenManager,
    private val onUnauthorized: () -> Unit = {}
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()
        val token = tokenManager.getToken()

        val requestBuilder = originalRequest.newBuilder()
        if (!token.isNullOrBlank() && !originalRequest.headers.names().contains("Authorization")) {
            requestBuilder.addHeader("Authorization", "Bearer $token")
        }

        val response = chain.proceed(requestBuilder.build())

        if (response.code == 401) {
            tokenManager.clearSession()
            onUnauthorized()
        }

        return response
    }
}
