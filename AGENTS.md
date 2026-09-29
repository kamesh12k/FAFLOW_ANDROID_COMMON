# FAFLOW Monorepo — Agent Context (AGENTS.md)

> **Milestone 17** · Branch: `redesign/light-professional`  
> Last updated: Phase 7 – Institutional Light Theme Redesign, Contract Parity & Production Delivery Gate

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
├── openapi_generated.yaml Single generated OpenAPI spec (source of truth, 333 paths)
└── openapi.yaml        Hand-maintained spec (deprecated, superseded by generated)
```

---

## Critical Rules

1. **Backend is the single source of truth.** API contracts, RBAC roles, and business rules are defined in `backend/`. All clients must align.
2. **Never weaken security**: biometrics, geofencing, RBAC, licensing controls, and the Governance Control Plane are non-negotiable.
3. **All changes must pass all CI gates** before merging to `main`.
4. **Design tokens** live in `design/tokens/faflow_design_tokens.json`; export to `frontend/src/tokens/designTokens.js` and `android/app/.../FaflowDesignTokens.kt`.
5. **OpenAPI spec** (`openapi_generated.yaml`) is generated from code via `scripts/generate_openapi.py`. A CI drift check verifies it.

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
npm run test:unit
npx playwright test     # 8/8 Playwright browser E2E tests across 5 user workflows
npm run build

# Android
cd ..\android
.\gradlew.bat testDebugUnitTest --no-daemon

# Contract parity gate & OpenAPI drift check
cd ..
backend\venv\Scripts\python.exe scripts\generate_openapi.py --check --out openapi_generated.yaml
backend\venv\Scripts\python.exe -X utf8 scripts\ci_contract_check.py `
  --openapi openapi_generated.yaml `
  --android android\app\src\main\java\com\governence\faflow `
  --frontend frontend\src `
  --report reports\contract_parity.json
```

---

## CI/CD Pipeline

`.github/workflows/ci.yml` runs on every push to `main`, `develop`, `optimize/full-audit`, and `redesign/light-professional`:

| Job | Trigger | Checks |
|---|---|---|
| `backend` | always | pytest (all 63 suites, 651 tests), pip-audit |
| `frontend` | always | tsc --noEmit, vitest unit tests, Playwright browser E2E, vite build |
| `android` | always | testDebugUnitTest, assembleDebug |
| `contract-parity` | after all three | OpenAPI drift check + ci_contract_check.py (0 HIGH, 0 MEDIUM = PASS) |
| `security-gate` | after backend | 8 security test files |
| `gate` | after all | Final merge gate (strict dependency on contract-parity, backend, frontend, android) |

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

## Light Professional Redesign Deliverables (Milestone 17)

| Phase | Report | Scope & Deliverable |
|---|---|---|
| 1 – UI/UX Audit | `docs/redesign/01_UI_UX_AUDIT.md` | Dark mode issues, contrast violations & inventory |
| 2 – Design System | `docs/redesign/02_DESIGN_SYSTEM.md` | Tokens (JSON, JS, Kotlin), semantic scales, WCAG AA compliance |
| 3 – Web Redesign | `docs/redesign/03_WEB_REDESIGN.md` | Institutional light theme, components, CSS variables |
| 4 – Android Redesign | `docs/redesign/04_ANDROID_REDESIGN.md` | Compose tokens, light surface palette, 48dp touch targets |
| 5 – Verification | `docs/redesign/05_VERIFICATION_REPORT.md` | CI gates, build verification, zero regression proof |
| 6 – E2E & A11y | `docs/redesign/06_MAKE_EVERYTHING_WORK.md` | Playwright suites (5 flows), contrast tests, runtime bug fixes |
| 7 – Final Release | `docs/redesign/07_FINAL_RELEASE_REPORT.md` | Delivery gate, CI/CD hardening, deployment diagnostic |

---

## Audit Report Index (Milestone 16)

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
