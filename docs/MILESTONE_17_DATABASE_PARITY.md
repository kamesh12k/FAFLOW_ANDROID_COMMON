# Milestone 17 — Database Parity Specification

### 1. Database Schema & Migration Preservation
The canonical FAFLOW PostgreSQL database schema combines the original legacy tables with additive schema elements for biometric attendance and governance control plane.

---

### 2. Preserved Tables Matrix

| Table Name | Origin | Primary Key | Key Columns & Indexes | Preservation Status |
|---|---|---|---|---|
| `users` | Original | `id` | `email`, `username`, `role`, `department_id`, `face_embedding` | **Preserved + Biometric Additive** |
| `departments` | Original | `id` | `name`, `code` | **Preserved** |
| `classes` | Original | `id` | `name`, `section`, `department_id`, `semester` | **Preserved** |
| `subjects` | Original | `id` | `name`, `code`, `department_id` | **Preserved** |
| `rooms` | Original | `id` | `number`, `building`, `capacity` | **Preserved** |
| `timetable` | Original | `id` | `teacher_id`, `subject_id`, `class_id`, `room_id`, `day_order`, `period_number` | **Preserved** |
| `timetable_submissions`| Original | `id` | `department_id`, `status`, `submitted_by` | **Preserved** |
| `academic_calendars` | Original | `id` | `date`, `day_type`, `is_holiday`, `description` | **Preserved** |
| `day_order_calendars` | Original | `id` | `date`, `day_order`, `is_working_day` | **Preserved** |
| `leaves` | Original | `id` | `teacher_id`, `date`, `day_order`, `period_number`, `reason`, `status`, `is_emergency` | **Preserved** |
| `alter_assignments` | Original | `id` | `leave_request_id`, `substitute_teacher_id`, `assignment_type`, `compatibility_score` | **Preserved** |
| `credits` | Original | `id` | `teacher_id`, `balance` | **Preserved** |
| `credit_transactions`| Original | `id` | `teacher_id`, `change`, `reason`, `category`, `related_leave_id` | **Preserved** |
| `substitution_preferences`| Original | `id`| `teacher_id`, `max_substitutions_per_day`, `max_substitutions_per_week`, `willing_for_cross_department` | **Preserved** |
| `notifications` | Original | `id` | `user_id`, `title`, `body`, `event_type`, `is_read` | **Preserved** |
| `audit_logs` | Original | `id` | `user_id`, `action`, `entity_type`, `entity_id`, `details`, `timestamp` | **Preserved** |
| `system_settings` | Original | `id` | `key`, `value`, `description` | **Preserved** |
| `campus_geofences` | M9 Additive | `id` | `name`, `type`, `center_latitude`, `center_longitude`, `radius_meters`, `polygon_vertices`, `is_active` | **Additive & Active** |
| `staff_attendance` | M9 Additive | `id` | `staff_id`, `date`, `check_in_time`, `check_out_time`, `status`, `idempotency_key`, `geofence_id` | **Additive & Active** |
| `governance_controls` | M16 Additive | `id`| `institution_id`, `module_name`, `feature_key`, `is_enabled`, `is_locked` | **Additive & Active** |

---

### 3. Database Migration Integrity
- All original foreign keys, cascading rules, unique indexes, and nullable column constraints are strictly preserved.
- No legacy column has been dropped or renamed.
- Migrations run deterministically in PostgreSQL.
