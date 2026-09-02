-- ============================================================
-- Migration 003: Academic Calendar & Holiday Management
--
-- Adds Academic Years, Semesters, and replaces the old
-- day_order_calendar (date -> day_order only) with calendar_days
-- (date -> day_type + optional day_order), which is what now
-- drives holiday exclusion across timetable/leave/credit/workload.
--
-- Also tightens period_number from 1-8 to 1-5 (five periods/day
-- per the updated spec) on timetable_slots and leave_requests.
--
-- Safe to run against an existing v2 database. Run with:
--   psql -d credits_db -f database/migrations/003_academic_calendar.sql
-- ============================================================

BEGIN;

-- ---------- New enum: day_type ----------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'day_type') THEN
        CREATE TYPE day_type AS ENUM (
            'working', 'holiday', 'college_leave', 'government_holiday',
            'exam_day', 'special_event', 'department_activity', 'non_working'
        );
    END IF;
END $$;

-- ---------- academic_years ----------
CREATE TABLE IF NOT EXISTS academic_years (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(20) NOT NULL UNIQUE,
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_academic_year_dates CHECK (end_date > start_date)
);

-- ---------- semesters ----------
CREATE TABLE IF NOT EXISTS semesters (
    id                  SERIAL PRIMARY KEY,
    academic_year_id    INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    name                VARCHAR(50) NOT NULL,
    start_date          DATE NOT NULL,
    end_date            DATE NOT NULL,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_semester_dates CHECK (end_date > start_date)
);
CREATE INDEX IF NOT EXISTS idx_semesters_academic_year ON semesters(academic_year_id);

-- ---------- calendar_days (new table replacing day_order_calendar) ----------
CREATE TABLE IF NOT EXISTS calendar_days (
    id                      SERIAL PRIMARY KEY,
    date                    DATE NOT NULL UNIQUE,
    day_type                day_type NOT NULL DEFAULT 'working',
    day_order               INTEGER CHECK (day_order BETWEEN 1 AND 6),
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
CREATE INDEX IF NOT EXISTS idx_calendar_days_date      ON calendar_days(date);
CREATE INDEX IF NOT EXISTS idx_calendar_days_day_type  ON calendar_days(day_type);
CREATE INDEX IF NOT EXISTS idx_calendar_days_day_order ON calendar_days(day_order);

CREATE OR REPLACE FUNCTION fn_calendar_days_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calendar_days_touch_updated_at ON calendar_days;
CREATE TRIGGER trg_calendar_days_touch_updated_at
    BEFORE UPDATE ON calendar_days
    FOR EACH ROW
    EXECUTE FUNCTION fn_calendar_days_touch_updated_at();

-- ---------- Backfill: migrate day_order_calendar rows into calendar_days ----------
-- Every existing day_order_calendar row was, by definition, a working day
-- under the old model (it never had a concept of holidays), so it
-- migrates straight across as day_type='working'.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'day_order_calendar') THEN
        INSERT INTO calendar_days (date, day_type, day_order, is_manual_override, created_at)
        SELECT date, 'working', day_order, true, created_at
        FROM day_order_calendar
        ON CONFLICT (date) DO NOTHING;
    END IF;
END $$;

-- ---------- Tighten period_number: 1-8 -> 1-5 ----------
-- Per the updated spec ("Five periods per day"). Existing rows with
-- period_number > 5 are NOT deleted automatically (that would silently
-- destroy historical data) — the constraint is added with NOT VALID so
-- existing out-of-range rows don't block the migration, but every new
-- INSERT/UPDATE is enforced going forward. Run the SELECT below after
-- migrating to find any rows that need manual review:
--   SELECT * FROM timetable_slots WHERE period_number > 5;
--   SELECT * FROM leave_requests  WHERE period_number > 5;
ALTER TABLE timetable_slots DROP CONSTRAINT IF EXISTS timetable_slots_period_number_check;
ALTER TABLE timetable_slots ADD CONSTRAINT chk_timetable_period_number
    CHECK (period_number BETWEEN 1 AND 5) NOT VALID;

ALTER TABLE leave_requests DROP CONSTRAINT IF EXISTS leave_requests_period_number_check;
ALTER TABLE leave_requests ADD CONSTRAINT chk_leave_period_number
    CHECK (period_number BETWEEN 1 AND 5) NOT VALID;

-- ---------- system_settings: new keys ----------
INSERT INTO system_settings (key, value) VALUES
    ('periods_per_day', '5'),
    ('day_order_max', '6')
ON CONFLICT (key) DO NOTHING;

COMMIT;

-- ---------- Manual follow-up (not run automatically) ----------
-- 1. Review any timetable_slots / leave_requests rows with period_number
--    > 5 (query above) and either reassign them to a valid period or
--    archive them, then validate the constraints for real:
--      ALTER TABLE timetable_slots VALIDATE CONSTRAINT chk_timetable_period_number;
--      ALTER TABLE leave_requests  VALIDATE CONSTRAINT chk_leave_period_number;
-- 2. Once calendar_days backfill is confirmed correct, the old
--    day_order_calendar table can be dropped:
--      DROP TABLE IF EXISTS day_order_calendar;
--    (left in place here deliberately so this migration is non-destructive
--    and re-runnable; drop it manually once you've verified the backfill.)
-- 3. Use the Admin Panel's new Academic Calendar screens to create at
--    least one Academic Year and mark known holidays/exam days going
--    forward — calendar_days has no rows beyond the day_order_calendar
--    backfill until an admin starts using the new screens.
