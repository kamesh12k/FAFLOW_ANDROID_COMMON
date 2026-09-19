# Milestone 13: Physical Device Certification & Hardware Test Matrix

## 1. Operating System & Compatibility Scope

| Android Version | API Level | Compatibility Status | Core Capabilities Verified |
|---|---|---|---|
| **Android 8.0 - 8.1** | API 26 - 27 | **SUPPORTED (MinSdk)** | CameraX, LocationServices, SQLite, KeyStore (AES-256-GCM) |
| **Android 9 - 10** | API 28 - 29 | **SUPPORTED** | Camera2 JNI, BiometricPrompt, WorkManager |
| **Android 11 - 12** | API 30 - 31 | **SUPPORTED** | One-time permissions, foreground service restrictions |
| **Android 13 - 14** | API 33 - 34 | **SUPPORTED (Target)** | Notification runtime permission, Photo Picker, ONNX Runtime Mobile |
| **Android 15 - 16** | API 35 - 37 | **SUPPORTED (CompileSdk 37)** | Edge-to-edge layout, predictive back gestures, 16KB page alignment |

---

## 2. 28-Point Physical Device Verification Matrix

| Test ID | Scenario | Procedure | Expected Physical Behavior | Automated Status | Physical Lab Status |
|---|---|---|---|---|---|
| **CERT-01** | Standard Shift Check-In | Open attendance within campus; face front camera; execute dynamic challenge | Face detected; 1:1 match confirmed ($\ge 0.60$); receipt rendered | **PASS** | Pending Lab Run |
| **CERT-02** | Standard Shift Check-Out | Open attendance after shift; verify biometric and campus location | Check-Out recorded on server; working duration displayed | **PASS** | Pending Lab Run |
| **CERT-03** | Outside Campus Perimeter | Attempt check-in $> 200\text{m}$ outside boundary | Shows distance to nearest boundary; camera disabled | **PASS** | Pending Lab Run |
| **CERT-04** | Boundary Margin Tolerance | Stand within $\pm 15\text{m}$ of geofence edge | Verified as boundary zone; check-in allowed | **PASS** | Pending Lab Run |
| **CERT-05** | GPS Indoors / Low Accuracy | Shielded room with GPS accuracy $> 50\text{m}$ | Displays "GPS Accuracy Low (±75m)"; prevents submission | **PASS** | Pending Lab Run |
| **CERT-06** | Mock Location / Fake GPS App | Developer Options mock location active | Anti-spoof engine flags `MockLocationBlocked`; blocks transaction | **PASS** | Pending Lab Run |
| **CERT-07** | Camera Permission Denied | Revoke CAMERA permission in App Info | Displays graceful "Camera Permission Required" card | **PASS** | Pending Lab Run |
| **CERT-08** | Location Permission Denied | Revoke FINE_LOCATION permission | Displays "Location Permission Required" with settings launcher | **PASS** | Pending Lab Run |
| **CERT-09** | Multiple People in Frame | Colleague stands next to user | Flags `MultipleFaces(2)`; prompts "Only one person visible" | **PASS** | Pending Lab Run |
| **CERT-10** | No Face Detected | Camera pointed at blank surface | Prompts "Position face inside guide"; camera idle | **PASS** | Pending Lab Run |
| **CERT-11** | Face Too Far Away | Stand $2.5\text{m}$ from device | Prompts "Move closer"; bounding box remains yellow | **PASS** | Pending Lab Run |
| **CERT-12** | Face Too Close | Hold phone $10\text{cm}$ from face | Prompts "Move farther away" | **PASS** | Pending Lab Run |
| **CERT-13** | Identity Mismatch | Non-enrolled staff attempts check-in | Cosine similarity $< 0.60$; displays "Biometric mismatch" | **PASS** | Pending Lab Run |
| **CERT-14** | Static 2D Photo Attack | High-res photo held steadily in front of lens | Photostatic jitter fails ($\sigma^2 < 0.15$); spoof alert triggered | **PASS** | Pending Lab Run |
| **CERT-15** | Video Screen Replay Attack | Tablet screen playing selfie video | Temporal challenge mismatch fails liveness verification | **PASS** | Pending Lab Run |
| **CERT-16** | Offline Check-In (Airplane Mode) | Perform verified check-in with Wi-Fi/LTE off | Verified locally; saved to encrypted SQLite queue | **PASS** | Pending Lab Run |
| **CERT-17** | Background Sync Restored | Re-enable Wi-Fi/LTE network | WorkManager `AttendanceSyncWorker` syncs record; marked Synced | **PASS** | Pending Lab Run |
| **CERT-18** | Duplicate Check-In Attempt | Submit check-in twice in same shift | Server returns HTTP 400 with duplicate error message | **PASS** | Pending Lab Run |
| **CERT-19** | Duplicate Check-Out Attempt | Submit check-out twice in same shift | Server returns HTTP 400 with duplicate error message | **PASS** | Pending Lab Run |
| **CERT-20** | App Force-Killed During Detection | Swipe away app while camera active | No camera lock retained; re-opens cleanly | **PASS** | Pending Lab Run |
| **CERT-21** | Device Reboot with Pending Sync | Restart phone with un-synced attendance | Encrypted SQLite records preserved; synced on boot | **PASS** | Pending Lab Run |
| **CERT-22** | App Background / Foreground | Switch apps during face verification | Camera session pauses and rebinds seamlessly | **PASS** | Pending Lab Run |
| **CERT-23** | Battery Saver Mode | Android OS Battery Saver enabled | Throttled frame acquisition prevents battery drain | **PASS** | Pending Lab Run |
| **CERT-24** | Dim Indoor Lighting | Ambient illumination $< 50\text{ lux}$ | Contrast analyzer prompts user to move to better lighting | **PASS** | Pending Lab Run |
| **CERT-25** | Direct Sunlight / Glare | Outdoor sunlight on camera lens | Umeyama 5-point landmark detector maintains alignment | **PASS** | Pending Lab Run |
| **CERT-26** | Prescription Eyeglasses | Faculty wearing reading glasses | ArcFace deep embeddings match enrolled profile | **PASS** | Pending Lab Run |
| **CERT-27** | Slow 2G / 3G Connection | Throttled cellular connection | Safe HTTP timeout ($\le 15\text{s}$) with fallback to offline queue | **PASS** | Pending Lab Run |
| **CERT-28** | Fast 5G / Fiber Wi-Fi | High-speed campus network | Sub-second round-trip ledger confirmation ($< 250\text{ms}$) | **PASS** | Pending Lab Run |
