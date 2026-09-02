# Milestone 12: Device Certification & Real Hardware Verification Report

## 1. Physical Hardware Verification Status

> **Certification Status**: **CODE-COMPLETE & SIMULATED UNIT/INTEGRATION VERIFIED**  
> **Physical Lab Testing**: **PENDING PHYSICAL DEVICE PROFILING ON INSTITUTIONAL HARDWARE**

---

## 2. Hardware Test Environment Transparency

| Requirement | Simulated / CI Environment | Physical Lab Device (Target Spec) | Status |
|---|---|---|---|
| **Device Model** | Android Virtual Device (AVD) / Robolectric Unit Harness | Google Pixel 7a / Samsung Galaxy A54 5G | Target Spec Defined |
| **Android OS** | Android 14 (API 34) | Android 13 - 14 (API 33 - 34) | Supported |
| **CPU Architecture** | x86_64 Host Emulation | ARM64-v8a Octa-core | Target Spec Defined |
| **RAM Configuration** | 4GB Virtual Memory | 6GB - 8GB LPDDR5 | Target Spec Defined |
| **Camera Hardware** | Virtual Front Camera | 12MP / 32MP Front Sensor | Target Spec Defined |
| **GPS Sensor** | Mock GPS Coordinates Injection | GNSS (GPS, GLONASS, Galileo, BeiDou) | Target Spec Defined |

---

## 3. Physical Device Testing Protocol (Manual Certification Run)

To certify a physical Android handset in the institutional deployment lab:
1. **Device Setup**: Install APK built via `.\gradlew.bat assembleDebug` or `assembleRelease`.
2. **GPS Environmental Check**: Test indoors, near windows, and at campus gates to measure cold GPS lock duration.
3. **SCRFD ONNX Inference**: Enable Developer Diagnostic HUD in `AttendanceCheckInOutScreen` to record live inference latency on ARM64 NPU/CPU.
4. **Umeyama + ArcFace Embedding**: Measure frame transform and cosine matching time.
5. **Dynamic Liveness Challenge**: Perform head turns (`TURN_LEFT`, `TURN_RIGHT`) under direct sunlight and indoor LED lighting.
6. **Offline Sync Test**: Enable Airplane mode during check-in; verify encrypted SQLite write; disable Airplane mode; verify WorkManager HTTP 200 delivery.
