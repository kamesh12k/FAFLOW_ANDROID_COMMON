# FAFLOW — Existing Project Hierarchy & Architecture Report

**Document Version:** 3.0.0-AUDIT  
**Audit Type:** Deep Codebase Architecture & Hierarchy Analysis (READ-ONLY)  
**Date:** 2026-08-14  
**Target Repository:** `FACREDIT-enhanced-20260724-v5`  
**Purpose:** Comprehensive baseline analysis to ensure the safe, non-destructive implementation of the upcoming **Manager Role** (managing Lab Staff and Non-Teaching Staff without academic or RBAC privileges).

---

## 1. Executive Summary

FAFLOW (Faculty Flow / Credit Management System) is an enterprise-grade academic workload distribution, timetable scheduling, leave management, and substitution allocation system built for higher education institutions. The system models an institution's complete operational lifecycle—from academic year and semester definitions, Day Order calendar rotations, and multi-department course/room assignments to autonomous substitute recommendation/execution, faculty workload balance auditing, and administrative governance.

### Core Objectives of Current System:
1. **Academic Scheduling & Timetable Management:** 5-period daily teaching schedule across a 6-day Day Order rotation cycle.
2. **Leave Management & Coverage Routing:** Teacher-initiated or admin-forced leave applications with multi-tier substitution mechanisms:
   - **Manual Mode:** Admin manually selects and assigns available faculty.
   - **Assisted Mode:** Scored recommendation engine ranks eligible substitute teachers based on subject compatibility, department alignment, and historical workload fairness.
   - **Autonomous Mode:** Zero-click automated engine immediately assigns and locks substitutes upon leave approval, complete with conflict resolution and auto-swapping.
3. **Credit Workload Balancing:** Dynamic ledger accounting of faculty credits (`+1` for substitution class, `-1` for leave covered), ensuring equitable workload distribution.
4. **Hierarchical Multi-Tenancy & Governance:** Strict role-based access control (RBAC) isolating department data (HODs/Teachers) while enabling college-wide oversight (System Admin, Principal).

---

## 2. Project Directory Hierarchy

```text
FACREDIT-enhanced-20260724-v5/
├── backend/
│   ├── app/
│   │   ├── core/
│   │   │   ├── dependencies.py          # FastAPI dependency injection (Auth, RBAC, Dept scoping)
│   │   │   ├── exceptions.py            # Custom domain exception handlers
│   │   │   ├── security.py              # JWT encoding/decoding, bcrypt password hashing & policy
│   │   │   └── traffic.py               # In-memory traffic & latency monitoring manager
│   │   ├── models/                      # SQLAlchemy ORM models (19 relational tables)
│   │   │   ├── academic_calendar.py     # AcademicYear, Semester
│   │   │   ├── audit_log.py             # AuditLog table (JSONB details)
│   │   │   ├── class_.py                # Class model (name, section, semester, dept_id)
│   │   │   ├── credit.py                # TeacherCredit balance, CreditTransaction ledger
│   │   │   ├── day_order_calendar.py    # CalendarDay (working, holiday, exam, day_order 1-6)
│   │   │   ├── department.py            # Department model (id, name, code)
│   │   │   ├── leave.py                 # LeaveRequest, AlterAssignment
│   │   │   ├── notification.py          # In-app Notification, Web PushSubscription
│   │   │   ├── room.py                  # Room model (classroom, lab, capacity)
│   │   │   ├── subject.py               # Subject model (theory, lab, credits, semester)
│   │   │   ├── substitution_preference.py # Teacher substitution preferences & hard caps
│   │   │   ├── system_setting.py        # Key-value runtime configurations per department
│   │   │   ├── timetable.py             # TimetableSlot (teacher, subject, class, room, day_order, period)
│   │   │   ├── timetable_submission.py  # Teacher-submitted timetable drafts
│   │   │   └── user.py                  # User model (Role, AdminLevel, credentials, status)
│   │   ├── routes/                      # 17 FastAPI Route Controllers
│   │   │   ├── academic_calendar.py     # Calendar days, holidays, day orders, workload reports
│   │   │   ├── admin.py                 # Secondary admins, audit logs, reset, global users, metrics
│   │   │   ├── auth.py                  # Login, registration, credential rotation
│   │   │   ├── campus_operations.py     # Operations mode (manual/assisted/autonomous), preferences
│   │   │   ├── classes.py               # Class CRUD, directory, class-faculty mappings
│   │   │   ├── credits.py               # Credit transactions, reports, manual adjustments
│   │   │   ├── day_order.py             # Legacy day-order endpoints
│   │   │   ├── departments.py           # Department CRUD and HOD initialization
│   │   │   ├── leaves.py                # Leave applications, approvals, substitute assignments
│   │   │   ├── notifications.py         # Notifications, unread counts, web push
│   │   │   ├── principal.py             # Principal aggregate dashboard analytics
│   │   │   ├── rooms.py                 # Room CRUD and room availability dashboard
│   │   │   ├── subjects.py              # Subject CRUD, archiving
│   │   │   ├── substitutions.py         # Today's substitution timeline & coverage status
│   │   │   ├── teacher_substitution.py  # Teacher self-service substitution delegation
│   │   │   ├── teachers.py              # Teacher CRUD, credits balance, profile
│   │   │   └── timetable.py             # Timetable CRUD, bulk upload, teacher submissions
│   │   ├── schemas/                     # Pydantic validation & response schemas
│   │   │   ├── academic_calendar.py
│   │   │   ├── admin.py
│   │   │   ├── class_.py
│   │   │   ├── credit.py
│   │   │   ├── department.py
│   │   │   ├── leave.py
│   │   │   ├── notification.py
│   │   │   ├── room.py
│   │   │   ├── subject.py
│   │   │   ├── substitution.py
│   │   │   ├── timetable.py
│   │   │   └── user.py
│   │   ├── services/                    # Core business logic domain services
│   │   │   ├── academic_calendar_service.py
│   │   │   ├── admin_service.py
│   │   │   ├── auth_service.py
│   │   │   ├── class_directory_service.py
│   │   │   ├── class_service.py
│   │   │   ├── credit_service.py
│   │   │   ├── day_order_service.py
│   │   │   ├── department_service.py
│   │   │   ├── factory_reset_service.py
│   │   │   ├── leave_service.py
│   │   │   ├── master_export_service.py
│   │   │   ├── notification_service.py
│   │   │   ├── report_service.py
│   │   │   ├── room_service.py
│   │   │   ├── subject_service.py
│   │   │   ├── substitution_dashboard_service.py
│   │   │   ├── substitution_service.py
│   │   │   ├── summary_service.py
│   │   │   ├── system_setting_service.py
│   │   │   ├── teacher_substitution_service.py
│   │   │   ├── timetable_service.py
│   │   │   └── timetable_submission_service.py
│   │   ├── config.py                    # Pydantic BaseSettings (.env integration)
│   │   ├── database.py                  # SQLAlchemy engine, sessionmaker, get_db
│   │   └── main.py                      # FastAPI application entrypoint, CORS, rate limiter, middlewares
│   ├── tests/                           # 424 Unit & Integration Tests (Pytest)
│   ├── backups/                         # Factory reset JSON snapshot storage
│   ├── logs/                            # Durable filesystem audit logs
│   ├── requirements.txt                 # Backend Python package requirements
│   └── seed.sql                         # Initial database seed dataset
├── database/
│   ├── migrations/                      # Incremental SQL migration scripts (001 to 007)
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_add_rbac_and_audit.sql
│   │   ├── 003_academic_calendar.sql
│   │   ├── 004_autonomous_substitution.sql
│   │   ├── 005_add_cancelled_leave_status.sql
│   │   ├── 006_multi_department.sql
│   │   └── 007_performance_indexes.sql
│   └── schema.sql                       # Full production PostgreSQL schema definition
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.js                # Axios instance, Bearer token & X-Department-ID injection
│   │   │   └── services.js              # Strongly-typed API client service methods
│   │   ├── components/
│   │   │   ├── layout/                  # Responsive AppShell, Sidebar, TopBar, BottomNav, MobileDrawer
│   │   │   ├── ui/                      # Modal, Badge, Toast, Button, Input, Table, StatCard
│   │   │   └── icons/                   # SVG icon system
│   │   ├── context/
│   │   │   ├── AuthContext.jsx          # Auth state, login/logout, role booleans
│   │   │   ├── DepartmentContext.jsx    # Active department switcher context (for System Admin)
│   │   │   └── ThemeContext.jsx         # UI theme & branding customization state
│   │   ├── pages/
│   │   │   ├── admin/                   # 16 Administrator Views (Dashboard, Timetable, Leaves, Calendar, etc.)
│   │   │   ├── auth/                    # Login, Register, FirstLoginSetup
│   │   │   ├── common/                  # ClassDirectory, ClasswiseTimetable, TodaySubstitutions
│   │   │   └── teacher/                 # 7 Teacher Views (Dashboard, Timetable, Leave, Credits, etc.)
│   │   ├── routes/
│   │   │   └── Guards.jsx               # ProtectedRoute, AdminRoute, PrincipalRoute, TeacherRoute
│   │   ├── App.jsx                      # Main routing tree and provider wrappers
│   │   ├── index.css                    # Tailwind CSS definitions & custom styling tokens
│   │   └── main.jsx                     # React DOM root mounting
│   ├── package.json                     # Frontend Node dependencies (React 18, Vite 5, Tailwind 3)
│   ├── tailwind.config.js               # Tailwind design system configuration
│   └── vite.config.js                   # Vite bundler configuration & /api proxy
├── docs/                                # Technical & User Manuals, QA Certification Reports
└── README.md
```

