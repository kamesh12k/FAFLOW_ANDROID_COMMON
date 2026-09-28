# Phase 1: Comprehensive Project Reverse-Engineering & Architecture Analysis
**FAFLOW Monorepo (Milestone 16) — Unified Governance, Attendance & Operations Engine**
*Audited by: Principal Software Architect, UI/UX Lead, QA Lead*
*Branch: `optimize/full-audit`*
*Date: 2026-09-28*

---

## 1. Executive System Topology

FAFLOW is an enterprise institutional operational platform comprising three primary client/server subsystems powered by a single PostgreSQL relational database and unified business rules.

```mermaid
graph TB
    subgraph Clients["Client Tier"]
        WEB["React 18 + Vite Web App\n(Port 5173 / Admin & Staff Portals)"]
        AND["Android Client (Kotlin + Jetpack Compose)\n(Mobile Attendance & Biometrics)"]
    end

    subgraph Edge["Gateway & Middleware Layer"]
        CORS["CORS Policy Middleware"]
        AUTH_MD["JWT & RBAC Identity Extractor"]
        TENANT["Tenant Context (X-Department-ID)"]
        RATE["Rate Limiting & Safety Controls"]
    end

    subgraph Backend["FastAPI Core (Python 3.12)"]
        ROUTERS["35 Route Modules (777 Operations)"]
        SCHED["APScheduler (Campus Duties & Retention)"]
        SERVICES["45 Domain Service Modules"]
        MODELS["60 SQLAlchemy Relational Models"]
    end

    subgraph DataTier["Data & Storage Tier"]
        PG[("PostgreSQL 15+ / SQLite Test\n(60 Tables, Multi-tenant schemas)")]
        STORAGE["Encrypted Local Storage / S3 Adapter\n(Face Embeddings & Backups)"]
    end

    WEB -->|"HTTP / REST (Bearer JWT)"| CORS
    AND -->|"HTTP / REST (Bearer JWT)"| CORS
    CORS --> AUTH_MD --> TENANT --> RATE --> ROUTERS
    ROUTERS --> SERVICES
    SERVICES --> MODELS --> PG
    SERVICES --> STORAGE
    SCHED --> SERVICES
```

### 1.1 Subsystem Blueprint & Entry Points

| Subsystem | Directory | Tech Stack | Entry Point | Primary Build / Run Script |
|---|---|---|---|---|
| **Backend** | `backend/` | FastAPI, Python 3.12, SQLAlchemy 2.x, Pydantic v2 | `app/main.py:app` | `python -m uvicorn app.main:app --port 8000` |
| **Web Frontend** | `frontend/` | React 18.3, Vite 5.4, TailwindCSS 3.4, React Router 6 | `src/main.jsx` $\rightarrow$ `src/App.jsx` | `npm run build` / `npm run dev` |
| **Android Client** | `android/` | Kotlin 1.9, Jetpack Compose, CameraX, Moshi, Retrofit | `FaflowApplication.kt`, `MainActivity.kt` | `./gradlew assembleDebug` / `testDebugUnitTest` |
| **Database** | `database/` | PostgreSQL 15+, PL/pgSQL | `database/schema.sql` | `scripts/run_migration.py` |
| **Infrastructure** | `deployment/` | Docker, Nginx, Systemd | `docker-compose.yml`, `nginx_faflow.conf` | `run_linux.sh` |

### 1.2 Environment Variables & Configuration Inventory

| Component | Variable | Purpose | Default / Requirement |
|---|---|---|---|
| **Backend** | `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/faflow` |
| **Backend** | `SECRET_KEY` | HMAC-SHA256 signature key for JWT tokens | Mandatory in production; fallback for tests |
| **Backend** | `ALGORITHM` | JWT signing algorithm | `HS256` |
| **Backend** | `ACCESS_TOKEN_EXPIRE_MINUTES` | Token lifetime | `60` minutes (configured up to 1440 for dev) |
| **Backend** | `FRONTEND_ORIGIN` | Allowed CORS origins | JSON list (e.g. `["http://localhost:5173"]`) |
| **Backend** | `SKIP_DB_INIT` | Test flag to bypass live PostgreSQL bootstrap | Set during pytest runs to use in-memory SQLite |
| **Frontend** | `VITE_API_BASE_URL` | Backend API gateway URL | Defaults to `/api` or window hostname:8000 |
| **Android** | `BASE_URL` | Retrofit target gateway | Configured via `ApiConfig.kt` (`10.0.2.2:8000` or prod) |

