# FAFLOW — Production Android Mobile & Governance Platform

**Company:** GOVERNENCE  
**Product:** FAFLOW  
**Developer:** KAMESHGOVINDHAN  

---

## 1. Executive Summary

FAFLOW is an enterprise-grade geolocation-based biometric attendance and faculty/staff management platform engineered for educational institutions, colleges, and commercial organizations.

> **"User experience is our first priority. Your toughest jobs are governed by us and made simple."**

### Core Performance Principles
1. **Accuracy:** SCRFD 5-point landmark alignment + 512-dimensional ArcFace / MobileFaceNet embedding vector matching at cosine threshold $\ge 0.60$.
2. **Speed:** High-speed on-device pipeline targeting sub-second total verification ("Open -> Look -> Verified").
3. **Security:** Zero production bypasses, hardware-backed Keystore encryption, passive presentation attack defense, and server-authoritative Haversine/Polygon geofencing.
4. **Reliability:** Fully transaction-safe offline attendance queue with exponential backoff WorkManager synchronization.

---

## 2. Comprehensive Documentation Suite

Detailed architectural, technical, and compliance documentation is available in the `docs/` directory:

- [Project Overview](docs/PROJECT_OVERVIEW.md)
- [End-to-End Architecture](docs/ARCHITECTURE.md)
- [Backend Architecture](docs/BACKEND_ARCHITECTURE.md)
- [Web Frontend Architecture](docs/FRONTEND_ARCHITECTURE.md)
- [Android Integration Guide](docs/ANDROID_INTEGRATION.md)
- [Database Architecture & PostgreSQL Schema](docs/DATABASE_ARCHITECTURE.md)
- [API Reference & Contracts](docs/API_REFERENCE.md)
- [Biometric Face Recognition & Liveness Pipeline](docs/FACE_RECOGNITION.md)
- [Geolocation & Server Geofencing](docs/GEOLOCATION_AND_GEOFENCE.md)
- [Google Maps Geofence Configuration](docs/GOOGLE_MAPS_CONFIGURATION.md)
- [Security Architecture & Zero-Bypass Policy](docs/SECURITY.md)
- [Diagnostics & Debug Kit](docs/DEBUGGING.md)
- [Intellectual Property & Licensing](docs/LICENSING.md)

---

## 3. Build & Test Commands

### Android
```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
.\gradlew.bat testDebugUnitTest
```
*Status: 94/94 Unit Tests Passing (100%)*

### Backend (FastAPI + PostgreSQL 18)
```powershell
& "C:\Users\kames\.codex\.chatgpt-projects\g-p-6a37c905c4808191824be5bf9ac7dad1\analysis-copy\backend\venv\Scripts\python.exe" -m pytest -q
```
*Status: 479/479 Tests Passing (100%)*

### Frontend (React + Vite)
```powershell
cd ..\FAFLOW_UNIFIED\frontend
npm run build
```
*Status: Clean Build (0 errors, ~6.0s)*