---

## 3. Technology Stack

### 3.1 Frontend Stack
* **Framework:** React 18.3.1 (Single Page Application architecture)
* **Build Tool:** Vite 5.2.13 (ESM-based HMR, Rollup production bundling)
* **Routing:** `react-router-dom` 6.23.1
* **HTTP Client:** `axios` 1.7.2 (with request/response interceptors for JWT & multi-tenant headers)
* **Styling & Design System:** Tailwind CSS 3.4.4, PostCSS 8.4.38, Autoprefixer 10.4.19
* **Document Generation:** `jspdf` 4.2.1 (client-side PDF timetable exports)
* **Icons:** Custom scalable SVG icon library

### 3.2 Backend Stack
* **Web Framework:** FastAPI 0.139.0 (Asynchronous ASGI framework)
* **ASGI Server:** Uvicorn 0.51.0
* **Data Validation & Settings:** Pydantic 2.13.4 & `pydantic-settings` 2.14.2
* **ORM & Database Toolkit:** SQLAlchemy 2.0.51 (Declarative base, relationship graph, connection pooling)
* **Database Driver:** `psycopg2-binary` 2.9.12 (PostgreSQL) / SQLite engine for unit tests
* **Authentication & Cryptography:** `bcrypt` 5.0.0 (direct C-extension hashing, 12 rounds), `python-jose` 3.5.0 (JWT HS256)
* **Rate Limiting:** `slowapi` 0.1.10 (memory/redis token-bucket rate limiting)
* **Excel Processing:** `openpyxl` 3.1.5 (Master Accountability Workbook export)
* **Database Migrations:** Alembic 1.18.5 + custom SQL migration runner

### 3.3 Database & Storage
* **RDBMS Engine:** PostgreSQL 14+ (Production) / SQLite 3 (Testing)
* **Connection Pooling:** SQLAlchemy QueuePool (`pool_size=50`, `max_overflow=30`, `pool_pre_ping=True`, `pool_recycle=300s`, `pool_timeout=30s`)
* **State & Audit Storage:** Relational SQL tables + durable filesystem backup directory (`backend/backups/`) and log trail (`backend/logs/`).

---

## 4. Backend Architecture & Dependency Flow

The backend follows a strict layered architectural pattern:

```text
HTTP Request
     │
     ▼
FastAPI Route Controllers (app/routes/*.py)
     │   ├── Dependency Injection (get_current_user, require_admin, get_tenant_department_id)
     │   └── Pydantic Request Validation & Serialization (app/schemas/*.py)
     │
     ▼
Domain Services (app/services/*.py)
     │   ├── Business Rules & Validation
     │   ├── Autonomous Scoring & Conflict Detection
     │   └── Transaction Management & Audit Event Logging
     │
     ▼
ORM Layer (app/models/*.py)
     │   ├── Entity Definitions & Relationships
     │   └── Integrity & Check Constraints
     │
     ▼
PostgreSQL Engine (app/database.py)
```

### Dependency Injection Pipeline:
1. `bearer_scheme = HTTPBearer()` extracts the token from the `Authorization: Bearer <token>` header.
2. `get_current_user`: Decodes JWT payload (`sub: user_id`), queries `users` table, verifies `is_active == True`.
3. `require_credentials_set`: Enforces `must_change_credentials == False`. Bounces uninitialized accounts with `403 FORBIDDEN (detail="MUST_CHANGE_CREDENTIALS")`.
4. Role-specific guards:
   - `require_system_admin`: Verifies `user.role == Role.system_admin`.
   - `require_super_admin`: Verifies `user.role == Role.system_admin` OR `(user.role == Role.admin AND user.admin_level == AdminLevel.super_admin)`.
   - `require_admin`: Verifies `user.role in (Role.admin, Role.system_admin, Role.principal)`. If `Role.principal`, rejects any non-`GET` mutation with `403 Principal accounts are read-only`.
   - `require_principal`: Verifies `user.role == Role.principal`.
   - `require_teacher`: Verifies `user.role in (Role.teacher, Role.admin, Role.system_admin)`.