---

## 2. Backend Subsystem Inventory

### 2.1 Route Modules & Tag Breakdown (777 Operations across 653 Paths)

FastAPI aggregates 35 router modules in `backend/app/routes/`. The active surface encompasses 777 operations mapped into the following domains:

```mermaid
pie title Operational Surface Distribution (777 Endpoints)
    "Campus Duties" : 66
    "Leaves & Balances" : 78
    "Student Attendance" : 50
    "Admin & User Ops" : 84
    "Campus Structure" : 42
    "Academic Calendar" : 38
    "Timetable & Substitution" : 56
    "Manager & Staff Portal" : 44
    "Governance Control Plane" : 62
    "Notifications & Announcements" : 62
    "Other Operations" : 195
```

#### Detailed Domain Route Summary:
1. **Campus Duties (`app/routes/campus_duties.py`, 66 ops)**: Duty generation, automatic teacher assignment, shift locks/unlocks, replacements, cross-department allocations, and discipline checks.
2. **Student Attendance (`app/routes/student_attendance.py`, 50 ops)**: Period rosters, normal scheduled attendance, autonomous emergency attendance, substitution-backed submissions, period-end corrections, offline sync batch ingestion, HOD/Principal multi-pane matrix views.
3. **Leaves & Balances (`app/routes/leaves.py`, `leave_balances.py`, 78 ops)**: Multi-tier leave submission, automated substitution checks, balance calculations, compensatory credit transactions, leave cancellations, and policy compliance audits.
4. **Campus Structure Builder (`app/routes/campus_structure.py`, `campus_operations.py`, 42 ops)**: Hierarchical blocks, floors, wings, rooms, smart autofill, duplicate floor blueprints, and spatial room allocations.
5. **Governance Control Plane (`app/routes/governance_control.py`, `governance_rules.py`, `system_control.py`, 62 ops)**: Feature entitlement licensing, business rules engine, strict/permissive enforcement toggles, timetable submission workflows, institution profiles.
6. **Academic Calendar & Day Orders (`app/routes/academic_calendar.py`, `day_order.py`, 44 ops)**: Working days, cycle schedules (6-day order), semester dates, holiday freezes, and institutional reporting.
7. **Security & Staff Identity (`app/routes/auth.py`, `teachers.py`, `staff.py`, `admin.py`, 84 ops)**: Credential onboarding, biometric policy enrollment, secondary admin RBAC delegation, system metrics, factory reset, and database backup/restore.

### 2.2 Models & Relational Architecture (60 SQLAlchemy Models)

The backend encapsulates 60 database entities in `backend/app/models/`. Core relational hubs include:

```mermaid
erDiagram
    INSTITUTION ||--o{ DEPARTMENT : contains
    DEPARTMENT ||--o{ USER : employs
    DEPARTMENT ||--o{ CLASS : owns
    DEPARTMENT ||--o{ SUBJECT : offers
    CLASS ||--o{ STUDENT : enrolls
    USER ||--o{ TIMETABLE_SLOT : teaches
    CLASS ||--o{ TIMETABLE_SLOT : schedules
    SUBJECT ||--o{ TIMETABLE_SLOT : covers
    TIMETABLE_SLOT ||--o{ ATTENDANCE_SESSION : generates
    ATTENDANCE_SESSION ||--o{ STUDENT_ATTENDANCE : records
    ATTENDANCE_SESSION ||--o{ ATTENDANCE_CORRECTION_AUDIT : logs
    USER ||--o{ LEAVE_REQUEST : submits
    LEAVE_REQUEST ||--o{ ALTER_ASSIGNMENT : substitutes
    USER ||--o{ STAFF_ATTENDANCE : logs_biometric
    USER ||--o{ CAMPUS_DUTY_ASSIGNMENT : fulfills
```

### 2.3 Middleware & Background Jobs

1. **Department Tenant Isolation (`get_tenant_department_id`)**:
   - Reads `X-Department-ID` header.
   - For `system_admin`, `principal`, and `governance`, enables scoped viewing while preserving institutional super-access.
   - For `admin` (HOD), strictly forces `current_user.department_id` to prevent cross-department data poisoning.
2. **APScheduler Background Jobs (`app/main.py`)**:
   - `_run_duty_auto_replace`: Executes daily at 09:00 and every 10 minutes between 09:00 and 16:00 to detect absentee duty officers and assign replacements.
   - Data retention automated purge: Cleans expired temporary tokens and sync logs according to `data_retention_service.py`.

---

