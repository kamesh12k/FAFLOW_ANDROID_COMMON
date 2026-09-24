-- Migration 013: Leave Policy Balance and Substitution Credit Separation
-- Creates leave_policies, teacher_leave_balances, leave_balance_transactions,
-- alters leave_status enum, and adds policy references to leave_requests.

-- 1. Extend leave_status enum with 'consumed', 'draft', 'expired'
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumtypid = 'leave_status'::regtype
          AND enumlabel = 'consumed'
    ) THEN
        ALTER TYPE leave_status ADD VALUE 'consumed';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumtypid = 'leave_status'::regtype
          AND enumlabel = 'draft'
    ) THEN
        ALTER TYPE leave_status ADD VALUE 'draft';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumtypid = 'leave_status'::regtype
          AND enumlabel = 'expired'
    ) THEN
        ALTER TYPE leave_status ADD VALUE 'expired';
    END IF;
END;
$$;

-- 2. Create leave_policies table
CREATE TABLE IF NOT EXISTS leave_policies (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    entitlement FLOAT NOT NULL,
    period VARCHAR(20) DEFAULT 'YEAR' NOT NULL,
    monthly_limit FLOAT NULL,
    semester_limit FLOAT NULL,
    annual_limit FLOAT NULL,
    approval_required BOOLEAN DEFAULT TRUE NOT NULL,
    document_required BOOLEAN DEFAULT FALSE NOT NULL,
    is_on_duty BOOLEAN DEFAULT FALSE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create teacher_leave_balances table
CREATE TABLE IF NOT EXISTS teacher_leave_balances (
    id SERIAL PRIMARY KEY,
    teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    leave_policy_id INTEGER NOT NULL REFERENCES leave_policies(id) ON DELETE RESTRICT,
    academic_year VARCHAR(20) NOT NULL,
    entitlement FLOAT NOT NULL,
    consumed FLOAT DEFAULT 0.0 NOT NULL,
    remaining FLOAT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_teacher_policy_year UNIQUE (teacher_id, leave_policy_id, academic_year)
);

CREATE INDEX IF NOT EXISTS idx_teacher_leave_balances_teacher_id ON teacher_leave_balances(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_leave_balances_policy_id ON teacher_leave_balances(leave_policy_id);

-- 4. Create leave_balance_transactions ledger
CREATE TABLE IF NOT EXISTS leave_balance_transactions (
    id SERIAL PRIMARY KEY,
    teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    leave_policy_id INTEGER NOT NULL REFERENCES leave_policies(id) ON DELETE RESTRICT,
    leave_request_id INTEGER REFERENCES leave_requests(id) ON DELETE SET NULL,
    transaction_type VARCHAR(50) NOT NULL,
    days FLOAT NOT NULL,
    balance_before FLOAT NOT NULL,
    balance_after FLOAT NOT NULL,
    reason TEXT NOT NULL,
    created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leave_balance_trans_teacher_id ON leave_balance_transactions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_leave_balance_trans_leave_id ON leave_balance_transactions(leave_request_id);

-- 5. Add columns to leave_requests
ALTER TABLE leave_requests
    ADD COLUMN IF NOT EXISTS leave_policy_id INTEGER REFERENCES leave_policies(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS document_url VARCHAR(500) NULL,
    ADD COLUMN IF NOT EXISTS ood_details JSONB NULL;

CREATE INDEX IF NOT EXISTS idx_leave_requests_policy_id ON leave_requests(leave_policy_id);

-- 6. Seed Default Institutional Leave Policies
INSERT INTO leave_policies (code, name, description, entitlement, period, monthly_limit, semester_limit, annual_limit, approval_required, document_required, is_on_duty, is_active)
VALUES
    ('AL', 'Applied Leave', 'Standard applied leave for academic faculty with monthly quota limit.', 12.0, 'YEAR', 1.0, 6.0, 12.0, TRUE, FALSE, FALSE, TRUE),
    ('IL', 'Informed Leave', 'Short-notice informed leave allocated per academic semester.', 2.0, 'SEMESTER', NULL, 2.0, 4.0, TRUE, FALSE, FALSE, TRUE),
    ('ML', 'Medical Leave', 'Medical absence leave requiring supporting physician documentation.', 5.0, 'YEAR', NULL, NULL, 5.0, TRUE, TRUE, FALSE, TRUE),
    ('WL', 'Wedding Leave', 'Special leave granted for marital occasions as per institutional guidelines.', 5.0, 'PER_EVENT', NULL, NULL, 5.0, TRUE, TRUE, FALSE, TRUE),
    ('VL', 'Vacation Leave', 'Semester break and academic vacation entitlement.', 10.0, 'YEAR', NULL, NULL, 10.0, TRUE, FALSE, FALSE, TRUE),
    ('OOD', 'Official On Duty', 'Authorized academic duty, conference attendance, workshop, or inspection.', 10.0, 'YEAR', NULL, NULL, 10.0, TRUE, TRUE, TRUE, TRUE)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    entitlement = EXCLUDED.entitlement,
    period = EXCLUDED.period,
    monthly_limit = EXCLUDED.monthly_limit,
    semester_limit = EXCLUDED.semester_limit,
    annual_limit = EXCLUDED.annual_limit,
    document_required = EXCLUDED.document_required,
    is_on_duty = EXCLUDED.is_on_duty,
    is_active = EXCLUDED.is_active;
