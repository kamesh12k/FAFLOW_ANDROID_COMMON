# Milestone 16: Repository Inventory

> Generated: 2026-09-02  
> Source A: `https://github.com/kamesh12k/FACULTY_FLOW.git` (Original FAFLOW)  
> Source B: `b:\android` (FAFLOW Staff Mobile + M9–M16 backend additions)  
> Target: `b:\FAFLOW_UNIFIED\`

---

## Top-Level Unified Structure

```
b:\FAFLOW_UNIFIED\
├── backend/          ← Original FAFLOW FastAPI + M9–M16 additions (merged)
├── frontend/         ← Original FAFLOW Web application (preserved as-is)
├── android/          ← FAFLOW Staff Mobile (Milestones 1–16)
├── database/         ← Original migrations, schema.sql, seed.sql
├── deployment/       ← Original PowerShell deployment scripts
├── docs/             ← Consolidated documentation
├── scripts/          ← Utility scripts from original repo
└── README.md         ← Unified product README
```

---

## Inventory Matrix

| Path | Type | Source | Decision | Reason |
|------|------|--------|----------|--------|
| `backend/app/main.py` | Python entrypoint | M16 enhanced | **KEEP (M16)** | M16 registers system_control, geofences, attendance routers |
| `backend/app/core/dependencies.py` | RBAC guards | M16 enhanced | **KEEP (M16)** | Adds require_system_admin, require_governance, require_manager |
| `backend/app/models/user.py` | ORM model | M16 enhanced | **KEEP (M16)** | Adds system_admin role, governance role, lab_staff, AdminLevel |
| `backend/app/models/campus_geofence.py` | ORM model | **NEW (M9–M16)** | **KEEP** | Circular/polygon geofence with spatial metadata |
| `backend/app/models/staff_attendance.py` | ORM model | **NEW (M9–M16)** | **KEEP** | Staff biometric attendance record |
| `backend/app/models/governance_control.py` | ORM model | **NEW (M16)** | **KEEP** | Institution, FeatureEntitlement, BiometricPolicy, SystemAuditLog |
| `backend/app/routes/geofences.py` | Route | **NEW (M9–M16)** | **KEEP** | Campus geofence CRUD (mutations: SYSTEM_ADMIN only) |
| `backend/app/routes/attendance.py` | Route | **NEW (M9–M16)** | **KEEP** | Staff biometric attendance check-in/check-out |
| `backend/app/routes/system_control.py` | Route | **NEW (M16)** | **KEEP** | Governance Control Plane /system/* endpoints |
| `backend/app/routes/governance.py` | Route | Original | **KEEP (ORIGINAL)** | Existing FAFLOW governance command center |
| `backend/app/routes/admin.py` | Route | M16 enhanced | **KEEP (M16)** | M16 added staff management |
| `backend/app/routes/auth.py` | Route | Original | **KEEP (ORIGINAL)** | FAFLOW authentication |
| `backend/app/routes/teachers.py` | Route | Original | **KEEP (ORIGINAL)** | Teacher profile and management |
| `backend/app/routes/leaves.py` | Route | Original | **KEEP (ORIGINAL)** | Leave application and management |
| `backend/app/routes/timetable.py` | Route | Original | **KEEP (ORIGINAL)** | Timetable management |
| `backend/app/routes/credits.py` | Route | Original | **KEEP (ORIGINAL)** | Leave credit tracking |
| `backend/app/routes/substitutions.py` | Route | Original | **KEEP (ORIGINAL)** | Substitution workflow |
| `backend/app/routes/notifications.py` | Route | Original | **KEEP (ORIGINAL)** | Push notifications |
| `backend/app/routes/backup.py` | Route | Original | **KEEP (ORIGINAL)** | Data backup |
| `backend/app/routes/campus_operations.py` | Route | Original | **KEEP (ORIGINAL)** | HOD and campus operations |
| `backend/app/routes/manager.py` | Route | Original | **KEEP (ORIGINAL)** | Manager dashboards |
| `backend/app/routes/staff.py` | Route | M16 enhanced | **KEEP (M16)** | Operational staff management |
| `backend/app/services/attendance_service.py` | Service | **NEW (M9–M16)** | **KEEP** | Biometric attendance business logic |
| `backend/app/services/geofence_service.py` | Service | **NEW (M9–M16)** | **KEEP** | Campus geofence operations |
| `backend/app/services/governance_control_service.py` | Service | **NEW (M16)** | **KEEP** | Institution/feature/policy management |
| `backend/app/services/governance_service.py` | Service | Original | **KEEP (ORIGINAL)** | FAFLOW Governance Command Center |
| `backend/app/schemas/geofence.py` | Schema | **NEW (M9–M16)** | **KEEP** | Geofence Pydantic schemas |
| `backend/app/schemas/governance_control.py` | Schema | **NEW (M16)** | **KEEP** | Governance control plane schemas |
| `backend/app/schemas/attendance.py` | Schema | **NEW (M9–M16)** | **KEEP** | Attendance Pydantic schemas |
| `backend/tests/` | Tests | M16 (all 41 files) | **KEEP (M16)** | Complete test suite covers original + M9–M16 |
| `backend/.env.example` | Config template | Original | **KEEP** | Safe to commit |
| `frontend/` | React/Vite Web | Original | **KEEP (ORIGINAL)** | Complete original FAFLOW Web application |
| `frontend/src/pages/teacher/` | Teacher pages | Original | **KEEP (ORIGINAL)** | 7 teacher workflow pages |
| `frontend/src/pages/admin/` | Admin pages | Original | **KEEP (ORIGINAL)** | 23 admin pages + dashboard |
| `frontend/src/pages/governance/` | Governance pages | Original | **KEEP (ORIGINAL)** | Governance command center UI |
| `frontend/src/api/` | API client | Original | **KEEP (ORIGINAL)** | `client.js` + `services.js` |
| `android/` | Android Studio project | FAFLOW Staff Mobile | **KEEP (MOBILE)** | Complete native attendance app |
| `android/app/src/main/java/` | Kotlin source | Milestones 1–16 | **KEEP (MOBILE)** | CameraX, SCRFD, ArcFace, geofencing |
| `android/app/src/main/assets/models/` | ML models | Milestones 1–16 | **KEEP (MOBILE)** | SCRFD, ArcFace ONNX models |
| `database/migrations/` | SQL migrations | Original | **KEEP (ORIGINAL)** | Alembic-compatible migration files |
| `database/schema.sql` | Schema snapshot | Original | **KEEP (ORIGINAL)** | Authoritative schema reference |
| `database/seed.sql` | Seed data | Original | **KEEP (ORIGINAL)** | Reference seed data |
| `deployment/` | PS1 scripts | Original | **KEEP (ORIGINAL)** | Production deployment automation |
| `docs/` | Unified docs | Both | **MERGED** | All milestone docs + original docs |
| `ARCHITECTURE.md` | Root doc | Original | **KEEP → docs/architecture/** | |
| `CHANGELOG.md` | Root doc | Original | **KEEP → docs/** | |
| `DATABASE.md` | Root doc | Original | **KEEP → docs/database/** | |
| `DEPLOYMENT.md` | Root doc | Original | **KEEP → docs/deployment/** | |
| `SECURITY.md` | Root doc | Original | **KEEP → docs/security/** | |
| `EULA.md` | Root doc | Original | **KEEP → docs/** | |
| `FAFLOW.bat` | Launcher | Original | **KEEP** | Windows dev launcher |
| `StartDev.bat` | Launcher | Original | **KEEP** | Dev environment startup |
| `StartProd.bat` | Launcher | Original | **KEEP** | Production startup |
| `.env` | Secrets | Original | **NEVER COMMITTED** | Not present in repo (correctly gitignored) |

---

## Files Intentionally NOT Migrated

| File | Reason |
|------|--------|
| `*/test.db` | SQLite test artifact, not committed |
| `*/__pycache__/` | Python bytecode, auto-generated |
| `*/.pytest_cache/` | Test cache, not committed |
| `android/.git/` | Git metadata, not duplicated into subdirectory |
| `android/app/release/*.apk` | Build artifact |
| Any `*.env` (non-example) | Security: must never commit real secrets |

---

## New Tables (M9–M16) vs Original FAFLOW Tables

| Table | Source | Notes |
|-------|--------|-------|
| `users` | Original | ENHANCED: +system_admin role, +governance, +lab_staff, +admin_level |
| `departments` | Original | Preserved as-is |
| `subjects` | Original | Preserved as-is |
| `classes` | Original | Preserved as-is |
| `timetable_slots` | Original | Preserved as-is |
| `leave_requests` | Original | Preserved as-is |
| `teacher_credits` | Original | Preserved as-is |
| `alter_assignments` | Original | Preserved as-is |
| `notifications` | Original | Preserved as-is |
| `audit_logs` | Original | Preserved as-is |
| `campus_geofences` | **NEW (M9)** | Circular + polygon geofence records |
| `staff_attendance_records` | **NEW (M9)** | Biometric attendance records |
| `institutions` | **NEW (M16)** | Tenant/institution registry |
| `feature_entitlements` | **NEW (M16)** | Per-institution feature flags |
| `biometric_policies` | **NEW (M16)** | Per-institution biometric control |
| `system_audit_logs` | **NEW (M16)** | Immutable governance action log |
| `plan_definitions` | **NEW (M16)** | Subscription plan definitions |