## 3. Database Architecture & Schema Drift Analysis

### 3.1 Relational Schema Metrics
- **Total Tables in SQLAlchemy Models**: 60
- **Total Tables in Legacy `schema.sql`**: 24
- **Total Tables in Migrations (`002` through `012`)**: 20
- **Total Foreign Keys**: 118
- **Unindexed Foreign Keys Discovered**: 65

### 3.2 Schema Drift Findings: Models vs Migration Scripts

> [!WARNING]
> **CRITICAL DRIFT IDENTIFIED**: 28 out of 60 tables exist exclusively in SQLAlchemy Python models and have NO corresponding DDL in `database/schema.sql` or `database/migrations/*.sql`.

The missing DDL in SQL files includes:
1. **Announcements & Social Subsystem**: `announcements`, `announcement_acknowledgements`, `announcement_attachments`, `announcement_messages`, `announcement_reads`, `announcement_targets`, `message_mentions`, `message_reactions`.
2. **Student Attendance Subsystem**: `attendance_sessions`, `student_attendance`, `attendance_correction_audits`, `students`, `student_enrollments`, `class_roll_rules`, `class_roll_exceptions`.
3. **Campus Spatial Structure**: `campus_blocks`, `campus_floors`, `campus_geofences`.
4. **Licensing & Governance Control Plane**: `institutions`, `plan_definitions`, `feature_entitlements`.
5. **Staff Balances & Policies**: `leave_policies`, `teacher_leave_balances`, `leave_balance_transactions`, `biometric_policies`, `staff_attendance_records`.
6. **Intelligence & System Logging**: `academic_intelligence_events`, `system_audit_logs`.

**Root Cause**: The application relies on `Base.metadata.create_all(bind=engine)` at runtime (`app/main.py`), bypassing formal migration scripts for modules introduced in milestones 12 through 16. A production DBA running SQL migrations directly would produce an incomplete database.

---

## 4. Web Frontend Inventory

### 4.1 Architecture & State Structure
- **Framework**: React 18.3 + Vite 5.4 SPA.
- **Routing**: `react-router-dom` with 48 distinct page components and 11 route guards (`ProtectedRoute`, `AdminRoute`, `SystemAdminRoute`, `PrincipalRoute`, `GovernanceRoute`, `ManagerRoute`, `StaffRoute`, `TeacherRoute`, `GuestRoute`, `FirstLoginSetupRoute`, `RequireCredentialsSet`).
- **State Management**:
  - `AuthContext`: Token storage, active user session, role parsing, credentials reset enforcement.
  - `DepartmentContext`: Global tenant switcher for institutional admins (`active_department_id`).
  - `ToastProvider`: Micro-feedback notifications.
- **Data Transport**: Centralized Axios client (`frontend/src/api/client.js`) injecting Bearer JWT and `X-Department-ID`.
- **API Call Surface**: 359 API call invocation points mapped across 354 endpoint patterns.

### 4.2 Web Page Directory & Role Distribution

| Portal / Role | Routes / Pages | Key Capabilities |
|---|---|---|
| **Super Admin / Institutional Admin** | `/admin/*` (25 pages) | Teachers, Managers, Timetables, Approvals, Leaves, Credits, Subjects, Classes, Rooms, Departments, Setup Guide, Calendar, Metrics, Backups, Retention, Geofences, Biometrics, Campus Structure Builder, Duty Management. |
| **Principal** | `/principal`, `/principal/student-attendance` | Institutional executive dashboard, cross-department student attendance oversight, period matrices. |
| **HOD / Department Admin** | `/admin/attendance`, `/admin/student-attendance`, `/governance/timetable` | Timetable generation, leave approvals, class period correction, faculty substitutions. |
| **Manager** | `/manager/*` (5 pages) | Lab staff, non-teaching staff, operational directories, shift leaves. |
| **Teacher** | `/teacher/*` (9 pages) | Timetable view, 3-digit roll attendance, emergency attendance, leave applications, substitution preference, credits ledger, duty roster. |
| **Operational Staff** | `/staff/*` (2 pages) | My duties, biometric check-in confirmation, leave requests. |
| **Governance** | `/governance/*` | Policy configuration, business rules engine, period scheduling, submission locking. |
| **All Users** | `/announcements/*`, `/substitutions`, `/directory` | Real-time bulletin board, active substitutions, class schedules. |

---

## 5. Android Client Inventory

