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
 */
class TokenManager(context: Context) {
    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val sharedPreferences = EncryptedSharedPreferences.create(
        context,
        "faflow_secure_prefs",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    private val _isLoggedIn = MutableStateFlow(hasValidToken())
    val isLoggedIn: StateFlow<Boolean> = _isLoggedIn.asStateFlow()

    fun saveToken(token: String, userId: Int, userName: String, userEmail: String, role: String, departmentId: Int?) {
        sharedPreferences.edit()
            .putString(KEY_ACCESS_TOKEN, token)
            .putInt(KEY_USER_ID, userId)
            .putString(KEY_USER_NAME, userName)
            .putString(KEY_USER_EMAIL, userEmail)
            .putString(KEY_USER_ROLE, role)
            .putInt(KEY_DEPT_ID, departmentId ?: -1)
            .apply()
        _isLoggedIn.value = true
    }

    fun getToken(): String? = sharedPreferences.getString(KEY_ACCESS_TOKEN, null)
    fun getUserId(): Int = sharedPreferences.getInt(KEY_USER_ID, -1)
    fun getUserName(): String? = sharedPreferences.getString(KEY_USER_NAME, null)
    fun getUserEmail(): String? = sharedPreferences.getString(KEY_USER_EMAIL, null)
    fun getUserRole(): String? = sharedPreferences.getString(KEY_USER_ROLE, "teacher")
    fun getDepartmentId(): Int? {
        val id = sharedPreferences.getInt(KEY_DEPT_ID, -1)
        return if (id != -1) id else null
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
        private const val KEY_DEPT_ID = "department_id"
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
