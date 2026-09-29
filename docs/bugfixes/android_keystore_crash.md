# FAFLOW Bugfix Report: Android Keystore Crash & EncryptedSharedPreferences Recovery

- **Target Branch**: `fix/keystore-crash`
- **Issue**: `javax.crypto.AEADBadTagException` / `java.security.KeyStoreException: Signature/MAC verification failed` on app launch and WorkManager execution
- **Component**: Android (`NetworkInfrastructure.kt`, `TokenManager`, `StudentAttendanceSyncWorker`, `AttendanceSyncWorker`, `NotificationSyncWorker`, `data_extraction_rules.xml`, `backup_rules.xml`)
- **Status**: **RESOLVED & VERIFIED** (201/201 Android unit tests pass, contract parity PASS)

---

## 1. Root Cause Analysis

### The Exception
When `TokenManager.sharedPreferences` attempted to open or read from `EncryptedSharedPreferences`:
```text
javax.crypto.AEADBadTagException: Signature/MAC verification failed
    at com.google.crypto.tink.subtle.AesGcmJce.decrypt(AesGcmJce.java:101)
    at com.google.crypto.tink.integration.android.AndroidKeystoreAesGcm.decrypt(...)
    at androidx.security.crypto.EncryptedSharedPreferences.create(...)
```

### Why it Happened
1. **Keystore Keys are Non-Exportable**: Android's hardware-backed Keystore (`AndroidKeyStore`) stores encryption keys inside hardware security modules (TEE / StrongBox). These keys are intentionally non-exportable and bound to that specific physical hardware instance and OS installation.
2. **`android:allowBackup="true"` with Unconfigured Rules**: In `AndroidManifest.xml`, `android:allowBackup="true"` was enabled. However:
   - `android/app/src/main/res/xml/data_extraction_rules.xml` (governing Android 12+ cloud and device-to-device transfers) had all include/exclude rules commented out with `<!-- TODO -->`.
   - `android/app/src/main/res/xml/backup_rules.xml` (governing Android 6–11 Auto Backup) also had its rules commented out.
3. **The Restore Mismatch**:
   - When an app reinstall or device migration occurred, Android's backup service restored `/data/data/com.governence.faflow/shared_prefs/faflow_secure_prefs.xml` onto the device.
   - However, the Keystore key alias `_androidx_security_master_key_` was either newly generated or non-existent in the target `AndroidKeyStore`.
   - When Tink / `EncryptedSharedPreferences.create()` attempted to decrypt the restored keysets using the local Keystore key, AEAD MAC tag authentication failed because the ciphertext was encrypted with an older/different key.
4. **Unhandled Propagation & Worker Loops**:
   - `TokenManager` previously initialized `sharedPreferences` via a naive `by lazy` delegate without exception handling.
   - Any access to `getToken()` or `hasValidToken()` crashed immediately with `AEADBadTagException` or `KeyStoreException`.
   - While `FaflowApplication.kt` caught the pre-warm exception as `non-fatal`, WorkManager background workers (`StudentAttendanceSyncWorker`, `AttendanceSyncWorker`, `NotificationSyncWorker`) instantiated `TokenManager` directly on background threads and crashed unhandled.
   - Furthermore, `StudentAttendanceSyncWorker` previously returned `Result.retry()` when token was null/blank, causing WorkManager to retry indefinitely with exponential backoff, waking up the device and repeating the failure.

---

## 2. Exact Fix Implemented

