# Milestone 10: Institutional Security & Threat Model Audit

## 1. Threat Matrix & Defense Mechanisms

| Attack Vector | Threat Description | FAFLOW Defense Layer |
|---|---|---|
| **Location Spoofing** | Mock GPS apps or Developer Options mock location injection. | Android `Location.isMock` / `isFromMockProvider` inspection + server-side geofence boundary & accuracy re-verification. |
| **Replay Attacks** | Capturing and resubmitting valid check-in HTTP payloads. | Unique client UUID `idempotency_key` indexed at database level; subsequent submissions return existing receipt without duplicate entry. |
| **Presentation Attack (2D Print)** | Holding a printed photo of enrolled faculty member in front of camera. | Layer 2 Photostatic Jitter Variance calculation ($\sigma^2_{\text{temporal}} \ge 0.15$) + Active Randomized Challenges (`TURN_LEFT`, `TURN_RIGHT`, `LOOK_UP`). |
| **Presentation Attack (Video/Screen)** | Playing recorded selfie video on smartphone screen. | Multi-frame temporal observation buffer ($N = 20$) + randomized challenge sequence timing validation. |
| **Biometric Interception** | Eavesdropping or MitM inspection of network traffic. | **Zero Biometric Upload**: Camera frames and raw 512-D embeddings are never transmitted over network. |
| **Credential Theft** | Reading plaintext JWT tokens or enrollment templates from device storage. | Android Keystore backed `EncryptedSharedPreferences` (AES-256-GCM + master key in Hardware TEE). |
| **Unauthorized Administrative Snooping** | Normal teacher accessing department attendance summaries. | FastAPI `get_current_user` RBAC dependency restricting supervisor endpoints to `['admin', 'principal', 'hod', 'manager']`. |

---

## 2. Cryptographic Storage & Privacy Safeguards
1. **Enrollment Vector Storage**: Local template stored via `LocalFaceEnrollmentRepository` in Android Keystore encrypted SharedPreferences.
2. **Offline Queue Privacy**: `AttendanceLocalQueue` stores only verified operational receipts; zero JPEG/PNG buffers or vector embeddings.
3. **Log Sanitization**: All loggers strip JWT headers, personal passwords, and facial bounding coordinates from console outputs.
