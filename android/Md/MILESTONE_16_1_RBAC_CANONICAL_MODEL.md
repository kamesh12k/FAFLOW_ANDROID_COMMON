# Milestone 16.1: Canonical RBAC Model & Authorization Architecture

> Authoritative Reference for FAFLOW Platform & Institution Access Control  
> Source of Truth: `B:\FAFLOW_UNIFIED\backend\app\models\user.py` & `app\core\dependencies.py`

---

## 1. The Core Principle: Platform vs Institution Separation

A frequent source of security ambiguity in multi-tenant architectures is conflating "Admin" with "System Admin". In FAFLOW:
- **"admin"** does **NOT** mean Platform Administrator. An `admin` is an institutional administrator whose authority is strictly confined to their college/institution (or department).
- **"system_admin"** is the **Platform-Level / Governance Super Administrator** who oversees tenants, licenses, and global policy.

```
═════════════════════════════════════════════════════════════════════════════════
LEVEL 0: PLATFORM CONTROL PLANE (Governance Company)
═════════════════════════════════════════════════════════════════════════════════
Role: system_admin
Scope: Cross-Institutional / Platform-Wide
Authority:
  • Institution lifecycle (create, suspend, activate, assign plans)
  • Feature licensing and entitlement locking (enable, disable, lock, unlock)
  • Institutional biometric enrollment policy configuration
  • Geofence definition authorization & mutations
  • Platform-wide metrics, traffic analytics, and immutable system audit logs

═════════════════════════════════════════════════════════════════════════════════
LEVEL 1: INSTITUTIONAL ADMINISTRATION (College Tier)
═════════════════════════════════════════════════════════════════════════════════
Roles:
  ├── admin (super_admin)     ── Institution-wide administrative operations
  ├── admin (secondary_admin) ── Department-scoped administrative operations
  ├── governance              ── Institutional board/auditor read-only oversight
  ├── principal               ── Institutional executive read-only & reports
  ├── manager                 ── Campus operations & operational staff management
  └── hod / teacher           ── Faculty & departmental operations
```

---

## 2. Canonical Role Definitions Across All Layers

| Role Identifier | Database Enum | JWT Role Claim | Android Role Model | Web Role Model | Domain Scope |
|---|---|---|---|---|---|
| `system_admin` | `user_role.system_admin` | `"system_admin"` | `Role.SYSTEM_ADMIN` | `"system_admin"` | Platform / All Institutions |
| `admin` (super) | `user_role.admin` + `admin_level.super_admin` | `"admin"` | `Role.ADMIN` | `"admin"` | Single Institution |
| `admin` (dept) | `user_role.admin` + `admin_level.secondary_admin` | `"admin"` | `Role.ADMIN` | `"admin"` | Single Department |
| `governance` | `user_role.governance` | `"governance"` | `Role.GOVERNANCE` | `"governance"` | Institution Oversight |
| `principal` | `user_role.principal` | `"principal"` | `Role.PRINCIPAL` | `"principal"` | Institution Leadership |
| `manager` | `user_role.manager` | `"manager"` | `Role.MANAGER` | `"manager"` | Campus Operations |
| `teacher` | `user_role.teacher` | `"teacher"` | `Role.TEACHER` | `"teacher"` | Department Faculty |
| `lab_staff` | `user_role.lab_staff` | `"lab_staff"` | `Role.STAFF` | `"staff"` | Lab / Technical Staff |
| `non_teaching_staff` | `user_role.non_teaching_staff` | `"non_teaching_staff"` | `Role.STAFF` | `"staff"` | Clerical / Office Staff |

---

## 3. Comprehensive Authority Matrix

| Capability / API Operation | `system_admin` | `admin` (super) | `admin` (dept) | `governance` | `principal` | `manager` | `teacher` / `staff` |
|---|---|---|---|---|---|---|---|
| **Platform Management** | | | | | | | |
| Create / Suspend Institution | ✅ | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 |
| Assign / Revoke Subscription Plans | ✅ | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 |
| Feature Lock / Unlock (Entitlements) | ✅ | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 |
| Configure Face Enrollment Policy | ✅ | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 |
| View System Audit Logs (`/system/*`)| ✅ | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 |
| **Geofence Administration** | | | | | | | |
| Create Geofence (`POST /geofences/`)| ✅ | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 |
| Update Geofence (`PUT /geofences/{id}`) | ✅ | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 |
| Toggle / Delete Geofence | ✅ | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 |
| View Active Geofences (`GET /geofences/active`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Institution User & Dept Management** | | | | | | | |
| Create / Delete Faculty Accounts | ✅ | ✅ | ✅ (own dept) | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 |
| Create Secondary Admin | ✅ | ✅ | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 |
| Create / Edit Departments & Subjects | ✅ | ✅ | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 |
| **Timetable & Academic Calendar** | | | | | | | |
| Academic Calendar Entry | ✅ | ✅ | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 |
| Master Timetable Allocation | ✅ | ✅ | ✅ (own dept) | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 |
| View My Timetable Schedule | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Leaves & Substitutions** | | | | | | | |
| Apply for Personal Leave | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Direct Admin Leave Entry | ✅ | ✅ | ✅ (own dept) | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 |
| Approve / Reject Leave | ✅ | ✅ | ✅ (own dept) | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 |
| Assign Substitution | ✅ | ✅ | ✅ (own dept) | ✅ (override) | ❌ 403 | ❌ 403 | ❌ 403 |
| Accept / Decline Substitution | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (assigned) |
| **Attendance & Biometrics** | | | | | | | |
| Biometric Check-In / Check-Out | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ (eligible) |
| View My Attendance History | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Supervisor Live Attendance View | ✅ | ✅ | ✅ (own dept) | ✅ (read-only) | ✅ (read-only) | ✅ | ❌ 403 |
| Read Effective Institutional Policy | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 4. Architectural Enforcement Rules

1. **Server-Side Exclusivity**:
   All authorization decisions are made by FastAPI dependencies in `app/core/dependencies.py`:
   - `require_system_admin`: Strict check for `Role.system_admin`.
   - `require_admin`: Grants access to `Role.admin` and `Role.system_admin`, with read-only restriction for `principal` and `governance`.
   - `require_super_admin`: Restricts to `admin_level == AdminLevel.super_admin` or `system_admin`.
   - `require_teacher`: Restricts to faculty / staff roles.
2. **Never Trust Client State**:
   Neither the Android client nor the Web client can grant or elevate privileges. Even if a modified client issues a forbidden request, the server returns HTTP 403.
3. **Audit Immutability**:
   Any administrative modification made by `system_admin` creates an append-only `SystemAuditLog` entry detailing the actor, action, timestamp, IP address, and payload delta.
