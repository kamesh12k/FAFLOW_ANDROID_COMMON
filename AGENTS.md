# FAFLOW Monorepo — Agent Context (AGENTS.md)

> **Milestone 16** · Branch: `optimize/full-audit`  
> Last updated: Phase 7 – End-to-End Verification & CI/CD Hardening

---

## Project Structure

```
FAFLOW_UNIFIED/
├── backend/            FastAPI + SQLAlchemy + PostgreSQL
├── frontend/           React 18 + TypeScript + Vite
├── android/            Kotlin + Jetpack Compose + CameraX + ONNX Runtime
├── database/           SQL migrations and seed scripts
├── design/             Design tokens (unified source of truth)
├── deployment/         PowerShell orchestration scripts
├── docs/               Audit reports and testing docs
├── scripts/            CI helpers (ci_contract_check.py, etc.)
├── .github/workflows/  CI/CD pipeline (ci.yml)
└── openapi.yaml        Single OpenAPI spec (source of truth, 653 paths)
```

---

## Critical Rules

1. **Backend is the single source of truth.** API contracts, RBAC roles, and business rules are defined in `backend/`. All clients must align.
2. **Never weaken security**: biometrics, geofencing, RBAC, licensing controls, and the Governance Control Plane are non-negotiable.
3. **All changes must pass all CI gates** before merging to `main`.
4. **Design tokens** live in `design/tokens/faflow_design_tokens.json`; export to `frontend/src/tokens/designTokens.js` and `android/app/.../FaflowDesignTokens.kt`.
5. **OpenAPI spec** (`openapi.yaml`) must be kept in sync with any new backend routes.

---

## How to Run Tests

See [`docs/testing.md`](docs/testing.md) for the full strategy.

### Quick commands (Windows)

```powershell
# Backend
cd backend
venv\Scripts\python.exe -m pytest tests/ -v --tb=short

# Frontend
cd ..\frontend
npm run typecheck
npm run build

# Android
cd ..\android
.\gradlew.bat testDebugUnitTest --no-daemon

# Contract parity gate
cd ..
backend\venv\Scripts\python.exe -X utf8 scripts\ci_contract_check.py `
  --openapi openapi.yaml `
  --android android\app\src\main\java\com\governence\faflow `
  --frontend frontend\src `
  --report reports\contract_parity.json
```

---

## CI/CD Pipeline

`.github/workflows/ci.yml` runs on every push to `main`, `develop`, and `optimize/full-audit`:

| Job | Trigger | Checks |
|---|---|---|
| `backend` | always | pytest (all 63 suites), pip-audit |
| `frontend` | always | tsc --noEmit, vite build |
| `android` | always | testDebugUnitTest, assembleDebug |
| `contract-parity` | after all three | ci_contract_check.py (0 HIGH = PASS) |
| `security-gate` | after backend | 8 security test files |
| `gate` | after all | Final merge gate |

---

## RBAC Roles (Backend canonical)

| Role | Enum value | Auth type |
|---|---|---|
| Super Admin | `admin` + `super_admin` | Username + password |
| Secondary Admin | `admin` + `secondary_admin` | Username + password |
| System Admin | `system_admin` | Username + password |
| Principal | `principal` | Username + password |
| HOD / Teacher | `teacher` | Email + password + biometric |
| Manager | `manager` | Username + password |
| Staff | `staff` | Username + password |
| Governance | `governance` | Internal only |

---

## Key Architecture Notes

- **CameraX pipeline**: 160 ms minimum settling window (`minSettlingWindowMs`), 2 minimum settling frames. `PassiveLivenessEngine` uses landmark ratio variance + texture sharpness for PAD.
- **Attendance state machine**: `SEARCHING → SETTLING → CAPTURED` in `AttendanceViewModel.updateDetections`. Null bitmaps in headless unit tests are handled with early return.
- **Offline sync**: `WorkManager` queues attendance records when offline; `SyncWorker` uploads on reconnect.
- **Geofencing**: Haversine distance + polygon containment, hardware-backed `EncryptedSharedPreferences` for tokens.

---

## Audit Report Index

| Phase | Report |
|---|---|
| 1 – Architecture Analysis | `docs/audit/01_PROJECT_ANALYSIS.md` |
| 2 – Contract Matrix | `docs/audit/02_CONTRACT_MATRIX.md` |
| 3 – Backend Optimization | `docs/audit/03_OPTIMIZATION_REPORT.md` |
| 4 – Frontend Optimization | `docs/audit/04_FRONTEND_OPTIMIZATION_REPORT.md` |
| 5 – Android Optimization | `docs/audit/05_ANDROID_OPTIMIZATION_REPORT.md` |
| 6 – UI/UX Unification | `docs/audit/06_UI_UX_REPORT.md` |
| 7 – E2E & CI/CD | `docs/audit/07_E2E_CICD_REPORT.md` |
| Testing Strategy | `docs/testing.md` |
