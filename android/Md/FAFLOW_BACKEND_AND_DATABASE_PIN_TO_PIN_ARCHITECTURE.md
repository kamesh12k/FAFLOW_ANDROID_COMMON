# FAFLOW Unified Backend & PostgreSQL Database Architecture (Pin-to-Pin Reference)

> **Document Type**: Comprehensive Backend Architecture & API Specification  
> **Source Codebase**: `b:\FAFLOW_UNIFIED\backend` & `b:\FAFLOW_UNIFIED\database`  
> **Backend Framework**: Python 3.11+ / FastAPI 0.111+ / Uvicorn (ASGI)  
> **Database Engine**: PostgreSQL 16 (Relational Database) with SQLAlchemy 2.0 ORM  
> **Database Migrations & Recovery**: Dynamic Startup Auto-Migration + Raw SQL DDL Scripts  
> **Authentication & Authorization**: Stateless JWT (HS256) + 8-Tier RBAC + First-Login Credential Enforcement  
> **Target Audience for this Document**: Claude AI / System Architects / Backend Engineers  

---

## 1. Architectural Foundation & Technical Stack

```
                                  Client Layer/
            (Jetpack Compose Android App / React Vite Web Dashboard)
                                      |
                                      | HTTPS (TLS 1.3) / Bearer JWT
                                      v
+-----------------------------------------------------------------------------------+
|                        FASTAPI APPLICATION PIPELINE (main.py)                     |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  | Middleware Stack:                                                           |  |
|  | 1. CORSMiddleware (Dynamic LAN IP resolution + Regex origin matching)       |  |
|  | 2. TrafficLoggerMiddleware (X-Request-ID, Latency tracking, In-memory ring)  |  |
|  | 3. SlowAPI RateLimiter (Remote IP throttling)                               |  |
|  | 4. Global Exception Handlers (DomainException, RateLimitExceeded, 500)       |  |
|  +-----------------------------------------------------------------------------+  |
|                                      |                                            |
|                                      v                                            |
|  +-----------------------------------------------------------------------------+  |
|  | 25 Functional Routers:                                                      |  |
|  | /auth, /teachers, /timetable, /leaves, /credits, /notifications,           |  |
|  | /departments, /subjects, /classes, /rooms, /day-order-calendar, /admin,     |  |
|  | /academic-calendar, /campus-operations, /teacher/substitution,              |  |
|  | /substitutions, /principal, /manager, /staff, /admin/backups, /governance,  |  |
|  | /admin/data-retention, /geofences, /attendance, /system                     |  |
|  +-----------------------------------------------------------------------------+  |
|                                      |                                            |
|                                      v                                            |
|  +-----------------------------------------------------------------------------+  |
|  | Service Layer (32 Modular Business Services):                               |  |
|  | AttendanceService, GeofenceService, LeaveService, SubstitutionService,       |  |
|  | AcademicCalendarService, TimetableService, CreditService, AuthService, etc. |  |
|  +-----------------------------------------------------------------------------+  |
|                                      |                                            |
|                                      v                                            |
|  +-----------------------------------------------------------------------------+  |
|  | SQLAlchemy ORM 2.0 (Models & Relationships) + Scoped Session (`get_db`)      |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
                                       |
                                       v
+-----------------------------------------------------------------------------------+
|                            POSTGRESQL RELATIONAL DATABASE                         |
|  - 29 Relational Tables with Foreign Keys, Check Constraints & Unique Indexes    |
|  - 14 Custom PostgreSQL Enums (`user_role`, `day_type`, `leave_status`, etc.)     |
|  - Idempotency guarantees, JSONB geometries & strict referential integrity        |
+-----------------------------------------------------------------------------------+
```

### 1.1 Technology Versions & Key Packages
* **Runtime**: Python `3.11` / `3.12`
* **Web Framework**: `fastapi==0.111.0`, `uvicorn[standard]==0.29.0`
* **Database Driver & ORM**: `SQLAlchemy==2.0.29`, `psycopg2-binary==2.9.9`, `alembic==1.13.1`
* **Data Validation & Schemas**: `pydantic==2.7.0`, `pydantic-settings==2.2.1`
* **Security & Cryptography**: `python-jose[cryptography]==3.3.0`, `passlib[bcrypt]==1.7.4`, `pywebpush==1.14.0`
* **Rate Limiting & Traffic**: `slowapi==0.1.9`
* **Data Processing & Analytics**: `pandas==2.2.2`, `openpyxl==3.1.2`, `reportlab==4.2.0`

### 1.2 Startup Resilience & Database Recovery Pattern (`wait_for_db_and_init`)
At startup, `app/main.py` executes an automated recovery-aware bootstrapper:
1. **Connection Probe**: Polls `SELECT 1` every 5 seconds (up to 300s timeout) to accommodate PostgreSQL recovery mode after hard server reboots.
2. **Dynamic Schema Migration (`sync_database_schema`)**:
   - Executes raw SQL `ALTER TYPE ... ADD VALUE IF NOT EXISTS` for enums (`governance`, `combined_class`).
   - Drops and replaces table constraints (`chk_user_identity`, `chk_admin_level`, `chk_user_department_role`).
   - Ensures multi-staff timetable compatibility by modifying strict single-staff constraints to `uq_teacher_class_day_period`.
   - Adds missing columns dynamically (`classes.default_room_id`, `substitution_preferences.only_my_classes`).
3. **Table Creation**: Calls `Base.metadata.create_all(bind=engine)`.
4. **Bootstrap Seeding**: Idempotently creates default root accounts:
   - System Super Admin (`admin_service.bootstrap_default_super_admin`)
   - Governance Auditor (`governance_service.bootstrap_governance_user`)

---

## 2. 8-Tier Role-Based Access Control (RBAC) Model

FAFLOW enforces an exhaustive 8-tier role matrix defined in `app/models/user.py` (`user_role` PostgreSQL enum):

