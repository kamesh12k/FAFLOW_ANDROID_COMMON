# Milestone 18 — Physical Device Regression & Certification Report

### 1. Regression Execution Scope
The modernized FAFLOW Staff Mobile application was certified across 22 operational workflows on physical hardware (Android 14/15/16):

---

### 2. 22-Point Regression Checklist

| # | Test Scenario | Verified Behavior | Status |
|---|---|---|---|
| 1 | APK Installation | Clean install of `app-debug.apk` without packaging errors | **PASS** |
| 2 | Application Launch | Immediate splash transition with credential/session check | **PASS** |
| 3 | Teacher Login | Authenticates with JWT token and loads Teacher Scaffold | **PASS** |
| 4 | HOD Login | Authenticates and loads dedicated HOD Scaffold | **PASS** |
| 5 | Role-Specific Navigation | Teacher gets 4 tabs (`Home`, `Timetable`, `Attendance`, `More`), HOD gets 5 tabs (`Overview`, `Leaves`, `Timetable`, `Attendance`, `More`) | **PASS** |
| 6 | No System Admin UI | Zero governance or geofence administration screens on mobile | **PASS** |
| 7 | Dashboard Operations | Today summary, Day Order pill, upcoming classes, credit balance | **PASS** |
| 8 | Timetable Inquiries | Teacher personal timetable + Classwise schedule matrix | **PASS** |
| 9 | Leave Application | Single period and whole-day batch leave submissions | **PASS** |
| 10 | Leave History & Cancellation | Full leave ledger with cancel pending leave action | **PASS** |
| 11 | Casual Leave Credits | Credit balance ledger and transaction history | **PASS** |
| 12 | Substitution Workflow | Assigned duties tracking + Today's slot coverage status | **PASS** |
| 13 | Notification Center | Unread badges, read/unread status updates | **PASS** |
| 14 | Staff Profile | Profile details, department affiliation, password update | **PASS** |
| 15 | Biometric Attendance | GPS coordinates, accuracy threshold, and geofence check | **PASS** |
| 16 | GPS & Geofence | Circle & polygon geofence validation with tolerance | **PASS** |
| 17 | Face Biometrics | Frontal face validation, Umeyama alignment, ArcFace embedding | **PASS** |
| 18 | Face Enrollment Gating | Gated by effective server policy (`GET /system/institutions/{id}/policy`)| **PASS** |
| 19 | Offline Queue | Punches stored in Room DB when disconnected | **PASS** |
| 20 | WorkManager Background Sync | Auto-syncs pending records upon network reconnection | **PASS** |
| 21 | Session Expiry & Logout | Safe session clearing and navigation back to Login | **PASS** |
| 22 | Android Studio Inspection | Clean layout inspection without Compose UI crashes | **PASS** |
