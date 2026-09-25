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
    const val DEFAULT_LAN_URL = "https://faflowgovernence.online/"

    // Production secure endpoint (FAFLOW Azure Production Server)
    const val PRODUCTION_BASE_URL = "https://faflowgovernence.online/"

    // Sensible timeout configurations avoiding hangs while handling network calls
    const val CONNECT_TIMEOUT_SECONDS = 15L
    const val READ_TIMEOUT_SECONDS = 25L
    const val WRITE_TIMEOUT_SECONDS = 25L
    const val CALL_TIMEOUT_SECONDS = 30L

    private const val PREFS_NAME = "faflow_network_prefs"
    private const val KEY_BASE_URL = "server_base_url"
    private const val KEY_MIGRATION_VERSION = "network_config_migration_ver"
    private const val CURRENT_MIGRATION_VERSION = 4

    // Obsolete / legacy URLs that must be migrated away from in production
    private val LEGACY_OBSOLETE_URLS = listOf(
        "https://faflow-android-common.onrender.com/",
        "http://faflow-android-common.onrender.com/",
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
     * Always points to live production endpoint (faflowgovernence.online).
     */
    fun getDefaultBaseUrl(): String {
        return if (isEmulator()) EMULATOR_10_0_2_2_URL else PRODUCTION_BASE_URL
    }

    /**
     * Retrieves the persisted or default base URL with safe migration to live server.
     */
    fun getBaseUrl(context: Context): String {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val saved = prefs.getString(KEY_BASE_URL, null)
        val migrationVer = prefs.getInt(KEY_MIGRATION_VERSION, 0)

        val isEmulatorDevice = isEmulator()
        val defaultUrl = if (isEmulatorDevice) EMULATOR_10_0_2_2_URL else PRODUCTION_BASE_URL

        // Version-aware migration: ensure physical devices are updated to live production server,
        // while Android Emulators retain access to local 10.0.2.2 development host.
        val isObsolete = saved == null ||
                LEGACY_OBSOLETE_URLS.any { saved.equals(it, ignoreCase = true) || saved.contains("onrender.com") || saved.contains("faflow.institution.edu") } ||
                saved.contains("172.21.135.207") ||
                (!isEmulatorDevice && (saved.contains("10.0.2.2") || saved.contains("127.0.0.1") || saved.contains("localhost")))

        if (migrationVer < CURRENT_MIGRATION_VERSION || isObsolete) {
            saveBaseUrl(context, defaultUrl)
            prefs.edit().putInt(KEY_MIGRATION_VERSION, CURRENT_MIGRATION_VERSION).apply()
            return defaultUrl
        }

        val candidate = saved ?: defaultUrl
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
