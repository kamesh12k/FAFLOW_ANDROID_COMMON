import os
import sys
from sqlalchemy import create_engine, text

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.config import settings

def run():
    print(f"Connecting to database: {settings.DATABASE_URL}...")
    engine = create_engine(settings.DATABASE_URL)

    # 1. Update Enum Types
    print("Step 1: Adding 'manager', 'lab_staff', 'non_teaching_staff' to enum types...")
    with engine.connect() as conn:
        conn.execute(text("""
            DO $$ BEGIN
                IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role') THEN
                    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'role'::regtype AND enumlabel = 'manager') THEN
                        ALTER TYPE role ADD VALUE 'manager';
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'role'::regtype AND enumlabel = 'lab_staff') THEN
                        ALTER TYPE role ADD VALUE 'lab_staff';
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'role'::regtype AND enumlabel = 'non_teaching_staff') THEN
                        ALTER TYPE role ADD VALUE 'non_teaching_staff';
                    END IF;
                END IF;

                IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
                    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'user_role'::regtype AND enumlabel = 'manager') THEN
                        ALTER TYPE user_role ADD VALUE 'manager';
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'user_role'::regtype AND enumlabel = 'lab_staff') THEN
                        ALTER TYPE user_role ADD VALUE 'lab_staff';
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'user_role'::regtype AND enumlabel = 'non_teaching_staff') THEN
                        ALTER TYPE user_role ADD VALUE 'non_teaching_staff';
                    END IF;
                END IF;
            END $$;
        """))
        conn.commit()
    print("Enum types updated successfully.")

    # 2. Update Constraints & Clean up Legacy Constraints
    print("Step 2: Updating check constraints on users table...")
    with engine.connect() as conn:
        conn.execute(text("""
            ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_user_department;
            ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_admin_level;
            ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_user_identity;
            ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_user_department_role;

            ALTER TABLE users ADD CONSTRAINT chk_user_identity CHECK (
                (role = 'teacher' AND email IS NOT NULL) OR
                (role IN ('admin', 'system_admin', 'principal', 'manager', 'lab_staff', 'non_teaching_staff') AND username IS NOT NULL)
            );

            ALTER TABLE users ADD CONSTRAINT chk_admin_level CHECK (
                (role = 'admin' AND admin_level IS NOT NULL) OR
                (role IN ('teacher', 'system_admin', 'principal', 'manager', 'lab_staff', 'non_teaching_staff') AND admin_level IS NULL)
            );

            ALTER TABLE users ADD CONSTRAINT chk_user_department_role CHECK (
                (role IN ('system_admin', 'principal') AND department_id IS NULL)
                OR (role IN ('manager', 'lab_staff', 'non_teaching_staff'))
                OR (role IN ('admin', 'teacher') AND department_id IS NOT NULL)
            );
        """))
        conn.commit()
    print("Constraints updated successfully!")

if __name__ == "__main__":
    run()
