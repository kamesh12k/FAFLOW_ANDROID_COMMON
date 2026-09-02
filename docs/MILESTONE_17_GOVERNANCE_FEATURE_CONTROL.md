# Milestone 17 — Governance Feature Control Specification

### 1. Control Plane Architecture
The Governance System Control Panel is the highest authority layer in FAFLOW, accessible exclusively by `SYSTEM_ADMIN` via the Web application (`/governance/*`). It enforces global and institution-level policies, license module entitlements, and security parameters.

---

### 2. Gated Modules & Policies

| Policy Key | Description | Affected Modules | Mobile Enforcement |
|---|---|---|---|
| `face_enrollment_allowed` | Global/Institution toggle for face enrollment | Face AI Subsystem | Evaluated before launching enrollment |
| `face_enrollment_update_allowed` | Allow existing staff to re-enroll/update templates | Face AI Subsystem | Evaluated before template overwrite |
| `biometric_attendance_enabled` | Enable biometric geofence attendance | Attendance Engine | Evaluated on punch request |
| `teacher_substitution_mode` | Controls whether faculty can select substitutes | Substitution Engine | Hides/shows candidate picker |
| `require_device_integrity` | Require hardware-backed device attestation | Security Subsystem | Evaluated on check-in |
| `max_geofence_radius_meters` | Maximum allowable radius for campus geofences | Geofence Engine | Enforced on geofence save |

---

### 3. Server-Side Policy Resolution
The backend endpoint `GET /system/institutions/{id}/policy` evaluates effective policies by combining:
$$\text{Effective Policy} = \text{Global Policy} \land \text{Institution Policy} \land \text{Role Authorization}$$
Under no circumstances can a mobile client alter governance policy states.