5. `get_tenant_department_id`:
   - For `system_admin` & `principal`: Reads `X-Department-ID` header (returns `int` if valid, or `None` for global view).
   - For `admin` (HOD) & `teacher`: Strictly returns `current_user.department_id`, completely ignoring client-supplied headers.

---

## 5. Frontend Architecture & Data Flow

The frontend is structured around reactive contexts, route-level protection gates, and modular presentation components.

```text
User Action / URL Change
     │
     ▼
App.jsx (Router Tree)
     │
     ├── GuestRoute / FirstLoginSetupRoute / RequireCredentialsSet
     └── Protected Role Routes (AdminRoute, PrincipalRoute, TeacherRoute)
              │
              ▼
         AppShell Layout
              ├── TopBar (Day Order badge, Dept Switcher, Theme Switcher, Search)
              ├── Sidebar (Desktop Navigation, User Profile, Sign Out)
              ├── MobileDrawer (Slide-out navigation for viewports < 1024px)
              ├── BottomNav (Quick navigation bar for mobile viewports)
              └── <Outlet /> (Page Component)
                       │
                       ▼
                  Page Component
                       ├── Axios API Service Call (app/api/services.js)
                       ├── Injected Headers: 'Authorization: Bearer' + 'X-Department-ID'
                       └── Local State Rendering & Toast Notifications
```

### Context Providers Hierarchy:
1. `AuthProvider`: Holds `user`, `token`, `login()`, `logout()`, and computed role booleans (`isAdmin`, `isSystemAdmin`, `isPrincipal`, `isSuperAdmin`, `isSecondaryAdmin`, `mustChangeCredentials`).
2. `DepartmentProvider`: Manages the active department workspace for `system_admin`. Synchronizes `active_department_id` with `localStorage` and provides `effectiveDepartmentId`.
3. `ThemeProvider`: Customizes UI accent colors, presets, and branding metadata dynamically loaded from `/settings/public`.
4. `ToastProvider`: Manages non-blocking UI alert toasts across all views.

---

## 6. Authentication Architecture

### 6.1 Authentication Mechanism
* **Token Type:** JSON Web Token (JWT), HS256 signed.
* **Payload Structure:** `{"sub": "<user_id>", "role": "<role>", "exp": <unix_timestamp>}`.
* **Expiry:** Configured via `ACCESS_TOKEN_EXPIRE_MINUTES` (Default: 60 minutes).
* **Storage:** Client `localStorage` under `credits_token` and `credits_user`.

### 6.2 Dual-Credential Identity Model
The database enforces a strict dual-credential model (`chk_user_identity`):
1. **Teaching Staff (`role='teacher'`):** Authenticate using **`email`** (e.g., `teacher@college.edu`) and password.
2. **Administrative Users (`role IN ('admin', 'system_admin', 'principal')`):** Authenticate using **`username`** (e.g., `admin`, `hod_cse`, `principal`) and password.

### 6.3 Password Hashing & Security Policy
* **Algorithm:** Direct `bcrypt.hashpw` with 12 salt rounds (bypassing passlib version trap).
* **Byte Limit:** Enforces hard 72-byte UTF-8 maximum length (`BCRYPT_MAX_BYTES = 72`).
* **Strength Policy (`validate_password_strength`):**
  - Minimum 8 characters.
  - Must contain at least one letter and one numeral.
  - Forbids default bootstrap string (`admin`) on rotation.
* **First-Login Force Rotation:**
  - Any bootstrapped or admin-created user starts with `must_change_credentials = True`.
  - Backend route guards reject all operational API calls with `403 FORBIDDEN (MUST_CHANGE_CREDENTIALS)`.
  - Frontend `RequireCredentialsSet` redirects the browser to `/first-login-setup`.
  - Only endpoint accessible during setup: `POST /admin/first-login/setup`.

---

## 7. RBAC Architecture & Matrix

### Current System Roles:
1. `system_admin`: Global institution owner with complete administrative access.
2. `admin` (with `admin_level='super_admin'`): Department Head (HOD) managing a single department.
3. `admin` (with `admin_level='secondary_admin'`): Department Vice-HOD / Coordinator assisting the HOD.
4. `principal`: Executive College Head with global read-only visibility.
5. `teacher`: Teaching faculty member scoped to departmental classes and workload.

### RBAC Permission Matrix

| Capability / API Domain | System Admin | Principal (Read-Only) | HOD (Super Admin) | Secondary Admin | Teacher |
|---|:---:|:---:|:---:|:---:|:---:|
| **Institution Configuration & Branding** | Full | Read | None | None | None |
| **Department Management (Create/Delete)** | Full | Read | None | None | None |
| **Global User Management (Principal/HODs)** | Full | Read | None | None | None |
| **Department Scope Switching** | Full (Global) | Full (Global) | Scoped to Own Dept | Scoped to Own Dept | Scoped to Own Dept |
| **Secondary Admin Management (Create/Disable)** | Full | None | Scoped to Own Dept (Max 3) | None | None |
| **Academic Calendar Setup (Years/Semesters)** | Full | Read | Read | Read | Read |
| **Holiday & Day Order Marking** | Full | Read | Scoped | Scoped | Read |
| **Curriculum Setup (Subjects, Classes, Rooms)** | Full | Read | Scoped | Scoped | Read |
| **Timetable Generation & Slot Assignment** | Full | Read | Scoped | Scoped | Read (Own Submit) |
| **Timetable Submission Review (Teacher Mode)** | Full | Read | Scoped | Scoped | None |
| **Leave Approval & Substitute Assignment** | Full | Read | Scoped | Scoped | None |
| **Autonomous Operations Mode Override** | Full (Global) | Read | Scoped to Own Dept | Scoped to Own Dept | None |
| **Credit Adjustments & Ledger Management** | Full | Read | Scoped | Scoped | Read (Own) |
| **Factory Reset / Global Wipe** | Full (System-wide) | None | Scoped (Dept only) | None | None |
| **Audit Logs Inspection** | Full (All Depts) | Read | Scoped (Own Dept) | Scoped (Own Dept) | None |
| **System Performance & Traffic Metrics** | Full | None | None | None | None |

---

## 8. Current Role & User Hierarchy

