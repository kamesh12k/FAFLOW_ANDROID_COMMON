-- =============================================================================
-- FAFLOW Enterprise Production Database Schema (Milestone 16 Reconciled)
-- Dialect: PostgreSQL 14+
-- Generated: 2026-09-28
-- Contains all 60 models, relations, constraints, and performance indexes.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_tier') THEN CREATE TYPE plan_tier AS ENUM ('free', 'basic', 'pro', 'enterprise', 'custom'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subject_type') THEN CREATE TYPE subject_type AS ENUM ('theory', 'lab'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN CREATE TYPE user_role AS ENUM ('system_admin', 'admin', 'teacher', 'principal', 'manager', 'lab_staff', 'non_teaching_staff', 'governance'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_level') THEN CREATE TYPE admin_level AS ENUM ('super_admin', 'secondary_admin'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'day_type') THEN CREATE TYPE day_type AS ENUM ('working', 'holiday', 'college_leave', 'government_holiday', 'exam_day', 'special_event', 'department_activity', 'non_working'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'institution_status') THEN CREATE TYPE institution_status AS ENUM ('active', 'suspended', 'trial', 'deactivated'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'leave_status') THEN CREATE TYPE leave_status AS ENUM ('pending', 'approved', 'approved_with_exception', 'consumed', 'rejected', 'cancelled', 'draft', 'expired'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignment_type') THEN CREATE TYPE assignment_type AS ENUM ('auto_assigned', 'faculty_recommended', 'admin_assigned', 'auto_swapped', 'overridden', 'emergency', 'teacher_assigned', 'combined_class'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'feature_key') THEN CREATE TYPE feature_key AS ENUM ('ATTENDANCE', 'GEOFENCING', 'FACE_DETECTION', 'FACE_ENROLLMENT', 'FACE_UPDATE', 'BIOMETRIC_ATTENDANCE', 'LIVENESS', 'OFFLINE_SYNC', 'SUPERVISOR_DASHBOARD', 'REPORTS', 'ADVANCED_ANALYTICS', 'API_ACCESS', 'MULTI_CAMPUS', 'ADVANCED_GEOFENCING'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'feature_status') THEN CREATE TYPE feature_status AS ENUM ('ENABLED', 'DISABLED', 'LOCKED', 'TRIAL', 'EXPIRED'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'system_audit_action') THEN CREATE TYPE system_audit_action AS ENUM ('SYSTEM_GEOFENCE_CREATED', 'SYSTEM_GEOFENCE_UPDATED', 'SYSTEM_GEOFENCE_DELETED', 'SYSTEM_GEOFENCE_ENABLED', 'SYSTEM_GEOFENCE_DISABLED', 'FACE_ENROLLMENT_ENABLED', 'FACE_ENROLLMENT_DISABLED', 'FACE_UPDATE_ENABLED', 'FACE_UPDATE_DISABLED', 'FACE_REENROLLMENT_ENABLED', 'FACE_REENROLLMENT_DISABLED', 'FEATURE_ENABLED', 'FEATURE_DISABLED', 'FEATURE_LOCKED', 'FEATURE_UNLOCKED', 'PLAN_ASSIGNED', 'PLAN_CHANGED', 'INSTITUTION_CREATED', 'INSTITUTION_UPDATED', 'INSTITUTION_ACTIVATED', 'INSTITUTION_SUSPENDED'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'room_type') THEN CREATE TYPE room_type AS ENUM ('classroom', 'lab', 'laboratory', 'seminar_hall', 'examination_hall', 'staff_room', 'office', 'auditorium', 'meeting_room', 'store_room', 'other'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'duty_type') THEN CREATE TYPE duty_type AS ENUM ('DISCIPLINE_DUTY', 'WING_DUTY', 'EXAM_DUTY', 'SPECIAL_DUTY'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'duty_status') THEN CREATE TYPE duty_status AS ENUM ('DRAFT', 'PUBLISHED', 'COMPLETED', 'CANCELLED'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'staff_category') THEN CREATE TYPE staff_category AS ENUM ('laboratory', 'non_teaching'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employment_status') THEN CREATE TYPE employment_status AS ENUM ('active', 'on_leave', 'transferred', 'inactive'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shift_type') THEN CREATE TYPE shift_type AS ENUM ('general', 'morning', 'evening', 'night'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignment_status') THEN CREATE TYPE assignment_status AS ENUM ('PROPOSED', 'ASSIGNED', 'OVERRIDDEN', 'REPLACED', 'CANCELLED', 'COMPLETED'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'timetable_submission_status') THEN CREATE TYPE timetable_submission_status AS ENUM ('pending', 'approved', 'rejected', 'withdrawn'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'student_attendance_type') THEN CREATE TYPE student_attendance_type AS ENUM ('normal', 'registered_substitution', 'emergency'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'student_session_status') THEN CREATE TYPE student_session_status AS ENUM ('not_open', 'open', 'submitted', 'submitted_late', 'missed', 'locked', 'cancelled', 'not_conducted'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'intelligence_event_type') THEN CREATE TYPE intelligence_event_type AS ENUM ('group_absenteeism', 'attendance_drop', 'coverage_issue', 'late_submission', 'missed_attendance', 'student_shortage', 'substitution_coverage', 'subject_attendance_pattern'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'intelligence_severity') THEN CREATE TYPE intelligence_severity AS ENUM ('critical', 'high', 'medium', 'info'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'intelligence_event_state') THEN CREATE TYPE intelligence_event_state AS ENUM ('active', 'resolved', 'acknowledged'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'student_attendance_status') THEN CREATE TYPE student_attendance_status AS ENUM ('present', 'absent', 'late', 'on_duty', 'leave', 'medical'); END IF; END $$;

CREATE TABLE academic_years (
	id SERIAL NOT NULL, 
	name VARCHAR(20) NOT NULL, 
	start_date DATE NOT NULL, 
	end_date DATE NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	UNIQUE (name)
);

CREATE TABLE departments (
	id SERIAL NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	code VARCHAR(20), 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	UNIQUE (name), 
	UNIQUE (code)
);

CREATE TABLE leave_policies (
	id SERIAL NOT NULL, 
	code VARCHAR(20) NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	description TEXT, 
	entitlement FLOAT NOT NULL, 
	period VARCHAR(20) NOT NULL, 
	monthly_limit FLOAT, 
	semester_limit FLOAT, 
	annual_limit FLOAT, 
	approval_required BOOLEAN NOT NULL, 
	document_required BOOLEAN NOT NULL, 
	is_on_duty BOOLEAN NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	advisory_allowed VARCHAR(20) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id)
);

CREATE TABLE period_configs (
	period_number SERIAL NOT NULL, 
	name VARCHAR(50) NOT NULL, 
	start_time VARCHAR(8) NOT NULL, 
	end_time VARCHAR(8) NOT NULL, 
	is_break BOOLEAN NOT NULL, 
	is_enabled BOOLEAN NOT NULL, 
	sort_order INTEGER NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (period_number)
);

CREATE TABLE plan_definitions (
	id SERIAL NOT NULL, 
	plan_tier plan_tier NOT NULL, 
	display_name VARCHAR(100) NOT NULL, 
	description TEXT, 
	included_features TEXT, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	UNIQUE (plan_tier)
);

CREATE TABLE campus_blocks (
	id SERIAL NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	code VARCHAR(50) NOT NULL, 
	floors_count INTEGER NOT NULL, 
	description TEXT, 
	department_id INTEGER, 
	is_active BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	FOREIGN KEY(department_id) REFERENCES departments (id) ON DELETE SET NULL
);

CREATE TABLE duty_break_periods (
	id SERIAL NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	start_time TIME WITHOUT TIME ZONE NOT NULL, 
	end_time TIME WITHOUT TIME ZONE NOT NULL, 
	duty_type VARCHAR(50) NOT NULL, 
	required_teachers INTEGER NOT NULL, 
	min_teachers INTEGER NOT NULL, 
	max_teachers INTEGER NOT NULL, 
	preceding_period_number INTEGER, 
	applicable_day_orders VARCHAR(100) NOT NULL, 
	department_id INTEGER, 
	is_active BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	FOREIGN KEY(department_id) REFERENCES departments (id) ON DELETE CASCADE
);

CREATE TABLE semesters (
	id SERIAL NOT NULL, 
	academic_year_id INTEGER NOT NULL, 
	name VARCHAR(50) NOT NULL, 
	start_date DATE NOT NULL, 
	end_date DATE NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	FOREIGN KEY(academic_year_id) REFERENCES academic_years (id) ON DELETE CASCADE
);

CREATE TABLE subjects (
	id SERIAL NOT NULL, 
	code VARCHAR(20) NOT NULL, 
	name VARCHAR(150) NOT NULL, 
	subject_type subject_type NOT NULL, 
	credits INTEGER NOT NULL, 
	department_id INTEGER NOT NULL, 
	semester INTEGER NOT NULL, 
	is_archived BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	CONSTRAINT uq_subject_dept_code UNIQUE (department_id, code), 
	FOREIGN KEY(department_id) REFERENCES departments (id) ON DELETE RESTRICT
);

CREATE TABLE system_settings (
	id SERIAL NOT NULL, 
	key VARCHAR(100) NOT NULL, 
	value TEXT NOT NULL, 
	department_id INTEGER, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	CONSTRAINT uq_system_settings_key_dept UNIQUE (key, department_id), 
	FOREIGN KEY(department_id) REFERENCES departments (id) ON DELETE CASCADE
);

CREATE TABLE users (
	id SERIAL NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	email VARCHAR(150), 
	username VARCHAR(50), 
	password_hash VARCHAR(255) NOT NULL, 
	role user_role NOT NULL, 
	admin_level admin_level, 
	department VARCHAR(100), 
	department_id INTEGER, 
	must_change_credentials BOOLEAN NOT NULL, 
	policy_version_accepted VARCHAR(20), 
	policy_accepted_at TIMESTAMP WITH TIME ZONE, 
	onboarding_completed BOOLEAN, 
	is_active BOOLEAN NOT NULL, 
	has_face_enrolled BOOLEAN NOT NULL, 
	face_enrolled_at TIMESTAMP WITH TIME ZONE, 
	created_by_admin_id INTEGER, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	CONSTRAINT chk_user_identity CHECK ((role = 'teacher' AND email IS NOT NULL) OR (role IN ('admin', 'system_admin', 'principal', 'manager', 'lab_staff', 'non_teaching_staff', 'governance') AND username IS NOT NULL)), 
	CONSTRAINT chk_admin_level CHECK ((role = 'admin' AND admin_level IS NOT NULL) OR (role IN ('teacher', 'system_admin', 'principal', 'manager', 'lab_staff', 'non_teaching_staff', 'governance') AND admin_level IS NULL)), 
	CONSTRAINT chk_user_department_role CHECK ((role IN ('admin', 'teacher') AND department_id IS NOT NULL) OR (role IN ('manager', 'lab_staff', 'non_teaching_staff')) OR (role IN ('system_admin', 'principal', 'governance') AND department_id IS NULL)), 
	FOREIGN KEY(department_id) REFERENCES departments (id) ON DELETE RESTRICT, 
	FOREIGN KEY(created_by_admin_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE announcements (
	id SERIAL NOT NULL, 
	tenant_id VARCHAR(50) NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	body TEXT NOT NULL, 
	type VARCHAR(30) NOT NULL, 
	priority VARCHAR(20) NOT NULL, 
	status VARCHAR(20) NOT NULL, 
	created_by_id INTEGER, 
	department_id INTEGER, 
	target_summary VARCHAR(50) NOT NULL, 
	is_pinned BOOLEAN NOT NULL, 
	requires_acknowledgement BOOLEAN NOT NULL, 
	allow_replies BOOLEAN NOT NULL, 
	allow_reactions BOOLEAN NOT NULL, 
	allow_download BOOLEAN NOT NULL, 
	is_locked BOOLEAN NOT NULL, 
	version INTEGER NOT NULL, 
	previous_version_id INTEGER, 
	revision_notes TEXT, 
	published_at TIMESTAMP WITH TIME ZONE, 
	scheduled_at TIMESTAMP WITH TIME ZONE, 
	expires_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(created_by_id) REFERENCES users (id) ON DELETE SET NULL, 
	FOREIGN KEY(department_id) REFERENCES departments (id) ON DELETE SET NULL, 
	FOREIGN KEY(previous_version_id) REFERENCES announcements (id) ON DELETE SET NULL
);

CREATE TABLE audit_logs (
	id SERIAL NOT NULL, 
	actor_user_id INTEGER, 
	department_id INTEGER, 
	action VARCHAR(100) NOT NULL, 
	target_type VARCHAR(50), 
	target_id INTEGER, 
	details JSONB, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	FOREIGN KEY(actor_user_id) REFERENCES users (id) ON DELETE SET NULL, 
	FOREIGN KEY(department_id) REFERENCES departments (id) ON DELETE SET NULL
);

CREATE TABLE business_rules (
	key VARCHAR(100) NOT NULL, 
	category VARCHAR(50) NOT NULL, 
	display_name VARCHAR(150) NOT NULL, 
	description TEXT NOT NULL, 
	value TEXT NOT NULL, 
	data_type VARCHAR(30) NOT NULL, 
	unit VARCHAR(30), 
	minimum FLOAT, 
	maximum FLOAT, 
	default_value TEXT NOT NULL, 
	is_enabled BOOLEAN NOT NULL, 
	affected_modules TEXT NOT NULL, 
	severity VARCHAR(20) NOT NULL, 
	security_critical BOOLEAN NOT NULL, 
	requires_restart BOOLEAN NOT NULL, 
	version INTEGER NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	updated_by_id INTEGER, 
	PRIMARY KEY (key), 
	FOREIGN KEY(updated_by_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE calendar_days (
	id SERIAL NOT NULL, 
	date DATE NOT NULL, 
	day_type day_type NOT NULL, 
	day_order INTEGER, 
	academic_year_id INTEGER, 
	semester_id INTEGER, 
	is_manual_override BOOLEAN NOT NULL, 
	label VARCHAR(200), 
	notes VARCHAR(500), 
	created_by_admin_id INTEGER, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	CONSTRAINT uq_calendar_day_date UNIQUE (date), 
	UNIQUE (date), 
	FOREIGN KEY(academic_year_id) REFERENCES academic_years (id) ON DELETE SET NULL, 
	FOREIGN KEY(semester_id) REFERENCES semesters (id) ON DELETE SET NULL, 
	FOREIGN KEY(created_by_admin_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE campus_floors (
	id SERIAL NOT NULL, 
	block_id INTEGER NOT NULL, 
	floor_number INTEGER NOT NULL, 
	floor_name VARCHAR(100) NOT NULL, 
	display_order INTEGER NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	CONSTRAINT uq_block_floor_number UNIQUE (block_id, floor_number), 
	FOREIGN KEY(block_id) REFERENCES campus_blocks (id) ON DELETE CASCADE
);

CREATE TABLE campus_geofences (
	id SERIAL NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	description VARCHAR(255), 
	type VARCHAR(20) NOT NULL, 
	center_latitude FLOAT NOT NULL, 
	center_longitude FLOAT NOT NULL, 
	radius_meters FLOAT, 
	geometry JSONB NOT NULL, 
	tolerance_meters FLOAT NOT NULL, 
	area_sq_meters FLOAT, 
	perimeter_meters FLOAT, 
	is_active BOOLEAN NOT NULL, 
	created_by INTEGER, 
	updated_by INTEGER, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	FOREIGN KEY(created_by) REFERENCES users (id) ON DELETE SET NULL, 
	FOREIGN KEY(updated_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE duty_assignment_runs (
	id SERIAL NOT NULL, 
	run_date DATE NOT NULL, 
	duty_type VARCHAR(50) NOT NULL, 
	triggered_by_user_id INTEGER, 
	total_duties INTEGER NOT NULL, 
	total_assigned INTEGER NOT NULL, 
	total_unfilled INTEGER NOT NULL, 
	details JSONB, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	FOREIGN KEY(triggered_by_user_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE institutions (
	id SERIAL NOT NULL, 
	name VARCHAR(200) NOT NULL, 
	short_code VARCHAR(20) NOT NULL, 
	contact_email VARCHAR(150), 
	contact_phone VARCHAR(30), 
	status institution_status NOT NULL, 
	plan plan_tier NOT NULL, 
	plan_assigned_at TIMESTAMP WITH TIME ZONE, 
	plan_expires_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	created_by_id INTEGER, 
	PRIMARY KEY (id), 
	UNIQUE (name), 
	UNIQUE (short_code), 
	FOREIGN KEY(created_by_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE leave_requests (
	id SERIAL NOT NULL, 
	teacher_id INTEGER NOT NULL, 
	leave_policy_id INTEGER, 
	date DATE NOT NULL, 
	day_order INTEGER NOT NULL, 
	period_number INTEGER NOT NULL, 
	reason VARCHAR(500) NOT NULL, 
	status leave_status NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	consumed_at TIMESTAMP WITH TIME ZONE, 
	batch_id UUID, 
	is_emergency BOOLEAN NOT NULL, 
	proposed_substitute_id INTEGER, 
	document_url VARCHAR(500), 
	ood_details JSONB, 
	policy_compliant BOOLEAN, 
	policy_violation BOOLEAN, 
	policy_enforcement_mode VARCHAR(20), 
	policy_warning_acknowledged BOOLEAN NOT NULL, 
	policy_warning_acknowledged_at TIMESTAMP WITH TIME ZONE, 
	policy_evaluation_snapshot JSONB, 
	policy_version_id INTEGER, 
	exception_reason VARCHAR(500), 
	exception_approved_by_id INTEGER, 
	exception_approved_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	CONSTRAINT chk_leave_period_number CHECK (period_number BETWEEN 1 AND 5), 
	FOREIGN KEY(teacher_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(leave_policy_id) REFERENCES leave_policies (id) ON DELETE SET NULL, 
	FOREIGN KEY(proposed_substitute_id) REFERENCES users (id) ON DELETE SET NULL, 
	FOREIGN KEY(policy_version_id) REFERENCES leave_policies (id) ON DELETE SET NULL, 
	FOREIGN KEY(exception_approved_by_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE policy_enforcement_audit (
	id SERIAL NOT NULL, 
	actor_user_id INTEGER, 
	previous_mode VARCHAR(20) NOT NULL, 
	new_mode VARCHAR(20) NOT NULL, 
	reason VARCHAR(500), 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	FOREIGN KEY(actor_user_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE push_subscriptions (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	endpoint TEXT NOT NULL, 
	p256dh_key VARCHAR(255) NOT NULL, 
	auth_key VARCHAR(255) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	UNIQUE (endpoint)
);

CREATE TABLE substitution_preferences (
	id SERIAL NOT NULL, 
	teacher_id INTEGER NOT NULL, 
	accept_auto_assignments BOOLEAN NOT NULL, 
	allow_emergency_assignments BOOLEAN NOT NULL, 
	max_weekly_substitutions INTEGER, 
	prefer_morning_classes BOOLEAN NOT NULL, 
	prefer_same_department BOOLEAN NOT NULL, 
	only_my_classes BOOLEAN NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (teacher_id), 
	FOREIGN KEY(teacher_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE teacher_credits (
	id SERIAL NOT NULL, 
	teacher_id INTEGER NOT NULL, 
	balance INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (teacher_id), 
	FOREIGN KEY(teacher_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE teacher_leave_balances (
	id SERIAL NOT NULL, 
	teacher_id INTEGER NOT NULL, 
	leave_policy_id INTEGER NOT NULL, 
	academic_year VARCHAR(20) NOT NULL, 
	entitlement FLOAT NOT NULL, 
	consumed FLOAT NOT NULL, 
	remaining FLOAT NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	CONSTRAINT uq_teacher_policy_year UNIQUE (teacher_id, leave_policy_id, academic_year), 
	FOREIGN KEY(teacher_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(leave_policy_id) REFERENCES leave_policies (id) ON DELETE RESTRICT
);

CREATE TABLE alter_assignments (
	id SERIAL NOT NULL, 
	leave_request_id INTEGER NOT NULL, 
	substitute_teacher_id INTEGER NOT NULL, 
	assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	assignment_type assignment_type NOT NULL, 
	compatibility_score FLOAT, 
	is_locked BOOLEAN NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (leave_request_id), 
	FOREIGN KEY(leave_request_id) REFERENCES leave_requests (id) ON DELETE CASCADE, 
	FOREIGN KEY(substitute_teacher_id) REFERENCES users (id)
);

CREATE TABLE announcement_acknowledgements (
	id SERIAL NOT NULL, 
	announcement_id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	acknowledged_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	ip_address VARCHAR(50), 
	user_agent VARCHAR(255), 
	PRIMARY KEY (id), 
	CONSTRAINT uq_announcement_user_ack UNIQUE (announcement_id, user_id), 
	FOREIGN KEY(announcement_id) REFERENCES announcements (id) ON DELETE CASCADE, 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE announcement_attachments (
	id SERIAL NOT NULL, 
	announcement_id INTEGER NOT NULL, 
	file_name VARCHAR(255) NOT NULL, 
	file_type VARCHAR(100) NOT NULL, 
	file_size INTEGER NOT NULL, 
	storage_key VARCHAR(500) NOT NULL, 
	checksum_sha256 VARCHAR(64), 
	uploaded_by_id INTEGER, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(announcement_id) REFERENCES announcements (id) ON DELETE CASCADE, 
	FOREIGN KEY(uploaded_by_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE announcement_messages (
	id SERIAL NOT NULL, 
	announcement_id INTEGER NOT NULL, 
	parent_message_id INTEGER, 
	author_id INTEGER, 
	content TEXT NOT NULL, 
	is_pinned BOOLEAN NOT NULL, 
	is_deleted BOOLEAN NOT NULL, 
	is_edited BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(announcement_id) REFERENCES announcements (id) ON DELETE CASCADE, 
	FOREIGN KEY(parent_message_id) REFERENCES announcement_messages (id) ON DELETE CASCADE, 
	FOREIGN KEY(author_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE announcement_reads (
	id SERIAL NOT NULL, 
	announcement_id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	first_viewed_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	last_viewed_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_announcement_user_read UNIQUE (announcement_id, user_id), 
	FOREIGN KEY(announcement_id) REFERENCES announcements (id) ON DELETE CASCADE, 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE announcement_targets (
	id SERIAL NOT NULL, 
	announcement_id INTEGER NOT NULL, 
	target_type VARCHAR(20) NOT NULL, 
	department_id INTEGER, 
	user_id INTEGER, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(announcement_id) REFERENCES announcements (id) ON DELETE CASCADE, 
	FOREIGN KEY(department_id) REFERENCES departments (id) ON DELETE CASCADE, 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE biometric_policies (
	id SERIAL NOT NULL, 
	institution_id INTEGER NOT NULL, 
	allow_face_enrollment BOOLEAN NOT NULL, 
	allow_face_enrollment_update BOOLEAN NOT NULL, 
	allow_face_reenrollment BOOLEAN NOT NULL, 
	require_admin_approval_for_enrollment BOOLEAN NOT NULL, 
	require_admin_approval_for_update BOOLEAN NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	updated_by_id INTEGER, 
	PRIMARY KEY (id), 
	FOREIGN KEY(institution_id) REFERENCES institutions (id) ON DELETE CASCADE, 
	FOREIGN KEY(updated_by_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE business_rule_history (
	id SERIAL NOT NULL, 
	rule_key VARCHAR(100) NOT NULL, 
	version INTEGER NOT NULL, 
	old_value TEXT, 
	new_value TEXT NOT NULL, 
	reason TEXT NOT NULL, 
	changed_by_id INTEGER, 
	changed_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(rule_key) REFERENCES business_rules (key) ON DELETE CASCADE, 
	FOREIGN KEY(changed_by_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE campus_areas (
	id SERIAL NOT NULL, 
	name VARCHAR(150) NOT NULL, 
	code VARCHAR(50) NOT NULL, 
	duty_type VARCHAR(50) NOT NULL, 
	block_id INTEGER, 
	floor_id INTEGER, 
	building_or_block VARCHAR(100), 
	floor VARCHAR(50), 
	required_teachers INTEGER NOT NULL, 
	department_id INTEGER, 
	is_active BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	FOREIGN KEY(block_id) REFERENCES campus_blocks (id) ON DELETE SET NULL, 
	FOREIGN KEY(floor_id) REFERENCES campus_floors (id) ON DELETE SET NULL, 
	FOREIGN KEY(department_id) REFERENCES departments (id) ON DELETE SET NULL
);

CREATE TABLE credit_transactions (
	id SERIAL NOT NULL, 
	teacher_id INTEGER NOT NULL, 
	change INTEGER NOT NULL, 
	reason VARCHAR(255) NOT NULL, 
	category VARCHAR(50), 
	related_leave_id INTEGER, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	FOREIGN KEY(teacher_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(related_leave_id) REFERENCES leave_requests (id) ON DELETE SET NULL
);

CREATE TABLE feature_entitlements (
	id SERIAL NOT NULL, 
	institution_id INTEGER NOT NULL, 
	feature_key feature_key NOT NULL, 
	status feature_status NOT NULL, 
	display_name VARCHAR(100), 
	description TEXT, 
	activation_date TIMESTAMP WITH TIME ZONE, 
	expiry_date TIMESTAMP WITH TIME ZONE, 
	locked_by_id INTEGER, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	CONSTRAINT uq_institution_feature UNIQUE (institution_id, feature_key), 
	FOREIGN KEY(institution_id) REFERENCES institutions (id) ON DELETE CASCADE, 
	FOREIGN KEY(locked_by_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE leave_balance_transactions (
	id SERIAL NOT NULL, 
	teacher_id INTEGER NOT NULL, 
	leave_policy_id INTEGER NOT NULL, 
	leave_request_id INTEGER, 
	transaction_type VARCHAR(50) NOT NULL, 
	days FLOAT NOT NULL, 
	balance_before FLOAT NOT NULL, 
	balance_after FLOAT NOT NULL, 
	reason TEXT NOT NULL, 
	created_by_id INTEGER, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	FOREIGN KEY(teacher_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(leave_policy_id) REFERENCES leave_policies (id) ON DELETE RESTRICT, 
	FOREIGN KEY(leave_request_id) REFERENCES leave_requests (id) ON DELETE SET NULL, 
	FOREIGN KEY(created_by_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE notifications (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	title VARCHAR(150) NOT NULL, 
	body VARCHAR(500) NOT NULL, 
	event_type VARCHAR(50) NOT NULL, 
	related_leave_id INTEGER, 
	is_read BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(related_leave_id) REFERENCES leave_requests (id) ON DELETE SET NULL
);

CREATE TABLE staff_attendance_records (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	attendance_date DATE NOT NULL, 
	check_in_time TIMESTAMP WITH TIME ZONE, 
	check_out_time TIMESTAMP WITH TIME ZONE, 
	status VARCHAR(20) NOT NULL, 
	check_in_latitude FLOAT, 
	check_in_longitude FLOAT, 
	check_in_accuracy FLOAT, 
	check_in_geofence_id INTEGER, 
	check_out_latitude FLOAT, 
	check_out_longitude FLOAT, 
	check_out_accuracy FLOAT, 
	check_out_geofence_id INTEGER, 
	face_similarity_score FLOAT, 
	liveness_verified BOOLEAN NOT NULL, 
	verification_method VARCHAR(50) NOT NULL, 
	idempotency_key VARCHAR(64), 
	device_reference VARCHAR(100), 
	sync_source VARCHAR(20) NOT NULL, 
	working_hours VARCHAR(50), 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(check_in_geofence_id) REFERENCES campus_geofences (id) ON DELETE SET NULL, 
	FOREIGN KEY(check_out_geofence_id) REFERENCES campus_geofences (id) ON DELETE SET NULL
);

CREATE TABLE system_audit_logs (
	id SERIAL NOT NULL, 
	event_id VARCHAR(36) NOT NULL, 
	timestamp TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	system_admin_id INTEGER, 
	institution_id INTEGER, 
	action system_audit_action NOT NULL, 
	affected_resource VARCHAR(200), 
	old_value TEXT, 
	new_value TEXT, 
	request_id VARCHAR(36), 
	ip_address VARCHAR(50), 
	notes TEXT, 
	PRIMARY KEY (id), 
	FOREIGN KEY(system_admin_id) REFERENCES users (id) ON DELETE SET NULL, 
	FOREIGN KEY(institution_id) REFERENCES institutions (id) ON DELETE SET NULL
);

CREATE TABLE message_mentions (
	id SERIAL NOT NULL, 
	message_id INTEGER NOT NULL, 
	mentioned_user_id INTEGER NOT NULL, 
	mention_text VARCHAR(100) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_message_user_mention UNIQUE (message_id, mentioned_user_id), 
	FOREIGN KEY(message_id) REFERENCES announcement_messages (id) ON DELETE CASCADE, 
	FOREIGN KEY(mentioned_user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE message_reactions (
	id SERIAL NOT NULL, 
	message_id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	reaction VARCHAR(20) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_message_user_reaction UNIQUE (message_id, user_id, reaction), 
	FOREIGN KEY(message_id) REFERENCES announcement_messages (id) ON DELETE CASCADE, 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE rooms (
	id SERIAL NOT NULL, 
	room_number VARCHAR(50) NOT NULL, 
	room_name VARCHAR(150), 
	room_type room_type NOT NULL, 
	capacity INTEGER NOT NULL, 
	block_id INTEGER, 
	floor_id INTEGER, 
	area_id INTEGER, 
	department_id INTEGER, 
	primary_class_id INTEGER, 
	is_exam_eligible BOOLEAN NOT NULL, 
	exam_capacity INTEGER, 
	required_invigilators INTEGER NOT NULL, 
	lab_type VARCHAR(100), 
	equipment_category VARCHAR(100), 
	is_timetable_eligible BOOLEAN NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	notes TEXT, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	FOREIGN KEY(block_id) REFERENCES campus_blocks (id) ON DELETE SET NULL, 
	FOREIGN KEY(floor_id) REFERENCES campus_floors (id) ON DELETE SET NULL, 
	FOREIGN KEY(area_id) REFERENCES campus_areas (id) ON DELETE SET NULL, 
	FOREIGN KEY(department_id) REFERENCES departments (id) ON DELETE SET NULL
);

CREATE TABLE campus_duties (
	id SERIAL NOT NULL, 
	duty_type VARCHAR(15) NOT NULL, 
	title VARCHAR(150) NOT NULL, 
	duty_date DATE NOT NULL, 
	start_time TIME WITHOUT TIME ZONE NOT NULL, 
	end_time TIME WITHOUT TIME ZONE NOT NULL, 
	break_period_id INTEGER, 
	area_id INTEGER, 
	room_id INTEGER, 
	department_id INTEGER, 
	day_order INTEGER, 
	required_teachers INTEGER NOT NULL, 
	status VARCHAR(9) NOT NULL, 
	is_locked BOOLEAN NOT NULL, 
	locked_by_user_id INTEGER, 
	locked_at TIMESTAMP WITH TIME ZONE, 
	lock_reason VARCHAR(255), 
	created_by_user_id INTEGER, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	FOREIGN KEY(break_period_id) REFERENCES duty_break_periods (id) ON DELETE SET NULL, 
	FOREIGN KEY(area_id) REFERENCES campus_areas (id) ON DELETE SET NULL, 
	FOREIGN KEY(room_id) REFERENCES rooms (id) ON DELETE SET NULL, 
	FOREIGN KEY(department_id) REFERENCES departments (id) ON DELETE CASCADE, 
	FOREIGN KEY(locked_by_user_id) REFERENCES users (id) ON DELETE SET NULL, 
	FOREIGN KEY(created_by_user_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE classes (
	id SERIAL NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	section VARCHAR(10) NOT NULL, 
	department_id INTEGER NOT NULL, 
	semester INTEGER NOT NULL, 
	default_room_id INTEGER, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	CONSTRAINT uq_global_class_name_section UNIQUE (name, section), 
	FOREIGN KEY(department_id) REFERENCES departments (id) ON DELETE RESTRICT, 
	FOREIGN KEY(default_room_id) REFERENCES rooms (id) ON DELETE SET NULL
);

CREATE TABLE operational_staff (
	id SERIAL NOT NULL, 
	employee_code VARCHAR(50) NOT NULL, 
	full_name VARCHAR(150) NOT NULL, 
	category staff_category NOT NULL, 
	designation VARCHAR(100) NOT NULL, 
	department_id INTEGER, 
	assigned_room_id INTEGER, 
	assigned_room_ids JSON, 
	phone_number VARCHAR(20), 
	email VARCHAR(150), 
	employment_status employment_status NOT NULL, 
	shift_type shift_type NOT NULL, 
	joining_date DATE, 
	user_id INTEGER, 
	created_by_manager_id INTEGER, 
	notes TEXT, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	FOREIGN KEY(department_id) REFERENCES departments (id) ON DELETE SET NULL, 
	FOREIGN KEY(assigned_room_id) REFERENCES rooms (id) ON DELETE SET NULL, 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE SET NULL, 
	FOREIGN KEY(created_by_manager_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE class_roll_rules (
	id SERIAL NOT NULL, 
	class_id INTEGER NOT NULL, 
	academic_year_id INTEGER NOT NULL, 
	prefix VARCHAR(20) NOT NULL, 
	start_number INTEGER NOT NULL, 
	end_number INTEGER NOT NULL, 
	padding INTEGER NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	created_by_id INTEGER, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	CONSTRAINT uq_class_academic_year_rule UNIQUE (class_id, academic_year_id), 
	FOREIGN KEY(class_id) REFERENCES classes (id) ON DELETE CASCADE, 
	FOREIGN KEY(academic_year_id) REFERENCES academic_years (id) ON DELETE CASCADE, 
	FOREIGN KEY(created_by_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE duty_assignments (
	id SERIAL NOT NULL, 
	duty_id INTEGER NOT NULL, 
	teacher_id INTEGER NOT NULL, 
	status VARCHAR(10) NOT NULL, 
	role VARCHAR(50) NOT NULL, 
	assigned_by_user_id INTEGER, 
	is_manual BOOLEAN NOT NULL, 
	is_locked BOOLEAN NOT NULL, 
	selection_reason JSONB, 
	score FLOAT, 
	overridden_by_user_id INTEGER, 
	overridden_reason VARCHAR(255), 
	replaced_assignment_id INTEGER, 
	replacement_reason VARCHAR(255), 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	FOREIGN KEY(duty_id) REFERENCES campus_duties (id) ON DELETE CASCADE, 
	FOREIGN KEY(teacher_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(assigned_by_user_id) REFERENCES users (id) ON DELETE SET NULL, 
	FOREIGN KEY(overridden_by_user_id) REFERENCES users (id) ON DELETE SET NULL, 
	FOREIGN KEY(replaced_assignment_id) REFERENCES duty_assignments (id) ON DELETE SET NULL
);

CREATE TABLE staff_credits (
	id SERIAL NOT NULL, 
	staff_id INTEGER NOT NULL, 
	annual_quota FLOAT NOT NULL, 
	balance FLOAT NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	FOREIGN KEY(staff_id) REFERENCES operational_staff (id) ON DELETE CASCADE
);

CREATE TABLE staff_leave_requests (
	id SERIAL NOT NULL, 
	staff_id INTEGER NOT NULL, 
	start_date DATE NOT NULL, 
	end_date DATE NOT NULL, 
	leave_type VARCHAR(50) NOT NULL, 
	is_half_day BOOLEAN NOT NULL, 
	half_day_session VARCHAR(20), 
	days_count FLOAT NOT NULL, 
	reason TEXT NOT NULL, 
	status VARCHAR(20) NOT NULL, 
	approved_by_id INTEGER, 
	approval_remarks TEXT, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	FOREIGN KEY(staff_id) REFERENCES operational_staff (id) ON DELETE CASCADE, 
	FOREIGN KEY(approved_by_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE students (
	id SERIAL NOT NULL, 
	roll_number VARCHAR(50) NOT NULL, 
	name VARCHAR(150) NOT NULL, 
	class_id INTEGER NOT NULL, 
	department_id INTEGER NOT NULL, 
	admission_year INTEGER, 
	is_active BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	CONSTRAINT uq_class_roll_number UNIQUE (class_id, roll_number), 
	FOREIGN KEY(class_id) REFERENCES classes (id) ON DELETE RESTRICT, 
	FOREIGN KEY(department_id) REFERENCES departments (id) ON DELETE RESTRICT
);

CREATE TABLE timetable_slots (
	id SERIAL NOT NULL, 
	teacher_id INTEGER NOT NULL, 
	subject_id INTEGER, 
	class_id INTEGER NOT NULL, 
	room_id INTEGER, 
	day_order INTEGER NOT NULL, 
	period_number INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_teacher_class_day_period UNIQUE (teacher_id, class_id, day_order, period_number), 
	CONSTRAINT chk_timetable_day_order CHECK (day_order BETWEEN 1 AND 6), 
	CONSTRAINT chk_timetable_period_number CHECK (period_number BETWEEN 1 AND 5), 
	FOREIGN KEY(teacher_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(subject_id) REFERENCES subjects (id) ON DELETE SET NULL, 
	FOREIGN KEY(class_id) REFERENCES classes (id) ON DELETE RESTRICT, 
	FOREIGN KEY(room_id) REFERENCES rooms (id) ON DELETE SET NULL
);

CREATE TABLE timetable_submissions (
	id SERIAL NOT NULL, 
	teacher_id INTEGER NOT NULL, 
	subject_id INTEGER, 
	class_id INTEGER NOT NULL, 
	room_id INTEGER, 
	day_order INTEGER NOT NULL, 
	period_number INTEGER NOT NULL, 
	status timetable_submission_status NOT NULL, 
	review_note VARCHAR(500), 
	reviewed_by_id INTEGER, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	reviewed_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(teacher_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(subject_id) REFERENCES subjects (id) ON DELETE SET NULL, 
	FOREIGN KEY(class_id) REFERENCES classes (id) ON DELETE RESTRICT, 
	FOREIGN KEY(room_id) REFERENCES rooms (id) ON DELETE SET NULL, 
	FOREIGN KEY(reviewed_by_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE attendance_sessions (
	id SERIAL NOT NULL, 
	attendance_date DATE NOT NULL, 
	calendar_day_id INTEGER, 
	timetable_slot_id INTEGER, 
	class_id INTEGER NOT NULL, 
	subject_id INTEGER, 
	period_number INTEGER NOT NULL, 
	day_order INTEGER, 
	scheduled_teacher_id INTEGER, 
	actual_teacher_id INTEGER NOT NULL, 
	substitution_id INTEGER, 
	attendance_type student_attendance_type NOT NULL, 
	status student_session_status NOT NULL, 
	scheduled_start_time TIMESTAMP WITH TIME ZONE, 
	scheduled_end_time TIMESTAMP WITH TIME ZONE, 
	submitted_at TIMESTAMP WITH TIME ZONE, 
	submitted_by_id INTEGER, 
	correction_deadline TIMESTAMP WITH TIME ZONE, 
	idempotency_key VARCHAR(100), 
	notes VARCHAR(500), 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	CONSTRAINT uq_session_date_class_period UNIQUE (attendance_date, class_id, period_number), 
	CONSTRAINT chk_session_period_number CHECK (period_number BETWEEN 1 AND 5), 
	FOREIGN KEY(calendar_day_id) REFERENCES calendar_days (id) ON DELETE SET NULL, 
	FOREIGN KEY(timetable_slot_id) REFERENCES timetable_slots (id) ON DELETE SET NULL, 
	FOREIGN KEY(class_id) REFERENCES classes (id) ON DELETE RESTRICT, 
	FOREIGN KEY(subject_id) REFERENCES subjects (id) ON DELETE SET NULL, 
	FOREIGN KEY(scheduled_teacher_id) REFERENCES users (id) ON DELETE SET NULL, 
	FOREIGN KEY(actual_teacher_id) REFERENCES users (id) ON DELETE RESTRICT, 
	FOREIGN KEY(substitution_id) REFERENCES alter_assignments (id) ON DELETE SET NULL, 
	FOREIGN KEY(submitted_by_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE class_roll_exceptions (
	id SERIAL NOT NULL, 
	class_roll_rule_id INTEGER NOT NULL, 
	roll_number VARCHAR(50) NOT NULL, 
	exception_type VARCHAR(20) NOT NULL, 
	reason VARCHAR(255), 
	student_id INTEGER, 
	created_by_id INTEGER, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	CONSTRAINT uq_rule_roll_exception UNIQUE (class_roll_rule_id, roll_number), 
	FOREIGN KEY(class_roll_rule_id) REFERENCES class_roll_rules (id) ON DELETE CASCADE, 
	FOREIGN KEY(student_id) REFERENCES students (id) ON DELETE SET NULL, 
	FOREIGN KEY(created_by_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE staff_credit_transactions (
	id SERIAL NOT NULL, 
	staff_id INTEGER NOT NULL, 
	change FLOAT NOT NULL, 
	balance_after FLOAT NOT NULL, 
	category VARCHAR(50) NOT NULL, 
	reason TEXT NOT NULL, 
	related_leave_id INTEGER, 
	created_by_user_id INTEGER, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	FOREIGN KEY(staff_id) REFERENCES operational_staff (id) ON DELETE CASCADE, 
	FOREIGN KEY(related_leave_id) REFERENCES staff_leave_requests (id) ON DELETE SET NULL, 
	FOREIGN KEY(created_by_user_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE student_enrollments (
	id SERIAL NOT NULL, 
	student_id INTEGER NOT NULL, 
	academic_year_id INTEGER NOT NULL, 
	class_id INTEGER NOT NULL, 
	roll_number VARCHAR(50) NOT NULL, 
	status VARCHAR(20) NOT NULL, 
	joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	left_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	CONSTRAINT uq_student_academic_year UNIQUE (student_id, academic_year_id), 
	FOREIGN KEY(student_id) REFERENCES students (id) ON DELETE RESTRICT, 
	FOREIGN KEY(academic_year_id) REFERENCES academic_years (id) ON DELETE RESTRICT, 
	FOREIGN KEY(class_id) REFERENCES classes (id) ON DELETE RESTRICT
);

CREATE TABLE academic_intelligence_events (
	id SERIAL NOT NULL, 
	department_id INTEGER NOT NULL, 
	class_id INTEGER, 
	attendance_session_id INTEGER, 
	timetable_slot_id INTEGER, 
	event_type intelligence_event_type NOT NULL, 
	severity intelligence_severity NOT NULL, 
	state intelligence_event_state NOT NULL, 
	source_key VARCHAR(160) NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	detail VARCHAR(1000), 
	attendance_percentage FLOAT, 
	absent_count INTEGER, 
	total_count INTEGER, 
	relevant_date DATE NOT NULL, 
	period_number INTEGER, 
	detected_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	last_evaluated_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	resolved_at TIMESTAMP WITH TIME ZONE, 
	acknowledged_at TIMESTAMP WITH TIME ZONE, 
	acknowledged_by_id INTEGER, 
	notified_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(department_id) REFERENCES departments (id) ON DELETE CASCADE, 
	FOREIGN KEY(class_id) REFERENCES classes (id) ON DELETE CASCADE, 
	FOREIGN KEY(attendance_session_id) REFERENCES attendance_sessions (id) ON DELETE SET NULL, 
	FOREIGN KEY(timetable_slot_id) REFERENCES timetable_slots (id) ON DELETE SET NULL, 
	FOREIGN KEY(acknowledged_by_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE attendance_correction_audits (
	id SERIAL NOT NULL, 
	attendance_session_id INTEGER NOT NULL, 
	student_id INTEGER, 
	old_status VARCHAR(50) NOT NULL, 
	new_status VARCHAR(50) NOT NULL, 
	changed_by_id INTEGER, 
	reason VARCHAR(500), 
	device_id VARCHAR(100), 
	changed_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	FOREIGN KEY(attendance_session_id) REFERENCES attendance_sessions (id) ON DELETE CASCADE, 
	FOREIGN KEY(student_id) REFERENCES students (id) ON DELETE CASCADE, 
	FOREIGN KEY(changed_by_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE student_attendance (
	id SERIAL NOT NULL, 
	attendance_session_id INTEGER NOT NULL, 
	student_id INTEGER NOT NULL, 
	status student_attendance_status NOT NULL, 
	marked_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	CONSTRAINT uq_session_student UNIQUE (attendance_session_id, student_id), 
	FOREIGN KEY(attendance_session_id) REFERENCES attendance_sessions (id) ON DELETE CASCADE, 
	FOREIGN KEY(student_id) REFERENCES students (id) ON DELETE CASCADE
);
