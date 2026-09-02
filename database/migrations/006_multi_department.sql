-- Migration 006: multi-department support

-- 1. Add roles to user_role / role enum
DO $$
BEGIN
    -- Update user_role if it exists
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum WHERE enumtypid = 'user_role'::regtype AND enumlabel = 'system_admin'
        ) THEN
            ALTER TYPE user_role ADD VALUE 'system_admin';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum WHERE enumtypid = 'user_role'::regtype AND enumlabel = 'principal'
        ) THEN
            ALTER TYPE user_role ADD VALUE 'principal';
        END IF;
    END IF;

    -- Update role if it exists
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum WHERE enumtypid = 'role'::regtype AND enumlabel = 'system_admin'
        ) THEN
            ALTER TYPE role ADD VALUE 'system_admin';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum WHERE enumtypid = 'role'::regtype AND enumlabel = 'principal'
        ) THEN
            ALTER TYPE role ADD VALUE 'principal';
        END IF;
    END IF;
END;
$$;

-- 2. Add department_id to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id) ON DELETE RESTRICT;

-- 3. Backfill departments and user department_id
-- Insert missing departments from users.department
INSERT INTO departments (name)
SELECT DISTINCT department
FROM users
WHERE department IS NOT NULL AND department NOT IN (SELECT name FROM departments)
ON CONFLICT (name) DO NOTHING;

-- Map users to department_id
UPDATE users u
SET department_id = d.id
FROM departments d
WHERE u.department = d.name;

-- 4. Promote global super_admin to system_admin
UPDATE users
SET role = 'system_admin', admin_level = NULL, department = NULL, department_id = NULL
WHERE role = 'admin' AND admin_level = 'super_admin';

-- 5. Auto-create department-scoped Super Admins for backfilled departments
INSERT INTO users (name, username, password_hash, role, admin_level, department_id, must_change_credentials, is_active)
SELECT 
    d.name || ' Admin' as name,
      lower(replace(d.name, ' ', '_')) || '_admin' as username,
      '$2b$12$oypj/qdkLe3Ujas2K8KKSeJ2aoTeAuFQoiHz4cQVVpPKeuAn4hmFe' as password_hash, -- default password: admin/change-me (bcrypt)
      'admin' as role,
      'super_admin' as admin_level,
      d.id as department_id,
      true as must_change_credentials,
      true as is_active
FROM departments d
WHERE d.id NOT IN (SELECT DISTINCT department_id FROM users WHERE role = 'admin' AND department_id IS NOT NULL)
ON CONFLICT (username) DO NOTHING;

-- 6. Update unique constraints on subjects
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_code_key;
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS uq_subject_dept_code;
ALTER TABLE subjects ADD CONSTRAINT uq_subject_dept_code UNIQUE (department_id, code);

-- 7. Update unique constraints on classes
ALTER TABLE classes DROP CONSTRAINT IF EXISTS uq_class_name_section;
ALTER TABLE classes ADD CONSTRAINT uq_class_name_section UNIQUE (department_id, name, section);

-- 8. Modify system_settings to support department-specific settings
ALTER TABLE system_settings DROP CONSTRAINT IF EXISTS system_settings_pkey;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS id SERIAL PRIMARY KEY;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE;

-- Unique index for key + department_id when department_id is not null
DROP INDEX IF EXISTS uq_system_settings_key_dept;
CREATE UNIQUE INDEX uq_system_settings_key_dept ON system_settings (key, department_id) WHERE department_id IS NOT NULL;

-- Unique index for key when department_id is null (global)
DROP INDEX IF EXISTS uq_system_settings_key_global;
CREATE UNIQUE INDEX uq_system_settings_key_global ON system_settings (key) WHERE department_id IS NULL;

-- 9. Add department_id to audit_logs
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL;

-- 10. Update check constraints on users
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_user_identity;
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_admin_level;
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_user_department;

ALTER TABLE users ADD CONSTRAINT chk_user_identity CHECK (
    (role = 'teacher' AND email IS NOT NULL) OR
    (role IN ('admin', 'system_admin', 'principal') AND username IS NOT NULL)
);

ALTER TABLE users ADD CONSTRAINT chk_admin_level CHECK (
    (role = 'admin' AND admin_level IS NOT NULL) OR
    (role IN ('teacher', 'system_admin', 'principal') AND admin_level IS NULL)
);

ALTER TABLE users ADD CONSTRAINT chk_user_department CHECK (
    (role IN ('system_admin', 'principal') AND department_id IS NULL) OR
    (role IN ('admin', 'teacher') AND department_id IS NOT NULL)
);
