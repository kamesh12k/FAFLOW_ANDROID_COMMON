# Milestone 17 — Security & Policy Validation Report

### 1. Overview
FAFLOW enforces security across three key layers:
1. **Role-Based Access Control (RBAC)**: Strict differentiation between `teacher`, `admin` (HOD), and `system_admin`.
2. **Server-Side Policy Gating**: Biometric features (face enrollment and template update) are governed by server-side policy (`GET /system/institutions/{id}/policy`).
3. **Tenant Department Isolation**: Secondary admins (HODs) are scoped to their assigned `department_id` via `get_tenant_department_id`.

---

### 2. Mobile Attack Surface Reduction
- **No Control Plane in Mobile**: Geofence canvas editor, system policy overrides, tenant provisioning, and database operations are not compiled into user-accessible routes in the Android client.
- **Client Role Impersonation Impossibility**: Even if a client modifies local UI state to view HOD screens, backend endpoints (`/leaves/`, `/attendance/admin/live-status`, `/leaves/{id}/approve`) reject unauthorized requests with `403 Forbidden` via `require_admin`.

---

### 3. Policy Enforcement Matrix

| Policy Dimension | Server Endpoint | Mobile Check | Enforced Behavior |
|---|---|---|---|
| **Face Enrollment Allowed** | `GET /system/institutions/{id}/policy` | Checked on entry to `FaceEnrollmentScreen.kt` | If false, enrollment is blocked with institutional notice. |
| **Face Update Allowed** | `GET /system/institutions/{id}/policy` | Checked during template overwrite | If false, re-enrollment is blocked. |
| **Department Scoping** | FastAPI Dependency `get_tenant_department_id` | Server-side query filter | HOD can only view and approve department faculty leaves. |
| **Device Integrity** | `POST /attendance/check-in` | `DeviceIntegrityVerifier.kt` | Emulator and hook checks verified if required by policy. |