### 5.1 Architecture & Component Distribution
- **Target SDK**: Android 14+ (SDK 34), Min SDK 26, Kotlin 1.9.
- **UI Framework**: 100% Declarative Jetpack Compose (Zero legacy XML layouts in `src/main/res/layout`).
- **Dependency Injection**: `AppContainer.kt` lightweight manual container.
- **Network Stack**: Retrofit 2.11 + Moshi + OkHttp with token interceptors and dynamic base URL.
- **Total Retrofit Endpoints**: 90 `@GET`, `@POST`, `@PUT`, `@PATCH`, `@DELETE` calls in `FaflowApiService.kt`.

```mermaid
graph TD
    subgraph UI_Layer["UI Layer (Jetpack Compose)"]
        SCREENS["36 Screen Composables\n(Teacher, HOD, Biometrics, Attendance)"]
        VMS["10 ViewModels\n(StateFlow / SharedFlow)"]
    end

    subgraph Domain_Data["Data & Domain Layer"]
        REPOS["11 Repositories\n(StudentAttendance, Biometrics, Auth, Duties)"]
        LOCAL_DB["StudentAttendanceLocalDb (SQLite)\n(Outbox Queue & Entity Cache)"]
    end

    subgraph Hardware_Pipeline["Hardware & ML Pipeline"]
        CAM["CameraX Preview & ImageAnalysis"]
        FACE_DET["Face Detection & Quality (SCRFD / ML Kit)"]
        EMBED["MobileFaceNet Feature Extractor"]
    end

    subgraph Sync_Engine["Offline & Background Sync"]
        WM["WorkManager\n(StudentAttendanceSyncWorker, AttendanceSyncWorker)"]
        LIVE_SYNC["LiveNotificationSyncManager\n(15-second polling ticker)"]
    end

    SCREENS --> VMS
    VMS --> REPOS
    REPOS --> LOCAL_DB
    REPOS -->|"Retrofit 2.11"| NET["FaflowApiService"]
    CAM --> FACE_DET --> EMBED --> REPOS
    LOCAL_DB --> WM
    WM -->|"Offline Batch /sync"| NET
    LIVE_SYNC --> NET
```

### 5.2 Offline Synchronization & Storage Engine
- **Local Database**: `StudentAttendanceLocalDb.kt` (custom SQLiteOpenHelper).
- **Outbox Queue**: Durable `sync_outbox` table holding serialised operations:
  - `status`: `PENDING` $\rightarrow$ `SYNCING` $\rightarrow$ `SYNCED` $\rightarrow$ `FAILED`
  - Client-generated negative IDs for optimistic session creation (e.g. session `-123456`).
- **WorkManager Workers**:
  - `StudentAttendanceSyncWorker`: Ingests offline outbox queue to `POST /student-attendance/sync`.
  - `AttendanceSyncWorker`: Flushes staff geofence/biometric check-ins.
  - `NotificationSyncWorker`: Synchronizes unread badges.

### 5.3 Biometric & CameraX Face Pipeline
- **Pipeline Architecture**:
  1. `CameraPreviewView.kt` + `CameraAnalyzer.kt`: Captures YUV_420_888 frames at 30 FPS.
  2. `SCRFD / ML Kit`: Detects face bounding boxes and 5 facial landmarks (eyes, nose, mouth corners).
  3. Quality Assessment (`QualityValidator.kt`): Assesses illumination, sharpness, and head pose (yaw/pitch/roll $< 15^\circ$).
  4. Liveness Engine (`LivenessDetector.kt`): Passive texture and motion verification to prevent photo replay attacks.
  5. Feature Extractor (`EmbeddingExtractor.kt`): 512-dimensional normalized embedding vector.
  6. Matcher (`CosineSimilarityMatcher.kt`): Validates against enrolled biometric embedding with policy threshold (default $\ge 0.75$).

---

## 6. Canonical Business Rules & Enforcement Locations

