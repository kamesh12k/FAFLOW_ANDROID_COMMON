# FAFLOW — Manager Role & Operational Staff Architecture Proposal

> **Document Type:** System Architecture & Implementation Specification  
> **Document Version:** 1.0.0  
> **Date:** August 15, 2026  
> **Status:** Proposal for Approval (Design Phase — Read-Only)  
> **Scope:** Addition of Operational Manager Role, Laboratory Staff, and Non-Teaching Staff Management  

---

## 1. Executive Summary

This document presents the complete architectural blueprint for introducing the **Manager** role and non-academic operational staff management (**Laboratory Staff** and **Non-Teaching Staff**) into the FAFLOW Faculty Credit & Timetable Management platform.

### Core Principle
> **"System Admin creates and controls Managers. Managers manage Laboratory Staff and Non-Teaching Staff only. Managers have zero academic administration, timetable, substitution, credit, or RBAC privileges."**

The proposed design guarantees **100% architectural isolation** between academic faculty workflows (teachers, timetable slots, substitution engine, credit tracking, academic calendar) and operational staff operations, ensuring that existing production systems remain untouched and fully stable.

---

## 2. Confirmed Business Requirements & Role Hierarchy

### 2.1 Complete Institutional Hierarchy
```text
                           ┌───────────────────────────────┐
                           │         SYSTEM ADMIN          │
                           │   (Platform Superuser/IT)     │
                           └───────────────┬───────────────┘
                                           │
                ┌──────────────────────────┼──────────────────────────┐
                ▼                          ▼                          ▼
     ┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
     │      PRINCIPAL      │    │   HOD / DEPT ADMIN  │    │       MANAGER       │
     │ (College Academic   │    │  (Department Academic│    │   (Operational &    │
     │    Executive)       │    │     Super Admin)     │    │   Facility Admin)   │
     └──────────┬──────────┘    └──────────┬──────────┘    └──────────┬──────────┘
                │                          │                          │
                ▼                          ▼                          ├── Laboratory Staff
        College-Wide Read         Academic Departments                └── Non-Teaching Staff
           & Oversight            (Teachers, Classes,
                                  Timetable, Credits)
```

### 2.2 Strict Governance Constraints
1. **Creation Authority:** Only **System Admin** can create, update, assign scope, disable, or delete Manager accounts.
2. **No Horizontal Privilege Escalation:** A Manager cannot create or manage other Managers, HODs, Principals, or System Admins.
3. **No RBAC Mutation:** Managers cannot alter user roles, permissions, or system settings.
4. **No Academic Footprint:** Managers cannot view or manage Teachers, Subjects, Classes, Academic Timetables, Leave Requests of teachers, Teacher Substitution, or Teacher Credit balances.

---

## 3. Current Architecture Findings & Academic Coupling Analysis

Our comprehensive audit of the FAFLOW codebase identified that the `users` table and downstream services are currently coupled to academic faculty:

```text
users (id, role, department_id, ...)
  ├── timetable_slots.teacher_id               → Explicit academic slot allocations
  ├── leave_requests.teacher_id                → Academic absence triggers substitution engine
  ├── alter_assignments.substitute_teacher_id  → Academic class substitution
  ├── teacher_credits.teacher_id               → Academic workload credit balances
  ├── substitution_preferences.teacher_id      → Academic teacher availability matrices
  └── chk_user_department_role                 → DB Check: Admins/Teachers must have department_id
```

### Engine Coupling Warning
The automated substitution search algorithm (`backend/app/services/substitution_service.py`) executes:
```python
# Existing substitution query explicitly filters by teacher role:
available_teachers = db.query(User).filter(
    User.role == Role.teacher,
    User.is_active == True,
    User.department_id == dept_id
).all()
```

**Architectural Takeaway:** Laboratory Staff and Non-Teaching Staff must **never** be stored as `Role.teacher` or in academic foreign-key relationships. They require a dedicated operational model.

---

## 4. Staff Data Model Analysis & Evaluation

We evaluated four architectural approaches for modeling non-academic staff:

