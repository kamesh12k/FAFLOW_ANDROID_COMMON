-- ============================================================
-- Migration 004: Autonomous Substitution Engine
--   - assignment_type enum + alter_assignments columns
--     (assignment_type, compatibility_score, is_locked)
--   - leave_requests.is_emergency
--   - substitution_preferences table
--   - campus_operations_mode / emergency_window_hours settings
--
-- Safe to run against an existing v3 database. Run with:
--   psql -d credits_db -f database/migrations/004_autonomous_substitution.sql
-- ============================================================

BEGIN;

-- ---------- New enum: assignment_type ----------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignment_type') THEN
        CREATE TYPE assignment_type AS ENUM (
            'auto_assigned', 'faculty_recommended', 'admin_assigned',
            'auto_swapped', 'overridden', 'emergency'
        );
    END IF;
END $$;

-- ---------- leave_requests: is_emergency ----------
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS is_emergency BOOLEAN NOT NULL DEFAULT false;

-- ---------- alter_assignments: new columns ----------
-- Existing rows predate this feature entirely — they were all manual
-- admin actions by definition (the autonomous engine didn't exist yet),
-- so backfilling assignment_type='admin_assigned' is the only honest
-- default; there is no faithful way to reconstruct which of these were
-- "really" auto-assigned after the fact.
ALTER TABLE alter_assignments ADD COLUMN IF NOT EXISTS assignment_type assignment_type NOT NULL DEFAULT 'admin_assigned';
ALTER TABLE alter_assignments ADD COLUMN IF NOT EXISTS compatibility_score REAL;
ALTER TABLE alter_assignments ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_alter_assignments_type ON alter_assignments(assignment_type);

-- ---------- substitution_preferences ----------
CREATE TABLE IF NOT EXISTS substitution_preferences (
    id                          SERIAL PRIMARY KEY,
    teacher_id                  INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    accept_auto_assignments     BOOLEAN NOT NULL DEFAULT true,
    allow_emergency_assignments BOOLEAN NOT NULL DEFAULT true,
    max_weekly_substitutions    INTEGER,
    prefer_morning_classes      BOOLEAN NOT NULL DEFAULT false,
    prefer_same_department      BOOLEAN NOT NULL DEFAULT true
);

-- ---------- system_settings: new defaults ----------
-- campus_operations_mode defaults to 'assisted' on a fresh install (see
-- schema.sql / DEFAULT_SYSTEM_SETTINGS), but an *existing* installation
-- running this migration gets 'manual' instead — upgrading a live system
-- should never silently turn on auto-recommendations, let alone full
-- autonomy, without the admin deliberately opting in afterward.
INSERT INTO system_settings (key, value) VALUES
    ('campus_operations_mode', 'manual'),
    ('emergency_window_hours', '2')
ON CONFLICT (key) DO NOTHING;

COMMIT;

-- ---------- Manual follow-up (not run automatically) ----------
-- Visit Admin -> Settings -> Campus Operations Mode to move from
-- 'manual' to 'assisted' or 'autonomous' once you're ready — this
-- migration deliberately leaves existing installations on the most
-- conservative setting.
