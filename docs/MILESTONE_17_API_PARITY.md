# Milestone 17 — API Parity Specification

### 1. API Contract Verification

All mobile operations consume authoritative backend endpoints directly without any duplicate route definitions or client-side bypasses.

| Module | HTTP Method | Route URL | Request Body | Response Schema | Auth Required |
|---|---|---|---|---|---|
| **Auth** | `POST` | `/auth/login` | `UserLoginRequestDto` | `TokenDto` | Public |
| **Auth** | `GET` | `/auth/me` | None | `UserOutDto` | Bearer Token |
| **Calendar** | `GET` | `/academic-calendar/my-today-summary` | None | `TeacherTodaySummaryDto` | Teacher/Admin |
| **Calendar** | `GET` | `/academic-calendar/resolve` | `date` Query | `DayOrderResolveDto` | Bearer Token |
| **Timetable** | `GET` | `/timetable/teacher/{id}` | None | `List<TimetableSlotOutDto>` | Bearer Token |
| **Timetable** | `GET` | `/timetable/` | `class_id`, `day_order`, `department_id` Query | `List<TimetableSlotOutDto>` | Bearer Token |
| **Classes** | `GET` | `/classes/` | `department_id` Query | `List<ClassOutDto>` | Bearer Token |
| **Teachers** | `GET` | `/teachers/` | `department_id` Query | `List<TeacherOutDto>` | Bearer Token |
| **Leaves** | `GET` | `/leaves/my` | `include_expired` Query | `List<LeaveOutDto>` | Teacher |
| **Leaves** | `GET` | `/leaves/` | None | `List<LeaveOutDto>` | Admin / HOD |
| **Leaves** | `POST` | `/leaves/` | `LeaveCreateDto` | `LeaveOutDto` | Teacher |
| **Leaves** | `POST` | `/leaves/batch` | `LeaveBatchCreateDto` | `List<LeaveOutDto>` | Teacher |
| **Leaves** | `DELETE` | `/leaves/{id}` | None | 204 No Content | Teacher (Owner) |
| **Leaves** | `PATCH` | `/leaves/{id}/approve` | None | `LeaveApproveResponseDto` | Admin / HOD |
| **Leaves** | `PATCH` | `/leaves/{id}/reject` | None | `LeaveOutDto` | Admin / HOD |
| **Leaves** | `POST` | `/leaves/{id}/assign` | `LeaveAlterAssignmentCreateDto` | `AlterAssignmentOutDto` | Admin / HOD |
| **Substitutions**| `GET` | `/substitutions/today` | `date` Query | `TodaySubstitutionCoverageDto` | Bearer Token |
| **Substitutions**| `GET` | `/teacher/substitution/my-duties` | None | `List<SubstituteDutyDto>` | Teacher |
| **Substitutions**| `GET` | `/teacher/substitution/my-preferences`| None | `SubstitutionPreferenceOutDto`| Teacher |
| **Substitutions**| `PUT` | `/teacher/substitution/my-preferences`| `SubstitutionPreferenceUpdateDto`| `SubstitutionPreferenceOutDto`| Teacher |
| **Credits** | `GET` | `/teachers/{id}/credits` | None | `CreditBalanceOutDto` | Bearer Token |
| **Credits** | `GET` | `/credits/my/transactions` | None | `List<CreditTransactionOutDto>` | Teacher |
| **Notifications**| `GET` | `/notifications/` | `unread_only` Query | `List<NotificationOutDto>` | Bearer Token |
| **Notifications**| `GET` | `/notifications/unread-count` | None | `UnreadCountDto` | Bearer Token |
| **Notifications**| `PATCH` | `/notifications/{id}/read` | None | `StatusOkDto` | Bearer Token |
| **Attendance** | `POST` | `/attendance/check-in` | `AttendanceCheckInRequestDto` | `AttendanceRecordOutDto` | Bearer Token |
| **Attendance** | `POST` | `/attendance/check-out` | `AttendanceCheckOutRequestDto`| `AttendanceRecordOutDto` | Bearer Token |
| **Attendance** | `GET` | `/attendance/my` | `limit`, `offset` Query | `List<AttendanceRecordOutDto>` | Bearer Token |
| **Attendance** | `GET` | `/attendance/admin/live-status` | `date`, `department_id` Query | `SupervisorLiveStatusOutDto` | Admin / HOD |
| **Policy** | `GET` | `/system/institutions/{id}/policy` | None | `InstitutionPolicyDto` | Bearer Token |