### Fix 1: Fail-Safe `TokenManager` with Tink Keystore Reset Pattern
In [`NetworkInfrastructure.kt`](file:///b:/FAFLOW_UNIFIED/android/app/src/main/java/com/governence/faflow/core/network/NetworkInfrastructure.kt):
- Replaced the simple `by lazy` property with an explicit synchronized `getPrefs()` and resilient wrappers `safeRead` and `safeWrite`.
- Wrapped `createEncryptedSharedPreferences()`, `getString()`, `getInt()`, and editor writes in `try/catch` catching `GeneralSecurityException` (including `AEADBadTagException` and `KeyStoreException`), `IOException`, and nested security causes.
- **Tink Reset Pattern**: On any security or decryption exception:
  1. Deletes the corrupted SharedPreferences from Android's `ContextImpl` cache via `context.deleteSharedPreferences("faflow_secure_prefs")`.
  2. Deletes physical files on disk: `shared_prefs/faflow_secure_prefs.xml` and `shared_prefs/faflow_secure_prefs.bak`.
  3. Deletes the mismatched master key alias from `AndroidKeyStore`: `keyStore.deleteEntry(MasterKey.DEFAULT_MASTER_KEY_ALIAS)`.
  4. Resets the internal session state (`_isLoggedIn.value = false`, `cachedPrefs = null`).
  5. Logs a clear diagnostic warning:
     ```text
     WARN TokenManager: token store reset, user must re-login: <exception message>
     ```
  6. Returns `null` / `false` / `-1` safe defaults without re-throwing.

### Fix 2: App Launch and Splash Screen Session Routing
In [`SplashScreen.kt`](file:///b:/FAFLOW_UNIFIED/android/app/src/main/java/com/governence/faflow/ui/screens/SplashScreen.kt) & [`NavGraph.kt`](file:///b:/FAFLOW_UNIFIED/android/app/src/main/java/com/governence/faflow/ui/navigation/NavGraph.kt):
- When `TokenManager.initialize()` runs during pre-warm or startup, any corrupted store is reset cleanly and `tokenManager.isLoggedIn.value` evaluates to `false`.
- `SplashScreen` observes `isLoggedIn` (`false`) and cleanly navigates to `Screen.Login.route` via `onNavigateToLogin()` without hanging, crashing, or throwing.

### Fix 3: WorkManager Workers Skip Cleanly on Unauthenticated Runs
Updated the three background sync workers:
1. [`StudentAttendanceSyncWorker.kt`](file:///b:/FAFLOW_UNIFIED/android/app/src/main/java/com/governence/faflow/attendance/sync/StudentAttendanceSyncWorker.kt)
2. [`AttendanceSyncWorker.kt`](file:///b:/FAFLOW_UNIFIED/android/app/src/main/java/com/governence/faflow/attendance/sync/AttendanceSyncWorker.kt)
3. [`NotificationSyncWorker.kt`](file:///b:/FAFLOW_UNIFIED/android/app/src/main/java/com/governence/faflow/attendance/sync/NotificationSyncWorker.kt)
- Each worker now safely initializes `TokenManager` and retrieves the token inside defensive `try/catch` blocks.
- If the token is null, blank, or invalid (i.e. user is logged out or session was reset), the worker logs:
  ```text
  No valid authentication token present (not logged in). Skipping this run.
  ```
- Workers return **`Result.success()`** instead of `Result.retry()`. This prevents WorkManager from scheduling endless exponential retries when the user is logged out.

### Fix 4: Android Backup Rules Exclusion (Root Cause Prevention)
Updated:
- [`data_extraction_rules.xml`](file:///b:/FAFLOW_UNIFIED/android/app/src/main/res/xml/data_extraction_rules.xml):
  ```xml
  <data-extraction-rules>
      <cloud-backup>
          <exclude domain="sharedpref" path="faflow_secure_prefs.xml" />
          <exclude domain="sharedpref" path="faflow_secure_prefs.bak" />
          <exclude domain="sharedpref" path="__androidx_security_crypto_encrypted_file_pref__.xml" />
      </cloud-backup>
      <device-transfer>
          <exclude domain="sharedpref" path="faflow_secure_prefs.xml" />
          <exclude domain="sharedpref" path="faflow_secure_prefs.bak" />
          <exclude domain="sharedpref" path="__androidx_security_crypto_encrypted_file_pref__.xml" />
      </device-transfer>
  </data-extraction-rules>
  ```
- [`backup_rules.xml`](file:///b:/FAFLOW_UNIFIED/android/app/src/main/res/xml/backup_rules.xml):
  ```xml
  <full-backup-content>
      <exclude domain="sharedpref" path="faflow_secure_prefs.xml" />
      <exclude domain="sharedpref" path="faflow_secure_prefs.bak" />
      <exclude domain="sharedpref" path="__androidx_security_crypto_encrypted_file_pref__.xml" />
  </full-backup-content>
  ```
Now, Android Auto Backup and device migrations will **never** back up or restore `faflow_secure_prefs.xml`.

---

## 3. Was `allowBackup` the Cause?

**YES, definitively.**
Because `android:allowBackup="true"` was enabled while `data_extraction_rules.xml` and `backup_rules.xml` were completely unconfigured (commented out), the Android OS backed up `faflow_secure_prefs.xml` and restored it after app reinstalls or device migrations without the hardware Keystore key. By explicitly excluding `faflow_secure_prefs.xml` from both cloud backups and device transfers, this mismatch can never occur again on fresh restores.

---

## 4. Test Suite Added

Created [`TokenManagerCorruptedPrefsTest.kt`](file:///b:/FAFLOW_UNIFIED/android/app/src/test/java/com/governence/faflow/TokenManagerCorruptedPrefsTest.kt):
1. `testInitializationWithKeystoreMismatch_HandlesGracefullyAndResetsStore`: Simulates `AEADBadTagException` during `EncryptedSharedPreferences.create()`. Asserts no crash, `isLoggedIn == false`, `hasValidToken == false`, `getToken() == null`, and `resetStore` executed.
2. `testCorruptedPrefRead_RecoversGracefullyAndReturnsNull`: Simulates tag failure during `getString()` key decryption. Asserts no crash, returns null, and resets store.
3. `testGeneralSecurityExceptionAndKeyStoreException_DoNotCrash`: Asserts all getters return safe defaults without throwing when Keystore errors occur.
4. `testCorruptedFilePhysicalDeletion_RemovesDiskFiles`: Verifies that `resetStore()` physically deletes both `.xml` and `.bak` files from `shared_prefs/`.
5. `testWorkerNullTokenHandling_SkipsCleanlyWithoutRetrying`: Verifies worker logic evaluates to `Result.success()` rather than `Result.retry()` on missing/invalid tokens.
6. `testAppLaunchSessionCheck_RoutesToLoginOnCorruptedSession`: Verifies that app launch routes directly to `Login` when the stored token is corrupted.

### Test Run Results
- **Android Unit Tests**: 201/201 tests passed (100% success rate, 0 failures, 0 skipped).
- **Android APK Build**: `assembleDebug` passed cleanly (`BUILD SUCCESSFUL in 1m 10s`).
- **OpenAPI Drift Check**: Up to date (333/333 paths match).
- **CI Contract Parity Check**: `PASS` (0 HIGH, 0 MEDIUM).

---

## 5. Device Verification Instructions

To verify on a physical or emulated Android device:
1. **Build & Install**:
   ```powershell
   cd android
   .\gradlew.bat installDebug
   ```
2. **Force-Stop the App**:
   In Android Settings -> Apps -> FAFLOW -> tap **Force Stop**.
3. **Do NOT clear data or cache**:
   Leave the existing data and corrupted preferences intact.
4. **Relaunch FAFLOW**:
   Open the app from the launcher.
5. **Expected Behavior**:
   - The app launches smoothly through the splash screen.
   - `TokenManager` logs `WARN TokenManager: token store reset, user must re-login: ...` and cleans the corrupted files.
   - The app navigates cleanly to the **Login Screen**.
   - No crash dialog appears (`"FAFLOW keeps stopping"` will never show).
   - WorkManager workers execute cleanly without repeating retry loops.