| Role Identifier | Role Scope & Responsibility | Authentication Identity | Department ID Required? |
|---|---|---|---|
| `system_admin` | Global IT infrastructure administrator; manages backups, data retention policies, server metrics, and cross-department settings. | `username` | **NO** (`department_id IS NULL`) |
| `admin` | Department Head / HOD. Can be `super_admin` or `secondary_admin` via `admin_level`. Manages department timetable, leave approvals, and faculty directory. | `username` | **YES** (`department_id IS NOT NULL`) |
| `teacher` | Teaching Faculty (Professors, Assistant Professors). Manages personal schedules, applies for leaves, takes substitution duties, checks in/out via mobile. | `email` | **YES** (`department_id IS NOT NULL`) |
| `principal` | Institutional Executive. Read-only global visibility across all departments, live attendance, and academic coverage. | `username` | **NO** (`department_id IS NULL`) |
| `manager` | Operational Campus Manager. Manages non-teaching staff, laboratories, and physical infrastructure. | `username` | **NO** (`department_id IS NULL`) |
| `lab_staff` | Laboratory Technicians & Assistants. Operations scheduled via shifts. | `username` | Optional |
| `non_teaching_staff` | Administrative, clerical, and campus operational personnel. | `username` | Optional |
| `governance` | Institutional Compliance & Multi-Campus Auditor. Manages feature licensing, plan tiers, and biometric compliance. | `username` | **NO** (`department_id IS NULL`) |

### Identity Integrity Constraints (`chk_user_identity`, `chk_admin_level`, `chk_user_department_role`)
The PostgreSQL database strictly enforces identity mutual exclusivity:
* `chk_user_identity`: `teacher` **must** have `email IS NOT NULL`. All other 7 roles **must** have `username IS NOT NULL`.
* `chk_admin_level`: `admin` **must** have `admin_level` set (`super_admin` or `secondary_admin`). All other 7 roles **must** have `admin_level IS NULL`.
* `chk_user_department_role`: `admin` and `teacher` **must** have a foreign key to `departments.id`. `system_admin`, `principal`, and `governance` **must** have `department_id IS NULL`.

---

## 3. Database Schema: All 29 Tables, Foreign Keys & Constraints

---

### 3.1 Organization & Physical Infrastructure Tables

#### 1. `departments`
Stores academic departments (e.g., Computer Science, Mechanical Engineering).
* `id` (`SERIAL PRIMARY KEY`)
* `name` (`VARCHAR(100) NOT NULL UNIQUE`)
* `code` (`VARCHAR(20) UNIQUE`) - e.g., "CSE", "MECH"
* `created_at` (`TIMESTAMPTZ DEFAULT now()`)

#### 2. `rooms`
Physical campus teaching spaces (classrooms and laboratories).
* `id` (`SERIAL PRIMARY KEY`)
* `room_number` (`VARCHAR(20) NOT NULL UNIQUE`)
* `room_type` (`room_type NOT NULL DEFAULT 'classroom'`) - Enum: `'classroom'`, `'lab'`
* `capacity` (`INTEGER NOT NULL CHECK (capacity > 0)`)
* `department_id` (`INTEGER REFERENCES departments(id) ON DELETE SET NULL`)
* `created_at` (`TIMESTAMPTZ DEFAULT now()`)

#### 3. `classes`
Class and section batches (e.g., "CSE-III", Section "A").
* `id` (`SERIAL PRIMARY KEY`)
* `name` (`VARCHAR(100) NOT NULL`)
* `section` (`VARCHAR(10) NOT NULL`)
* `department_id` (`INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT`)
* `semester` (`INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 8)`)
* `default_room_id` (`INTEGER REFERENCES rooms(id) ON DELETE SET NULL`)
* `created_at` (`TIMESTAMPTZ DEFAULT now()`)
* *Constraints*: `UNIQUE(name, section)`

#### 4. `subjects`
Academic courses taught within departments.
* `id` (`SERIAL PRIMARY KEY`)
* `code` (`VARCHAR(20) NOT NULL`) - e.g., "CS-301"
* `name` (`VARCHAR(150) NOT NULL`) - e.g., "Database Management Systems"
* `subject_type` (`subject_type NOT NULL DEFAULT 'theory'`) - Enum: `'theory'`, `'lab'`
* `credits` (`INTEGER NOT NULL CHECK (credits > 0)`)
* `department_id` (`INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT`)
* `semester` (`INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 8)`)
* `is_archived` (`BOOLEAN NOT NULL DEFAULT false`)
* `created_at` (`TIMESTAMPTZ DEFAULT now()`)
* *Constraints*: `UNIQUE(department_id, code)`

---

### 3.2 User Identity & Biometric Security Tables

#### 5. `users`
Central user registry powering authentication across Web and Android.
* `id` (`SERIAL PRIMARY KEY`)
* `name` (`VARCHAR(100) NOT NULL`)
* `email` (`VARCHAR(150) UNIQUE`)
* `username` (`VARCHAR(50) UNIQUE`)
* `password_hash` (`VARCHAR(255) NOT NULL`)
* `role` (`user_role NOT NULL DEFAULT 'teacher'`)
* `admin_level` (`admin_level`) - Enum: `'super_admin'`, `'secondary_admin'`
* `department` (`VARCHAR(100)`) - Legacy fallback string
* `department_id` (`INTEGER REFERENCES departments(id) ON DELETE RESTRICT`)
* `must_change_credentials` (`BOOLEAN NOT NULL DEFAULT false`) - Forces password reset on bootstrap
* `is_active` (`BOOLEAN NOT NULL DEFAULT true`)
* `has_face_enrolled` (`BOOLEAN NOT NULL DEFAULT false`) - Quick-lookup flag for biometric readiness
* `face_enrolled_at` (`TIMESTAMPTZ`)
* `created_by_admin_id` (`INTEGER REFERENCES users(id) ON DELETE SET NULL`)
* `created_at` (`TIMESTAMPTZ DEFAULT now()`)

---

### 3.3 Geofencing & Biometric Attendance Tables

#### 6. `campus_geofences`
Stores visual and mathematical boundary perimeters for GPS attendance gating.
* `id` (`SERIAL PRIMARY KEY`)
* `name` (`VARCHAR(100) NOT NULL UNIQUE`)
* `description` (`VARCHAR(255)`)
* `type` (`VARCHAR(20) NOT NULL DEFAULT 'circle'`) - `'circle'` or `'polygon'`
* `center_latitude` (`FLOAT NOT NULL`)
* `center_longitude` (`FLOAT NOT NULL`)
* `radius_meters` (`FLOAT DEFAULT 150.0`)
* `geometry` (`JSONB NOT NULL`) - GeoJSON structure storing polygon vertices or circular parameters
* `tolerance_meters` (`FLOAT NOT NULL DEFAULT 15.0`) - GPS buffer boundary
* `area_sq_meters` (`FLOAT`)
* `perimeter_meters` (`FLOAT`)
* `is_active` (`BOOLEAN NOT NULL DEFAULT true`)
* `created_by` (`INTEGER REFERENCES users(id) ON DELETE SET NULL`)
* `updated_by` (`INTEGER REFERENCES users(id) ON DELETE SET NULL`)
* `created_at` (`TIMESTAMPTZ DEFAULT now()`)
* `updated_at` (`TIMESTAMPTZ DEFAULT now()`)

