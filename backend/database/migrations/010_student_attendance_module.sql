-- ── Migration 010: Student Master and Per-Period Student Attendance Module ──

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'student_attendance_type') THEN
        CREATE TYPE student_attendance_type AS ENUM ('normal', 'registered_substitution', 'emergency');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'student_session_status') THEN
        CREATE TYPE student_session_status AS ENUM ('not_open', 'open', 'submitted', 'submitted_late', 'missed', 'locked', 'cancelled', 'not_conducted');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'student_attendance_status') THEN
        CREATE TYPE student_attendance_status AS ENUM ('present', 'absent', 'late', 'on_duty', 'leave', 'medical');
    END IF;
END$$;

-- 1. Student Master Table
CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    roll_number VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    class_id INTEGER REFERENCES classes(id) ON DELETE RESTRICT NOT NULL,
    department_id INTEGER REFERENCES departments(id) ON DELETE RESTRICT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_class_roll_number UNIQUE (class_id, roll_number)
);

CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_dept_id ON students(department_id);
CREATE INDEX IF NOT EXISTS idx_students_roll_number ON students(roll_number);

-- 2. Attendance Sessions Table
CREATE TABLE IF NOT EXISTS attendance_sessions (
    id SERIAL PRIMARY KEY,
    attendance_date DATE NOT NULL,
    calendar_day_id INTEGER REFERENCES calendar_days(id) ON DELETE SET NULL,
    timetable_slot_id INTEGER REFERENCES timetable_slots(id) ON DELETE SET NULL,
    class_id INTEGER REFERENCES classes(id) ON DELETE RESTRICT NOT NULL,
    subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
    period_number INTEGER NOT NULL,
    day_order INTEGER,
    scheduled_teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    actual_teacher_id INTEGER REFERENCES users(id) ON DELETE RESTRICT NOT NULL,
    substitution_id INTEGER REFERENCES alter_assignments(id) ON DELETE SET NULL,
    attendance_type student_attendance_type NOT NULL DEFAULT 'normal',
    status student_session_status NOT NULL DEFAULT 'open',
    scheduled_start_time TIMESTAMPTZ,
    scheduled_end_time TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    submitted_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    correction_deadline TIMESTAMPTZ,
    idempotency_key VARCHAR(100) UNIQUE,
    notes VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_session_date_class_period UNIQUE (attendance_date, class_id, period_number),
    CONSTRAINT chk_session_period_number CHECK (period_number BETWEEN 1 AND 5)
);

CREATE INDEX IF NOT EXISTS idx_att_sessions_date ON attendance_sessions(attendance_date);
CREATE INDEX IF NOT EXISTS idx_att_sessions_class_id ON attendance_sessions(class_id);
CREATE INDEX IF NOT EXISTS idx_att_sessions_subject_id ON attendance_sessions(subject_id);
CREATE INDEX IF NOT EXISTS idx_att_sessions_sched_teacher ON attendance_sessions(scheduled_teacher_id);
CREATE INDEX IF NOT EXISTS idx_att_sessions_actual_teacher ON attendance_sessions(actual_teacher_id);
CREATE INDEX IF NOT EXISTS idx_att_sessions_status ON attendance_sessions(status);
CREATE INDEX IF NOT EXISTS idx_att_sessions_submitted_at ON attendance_sessions(submitted_at);

-- 3. Student Attendance Marks Table
CREATE TABLE IF NOT EXISTS student_attendance (
    id SERIAL PRIMARY KEY,
    attendance_session_id INTEGER REFERENCES attendance_sessions(id) ON DELETE CASCADE NOT NULL,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE NOT NULL,
    status student_attendance_status NOT NULL DEFAULT 'present',
    marked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_session_student UNIQUE (attendance_session_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_student_att_session_id ON student_attendance(attendance_session_id);
CREATE INDEX IF NOT EXISTS idx_student_att_student_id ON student_attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_student_att_status ON student_attendance(status);

-- 4. Attendance Correction Audits Table
CREATE TABLE IF NOT EXISTS attendance_correction_audits (
    id SERIAL PRIMARY KEY,
    attendance_session_id INTEGER REFERENCES attendance_sessions(id) ON DELETE CASCADE NOT NULL,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE NOT NULL,
    old_status VARCHAR(50) NOT NULL,
    new_status VARCHAR(50) NOT NULL,
    changed_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reason VARCHAR(500),
    device_id VARCHAR(100),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_corr_audit_session_id ON attendance_correction_audits(attendance_session_id);
CREATE INDEX IF NOT EXISTS idx_corr_audit_student_id ON attendance_correction_audits(student_id);
