# Milestone 9: Offline Attendance Synchronization Architecture

## 1. Overview
FAFLOW Staff Mobile implements an **offline-first attendance ledger**. Staff can complete on-device biometric verification and record shift check-in/out even in dead zones or intermittent campus Wi-Fi/LTE network environments.

---

## 2. Synchronization Lifecycle

```
[ Staff Verification ]
        │
        ▼
[ VerifiedAndReady ]
        │
        ▼
   Online Check
   ├── Online: POST /attendance/check-in ──► [ Server Accepted ] ──► Complete
   └── Offline / Network Timeout
           │
           ▼
   [ SQLite Local Queue ]
   (idempotencyKey, minimal verification metadata)
           │
           ▼
   [ UI: Saved Offline ]
           │
           ▼
   [ WorkManager Background Sync ]
   (Constraint: NetworkType.CONNECTED + Exponential Backoff)
           │
           ▼
   POST to FAFLOW Backend
           ├── 200 OK ──► [ Mark Synced in Local SQLite ]
           └── 4xx/5xx ──► [ Exponential Backoff Retry ]
```

---

## 3. Privacy & Storage Rules
1. **Zero Raw Photo Storage**: No camera snapshots, JPEG bytes, or raw image buffers are ever saved in the offline queue.
2. **Zero Embedding Storage**: No raw 512-D ArcFace vectors are stored in the offline queue.
3. **Minimal Metadata**: Only operational parameters (UUID idempotency key, coordinates, accuracy, similarity score, liveness boolean, and timestamp) are stored.

---

## 4. Idempotency & Fault Tolerance
- Every queued record generates a client-side UUID idempotency key before local persistence.
- When `AttendanceSyncWorker` submits the transaction to `/attendance/check-in` or `/attendance/check-out`, the backend verifies the idempotency key against `staff_attendance_records.idempotency_key`.
- If the server previously received the request during an unstable network connection, it returns the existing authoritative record, preventing duplicate attendance creation.
- WorkManager automatically resumes synchronization across device reboots and application restarts.
