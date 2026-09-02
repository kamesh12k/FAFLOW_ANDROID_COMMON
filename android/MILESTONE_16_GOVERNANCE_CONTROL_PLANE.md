# Milestone 16: Governance System Control Plane
## Architecture, Design Decisions & Operational Reference

---

## 1. Architecture Overview

```
        GOVERNANCE CONTROL PLANE  (SYSTEM_ADMIN ONLY)
                      │
              ┌───────┴────────┐
              │                │
     Institution Config    Feature Policy
              │                │
         Geofences        BiometricPolicy
              │
              ▼
        FAFLOW BACKEND  (FastAPI + PostgreSQL)
                │
        ┌───────┴────────┐
        │                │
   FAFLOW WEB      FAFLOW ANDROID
```

The Governance Control Plane sits above the existing FAFLOW application tier. It does NOT replace it.

---

## 2. New API Endpoints

| Method | Endpoint | Role Required | Purpose |
|---|---|---|---|
| `GET` | `/system/dashboard` | `system_admin` | Governance KPI dashboard |
| `GET` | `/system/institutions` | `system_admin` | List all institutions |
| `POST` | `/system/institutions` | `system_admin` | Create institution |
| `GET` | `/system/institutions/{id}` | `system_admin` | Get institution |
| `PUT` | `/system/institutions/{id}` | `system_admin` | Update institution |
| `POST` | `/system/institutions/{id}/assign-plan` | `system_admin` | Assign subscription plan |
| `GET` | `/system/institutions/{id}/features` | `system_admin` | List feature entitlements |
| `POST` | `/system/institutions/{id}/features/{key}/enable` | `system_admin` | Enable feature |
| `POST` | `/system/institutions/{id}/features/{key}/disable` | `system_admin` | Disable feature |
| `POST` | `/system/institutions/{id}/features/{key}/lock` | `system_admin` | Lock feature |
| `POST` | `/system/institutions/{id}/features/{key}/unlock` | `system_admin` | Unlock feature |
| `GET` | `/system/institutions/{id}/biometric-policy` | `system_admin` | Get biometric policy |
| `PUT` | `/system/institutions/{id}/biometric-policy` | `system_admin` | Update biometric policy |
| `GET` | `/system/institutions/{id}/policy` | Any authenticated | Authoritative runtime policy |
| `GET` | `/system/audit-logs` | `system_admin` | System audit log query |
| `POST` | `/geofences/` | **`system_admin` only** | Create geofence (was: admin) |
| `PUT` | `/geofences/{id}` | **`system_admin` only** | Update geofence (was: admin) |
| `PATCH` | `/geofences/{id}/toggle` | **`system_admin` only** | Toggle geofence (was: admin) |
| `DELETE` | `/geofences/{id}` | **`system_admin` only** | Delete geofence (was: admin) |

---

## 3. Geofence Authorization Change

Before Milestone 16, geofence mutations were allowed for `admin` role.

After Milestone 16:
- `POST /geofences/` → `system_admin` only
- `PUT /geofences/{id}` → `system_admin` only
- `PATCH /geofences/{id}/toggle` → `system_admin` only
- `DELETE /geofences/{id}` → `system_admin` only

GET/read access remains available to `admin`, `principal`, and `governance` roles.

---

## 4. Feature Key Registry

| Feature Key | Description |
|---|---|
| `ATTENDANCE` | Core attendance module |
| `GEOFENCING` | Campus GPS boundary enforcement |
| `FACE_DETECTION` | On-device SCRFD face detection |
| `FACE_ENROLLMENT` | Staff face template enrollment |
| `FACE_UPDATE` | Face template update/re-capture |
| `BIOMETRIC_ATTENDANCE` | Full biometric attendance pipeline |
| `LIVENESS` | Active/passive liveness anti-spoofing |
| `OFFLINE_SYNC` | WorkManager offline sync queue |
| `SUPERVISOR_DASHBOARD` | Live attendance supervisor view |
| `REPORTS` | Attendance and leave reporting |
| `ADVANCED_ANALYTICS` | Cross-department analytics |
| `API_ACCESS` | External API integration |
| `MULTI_CAMPUS` | Multi-campus management |
| `ADVANCED_GEOFENCING` | Polygon/complex boundary types |

---

## 5. Subscription Plans

| Plan | Intended Tier |
|---|---|
| `FREE` | Evaluation / demo |
| `BASIC` | Core attendance + leave |
| `PRO` | + Face biometrics + liveness |
| `ENTERPRISE` | + Multi-campus + analytics + supervisor live |
| `CUSTOM` | Institution-negotiated |

---

## 6. Security Architecture

- All `/system/*` routes are protected by `require_system_admin` FastAPI dependency.
- IDOR protection: Institution-scoped queries enforce `institution_id` as the primary filter key.
- No client-side flag can override a server-side `LOCKED` or `DISABLED` feature status.
- The `/system/institutions/{id}/policy` endpoint is the authoritative runtime policy gate — Android and Web must call this before allowing sensitive operations.
- Zero biometric images or embeddings are stored in audit logs.
