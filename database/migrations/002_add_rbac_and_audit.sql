-- ============================================================
-- Migration 002: RBAC (Super/Secondary Admin), audit logs,
-- system settings, forced first-login credential change.
--
-- Safe to run against an existing v1 database. Idempotent where
-- practical (guards re-running). Run with:
--   psql -d credits_db -f database/migrations/002_add_rbac_and_audit.sql
-- ============================================================

BEGIN;

-- ---------- New enum: admin_level ----------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_level') THEN
        CREATE TYPE admin_level AS ENUM ('super_admin', 'secondary_admin');
    END IF;
END $$;

-- ---------- users: new columns ----------
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(50);
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_username_key'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username);
    END IF;
END $$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_level admin_level;
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_credentials BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_admin_level ON users(admin_level);

-- Backfill: any existing 'admin' role row without an admin_level becomes
-- a Super Admin (this codebase only ever seeded one: admin@college.edu).
UPDATE users SET admin_level = 'super_admin' WHERE role = 'admin' AND admin_level IS NULL;

-- Identity / level check constraints (drop+recreate so re-running is safe)
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_user_identity;
ALTER TABLE users ADD CONSTRAINT chk_user_identity CHECK (
    (role = 'teacher' AND email IS NOT NULL) OR
    (role = 'admin' AND username IS NOT NULL)
);

ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_admin_level;
ALTER TABLE users ADD CONSTRAINT chk_admin_level CHECK (
    (role = 'admin' AND admin_level IS NOT NULL) OR
    (role = 'teacher' AND admin_level IS NULL)
);

-- ---------- audit_logs ----------
CREATE TABLE IF NOT EXISTS audit_logs (
    id              SERIAL PRIMARY KEY,
    actor_user_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action          VARCHAR(100) NOT NULL,
    target_type     VARCHAR(50),
    target_id       INTEGER,
    details         JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- ---------- system_settings ----------
CREATE TABLE IF NOT EXISTS system_settings (
    key             VARCHAR(100) PRIMARY KEY,
    value           TEXT NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO system_settings (key, value) VALUES
    ('app_name', 'FAFLOW'),
    ('push_notifications_enabled', 'true'),
    ('max_secondary_admins', '3')
ON CONFLICT (key) DO NOTHING;

COMMIT;

-- ---------- Manual follow-up (not run automatically) ----------
-- After this migration, bootstrap the default Super Admin login by
-- starting the backend once (it auto-creates username=admin / password=admin
-- IF no super_admin row exists yet — existing admin@college.edu from seed
-- data was just promoted to super_admin above, so on a seeded dev DB this
-- step is a no-op; you'll log in with admin@college.edu as before).
