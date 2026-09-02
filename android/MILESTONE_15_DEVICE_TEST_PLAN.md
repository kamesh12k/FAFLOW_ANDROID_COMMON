# Milestone 15: Android 16 / 16 KB Page-Size Device Verification Plan
## Testing Protocol on Android 15/16 16 KB Handset & Emulator

---

## 1. Emulator / Handset Environment Verification
Run via ADB:
```bash
adb shell getconf PAGE_SIZE
```
- **Expected Return**: `16384` (Confirms active 16 KB memory kernel page size).

---

## 2. 20-Point Operational Verification Steps

1. **APK Installation**: Install generated APK via `adb install app-debug.apk`.
2. **Compatibility Alert Check**: Verify Android OS does NOT crash with `LOAD segment alignment check failed`.
3. **Application Startup**: Verify cold launch transitions seamlessly to `LoginScreen`.
4. **Staff Authentication**: Submit credentials; verify JWT storage in hardware KeyStore.
5. **Dashboard Rendering**: Verify real-time cards (classes, leaves, duty credits) populate.
6. **Timetable Schedule**: Verify 6-day Day Order calendar displays schedule slots.
7. **Leave Submission**: Test period/full-day leave application with auto-substitution.
8. **Campus Geofence Map**: Open Geofence Admin canvas; test circular radius and polygon vertices.
9. **GPS Verification**: Verify FusedLocationProviderClient acquires high-accuracy fix.
10. **CameraX Initialization**: Open Attendance screen; verify front-camera preview starts.
11. **SCRFD 500M Inference**: Verify bounding box detection and 5-point facial landmarks.
12. **Umeyama Alignment**: Verify $112 \times 112$ canonical face normalization.
13. **ArcFace Embedding**: Verify 512-D floating-point feature vector generation.
14. **Active Liveness Challenge**: Perform head pose turns (`TURN_LEFT`, `TURN_RIGHT`).
15. **Attendance Check-In**: Complete verified shift check-in; confirm receipt rendered.
16. **Attendance Check-Out**: Complete verified shift check-out; confirm duration computed.
17. **Backend Ledger Parity**: Verify database reflects shift records.
18. **Offline Queue Sync**: Toggle Airplane mode during check-in; re-enable; verify WorkManager sync.
19. **Supervisor Live Status**: Verify supervisor dashboard reflects active staff count.
20. **Zero Native Crash**: Confirm zero SIGSEGV or native memory aborts in Logcat.
