# Milestone 17: Mobile Feature Inventory & Functional Discovery
## Canonical FAFLOW Web Application to Native Android Mapping

> Source of Truth: `B:\FAFLOW_UNIFIED\frontend\src\` & `B:\FAFLOW_UNIFIED\backend\app\routes\`  
> Target Architecture: `B:\FAFLOW_UNIFIED\android` (Native Jetpack Compose)  
> Roles Covered: **TEACHER**, **HOD (Department Administrator)**, **COMMON**  
> Strictly Excluded: Platform System Admin, Platform Governance Control Plane, Server/DB Ops

---

## 1. Teacher Features

| Feature | Web Route | Web Component | Backend API | Role | Mobile Required | Mobile Screen | Mobile Actions | Status |
|---|---|---|---|---|---|---|---|---|
| **Teacher Dashboard** | `/teacher/dashboard` | `TeacherDashboard.jsx` | `GET /academic-calendar/today-summary`, `GET /timetable/my-schedule`, `GET /credits/me`, `GET /substitutions/my-pending` | Teacher | **YES** | `TeacherDashboardScreen.kt` | View day order, current/next class, instant check-in status, available CL balance, pending substitution banner | ✅ Implemented / Upgraded |
| **My Timetable** | `/teacher/timetable` | `MyTimetable.jsx` | `GET /timetable/my-schedule`, `GET /day-order/today` | Teacher | **YES** | `TimetableScreen.kt` | Filter by Day Order (DO1–DO6), view periods, subject, class, room, time slot | ✅ Implemented / Upgraded |
| **Class Timetable Lookup** | `/teacher/class-timetable` | `ClasswiseTimetable.jsx` | `GET /timetable/?class_id={id}` | Teacher / Common | **YES** | `ClasswiseTimetableScreen.kt` | Select class, inspect period-wise class schedule | 🆕 New Native Screen |
| **Apply Leave** | `/teacher/leave/apply` | `ApplyLeave.jsx` | `POST /leaves/apply`, `GET /academic-calendar/today-summary` | Teacher | **YES** | `ApplyLeaveScreen.kt` | Select date, full-day vs period selection, choose leave type, enter reason, submit | ✅ Implemented / Upgraded |
| **Leave History** | `/teacher/leaves` | `LeaveHistory.jsx` | `GET /leaves/my-history`, `DELETE /leaves/{id}/cancel` | Teacher | **YES** | `LeaveHistoryScreen.kt` | View all leave requests, filter by status (Pending, Approved, Rejected, Cancelled), cancel eligible pending leave | ✅ Implemented / Upgraded |
| **Casual Leave Credits** | `/teacher/credits` | `Credits.jsx` | `GET /credits/me` | Teacher | **YES** | `CreditsScreen.kt` | View total balance, monthly allocation, leave deductions, substitution compensation ledger | ✅ Implemented / Upgraded |
| **Substitution Requests** | `/teacher/substitution` | `TeacherSubstitution.jsx` | `GET /substitutions/my-pending`, `POST /substitutions/{id}/accept`, `POST /substitutions/{id}/decline` | Teacher | **YES** | `SubstitutionScreen.kt` | View assigned substitutions, inspect class/period/original teacher, accept or decline with notes | ✅ Implemented / Upgraded |
| **Today's Department Coverage** | `/teacher/today-coverage` | `TodaySubstitutions.jsx` | `GET /substitutions/today` | Teacher / Common | **YES** | `TodayCoverageScreen.kt` | View all department substitutions today, active substitutes, uncovered periods | 🆕 New Native Screen |
| **Substitution Preferences** | `/teacher/preferences` | `Preferences.jsx` | `GET /teachers/me/preferences`, `PUT /teachers/me/preferences` | Teacher | **YES** | `PreferencesScreen.kt` | Select preferred days/periods for substitution, toggle cross-department availability | ✅ Implemented / Upgraded |
| **Biometric Attendance** | N/A (Mobile Native) | N/A (Web is read-only) | `POST /attendance/check-in`, `POST /attendance/check-out`, `GET /attendance/today` | Teacher / Staff | **YES** | `AttendanceCheckInOutScreen.kt` | Geofence verification, CameraX SCRFD detection, ArcFace recognition, Anti-spoof liveness check | ✅ Preserved & Enhanced |
| **Attendance History** | N/A (Mobile Native) | N/A | `GET /attendance/my-history` | Teacher / Staff | **YES** | `AttendanceHistoryScreen.kt` | View personal daily punch records, verification score, geofence audit compliance | ✅ Preserved & Enhanced |
| **Guided Face Enrollment** | N/A (Mobile Native) | N/A | `GET /system/institutions/{id}/policy`, `POST /attendance/face-enrollment` | Teacher / Staff | **YES** | `FaceEnrollmentScreen.kt` | Server-gated enrollment wizard, distance/lighting feedback, 5-point landmark quality checks | ✅ Enhanced with Policy Gate |
| **Notifications Center** | In-app drawer | Navigation header | `GET /notifications/`, `PATCH /notifications/{id}/read` | Teacher / Common | **YES** | `NotificationsScreen.kt` | View alerts, unread counts, mark read, navigate to target event | ✅ Implemented / Upgraded |
| **Staff Profile** | Settings drawer | Profile modal | `GET /teachers/me` | Teacher / Common | **YES** | `ProfileScreen.kt` | View faculty ID, designation, department, email, device sync info | ✅ Implemented / Upgraded |

---

## 2. HOD (Department Administrator) Features

| Feature | Web Route | Web Component | Backend API | Role | Mobile Required | Mobile Screen | Mobile Actions | Status |
|---|---|---|---|---|---|---|---|---|
| **HOD Department Dashboard** | `/admin/dashboard` (HOD view) | `AdminDashboard.jsx` (HOD branch) | `GET /academic-calendar/today-summary`, `GET /teachers/`, `GET /leaves/?status=pending`, `GET /substitutions/today` | HOD | **YES** | `HodDashboardScreen.kt` | Department overview, faculty on leave count, periods needing sub, pending leave counter, upcoming holidays | 🆕 New Dedicated Screen |
| **Department Timetable** | `/admin/timetable`, `/governance/timetable` | `HodTimetable.jsx`, `Timetable.jsx` | `GET /timetable/`, `GET /teachers/` | HOD | **YES** | `HodDepartmentTimetableScreen.kt` | View department timetable by Day Order, filter by faculty or class, inspect room allocation | 🆕 New Dedicated Screen |
| **Department Leave Review** | `/admin/leaves` | `AdminLeaves.jsx` | `GET /leaves/?department_id={id}`, `PUT /leaves/{id}/approve`, `PUT /leaves/{id}/reject` | HOD | **YES** | `HodLeaveApprovalScreen.kt` | Inspect pending leave requests from department faculty, approve or reject with comments | 🆕 New Dedicated Screen |
| **Coverage & Substitution Assignment** | `/admin/today-substitutions` | `TodaySubstitutions.jsx` | `GET /substitutions/today`, `POST /leaves/{id}/assign-substitute` | HOD | **YES** | `HodCoverageScreen.kt` | View today's covered vs uncovered slots, assign available department faculty to open slots | 🆕 New Dedicated Screen |
| **Department Faculty Directory** | `/admin/teachers` | `Teachers.jsx` | `GET /teachers/` | HOD | **YES** | `HodFacultyDirectoryScreen.kt` | View department faculty list, designations, contact info, and current teaching assignments | 🆕 New Dedicated Screen |
| **Supervisor Live Attendance** | M9 Backend Extension | Supervisor Portal | `GET /attendance/supervisor/live` | HOD | **YES** | `HodAttendanceScreen.kt` | Live attendance stream of department faculty: who has checked in, timestamps, location compliance | 🆕 New Dedicated Screen |
| **Department Credit Ledger Review** | `/admin/credits` | `AdminCredits.jsx` | `GET /credits/?department_id={id}` | HOD | **YES** | Integrated in Faculty Directory / More | Inspect faculty leave credit balances & historical substitution compensations | 🆕 Integrated |

---

## 3. Common / System Support Features

| Feature | Purpose | Role | Mobile Screen | Status |
|---|---|---|---|---|
| **Authentication & Role Dispatch** | Decodes token & user role (`Role.teacher` vs `Role.admin` / HOD) to launch appropriate navigation shell | All | `LoginScreen.kt`, `SplashScreen.kt` | ✅ Enhanced |
| **First-Login Credential Setup** | Forces password change if default bootstrap credentials are active | All | `SettingsScreen.kt` / Setup Prompt | ✅ Preserved |
| **Offline Attendance Queue** | Caches punches offline; synchronizes via WorkManager when online | Teacher / HOD | `SyncStatusScreen.kt` | ✅ Preserved |
| **Network & Connectivity Monitor** | Real-time offline indicator banner across all screens | All | `OfflineBanner.kt` component | 🆕 Integrated |

---

## 4. Web-Only Features (Explicitly Excluded from Mobile)

| Feature | Web Route | Reason for Mobile Exclusion |
|---|---|---|
| **Platform System Admin Panel** | `/system/*`, `/admin/system-metrics` | Platform-level governance company functionality; prohibited on mobile client |
| **Global Feature Licensing** | `/system/institutions/{id}/features/*` | Platform-level commercial control plane |
| **Database Backup & Restore** | `/admin/backup` | Server infrastructure operations; inappropriate for mobile staff client |
| **Data Retention & Purge Policy** | `/admin/data-retention` | Server database maintenance |
| **Manager / Non-Teaching Staff Ops** | `/manager/*` | Distinct portal for non-academic facility management |
| **Campus Geofence Polygon Editor** | `/geofences/` (mutations) | Platform System Admin exclusive; graphical multi-point canvas requires desktop mouse accuracy |
