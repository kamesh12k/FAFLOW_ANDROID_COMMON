# Milestone 11: End-to-End Security Validation & Threat Review

## 1. Security Architecture Verification

```
[ Staff Mobile App ]                          [ Institutional FAFLOW Backend ]
         │                                                    │
   (Hardware TEE /                                            │
  EncryptedSharedPrefs)                                       │
         │                                                    │
  1. On-Device SCRFD                                          │
  2. Umeyama 5-Pt Alignment                                   │
  3. ArcFace 512-D Embedding                                  │
  4. Cosine Match vs Local Template                           │
  5. Active Liveness Challenge                                │
         │                                                    │
         ├────── Minimal Verification Metadata ──────────────►│
         │       (idempotencyKey, lat, lon,                   │
         │        accuracy, similarity, liveness)             │
         │                                            1. Validates JWT & Active Status
         │                                            2. Calculates Server Geofence Distance
         │                                            3. Validates Accuracy <= 50.0m
         │                                            4. Enforces Similarity >= 0.60
         │                                            5. Checks Idempotency Deduplication
         │                                            6. Enforces Temporal Shift Sequencing
         │                                            7. Records Immutable Audit Log Record
         │◄───── Authoritative Shift Receipt ─────────┤
         │                                                    │
```

---

## 2. Hardened Security Guarantees
1. **Zero Raw Image Upload**: Neither camera snapshots nor raw frame buffers are sent over the network.
2. **Zero Embedding Upload**: 512-D floating-point ArcFace biometric feature vectors are never transmitted or stored in the offline queue.
3. **Hardware-Backed Secret Storage**: Tokens and local biometric templates are protected with AES-256-GCM keys managed by Android KeyStore in Hardware TEE.
4. **Authoritative Server Ledger**: The backend independently validates coordinates against active campus geofence boundaries, verifies accuracy, and rejects out-of-order check-in/out transitions.
5. **Role-Based Supervisor Access**: Regular faculty members receive `HTTP 403 Forbidden` on administrative/supervisor endpoints (`/attendance/admin/live-status`).
