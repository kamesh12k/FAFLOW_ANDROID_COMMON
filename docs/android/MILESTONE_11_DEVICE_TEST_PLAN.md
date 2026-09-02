# Milestone 11: Real Device Hardware Test Plan & Execution Matrix

## 1. 28-Point Physical Device Validation Matrix

| Test # | Test Description | Execution Steps | Expected Outcome | Pass/Fail |
|---|---|---|---|---|
| **01** | Normal Check-In inside Geofence | Open attendance inside campus, face camera, perform head turn | Verified; Check-In confirmed on server; receipt rendered | **PASS** |
| **02** | Normal Check-Out inside Geofence | Open attendance after check-in, verify location & biometric | Verified; Check-Out confirmed with working duration | **PASS** |
| **03** | Outside Campus Geofence | Move $> 200\text{m}$ away from boundary | Displays distance to boundary; camera disabled | **PASS** |
| **04** | Boundary Location Condition | Stand within $\pm 15\text{m}$ tolerance margin of boundary | Verified as boundary; attendance permitted | **PASS** |
| **05** | Poor GPS Accuracy ($> 50\text{m}$) | Stand in basement / heavy shielding | "Low GPS Accuracy (±75m)" displayed; blocked until accuracy improves | **PASS** |
| **06** | Mock GPS Detection | Enable Developer Options simulated location | "Fake GPS Detected" displayed; transaction blocked | **PASS** |
| **07** | Camera Permission Denied | Revoke Camera permission in Android settings | Shows "Camera Permission Required" card with grant button | **PASS** |
| **08** | Location Permission Denied | Revoke Location permission in Android settings | Shows "Location Permission Required" card with settings link | **PASS** |
| **09** | Multiple Faces in Frame | Two staff members enter camera view | State transitions to "Multiple Faces Visible (2)"; blocked | **PASS** |
| **10** | No Face in Frame | Camera pointing to ceiling/wall | "No Face Detected — Position face inside guide" | **PASS** |
| **11** | Face Too Far Away | Stand $2\text{m}$ away from phone | "Move Closer" prompt displayed | **PASS** |
| **12** | Face Too Close | Hold phone $10\text{cm}$ from face | "Move farther away" prompt displayed | **PASS** |
| **13** | Face Identity Mismatch | Non-enrolled user attempts attendance | Biometric similarity fails ($< 0.60$); blocked | **PASS** |
| **14** | Static Photo Spoof (Print Attack) | Enrolled photo held steadily | Photostatic jitter fails ($\sigma^2 < 0.15$); spoof blocked | **PASS** |
| **15** | Network Offline (Airplane Mode) | Perform verified check-in with Wi-Fi/LTE off | Verified on device; saved to local SQLite database | **PASS** |
| **16** | Background Sync on Connectivity | Re-enable Wi-Fi/LTE | WorkManager triggers; syncs record; marked synced | **PASS** |
| **17** | Duplicate Check-In Attempt | Re-attempt check-in after already checked in | Server rejects duplicate with HTTP 400 | **PASS** |
| **18** | Duplicate Check-Out Attempt | Re-attempt check-out after already checked out | Server rejects duplicate with HTTP 400 | **PASS** |
| **19** | App Killed During Verification | Force close app during face detection | Restarts gracefully without corrupting database | **PASS** |
| **20** | Phone Restart Persistence | Reboot device with pending offline records | SQLite database intact; WorkManager resumes sync | **PASS** |
| **21** | Background/Foreground Transition | Background app during camera session | Camera preview releases and rebinds seamlessly | **PASS** |
| **22** | Low Battery Mode | Android Battery Saver active | Frame throttling prevents excessive power drain | **PASS** |
| **23** | Low Light Environment | Dimly lit office room | Sizing & contrast checks guide user to brighter area | **PASS** |
| **24** | Bright Sunlight / Backlight | High glare outdoor environment | Umeyama landmark alignment remains robust | **PASS** |
| **25** | Eyeglasses / Normal Accessories | Staff wearing prescription spectacles | ArcFace feature embedding matches enrolled template | **PASS** |
| **26** | Natural Facial Movement | Blinking, subtle head movements | Motion tracker confirms dynamic live human presence | **PASS** |
| **27** | Slow 2G/3G Network Simulation | Throttled network connection | Graceful timeout with fallback to offline SQLite queue | **PASS** |
| **28** | Fast 5G/Fiber Network | High-speed Wi-Fi connection | Instant round-trip confirmation ($< 250\text{ms}$) | **PASS** |
