-- Migration 009: Flexible Campus Operations Mode Support
-- Adds proposed_substitute_id to leave_requests to store teacher-selected
-- proposed substitutes in Flexible mode pending HOD approval.

ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS proposed_substitute_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ix_leave_requests_proposed_substitute_id ON leave_requests (proposed_substitute_id);
