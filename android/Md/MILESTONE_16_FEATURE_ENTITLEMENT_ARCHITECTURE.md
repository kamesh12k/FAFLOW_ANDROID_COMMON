# Milestone 16: Feature Entitlement Architecture

---

## 1. Design Principle

Features are never hard-coded as "always on" or "always off" in client code.
Every feature decision flows through the server-authoritative policy endpoint.

```
Android / Web Client
        │
        ▼
GET /system/institutions/{id}/policy
        │
        ▼
   Feature Status
   ┌──────────────┐
   │ ENABLED      │ → Allow operation
   │ DISABLED     │ → Block + explain to user
   │ LOCKED       │ → Block, client override impossible
   │ TRIAL        │ → Allow + show trial banner
   │ EXPIRED      │ → Block + prompt renewal
   └──────────────┘
        │
        ▼
   Backend enforces independently
```

---

## 2. Feature State Machine

```
ENABLED ──(disable)──► DISABLED
ENABLED ──(lock)────► LOCKED
DISABLED ──(enable)──► ENABLED
DISABLED ──(lock)───► LOCKED
LOCKED ──(unlock)───► ENABLED
TRIAL ──(expire)────► EXPIRED
EXPIRED ──(renew)───► ENABLED
```

---

## 3. Android Policy Enforcement Rule

```
1. App starts attendance flow.
2. App calls GET /system/institutions/{id}/policy.
3. If face_enrollment_allowed == false:
      Display: "Face enrollment is currently disabled by your institution administrator."
      Return HTTP 403 FACE_ENROLLMENT_DISABLED if API called directly.
4. If liveness_enabled == false:
      Attendance check-in proceeds without liveness challenge.
5. If geofencing_enabled == false:
      GPS gate is bypassed (institution-configured).
6. Cached policy state MUST NOT be used for enrollment/update operations.
      Always require fresh server confirmation for sensitive biometric operations.
```

---

## 4. Database Schema

```sql
CREATE TABLE feature_entitlements (
    id              INTEGER PRIMARY KEY,
    institution_id  INTEGER NOT NULL REFERENCES institutions(id),
    feature_key     feature_key_enum NOT NULL,
    status          feature_status_enum NOT NULL DEFAULT 'ENABLED',
    locked_by_id    INTEGER REFERENCES users(id),
    expiry_date     TIMESTAMP WITH TIME ZONE,
    updated_at      TIMESTAMP WITH TIME ZONE,
    UNIQUE (institution_id, feature_key)
);
```
