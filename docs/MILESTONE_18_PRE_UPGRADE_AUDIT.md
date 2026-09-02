# Milestone 18 — Pre-Upgrade Dependency & Architecture Audit

### 1. Build Environment & Toolchain
- **Gradle Version**: 9.5.0
- **Android Gradle Plugin (AGP)**: 9.3.2
- **Kotlin Version**: 2.2.10
- **Compose Plugin**: `org.jetbrains.kotlin.plugin.compose` (Kotlin 2.2.10)
- **Compile SDK**: Android 37
- **Target SDK**: Android 37
- **Min SDK**: Android 26 (Android 8.0 Oreo)
- **Java / JDK**: Java 17 (Eclipse Adoptium / JBR)

---

### 2. Dependency Inventory & Version Baseline

| Dependency / Component | Group & Artifact | Current Version | Purpose |
|---|---|---|---|
| **Compose BOM** | `androidx.compose:compose-bom` | `2024.12.01` | Compose UI Baseline (UI 1.7.6) |
| **Compose UI** | `androidx.compose.ui:ui` | Managed via BOM (`1.7.6`) | Declarative UI toolkit |
| **Material3** | `androidx.compose.material3:material3` | Managed via BOM | Material 3 Components |
| **Navigation Compose** | `androidx.navigation:navigation-compose` | `2.8.8` | Screen Navigation |
| **Activity Compose** | `androidx.activity:activity-compose` | `1.10.1` | Compose Activity host |
| **Lifecycle KTX** | `androidx.lifecycle:lifecycle-runtime-ktx` | `2.8.7` | Android Lifecycle |
| **CameraX** | `androidx.camera:camera-*` | `1.4.1` | CameraX Preview & Image Analysis |
| **Coroutines** | `org.jetbrains.kotlinx:kotlinx-coroutines-*` | `1.10.1` | Asynchronous programming |
| **Retrofit** | `com.squareup.retrofit2:retrofit` | `2.11.0` | REST API Client |
| **Moshi** | `com.squareup.moshi:moshi-kotlin` | `1.15.2` | JSON Serialization |
| **OkHttp** | `com.squareup.okhttp3:okhttp` | `4.12.0` | HTTP Engine |
| **Security Crypto** | `androidx.security:security-crypto` | `1.1.0-alpha06` | EncryptedSharedPreferences |
| **Play Services Location**| `com.google.android.gms:play-services-location` | `21.3.0` | FusedLocationProviderClient |
| **ONNX Runtime** | `com.microsoft.onnxruntime:onnxruntime-android` | `1.21.0` | Face AI SCRFD & ArcFace |
| **WorkManager** | `androidx.work:work-runtime-ktx` | `2.10.0` | Offline Attendance Sync |

---

### 3. Native `.so` Libraries & 16 KB Alignment Baseline

Forensic inspection of ELF headers in `app-debug.apk`:

| Native Library (`.so`) | Origin Dependency | `arm64-v8a` Status | `x86_64` Status | 16 KB Alignment |
|---|---|---|---|---|
| `libandroidx.graphics.path.so` | AndroidX Graphics Path / Compose | Aligned (`0x4000`) | Aligned (`0x4000`) | **PASS** |
| `libimage_processing_util_jni.so` | CameraX (`androidx.camera`) | Aligned (`0x4000`) | Aligned (`0x4000`) | **PASS** |
| `libsurface_util_jni.so` | CameraX Core (`androidx.camera`) | Aligned (`0x4000`) | Aligned (`0x4000`) | **PASS** |
| `libonnxruntime.so` | ONNX Runtime (`1.21.0`) | Aligned (`0x4000`) | Aligned (`0x4000`) | **PASS** |
| `libonnxruntime4j_jni.so` | ONNX Runtime (`1.21.0`) | 4 KB (`0x1000`) | 4 KB (`0x1000`) | **UPSTREAM 4 KB** |

---

### 4. Identified Modernization Goals
1. Modernize Compose BOM and Compose dependencies to resolve inspector/tooling version warnings while ensuring 100% stable compatibility with Kotlin 2.2.10.
2. Investigate native library packaging options to optimize and isolate 16 KB page size execution on Android 15/16.
3. Verify zero regressions in Teacher and HOD workflows.
