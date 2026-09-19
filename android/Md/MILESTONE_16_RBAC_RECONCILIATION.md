# Milestone 16: RBAC Reconciliation

> Original FAFLOW Roles vs M9–M16 Role Additions

---

## 1. Role Registry (Final Unified State)

| Role | Source | Level | Department Scope | Notes |
|---|---|---|---|---|
| `system_admin` | **M16** | L0 — Platform | None (cross-institution) | HIGHEST AUTHORITY. Controls feature licensing, geofence mutations, biometric policy |
| `governance` | Original FAFLOW | L1 — Institution | None | Cross-institution oversight. Read-only on admin records |
| `principal` | Original FAFLOW | L2 — Institution | None | Institution-wide view. Read-only on admin records |
| `admin` (super_admin) | Original FAFLOW | L3 — Institution | Optional | Institution administrator. Cannot mutate geofences (M16 security change) |
| `admin` (secondary_admin) | Original FAFLOW | L3 — Department | department_id | Department administrator |
| `manager` | Original FAFLOW | L4 — Campus | Optional dept | Campus operations management |
| `teacher` | Original FAFLOW | L5 — Department | department_id | Faculty/teaching staff |
| `lab_staff` | **M9–M16** | L5 — Department/Campus | Optional | Laboratory staff; similar to teacher for attendance |
| `non_teaching_staff` | **M9–M16** | L5 — Department/Campus | Optional | Administrative/clerical staff |

---

## 2. Admin Level (Sub-role)

| AdminLevel | Applies To | Permissions |
|---|---|---|
| `super_admin` | `admin` role only | Institution-wide admin access |
| `secondary_admin` | `admin` role only | Department-scoped admin access |

---

## 3. Governance Level 0 vs Level 1 Separation

### LEVEL 0: SYSTEM_ADMIN (Governance/Platform Layer)

| Permission | System Admin | Any Other Role |
|---|---|---|
| Create geofence | ✅ | ❌ 403 |
| Update geofence | ✅ | ❌ 403 |
| Delete/toggle geofence | ✅ | ❌ 403 |
| Create institution | ✅ | ❌ 403 |
| Assign subscription plan | ✅ | ❌ 403 |
| Enable/disable feature | ✅ | ❌ 403 |
| Lock/unlock feature | ✅ | ❌ 403 |
| Set biometric enrollment policy | ✅ | ❌ 403 |
| View system audit logs | ✅ | ❌ 403 |
| View governance dashboard | ✅ | ❌ 403 |

### LEVEL 1: INSTITUTION ADMIN (FAFLOW Admin Layer)

| Permission | Admin (super) | Admin (secondary) | Principal | Governance |
|---|---|---|---|---|
| Create teacher | ✅ | ✅ (dept only) | ❌ | ❌ |
| Delete teacher | ✅ | ✅ (dept only) | ❌ | ❌ |
| Approve/reject leave | ✅ | ✅ (dept only) | ❌ | ❌ |
| Manage timetable | ✅ | ✅ (dept only) | ❌ | ❌ |
| View all leaves | ✅ | ✅ (dept only) | ✅ (read) | ✅ (read) |
| Emergency override (substitution) | ✅ | ❌ | ❌ | ✅ |
| Create/assign substitution | ✅ | ✅ (dept only) | ❌ | ✅ |
| Academic calendar management | ✅ | ❌ | ❌ | ❌ |
| View attendance (supervisor) | ✅ | ✅ (dept only) | ✅ (read) | ✅ |
| Read geofence list | ✅ | ✅ | ✅ | ✅ |

---

## 4. Attendance Permissions

| Role | Check-in (Biometric) | Check-out | View own history | Supervisor live view |
|---|---|---|---|---|
| `teacher` | ✅ | ✅ | ✅ | ❌ |
| `lab_staff` | ✅ | ✅ | ✅ | ❌ |
| `non_teaching_staff` | ✅ | ✅ | ✅ | ❌ |
| `admin` | ✅ | ✅ | ✅ | ✅ (dept/all) |
| `manager` | ✅ | ✅ | ✅ | ✅ |
| `principal` | ✅ | ✅ | ✅ | ✅ (read-only) |
| `governance` | ✅ | ✅ | ✅ | ✅ |
| `system_admin` | ✅ | ✅ | ✅ | ✅ |

---

## 5. Face Enrollment Policy (Controlled by SYSTEM_ADMIN)

| Policy Setting | Who Sets It | Who Is Affected |
|---|---|---|
| `allow_face_enrollment` | SYSTEM_ADMIN | All staff of institution |
| `allow_face_enrollment_update` | SYSTEM_ADMIN | All staff of institution |
| `allow_face_reenrollment` | SYSTEM_ADMIN | All staff of institution |
| `require_admin_approval_for_enrollment` | SYSTEM_ADMIN | Requires institution admin approval |

> **Backend enforcement**: Every `/attendance/check-in` must verify `GET /system/institutions/{id}/policy` before accepting biometric data.
> **Client enforcement**: Android and Web block enrollment UI when policy is DISABLED.
> **Override rule**: No client-side flag can override server-authoritative policy.

---

## 6. Original FAFLOW Roles Preserved

| Original Role | M9–M16 Changed? | Notes |
|---|---|---|
| `admin` | Role unchanged, geofence mutation removed | Previously could mutate geofences; now SYSTEM_ADMIN only |
| `teacher` | Unchanged | |
| `principal` | Unchanged | |
| `governance` | Unchanged | |
| `manager` | Unchanged | |
