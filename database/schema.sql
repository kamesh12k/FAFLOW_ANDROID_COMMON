-- ============================================================
-- Credits — PostgreSQL Schema
-- v3: adds Academic Calendar (Academic Years, Semesters,
-- Calendar Days/Day Order/Holiday management), 5-period days,
-- on top of v2's RBAC + audit logs + factory reset.
-- ============================================================

-- ---------- ENUM TYPES ----------
CREATE TYPE user_role AS ENUM ('admin', 'teacher', 'system_admin', 'principal', 'manager', 'lab_staff', 'non_teaching_staff', 'governance');
CREATE TYPE admin_level AS ENUM ('super_admin', 'secondary_admin');
CREATE TYPE leave_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
CREATE TYPE subject_type AS ENUM ('theory', 'lab');
CREATE TYPE room_type AS ENUM ('classroom', 'lab');
CREATE TYPE day_type AS ENUM (
    'working', 'holiday', 'college_leave', 'government_holiday',
    'exam_day', 'special_event', 'department_activity', 'non_working'
);
CREATE TYPE staff_category AS ENUM ('laboratory', 'non_teaching');
CREATE TYPE employment_status AS ENUM ('active', 'on_leave', 'transferred', 'inactive');
CREATE TYPE shift_type AS ENUM ('general', 'morning', 'evening', 'night');
CREATE TYPE timetable_submission_status AS ENUM ('pending', 'approved', 'rejected', 'withdrawn');

-- ---------- DEPARTMENTS ----------
CREATE TABLE departments (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL UNIQUE,
    code            VARCHAR(20) UNIQUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- ROOMS (classrooms and labs) ----------
CREATE TABLE rooms (
    id              SERIAL PRIMARY KEY,
    room_number     VARCHAR(20) NOT NULL UNIQUE,
    room_type       room_type NOT NULL DEFAULT 'classroom',
    capacity        INTEGER NOT NULL CHECK (capacity > 0),
    department_id   INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rooms_type ON rooms(room_type);

-- ---------- USERS ----------
-- Admins authenticate with `username` (e.g. the bootstrap "admin" account).
-- Teachers authenticate with `email`.
CREATE TABLE users (
    id                      SERIAL PRIMARY KEY,
    name                    VARCHAR(100) NOT NULL,
    email                   VARCHAR(150) UNIQUE,
    username                VARCHAR(50) UNIQUE,
    password_hash           VARCHAR(255) NOT NULL,
    role                    user_role NOT NULL DEFAULT 'teacher',
    admin_level             admin_level,                  -- NULL for teachers/system_admin/principal/governance
    department              VARCHAR(100),                 -- legacy/backfill
    department_id           INTEGER REFERENCES departments(id) ON DELETE RESTRICT,
    must_change_credentials BOOLEAN NOT NULL DEFAULT false,
    is_active               BOOLEAN NOT NULL DEFAULT true,
    created_by_admin_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_user_identity CHECK (
        (role = 'teacher' AND email IS NOT NULL) OR
        (role IN ('admin', 'system_admin', 'principal', 'manager', 'lab_staff', 'non_teaching_staff', 'governance') AND username IS NOT NULL)
    ),
    CONSTRAINT chk_admin_level CHECK (
        (role = 'admin' AND admin_level IS NOT NULL) OR
        (role IN ('teacher', 'system_admin', 'principal', 'manager', 'lab_staff', 'non_teaching_staff', 'governance') AND admin_level IS NULL)
    ),
    CONSTRAINT chk_user_department_role CHECK (
        (role IN ('admin', 'teacher') AND department_id IS NOT NULL) OR
        (role IN ('manager', 'lab_staff', 'non_teaching_staff')) OR
        (role IN ('system_admin', 'principal', 'governance') AND department_id IS NULL)
    )
);

CREATE INDEX idx_users_admin_level ON users(admin_level);

-- ---------- SUBJECTS ----------
CREATE TABLE subjects (
    id              SERIAL PRIMARY KEY,
    code            VARCHAR(20) NOT NULL,
    name            VARCHAR(150) NOT NULL,
    subject_type    subject_type NOT NULL DEFAULT 'theory',
    credits         INTEGER NOT NULL CHECK (credits > 0),
    department_id   INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    semester        INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 8),
    is_archived     BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_subject_dept_code UNIQUE (department_id, code)
);

CREATE INDEX idx_subjects_department ON subjects(department_id);
CREATE INDEX idx_subjects_archived   ON subjects(is_archived);

-- ---------- CLASSES (class + section) ----------
CREATE TABLE classes (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    section         VARCHAR(10) NOT NULL,
    department_id   INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    semester        INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 8),
    default_room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_global_class_name_section UNIQUE (name, section)
);

