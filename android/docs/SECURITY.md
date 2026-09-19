# FAFLOW — Security Architecture & Production Hardening

**Company:** GOVERNENCE  
**Product:** FAFLOW  
**Developer:** KAMESHGOVINDHAN  

---

## 1. Threat Matrix & Mitigations

| Threat | Attack Vector | FAFLOW Mitigation |
| :--- | :--- | :--- |
| **Buddy Punching** | Colleague attempts to check in for an absent peer | On-device ArcFace/MobileFaceNet cosine matching ($\ge 0.60$) against local enrolled biometric template. |
| **Spoof / Presentation Attack** | Holding up high-res photo, printed mask, or video on phone screen | Passive PAD (MiniFASNet depth & texture classification) + 3-frame temporal gesture confirmation debounce. |
| **GPS Spoofing / Mock Location** | Using "Fake GPS" app to simulate presence inside campus | `isFromMockProvider` detection on Android + backend Haversine server-authoritative validation. |
| **Replay Attacks** | Capturing successful HTTP request payload and re-sending | Server-side UUIDv4 idempotency keys, single check-in per calendar date enforcement, short-lived JWTs. |
| **Credential & Token Theft** | Extracting tokens from rooted device storage | Android Keystore + `EncryptedSharedPreferences` (AES-256-GCM). |
| **Biometric Identity Theft** | Sniffing raw facial photos over network | Raw images are NEVER transmitted or stored on backend. Only score and verification boolean are transmitted over TLS 1.3. |

---

## 2. Zero-Bypass Policy

In accordance with FAFLOW production standards:
- `BYPASS_GEOLOCATION_FOR_TESTING = false`
- `BYPASS_LIVENESS_FOR_TESTING = false`
- `skipGps`, `skipFace`, and `forceSuccess` flags are strictly prohibited from all production release paths.
