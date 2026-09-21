-- Migration 010: Campus Duty Management Subsystem
-- Implements Discipline Duty, Wing Duty, Exam Duty, and extensible Special Duty
-- Supports break periods, areas, auto-assignment runs, candidate explainability, locking, and overrides.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'duty_type') THEN
        CREATE TYPE duty_type AS ENUM ('DISCIPLINE_DUTY', 'WING_DUTY', 'EXAM_DUTY', 'SPECIAL_DUTY');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'duty_status') THEN
        CREATE TYPE duty_status AS ENUM ('DRAFT', 'GENERATING', 'PENDING_REVIEW', 'PUBLISHED', 'ACTIVE', 'COMPLETED', 'CANCELLED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'duty_assignment_state') THEN
        CREATE TYPE duty_assignment_state AS ENUM ('PROPOSED', 'ASSIGNED', 'OVERRIDDEN', 'LOCKED', 'REPLACED', 'CANCELLED', 'COMPLETED');
    END IF;
END$$;

-- 1. Campus Areas / Wings
CREATE TABLE IF NOT EXISTS campus_areas (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_campus_areas_code ON campus_areas (code);

-- 2. Configurable Break Periods
CREATE TABLE IF NOT EXISTS duty_break_periods (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    break_type VARCHAR(50) NOT NULL DEFAULT 'INTERVAL',
    start_time VARCHAR(10) NOT NULL,
    end_time VARCHAR(10) NOT NULL,
    preceding_period_number INTEGER,
    default_required_teachers INTEGER NOT NULL DEFAULT 3,
    min_teachers INTEGER NOT NULL DEFAULT 1,
    max_teachers INTEGER NOT NULL DEFAULT 10,
    applicable_day_orders VARCHAR(50) DEFAULT '1,2,3,4,5,6',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_duty_break_periods_name ON duty_break_periods (name);

-- 3. Campus Duties
CREATE TABLE IF NOT EXISTS campus_duties (
    id SERIAL PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    duty_type duty_type NOT NULL DEFAULT 'DISCIPLINE_DUTY',
    duty_date VARCHAR(15) NOT NULL,
    start_time VARCHAR(10) NOT NULL,
    end_time VARCHAR(10) NOT NULL,
    area_id INTEGER REFERENCES campus_areas(id) ON DELETE SET NULL,
    area_name VARCHAR(120),
    break_id INTEGER REFERENCES duty_break_periods(id) ON DELETE SET NULL,
    break_name VARCHAR(100),
    required_teachers INTEGER NOT NULL DEFAULT 1,
    assigned_teachers INTEGER NOT NULL DEFAULT 0,
    status duty_status NOT NULL DEFAULT 'DRAFT',
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    locked_at TIMESTAMP WITHOUT TIME ZONE,
    locked_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    instructions TEXT,
    notes TEXT,
    created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_campus_duties_duty_date ON campus_duties (duty_date);
CREATE INDEX IF NOT EXISTS ix_campus_duties_duty_type ON campus_duties (duty_type);
CREATE INDEX IF NOT EXISTS ix_campus_duties_status ON campus_duties (status);
CREATE INDEX IF NOT EXISTS ix_campus_duties_department_id ON campus_duties (department_id);

-- 4. Duty Assignments
CREATE TABLE IF NOT EXISTS duty_assignments (
    id SERIAL PRIMARY KEY,
    duty_id INTEGER NOT NULL REFERENCES campus_duties(id) ON DELETE CASCADE,
    teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assignment_state duty_assignment_state NOT NULL DEFAULT 'ASSIGNED',
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    locked_at TIMESTAMP WITHOUT TIME ZONE,
    locked_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    lock_reason VARCHAR(255),
    selection_reason VARCHAR(255),
    selection_score DOUBLE PRECISION DEFAULT 0.0,
    is_overridden BOOLEAN NOT NULL DEFAULT FALSE,
    original_teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    overridden_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    override_reason VARCHAR(255),
    overridden_at TIMESTAMP WITHOUT TIME ZONE,
    is_replaced BOOLEAN NOT NULL DEFAULT FALSE,
    replacement_reason VARCHAR(255),
    replaced_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_duty_assignment_teacher UNIQUE (duty_id, teacher_id)
);

CREATE INDEX IF NOT EXISTS ix_duty_assignments_duty_id ON duty_assignments (duty_id);
CREATE INDEX IF NOT EXISTS ix_duty_assignments_teacher_id ON duty_assignments (teacher_id);
CREATE INDEX IF NOT EXISTS ix_duty_assignments_state ON duty_assignments (assignment_state);

-- 5. Duty Assignment Runs (Traceability and Auditability)
CREATE TABLE IF NOT EXISTS duty_assignment_runs (
    id SERIAL PRIMARY KEY,
    run_uuid VARCHAR(64) UNIQUE NOT NULL,
    triggered_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    target_date VARCHAR(15) NOT NULL,
    duty_type duty_type NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'SUCCESS',
    duties_processed INTEGER NOT NULL DEFAULT 0,
    total_assigned INTEGER NOT NULL DEFAULT 0,
    total_unfilled INTEGER NOT NULL DEFAULT 0,
    errors JSONB,
    config_snapshot JSONB,
    started_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITHOUT TIME ZONE
);

CREATE INDEX IF NOT EXISTS ix_duty_assignment_runs_target_date ON duty_assignment_runs (target_date);
CREATE INDEX IF NOT EXISTS ix_duty_assignment_runs_uuid ON duty_assignment_runs (run_uuid);

-- Seed initial standard campus break periods if empty
INSERT INTO duty_break_periods (name, break_type, start_time, end_time, preceding_period_number, default_required_teachers, min_teachers, max_teachers)
SELECT 'Morning Interval', 'INTERVAL', '11:15', '11:35', 2, 3, 1, 6
WHERE NOT EXISTS (SELECT 1 FROM duty_break_periods WHERE name = 'Morning Interval');

INSERT INTO duty_break_periods (name, break_type, start_time, end_time, preceding_period_number, default_required_teachers, min_teachers, max_teachers)
SELECT 'Lunch Break', 'LUNCH', '12:35', '13:15', 3, 5, 2, 10
WHERE NOT EXISTS (SELECT 1 FROM duty_break_periods WHERE name = 'Lunch Break');

-- Seed initial campus zones if empty
INSERT INTO campus_areas (name, code, description)
SELECT 'Main Block Ground Floor', 'MB-GF', 'Central corridor, administrative quadrangle and main entrance'
WHERE NOT EXISTS (SELECT 1 FROM campus_areas WHERE code = 'MB-GF');

INSERT INTO campus_areas (name, code, description)
SELECT 'Science & Engineering Wing', 'SE-W1', 'First and second floor laboratory corridors'
WHERE NOT EXISTS (SELECT 1 FROM campus_areas WHERE code = 'SE-W1');

INSERT INTO campus_areas (name, code, description)
SELECT 'Library & Auditorium Promenade', 'LIB-AUD', 'Student circulation promenade and outdoor canteen pathway'
WHERE NOT EXISTS (SELECT 1 FROM campus_areas WHERE code = 'LIB-AUD');