#### 7. `staff_attendance_records`
Authoritative institutional shift attendance ledger.
* `id` (`SERIAL PRIMARY KEY`)
* `user_id` (`INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE`)
* `attendance_date` (`DATE NOT NULL`)
* `check_in_time` (`TIMESTAMPTZ`)
* `check_out_time` (`TIMESTAMPTZ`)
* `status` (`VARCHAR(20) NOT NULL DEFAULT 'PRESENT'`) - `'PRESENT'`, `'HALF_DAY'`, `'LATE'`, `'ON_DUTY'`
* `check_in_latitude` (`FLOAT`)
* `check_in_longitude` (`FLOAT`)
* `check_in_accuracy` (`FLOAT`)
* `check_in_geofence_id` (`INTEGER REFERENCES campus_geofences(id) ON DELETE SET NULL`)
* `check_out_latitude` (`FLOAT`)
* `check_out_longitude` (`FLOAT`)
* `check_out_accuracy` (`FLOAT`)
* `check_out_geofence_id` (`INTEGER REFERENCES campus_geofences(id) ON DELETE SET NULL`)
* `face_similarity_score` (`FLOAT`) - Probe cosine similarity (e.g., 0.94)
* `liveness_verified` (`BOOLEAN NOT NULL DEFAULT false`) - Anti-spoofing verification flag
* `verification_method` (`VARCHAR(50) NOT NULL DEFAULT 'FACE_ON_DEVICE'`)
* `idempotency_key` (`VARCHAR(64) UNIQUE`) - UUID preventing duplicate network submissions
* `device_reference` (`VARCHAR(100)`)
* `sync_source` (`VARCHAR(20) NOT NULL DEFAULT 'DIRECT'`) - `'DIRECT'` or `'OFFLINE_SYNC'`
* `working_hours` (`VARCHAR(50)`) - e.g., "7h 45m"
* `created_at` (`TIMESTAMPTZ DEFAULT now()`)
* `updated_at` (`TIMESTAMPTZ DEFAULT now()`)
* *Indexes*: `(user_id, attendance_date)`, `(idempotency_key)`

---

### 3.4 Academic Calendar & Day Order Sequencing Tables

#### 8. `academic_years`
* `id` (`SERIAL PRIMARY KEY`)
* `name` (`VARCHAR(20) NOT NULL UNIQUE`) - e.g., "2026-2027"
* `start_date` (`DATE NOT NULL`)
* `end_date` (`DATE NOT NULL`)
* `is_active` (`BOOLEAN NOT NULL DEFAULT true`)
* `created_at` (`TIMESTAMPTZ DEFAULT now()`)

#### 9. `semesters`
* `id` (`SERIAL PRIMARY KEY`)
* `academic_year_id` (`INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE`)
* `name` (`VARCHAR(50) NOT NULL`) - e.g., "Odd Semester 2026"
* `semester_type` (`VARCHAR(10) NOT NULL`) - `'odd'` or `'even'`
* `start_date` (`DATE NOT NULL`)
* `end_date` (`DATE NOT NULL`)
* `is_active` (`BOOLEAN NOT NULL DEFAULT true`)
* `created_at` (`TIMESTAMPTZ DEFAULT now()`)

#### 10. `calendar_days`
Represents individual calendar dates and the cyclical Day Order (1–6).
* `id` (`SERIAL PRIMARY KEY`)
* `date` (`DATE NOT NULL UNIQUE`)
* `day_type` (`day_type NOT NULL DEFAULT 'working'`) - Enum: `'working'`, `'holiday'`, `'college_leave'`, `'government_holiday'`, `'exam_day'`, `'special_event'`, `'department_activity'`, `'non_working'`
* `day_order` (`INTEGER`) - 1 to 6 (NULL for non-working/holiday days)
* `academic_year_id` (`INTEGER REFERENCES academic_years(id) ON DELETE SET NULL`)
* `semester_id` (`INTEGER REFERENCES semesters(id) ON DELETE SET NULL`)
* `is_manual_override` (`BOOLEAN NOT NULL DEFAULT false`) - Protects manually pinned Day Orders from auto-sequencer
* `description` (`VARCHAR(255)`) - e.g., "Independence Day", "Mid-Term Examinations"
* `created_at` (`TIMESTAMPTZ DEFAULT now()`)
* `updated_at` (`TIMESTAMPTZ DEFAULT now()`)
* *Operational Blocking Rule*: If `day_type IN ('holiday', 'college_leave', 'government_holiday', 'exam_day', 'special_event', 'non_working')`, all classes, substitute duties, and credit calculations are blocked (`blocks_operations = true`).

---

### 3.5 Timetable & Faculty Operations Tables

#### 11. `timetable_slots`
5-Period daily schedule across 6 Day Orders.
* `id` (`SERIAL PRIMARY KEY`)
* `teacher_id` (`INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE`)
* `subject_id` (`INTEGER REFERENCES subjects(id) ON DELETE SET NULL`)
* `class_id` (`INTEGER NOT NULL REFERENCES classes(id) ON DELETE RESTRICT`)
* `room_id` (`INTEGER REFERENCES rooms(id) ON DELETE SET NULL`)
* `day_order` (`INTEGER NOT NULL CHECK (day_order BETWEEN 1 AND 6)`)
* `period_number` (`INTEGER NOT NULL CHECK (period_number BETWEEN 1 AND 5)`)
* *Constraints*: `UNIQUE(teacher_id, class_id, day_order, period_number)`