CREATE INDEX idx_classes_department ON classes(department_id);
CREATE INDEX idx_classes_default_room ON classes(default_room_id);

-- ---------- ACADEMIC YEARS ----------
CREATE TABLE academic_years (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(20) NOT NULL UNIQUE,   -- e.g. "2026-2027"
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_academic_year_dates CHECK (end_date > start_date)
);

-- ---------- SEMESTERS ----------
-- Date-bound term within an Academic Year. Distinct from the integer
-- `semester` column on subjects/classes (curriculum sequence 1-8), which
-- this table intentionally does NOT replace.
CREATE TABLE semesters (
    id                  SERIAL PRIMARY KEY,
    academic_year_id    INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    name                VARCHAR(50) NOT NULL,
    start_date          DATE NOT NULL,
    end_date            DATE NOT NULL,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_semester_dates CHECK (end_date > start_date)
);

CREATE INDEX idx_semesters_academic_year ON semesters(academic_year_id);

-- ---------- CALENDAR DAYS (Day Order + Holiday Management) ----------
-- One row per calendar date the institution has touched. day_type drives
-- everything: 'working' days carry a day_order (1-6) and feed timetable /
-- substitute / credit / workload / attendance calculations; every other
-- day_type structurally CANNOT carry a day_order (chk_calendar_day_order
-- below) and is excluded from all of those calculations by application
-- logic that checks day_type before doing anything date-related.
CREATE TABLE calendar_days (
    id                      SERIAL PRIMARY KEY,
    date                    DATE NOT NULL UNIQUE,
    day_type                day_type NOT NULL DEFAULT 'working',
    day_order               INTEGER CHECK (day_order BETWEEN 1 AND 6),  -- NULL for non-working days
    academic_year_id        INTEGER REFERENCES academic_years(id) ON DELETE SET NULL,
    semester_id             INTEGER REFERENCES semesters(id) ON DELETE SET NULL,
    is_manual_override      BOOLEAN NOT NULL DEFAULT false,
    label                   VARCHAR(200),
    notes                   VARCHAR(500),
    created_by_admin_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_calendar_day_order CHECK (
        (day_type = 'working') OR (day_order IS NULL)
    )
);

CREATE INDEX idx_calendar_days_date      ON calendar_days(date);
CREATE INDEX idx_calendar_days_day_type  ON calendar_days(day_type);
CREATE INDEX idx_calendar_days_day_order ON calendar_days(day_order);

CREATE OR REPLACE FUNCTION fn_calendar_days_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calendar_days_touch_updated_at
    BEFORE UPDATE ON calendar_days
    FOR EACH ROW
    EXECUTE FUNCTION fn_calendar_days_touch_updated_at();

-- ---------- TIMETABLE SLOTS ----------
-- Keyed by Day Order (1-6), NOT calendar date — the same Day Order
-- recurs across many actual dates as the rotation cycles, and holidays
-- pausing the rotation don't require touching timetable_slots at all.
CREATE TABLE timetable_slots (
    id              SERIAL PRIMARY KEY,
    teacher_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id      INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
    class_id        INTEGER NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
    room_id         INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
    day_order       INTEGER NOT NULL CHECK (day_order BETWEEN 1 AND 6),
    period_number   INTEGER NOT NULL CHECK (period_number BETWEEN 1 AND 5),  -- 5 periods/day

    CONSTRAINT uq_teacher_class_day_period UNIQUE (teacher_id, class_id, day_order, period_number)
);

CREATE INDEX idx_timetable_slots_teacher   ON timetable_slots(teacher_id);
CREATE INDEX idx_timetable_slots_room      ON timetable_slots(room_id);
CREATE INDEX idx_timetable_slots_class     ON timetable_slots(class_id);
CREATE INDEX idx_timetable_slots_subject   ON timetable_slots(subject_id);
CREATE INDEX idx_timetable_slots_day_order ON timetable_slots(day_order);

