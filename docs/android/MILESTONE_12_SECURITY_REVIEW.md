# Milestone 12: Security & Biometric Data Governance Review

## 1. Biometric Data Lifecycle & Privacy Standards

```
[ FRONT CAMERA CAPTURE ] ──► [ ON-DEVICE SCRFD & ALIGNMENT ] ──► [ ARCFACE 512-D VECTOR ]
                                                                       │
                                                                       ▼
                                                       [ HARDWARE TEE / ENCRYPTED STORAGE ]
                                                                       │
                                                        (Zero Raw Photo or Vector Upload)
                                                                       │
                                                                       ▼
                                                       [ METADATA ONLY (Score & Liveness) ]
                                                                       │
                                                                       ▼
                                                       [ HTTPS / TLS AUTHORITATIVE BACKEND ]
```

---

## 2. Key Security Findings & Defenses
1. **Zero Biometric Upload**: Camera frames and raw floating-point 512-D feature vectors are strictly kept in on-device volatile memory and never transmitted over network.
2. **Encrypted Local Enrollment**: Staff face templates are encrypted with AES-256-GCM master keys managed by the Android KeyStore in the hardware Trusted Execution Environment (TEE).
3. **Server-Side Authoritative Geofence Enforcement**: The backend re-computes Haversine / Point-in-Polygon containment on every check-in/out payload; client claims of "inside perimeter" are never blindly trusted.
4. **Idempotent Shift Operations**: Client-generated UUID `idempotency_key` indexed at database level prevents double billing or duplicate attendance records.
5. **Supervisor Data Privacy**: Non-administrative faculty members cannot access department-wide live status or other employees' attendance receipts (`HTTP 403 Forbidden`).
