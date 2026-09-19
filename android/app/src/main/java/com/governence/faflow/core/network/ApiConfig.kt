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

    // Production secure endpoint (Render Live Backend)
    const val PRODUCTION_BASE_URL = "https://faflow-android-common.onrender.com/"

    // Sensible timeout configurations avoiding hangs while handling Render cold starts
    const val CONNECT_TIMEOUT_SECONDS = 15L
    const val READ_TIMEOUT_SECONDS = 25L
    const val WRITE_TIMEOUT_SECONDS = 25L
    const val CALL_TIMEOUT_SECONDS = 30L

    private const val PREFS_NAME = "faflow_network_prefs"
    private const val KEY_BASE_URL = "server_base_url"
    private const val KEY_MIGRATION_VERSION = "network_config_migration_ver"
    private const val CURRENT_MIGRATION_VERSION = 2

    // Obsolete / legacy URLs that must be migrated away from in production
    private val LEGACY_OBSOLETE_URLS = listOf(
        "https://api.faflow.institution.edu/",
        "http://api.faflow.institution.edu/",
        "http://10.0.2.2:8000/",
        "http://127.0.0.1:8000/",
        "http://172.21.135.207:8000/",
        "http://localhost:8000/"
    )

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
     * Retrieves the persisted or default base URL with safe migration for Release builds.
     */
    fun getBaseUrl(context: Context): String {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val saved = prefs.getString(KEY_BASE_URL, null)
        val migrationVer = prefs.getInt(KEY_MIGRATION_VERSION, 0)

        // Version-aware migration: ensure Release build is never trapped in obsolete URLs
        if (!BuildConfig.DEBUG) {
            val isObsolete = saved == null ||
                    LEGACY_OBSOLETE_URLS.any { saved.equals(it, ignoreCase = true) || saved.contains("faflow.institution.edu") } ||
                    saved.contains("10.0.2.2") ||
                    saved.contains("127.0.0.1") ||
                    saved.contains("172.21.135.207") ||
                    saved.contains("localhost")

            if (migrationVer < CURRENT_MIGRATION_VERSION || isObsolete) {
                saveBaseUrl(context, PRODUCTION_BASE_URL)
                prefs.edit().putInt(KEY_MIGRATION_VERSION, CURRENT_MIGRATION_VERSION).apply()
                return PRODUCTION_BASE_URL
            }
        }

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