| Business Rule Domain | Canonical Specification | Backend Enforcement | Web Client Enforcement | Android Enforcement |
|---|---|---|---|---|
| **Normal Student Attendance** | Only scheduled timetable teacher may submit for class/period. | `student_attendance_service.py` (`TimetableSlot` query, HTTP 403) | Filtered dropdowns, timetable slot picker | Today's schedule cards, direct slot launch |
| **Emergency Attendance** | Any teacher can take any class autonomously; immediately alerts HOD. | `student_attendance_service.py` (`_notify_hod_emergency_or_late`) | Dedicated "Emergency Attendance" modal | "Emergency Take Class" picker |
| **Substitution Validation** | `substitution_id` must match approved leave, target date, and slot. | `student_attendance_service.py` (strict validation, HTTP 400/403/404) | Injected via substitution cards | Injected via substitution queue |
| **Attendance Correction Window** | Teacher or class HOD can edit within period deadline; admin anytime. | `student_attendance_service.py` (deadline calculation + audit log) | Inline table editing with audit reason | Inline student roster toggle |
| **Staff Geofence Check-in** | Must be within approved campus polygon boundaries. | `geofence_service.py` (Ray-casting point-in-polygon) | Leaflet map polygon builder (Admin) | FusedLocationProvider + distance check |
| **Staff Biometric Verification** | Face embedding cosine similarity $\ge$ policy threshold. | `attendance_service.py` (vector matching or pass-through verification) | Admin test verification tool | CameraX + MobileFaceNet on-device match |
| **Timetable Submission Lock** | Submissions locked after deadline unless HOD/Governance grants grace. | `timetable_submission_service.py` | Visual submission locks and status pill | N/A (read-only view) |
| **Multi-Tier RBAC** | Strict role permissions; department scoping for HODs; super-admin bypass. | `app/core/dependencies.py` + DB CheckConstraints | Route Guards (`AdminRoute`, `TeacherRoute`, etc.) | Navigation visibility filters |

---

## 7. Ranked Technical Risks & Defect Inventory

### 7.1 Security Risks (Ranked by Severity)

1. **[CRITICAL] Plaintext/Weak Password Default Seeding**:
   - `database/seed.sql` contains default credentials across institutional roles. Initial deployments that do not enforce credential rotation immediately expose the system.
2. **[HIGH] Lack of Rate Limiting on Biometric Verification**:
   - `/attendance/check-in` and `/teachers/me/biometrics/enroll` do not have token-bucket rate limiters applied at the route level, leaving the endpoint susceptible to brute-force embedding replay.
3. **[MEDIUM] Unrestricted Multipart Backup Uploads**:
   - `/admin/backups/import` unpacks JSON archives. Maliciously crafted JSON files could consume excessive memory on smaller instances during restore parsing.

### 7.2 Performance & Database Risks (Ranked by Impact)

1. **[CRITICAL] 65 Unindexed Foreign Key Columns**:
   - In PostgreSQL, foreign keys do not create indexes automatically. High-frequency queries on `attendance_sessions(class_id)`, `student_attendance(session_id)`, `campus_duty_assignments(duty_id)`, and `announcement_reads(announcement_id)` trigger sequential scans during cascading deletes and relational joins.
2. **[HIGH] Missing Query Pagination in Reporting Routes**:
   - Endpoints like `/admin/audit-logs`, `/campus-duties/assignments`, and `/announcements` lack enforced cursor or offset pagination, risking high latency and memory pressure as institutional history grows.
3. **[MEDIUM] Redundant Dynamic Period Map Construction**:
   - While `_build_period_map` was optimized for student attendance, several timetable and campus duty endpoints still query `PeriodConfig` inside iteration loops.

### 7.3 Tech Debt & Duplication

1. **Schema Drift (28 Missing Migration Tables)**:
   - As documented in Section 3, missing DDL scripts prevent declarative database provisioning without executing the Python application layer.
2. **Hand-Written Client DTO Duplication**:
   - The web frontend (`services.js`) and Android app (`FaflowDtos.kt`) maintain 350+ manual API bindings and DTOs that are not generated from `openapi.yaml`, resulting in subtle casing and nullability drift.
3. **Dual Attendance Local Storage Systems on Android**:
   - Android has both `StudentAttendanceLocalDb.kt` (custom SQLite) and legacy shared preference caches for staff attendance, rather than a single unified storage architecture.

### 7.4 Dead Code Candidates

1. `backend/database/validate_and_import.py`: Legacy standalone import script superseded by `setup_guide_service.py` and `backup_service.py`.
2. `frontend/src/capture_screenshots_v2.cjs`: Scratch screenshot automation artifact present in source tree.
3. `backend/api_cross_reference.json`, `audit_routes.json`, `audit_summary.json`: Stale static audit artifacts in the backend root directory.

---

## 8. Verification & Test Baseline

At the conclusion of Phase 1 reverse engineering:
- **Backend Tests**: 642 / 642 passed (`pytest tests/ -q`)
- **Frontend Build**: Vite production bundle compiled in 8.60s (`npm run build`)
- **Android Tests**: Gradle unit test suite passed (`./gradlew testDebugUnitTest`)
- **Git Branch**: `optimize/full-audit`