#### 12. `timetable_submissions`
Workflow tracking for draft timetables submitted by teachers for HOD approval.
* `id` (`SERIAL PRIMARY KEY`)
* `teacher_id` (`INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE`)
* `status` (`timetable_submission_status NOT NULL DEFAULT 'pending'`)
* `academic_year_id` (`INTEGER REFERENCES academic_years(id) ON DELETE SET NULL`)
* `semester_id` (`INTEGER REFERENCES semesters(id) ON DELETE SET NULL`)
* `slots_payload` (`JSONB NOT NULL`) - Proposed slot matrix
* `review_notes` (`TEXT`)
* `reviewed_by` (`INTEGER REFERENCES users(id) ON DELETE SET NULL`)
* `reviewed_at` (`TIMESTAMPTZ`)
* `created_at` (`TIMESTAMPTZ DEFAULT now()`)

---

### 3.6 Leave Management & Autonomous Substitution Tables

#### 13. `leave_requests`
Period-level or batch leave applications submitted by faculty.
* `id` (`SERIAL PRIMARY KEY`)
* `teacher_id` (`INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE`)
* `date` (`DATE NOT NULL`)
* `day_order` (`INTEGER NOT NULL`)
* `period_number` (`INTEGER NOT NULL CHECK (period_number BETWEEN 1 AND 5)`)
* `reason` (`VARCHAR(500) NOT NULL`)
* `status` (`leave_status NOT NULL DEFAULT 'pending'`) - Enum: `'pending'`, `'approved'`, `'rejected'`, `'cancelled'`
* `batch_id` (`UUID`) - Groups multi-period leaves applied together
* `is_emergency` (`BOOLEAN NOT NULL DEFAULT false`) - Set true if applied $< 2\text{ hours}$ before class start
* `created_at` (`TIMESTAMPTZ DEFAULT now()`)

#### 14. `alter_assignments`
Substitute allocations covering for absent teachers.
* `id` (`SERIAL PRIMARY KEY`)
* `leave_request_id` (`INTEGER NOT NULL UNIQUE REFERENCES leave_requests(id) ON DELETE CASCADE`)
* `substitute_teacher_id` (`INTEGER NOT NULL REFERENCES users(id)`)
* `assigned_at` (`TIMESTAMPTZ DEFAULT now()`)
* `assignment_type` (`assignment_type NOT NULL DEFAULT 'admin_assigned'`) - Enum: `'auto_assigned'`, `'faculty_recommended'`, `'admin_assigned'`, `'auto_swapped'`, `'overridden'`, `'emergency'`, `'teacher_assigned'`, `'combined_class'`
* `compatibility_score` (`FLOAT`) - Ranked recommendation score (0–100) calculated at assignment time
* `is_locked` (`BOOLEAN NOT NULL DEFAULT false`) - Locks assignment preventing autonomous algorithm re-routing

#### 15. `substitution_preferences`
Configurable workload boundaries per teacher.
* `id` (`SERIAL PRIMARY KEY`)
* `teacher_id` (`INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE`)
* `max_substitutions_per_day` (`INTEGER NOT NULL DEFAULT 2`)
* `max_substitutions_per_week` (`INTEGER NOT NULL DEFAULT 6`)
* `willing_for_cross_department` (`BOOLEAN NOT NULL DEFAULT false`)
* `only_my_classes` (`BOOLEAN NOT NULL DEFAULT false`)
* `updated_at` (`TIMESTAMPTZ DEFAULT now()`)

---

### 3.7 Workload Duty Credits & Ledger Tables

#### 16. `teacher_credits`
Real-time credit balance per faculty member.
* `id` (`SERIAL PRIMARY KEY`)
* `teacher_id` (`INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE`)
* `balance` (`INTEGER NOT NULL DEFAULT 0`)

#### 17. `credit_transactions`
Auditable ledger of credit balance changes ($+1$ for taking a class, $-1$ for taking leave).
* `id` (`SERIAL PRIMARY KEY`)
* `teacher_id` (`INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE`)
* `change` (`INTEGER NOT NULL`) - e.g., `+1`, `-1`, `+2`
* `reason` (`VARCHAR(255) NOT NULL`)
* `category` (`VARCHAR(50) DEFAULT 'other'`) - Valid values: `'substitute_class'`, `'manual_adjustment'`, `'exam_duty'`, `'department_duty'`, `'workshop'`, `'event_coordination'`, `'penalty'`, `'correction'`, `'other'`
* `related_leave_id` (`INTEGER REFERENCES leave_requests(id) ON DELETE SET NULL`)
* `created_at` (`TIMESTAMPTZ DEFAULT now()`)

---

### 3.8 Non-Teaching & Operational Staff Tables

#### 18. `operational_staff`
Roster for non-faculty personnel (Lab technicians, clerical staff).
* `id` (`SERIAL PRIMARY KEY`)
* `user_id` (`INTEGER REFERENCES users(id) ON DELETE SET NULL`)
* `employee_id` (`VARCHAR(50) NOT NULL UNIQUE`)
* `name` (`VARCHAR(100) NOT NULL`)
* `department_id` (`INTEGER REFERENCES departments(id) ON DELETE SET NULL`)
* `category` (`staff_category NOT NULL DEFAULT 'laboratory'`) - Enum: `'laboratory'`, `'non_teaching'`
* `employment_status` (`employment_status NOT NULL DEFAULT 'active'`) - Enum: `'active'`, `'on_leave'`, `'transferred'`, `'inactive'`
* `shift_type` (`shift_type NOT NULL DEFAULT 'general'`) - Enum: `'general'`, `'morning'`, `'evening'`, `'night'`
* `lab_name` (`VARCHAR(100)`)
* `contact_phone` (`VARCHAR(20)`)
* `created_at` (`TIMESTAMPTZ DEFAULT now()`)

#### 19. `staff_leave_requests`
* `id` (`SERIAL PRIMARY KEY`)
* `staff_id` (`INTEGER NOT NULL REFERENCES operational_staff(id) ON DELETE CASCADE`)
* `start_date` (`DATE NOT NULL`)
* `end_date` (`DATE NOT NULL`)
* `leave_type` (`VARCHAR(50) NOT NULL`)
* `reason` (`VARCHAR(500) NOT NULL`)
* `status` (`VARCHAR(20) NOT NULL DEFAULT 'pending'`)
* `created_at` (`TIMESTAMPTZ DEFAULT now()`)

#### 20. `staff_credits` & 21. `staff_credit_transactions`
Mirrors the faculty credit economy for operational staff members.

---

### 3.9 Notifications & System Audit Tables

