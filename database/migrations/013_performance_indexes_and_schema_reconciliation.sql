-- Migration 013: High-Frequency Query Path Performance Indexes & Schema Reconciliation
-- Dialect: PostgreSQL 14+
-- Safe for idempotent application on existing databases

-- =============================================================================
-- 1. Student Attendance Subsystem Performance Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_date_teacher 
    ON attendance_sessions(attendance_date, actual_teacher_id);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_sched_teacher 
    ON attendance_sessions(scheduled_teacher_id);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_cal_day 
    ON attendance_sessions(calendar_day_id);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_slot 
    ON attendance_sessions(timetable_slot_id);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_sub 
    ON attendance_sessions(substitution_id);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_status_date 
    ON attendance_sessions(status, attendance_date);

CREATE INDEX IF NOT EXISTS idx_student_attendance_session_student 
    ON student_attendance(attendance_session_id, student_id);

CREATE INDEX IF NOT EXISTS idx_student_attendance_student_status 
    ON student_attendance(student_id, status);

CREATE INDEX IF NOT EXISTS idx_students_class_active 
    ON students(class_id, is_active);

CREATE INDEX IF NOT EXISTS idx_attendance_correction_audits_session 
    ON attendance_correction_audits(attendance_session_id);

-- =============================================================================
-- 2. Campus Duties & Disciplines Performance Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_campus_duties_date_type 
    ON campus_duties(duty_date, duty_type);

CREATE INDEX IF NOT EXISTS idx_campus_duties_dept 
    ON campus_duties(department_id);

CREATE INDEX IF NOT EXISTS idx_campus_duties_break 
    ON campus_duties(break_period_id);

CREATE INDEX IF NOT EXISTS idx_campus_duties_area 
    ON campus_duties(area_id);

CREATE INDEX IF NOT EXISTS idx_campus_duties_locked_by 
    ON campus_duties(locked_by_user_id);

CREATE INDEX IF NOT EXISTS idx_duty_assignments_teacher_status 
    ON duty_assignments(teacher_id, status);

CREATE INDEX IF NOT EXISTS idx_duty_assignments_duty_teacher 
    ON duty_assignments(duty_id, teacher_id);

CREATE INDEX IF NOT EXISTS idx_duty_assignments_replaced 
    ON duty_assignments(replaced_assignment_id);

CREATE INDEX IF NOT EXISTS idx_duty_break_periods_dept 
    ON duty_break_periods(department_id);

CREATE INDEX IF NOT EXISTS idx_campus_areas_dept 
    ON campus_areas(department_id);

CREATE INDEX IF NOT EXISTS idx_campus_blocks_dept 
    ON campus_blocks(department_id);

-- =============================================================================
-- 3. Timetable & Room Structure Performance Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_timetable_slots_subject_id 
    ON timetable_slots(subject_id);

CREATE INDEX IF NOT EXISTS idx_timetable_slots_room_id 
    ON timetable_slots(room_id);

CREATE INDEX IF NOT EXISTS idx_classes_dept_id 
    ON classes(department_id);

CREATE INDEX IF NOT EXISTS idx_classes_default_room 
    ON classes(default_room_id);

CREATE INDEX IF NOT EXISTS idx_subjects_dept_id 
    ON subjects(department_id);

CREATE INDEX IF NOT EXISTS idx_rooms_block_floor 
    ON rooms(block_id, floor_id);

-- =============================================================================
-- 4. User, Auth & Multi-Tenancy Performance Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_users_dept_role_active 
    ON users(department_id, role, is_active);

CREATE INDEX IF NOT EXISTS idx_users_created_by_admin 
    ON users(created_by_admin_id);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user 
    ON push_subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_operational_staff_user 
    ON operational_staff(user_id);

CREATE INDEX IF NOT EXISTS idx_operational_staff_created_by 
    ON operational_staff(created_by_manager_id);

CREATE INDEX IF NOT EXISTS idx_timetable_submissions_teacher_status 
    ON timetable_submissions(teacher_id, status);

CREATE INDEX IF NOT EXISTS idx_timetable_submissions_reviewed_by 
    ON timetable_submissions(reviewed_by_id);

-- =============================================================================
-- 5. Governance, Policy & Audit Performance Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_policy_enforcement_audit_actor 
    ON policy_enforcement_audit(actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_academic_intelligence_events_dept_type 
    ON academic_intelligence_events(department_id, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_announcements_status_role 
    ON announcements(status, target_role, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_announcement_attachments_uploaded_by 
    ON announcement_attachments(uploaded_by_id);

CREATE INDEX IF NOT EXISTS idx_class_roll_exceptions_class_student 
    ON class_roll_exceptions(class_id, student_id);

CREATE INDEX IF NOT EXISTS idx_leave_balance_transactions_teacher 
    ON leave_balance_transactions(teacher_leave_balance_id, created_at DESC);