```text
                      ┌─────────────────────────────────┐
                      │          System Admin           │
                      │     (Global Institution Owner)  │
                      └────────────────┬────────────────┘
                                       │
                ┌──────────────────────┴──────────────────────┐
                ▼                                             ▼
  ┌───────────────────────────┐                 ┌───────────────────────────┐
  │         Principal         │                 │    HOD / Department Admin │
  │    (Global Read-Only)     │                 │   (Super Admin per Dept)  │
  └───────────────────────────┘                 └─────────────┬─────────────┘
                                                              │
                                                ┌─────────────┴─────────────┐
                                                ▼                           ▼
                                  ┌───────────────────────────┐ ┌───────────────────────────┐
                                  │      Secondary Admin      │ │      Teaching Faculty     │
                                  │    (Max 3 per Department) │ │         (Teacher)         │
                                  └───────────────────────────┘ └───────────────────────────┘
```

---

## 9. Department / Data Scoping Enforcements

FAFLOW enforces multi-tenant departmental isolation at three defense tiers:

### 1. Database Layer (Check Constraints & Foreign Keys)
* `chk_user_department_role`:
  ```sql
  CONSTRAINT chk_user_department_role CHECK (
      (role IN ('system_admin', 'principal') AND department_id IS NULL) OR
      (role IN ('admin', 'teacher') AND department_id IS NOT NULL)
  );
  ```
  - `system_admin` and `principal` MUST have `department_id = NULL`.
  - `admin` and `teacher` MUST have `department_id IS NOT NULL`.

### 2. Dependency Injection Layer (`get_tenant_department_id`)
* When an endpoint requires `tenant_department_id`:
  - If `current_user.role IN ('system_admin', 'principal')`, it inspects the request header `X-Department-ID`. If present and valid, returns that integer; otherwise returns `None` (view all).
  - If `current_user.role IN ('admin', 'teacher')`, it unconditionally returns `current_user.department_id`.

### 3. Service Layer Query Filtering
* Every administrative query explicitly includes:
  ```python
  if tenant_department_id is not None:
      query = query.filter(Model.department_id == tenant_department_id)
  ```
