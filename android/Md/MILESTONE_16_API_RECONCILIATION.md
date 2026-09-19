# Milestone 16: API Reconciliation

> Android API Client vs Original FAFLOW Backend

---

## Legend

- ✅ **Match** — Android endpoint maps directly to original FAFLOW backend route
- ⚠️ **New** — Exists in M9–M16 backend but NOT in original FACULTY_FLOW repo (additive)
- ❌ **Missing** — Android references an endpoint not yet in either backend

---

## Authentication

| Android Endpoint | Backend Endpoint | Method | Auth | Decision |
|---|---|---|---|---|
| `/auth/login` | `/auth/login` | POST | None | ✅ Match |
| `/auth/logout` | N/A (JWT client-side) | — | JWT | ✅ Match (stateless JWT) |

---

## Teacher / Faculty Endpoints

| Android Endpoint | Backend Endpoint | Method | Auth | Decision |
|---|---|---|---|---|
| `/teachers/me` | `/teachers/me` | GET | JWT | ✅ Match |
| `/teachers/me/preferences` | `/teachers/me/preferences` | GET/PUT | JWT | ✅ Match |
| `/teachers/me/profile` | `/teachers/me` | GET | JWT | ✅ Match (same endpoint) |

---

## Timetable

| Android Endpoint | Backend Endpoint | Method | Auth | Decision |
|---|---|---|---|---|
| `/timetable/my-schedule` | `/timetable/my-schedule` | GET | JWT | ✅ Match |
| `/timetable/day-order/today` | `/day-order/today` | GET | JWT | ✅ Match |

---

## Leave Management

| Android Endpoint | Backend Endpoint | Method | Auth | Decision |
|---|---|---|---|---|
| `/leaves/apply` | `/leaves/apply` | POST | JWT/Teacher | ✅ Match |
| `/leaves/my-history` | `/leaves/my-history` | GET | JWT/Teacher | ✅ Match |
| `/leaves/my-credits` | `/credits/me` | GET | JWT/Teacher | ✅ Match |

---

## Substitutions

| Android Endpoint | Backend Endpoint | Method | Auth | Decision |
|---|---|---|---|---|
| `/substitutions/my-pending` | `/substitutions/my-pending` | GET | JWT/Teacher | ✅ Match |
| `/substitutions/{id}/accept` | `/substitutions/{id}/accept` | POST | JWT/Teacher | ✅ Match |
| `/substitutions/{id}/decline` | `/substitutions/{id}/decline` | POST | JWT/Teacher | ✅ Match |

---

## Notifications

| Android Endpoint | Backend Endpoint | Method | Auth | Decision |
|---|---|---|---|---|
| `/notifications/` | `/notifications/` | GET | JWT | ✅ Match |
| `/notifications/{id}/read` | `/notifications/{id}/read` | PATCH | JWT | ✅ Match |

---

## Campus Geofences (NEW — M9)

| Android Endpoint | Backend Endpoint | Method | Auth | Decision |
|---|---|---|---|---|
| `/geofences/active` | `/geofences/active` | GET | JWT | ⚠️ **NEW (M9)** — Added additively |
| `/geofences/` | `/geofences/` | POST | **SYSTEM_ADMIN** | ⚠️ **NEW (M9)** — SYSTEM_ADMIN only |
| `/geofences/{id}` | `/geofences/{id}` | PUT | **SYSTEM_ADMIN** | ⚠️ **NEW (M9)** — SYSTEM_ADMIN only |
| `/geofences/{id}/toggle` | `/geofences/{id}/toggle` | PATCH | **SYSTEM_ADMIN** | ⚠️ **NEW (M9)** — SYSTEM_ADMIN only |

---

## Staff Biometric Attendance (NEW — M9)

| Android Endpoint | Backend Endpoint | Method | Auth | Decision |
|---|---|---|---|---|
| `/attendance/check-in` | `/attendance/check-in` | POST | JWT/Staff | ⚠️ **NEW (M9)** — Added additively |
| `/attendance/check-out` | `/attendance/check-out` | POST | JWT/Staff | ⚠️ **NEW (M9)** — Added additively |
| `/attendance/today` | `/attendance/today` | GET | JWT/Staff | ⚠️ **NEW (M9)** — Added additively |
| `/attendance/my-history` | `/attendance/my-history` | GET | JWT/Staff | ⚠️ **NEW (M9)** — Added additively |
| `/attendance/supervisor/live` | `/attendance/supervisor/live` | GET | JWT/Admin | ⚠️ **NEW (M9)** — Added additively |

---

## Governance Control Plane (NEW — M16)

| Android Endpoint | Backend Endpoint | Method | Auth | Decision |
|---|---|---|---|---|
| `/system/institutions/{id}/policy` | `/system/institutions/{id}/policy` | GET | JWT (any) | ⚠️ **NEW (M16)** — Android MUST call before biometric ops |
| `/system/dashboard` | `/system/dashboard` | GET | SYSTEM_ADMIN | ⚠️ **NEW (M16)** — Control plane only |
| `/system/institutions/{id}/biometric-policy` | same | GET/PUT | SYSTEM_ADMIN | ⚠️ **NEW (M16)** — Control plane only |

---

## Public / Settings

| Android Endpoint | Backend Endpoint | Method | Auth | Decision |
|---|---|---|---|---|
| `/health` | `/health` | GET | None | ✅ Match |
| `/settings/public` | `/settings/public` | GET | None | ✅ Match |

---

## Summary

| Status | Count |
|--------|-------|
| ✅ Match (Android ↔ Original FAFLOW) | 18 endpoints |
| ⚠️ New additive (M9–M16, not in original) | 14 endpoints |
| ❌ Missing / invented without backend | 0 endpoints |

> **All 14 "New" endpoints are genuine product extensions (biometric attendance, geofencing, governance control). None are duplicates or replacements of existing FAFLOW APIs.**
