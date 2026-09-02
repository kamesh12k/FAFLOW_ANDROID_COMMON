# FAFLOW — Unified Institutional Attendance & Faculty Management Platform

> **Version**: Milestone 16 (Governance Control Plane)  
> **Architecture**: Monorepo — One product, one backend, one database, two clients (Web + Android)

---

## Repository Structure

```
FAFLOW_UNIFIED/
├── backend/          ← FastAPI + PostgreSQL backend (canonical, shared)
├── frontend/         ← React + Vite Web application
├── android/          ← FAFLOW Staff Mobile (Jetpack Compose + CameraX)
├── database/         ← Schema, migrations, seed data
├── deployment/       ← Production deployment scripts
├── docs/             ← Consolidated architecture and operational docs
├── scripts/          ← Utility and maintenance scripts
└── README.md         ← This file
```

---

## Product Overview

FAFLOW is an institutional attendance and faculty management system for colleges and universities.

```
FAFLOW BACKEND (FastAPI + PostgreSQL)
              │
    ┌─────────┴─────────┐
    │                   │
FAFLOW WEB          FAFLOW ANDROID
(React + Vite)      (Kotlin + Compose)
    │                   │
    └─────────┬─────────┘
              │
        Same Auth/RBAC
        Same Database
        Same Business Rules
```

### Two Clients — One Platform

| Feature | FAFLOW Web | FAFLOW Staff Mobile |
|---------|-----------|---------------------|
| Authentication | ✅ | ✅ |
| Staff Dashboard | ✅ | ✅ |
| Timetable | ✅ | ✅ |
| Leave application | ✅ | ✅ |
| Leave history | ✅ | ✅ |
| Leave credits | ✅ | ✅ |
| Substitution management | ✅ | ✅ |
| Preferences | ✅ | ✅ |
| Notifications | ✅ | ✅ |
| Profile | ✅ | ✅ |
| Admin dashboards | ✅ | Read-only |
| Biometric attendance | ❌ | ✅ (CameraX + ArcFace) |
| GPS geofencing | ❌ | ✅ (graphical polygon/circle) |
| Face detection | ❌ | ✅ (InsightFace SCRFD) |
| Liveness detection | ❌ | ✅ |
| Offline sync | ❌ | ✅ (WorkManager) |

---

## Quick Start

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env  # configure DATABASE_URL, SECRET_KEY
python run_migration.py
uvicorn app.main:app --reload
```

### Frontend (Web)

```bash
cd frontend
npm install
npm run dev
```

### Android

Open `android/` in Android Studio. Sync Gradle, build and run.

---

## Architecture

See [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) and [docs/android/FAFLOW_MOBILE_ARCHITECTURE.md](docs/android/FAFLOW_MOBILE_ARCHITECTURE.md).

---

## Governance & System Administration

FAFLOW includes a two-tier administrative architecture:

### Level 0: SYSTEM_ADMIN (Governance Control Plane)
- Controls feature licensing, geofence mutations, biometric enrollment policy
- All `/system/*` endpoints require `system_admin` role
- Immutable audit log for every system change

### Level 1: Institution Admin (FAFLOW Admin)
- Manages teachers, timetables, leaves, substitutions within the institution
- Cannot modify geofences or system-level policies

---

## Security

- JWT-based authentication
- Server-side RBAC (backend is the source of truth)
- GPS mock/fake location detection on Android
- Anti-spoofing liveness verification
- No biometric images or embeddings stored in audit logs
- `.env` files are gitignored — see `.env.example` for configuration template

---

## Documentation

| Document | Purpose |
|----------|---------|
| [ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) | System architecture |
| [DATABASE.md](docs/database/DATABASE.md) | Database schema |
| [DEPLOYMENT.md](docs/deployment/DEPLOYMENT.md) | Deployment guide |
| [SECURITY.md](docs/security/SECURITY.md) | Security design |
| [MILESTONE_16_REPOSITORY_INVENTORY.md](MILESTONE_16_REPOSITORY_INVENTORY.md) | Full file inventory |
| [MILESTONE_16_API_RECONCILIATION.md](MILESTONE_16_API_RECONCILIATION.md) | API endpoint comparison |
| [MILESTONE_16_RBAC_RECONCILIATION.md](MILESTONE_16_RBAC_RECONCILIATION.md) | Role & permission matrix |
| [MILESTONE_16_DATABASE_MERGE_PLAN.md](MILESTONE_16_DATABASE_MERGE_PLAN.md) | Database merge strategy |

---

## License

See [LICENSE](backend/../LICENSE) (if applicable) and [docs/EULA.md](docs/EULA.md).
