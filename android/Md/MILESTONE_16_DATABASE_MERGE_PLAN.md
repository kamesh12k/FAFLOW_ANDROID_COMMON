# Milestone 16: Database Merge Plan

> Original FAFLOW PostgreSQL schema + M9–M16 additions = Unified database

---

## Authoritative Schema Source

The original FACULTY_FLOW PostgreSQL schema is the canonical source for institutional data. The M9–M16 additions are purely additive — no original tables are renamed, restructured, or merged.

---

## 1. Original Tables (Preserved Exactly)

| Table | Owner | FK Dependencies | Notes |
|-------|-------|-----------------|-------|
| `departments` | Original | None | Department registry |
| `users` | Original + Enhanced | `departments` | **ENHANCED**: +role values (system_admin, governance, lab_staff, non_teaching_staff), +admin_level enum |
| `subjects` | Original | `departments` | Unchanged |
| `classes` | Original | `departments`, `subjects` | Unchanged |
| `rooms` | Original | None | Unchanged |
| `academic_years` | Original | None | Unchanged |
| `semesters` | Original | `academic_years` | Unchanged |
| `calendar_days` | Original | None | Day-order calendar |
| `day_order_calendars` | Original | `academic_years`, `semesters` | Unchanged |
| `timetable_slots` | Original | `users`, `classes`, `subjects`, `rooms` | Unchanged |
| `leave_requests` | Original | `users` | Unchanged |
| `alter_assignments` | Original | `users`, `leave_requests`, `timetable_slots` | +combined_class AssignmentType |
| `teacher_credits` | Original | `users` | Unchanged |
| `credit_transactions` | Original | `users`, `leave_requests`, `alter_assignments` | Unchanged |
| `notifications` | Original | `users` | Unchanged |
| `push_subscriptions` | Original | `users` | Unchanged |
| `audit_logs` | Original | `users` | Operation audit (not System Admin audit) |
| `system_settings` | Original | None | Unchanged |
| `substitution_preferences` | Original | `users`, `classes`, `departments` | Unchanged |
| `timetable_submissions` | Original | `users`, `classes`, `academic_years`, `semesters` | Unchanged |
| `operational_staff` | Original | `departments` | Unchanged |
| `staff_leave_requests` | Original | `operational_staff` | Unchanged |
| `staff_credits` | Original | `operational_staff` | Unchanged |
| `staff_credit_transactions` | Original | `operational_staff` | Unchanged |

---

## 2. New Tables (M9–M16 Additive)

| Table | Milestone | FK Dependencies | Purpose |
|-------|-----------|-----------------|---------|
| `campus_geofences` | M9 | `users` (created_by, updated_by) | Circular + polygon campus geofence records |
| `staff_attendance_records` | M9 | `users` | Biometric attendance check-in/check-out |
| `institutions` | M16 | `users` (created_by) | Institution/tenant registry |
| `plan_definitions` | M16 | None | Subscription plan capability definitions |
| `feature_entitlements` | M16 | `institutions`, `users` (locked_by) | Per-institution feature flags |
| `biometric_policies` | M16 | `institutions`, `users` (updated_by) | Per-institution biometric enrollment controls |
| `system_audit_logs` | M16 | `users`, `institutions` | Immutable governance action audit trail |

---

## 3. Enum Additions

| Enum | Original Values | Added Values (M9–M16) |
|------|----------------|----------------------|
| `user_role` | admin, teacher, principal, manager | +system_admin, +governance, +lab_staff, +non_teaching_staff |
| `admin_level` | super_admin, secondary_admin | No change |
| `assignment_type` | substitution | +combined_class |
| `plan_tier` | **NEW** | free, basic, pro, enterprise, custom |
| `feature_key` | **NEW** | ATTENDANCE, GEOFENCING, FACE_DETECTION, … (14 total) |
| `feature_status` | **NEW** | ENABLED, DISABLED, LOCKED, TRIAL, EXPIRED |
| `institution_status` | **NEW** | active, suspended, trial, deactivated |
| `system_audit_action` | **NEW** | INSTITUTION_CREATED, FEATURE_ENABLED, … (18 total) |

---

## 4. Migration Order (PostgreSQL)

```sql
-- Phase 1: Enum additions (must be first, no transactions for ALTER TYPE in PG)
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'governance';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'system_admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'lab_staff';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'non_teaching_staff';
ALTER TYPE assignment_type ADD VALUE IF NOT EXISTS 'combined_class';

-- Phase 2: New independent tables
CREATE TABLE institutions (...);
CREATE TABLE plan_definitions (...);

-- Phase 3: Tables with FK to institutions
CREATE TABLE feature_entitlements (...);
CREATE TABLE biometric_policies (...);
CREATE TABLE system_audit_logs (...);

-- Phase 4: Tables with FK to users
CREATE TABLE campus_geofences (...);
CREATE TABLE staff_attendance_records (...);

-- Phase 5: Constraint additions to existing tables
ALTER TABLE users ADD CONSTRAINT chk_admin_level ...;
ALTER TABLE users ADD CONSTRAINT chk_user_department_role ...;
```

---

## 5. Conflict Resolution

| Conflict | Resolution |
|----------|------------|
| `users.role` enum values differ | ADD VALUE IF NOT EXISTS (safe, additive) |
| New tables conflict with existing table names | Not possible — all new table names are unique |
| Migrations already applied on existing DB | `CREATE TABLE IF NOT EXISTS` + `ADD VALUE IF NOT EXISTS` make migrations idempotent |
| Old tenants before M16 governance tables | Legacy compatibility: `institution_id = NULL` on old attendance records is valid |

---

## 6. Legacy Compatibility Mode

For existing FAFLOW installations upgrading to M16:

```python
# On startup, if no institutions exist, seed a default institution for legacy data
def seed_legacy_institution(db):
    count = db.query(Institution).count()
    if count == 0:
        inst = Institution(
            name="Default Institution",
            short_code="DEFAULT",
            plan=PlanTier.enterprise,  # Full access for existing customers
            status=InstitutionStatus.active,
        )
        db.add(inst)
        db.flush()
        _seed_institution_defaults(db, inst)  # Enable ALL features
        db.commit()
```

> Existing tenants automatically get **enterprise plan with all features ENABLED**. Governance can explicitly lock/restrict later. No existing functionality is removed.

---

## 7. Rollback Strategy

| Table | Rollback Method |
|-------|-----------------|
| `institutions`, `feature_entitlements`, `biometric_policies`, `system_audit_logs` | `DROP TABLE IF EXISTS` (no data in original FAFLOW) |
| `campus_geofences`, `staff_attendance_records` | `DROP TABLE IF EXISTS` (no data in original FAFLOW) |
| Enum additions | Cannot be rolled back in PostgreSQL without recreating type — **preserve enum values, remove rows using them instead** |
| `users.role` values | N/A — removing enum values requires table rebuild; instead deactivate system_admin accounts |
