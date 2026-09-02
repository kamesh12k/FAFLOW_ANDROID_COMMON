import os
import sys
from sqlalchemy import create_engine, text

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.config import settings

def run():
    print(f"Connecting to database: {settings.DATABASE_URL}...")
    engine = create_engine(settings.DATABASE_URL)

    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS staff_leave_requests (
                id SERIAL PRIMARY KEY,
                staff_id INTEGER REFERENCES operational_staff(id) ON DELETE CASCADE NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                leave_type VARCHAR(50) NOT NULL DEFAULT 'casual',
                is_half_day BOOLEAN NOT NULL DEFAULT false,
                half_day_session VARCHAR(20),
                days_count NUMERIC(4, 1) NOT NULL DEFAULT 1.0,
                reason TEXT NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                approved_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                approval_remarks TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );

            CREATE INDEX IF NOT EXISTS idx_staff_leave_staff_id ON staff_leave_requests(staff_id);
            CREATE INDEX IF NOT EXISTS idx_staff_leave_status ON staff_leave_requests(status);
            CREATE INDEX IF NOT EXISTS idx_staff_leave_dates ON staff_leave_requests(start_date, end_date);

            CREATE TABLE IF NOT EXISTS staff_credits (
                id SERIAL PRIMARY KEY,
                staff_id INTEGER REFERENCES operational_staff(id) ON DELETE CASCADE NOT NULL UNIQUE,
                balance NUMERIC(6, 1) NOT NULL DEFAULT 12.0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );

            CREATE INDEX IF NOT EXISTS idx_staff_credits_staff_id ON staff_credits(staff_id);

            CREATE TABLE IF NOT EXISTS staff_credit_transactions (
                id SERIAL PRIMARY KEY,
                staff_id INTEGER REFERENCES operational_staff(id) ON DELETE CASCADE NOT NULL,
                change NUMERIC(5, 1) NOT NULL,
                balance_after NUMERIC(6, 1) NOT NULL,
                category VARCHAR(50) NOT NULL DEFAULT 'manual_adjustment',
                reason TEXT NOT NULL,
                related_leave_id INTEGER REFERENCES staff_leave_requests(id) ON DELETE SET NULL,
                created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );

            CREATE INDEX IF NOT EXISTS idx_staff_credit_tx_staff_id ON staff_credit_transactions(staff_id);
            CREATE INDEX IF NOT EXISTS idx_staff_credit_tx_created_at ON staff_credit_transactions(created_at);
        """))
        conn.commit()
    print("Migration 009 applied successfully!")

if __name__ == "__main__":
    run()
