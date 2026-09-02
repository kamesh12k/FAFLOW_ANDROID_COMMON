-- Global classes, teacher timetable submissions, and cross-department policy.
BEGIN;

ALTER TABLE classes DROP CONSTRAINT IF EXISTS uq_class_name_section;
ALTER TABLE classes DROP CONSTRAINT IF EXISTS uq_global_class_name_section;
ALTER TABLE classes ADD CONSTRAINT uq_global_class_name_section UNIQUE (name, section);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'timetable_submission_status') THEN
    CREATE TYPE timetable_submission_status AS ENUM ('pending', 'approved', 'rejected', 'withdrawn');
  END IF;
END $$;
CREATE TABLE timetable_submissions (
    id SERIAL PRIMARY KEY,
    teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
    class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
    room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
    day_order INTEGER NOT NULL CHECK (day_order BETWEEN 1 AND 6),
    period_number INTEGER NOT NULL CHECK (period_number BETWEEN 1 AND 5),
    status timetable_submission_status NOT NULL DEFAULT 'pending',
    review_note VARCHAR(500),
    reviewed_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at TIMESTAMPTZ
);
CREATE INDEX idx_timetable_submissions_teacher_status ON timetable_submissions (teacher_id, status);

INSERT INTO system_settings (key, value, department_id)
VALUES ('cross_department_substitutions_enabled', 'false', NULL),
       ('teacher_timetable_entry_mode', 'approval', NULL)
ON CONFLICT DO NOTHING;
COMMIT;