| Dimension | Option A: Extended `users` Table | Option B: `users` + `staff_profiles` | Option C: Separate `lab_staff` & `non_teaching_staff` Tables | Option D (Recommended): Unified `operational_staff` Domain |
| :--- | :--- | :--- | :--- | :--- |
| **Architecture** | Add `staff_type`, `designation` to `users` | All staff get `users` rows + `staff_profiles` row | Two independent standalone tables without `users` link | Hybrid: `users` for login accounts (Manager) + `operational_staff` for staff directory (with optional user accounts) |
| **Academic Isolation** | ⚠️ Risky: Mixes operational records in `User` table | ⚠️ High table bloat; requires login accounts for all attender/clerk staff | ⚠️ Silos data into two duplicated schemas with identical fields | ✅ Clean: 100% isolated operational domain; flexible login provisioning |
| **Authentication Impact** | Every staff member requires email/password | Every staff member requires email/password | Staff cannot log in without custom auth | Managers log in via `users`; Staff can either be profile-only or linked to `users` for self-service |
| **Teacher Logic Contamination** | ⚠️ High risk of query leakage | ⚠️ Moderate risk if queries do not filter role | ✅ Zero risk (completely separate table) | ✅ Zero risk (completely separate domain table) |
| **RBAC Complexity** | High (Role enum clutter) | Medium | High (two sets of permissions) | ✅ Low (single operational staff permission check) |
| **Department Scoping** | Tied to `users.department_id` | Flexible | Siloed | ✅ Flexible: Supports Department, Lab Room, or Institution Scope |
| **Factory Reset Impact** | Complex cascading logic | Complex multi-table cascades | High maintenance | ✅ Clean: Explicit truncation order without touching `users` |
| **Future Extensibility** | Poor | Good | Poor (duplicate changes across 2 tables) | ✅ Excellent (supports future operational modules: shifts, inventory, attendance) |

---

## 5. Recommended Architecture: Option D (Unified Operational Staff Domain)

