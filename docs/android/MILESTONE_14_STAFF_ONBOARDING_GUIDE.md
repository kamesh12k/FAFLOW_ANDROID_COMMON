# Milestone 14: Institutional Staff Onboarding & Biometric Guide
## FAFLOW Staff Mobile Onboarding Protocol

---

## 1. Staff Account Provisioning
1. **Administrative Creation**: Institutional administrator creates staff accounts via web portal or CSV batch import with assigned role (`teacher`, `hod`, `lab_technician`, `non_teaching`) and department.
2. **Initial Credentials**: Staff member receives unique institutional username and temporary password.

---

## 2. On-Device Face Biometric Enrollment Workflow

```
[ LOGIN WITH STAFF CREDENTIALS ]
               │
               ▼
[ NAVIGATE TO PROFILE ──► FACE ENROLLMENT ]
               │
               ▼
[ GRANT CAMERA PERMISSION ]
               │
               ▼
[ POSITION FACE IN GUIDED OVAL ]
- Single face detection check
- Lighting & sharpness check (score ≥ 0.40)
- Umeyama 5-point alignment
               │
               ▼
[ 512-D ARCFACE FEATURE EXTRACTION ]
               │
               ▼
[ ENCRYPT & STORE IN HARDWARE KEYSTORE TEE ]
(Zero photo or vector transmitted over network)
               │
               ▼
[ ENROLLMENT CONFIRMED ]
```

---

## 3. Privacy & Cross-User Security Guarantees
- **No Shared Profile Access**: Staff A cannot inspect or modify Staff B's biometric profile or attendance history.
- **Role Isolation**: Ordinary teachers cannot access campus geofence settings or supervisor live status.
- **Biometric Erasure on Account Deregistration**: De-enrolling clears the encrypted KeyStore keys from local device storage immediately.
