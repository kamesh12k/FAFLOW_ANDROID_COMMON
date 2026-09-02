-- ============================================================
-- Migration 008: Operational Staff, Staff Leaves & Timetable Submissions
-- ============================================================

-- ---------- 1. ALTER ENUM TYPES ----------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'manager' AND enumtypid = 'user_role'::regtype) THEN
        ALTER TYPE user_role ADD VALUE 'manager';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'lab_staff' AND enumtypid = 'user_role'::regtype) THEN
        ALTER TYPE user_role ADD VALUE 'lab_staff';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'non_teaching_staff' AND enumtypid = 'user_role'::regtype) THEN
        ALTER TYPE user_role ADD VALUE 'non_teaching_staff';
    END IF;
END $$;

CREATE TYPE staff_category AS ENUM ('laboratory', 'non_teaching');
CREATE TYPE employment_status AS ENUM ('active', 'on_leave', 'transferred', 'inactive');
CREATE TYPE shift_type AS ENUM ('general', 'morning', 'evening', 'night');
CREATE TYPE timetable_submission_status AS ENUM ('pending', 'approved', 'rejected', 'withdrawn');

-- ---------- 2. OPERATIONAL STAFF ----------
CREATE TABLE IF NOT EXISTS operational_staff (
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

CREATE INDEX IF NOT EXISTS idx_operational_staff_code ON operational_staff(employee_code);
CREATE INDEX IF NOT EXISTS idx_operational_staff_name ON operational_staff(full_name);
CREATE INDEX IF NOT EXISTS idx_operational_staff_category ON operational_staff(category);
CREATE INDEX IF NOT EXISTS idx_operational_staff_dept ON operational_staff(department_id);
CREATE INDEX IF NOT EXISTS idx_operational_staff_room ON operational_staff(assigned_room_id);
CREATE INDEX IF NOT EXISTS idx_operational_staff_status ON operational_staff(employment_status);

-- ---------- 3. STAFF LEAVE REQUESTS ----------
CREATE TABLE IF NOT EXISTS staff_leave_requests (
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

CREATE INDEX IF NOT EXISTS idx_staff_leave_requests_staff ON staff_leave_requests(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_leave_requests_start ON staff_leave_requests(start_date);
CREATE INDEX IF NOT EXISTS idx_staff_leave_requests_end ON staff_leave_requests(end_date);
CREATE INDEX IF NOT EXISTS idx_staff_leave_requests_status ON staff_leave_requests(status);

-- ---------- 4. STAFF CREDITS ----------
CREATE TABLE IF NOT EXISTS staff_credits (
    id              SERIAL PRIMARY KEY,
    staff_id        INTEGER NOT NULL UNIQUE REFERENCES operational_staff(id) ON DELETE CASCADE,
    annual_quota    DOUBLE PRECISION NOT NULL DEFAULT 12.0,
    balance         DOUBLE PRECISION NOT NULL DEFAULT 12.0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_credits_staff ON staff_credits(staff_id);

-- ---------- 5. STAFF CREDIT TRANSACTIONS ----------
CREATE TABLE IF NOT EXISTS staff_credit_transactions (
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

CREATE INDEX IF NOT EXISTS idx_staff_credit_tx_staff ON staff_credit_transactions(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_credit_tx_created ON staff_credit_transactions(created_at);

-- ---------- 6. TIMETABLE SUBMISSIONS ----------
CREATE TABLE IF NOT EXISTS timetable_submissions (
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

CREATE INDEX IF NOT EXISTS idx_timetable_submissions_teacher ON timetable_submissions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_timetable_submissions_status ON timetable_submissions(status);
