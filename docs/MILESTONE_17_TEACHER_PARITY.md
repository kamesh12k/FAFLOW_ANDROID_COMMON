# Milestone 17 — Teacher Mobile Parity Report
## FAFLOW Monorepo Canonical Certification

### 1. Executive Summary
Milestone 17 delivers complete functional parity between the original FAFLOW Web application and the native FAFLOW Android mobile application for the **Teacher / Faculty** role. All faculty workflows, calendar interactions, timetable inquiries, leave submissions, credit ledger reviews, substitution duty tracking, biometric verification, and institutional notifications are now accessible natively on Android with 100% backend API alignment.

---

### 2. Feature-by-Feature Parity Matrix

| Feature Domain | Web Reference Route / Component | Android Mobile Implementation | Backend Endpoint(s) | Parity Status |
|---|---|---|---|---|
| **Authentication & Profile** | `/login`, `/profile` | `LoginScreen.kt`, `ProfileScreen.kt` | `POST /auth/login`, `GET /auth/me` | **100% Complete** |
| **Faculty Dashboard** | `/dashboard` (Faculty) | `DashboardScreen.kt` | `GET /academic-calendar/my-today-summary`, `GET /timetable/teacher/{id}`, `GET /teachers/{id}/credits` | **100% Complete** |
| **Academic Calendar & Day Order** | `TodaySummaryCard`, `DayOrderBadge` | `DayOrderBadge.kt`, `TeacherTodaySummaryDto` | `GET /academic-calendar/my-today-summary`, `GET /academic-calendar/resolve` | **100% Complete** |
| **Teacher Timetable** | `/timetable` (My Schedule) | `TimetableScreen.kt` | `GET /timetable/teacher/{id}` | **100% Complete** |
| **Class Timetable** | `/timetable` (Class Filter) | `ClasswiseTimetableScreen.kt` | `GET /classes/`, `GET /timetable/?class_id={id}&day_order={do}` | **100% Complete** |
| **Apply Leave** | `/leaves/apply` | `ApplyLeaveScreen.kt` | `POST /leaves/`, `POST /leaves/batch` | **100% Complete** |
| **Leave History & Cancellation** | `/leaves` (My Leaves) | `LeaveHistoryScreen.kt` | `GET /leaves/my`, `DELETE /leaves/{id}` | **100% Complete** |
| **Casual Leave Credits** | `/credits` | `CreditsScreen.kt` | `GET /teachers/{id}/credits`, `GET /credits/my/transactions` | **100% Complete** |
| **Substitution Duties** | `/substitutions` | `SubstitutionScreen.kt`, `TodayCoverageScreen.kt` | `GET /teacher/substitution/my-duties`, `GET /substitutions/today` | **100% Complete** |
| **Substitution Preferences** | `/preferences` | `PreferencesScreen.kt` | `GET /teacher/substitution/my-preferences`, `PUT /teacher/substitution/my-preferences` | **100% Complete** |
| **Biometric Attendance** | Staff Mobile Camera + GPS | `AttendanceCheckInOutScreen.kt`, `AttendanceHistoryScreen.kt` | `POST /attendance/check-in`, `POST /attendance/check-out`, `GET /attendance/my` | **100% Complete** |
| **Face Enrollment & Update** | Profile > Face Enrollment | `FaceEnrollmentScreen.kt` | `GET /system/institutions/{id}/policy`, `POST /attendance/enroll-face` | **100% Complete (Policy Gated)** |
| **Notification Center** | `/notifications` | `NotificationsScreen.kt` | `GET /notifications/`, `GET /notifications/unread-count`, `PATCH /notifications/{id}/read` | **100% Complete** |

---

### 3. Architecture & Separation of Concerns
1. **Zero Redundant Business Logic**: Android acts exclusively as a secure client consuming authoritative FastAPI endpoints.
2. **Offline Resilience**: Biometric attendance records are captured and queued offline in Room DB (`pending_attendance`) with background sync via WorkManager when connectivity resumes.
3. **Institutional UI System**: Built using Jetpack Compose, Material 3, and institutional tokens (`FaflowSpacing`, `FaflowShapes`, `FaflowStatusColors`, `FaflowRoleColors`).
