# Milestone 14: Android Production Release & Institutional Distribution
## FAFLOW Staff Mobile Android Client

---

## 1. Release Build Configuration

- **Application ID**: `com.governence.faflow`
- **Min SDK**: `26` (Android 8.0 Oreo)
- **Target SDK / Compile SDK**: `37` (Android 15/16)
- **Version Code**: `1`
- **Version Name**: `1.0.0-prod`
- **R8 / ProGuard Optimization**: Configured in [`app/proguard-rules.pro`](file:///b:/android/app/proguard-rules.pro) with keep rules for ONNX Runtime Mobile, Moshi DTOs, and WorkManager.
- **Embedded AI Assets**: `assets/models/scrfd_500m_bnkps_shape640x640.onnx`, `assets/models/mobilefacenet_arcface.onnx`.

---

## 2. Institutional APK Distribution Methods

1. **Direct Institutional Portal Download**:
   - Authorized faculty download `faflow-staff-release.apk` directly from internal college portal (`https://faflow.college.edu/download/app`).
2. **Institutional Mobile Device Management (MDM)**:
   - Enterprise MDM systems (Microsoft Intune / Google Workspace Endpoint Management) push the APK automatically to institutional handsets.
3. **Sideloading Verification**:
   - Instruct staff to allow installation from trusted institutional browser and verify SHA-256 APK checksum.