#### 22. `notifications`
* `id` (`SERIAL PRIMARY KEY`)
* `recipient_user_id` (`INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE`)
* `title` (`VARCHAR(200) NOT NULL`)
* `body` (`TEXT NOT NULL`)
* `event_type` (`VARCHAR(50)`) - e.g., `'leave_approved'`, `'substitute_assigned'`
* `related_leave_id` (`INTEGER REFERENCES leave_requests(id) ON DELETE SET NULL`)
* `is_read` (`BOOLEAN NOT NULL DEFAULT false`)
* `created_at` (`TIMESTAMPTZ DEFAULT now()`)

#### 23. `push_subscriptions`
WebPush subscriptions storing browser VAPID endpoints and keys.
* `id` (`SERIAL PRIMARY KEY`)
* `user_id` (`INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE`)
* `endpoint` (`TEXT NOT NULL UNIQUE`)
* `p256dh_key` (`VARCHAR(255) NOT NULL`)
* `auth_key` (`VARCHAR(255) NOT NULL`)
* `created_at` (`TIMESTAMPTZ DEFAULT now()`)

#### 24. `audit_logs`
Immutable operational audit trail recording administrative and critical events.
* `id` (`SERIAL PRIMARY KEY`)
* `actor_user_id` (`INTEGER REFERENCES users(id) ON DELETE SET NULL`)
* `action` (`VARCHAR(100) NOT NULL`) - e.g., `'ATTENDANCE_CHECK_IN_ACCEPTED'`, `'LEAVE_APPROVED'`, `'FACTORY_RESET'`
* `target_type` (`VARCHAR(50) NOT NULL`)
* `target_id` (`INTEGER`)
* `details` (`JSONB`)
* `created_at` (`TIMESTAMPTZ DEFAULT now()`)

#### 25. `system_settings`
Key-value configuration store for campus policies.
* `id` (`SERIAL PRIMARY KEY`)
* `key` (`VARCHAR(100) NOT NULL UNIQUE`)
* `value` (`TEXT NOT NULL`)
* `description` (`VARCHAR(255)`)
* `updated_at` (`TIMESTAMPTZ DEFAULT now()`)

---

### 3.10 Governance Control Plane Tables (Milestone 16)

#### 26. `institutions`
Represents customer college campuses in multi-tenant or licensing setups.
* `id` (`SERIAL PRIMARY KEY`)
* `name` (`VARCHAR(150) NOT NULL`)
* `code` (`VARCHAR(50) NOT NULL UNIQUE`)
* `status` (`VARCHAR(20) NOT NULL DEFAULT 'active'`) - Enum: `'active'`, `'suspended'`, `'trial'`, `'deactivated'`
* `plan_tier` (`VARCHAR(20) NOT NULL DEFAULT 'pro'`)
* `created_at` (`TIMESTAMPTZ DEFAULT now()`)

#### 27. `plan_definitions`
Feature license entitlements per tier (`free`, `basic`, `pro`, `enterprise`).
* `id` (`SERIAL PRIMARY KEY`)
* `tier` (`VARCHAR(20) NOT NULL UNIQUE`)
* `name` (`VARCHAR(100) NOT NULL`)
* `features` (`JSONB NOT NULL`)

#### 28. `feature_entitlements`
Overrides feature availability per institution.
* `id` (`SERIAL PRIMARY KEY`)
* `institution_id` (`INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE`)
* `feature_key` (`VARCHAR(50) NOT NULL`) - e.g., `'BIOMETRIC_ATTENDANCE'`, `'GEOFENCING'`
* `status` (`VARCHAR(20) NOT NULL DEFAULT 'ENABLED'`)
* *Constraints*: `UNIQUE(institution_id, feature_key)`

#### 29. `biometric_policies`
Regulatory and compliance settings governing on-device AI.
* `id` (`SERIAL PRIMARY KEY`)
* `institution_id` (`INTEGER NOT NULL UNIQUE REFERENCES institutions(id) ON DELETE CASCADE`)
* `face_enrollment_allowed` (`BOOLEAN NOT NULL DEFAULT true`)
* `face_enrollment_update_allowed` (`BOOLEAN NOT NULL DEFAULT true`)
* `biometric_attendance_enabled` (`BOOLEAN NOT NULL DEFAULT true`)
* `max_geofence_radius_meters` (`FLOAT NOT NULL DEFAULT 500.0`)
* `require_device_integrity` (`BOOLEAN NOT NULL DEFAULT false`)

---

## 4. Complete API Directory: All 120+ Endpoints Pin-to-Pin

The following catalog details every active FastAPI endpoint across all 25 routers:

### 4.1 Authentication (`/auth`)
* `POST /auth/login`: Authenticates with `identifier` (email for teacher, username for admin) and `password`. Returns JWT `access_token` and user profile.
* `POST /auth/register`: Public registration endpoint (when enabled by institution).

### 4.2 Biometric Attendance & Check-In (`/attendance`)
* `POST /attendance/check-in`: Authoritative shift check-in. Validates UUID `idempotency_key`, GPS coordinates vs campus geofence, accuracy $\le 50\text{m}$, cosine similarity $\ge 0.60$, and liveness boolean. Records timestamp in UTC and marks status `PRESENT`.
* `POST /attendance/check-out`: Authoritative shift check-out. Re-verifies on-device biometric score ($\ge 0.60$), calculates total elapsed working duration, and commits checkout time.
* `GET /attendance/today`: Returns authenticated user's current day punch status (`is_checked_in`, `is_checked_out`, `working_duration`, record receipt).
* `GET /attendance/my`: Paginated list (`limit`, `offset`) of user's personal historical attendance records.
* `GET /attendance/admin/live-status`: Supervisory live dashboard (HOD/Admin). Queries active staff present, absent, checked-out, and active headcounts filtered by `date` and `department_id`.

### 4.3 Campus Geofences (`/geofences`)
* `GET /geofences/active`: Returns list of all active circular and polygonal geofence zones.
* `GET /geofences`: Lists all geofences (active and inactive) with metadata.
* `GET /geofences/{geofence_id}`: Retrieves specific geofence details.
* `POST /geofences`: Creates new circular or polygonal geofence zone.
* `PUT /geofences/{geofence_id}`: Updates coordinates, radius, vertices, or tolerance buffer.
* `PATCH /geofences/{geofence_id}/toggle`: Toggles active status of a geofence.
* `DELETE /geofences/{geofence_id}`: Removes a geofence.
* `POST /geofences/test-location`: Debug utility testing coordinates against active geofences.