-- ---------- LEAVE REQUESTS ----------
-- date is the actual calendar date applied for; day_order is resolved
-- from calendar_days at submission time and stored alongside it so
-- substitute-detection (which is Day-Order-based, matching
-- timetable_slots) doesn't need a join back to calendar_days on every
-- lookup. The application layer (leave_service.submit_leave) refuses to
-- create a row at all if calendar_days says the date isn't a working day.
CREATE TABLE leave_requests (
    id              SERIAL PRIMARY KEY,
    teacher_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date            DATE NOT NULL,
    day_order       INTEGER NOT NULL CHECK (day_order BETWEEN 1 AND 6),
    period_number   INTEGER NOT NULL CHECK (period_number BETWEEN 1 AND 5),
    reason          VARCHAR(500) NOT NULL,
    status          leave_status NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    batch_id        UUID,
    -- True if submitted inside the emergency window (see
    -- system_settings.emergency_window_hours) — computed once at
    -- submission time, see app/services/substitution_service.py.
    is_emergency    BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_leave_requests_teacher  ON leave_requests(teacher_id);
CREATE INDEX idx_leave_requests_status   ON leave_requests(status);
CREATE INDEX idx_leave_requests_date     ON leave_requests(date);
CREATE INDEX idx_leave_requests_batch_id ON leave_requests(batch_id);

-- ---------- ALTER (SUBSTITUTE) ASSIGNMENTS ----------
CREATE TYPE assignment_type AS ENUM (
    'auto_assigned', 'faculty_recommended', 'admin_assigned',
    'auto_swapped', 'overridden', 'emergency', 'teacher_assigned', 'combined_class'
);


CREATE TABLE alter_assignments (
    id                      SERIAL PRIMARY KEY,
    leave_request_id        INTEGER NOT NULL UNIQUE REFERENCES leave_requests(id) ON DELETE CASCADE,
    substitute_teacher_id   INTEGER NOT NULL REFERENCES users(id),
    assigned_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- How this assignment came to be — drives the dashboard's color-coded
    -- badge. Purely descriptive; never read by eligibility checks.
    assignment_type         assignment_type NOT NULL DEFAULT 'admin_assigned',
    -- Recommendation engine's score (0-100) at the moment of assignment,
    -- or NULL for a manual pick that bypassed scoring entirely. A
    -- historical snapshot, not something to recompute later.
    compatibility_score     REAL,
    -- Locked assignments are never touched by the autonomous engine
    -- (no auto-swap, no self-healing reroute). An admin can still
    -- manually override a locked assignment — the lock only restrains
    -- the autonomous engine, not the admin.
    is_locked               BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT chk_sub_not_self CHECK (substitute_teacher_id IS NOT NULL)
);

CREATE INDEX idx_alter_assignments_substitute ON alter_assignments(substitute_teacher_id);
CREATE INDEX idx_alter_assignments_type        ON alter_assignments(assignment_type);

-- ---------- SUBSTITUTION PREFERENCES ----------
-- One row per teacher, created lazily on first access — see
-- app/services/substitution_service.get_or_create_preferences.
CREATE TABLE substitution_preferences (
    id                          SERIAL PRIMARY KEY,
    teacher_id                  INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    accept_auto_assignments     BOOLEAN NOT NULL DEFAULT true,
    allow_emergency_assignments BOOLEAN NOT NULL DEFAULT true,
    max_weekly_substitutions    INTEGER,  -- NULL = no cap
    prefer_morning_classes      BOOLEAN NOT NULL DEFAULT false,
    prefer_same_department      BOOLEAN NOT NULL DEFAULT true
);

-- ---------- TEACHER CREDITS (cached running balance) ----------
CREATE TABLE teacher_credits (
    id              SERIAL PRIMARY KEY,
    teacher_id      INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    balance         INTEGER NOT NULL DEFAULT 0
);

-- ---------- CREDIT TRANSACTIONS (immutable audit ledger) ----------
CREATE TABLE credit_transactions (
    id                  SERIAL PRIMARY KEY,
    teacher_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    change              INTEGER NOT NULL CHECK (change IN (1, -1)),
    reason              VARCHAR(255) NOT NULL,
    related_leave_id    INTEGER REFERENCES leave_requests(id) ON DELETE SET NULL,
    category            VARCHAR(50) DEFAULT 'other',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_credit_transactions_teacher ON credit_transactions(teacher_id);
CREATE INDEX idx_credit_transactions_leave   ON credit_transactions(related_leave_id);

-- ---------- TRIGGER: prevent substitute = leave requester ----------
CREATE OR REPLACE FUNCTION fn_check_substitute_not_requester()
RETURNS TRIGGER AS $$
DECLARE
    requester_id INTEGER;
BEGIN
    SELECT teacher_id INTO requester_id
    FROM leave_requests
    WHERE id = NEW.leave_request_id;

    IF requester_id = NEW.substitute_teacher_id THEN
        RAISE EXCEPTION 'A teacher cannot be their own substitute (leave_request_id=%)', NEW.leave_request_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_substitute_not_requester
    BEFORE INSERT OR UPDATE ON alter_assignments
    FOR EACH ROW
    EXECUTE FUNCTION fn_check_substitute_not_requester();

-- ---------- NOTIFICATIONS ----------
CREATE TABLE notifications (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title               VARCHAR(150) NOT NULL,
    body                VARCHAR(500) NOT NULL,
    event_type          VARCHAR(50) NOT NULL,
    related_leave_id    INTEGER REFERENCES leave_requests(id) ON DELETE SET NULL,
    is_read             BOOLEAN NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user      ON notifications(user_id);
CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read);

-- ---------- PUSH SUBSCRIPTIONS ----------
CREATE TABLE push_subscriptions (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint        TEXT NOT NULL UNIQUE,
    p256dh_key      VARCHAR(255) NOT NULL,
    auth_key        VARCHAR(255) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);

-- ---------- AUDIT LOGS ----------
-- Tracks admin-management actions (secondary admin create/disable/enable,
-- factory reset, first-login credential changes, and academic-calendar
-- mutations: holiday marking, day-order overrides/skips). Wiped by
-- factory reset itself, by design (spec: "Delete all logs/history").
CREATE TABLE audit_logs (
    id              SERIAL PRIMARY KEY,
    actor_user_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action          VARCHAR(100) NOT NULL,
    target_type     VARCHAR(50),
    target_id       INTEGER,
    details         JSONB,
    department_id   INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

-- ---------- SYSTEM SETTINGS ----------
-- Small key/value store for settings that factory reset restores to
-- defaults (most config lives in .env, which factory reset never touches).
CREATE TABLE system_settings (
    id              SERIAL PRIMARY KEY,
    key             VARCHAR(100) NOT NULL,
    value           TEXT NOT NULL,
    department_id   INTEGER REFERENCES departments(id) ON DELETE CASCADE,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_system_settings_key_dept ON system_settings (key, department_id) WHERE department_id IS NOT NULL;
CREATE UNIQUE INDEX uq_system_settings_key_global ON system_settings (key) WHERE department_id IS NULL;

-- Initial global default settings (department_id IS NULL)
INSERT INTO system_settings (key, value, department_id) VALUES
    ('app_name', 'FAFLOW', NULL),
    ('push_notifications_enabled', 'true', NULL),
    ('max_secondary_admins', '3', NULL),
    ('periods_per_day', '5', NULL),
    ('day_order_max', '6', NULL),
    ('campus_operations_mode', 'assisted', NULL),
    ('emergency_window_hours', '2', NULL),
    ('cross_department_substitutions_enabled', 'false', NULL),
    ('teacher_self_management_enabled', 'true', NULL),
    ('max_weekly_substitutions', '3', NULL);


-- ---------- OPERATIONAL STAFF ----------
CREATE TABLE operational_staff (
    id                      SERIAL PRIMARY KEY,
    employee_code           VARCHAR(50) NOT NULL UNIQUE,
    full_name               VARCHAR(150) NOT NULL,
    category                staff_category NOT NULL,
    designation             VARCHAR(100) NOT NULL,
    department_id           INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    assigned_room_id        INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
    assigned_room_ids       JSONB DEFAULT '[]'::jsonb,
    phone_number            VARCHAR(20),
    email                   VARCHAR(150),
    employment_status       employment_status NOT NULL DEFAULT 'active',
    shift_type              shift_type NOT NULL DEFAULT 'general',
    joining_date            DATE,
    user_id                 INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_by_manager_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    notes                   TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_operational_staff_code     ON operational_staff(employee_code);
CREATE INDEX idx_operational_staff_name     ON operational_staff(full_name);
CREATE INDEX idx_operational_staff_category ON operational_staff(category);
CREATE INDEX idx_operational_staff_dept     ON operational_staff(department_id);
CREATE INDEX idx_operational_staff_room     ON operational_staff(assigned_room_id);
CREATE INDEX idx_operational_staff_status   ON operational_staff(employment_status);

-- ---------- STAFF LEAVE REQUESTS ----------
CREATE TABLE staff_leave_requests (
    id                  SERIAL PRIMARY KEY,
    staff_id            INTEGER NOT NULL REFERENCES operational_staff(id) ON DELETE CASCADE,
    start_date          DATE NOT NULL,
    end_date            DATE NOT NULL,
    leave_type          VARCHAR(50) NOT NULL DEFAULT 'casual',
    is_half_day         BOOLEAN NOT NULL DEFAULT false,
    half_day_session    VARCHAR(20),
    days_count          DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    reason              TEXT NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'pending',
    approved_by_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approval_remarks    TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_staff_leave_requests_staff  ON staff_leave_requests(staff_id);
CREATE INDEX idx_staff_leave_requests_start  ON staff_leave_requests(start_date);
CREATE INDEX idx_staff_leave_requests_end    ON staff_leave_requests(end_date);
CREATE INDEX idx_staff_leave_requests_status ON staff_leave_requests(status);

-- ---------- STAFF CREDITS ----------
CREATE TABLE staff_credits (
    id              SERIAL PRIMARY KEY,
    staff_id        INTEGER NOT NULL UNIQUE REFERENCES operational_staff(id) ON DELETE CASCADE,
    annual_quota    DOUBLE PRECISION NOT NULL DEFAULT 12.0,
    balance         DOUBLE PRECISION NOT NULL DEFAULT 12.0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_staff_credits_staff ON staff_credits(staff_id);

-- ---------- STAFF CREDIT TRANSACTIONS ----------
CREATE TABLE staff_credit_transactions (
    id                  SERIAL PRIMARY KEY,
    staff_id            INTEGER NOT NULL REFERENCES operational_staff(id) ON DELETE CASCADE,
    change              DOUBLE PRECISION NOT NULL,
    balance_after       DOUBLE PRECISION NOT NULL,
    category            VARCHAR(50) NOT NULL DEFAULT 'manual_adjustment',
    reason              TEXT NOT NULL,
    related_leave_id    INTEGER REFERENCES staff_leave_requests(id) ON DELETE SET NULL,
    created_by_user_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_staff_credit_tx_staff   ON staff_credit_transactions(staff_id);
CREATE INDEX idx_staff_credit_tx_created ON staff_credit_transactions(created_at);

-- ---------- TIMETABLE SUBMISSIONS ----------
CREATE TABLE timetable_submissions (
    id                  SERIAL PRIMARY KEY,
    teacher_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id          INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
    class_id            INTEGER NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
    room_id             INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
    day_order           INTEGER NOT NULL,
    period_number       INTEGER NOT NULL,
    status              timetable_submission_status NOT NULL DEFAULT 'pending',
    review_note         VARCHAR(500),
    reviewed_by_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at         TIMESTAMPTZ
);

CREATE INDEX idx_timetable_submissions_teacher ON timetable_submissions(teacher_id);
CREATE INDEX idx_timetable_submissions_status  ON timetable_submissions(status);

-- ---------- DATA RETENTION & PURGE POLICIES ----------
CREATE TABLE data_retention_policies (
    id                                  SERIAL PRIMARY KEY,
    retention_audit_logs_days           INTEGER NOT NULL DEFAULT 90,
    retention_notifications_days        INTEGER NOT NULL DEFAULT 60,
    retention_substitution_days         INTEGER NOT NULL DEFAULT 180,
    retention_timetable_submissions_days INTEGER NOT NULL DEFAULT 180,
    retention_academic_calendar_days    INTEGER NOT NULL DEFAULT 365,
    auto_cleanup_enabled                BOOLEAN NOT NULL DEFAULT false,
    auto_cleanup_schedule               VARCHAR(50) NOT NULL DEFAULT 'daily_midnight',
    last_auto_cleanup_at                TIMESTAMPTZ,
    updated_at                          TIMESTAMPTZ NOT NULL DEFAULT now()
);
