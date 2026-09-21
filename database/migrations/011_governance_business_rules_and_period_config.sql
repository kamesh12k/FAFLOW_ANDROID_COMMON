-- ============================================================
-- Migration 011: Centralized Governance Business Rules & Period Configurations
--
-- Creates:
--   1. business_rules: Central registry for operational thresholds,
--      timings, limits, and scoring values.
--   2. period_configs: Dynamic institutional period schedule.
--   3. business_rule_history: Immutable audit history and rollback logs.
-- ============================================================

BEGIN;

-- 1. Period Configuration Table
CREATE TABLE IF NOT EXISTS period_configs (
    period_number   INTEGER PRIMARY KEY,
    name            VARCHAR(50) NOT NULL,
    start_time      VARCHAR(8) NOT NULL,  -- e.g. "09:20"
    end_time        VARCHAR(8) NOT NULL,  -- e.g. "10:20"
    is_break        BOOLEAN NOT NULL DEFAULT false,
    is_enabled      BOOLEAN NOT NULL DEFAULT true,
    sort_order      INTEGER NOT NULL,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed existing standard institutional period schedule
INSERT INTO period_configs (period_number, name, start_time, end_time, is_break, is_enabled, sort_order)
VALUES
    (1, 'Period 1', '09:20', '10:20', false, true, 1),
    (2, 'Period 2', '10:20', '11:15', false, true, 2),
    (3, 'Period 3', '11:40', '12:35', false, true, 3),
    (4, 'Period 4', '13:35', '14:30', false, true, 4),
    (5, 'Period 5', '14:55', '15:50', false, true, 5)
ON CONFLICT (period_number) DO UPDATE SET
    name = EXCLUDED.name,
    start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    is_break = EXCLUDED.is_break,
    is_enabled = EXCLUDED.is_enabled,
    sort_order = EXCLUDED.sort_order;


-- 2. Business Rules Registry Table
CREATE TABLE IF NOT EXISTS business_rules (
    key                 VARCHAR(100) PRIMARY KEY,
    category            VARCHAR(50) NOT NULL,
    display_name        VARCHAR(150) NOT NULL,
    description         TEXT NOT NULL,
    value               TEXT NOT NULL,
    data_type           VARCHAR(30) NOT NULL, -- integer, float, boolean, string, time, json, percentage
    unit                VARCHAR(30),
    minimum             DOUBLE PRECISION,
    maximum             DOUBLE PRECISION,
    default_value       TEXT NOT NULL,
    is_enabled          BOOLEAN NOT NULL DEFAULT true,
    affected_modules    TEXT NOT NULL, -- JSON array string
    severity            VARCHAR(20) NOT NULL DEFAULT 'normal', -- low, normal, high, critical
    security_critical   BOOLEAN NOT NULL DEFAULT false,
    requires_restart    BOOLEAN NOT NULL DEFAULT false,
    version             INTEGER NOT NULL DEFAULT 1,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by_id       INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_business_rules_category ON business_rules(category);


-- 3. Business Rule Audit History Table
CREATE TABLE IF NOT EXISTS business_rule_history (
    id                  SERIAL PRIMARY KEY,
    rule_key            VARCHAR(100) NOT NULL REFERENCES business_rules(key) ON DELETE CASCADE,
    version             INTEGER NOT NULL,
    old_value           TEXT,
    new_value           TEXT NOT NULL,
    reason              TEXT NOT NULL,
    changed_by_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
    changed_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_business_rule_history_key ON business_rule_history(rule_key);
CREATE INDEX IF NOT EXISTS ix_business_rule_history_changed_at ON business_rule_history(changed_at);


-- 4. Pre-seed Default Business Rules (Preserving 100% existing FAFLOW values)
INSERT INTO business_rules (
    key, category, display_name, description, value, data_type, unit, minimum, maximum, default_value, affected_modules, severity, security_critical
) VALUES
    -- Class Suggestion Timings
    ('suggestion_lead_time_minutes', 'class_suggestion', 'Class Suggestion Lead Time', 'Advance lead time before a period begins to highlight and suggest the upcoming class.', '15', 'integer', 'minutes', 0, 60, '15', '["Dashboard", "Automatic Suggestion", "Android UI"]', 'normal', false),
    ('suggestion_start_window_minutes', 'class_suggestion', 'Active Suggestion Window', 'Window from period start during which attendance taking is actively suggested to the teacher.', '15', 'integer', 'minutes', 0, 60, '15', '["Attendance Suggestion", "Android Attendance Screen"]', 'normal', false),
    ('suggestion_expiration_window_minutes', 'class_suggestion', 'Class Suggestion Expiration', 'Time after period start when the proactive class suggestion transitions to late.', '15', 'integer', 'minutes', 5, 120, '15', '["Attendance Taking", "Session Status"]', 'normal', false),
    ('current_period_tolerance_minutes', 'class_suggestion', 'Period Transition Tolerance', 'Grace tolerance allowed during period boundary transitions.', '0', 'integer', 'minutes', 0, 15, '0', '["Schedule Intelligence", "Period Detection"]', 'low', false),

    -- Student Attendance
    ('student_attendance_submission_window_minutes', 'student_attendance', 'On-Time Submission Window', 'Window from period start to submit attendance before it is flagged as late.', '15', 'integer', 'minutes', 5, 60, '15', '["Student Attendance", "Teacher Compliance", "Attendance Sessions"]', 'high', false),
    ('student_attendance_correction_window_hours', 'student_attendance', 'Correction Window Limit', 'Hours after session creation during which teachers can submit attendance corrections.', '24', 'integer', 'hours', 1, 168, '24', '["Attendance Correction", "Session Management"]', 'high', false),
    ('intelligence_student_shortage_threshold', 'student_attendance', 'Attendance Shortage Threshold', 'Institutional minimum required attendance percentage before shortage flags are raised.', '75.0', 'percentage', '%', 50.0, 90.0, '75.0', '["Principal Dossier", "HOD Overview", "Student Profile"]', 'critical', false),

    -- Faculty Attendance & Biometrics
    ('staff_biometric_face_similarity_threshold', 'biometrics', 'Face Biometric Similarity Threshold', 'Minimum facial cosine similarity required for shift check-in and check-out verification.', '0.60', 'float', 'score (0-1)', 0.40, 0.95, '0.60', '["Faculty Check-In", "Faculty Check-Out", "Biometric Gate"]', 'critical', true),
    ('staff_geofence_gps_accuracy_threshold', 'geofencing', 'GPS Accuracy Threshold', 'Maximum allowable GPS accuracy in meters. Coordinates with higher error are rejected.', '50.0', 'float', 'meters', 10.0, 150.0, '50.0', '["Geofence Validation", "Location Verification"]', 'high', true),

    -- Leave & Substitution
    ('leave_same_day_cancellation_cutoff_hour', 'leave', 'Same-Day Leave Cancellation Cutoff', 'Local hour in 24h format after which same-day approved leave cannot be cancelled by teacher.', '10', 'integer', 'hour (24h)', 6, 18, '10', '["Leave Service", "Teacher Portal", "Cancellation Gate"]', 'normal', false),
    ('substitution_action_cutoff_hour', 'substitution', 'Substitution Action Cutoff', 'Local hour in 24h format after which modifications to substitution are locked on the date.', '17', 'integer', 'hour (24h)', 12, 23, '17', '["Substitution Engine", "Admin Assignments"]', 'normal', false),
    ('emergency_window_hours', 'substitution', 'Autonomous Emergency Window', 'Hours before slot start that an uncovered absence escalates into emergency assignment.', '2', 'integer', 'hours', 1, 12, '2', '["Autonomous Engine", "Emergency Duties"]', 'high', false),

    -- Credits
    ('credit_penalty_on_leave', 'credits', 'Credit Deduction on Approved Leave', 'Penalty credit points deducted from faculty balance per approved leave period.', '-1', 'integer', 'points', -5, 0, '-1', '["Credit Service", "Leave Approval", "Faculty Ledger"]', 'normal', false),
    ('credit_award_on_substitution', 'credits', 'Credit Award on Substitute Duty', 'Credit points awarded to substitute faculty for covering a colleague class.', '1', 'integer', 'points', 0, 5, '1', '["Credit Service", "Substitution Execution", "Faculty Ledger"]', 'normal', false),

    -- Bunking & Risk Intelligence
    ('intelligence_high_absenteeism_threshold', 'risk', 'High Absenteeism Alert Threshold', 'Session absence rate that generates a High Absenteeism alert.', '25.0', 'percentage', '%', 10.0, 50.0, '25.0', '["Academic Intelligence", "Principal Alerts", "HOD Alerts"]', 'high', false),
    ('intelligence_critical_absenteeism_threshold', 'risk', 'Critical Absenteeism Alert Threshold', 'Session absence rate that generates a Critical Absenteeism alert.', '40.0', 'percentage', '%', 20.0, 80.0, '40.0', '["Academic Intelligence", "Principal Alerts", "HOD Alerts"]', 'critical', false),
    ('intelligence_attendance_drop_threshold', 'risk', 'Consecutive Period Drop Threshold', 'Attendance percentage drop between consecutive periods triggering a bunking alert.', '15.0', 'percentage', '%', 5.0, 40.0, '15.0', '["Academic Intelligence", "Bunking Detection"]', 'high', false),
    ('intelligence_min_sample_sessions', 'risk', 'Minimum Evaluation Sample Sessions', 'Minimum sessions required before trend alerts and shortages are calculated.', '3', 'integer', 'sessions', 1, 10, '3', '["Academic Intelligence", "Trend Analysis"]', 'low', false),

    -- System Limits & General
    ('periods_per_day', 'limits', 'Periods Per Day', 'Standard number of teaching periods per institutional academic day.', '5', 'integer', 'periods', 4, 10, '5', '["Timetable", "Day Order", "Institutional Schedule"]', 'critical', false),
    ('day_order_max', 'limits', 'Maximum Day Order Cycle', 'Number of distinct Day Orders in the rotating academic calendar (e.g. Day 1 to Day 6).', '6', 'integer', 'days', 1, 10, '6', '["Academic Calendar", "Timetable"]', 'critical', false)
ON CONFLICT (key) DO NOTHING;

COMMIT;