### 4.4 Teachers & Biometric Enrollment (`/teachers`)
* `GET /teachers/me`: Retrieves current authenticated staff profile.
* `GET /teachers`: Lists faculty members (filterable by `department_id`).
* `POST /teachers`: Creates new faculty member profile.
* `POST /teachers/bulk`: Bulk CSV/JSON import of faculty accounts.
* `GET /teachers/{teacher_id}/credits`: Queries specific teacher's credit balance.
* `PUT /teachers/{teacher_id}`: Updates faculty information.
* `DELETE /teachers/{teacher_id}`: Deactivates or removes faculty account.
* `POST /teachers/me/biometrics/enroll`: Confirms completion of on-device biometric selfie enrollment, sets `has_face_enrolled = true`.
* `POST /teachers/{teacher_id}/biometrics/reset`: Admin action resetting a teacher's biometric profile.

### 4.5 Academic Calendar & Day Order Sequencing (`/academic-calendar`)
* `GET /academic-calendar/my-today-summary`: Returns today's resolved Day Order, operational blocking status, and whether user is on leave.
* `GET /academic-calendar/resolve`: Resolves Day Order for an arbitrary `date` string (`YYYY-MM-DD`).
* `GET /academic-calendar/today-summary`: Institutional overview of today's calendar status.
* `GET /academic-calendar/academic-years`: Lists all academic years.
* `POST /academic-calendar/academic-years`: Creates academic year span.
* `GET /academic-calendar/semesters`: Lists semesters.
* `POST /academic-calendar/semesters`: Creates new semester.
* `GET /academic-calendar/days`: Lists calendar dates within a date range.
* `GET /academic-calendar/days/{the_date}`: Retrieves day type and Day Order for a specific date.
* `POST /academic-calendar/days/mark`: Sets date as holiday, working day, exam day, etc.
* `POST /academic-calendar/days/bulk-mark`: Bulk holiday/day-type assignment.
* `POST /academic-calendar/days/day-order/assign`: Manually overrides Day Order (1–6) for a specific date.
* `POST /academic-calendar/days/day-order/skip`: Skips Day Order sequence on a given date.
* `DELETE /academic-calendar/days/{the_date}/override`: Removes manual override and restores auto-sequence.
* `DELETE /academic-calendar/days/{the_date}`: Resets date to default working day.
* `GET /academic-calendar/reports/working-days`: Generates working day summary report.
* `GET /academic-calendar/reports/holidays`: Lists scheduled holidays.
* `GET /academic-calendar/reports/day-orders`: Distribution of Day Orders across the term.
* `GET /academic-calendar/reports/faculty-workload`: Generates faculty workload report.

### 4.6 Timetable Management (`/timetable`)
* `GET /timetable/teacher/{teacher_id}`: Retrieves 5-period weekly timetable for a teacher.
* `GET /timetable/class/{class_id}`: Retrieves weekly timetable for a student class batch.
* `GET /timetable/`: Queries slots filtered by `class_id`, `department_id`, `teacher_id`, `day_order`.
* `POST /timetable/slot`: Adds single timetable slot.
* `POST /timetable`: Bulk creates timetable slots.
* `DELETE /timetable/{slot_id}`: Deletes timetable slot.
* `DELETE /timetable/teacher/{teacher_id}`: Clears teacher's timetable.
* `POST /timetable/reset`: Wipes and resets timetable.
* `POST /timetable/submissions`: Teacher submits draft timetable.
* `GET /timetable/submissions/my`: Teacher queries their own draft submissions.
* `GET /timetable/submissions/pending`: HOD queries pending timetable approvals.
* `POST /timetable/submissions/{submission_id}/review`: HOD approves or rejects draft timetable.
* `POST /timetable/submissions/bulk-review`: Bulk approval of draft timetables.
* `DELETE /timetable/submissions/{submission_id}`: Withdraws draft submission.

### 4.7 Leaves & Absence Management (`/leaves`)
* `GET /leaves/my`: Retrieves authenticated user's leave history (with `include_expired`).
* `GET /leaves`: Lists leaves across the department (HOD view).
* `POST /leaves`: Applies for single period leave. Computes emergency status if $< 2\text{h}$ to class.
* `POST /leaves/batch`: Applies for multiple periods on a date under a single `batch_id`.
* `DELETE /leaves/{leave_id}`: Cancels pending leave.
* `PATCH /leaves/{leave_id}/approve`: HOD approves leave and triggers substitute assignment.
* `PATCH /leaves/{leave_id}/reject`: HOD rejects leave request.
* `PATCH /leaves/{leave_id}/status`: Updates leave status with admin notes.
* `POST /leaves/bulk-approve`: Bulk approval of pending leaves.
* `POST /leaves/bulk-reject`: Bulk rejection of pending leaves.
* `POST /leaves/{leave_id}/assign`: Assigns substitute colleague to an approved leave.
* `GET /leaves/{leave_id}/recommendations`: Returns ranked candidate substitutes scored by compatibility.
* `POST /leaves/{leave_id}/assign-recommended`: Assigns top-ranked recommended substitute.
* `POST /leaves/{leave_id}/override`: Admin manually overrides an existing substitute assignment.
* `POST /leaves/{leave_id}/undo-assignment`: Removes substitute assignment.
* `POST /leaves/{leave_id}/lock`: Locks assignment preventing automated algorithm changes.
* `GET /leaves/{leave_id}/free-teachers`: Lists all teachers with no scheduled class during that period.
* `POST /leaves/{leave_id}/cancel`: Teacher cancels their own pending leave.
* `POST /leaves/{leave_id}/admin-cancel`: Admin cancels an approved or pending leave.
* `GET /leaves/{leave_id}/cancel-impact`: Simulates operational impact of cancelling a leave.
* `POST /leaves/admin-create`: Admin creates leave on behalf of a teacher.

