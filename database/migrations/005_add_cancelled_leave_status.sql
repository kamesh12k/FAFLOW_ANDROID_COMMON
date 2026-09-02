-- Migration 005: add 'cancelled' to leave_status enum
-- The Python LeaveStatus enum has a 'cancelled' value but the DB enum
-- was originally created with only ('pending', 'approved', 'rejected').
-- This value must be added before any leave cancellation is attempted.
-- PostgreSQL does not allow removing enum values, so this is safe to re-run
-- (the DO block checks for existence first).

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_enum
        WHERE enumtypid = 'leave_status'::regtype
          AND enumlabel = 'cancelled'
    ) THEN
        ALTER TYPE leave_status ADD VALUE 'cancelled';
    END IF;
END;
$$;
