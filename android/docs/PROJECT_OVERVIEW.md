# FAFLOW — Project Overview

**Company:** GOVERNENCE  
**Product:** FAFLOW  
**Developer:** KAMESHGOVINDHAN  
**Domain:** Geolocation-Based Biometric Attendance & Faculty/Staff Governance Platform  

---

## 1. Executive Summary

FAFLOW is an enterprise-grade, geolocation-fenced biometric attendance and faculty governance platform engineered for educational institutions, research organizations, and commercial enterprises. It eliminates attendance fraud (buddy punching, GPS spoofing, photo/screen presentation attacks) while maintaining a seamless, single-tap user experience:

> **"User experience is our first priority. Your toughest jobs are governed by us and made simple."**

### Core Performance Principles
1. **Accuracy:** Dual-stage biometric verification (SCRFD 5-point landmark alignment + 512-dimensional ArcFace/MobileFaceNet embedding cosine matching at threshold $\ge 0.60$) paired with server-authoritative geofencing.
2. **Speed:** High-speed on-device inference pipeline target $\le 1.0\text{ s}$ total verification under standard lighting.
3. **Security:** Hardware-backed integrity verification (Play Integrity / root detection), passive presentation attack defense (PAD), TLS 1.3 encryption, and tamper-resistant audit logs.
4. **Reliability:** Offline-first architecture backed by Android Room/SQLite with transactional WorkManager synchronization using exponential backoff.
5. **Simplicity:** Single primary button ("Check In" / "Check Out") with calm progressive disclosures.

---

## 2. Target Deployments

* **Engineering & Technology Colleges:** Multiple departmental buildings, separate academic blocks, sports fields, and laboratories across large multi-acre campuses.
* **Autonomous Universities & Arts Colleges:** Complex shift patterns, rotational faculty timetables, and multi-tier governance (System Admin $\to$ Principal $\to$ HOD $\to$ Faculty $\to$ Operational Staff).
* **Commercial Multi-Campus Organizations:** Strict departmental boundaries, centralized payroll integration, and multi-tenant department isolation.

---

## 3. Product Ecosystem

```
               ┌──────────────────────────────────────────────────────────┐
               │                     GOVERNENCE FAFLOW                    │
               │                   Institutional Platform                 │
               └────────────────────────────┬─────────────────────────────┘
                                            │
           ┌────────────────────────────────┼──────────────────────────────┐
           │                                │                              │
           ▼                                ▼                              ▼
 ┌──────────────────────┐        ┌──────────────────────┐       ┌──────────────────────┐
 │    Android Client    │        │   FastAPI Backend    │       │     Web Admin UI     │
 │  Kotlin / Compose    │        │  Python 3.12 / Async │       │   React 18 / Vite    │
 │  ONNX Edge Biometrics│◄──────►│  PostgreSQL 18 DB    │◄─────►│  Google Maps Admin   │
 │  Fused GPS Sensing   │  REST  │  Server Geofence Val │  REST │  Leave & Substitution│
 └──────────────────────┘  JSON  └──────────────────────┘  JSON └──────────────────────┘
```

---

## 4. Key Capabilities & Milestones Completed

- **Server-Authoritative Geofencing:** Client GPS is treated strictly as an untrusted sensor. Every check-in/check-out coordinate is independently validated by the FastAPI backend using spherical trigonometry (Haversine formula for circular perimeters) or Jordan curve ray-casting (for arbitrary polygons).
- **Biometric Edge Privacy:** Raw images and full embeddings never persist on remote servers. Face detection, landmark alignment, quality scoring, and matching are conducted on-device.
- **Resilient Offline Mode:** When campus connectivity is impaired, attendance submissions are signed, assigned cryptographically unique UUIDv4 idempotency keys, stored in local SQLite queues, and synced via Android WorkManager.
- **Enterprise Governance Control:** 4-tier Role-Based Access Control (RBAC) separating System Admins, Department HODs, Faculty Teachers, and Operational/Lab Staff.
