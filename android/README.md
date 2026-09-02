# FAFLOW Staff Mobile Android Application

Native Android application for **FAFLOW Institutional Staff Attendance & Faculty Operations**.

---

## 1. Overview
FAFLOW Staff Mobile provides a unified, secure mobile experience for college faculty and institutional staff (Teaching Staff, HODs, Lab Technicians, Non-Teaching Staff):
- **Palgeo-Style Attendance**: Front-camera on-device face verification combined with high-accuracy graphical campus geofencing.
- **Biometric Pipeline**: InsightFace SCRFD 500M ONNX detection ($640 \times 640$), 5-point Umeyama canonical alignment ($112 \times 112$), MobileFaceNet ArcFace 512-D embedding extraction, and active head pose liveness defense.
- **Data Governance**: Zero raw photos or biometric embeddings are transmitted over the network or saved unencrypted. All face templates are encrypted inside the hardware Android KeyStore Trusted Execution Environment (TEE).
- **Faculty Operations**: Day Order timetable schedules, emergency/planned leave applications with auto-substitution allocation, duty credit ledgers, substitution preference controls, and institutional notifications.
- **Campus Geofence Administration**: Map-based visual perimeter editor for administrators supporting circular and polygonal campus zones.
- **Offline Reliability**: Encrypted local SQLite queue with WorkManager background synchronization.

---

## 2. Technical Stack
- **UI Framework**: Jetpack Compose, Material 3, Navigation Compose
- **Camera**: AndroidX CameraX (Front Camera, `STRATEGY_KEEP_ONLY_LATEST`)
- **AI Inference Engine**: ONNX Runtime Mobile (`com.microsoft.onnxruntime:onnxruntime-android:1.21.0`)
- **Networking**: Retrofit 2, OkHttp 3, Moshi Kotlin
- **Location**: Google Play Services Location (`FusedLocationProviderClient`)
- **Security**: AndroidX Security Crypto (`EncryptedSharedPreferences`, MasterKeys)
- **Background Processing**: AndroidX WorkManager

---

## 3. Build & Test
```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
.\gradlew.bat clean testDebugUnitTest assembleDebug
```
