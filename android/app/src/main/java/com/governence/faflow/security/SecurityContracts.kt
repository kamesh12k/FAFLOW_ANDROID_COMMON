package com.governence.faflow.security

/**
 * Contract for hardware-backed / encrypted key-value storage for auth tokens and configuration.
 */
interface SecureStorage {
    suspend fun saveAuthToken(token: String)
    suspend fun getAuthToken(): String?
    suspend fun clearAuthToken()

    suspend fun saveRefreshToken(token: String)
    suspend fun getRefreshToken(): String?

    suspend fun getDeviceId(): String
}

/**
 * Contract for device integrity and biometric policy compliance checks.
 */
interface DeviceSecurity {
    fun isDeviceSecure(): Boolean
    fun isRootedDevice(): Boolean
    fun isEmulator(): Boolean
}