* Cross-department entity lookups (e.g. assigning a teacher from another department or editing another department's subject) raise `403 FORBIDDEN ("Access denied: entity belongs to another department")`.

---

## 10. Database Architecture & Table Inventory

The schema consists of **19 relational tables**:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 FAFLOW DATABASE SCHEMA                                 │
└────────────────────────────────────────────────────────────────────────────────────────┘
  1. users                    - Core user table (credentials, roles, status, dept_id)
  2. departments              - Academic departments (name, code)
  3. subjects                 - Course subjects (code, name, type, credits, semester, dept_id)
  4. classes                  - Class sections (name, section, semester, dept_id)
  5. rooms                    - Facilities (room_number, room_type, capacity, dept_id)
  6. academic_years           - Academic year timeline containers (name, start_date, end_date)
  7. semesters                - Date-bound academic terms (academic_year_id, name, dates)
  8. calendar_days            - Daily calendar state (date, day_type, day_order 1-6, is_override)
  9. timetable_slots          - Official scheduled classes (teacher, subject, class, room, slot)
 10. timetable_submissions    - Draft timetable proposals submitted by teachers
 11. leave_requests           - Faculty leave applications (date, period, day_order, status)
 12. alter_assignments        - Substitute assignments linked to approved leaves
 13. substitution_preferences - Teacher-level substitution caps and scoring preferences
 14. teacher_credits          - Real-time credit balance cache per teacher
 15. credit_transactions      - Immutable credit transaction audit ledger
 16. notifications            - User in-app notification messages
 17. push_subscriptions       - Browser Web Push notification endpoints & keys
 18. audit_logs               - Administrative mutation event history with JSONB payload
 19. system_settings          - Key-value runtime configurations per department / system
```

---

## 11. User / Staff Data Model

The `User` model currently represents only Academic & Administration staff:

```python
class Role(str, enum.Enum):
    system_admin = "system_admin"
    admin = "admin"
    teacher = "teacher"
    principal = "principal"

class AdminLevel(str, enum.Enum):
    super_admin = "super_admin"
    secondary_admin = "secondary_admin"
```

### Absence of Non-Academic Staff:
* There is **no entity or role** currently representing **Laboratory Staff (Lab Technicians, Lab Assistants)** or **Non-Teaching Staff (Clerks, Office Assistants, Peons, Attenders)**.
* All faculty logic in `substitution_service.py`, `credit_service.py`, and `timetable_service.py` is hard-coupled to `Role.teacher`.

---

## 12. System Admin Workflow

1. **Bootstrap & Setup:**
   - Logs in with initial `admin` / `admin` credentials, completes `/first-login-setup` to establish permanent credentials.
2. **Department Initialization:**
   - Navigates to `/admin/departments`, creates institution departments (e.g., Computer Science, Mechanical).
   - Creates HOD accounts (`create_department_super_admin`) for each department.
   - Creates the College Principal account (`create_principal_account`).
3. **Multi-Department Context Switching:**
   - Selects specific department workspaces from the TopBar switcher or views aggregated global records.
4. **Institutional Oversight:**
   - Views real-time server traffic metrics and database connection health (`/admin/system-metrics`).
   - Downloads institution-wide Master Accountability Workbooks (`/admin/master-export`).
   - Executes global factory resets when necessary (`/admin/factory-reset`).

---

## 13. Principal Workflow

1. **Executive Sign-in:** Authenticates via username.
2. **Global Analytics Dashboard:**
   - Navigates to `/principal/dashboard`, reviewing aggregate metrics:
     * College-wide faculty leave counts and substitute coverage rate.
     * Department-by-department workload balance, active teachers, and pending leaves.
3. **Institutional Timetable Inspection:**
   - Views `/principal/class-timetable` to inspect class schedules across all departments.
4. **Read-Only Enforcement:**
   - The backend actively blocks all `POST`, `PUT`, `PATCH`, `DELETE` requests from the Principal with `403 Principal accounts are read-only`.

---

## 14. HOD / Department Admin Workflow

1. **Staff & Curriculum Management:**
   - Adds teaching faculty (`/admin/teachers`).
   - Configures subjects, classes, and rooms (`/admin/subjects`, `/admin/classes`, `/admin/rooms`).
   - Appoints up to 3 Secondary Admins to assist with administrative duties (`/admin/settings`).
2. **Timetable Assembly:**
   - Builds departmental master timetable (`/admin/timetable`) or reviews teacher timetable draft submissions (`/admin/timetable/approvals`).
3. **Leave & Substitution Governance:**
   - Configures Campus Operations Mode (`manual`, `assisted`, `autonomous`) in `/admin/settings`.
   - Reviews leave requests (`/admin/leaves`), approves/rejects, and reviews AI-assisted substitute recommendations.
   - Adjusts faculty credit balances for non-class duties (`/admin/credits`).

---

## 15. Teacher Workflow

1. **Sign-in & Profile:** Authenticates via email.
2. **Timetable View & Submission:**
   - Views personal daily/weekly schedule (`/teacher/timetable`).
   - Submits timetable slot requests if teacher timetable entry mode is enabled.
3. **Leave Application:**
   - Applies for single or multi-period leaves (`/teacher/leave/apply`).
   - Tracks leave status and assigned substitutes in `/teacher/leaves`.
4. **Self-Service Substitution (if enabled):**
   - In Teacher Substitution Mode, selects eligible colleagues to cover upcoming leaves (`/teacher/substitution`).
5. **Credit & Preference Tracking:**
   - Monitors credit balance and ledger transactions (`/teacher/credits`).
   - Sets substitution preferences and maximum weekly substitution caps (`/teacher/preferences`).

---

## 16. Complete API Inventory

### Auth Controller (`/auth`)
* `POST /auth/login` - Authenticate user (email or username) + rate limited.
* `POST /auth/register` - Self-register teacher.
* `GET /auth/me` - Retrieve authenticated user profile.
* `POST /auth/change-password` - Rotate user password.

### Admin Controller (`/admin`)
* `GET /admin/master-export` - Download XLSX master workbook (System Admin only).
* `POST /admin/first-login/setup` - First-time credential change.
* `GET /admin/secondary-admins` - List department secondary admins.
* `POST /admin/secondary-admins` - Create secondary admin (Max 3).
* `PATCH /admin/secondary-admins/{id}/enable` - Enable secondary admin.
* `PATCH /admin/secondary-admins/{id}/disable` - Disable secondary admin.
* `GET /admin/audit-logs` - Retrieve scoped audit event logs.
* `POST /admin/factory-reset` - Full system or department data wipe.
* `POST /admin/clear-credits-history` - Clear credit transaction ledger.
* `POST /admin/clear-leaves-history` - Clear leave requests & alter assignments.
* `POST /admin/principal` - Create principal account (System Admin only).
* `GET /admin/global-users` - List HODs & Principal (System Admin only).
* `DELETE /admin/global-users/{id}` - Delete HOD or Principal.
* `GET /admin/system-metrics` - Real-time traffic & DB performance.
* `POST /admin/system-metrics/clear-traffic` - Clear traffic buffer.

### Department Controller (`/departments`)
* `GET /departments/` - List departments.
* `POST /departments/` - Create department (System Admin only).
* `PATCH /departments/{id}` - Update department name/code.
* `DELETE /departments/{id}` - Delete department (System Admin only).
* `POST /departments/{id}/admin` - Create department Super Admin (HOD).

### Teachers Controller (`/teachers`)
* `GET /teachers/` - List department teachers.
* `POST /teachers/` - Create teacher account.
* `GET /teachers/me` - Get current teacher profile.
* `GET /teachers/{id}/credits` - Get teacher credit balance.
* `PUT /teachers/{id}` - Update teacher details.
* `DELETE /teachers/{id}` - Delete teacher and cascade cleanup associated records.

### Timetable Controller (`/timetable`)
* `POST /timetable/slot` - Create individual timetable slot.
* `POST /timetable/` - Bulk upload timetable slots.
* `GET /timetable/teacher/{id}` - Get timetable by teacher.
* `GET /timetable/class/{id}` - Get timetable by class.
* `DELETE /timetable/{id}` - Delete timetable slot.
* `DELETE /timetable/teacher/{id}` - Delete entire teacher timetable.
* `POST /timetable/submissions` - Teacher draft submission.
* `GET /timetable/submissions/my` - List teacher's submissions.
* `GET /timetable/submissions/pending` - List pending submissions for review.
* `POST /timetable/submissions/{id}/review` - Approve/reject submission.
* `POST /timetable/submissions/bulk-review` - Bulk review submissions.
* `DELETE /timetable/submissions/{id}` - Cancel/withdraw submission.

### Leaves Controller (`/leaves`)
* `POST /leaves/` - Apply for single period leave.
* `POST /leaves/batch` - Apply for multi-period or whole-day leave.
* `GET /leaves/` - List all department leaves (Admin).
* `GET /leaves/my` - List teacher's own leaves.
* `PATCH /leaves/{id}/approve` - Approve leave.
* `PATCH /leaves/{id}/reject` - Reject leave.
* `POST /leaves/bulk-approve` - Bulk approve leaves.
* `POST /leaves/bulk-reject` - Bulk reject leaves.
* `POST /leaves/{id}/assign` - Manually assign substitute.
* `GET /leaves/{id}/recommendations` - Get scored substitute recommendations.
* `POST /leaves/{id}/assign-recommended` - Assign recommended substitute.
* `POST /leaves/{id}/override` - Override substitute assignment.
* `POST /leaves/{id}/undo-assignment` - Remove substitute assignment.
* `POST /leaves/{id}/lock` - Lock substitute assignment.
* `GET /leaves/{id}/free-teachers` - Detect free teachers for a slot.
* `POST /leaves/{id}/cancel` - Teacher cancels own leave.
* `POST /leaves/{id}/admin-cancel` - Admin cancels leave with reason.
* `GET /leaves/{id}/cancel-impact` - Preview cancellation impact.
* `POST /leaves/admin-create` - Admin creates and auto-approves leave for teacher.

### Campus Operations Controller (`/campus-operations`)
* `GET /campus-operations/mode` - Get effective operations mode.
* `PUT /campus-operations/mode` - Set department mode or global override.
* `GET /campus-operations/preferences/me` - Get teacher substitution preferences.
* `PUT /campus-operations/preferences/me` - Update substitution preferences.
* `GET /campus-operations/cross-department-substitutions` - Check cross-dept policy.
* `PUT /campus-operations/cross-department-substitutions` - Update cross-dept policy.

### Academic Calendar Controller (`/academic-calendar`)
* `GET /academic-calendar/academic-years` - List academic years.
* `POST /academic-calendar/academic-years` - Create academic year.
* `GET /academic-calendar/semesters` - List semesters.
* `POST /academic-calendar/semesters` - Create semester.
* `GET /academic-calendar/days` - Query calendar days in date range.
* `GET /academic-calendar/days/{date}` - Get single calendar day.
* `POST /academic-calendar/days/mark` - Mark working/holiday/exam day.
* `POST /academic-calendar/days/bulk-mark` - Bulk mark date range.
* `POST /academic-calendar/days/day-order/assign` - Manual day order override.
* `POST /academic-calendar/days/day-order/skip` - Skip day order.
* `DELETE /academic-calendar/days/{date}/override` - Clear manual override.
* `DELETE /academic-calendar/days/{date}` - Reset calendar day.
* `GET /academic-calendar/resolve` - Resolve day order for a date.
* `GET /academic-calendar/today-summary` - Admin daily operations summary.
* `GET /academic-calendar/my-today-summary` - Teacher daily summary.
* `GET /academic-calendar/reports/working-days` - Working days report.
* `GET /academic-calendar/reports/holidays` - Holiday report.
* `GET /academic-calendar/reports/day-orders` - Day order distribution report.
* `GET /academic-calendar/reports/faculty-workload` - Faculty workload balance report.

### Credits Controller (`/credits`)
* `POST /credits/adjust` - Manual credit adjustment.
* `GET /credits/my/transactions` - Teacher transaction ledger.
* `GET /credits/transactions` - Admin transaction ledger.
* `GET /credits/report` - Credit balance report.

### Classes Controller (`/classes`)
* `GET /classes/` - List classes.
* `POST /classes/` - Create class.
* `POST /classes/bulk` - Bulk create classes.
* `PATCH /classes/{id}` - Update class.
* `DELETE /classes/{id}` - Delete class.
* `GET /classes/directory` - Complete class directory.
* `GET /classes/{id}/faculty` - Faculty teaching a class.

### Subjects Controller (`/subjects`)
* `GET /subjects/` - List subjects.
* `POST /subjects/` - Create subject.
* `PATCH /subjects/{id}` - Update subject.
* `PATCH /subjects/{id}/archive` - Archive subject.
* `PATCH /subjects/{id}/unarchive` - Unarchive subject.

### Rooms Controller (`/rooms`)
* `GET /rooms/` - List rooms and labs.
* `POST /rooms/` - Create room.
* `POST /rooms/bulk` - Bulk create rooms.
* `PATCH /rooms/{id}` - Update room.
* `DELETE /rooms/{id}` - Delete room.
* `GET /rooms/availability/dashboard` - Room availability grid.
* `GET /rooms/{id}/check-availability` - Single room availability check.

### Substitutions Controller (`/substitutions`)
* `GET /substitutions/today` - Today's substitutions and coverage timeline.

### Teacher Substitution Controller (`/teacher/substitution`)
* `GET /teacher/substitution/enabled` - Check if teacher self-management is allowed.
* `GET /teacher/substitution/my-leaves` - Get pending leaves for teacher delegation.
* `GET /teacher/substitution/leave/{id}/candidates` - Get eligible peer substitutes.
* `POST /teacher/substitution/leave/{id}/assign/{sub_id}` - Teacher assigns substitute.
* `PUT /teacher/substitution/leave/{id}/override/{sub_id}` - Teacher overrides substitute.
* `DELETE /teacher/substitution/clear-all-assignments` - Clear teacher delegations.
* `DELETE /teacher/substitution/reset-preferences` - Reset substitution preferences.
* `GET /teacher/substitution/config` - Get department teacher substitution policy.
* `PUT /teacher/substitution/config` - Update teacher substitution policy.

### Principal Controller (`/principal`)
* `GET /principal/overview` - Aggregate institutional KPIs and department metrics.

### Notifications Controller (`/notifications`)
* `GET /notifications/` - List user notifications.
* `GET /notifications/unread-count` - Get unread count.
* `PATCH /notifications/{id}/read` - Mark single notification read.
* `PATCH /notifications/read-all` - Mark all notifications read.
* `GET /notifications/vapid-public-key` - Get Web Push public key.
* `POST /notifications/subscribe` - Register Web Push subscription.

---

## 17. Frontend Route Inventory

### Public & Auth Routes
* `/login` - User sign-in (Dual username/email identity).
* `/register` - Teacher self-registration.
* `/first-login-setup` - Mandatory password/username initialization.

### Admin Routes (`/admin/*`) — Enforced by `AdminRoute` & `RequireCredentialsSet`
* `/admin/dashboard` - Master administrative dashboard.
* `/admin/academic-calendar` - Academic years, semesters, calendar days & holidays.
* `/admin/academic-calendar/reports` - Calendar and workload reports.
* `/admin/teachers` - Teaching staff directory and account creation.
* `/admin/timetable` - Department timetable editor.
* `/admin/timetable/approvals` - Teacher draft timetable approvals.
* `/admin/leaves` - Leave management & substitute recommendation dashboard.
* `/admin/leave-entry` - Direct admin leave entry on behalf of teachers.
* `/admin/credits` - Credit transactions & manual adjustments.
* `/admin/subjects` - Subject catalog management.
* `/admin/classes` - Class sections management.
* `/admin/class-directory` - Master class-faculty directory.
* `/admin/class-timetable` - Classwise timetable grid.
* `/admin/departments` - System admin department management.
* `/admin/rooms` - Room & Laboratory facilities catalog.
* `/admin/resource-availability` - Real-time room occupancy grid.
* `/admin/today-substitutions` - Today's substitution timeline & coverage tracker.
* `/admin/settings` - Secondary admin delegation & campus operations mode.
* `/admin/system-metrics` - Real-time traffic, latency, and DB metrics.

### Principal Routes (`/principal/*`) — Enforced by `PrincipalRoute`
* `/principal/dashboard` - Executive multi-department metrics & leave tracking.
* `/principal/class-timetable` - Read-only college-wide class timetable viewer.

### Teacher Routes (`/teacher/*`) — Enforced by `TeacherRoute`
* `/teacher/dashboard` - Faculty personal dashboard.
* `/teacher/timetable` - Personal teaching timetable grid.
* `/teacher/class-timetable` - Classwise timetable lookup.
* `/teacher/class-directory` - Faculty directory by class.
* `/teacher/leave/apply` - Leave application portal.
* `/teacher/leaves` - Leave history and substitution status.
* `/teacher/substitution` - Peer substitution delegation portal.
* `/teacher/today-coverage` - Department-wide daily coverage overview.
* `/teacher/credits` - Credit balance and transaction log.
* `/teacher/preferences` - Substitution preferences & weekly caps.

---

## 18. Navigation Architecture

Navigation is handled centrally by `frontend/src/components/layout/Sidebar.jsx`, `TopBar.jsx`, `MobileDrawer.jsx`, and `BottomNav.jsx`.

### Dynamic Navigation Menus:
* `SYSTEM_ADMIN_NAV`: Focuses on Departments, Classes, Rooms, Teachers, Subjects, System Metrics.
* `ADMIN_NAV`: Groups items into `Calendar & Timetable`, `Leave & Credits`, and `Setup`.
* `PRINCIPAL_NAV`: Streamlined to `Home (Executive Overview)` and `Classwise Timetable`.
* `TEACHER_NAV`: Scoped to personal teaching schedule, leaves, substitutes, and credits.

---

## 19. Audit Logging Mechanism

Audit logging is recorded synchronously via `app.services.admin_service.log_audit_event`:

### Schema & Fields:
* `actor_user_id`: ForeignKey to `users.id` (User who performed the action).
* `department_id`: ForeignKey to `departments.id` (Scoping the audit event).
* `action`: Structured action descriptor string (e.g., `secondary_admin.create`, `leaves.clear_history`, `substitution.cross_department_policy_changed`).
* `target_type`: Entity type affected (`user`, `system_setting`, `leave`, etc.).
* `target_id`: ID of the target record.
* `details`: JSONB column storing before/after state snapshots or metadata.
* `created_at`: Timestamp with timezone.

### Durable Logging:
* In addition to database storage, catastrophic operations (Factory Reset) write directly to the host filesystem: `backend/logs/factory_reset_audit.log`.

---

## 20. Security Architecture & Weaknesses

### Architectural Strengths:
1. **Direct Bcrypt Implementation:** Avoids passlib deprecation traps while enforcing a 72-byte safe payload limit.
2. **First-Login Credential Quarantine:** Uninitialized admin accounts are quarantined from all API routes until credentials rotate.
3. **Database Check Constraints:** Prevents cross-role constraint violations directly at the SQL engine level.
4. **Rate Limiting:** Protects `/auth/login` with SlowAPI (10 req/min).

### Weaknesses & Gaps Identified:
1. **Lack of Role Extensibility:** `Role` enum is fixed (`system_admin`, `admin`, `teacher`, `principal`). Adding non-academic staff requires schema migration.
2. **Hard-coded Teacher Assumptions:** Services assume any staff member with a timetable slot or credit balance is a `Role.teacher`.
3. **In-Memory Traffic Storage:** The `traffic_manager` stores log buffers in server RAM; metrics reset on backend restart.

---

## 21. Test Architecture & Coverage

* **Test Suite:** 424 Unit & Integration Tests under `backend/tests/`.
* **Testing Stack:** Pytest 9.1.1 + `fastapi.testclient.TestClient` + SQLite in-memory engine.
* **Key Covered Areas:**
  - Auth & credential rotation (`test_auth_service.py`, `test_services_auth_service.py`).
  - RBAC & dependency injection (`test_core_dependencies.py`, `test_dependencies.py`).
  - Leave lifecycle & autonomous substitution (`test_leave_service.py`, `test_substitution_service.py`).
  - Timetable conflict detection (`test_timetable_service.py`).
  - Academic calendar day order rotation (`test_academic_calendar_service.py`, `test_day_order_service.py`).

---

## 22. Responsive / Mobile Architecture

The application UI is engineered for complete responsive parity across viewport sizes:
1. **Desktop (`>= 1024px`):** Permanent collapsible Sidebar, comprehensive desktop data tables, multi-column grids.
2. **Tablet / Mobile (`< 1024px`):**
   - Collapsible slide-out navigation (`MobileDrawer.jsx`) toggled via TopBar hamburger button.
   - Sticky bottom navigation bar (`BottomNav.jsx`) for primary role destinations.
   - Table views wrap into touch-friendly card lists (`TableCard` pattern) to eliminate horizontal clipping.
   - Touch targets adhere to WCAG standards (minimum 44x44px hit areas).
   - Sticky action headers and modal dialogs adapt to vertical mobile viewports (`max-h-[90vh] overflow-y-auto`).

---

## 23. Business Logic Dependency Map

```text
                  Academic Year / Semester
                             │
                             ▼
                    CalendarDay (Day Order 1-6)
                             │
                             ▼
                    TimetableSlot (Day Order + Period)
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
       LeaveRequest                   Room Availability
            │
            ▼
     AlterAssignment (Substitute Scorer)
            │
            ▼
    CreditTransaction (Ledger + TeacherCredit Balance)
            │
            ▼
   Faculty Workload Reports & Notifications
```

---

## 24. Critical Coupling Analysis

1. **`User` Model Coupling:**
   - `timetable_slots.teacher_id -> users.id`
   - `leave_requests.teacher_id -> users.id`
   - `alter_assignments.substitute_teacher_id -> users.id`
   - `teacher_credits.teacher_id -> users.id`
   - `substitution_preferences.teacher_id -> users.id`
   *Impact:* Any new staff type (Lab Staff, Non-Teaching Staff) must either extend `User` or exist in dedicated staff tables to prevent corrupting academic substitution logic.

2. **Check Constraint Coupling:**
   - `chk_user_department_role`:
     ```sql
     (role IN ('admin', 'teacher') AND department_id IS NOT NULL) OR
     (role IN ('system_admin', 'principal') AND department_id IS NULL)
     ```
   *Impact:* Adding a new role without modifying this constraint will cause database insert rejections.

3. **Autonomous Substitution Coupling:**
   - `substitution_service.py` queries `User.role == Role.teacher` exclusively. It filters candidates based on academic timetable slots and subjects taught. Non-academic staff must never enter this pool.

---

## 25. Technical Debt

1. **Enum String Divergence:** Some database migrations used PostgreSQL `CREATE TYPE user_role AS ENUM`, while SQLAlchemy models use string enums.
2. **`department` vs `department_id` Legacy Column:** `User.department_old` exists alongside `department_id` for backward compatibility.
3. **Hard-Coded Daily Periods in Database Constraints:** Period constraints (`BETWEEN 1 AND 5`) exist both in code settings and database check constraints.

---

## 26. Manager Role Implementation Readiness

### 26.1 Target Specification for Manager Role:
* **Account Creator:** Only **System Admin** creates and manages Manager accounts.
* **Role Scope:** Managers oversee **Laboratory Staff** and **Non-Teaching Staff**.
* **Strict Boundary Constraints:**
  - Managers CANNOT manage Teaching Faculty.
  - Managers CANNOT create, modify, or approve Academic Timetables.
  - Managers CANNOT approve Faculty Leaves or execute Academic Substitutions.
  - Managers CANNOT modify Academic Calendars or Day Orders.
  - Managers CANNOT create other Managers or Admins.
  - Managers CANNOT access System Metrics, Factory Reset, or Master Academic Exports.

### 26.2 Implementation Readiness Assessment:
* **Backend Readiness: HIGH.** The existing RBAC dependency architecture (`require_system_admin`, `require_admin`, `require_roles`) allows clean insertion of `Role.manager`.
* **Database Readiness: MEDIUM-HIGH.** Requires a migration updating the `user_role` enum and the `chk_user_department_role` constraint.
* **Frontend Readiness: HIGH.** The `AppShell`, `Guards.jsx`, `Sidebar.jsx`, and `AuthContext.jsx` structure can seamlessly accommodate a dedicated `ManagerRoute` and `MANAGER_NAV`.

---

## 27. Proposed Manager Permission Model

### Allowed Operations for Manager:
* Create, update, list, and disable **Laboratory Staff** (Lab Technicians, Lab Assistants).
* Create, update, list, and disable **Non-Teaching Staff** (Office Staff, Administrative Staff, Attenders).
* Assign Lab Staff to specific Laboratories/Rooms.
* Record attendance or simple duty logs for Lab and Non-Teaching Staff.
* View assigned staff directory and departmental contact list.

### Forbidden Operations for Manager:
* ❌ Accessing Teacher Timetables or Submissions.
* ❌ Approving Faculty Leaves or accessing the Autonomous Substitution Engine.
* ❌ Modifying Faculty Credits or viewing Faculty Workload Reports.
* ❌ Managing Departments, HODs, Secondary Admins, or other Managers.
* ❌ Accessing Academic Calendar / Day Order configuration.
* ❌ Accessing Factory Reset, Clear History, or System Performance Metrics.

---

## 28. File-by-File Impact Analysis Table

| Layer | File Path | Scope of Required Changes | Risk Level |
|---|---|---|:---:|
| **Database** | `database/migrations/008_add_manager_and_staff.sql` | Add `manager` to `user_role` enum; add staff tables or staff categorization; update check constraints. | **HIGH** |
| **Backend Model** | `backend/app/models/user.py` | Add `manager = "manager"` to `Role` enum; update `chk_user_department_role` constraint. | **HIGH** |
| **Backend Model** | `backend/app/models/staff.py` (New) | Define `LabStaff` and `NonTeachingStaff` models or staff categories. | **LOW** |
| **Backend Core** | `backend/app/core/dependencies.py` | Add `require_manager`, `require_system_admin_or_manager`; update `get_tenant_department_id`. | **MEDIUM** |
| **Backend Service** | `backend/app/services/admin_service.py` | Add `create_manager_account`, `list_managers`, `set_manager_active`. | **MEDIUM** |
| **Backend Service** | `backend/app/services/manager_service.py` (New) | Implement CRUD & duty allocation for Lab and Non-Teaching staff. | **LOW** |
| **Backend Route** | `backend/app/routes/admin.py` | Add `/admin/managers` endpoints (System Admin only). | **MEDIUM** |
| **Backend Route** | `backend/app/routes/manager.py` (New) | Add `/manager/*` staff management endpoints. | **LOW** |
| **Backend Main** | `backend/app/main.py` | Register `manager.router`. | **LOW** |
| **Frontend Context** | `frontend/src/context/AuthContext.jsx` | Add `isManager: user?.role === 'manager'`. | **LOW** |
| **Frontend Guards** | `frontend/src/routes/Guards.jsx` | Add `ManagerRoute` guard; update `GuestRoute`. | **LOW** |
| **Frontend Layout** | `frontend/src/components/layout/Sidebar.jsx` | Add `MANAGER_NAV` links (Lab Staff, Non-Teaching Staff, Duty Roster). | **LOW** |
| **Frontend Pages** | `frontend/src/pages/manager/*` (New) | Manager Dashboard, Lab Staff Management, Non-Teaching Staff Management. | **LOW** |
| **Frontend Pages** | `frontend/src/pages/admin/Managers.jsx` (New) | System Admin view to create/manage Manager accounts. | **LOW** |
| **Frontend Router** | `frontend/src/App.jsx` | Wire `/manager/*` routes under `ManagerRoute`. | **LOW** |

---

## 29. Recommended Implementation Order

To ensure zero downtime and prevent breaking existing functionality, implementation should proceed in strict sequential stages:

```text
Stage 1: Database Migration (008)
  └── Update user_role enum and chk_user_department_role check constraint.
  └── Create lab_staff and non_teaching_staff relational tables (or staff table).

Stage 2: Backend Models & Schemas
  └── Update User.Role in backend/app/models/user.py.
  └── Create Pydantic schemas for Manager and Staff entities.

Stage 3: Backend Security & Dependency Injection
  └── Add require_manager and require_system_admin_or_manager in dependencies.py.

Stage 4: Backend Domain Services & Endpoints
  └── Implement manager creation logic in admin_service.py & admin.py routes.
  └── Implement staff management CRUD in manager_service.py & manager.py routes.

Stage 5: Frontend Context & Route Guards
  └── Update AuthContext.jsx and Guards.jsx with isManager / ManagerRoute.

Stage 6: Frontend Manager Navigation & UI Pages
  └── Add MANAGER_NAV in Sidebar.jsx, MobileDrawer.jsx, BottomNav.jsx.
  └── Build Manager Dashboard, Lab Staff page, and Non-Teaching Staff page.
  └── Build System Admin Manager Management page in Admin portal.

Stage 7: Regression & RBAC Verification
  └── Run full unit test suite (424 tests) and verify zero permission bleed.
```

---

## 30. Risks & Warnings

> [!CAUTION]
> **1. Academic Timetable & Substitution Isolation**  
> Under NO circumstances should Lab Staff or Non-Teaching Staff be inserted into the `users` table with `role='teacher'`. Doing so will contaminate the Autonomous Substitution recommendation engine, Day Order slot calculations, and Credit ledger balances.

> [!WARNING]
> **2. Factory Reset Data Integrity**  
> `factory_reset_service.py` contains hardcoded table lists (`BACKUP_TABLES` and `_DELETE_ORDER`). When new staff tables are introduced, they MUST be appended to `factory_reset_service.py` to prevent foreign key cascade errors during system resets.

> [!IMPORTANT]
> **3. Database Check Constraint Synchronization**  
> The PostgreSQL `chk_user_department_role` constraint must be updated to account for whether Managers have a `department_id` (e.g., campus-wide Facility Manager with `NULL` vs departmental Lab Manager with `department_id`). This rule must be strictly aligned between SQL migrations and SQLAlchemy model definitions.

---

## 31. Final Architecture Summary

The existing FAFLOW architecture is exceptionally robust, highly structured, and well-isolated. The clean separation between FastAPI route controllers, domain services, SQLAlchemy ORM models, and React context providers makes the system prime for extending new administrative roles without risking existing academic scheduling, leave management, or credit workload features.

---

## 32. Safe Next Step

The complete architecture audit is complete, and all dependencies, constraints, and integration touchpoints are mapped.

**Next Safe Action:**  
When instructed by the user to proceed with the Manager Role implementation:
1. Formulate the precise schema design for `008_add_manager_and_staff.sql` (defining whether Managers are institution-wide or department-scoped, and how Lab/Non-Teaching staff records are modeled).
2. Present the implementation proposal for confirmation before executing any file creations or code modifications.