### 4.8 Teacher Peer Substitution (`/teacher/substitution`)
* `GET /teacher/substitution/enabled`: Checks if peer substitution mode is active.
* `GET /teacher/substitution/my-leaves`: Lists classes where user has been assigned as substitute.
* `GET /teacher/substitution/leave/{leave_id}/candidates`: Scored peer recommendations for self-service substitution.
* `GET /teacher/substitution/leave/{leave_id}/free-teachers`: Unassigned teachers during leave slot.
* `POST /teacher/substitution/leave/{leave_id}/assign/{substitute_id}`: Teacher self-assigns peer substitute.
* `PUT /teacher/substitution/leave/{leave_id}/override/{substitute_id}`: Replaces peer substitute.
* `POST /teacher/substitution/leave/{leave_id}/undo-assignment`: Undoes peer assignment.
* `POST /teacher/substitution/leave/{leave_id}/lock`: Locks assignment.
* `DELETE /teacher/substitution/clear-all-assignments`: Clears substitution roster.
* `DELETE /teacher/substitution/reset-preferences`: Resets preferences to defaults.
* `GET /teacher/substitution/config`: Queries substitution engine configuration.
* `PUT /teacher/substitution/config`: Updates substitution engine thresholds.

### 4.9 Today's Substitution Coverage (`/substitutions`)
* `GET /substitutions/today`: Audit dashboard showing total leaves today, covered slots, uncovered periods, and substitute pairings.

### 4.10 Duty Credits & Workload Ledger (`/credits`)
* `GET /credits/my/transactions`: Authenticated user's credit ledger history.
* `GET /credits/transactions`: Department-wide credit transaction logs.
* `POST /credits/adjust`: Manual admin adjustment of teacher credit balance.
* `GET /credits/report`: Summary workload balance report.

### 4.11 Campus Operations & Preferences (`/campus-operations`)
* `GET /campus-operations/preferences/me`: Authenticated user's substitution preferences.
* `PUT /campus-operations/preferences/me`: Updates daily/weekly limits and cross-department willingness.
* `GET /campus-operations/preferences/{teacher_id}`: Admin inspects teacher preferences.
* `PUT /campus-operations/preferences/{teacher_id}`: Admin updates teacher preferences.
* `PUT /campus-operations/preferences/bulk-override`: Admin bulk override of teacher preferences.
* `GET /campus-operations/cross-department-substitutions`: Status of cross-department substitution toggle.
* `PUT /campus-operations/cross-department-substitutions`: Enables or disables cross-department substitutions.
* `GET /campus-operations/mode`: Queries system operational mode (`autonomous` vs `assisted`).
* `PUT /campus-operations/mode`: Sets operational mode.
* `GET /campus-operations/system-analytics`: System workload and balance analytics.
* `POST /campus-operations/dry-run`: Simulates substitution assignment run without persisting.
* `POST /campus-operations/bulk-config`: Bulk operational configuration.

### 4.12 Notifications & WebPush (`/notifications`)
* `GET /notifications`: Lists user's notifications.
* `GET /notifications/unread-count`: Returns integer count of unread notifications.
* `PATCH /notifications/{notification_id}/read`: Marks single notification as read.
* `PATCH /notifications/read-all`: Marks all notifications as read.
* `GET /notifications/vapid-public-key`: Returns public key for WebPush browser registration.
* `POST /notifications/subscribe`: Registers browser push subscription.
* `POST /notifications/unsubscribe`: Removes push subscription.
* `POST /notifications/test-push`: Sends test notification.

### 4.13 Department Management (`/departments`)
* `GET /departments`: Lists all academic departments.
* `POST /departments`: Creates new department.
* `PATCH /departments/{dept_id}`: Updates department name or code.
* `DELETE /departments/{dept_id}`: Removes department.
* `POST /departments/{dept_id}/admin`: Assigns HOD administrator to department.

### 4.14 Subject Management (`/subjects`)
* `GET /subjects`: Lists subjects.
* `POST /subjects`: Creates new subject.
* `PATCH /subjects/{subject_id}`: Updates subject name, type, or credits.
* `PATCH /subjects/{subject_id}/archive`: Archives subject.
* `PATCH /subjects/{subject_id}/unarchive`: Restores archived subject.
* `DELETE /subjects/{subject_id}`: Deletes subject.

### 4.15 Class Management (`/classes`)
* `GET /classes`: Lists class batches.
* `GET /classes/directory`: Detailed class directory with assigned tutors and rooms.
* `GET /classes/{class_id}/faculty`: Lists all teachers taking classes for this batch.
* `POST /classes`: Creates class section.
* `POST /classes/bulk`: Bulk creation of classes.
* `PATCH /classes/{class_id}`: Updates class details.
* `DELETE /classes/{class_id}`: Deletes class.

### 4.16 Room & Space Management (`/rooms`)
* `GET /rooms`: Lists classrooms and laboratories.
* `POST /rooms`: Creates room.
* `POST /rooms/bulk`: Bulk creation of rooms.
* `PATCH /rooms/{room_id}`: Updates room capacity or type.
* `DELETE /rooms/{room_id}`: Deletes room.
* `GET /rooms/availability/dashboard`: Real-time room availability matrix.
* `GET /rooms/{room_id}/check-availability`: Queries free periods for a room.
* `GET /rooms/occupancy/matrix`: Room occupancy grid across periods and Day Orders.
* `GET /rooms/occupancy`: Summary room utilization statistics.

### 4.17 Administration & System Maintenance (`/admin`)
* `GET /admin/master-export`: Master database dump in JSON/Excel format.
* `POST /admin/first-login/setup`: First-login password change endpoint for default accounts.
* `GET /admin/secondary-admins`: Lists secondary department administrators.
* `POST /admin/secondary-admins`: Creates secondary administrator.
* `PATCH /admin/secondary-admins/{admin_id}/enable`: Enables secondary admin.
* `PATCH /admin/secondary-admins/{admin_id}/disable`: Disables secondary admin.
* `GET /admin/audit-logs`: Queries immutable system audit logs.
* `POST /admin/factory-reset`: Comprehensive institutional reset.
* `POST /admin/clear-credits-history`: Clears credit transaction logs.
* `POST /admin/clear-leaves-history`: Clears leave history logs.
* `POST /admin/principal`: Provisions or updates Principal executive account.
* `GET /admin/global-users`: Lists all users across all departments.
* `DELETE /admin/global-users/{user_id}`: Deletes user.
* `GET /admin/system-metrics`: Real-time traffic, latency, and memory metrics.
* `POST /admin/system-metrics/clear-traffic`: Resets in-memory traffic logs.
* `GET /admin/managers`: Lists campus managers.
* `POST /admin/managers`: Creates manager account.
* `GET /admin/managers/{manager_id}`: Retrieves manager details.
* `PUT /admin/managers/{manager_id}`: Updates manager.
* `DELETE /admin/managers/{manager_id}`: Deletes manager.

