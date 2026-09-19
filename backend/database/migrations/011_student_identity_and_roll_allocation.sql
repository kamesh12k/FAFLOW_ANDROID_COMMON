-- ── Migration 011: Student Identity, Academic-Year Enrollment & Class Roll Rules ──

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'student_enrollment_status') THEN
        CREATE TYPE student_enrollment_status AS ENUM ('active', 'promoted', 'repeated', 'transferred', 'withdrawn', 'graduated');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'roll_exception_type') THEN
        CREATE TYPE roll_exception_type AS ENUM ('INCLUDE', 'EXCLUDE');
    END IF;
END$$;

-- 1. Extend students table with permanent admission year and updated_at
ALTER TABLE students ADD COLUMN IF NOT EXISTS admission_year INTEGER;
ALTER TABLE students ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 2. Student Enrollment Table (Tracks student's placement per academic year)
CREATE TABLE IF NOT EXISTS student_enrollments (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES students(id) ON DELETE RESTRICT NOT NULL,
    academic_year_id INTEGER REFERENCES academic_years(id) ON DELETE RESTRICT NOT NULL,
    class_id INTEGER REFERENCES classes(id) ON DELETE RESTRICT NOT NULL,
    roll_number VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    left_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_student_academic_year UNIQUE (student_id, academic_year_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollment_student ON student_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_class_year ON student_enrollments(class_id, academic_year_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_roll ON student_enrollments(roll_number);

-- 3. Class Roll Number Rules (Defines the default roll range for a class per academic year)
CREATE TABLE IF NOT EXISTS class_roll_rules (
    id SERIAL PRIMARY KEY,
    class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
    academic_year_id INTEGER REFERENCES academic_years(id) ON DELETE CASCADE NOT NULL,
    prefix VARCHAR(20) NOT NULL,
    start_number INTEGER NOT NULL,
    end_number INTEGER NOT NULL,
    padding INTEGER NOT NULL DEFAULT 3,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_class_academic_year_rule UNIQUE (class_id, academic_year_id)
);

CREATE INDEX IF NOT EXISTS idx_class_roll_rules_class_year ON class_roll_rules(class_id, academic_year_id);

-- 4. Class Roll Exceptions (Explicit INCLUDES for 'Others' and EXCLUDES)
CREATE TABLE IF NOT EXISTS class_roll_exceptions (
    id SERIAL PRIMARY KEY,
    class_roll_rule_id INTEGER REFERENCES class_roll_rules(id) ON DELETE CASCADE NOT NULL,
    roll_number VARCHAR(50) NOT NULL,
    exception_type VARCHAR(20) NOT NULL,
    reason VARCHAR(255),
    student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
    created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_rule_roll_exception UNIQUE (class_roll_rule_id, roll_number)
);

CREATE INDEX IF NOT EXISTS idx_roll_exceptions_rule ON class_roll_exceptions(class_roll_rule_id);
CREATE INDEX IF NOT EXISTS idx_roll_exceptions_roll ON class_roll_exceptions(roll_number);

-- 5. Safe Backfill: Enroll active students into the current active academic year
DO $$
DECLARE
    active_year_id INTEGER;
BEGIN
    SELECT id INTO active_year_id FROM academic_years WHERE is_active = true ORDER BY start_date DESC LIMIT 1;
    IF active_year_id IS NOT NULL THEN
        INSERT INTO student_enrollments (student_id, academic_year_id, class_id, roll_number, status, joined_at)
        SELECT s.id, active_year_id, s.class_id, s.roll_number, 'active', COALESCE(s.created_at, now())
        FROM students s
        WHERE s.class_id IS NOT NULL AND s.is_active = true
        ON CONFLICT (student_id, academic_year_id) DO NOTHING;
    END IF;
END$$;
