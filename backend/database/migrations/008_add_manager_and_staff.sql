-- ── Migration 008: Add Manager Role and Operational Staff ──────────────────

-- Part 1: Extend role enum
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum
            WHERE enumtypid = 'role'::regtype
            AND enumlabel = 'manager'
        ) THEN
            ALTER TYPE role ADD VALUE 'manager';
        END IF;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum
            WHERE enumtypid = 'user_role'::regtype
            AND enumlabel = 'manager'
        ) THEN
            ALTER TYPE user_role ADD VALUE 'manager';
        END IF;
    END IF;
END $$;

-- Part 2: Update Check Constraints on users table
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_admin_level;
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_user_identity;
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_user_department_role;

ALTER TABLE users ADD CONSTRAINT chk_user_identity CHECK (
    (role = 'teacher' AND email IS NOT NULL) OR
    (role IN ('admin', 'system_admin', 'principal', 'manager') AND username IS NOT NULL)
);

ALTER TABLE users ADD CONSTRAINT chk_admin_level CHECK (
    (role = 'admin' AND admin_level IS NOT NULL) OR
    (role IN ('teacher', 'system_admin', 'principal', 'manager') AND admin_level IS NULL)
);

ALTER TABLE users ADD CONSTRAINT chk_user_department_role CHECK (
    (role IN ('system_admin', 'principal') AND department_id IS NULL)
    OR (role = 'manager')
    OR (role IN ('admin', 'teacher') AND department_id IS NOT NULL)
);

-- Part 3: Create operational_staff table
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'staffcategory') THEN
        CREATE TYPE staffcategory AS ENUM ('laboratory', 'non_teaching');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employmentstatus') THEN
        CREATE TYPE employmentstatus AS ENUM ('active', 'on_leave', 'transferred', 'inactive');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shifttype') THEN
        CREATE TYPE shifttype AS ENUM ('general', 'morning', 'evening', 'night');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS operational_staff (
    id SERIAL PRIMARY KEY,
    employee_code VARCHAR(50) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    category VARCHAR(30) NOT NULL,
    designation VARCHAR(100) NOT NULL,
    department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    assigned_room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
    phone_number VARCHAR(20),
    email VARCHAR(150),
    employment_status VARCHAR(20) NOT NULL DEFAULT 'active',
    shift_type VARCHAR(20) NOT NULL DEFAULT 'general',
    joining_date DATE DEFAULT CURRENT_DATE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_by_manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Part 4: Indexes
CREATE INDEX IF NOT EXISTS idx_operational_staff_category ON operational_staff(category);
CREATE INDEX IF NOT EXISTS idx_operational_staff_dept ON operational_staff(department_id);
CREATE INDEX IF NOT EXISTS idx_operational_staff_status ON operational_staff(employment_status);
CREATE INDEX IF NOT EXISTS idx_operational_staff_room ON operational_staff(assigned_room_id);