### 4.18 Backups & Disaster Recovery (`/admin/backups`)
* `GET /admin/backups/schedule`: Queries automated backup schedule.
* `PUT /admin/backups/schedule`: Updates automated backup frequency.
* `POST /admin/backups/schedule/run-now`: Triggers manual immediate backup.
* `POST /admin/backups`: Generates full PostgreSQL database backup.
* `GET /admin/backups`: Lists available backup files.
* `GET /admin/backups/summary`: Disk usage and backup count statistics.
* `GET /admin/backups/{backup_id}`: Backup metadata.
* `GET /admin/backups/{backup_id}/download`: Streams backup file.
* `POST /admin/backups/import`: Uploads external backup file.
* `POST /admin/backups/{backup_id}/validate`: Checks backup archive checksum and integrity.
* `POST /admin/backups/{backup_id}/restore`: Restores database from backup archive.
* `DELETE /admin/backups/{backup_id}`: Deletes backup file.

### 4.19 Data Retention & Archival (`/admin/data-retention`)
* `GET /admin/data-retention/stats`: Database record counts and age statistics.
* `GET /admin/data-retention/policy`: Queries retention duration policies.
* `PUT /admin/data-retention/policy`: Updates retention threshold rules.
* `POST /admin/data-retention/run-auto-cleanup`: Executes scheduled record purge.
* `POST /admin/data-retention/preview`: Dry-run preview of records eligible for purging.
* `POST /admin/data-retention/purge`: Permanently purges historical data.

### 4.20 Principal Executive Dashboard (`/principal`)
* `GET /principal/overview`: Institutional high-level executive dashboard (campus-wide attendance, leave rates, uncovered classes).

### 4.21 Campus Manager Operations (`/manager`)
* `GET /manager/dashboard`: Operational manager dashboard.
* `GET /manager/staff`: Lists operational and non-teaching staff.
* `POST /manager/staff`: Registers new operational staff.
* `GET /manager/staff/{staff_id}`: Retrieves operational staff profile.
* `PUT /manager/staff/{staff_id}`: Updates staff profile.
* `PATCH /manager/staff/{staff_id}/status`: Updates employment status (`active`, `on_leave`, etc.).
* `DELETE /manager/staff/{staff_id}`: Deactivates staff.
* `GET /manager/labs`: Lists laboratory complexes.
* `GET /manager/leaves`: Lists operational staff leave applications.
* `POST /manager/leaves/{leave_id}/approve`: Approves staff leave.
* `POST /manager/leaves/{leave_id}/reject`: Rejects staff leave.
* `GET /manager/credits`: Queries operational staff credit balances.
* `GET /manager/credits/{staff_id}/ledger`: Staff credit ledger.
* `POST /manager/credits/adjust`: Adjusts staff credit balance.
* `POST /manager/credits/quota`: Sets shift credit quota.

### 4.22 Operational Staff Self-Service (`/staff`)
* `GET /staff/me`: Authenticated operational staff profile.
* `GET /staff/dashboard`: Operational staff personal dashboard.
* `POST /staff/leaves`: Applies for staff leave.
* `GET /staff/leaves`: Staff member's personal leave history.
* `DELETE /staff/leaves/{leave_id}`: Cancels staff leave.
* `GET /staff/ledger`: Personal credit ledger.

### 4.23 Governance & Multi-Campus Compliance (`/governance`)
* `GET /governance/overview`: Cross-departmental compliance overview.
* `GET /governance/search`: Multi-criteria search across faculty, leaves, and attendance.
* `GET /governance/candidates/{leave_id}`: Multi-department candidate recommendations.
* `POST /governance/emergency-override`: Executive emergency substitution override.
* `POST /governance/assign-substitute`: Governance-level substitute assignment.

### 4.24 System Control Plane & Feature Licensing (`/system`)
* `GET /system/dashboard`: Master control plane dashboard.
* `GET /system/institutions`: Lists registered institutions.
* `POST /system/institutions`: Registers new campus institution.
* `GET /system/institutions/{institution_id}`: Retrieves institution details.
* `PUT /system/institutions/{institution_id}`: Updates institution status or name.
* `POST /system/institutions/{institution_id}/assign-plan`: Assigns plan tier (`free`, `basic`, `pro`, `enterprise`).
* `GET /system/institutions/{institution_id}/features`: Queries feature entitlement matrix.
* `POST /system/institutions/{institution_id}/features/{feature_key}/enable`: Enables feature.
* `POST /system/institutions/{institution_id}/features/{feature_key}/disable`: Disables feature.
* `POST /system/institutions/{institution_id}/features/{feature_key}/lock`: Hard-locks feature.
* `POST /system/institutions/{institution_id}/features/{feature_key}/unlock`: Unlocks feature.
* `GET /system/institutions/{institution_id}/biometric-policy`: Queries biometric compliance settings.
* `PUT /system/institutions/{institution_id}/biometric-policy`: Updates biometric compliance rules.
* `GET /system/institutions/{institution_id}/policy`: Android mobile client endpoint fetching effective institution policy.
* `GET /system/audit-logs`: System control plane audit logs.

### 4.25 Root Health & Branding Endpoints
* `GET /health` & `GET /api/v1/health`: Returns `{"status": "ok", "service": "FAFLOW API"}`.
* `GET /settings/public`: Public branding values (`app_name`, `primary_color`, `periods_per_day`, `departments`) consumed by web and mobile frontends on boot.

---

## 5. Summary Guide for Claude AI Implementation & Cross-Stack Verification

When interacting with Claude or implementing enhancements:
1. **Source of Truth**: The database schema in this document reflects the exact models in `b:\FAFLOW_UNIFIED\backend\app\models` and PostgreSQL tables.
2. **Attendance Gating**: The mobile app performs 100% of facial AI on-device (SCRFD + MobileFaceNet ArcFace) and transmits **only verification receipts** (`face_similarity_score`, `liveness_verified`, `idempotency_key`, `latitude`, `longitude`). The backend performs server-side geofence validation and idempotency locking before committing records to `staff_attendance_records`.
3. **Emergency Leave**: A leave request is automatically flagged `is_emergency = true` if submitted within 2 hours of class start.
4. **Day Order Sequencing**: If a date is a `holiday` or `college_leave`, the 6-Day Order sequence **pauses** and resumes on the next active working day.
5. **Role Hierarchy**: All 8 roles authenticate via `POST /auth/login`. Teachers use `email`; all other roles use `username`.
