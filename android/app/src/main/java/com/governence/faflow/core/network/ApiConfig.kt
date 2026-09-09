package com.governence.faflow.core.network

import android.content.Context
import android.os.Build
import com.governence.faflow.BuildConfig

/**
 * Centralized API & Networking configuration for FAFLOW.
 * Cleanly separates Android Emulator, Physical Device LAN, and Production HTTPS environments.
 */
object ApiConfig {

    // Standard Android Emulator loopback alias to host machine
    const val EMULATOR_10_0_2_2_URL = "http://10.0.2.2:8000/"

    // ADB reverse loopback alias
    const val EMULATOR_127_0_0_1_URL = "http://127.0.0.1:8000/"

    // Physical device development server fallback
    const val DEFAULT_LAN_URL = "http://172.21.135.207:8000/"

    // Production secure endpoint
    const val PRODUCTION_BASE_URL = "https://api.faflow.institution.edu/"

    // Sensible timeout configurations avoiding 15-second hangs
    const val CONNECT_TIMEOUT_SECONDS = 6L
    const val READ_TIMEOUT_SECONDS = 12L
    const val WRITE_TIMEOUT_SECONDS = 12L
    const val CALL_TIMEOUT_SECONDS = 15L

    private const val PREFS_NAME = "faflow_network_prefs"
    private const val KEY_BASE_URL = "server_base_url"

    fun isEmulator(): Boolean {
        return (Build.BRAND.startsWith("generic") && Build.DEVICE.startsWith("generic")) ||
                Build.FINGERPRINT.startsWith("generic") ||
                Build.FINGERPRINT.startsWith("unknown") ||
                Build.HARDWARE.contains("goldfish") ||
                Build.HARDWARE.contains("ranchu") ||
                Build.MODEL.contains("google_sdk") ||
                Build.MODEL.contains("Emulator") ||
                Build.MODEL.contains("Android SDK built for x86") ||
                Build.MANUFACTURER.contains("Genymotion") ||
                Build.PRODUCT.contains("sdk_gphone") ||
                Build.PRODUCT.contains("google_sdk") ||
                Build.PRODUCT.contains("emulator")
    }

    /**
     * Determines default base URL based on build flavor and environment.
     */
    fun getDefaultBaseUrl(): String {
        return if (BuildConfig.DEBUG) {
            if (isEmulator()) {
                // Works with both 10.0.2.2 and 127.0.0.1 (reverse proxy)
                EMULATOR_127_0_0_1_URL
            } else {
                DEFAULT_LAN_URL
            }
        } else {
            PRODUCTION_BASE_URL
        }
    }

    /**
     * Retrieves the persisted or default base URL.
     */
    fun getBaseUrl(context: Context): String {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val saved = prefs.getString(KEY_BASE_URL, null)
        val candidate = saved ?: getDefaultBaseUrl()
        return if (candidate.endsWith("/")) candidate else "$candidate/"
    }

    /**
     * Persists user or developer selected custom server URL.
     */
    fun saveBaseUrl(context: Context, url: String) {
        val normalized = if (url.endsWith("/")) url else "$url/"
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_BASE_URL, normalized)
            .apply()
    }
}
