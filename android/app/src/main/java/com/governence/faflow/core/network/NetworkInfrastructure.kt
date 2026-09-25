package com.governence.faflow.core.network

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import okhttp3.Interceptor
import okhttp3.Response

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
 * IMPORTANT: EncryptedSharedPreferences and MasterKey are lazy-initialized to avoid
 * blocking the Android main thread. Call initialize() from a background thread
 * (e.g., FaflowApplication.onCreate()) to pre-warm the Keystore before first UI access.
 */
class TokenManager(context: Context) {
    private val appContext = context.applicationContext

    // Lazy: MasterKey derivation and EncryptedSharedPreferences setup are deferred until
    // first actual prefs access. FaflowApplication pre-warms this on a background thread.
    private val masterKey: MasterKey by lazy {
        MasterKey.Builder(appContext)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
    }

    private val sharedPreferences by lazy {
        EncryptedSharedPreferences.create(
            appContext,
            "faflow_secure_prefs",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    // Default false; updated via initialize() on a background thread before UI access.
    private val _isLoggedIn = MutableStateFlow(false)
    val isLoggedIn: StateFlow<Boolean> = _isLoggedIn.asStateFlow()

    /**
     * Pre-warms EncryptedSharedPreferences and updates the isLoggedIn state.
     * MUST be called from a background thread (Dispatchers.IO) — never from main thread.
     * Called by FaflowApplication on app start.
     */
    fun initialize() {
        _isLoggedIn.value = hasValidToken()
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
        sharedPreferences.edit()
            .putString(KEY_ACCESS_TOKEN, token)
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
            .apply()
        _isLoggedIn.value = true
    }

    fun getToken(): String? = sharedPreferences.getString(KEY_ACCESS_TOKEN, null)
    fun getUserId(): Int = sharedPreferences.getInt(KEY_USER_ID, -1)
    fun getUserName(): String? = sharedPreferences.getString(KEY_USER_NAME, null)
    fun getUserEmail(): String? = sharedPreferences.getString(KEY_USER_EMAIL, null)
    fun getUserRole(): String? = sharedPreferences.getString(KEY_USER_ROLE, "teacher")
    fun getAdminLevel(): String? = sharedPreferences.getString(KEY_ADMIN_LEVEL, null)
    fun getDepartmentId(): Int? {
        val id = sharedPreferences.getInt(KEY_DEPT_ID, -1)
        return if (id != -1) id else null
    }
    fun getPolicyVersionAccepted(): String? = sharedPreferences.getString(KEY_POLICY_VERSION, null)
    fun getPolicyAcceptedAt(): String? = sharedPreferences.getString(KEY_POLICY_ACCEPTED_AT, null)
    fun getOnboardingCompleted(): Boolean = sharedPreferences.getBoolean(KEY_ONBOARDING_COMPLETED, false)
    fun getMustChangeCredentials(): Boolean = sharedPreferences.getBoolean(KEY_MUST_CHANGE_CREDENTIALS, false)

    fun updateMustChangeCredentials(mustChange: Boolean) {
        sharedPreferences.edit()
            .putBoolean(KEY_MUST_CHANGE_CREDENTIALS, mustChange)
            .apply()
    }

    fun updatePolicyAccepted(version: String, acceptedAt: String? = null) {
        sharedPreferences.edit()
            .putString(KEY_POLICY_VERSION, version)
            .apply {
                if (acceptedAt != null) {
                    putString(KEY_POLICY_ACCEPTED_AT, acceptedAt)
                }
            }
            .apply()
    }

    fun updateOnboardingCompleted(completed: Boolean) {
        sharedPreferences.edit()
            .putBoolean(KEY_ONBOARDING_COMPLETED, completed)
            .apply()
    }

    fun hasValidToken(): Boolean = !getToken().isNullOrBlank()

    fun clearSession() {
        sharedPreferences.edit().clear().apply()
        _isLoggedIn.value = false
    }

    companion object {
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
