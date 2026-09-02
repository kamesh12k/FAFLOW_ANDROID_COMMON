# Milestone 10: Physical Android Device Verification Test Plan

## 1. Test Matrix for Real Hardware Execution

| Test ID | Test Scenario | Preconditions | Expected Behavior |
|---|---|---|---|
| **DEV-01** | Standard Check-In inside Geofence | Valid staff account, GPS enabled, inside campus | Face detected, identity matched ($\ge 0.60$), liveness challenge passed, `ReadyForCheckIn` displayed, check-in recorded on server. |
| **DEV-02** | Outside Campus Perimeter | Physical location $> 200\text{m}$ outside campus boundary | Geofence banner turns yellow/red; displays distance to nearest boundary; camera disabled with clear guidance. |
| **DEV-03** | Poor GPS Signal / Accuracy $> 50\text{m}$ | GPS indoors / metal roof shielding | State transitions to `PoorGpsAccuracy(accuracy)`; prevents attendance submission until accuracy improves. |
| **DEV-04** | Mock Location / Fake GPS App Active | Developer Options "Select mock location app" enabled | `MockLocationBlocked` displayed immediately; anti-spoofing alert triggered; transaction blocked. |
| **DEV-05** | Multiple Faces in Frame | Colleague steps into camera view | State immediately transitions to `MultipleFaces(2)`; prompts "Only one person should be visible". |
| **DEV-06** | Static Photo Presentation Attack | Enrolled staff photo held in front of camera | Photostatic jitter analyzer detects zero landmark variance; liveness fails; flags `SpoofSuspected(PRINT_ATTACK)`. |
| **DEV-07** | Active Liveness Challenge Execution | Front camera active, single face detected | Prompt displays dynamic challenge (e.g. "Turn head to the left"); progress indicator updates as yaw angle exceeds threshold. |
| **DEV-08** | Offline Shift Check-In | Airplane mode enabled inside campus | Verified on device; saved to local SQLite database; displays `SavedOffline("Check-in saved locally")`. |
| **DEV-09** | Background Sync on Network Restored | Airplane mode disabled; LTE/Wi-Fi connected | WorkManager `AttendanceSyncWorker` triggers automatically; transaction submitted to server; marked synced. |
| **DEV-10** | Shift Check-Out & Working Hours | Staff already checked in earlier today | Shows `ReadyForCheckOut`; records check-out time; calculates working duration (e.g. "8h 15m"). |
| **DEV-11** | Duplicate Check-In Protection | Rapid double tap on Confirm button | Idempotency key prevents second server record; UI displays existing confirmed receipt. |
| **DEV-12** | Attendance History & Refresh | Attendance records exist on backend | History list displays date, check-in, check-out, working hours, and sync badge. |
