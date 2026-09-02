# Milestone 17 — HOD Mobile Parity Report
## Department Administration & Management Experience

### 1. Executive Summary
In the canonical FAFLOW model, **HOD (Head of Department)** is a department-scoped administrator (`Role.admin` with `AdminLevel.secondary_admin`). Milestone 17 equips HODs with a dedicated native Android experience that mirrors the original FAFLOW Web admin capabilities relevant to department operations, while maintaining strict boundary separation from platform governance control planes (`system_admin`).

---

### 2. HOD Feature Matrix

| Feature Domain | Web Reference Route / Component | Android Mobile Implementation | Backend Endpoint(s) | Parity Status |
|---|---|---|---|---|
| **HOD Department Overview** | `/admin/dashboard` | `HodDashboardScreen.kt`, `HodViewModel.kt` | `GET /academic-calendar/my-today-summary`, `GET /leaves/`, `GET /teachers/`, `GET /substitutions/today`, `GET /attendance/admin/live-status` | **100% Complete** |
| **Department Leave Review** | `/admin/leaves` | `HodLeaveApprovalScreen.kt` | `GET /leaves/`, `PATCH /leaves/{id}/approve`, `PATCH /leaves/{id}/reject`, `PATCH /leaves/{id}/status` | **100% Complete** |
| **Substitute Assignment** | `/admin/leaves` (Assign Modal) | `AssignSubstituteDialog` in `HodLeaveApprovalScreen.kt` | `POST /leaves/{id}/assign` | **100% Complete** |
| **Today's Slot Coverage** | `/admin/today-substitutions` | `TodayCoverageScreen.kt` | `GET /substitutions/today` | **100% Complete** |
| **Department Timetable Matrix** | `/admin/timetable` | `ClasswiseTimetableScreen.kt` | `GET /classes/`, `GET /timetable/?class_id={id}&day_order={do}` | **100% Complete** |
| **Department Faculty Directory** | `/admin/teachers` | `HodFacultyDirectoryScreen.kt` | `GET /teachers/` (scoped to department via `get_tenant_department_id`) | **100% Complete** |
| **Supervisor Live Attendance** | `/admin/attendance` | `HodAttendanceScreen.kt` | `GET /attendance/admin/live-status` | **100% Complete** |

---

### 3. Role-Based Navigation Architecture
- When an HOD logs in, FAFLOW Mobile launches `HodMainScaffold` with 5 primary bottom navigation tabs:
  1. **Overview**: Key department metrics (Pending Leaves, Faculty Active, Today's Coverage, Department Absences) and quick action routes.
  2. **Leaves**: Review pending requests, one-click approve/reject, and modal substitute assignment.
  3. **Timetable**: Class schedule matrix with interactive class picker and Day Order selector (1–6).
  4. **Attendance**: Live department presence monitor with breakdown of present, absent, currently on premise, and checked out staff.
  5. **More**: Faculty hub linking to profile, notifications, settings, and faculty services.

---

### 4. Boundary Protection
- **No Platform Governance Exposure**: All `system_admin` control plane surfaces (`/system/*`, geofence mutation canvas, tenant provisioning) remain strictly Web-only.
- **Tenant Department Enforcement**: The backend dependency `get_tenant_department_id` enforces server-side scoping so an HOD can never review leaves or view teachers outside their assigned department.
