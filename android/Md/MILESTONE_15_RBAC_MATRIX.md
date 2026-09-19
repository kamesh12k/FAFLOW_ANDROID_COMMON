# Milestone 15: Unified RBAC & Permission Matrix
## Cross-Platform Role Enforcement (Web & Android)

---

## 1. Role Definitions & Institutional Hierarchy

- **`ADMIN` / `SUPER_ADMIN`**: Full institutional control, user provisioning, system configuration, audit log inspection, geofence management.
- **`PRINCIPAL`**: College-wide operational visibility, leave approval escalation, timetable and substitution inspection, supervisor live attendance.
- **`HOD` (Head of Department)**: Departmental leave approvals, teacher substitution overrides, department timetable management, departmental live attendance.
- **`MANAGER`**: Campus operations oversight, facility management, geofence configuration.
- **`TEACHER` / `FACULTY` / `STAFF`**: Personal timetable, personal attendance check-in/out, leave application, duty credit tracking, substitution preferences.

---

## 2. Granular Permission Matrix

| Capability / Module | Role: ADMIN | Role: PRINCIPAL | Role: HOD | Role: MANAGER | Role: TEACHER / STAFF |
|---|---|---|---|---|---|
| **Dashboard** | View (Global) | View (Global) | View (Dept) | View (Campus) | View (Self) |
| **Timetable Schedule** | View / Edit (All) | View (All) | View / Edit (Dept) | View (All) | View (Self) |
| **Personal Attendance** | View / Check-In | View / Check-In | View / Check-In | View / Check-In | View / Check-In (Self) |
| **Live Attendance Status**| View (Global) | View (Global) | View (Dept Only)| View (Campus) | **FORBIDDEN (403)** |
| **Apply Leave** | Create (Self) | Create (Self) | Create (Self) | Create (Self) | Create (Self) |
| **Approve / Reject Leave**| Approve (All) | Approve (All) | Approve (Dept) | **FORBIDDEN** | **FORBIDDEN (403)** |
| **Duty Credits Ledger** | View / Edit (All) | View (All) | View (Dept) | View (Campus) | View (Self) |
| **Substitution Allocation**| View / Assign (All)| View (All) | View / Assign (Dept)| View (All) | View (Self Duties) |
| **Campus Geofences** | View / Create / Edit | View / Create / Edit | View (Dept) | View / Create / Edit | View Active (For GPS) |
| **User & Staff Accounts** | Create / Edit / Delete| View | View (Dept) | View | View (Self Profile) |
| **System Audit Logs** | View / Export | View | **FORBIDDEN** | **FORBIDDEN** | **FORBIDDEN (403)** |
