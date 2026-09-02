# Milestone 17: Mobile API Coverage & Contract Specification

> Authoritative Backend API mapping for FAFLOW Teacher and HOD Mobile Applications  
> Base URL: `/` (Relative to backend host)  
> Authentication: HTTP Authorization Bearer JWT Token  
> Status: **100% COMPLETE — ZERO MISSING MOBILE APIS**

---

## 1. Authentication & System Policy

| Feature | Role | Endpoint | Method | Request Payload | Response Model | Auth | Offline Support |
|---|---|---|---|---|---|---|---|
| User Login | All | `/auth/login` | POST | `username_or_email`, `password` | `access_token`, `token_type`, `user` object | Public | No |
| Current User Info | All | `/teachers/me` | GET | None | `UserOut` (id, name, email, department, role) | Bearer | Yes (Cached) |
| Authoritative Policy | All | `/system/institutions/{id}/policy` | GET | None | `PolicyOut` (`face_enrollment_allowed`, `biometric_attendance_enabled`, etc.) | Bearer | Yes (Fallback to disabled) |

---

## 2. Teacher Mobile APIs

| Feature | Endpoint | Method | Request | Response | Auth | Offline | Error Handling |
|---|---|---|---|---|---|---|---|
| **Today Summary** | `/academic-calendar/today-summary` | GET | None | `TodaySummaryOut` (`date`, `day_type`, `day_order`, `blocks_operations`) | Bearer | Yes (Cached) | Fallback to current calendar day |
| **My Schedule** | `/timetable/my-schedule` | GET | None | `List[TimetableSlotOut]` | Bearer | Yes (Room DB) | Show cached timetable |
| **Apply Leave** | `/leaves/apply` | POST | `LeaveCreate` (`date`, `period_number`, `reason`, `whole_day`) | `LeaveOut` | Bearer (Teacher) | Queueable | 400 validation error banner |
| **Cancel Leave** | `/leaves/{id}/cancel` | DELETE | None | `{"ok": true}` | Bearer (Teacher) | No | 400/404 error dialog |
| **My Leaves** | `/leaves/my-history` | GET | `limit`, `offset` | `List[LeaveOut]` | Bearer (Teacher) | Yes (Cached) | Display cached history |
| **My Credits** | `/credits/me` | GET | None | `TeacherCreditSummaryOut` (`balance`, `transactions`) | Bearer (Teacher) | Yes (Cached) | Display cached balance |
| **Pending Substitutions** | `/substitutions/my-pending` | GET | None | `List[AlterAssignmentOut]` | Bearer (Teacher) | Yes (Cached) | Retry on network reconnect |
| **Accept Substitution** | `/substitutions/{id}/accept` | POST | None | `AlterAssignmentOut` | Bearer (Teacher) | No | 400 cutoff / conflict error |
| **Decline Substitution** | `/substitutions/{id}/decline` | POST | None | `AlterAssignmentOut` | Bearer (Teacher) | No | 400 cutoff error |
| **Substitution Preferences**| `/teachers/me/preferences` | GET / PUT | `PreferencesUpdate` | `PreferencesOut` | Bearer (Teacher) | Yes (Cached) | Validation toast |
| **Today's Coverage** | `/substitutions/today` | GET | `date` | `TodaySubstitutionsOut` | Bearer | Yes (Cached) | Show coverage summary |
| **Class Timetable** | `/timetable/` | GET | `class_id`, `day_order` | `List[TimetableSlotOut]` | Bearer | Yes (Cached) | Empty schedule message |
| **Check-In** | `/attendance/check-in` | POST | `StaffAttendanceCreate` (`face_embedding`, `latitude`, `longitude`, `liveness_score`) | `StaffAttendanceOut` | Bearer (Staff) | Yes (Local SQLite Queue) | Geofence / Face match error |
| **Check-Out** | `/attendance/check-out` | POST | `StaffAttendanceCreate` | `StaffAttendanceOut` | Bearer (Staff) | Yes (Local SQLite Queue) | Geofence / Face match error |
| **Today Attendance** | `/attendance/today` | GET | None | `StaffAttendanceOut` | Bearer (Staff) | Yes (Cached) | Show "Not Checked In" |
| **Attendance History** | `/attendance/my-history` | GET | `limit`, `offset` | `List[StaffAttendanceOut]` | Bearer (Staff) | Yes (Cached) | Show cached punches |
| **Notifications** | `/notifications/` | GET | None | `List[NotificationOut]` | Bearer | Yes (Cached) | Show cached list |
| **Mark Notification** | `/notifications/{id}/read`| PATCH | None | `NotificationOut` | Bearer | No | Optimistic UI update |

---

## 3. HOD Mobile APIs

| Feature | Endpoint | Method | Request | Response | Auth | Offline | Error Handling |
|---|---|---|---|---|---|---|---|
| **Department Overview** | `/academic-calendar/today-summary` | GET | None | `TodaySummaryOut` (`teachers_on_leave`, `pending_leave_count`, `day_order`) | Bearer (Admin/HOD) | Yes (Cached) | Fallback to cached summary |
| **Department Teachers** | `/teachers/` | GET | None | `List[TeacherSummaryOut]` (scoped to HOD department) | Bearer (Admin/HOD) | Yes (Cached) | Show cached faculty list |
| **Department Timetable**| `/timetable/` | GET | `department_id`, `day_order` | `List[TimetableSlotOut]` | Bearer (Admin/HOD) | Yes (Cached) | Show cached department timetable |
| **Pending Leaves** | `/leaves/` | GET | `status=pending` | `List[LeaveOut]` (scoped to HOD department) | Bearer (Admin/HOD) | Yes (Cached) | Show pending requests |
| **Approve Leave** | `/leaves/{id}/approve` | PUT | `remarks` | `LeaveOut` | Bearer (Admin/HOD) | No | 400 conflict / cutoff error |
| **Reject Leave** | `/leaves/{id}/reject` | PUT | `remarks` | `LeaveOut` | Bearer (Admin/HOD) | No | 400 error banner |
| **Assign Substitute** | `/leaves/{id}/assign-substitute` | POST | `substitute_teacher_id` | `AlterAssignmentOut` | Bearer (Admin/HOD) | No | 400 cutoff or unavailable error |
| **Live Department Attendance** | `/attendance/supervisor/live` | GET | None | `List[SupervisorAttendanceRecord]` (department scoped) | Bearer (Admin/HOD) | Yes (Cached) | Network retry banner |
| **Department Credits** | `/credits/` | GET | None | `List[TeacherCreditSummaryOut]` | Bearer (Admin/HOD) | Yes (Cached) | Show credit balances |

---

## 4. Verification & Gap Assessment

- **Teacher Missing APIs**: **0** (All endpoints exist in backend routes `teachers.py`, `leaves.py`, `timetable.py`, `credits.py`, `substitutions.py`, `attendance.py`).
- **HOD Missing APIs**: **0** (All endpoints exist in `admin.py`, `leaves.py`, `timetable.py`, `academic_calendar.py`, `attendance.py`).
- **Authorization Verification**:
  - `require_teacher` dependency enforces Teacher route guards.
  - `require_admin` dependency enforces Department Admin (HOD) route guards, restricting visibility to `tenant_department_id`.
  - Non-HOD users attempting HOD-only actions receive HTTP 403 Forbidden.
