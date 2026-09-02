# Milestone 15: Unified Web & Android API Parity Matrix
## Authoritative FastAPI Endpoints & Shared Consumer Contracts

---

## 1. Core Platform API Matrix

| HTTP Method & Endpoint | Auth Required | Authorized Roles | Web Consumer | Android Consumer | Request Payload | Response Model |
|---|---|---|---|---|---|---|
| `POST /auth/login` | None | Public | `LoginPage.tsx` | `LoginScreen.kt` | `OAuth2PasswordRequestForm` | `TokenResponse` (`access_token`, `token_type`, `user`) |
| `GET /teacher/dashboard` | Bearer JWT | `teacher`, `hod`, `principal` | `DashboardPage.tsx` | `DashboardScreen.kt` | None | `DashboardSummaryDto` |
| `GET /teacher/timetable` | Bearer JWT | `teacher`, `hod`, `principal` | `TimetablePage.tsx` | `TimetableScreen.kt` | None | `List<TimetableSlotDto>` |
| `POST /teacher/leave` | Bearer JWT | `teacher`, `hod` | `ApplyLeavePage.tsx` | `ApplyLeaveScreen.kt` | `LeaveCreateRequestDto` | `LeaveRecordDto` |
| `GET /teacher/leave` | Bearer JWT | `teacher`, `hod` | `LeaveHistoryPage.tsx` | `LeaveHistoryScreen.kt` | None | `List<LeaveRecordDto>` |
| `GET /teacher/credits` | Bearer JWT | `teacher`, `hod` | `CreditsPage.tsx` | `CreditsScreen.kt` | None | `CreditsLedgerDto` |
| `GET /teacher/substitution`| Bearer JWT | `teacher`, `hod` | `SubstitutionPage.tsx` | `SubstitutionScreen.kt` | None | `List<SubstitutionAssignmentDto>` |
| `GET /preferences/` | Bearer JWT | `teacher`, `hod` | `PreferencesPage.tsx` | `PreferencesScreen.kt` | None | `SubstitutionPreferencesDto` |
| `PUT /preferences/` | Bearer JWT | `teacher`, `hod` | `PreferencesPage.tsx` | `PreferencesScreen.kt` | `PreferencesUpdateRequest` | `SubstitutionPreferencesDto` |
| `POST /attendance/check-in` | Bearer JWT | `teacher`, `staff`, `hod` | Fallback Form | `AttendanceCheckInOutScreen.kt` | `AttendanceCheckInRequestDto` | `AttendanceRecordOutDto` |
| `POST /attendance/check-out`| Bearer JWT | `teacher`, `staff`, `hod` | Fallback Form | `AttendanceCheckInOutScreen.kt` | `AttendanceCheckOutRequestDto` | `AttendanceRecordOutDto` |
| `GET /attendance/today` | Bearer JWT | All Staff | `AttendancePage.tsx` | `AttendanceScreen.kt` | None | `AttendanceTodaySummaryOutDto` |
| `GET /attendance/my` | Bearer JWT | All Staff | `AttendancePage.tsx` | `AttendanceHistoryScreen.kt` | Query `limit`, `offset` | `List<AttendanceRecordOutDto>` |
| `GET /attendance/admin/live-status` | Bearer JWT | `admin`, `principal`, `hod`, `manager` | `LiveAttendancePage.tsx` | Supervisor Dashboard | Query `date`, `department_id` | `SupervisorLiveStatusOutDto` |
| `GET /geofences/active` | Bearer JWT | All Staff | Map Component | `StaffLocationProvider.kt` | None | `List<GeofenceOutDto>` |
| `GET /geofences/` | Bearer JWT | `admin`, `principal`, `hod`, `manager` | `GeofenceAdminPage.tsx` | `GeofenceAdminScreen.kt` | None | `List<GeofenceOutDto>` |
| `POST /geofences/` | Bearer JWT | `admin`, `principal`, `hod`, `manager` | `GeofenceAdminPage.tsx` | `GeofenceAdminScreen.kt` | `GeofenceCreateDto` | `GeofenceOutDto` |
| `PUT /geofences/{id}` | Bearer JWT | `admin`, `principal`, `hod`, `manager` | `GeofenceAdminPage.tsx` | `GeofenceAdminScreen.kt` | `GeofenceUpdateDto` | `GeofenceOutDto` |
| `DELETE /geofences/{id}` | Bearer JWT | `admin`, `principal`, `hod`, `manager` | `GeofenceAdminPage.tsx` | `GeofenceAdminScreen.kt` | None | `{"message": "..."}` |
| `GET /notifications/` | Bearer JWT | All Staff | Notification Bell | `NotificationsScreen.kt` | Query `limit`, `offset` | `List<NotificationDto>` |
| `PUT /notifications/{id}/read` | Bearer JWT | All Staff | Notification Bell | `NotificationsScreen.kt` | None | `NotificationDto` |
