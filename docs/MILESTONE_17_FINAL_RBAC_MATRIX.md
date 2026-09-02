# Milestone 17 — Definitive RBAC Permission Matrix

### 1. Canonical Roles
- `TEACHER` (`Role.teacher`): Faculty member.
- `HOD` (`Role.admin` + `AdminLevel.secondary_admin`): Head of Department. Scoped to assigned `department_id`.
- `PRINCIPAL` (`Role.admin` + `AdminLevel.super_admin`): College-wide academic administrator.
- `MANAGER` (`Role.manager`): Campus operations manager.
- `SYSTEM_ADMIN` (`Role.system_admin`): Governance / Platform Super Admin.

---

### 2. Cross-Role Permission Matrix

| Capability / Resource | TEACHER | HOD | PRINCIPAL | SYSTEM_ADMIN | Platform Availability |
|---|---|---|---|---|---|
| View My Timetable | ALLOWED | ALLOWED | ALLOWED | ALLOWED | Web + Mobile |
| View Class Timetable | ALLOWED | ALLOWED | ALLOWED | ALLOWED | Web + Mobile |
| View Department Timetable | ALLOWED | ALLOWED (Dept) | ALLOWED (All) | ALLOWED (All) | Web + Mobile |
| Apply Personal Leave | ALLOWED | ALLOWED | ALLOWED | N/A | Web + Mobile |
| Cancel Own Pending Leave | ALLOWED | ALLOWED | ALLOWED | N/A | Web + Mobile |
| Review Department Leaves | DENIED | ALLOWED (Dept) | ALLOWED (All) | ALLOWED (All) | Web + Mobile |
| Approve / Reject Leaves | DENIED | ALLOWED (Dept) | ALLOWED (All) | ALLOWED (All) | Web + Mobile |
| Assign Substitute for Leave | ALLOWED (If policy enabled)| ALLOWED (Dept) | ALLOWED (All) | ALLOWED (All) | Web + Mobile |
| View Assigned Duties | ALLOWED | ALLOWED | ALLOWED | ALLOWED | Web + Mobile |
| Update Substitution Prefs | ALLOWED | ALLOWED | ALLOWED | N/A | Web + Mobile |
| View Today's Slot Coverage | ALLOWED | ALLOWED (Dept) | ALLOWED (All) | ALLOWED (All) | Web + Mobile |
| View Credit Ledger | ALLOWED (Own) | ALLOWED (Dept) | ALLOWED (All) | ALLOWED (All) | Web + Mobile |
| Punch Biometric Attendance | ALLOWED | ALLOWED | ALLOWED | N/A | Mobile |
| View Live Supervisor Attendance | DENIED | ALLOWED (Dept) | ALLOWED (All) | ALLOWED (All) | Web + Mobile |
| Enroll Face Biometrics | ALLOWED (Policy Gated) | ALLOWED (Policy Gated) | ALLOWED (Policy Gated) | N/A | Mobile |
| Geofence Canvas Management | DENIED | DENIED | DENIED | ALLOWED | **WEB ONLY** |
| Governance Feature Controls | DENIED | DENIED | DENIED | ALLOWED | **WEB ONLY** |
| Tenant / Institution Admin | DENIED | DENIED | DENIED | ALLOWED | **WEB ONLY** |
| Database Backup & Cleanup | DENIED | DENIED | DENIED | ALLOWED | **WEB ONLY** |
