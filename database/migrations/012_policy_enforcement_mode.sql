-- ============================================================
-- Migration 012: Leave Policy Enforcement Mode
--
-- Adds:
--   1. 'approved_with_exception' value to leave_status enum
--   2. Policy evaluation & exception tracking columns to leave_requests
--   3. advisory_allowed column to leave_policies
--   4. policy_enforcement_audit table
--   5. Seed policy_enforcement_mode in system_settings
-- ============================================================

-- 1. Enum update (Must be committed separately in PostgreSQL if run in transactions)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
        WHERE typname = 'leave_status' AND enumlabel = 'approved_with_exception'
    ) THEN
        ALTER TYPE leave_status ADD VALUE 'approved_with_exception';
    END IF;
END
$$;

-- 2. Schema changes
ALTER TABLE leave_requests
    ADD COLUMN IF NOT EXISTS policy_compliant BOOLEAN NULL,
    ADD COLUMN IF NOT EXISTS policy_violation BOOLEAN NULL,
    ADD COLUMN IF NOT EXISTS policy_enforcement_mode VARCHAR(20) NULL,
    ADD COLUMN IF NOT EXISTS policy_warning_acknowledged BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS policy_warning_acknowledged_at TIMESTAMP WITH TIME ZONE NULL,
    ADD COLUMN IF NOT EXISTS policy_evaluation_snapshot JSONB NULL,
    ADD COLUMN IF NOT EXISTS policy_version_id INTEGER REFERENCES leave_policies(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS exception_reason VARCHAR(500) NULL,
    ADD COLUMN IF NOT EXISTS exception_approved_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS exception_approved_at TIMESTAMP WITH TIME ZONE NULL;

ALTER TABLE leave_policies
    ADD COLUMN IF NOT EXISTS advisory_allowed VARCHAR(20) NOT NULL DEFAULT 'ADVISORY';

CREATE TABLE IF NOT EXISTS policy_enforcement_audit (
    id SERIAL PRIMARY KEY,
    actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    previous_mode VARCHAR(20) NOT NULL,
    new_mode VARCHAR(20) NOT NULL,
    reason VARCHAR(500) NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed initial setting if not present
INSERT INTO system_settings (key, value, department_id, updated_at)
SELECT 'policy_enforcement_mode', 'STRICT', NULL, NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM system_settings WHERE key = 'policy_enforcement_mode' AND department_id IS NULL
);