### 5.1 Architecture Diagram
```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                AUTHENTICATION LAYER (`users`)                           │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│  id | email | name | role ('manager') | department_id (Nullable) | is_active | ...      │
└──────────────────────────────────────────┬──────────────────────────────────────────────┘
                                           │ (managed_by / created_by)
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                          OPERATIONAL LAYER (`operational_staff`)                        │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│  • id (PK)                                                                              │
│  • employee_code (Unique, indexed, e.g., "LAB-104", "NTS-201")                         │
│  • full_name (String)                                                                   │
│  • category ('laboratory' | 'non_teaching')                                             │
│  • designation (String, dynamic: "Lab Assistant", "Clerk", "Library Attender")          │
│  • department_id (FK -> departments.id, Nullable for college-wide staff)                 │
│  • assigned_room_id (FK -> rooms.id, Nullable, links Lab staff to specific lab room)    │
│  • phone_number (String, Nullable)                                                      │
│  • email (String, Nullable)                                                             │
│  • employment_status ('active' | 'on_leave' | 'transferred' | 'inactive')               │
│  • shift_type ('general' | 'morning' | 'evening' | 'night')                             │
│  • joining_date (Date)                                                                  │
│  • user_id (FK -> users.id, Nullable, for optional staff portal login)                  │
│  • created_by_manager_id (FK -> users.id)                                               │
│  • notes (Text, Nullable)                                                               │
│  • created_at, updated_at (Timestamps)                                                  │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Why this is the Safest Architecture
1. **Guaranteed Teacher Engine Isolation:** Queries for substitution, timetable, workload credits, and academic calendar never touch `operational_staff`.
2. **Unified Data Integrity:** Eliminates schema duplication between Laboratory and Non-Teaching staff while keeping categorizations cleanly indexed (`category` column).
3. **Optional User Login:** Operational staff (e.g. attendant, driver) do not require a login account unless institutional policy requires self-service mobile leave applications.
4. **Clean Laboratory Room Binding:** Reuses the existing `rooms` table (where `room_type = 'lab'`) without duplicate room tables.

---

## 6. Manager Scope Model

We evaluated scope models for institutions with multiple departments and centralized labs:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                         MANAGER SCOPE OPTIONS                           │
├─────────────────────────────────────────────────────────────────────────┤
│  1. Institution-Wide:                                                   │
│     Manager manages all Lab Staff & Non-Teaching Staff college-wide     │
│     (e.g., Campus Facility Manager, Central Admin Officer).             │
│                                                                         │
│  2. Department-Scoped:                                                  │
│     Manager manages Lab Staff & Non-Teaching Staff assigned to a        │
│     specific department (e.g., CSE Department Lab Manager).             │
│                                                                         │
│  3. Room/Lab-Scoped:                                                    │
│     Manager manages staff attached to specific specialized labs         │
│     (e.g., Central Computing Facility Manager).                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Recommended Hybrid Scope Model
The `users` record for a `Role.manager` will support flexible administrative scoping configured exclusively by the System Admin:

```text
users (Role.manager)
  ├── department_id = NULL       → Institution-Wide Manager (manages all operational staff)
  └── department_id = 12         → Department-Scoped Manager (manages staff in Department #12)
```

Additionally, an optional junction table `manager_assigned_rooms` will allow System Admins to delegate specific laboratory facilities to a Manager if needed in future phases.

---

## 7. Manager Account Lifecycle & Authentication Flow

Managers will plug seamlessly into FAFLOW's existing secure authentication pipeline:

```text
                      1. System Admin Creates Manager
                         POST /admin/managers
                         (Name, Email, Role: manager, Scope: dept/null, Temp Password)
                                     │
                                     ▼
                      2. Temporary Credentials Issued
                         (must_change_credentials = True)
                                     │
                                     ▼
                      3. Manager Performs First Login
                         POST /auth/login
                         (Receives JWT token with role="manager", must_change=True)
                                     │
                                     ▼
                      4. First Login Password Reset Flow
                         (Protected by RequireCredentialsSet frontend guard)
                                     │
                                     ▼
                      5. Manager Dashboard Access
                         (/manager/dashboard)
```

---

## 8. Complete System Permission Matrix

| System Capability | System Admin | Principal | HOD | Secondary Admin | Manager | Teacher |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Create / Manage Managers** | **Full** | View | ❌ | ❌ | ❌ | ❌ |
| **Create / Manage Lab Staff** | **Full** | View | View | ❌ | **Full (Scoped)** | ❌ |
| **Create / Manage Non-Teaching Staff**| **Full** | View | View | ❌ | **Full (Scoped)** | ❌ |
| **Assign Staff to Labs / Rooms** | **Full** | View | View | ❌ | **Full (Scoped)** | ❌ |
| **Record Staff Attendance / Duty** | **Full** | View | View | ❌ | **Full (Scoped)** | ❌ |
| **Approve Staff Operational Leave**| **Full** | View | View | ❌ | **Full (Scoped)** | ❌ |
| **Manage Teachers & Faculty** | **Full** | View | **Full** | **Full** | ❌ | ❌ |
| **Manage Subjects & Syllabus** | **Full** | View | **Full** | **Full** | ❌ | ❌ |
| **Manage Classes & Sections** | **Full** | View | **Full** | **Full** | ❌ | ❌ |
| **Manage Academic Timetable** | **Full** | View | **Full** | **Full** | ❌ | View Own |
| **Teacher Leave Requests** | **Full** | View | **Full** | **Full** | ❌ | Apply/Own |
| **Teacher Substitution Engine** | **Full** | View | **Full** | **Full** | ❌ | View/Accept |
| **Teacher Credit Calculation** | **Full** | View | **Full** | **Full** | ❌ | View Own |
| **Academic Calendar & Day Orders**| **Full** | View | View | View | ❌ | View |
| **Department Management** | **Full** | View | ❌ | ❌ | ❌ | ❌ |
| **System Settings & RBAC** | **Full** | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Factory Reset & Audit Purge** | **Full** | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 9. Operational Staff Functional Modules

### Phase 1 (Immediate Scope for Implementation):
1. **Staff Directory:** Complete CRUD, search, filter, designation assignment, contact info, and status toggling (Active / On Leave / Inactive).
2. **Laboratory Room Binding:** Link laboratory technicians directly to existing `rooms` records where `room_type = 'lab'`.
3. **Department Allocation:** Assign staff to academic departments or mark as Central Administrative staff.
4. **Manager Dashboard:** Key operational metrics (Total Lab Staff, Total Non-Teaching Staff, On-Duty today, Active Labs).

### Phase 2 (Future-Ready Extension Points):
1. **Operational Leave Requests (`staff_leave_requests`):** Simple date-range leave approval without substitution engine mechanics.
2. **Shift & Duty Log (`staff_duty_logs`):** Record lab shift allocations (Morning / Evening / General).
3. **Daily Attendance Register (`staff_attendance`):** Mark Present / Absent / On Duty.

---

## 10. Room / Laboratory Integration

FAFLOW's existing `rooms` table schema:
```sql
CREATE TABLE rooms (
    id SERIAL PRIMARY KEY,
    room_number VARCHAR(50) NOT NULL UNIQUE,
    room_type VARCHAR(20) DEFAULT 'classroom', -- 'classroom' or 'lab'
    capacity INTEGER,
    floor INTEGER,
    building VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE
);
```

### Recommendation
- In `operational_staff`, the field `assigned_room_id` references `rooms(id) ON DELETE SET NULL`.
- The Manager UI filters `roomsApi.list()` where `room_type === 'lab'` when assigning Laboratory Staff.
- Classroom rooms are not presented for lab assignments.

---

## 11. Operational Leave & Attendance Architecture (Future-Ready Design)

### 11.1 Separate Leave Table (`staff_leave_requests`)
Operational staff must **not** use the academic `leave_requests` table because academic leaves require day orders, period numbers, and teacher credit alterations.

```sql
CREATE TABLE staff_leave_requests (
    id SERIAL PRIMARY KEY,
    staff_id INTEGER NOT NULL REFERENCES operational_staff(id) ON DELETE CASCADE,
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    leave_type VARCHAR(50) NOT NULL DEFAULT 'Casual',
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    reviewed_by_manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 12. Factory Reset Impact & Cascading Rules

When an administrator performs a Factory Reset (`backend/app/services/factory_reset_service.py`), operational staff records must follow deterministic cascading rules:

### 12.1 Global Factory Reset
- **Purged Tables:** `staff_leave_requests`, `operational_staff`, `users (where role = 'manager')`.
- **Foreign-Key Deletion Order:**
  1. `staff_leave_requests`
  2. `operational_staff`
  3. `users` (where `role = 'manager'`)
- **Preserved Records:** System Administrator account.

### 12.2 Department Reset (Scoped)
- **Purged Records:** Operational staff with matching `department_id`.
- **Preserved Records:** Institution-wide operational staff (`department_id IS NULL`) and Managers.

---

## 13. Database Migration Specification (`008_add_manager_and_staff.sql`)

```sql
-- ── Migration 008: Add Manager Role and Operational Staff ──────────────────

-- 1. Extend user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'manager';

-- 2. Update department check constraint on users table
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_user_department_role;

ALTER TABLE users ADD CONSTRAINT chk_user_department_role CHECK (
    -- System Admin, Principal, and Institution-Wide Manager can have NULL department_id
    (role IN ('system_admin', 'principal') AND department_id IS NULL)
    OR (role = 'manager') -- Manager can have department_id or NULL (institution-wide)
    OR (role IN ('admin', 'secondary_admin', 'teacher') AND department_id IS NOT NULL)
);

-- 3. Create operational_staff table
CREATE TABLE IF NOT EXISTS operational_staff (
    id SERIAL PRIMARY KEY,
    employee_code VARCHAR(50) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    category VARCHAR(30) NOT NULL CHECK (category IN ('laboratory', 'non_teaching')),
    designation VARCHAR(100) NOT NULL,
    department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    assigned_room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
    phone_number VARCHAR(20),
    email VARCHAR(150),
    employment_status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (employment_status IN ('active', 'on_leave', 'transferred', 'inactive')),
    shift_type VARCHAR(20) NOT NULL DEFAULT 'general' CHECK (shift_type IN ('general', 'morning', 'evening', 'night')),
    joining_date DATE DEFAULT CURRENT_DATE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_by_manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create Indexes
CREATE INDEX IF NOT EXISTS idx_operational_staff_category ON operational_staff(category);
CREATE INDEX IF NOT EXISTS idx_operational_staff_dept ON operational_staff(department_id);
CREATE INDEX IF NOT EXISTS idx_operational_staff_status ON operational_staff(employment_status);
CREATE INDEX IF NOT EXISTS idx_operational_staff_room ON operational_staff(assigned_room_id);

-- 5. Audit Log Triggers
CREATE TRIGGER trg_operational_staff_audit
AFTER INSERT OR UPDATE OR DELETE ON operational_staff
FOR EACH ROW EXECUTE FUNCTION record_system_audit();
```

---

## 14. Backend Architecture Plan

### Proposed File Modifications & Additions

| File Path | Nature | Proposed Modification | Risk |
| :--- | :---: | :--- | :---: |
| `backend/app/models/user.py` | Modify | Add `manager = "manager"` to `Role` Enum | Low |
| `backend/app/models/operational_staff.py` | **New** | SQLAlchemy model for `OperationalStaff` | Low |
| `backend/app/schemas/operational_staff.py` | **New** | Pydantic schemas (`StaffCreate`, `StaffUpdate`, `StaffOut`, `ManagerCreate`) | Low |
| `backend/app/core/dependencies.py` | Modify | Add `get_current_manager`, `require_manager_or_admin` security guards | Low |
| `backend/app/services/operational_staff_service.py`| **New** | Business logic for staff CRUD, scoping, and statistics | Low |
| `backend/app/routes/manager.py` | **New** | REST endpoints for Manager operations (`/manager/...`) | Low |
| `backend/app/routes/admin.py` | Modify | Add System Admin endpoints to manage Manager accounts (`/admin/managers/...`) | Low |
| `backend/app/services/factory_reset_service.py` | Modify | Register `operational_staff` and Manager accounts in reset cascades | Medium |
| `backend/app/main.py` | Modify | Register `manager_router` in FastAPI application | Low |

---

## 15. API Endpoint Specifications

### 15.1 System Admin Manager Management APIs
* `GET /api/admin/managers` — List all Manager accounts (Allowed: `System Admin`)
* `POST /api/admin/managers` — Create new Manager account (Allowed: `System Admin`)
* `GET /api/admin/managers/{id}` — Get Manager details (Allowed: `System Admin`)
* `PUT /api/admin/managers/{id}` — Update Manager details/scope (Allowed: `System Admin`)
* `PATCH /api/admin/managers/{id}/status` — Enable / Disable Manager (Allowed: `System Admin`)
* `DELETE /api/admin/managers/{id}` — Remove Manager account (Allowed: `System Admin`)

### 15.2 Manager Operational Staff APIs
* `GET /api/manager/dashboard` — Operational summary metrics (Allowed: `Manager`, `System Admin`, `Principal`)
* `GET /api/manager/staff` — List operational staff with filters (Allowed: `Manager`, `System Admin`, `Principal`, `HOD`)
* `POST /api/manager/staff` — Create new staff member (Allowed: `Manager`, `System Admin`)
* `GET /api/manager/staff/{id}` — Get detailed staff profile (Allowed: `Manager`, `System Admin`, `Principal`, `HOD`)
* `PUT /api/manager/staff/{id}` — Update staff details (Allowed: `Manager`, `System Admin`)
* `PATCH /api/manager/staff/{id}/status` — Change employment status (Allowed: `Manager`, `System Admin`)
* `DELETE /api/manager/staff/{id}` — Remove staff record (Allowed: `Manager`, `System Admin`)
* `GET /api/manager/labs` — Get active laboratory rooms for assignment (Allowed: `Manager`, `System Admin`)

---

## 16. Frontend Architecture Plan

### 16.1 Navigation & Route Protection
* `frontend/src/routes/Guards.jsx` — Add `ManagerRoute` guard ensuring `user.role === 'manager'`.
* `frontend/src/components/layout/navConfig.jsx` — Define `MANAGER_NAV`:
  ```javascript
  export const MANAGER_NAV = [
    {
      section: null,
      items: [
        { to: '/manager/dashboard', label: 'Home', icon: <GridIcon />, end: true },
        { to: '/manager/lab-staff', label: 'Laboratory Staff', icon: <DoorIcon /> },
        { to: '/manager/non-teaching-staff', label: 'Non-Teaching Staff', icon: <UsersIcon /> },
        { to: '/manager/directory', label: 'All Staff Directory', icon: <BookIcon /> },
      ],
    },
  ]
  ```
* `frontend/src/context/AuthContext.jsx` — Add `isManager: user?.role === 'manager'`.
* `frontend/src/components/layout/BottomNav.jsx` — Add Manager mobile bottom navigation bar.

### 16.2 New Frontend Pages
1. `frontend/src/pages/admin/Managers.jsx` — System Admin interface to create and manage Managers.
2. `frontend/src/pages/manager/Dashboard.jsx` — Manager metrics, staff counts, quick actions.
3. `frontend/src/pages/manager/LabStaff.jsx` — Dedicated Laboratory Staff table with room badges and mobile cards.
4. `frontend/src/pages/manager/NonTeachingStaff.jsx` — Non-Teaching Staff management.
5. `frontend/src/pages/manager/StaffDirectory.jsx` — Unified searchable staff directory.

---

## 17. Security & Isolation Verification

```text
┌────────────────────────────┐       ┌──────────────────────────────────────────────┐
│       MANAGER ATTEMPT      │       │              SECURITY ENFORCEMENT            │
├────────────────────────────┼───────┼──────────────────────────────────────────────┤
│ Access /admin/timetable    │  ───> │ ⛔ 403 Forbidden (require_admin dependency)  │
│ Access /teacher/timetable  │  ───> │ ⛔ 403 Forbidden (require_teacher dependency)│
│ POST /admin/teachers       │  ───> │ ⛔ 403 Forbidden                             │
│ Modify user roles          │  ───> │ ⛔ 403 Forbidden                             │
│ Mutate academic calendar   │  ───> │ ⛔ 403 Forbidden                             │
│ Call Factory Reset         │  ───> │ ⛔ 403 Forbidden (require_system_admin)      │
└────────────────────────────┘       └──────────────────────────────────────────────┘
```

---

## 18. Testing & Validation Strategy

1. **Authentication Tests:**
   - Verify Manager login, password change on first login, token issuance, and expired session handling.
2. **RBAC Isolation Tests:**
   - Verify Manager receives HTTP 403 when requesting any `/teacher/*` or `/admin/*` academic route.
   - Verify Teachers and HODs receive HTTP 403 when attempting Manager creation.
3. **Staff CRUD & Scoping Tests:**
   - Department-scoped Manager can only see and edit staff within their assigned department.
   - Institution-wide Manager can view and edit all operational staff.
4. **Substitution & Workload Regression Tests:**
   - Verify that adding 50 operational staff members does **not** alter the candidate list in `substitution_service.py` or affect teacher credit calculations.
5. **Mobile Responsiveness Tests:**
   - Audit Manager tables and dialogs on 320px, 375px, 414px, and 768px viewports.

---

## 19. Risk Assessment

| Component | Risk Level | Mitigation Strategy |
| :--- | :---: | :--- |
| `user_role` Enum Extension | **LOW** | Postgres `ALTER TYPE` adds enum value without locking tables |
| Check Constraint Update | **LOW** | Updates constraint to allow nullable `department_id` for managers |
| Academic Engine Integrity | **ZERO** | `operational_staff` is an independent table; substitution queries are untouched |
| Factory Reset Service | **LOW** | Added explicit cascading delete steps for operational records |
| Frontend Hot Refresh & Routing | **LOW** | Follows the established modular `navConfig` and `Guards` structure |

---

## 20. Implementation Phase Sequence

Upon receiving approval, the implementation will proceed in the following ordered phases:

```text
  Phase 1: Database Migration (008_add_manager_and_staff.sql)
     ↓
  Phase 2: Backend Models & Schemas (operational_staff.py, user.py Role enum)
     ↓
  Phase 3: System Admin Manager Management API (/api/admin/managers)
     ↓
  Phase 4: Manager Backend API & Service Layer (/api/manager/...)
     ↓
  Phase 5: Frontend Auth, Guards & Navigation (AuthContext, Guards, navConfig)
     ↓
  Phase 6: System Admin Manager UI (/admin/managers)
     ↓
  Phase 7: Manager Portal UI (Dashboard, Lab Staff, Non-Teaching Staff)
     ↓
  Phase 8: Audit Logging & Factory Reset Integration
     ↓
  Phase 9: Automated & Regression Testing
```

---

## 21. Summary Recommendation

We recommend proceeding with **Option D (Unified Operational Staff Domain)** and the **Hybrid Scoping Model**. This design:
- Perfectly fulfills all business requirements.
- Strictly adheres to the System Admin $\rightarrow$ Manager hierarchy.
- Provides dynamic designations for Laboratory and Non-Teaching Staff.
- Integrates cleanly with existing Laboratory Rooms (`rooms.id`).
- Guarantees **zero contamination** of academic teacher and substitution logic.

*Awaiting approval to begin Phase 1.*
