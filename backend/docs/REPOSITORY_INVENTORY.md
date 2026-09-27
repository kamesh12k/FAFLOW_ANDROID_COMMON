# FAFLOW BACKEND — REPOSITORY INVENTORY

**Date:** 2026-09-27 | **Repository:** `b:\FAFLOW_UNIFIED\backend`  
**Current Branch:** `master` | **Upstream:** `origin/master` (`https://github.com/kamesh12k/FAFLOW_ANDROID_COMMON.git`)  
**Framework:** FastAPI / Python 3.11+ / PostgreSQL / SQLAlchemy / Alembic

---

## 1. GIT CONFIGURATION & RECENT COMMITS

- **Repository Root:** `b:\FAFLOW_UNIFIED\backend`
- **Branch:** `master`
- **Remote:** `origin` -> `https://github.com/kamesh12k/FAFLOW_ANDROID_COMMON.git`
- **Recent Commit History:**
  - `2fbd576` - `fix(duties): allow candidate picking for pending check-in faculty with automated absence replacement`
  - `ecc250b` - `fix(student-attendance): enable substitution teachers to view periods and take student attendance`
  - `086d2c7` - `test(attendance): normalize tzinfo for sqlite in captured_at test`
  - `a500520` - `fix(attendance): preserve original captured_at timestamp for offline sync check-ins and check-outs`
  - `0423af1` - `test(geofences): fix permanent delete assertion`
  - `e1eca16` - `fix(geofences): calculate exact polygon boundary and edge distance instead of circumscribed bounding circle`
  - `3eb8247` - `fix(geofences): do not default to Coimbatore; show neutral view and banner when no campus perimeter configured`

---

## 2. BACKEND ARCHITECTURE & DIRECTORY STRUCTURE

### `app/` Directory Breakdown
- **`app/routes/`**: FastAPI API Routers
  - `auth.py`: Authentication, JWT issuance, policy acceptance, credential setup.
  - `teachers.py`: Faculty profiles, credit balances, department listings.
  - `attendance.py`: Check-in, check-out, geofence & biometric validation, history.
  - `leaves.py`: Leave applications, approvals, balance ledgers, cancellations.
  - `timetable.py`: Timetable schedules, slots, day orders, batch rosters.
  - `substitutions.py`: Automated substitute selection, workload balancing, accept/decline.
  - `campus_duties.py`: Campus supervision assignments, candidate ranking, rotations.
  - `geofences.py`: Campus perimeters, polygon vertices, coordinate tolerances.
  - `notifications.py`: Push notification feeds, unread counters, broadcast messaging.
  - `announcements.py`: Institutional circulars and acknowledgments.
  - `student_attendance.py`: Hourly student attendance, session locks, sync audits.
  - `system_settings.py` & `governance.py`: Governance rules, operational windows, institutional schedule.

- **`app/services/`**: Core Business Logic Services
  - `attendance_service.py`: Multi-factor attendance decision engine.
  - `leave_service.py`: Quota calculations and policy compliance evaluation.
  - `substitution_service.py`: Automated peer-matching algorithm.
  - `campus_duty_service.py`: Fairness scoring and duty assignment dispatch.
  - `student_attendance_service.py`: Session management and attendance roll calls.
  - `governance_rule_service.py`: Dynamic policy rules and operational thresholds.
  - `geofence_service.py`: Ray-casting point-in-polygon verification.

- **`app/models/`**: SQLAlchemy Database Models
  - `user.py`, `attendance.py`, `leave.py`, `credit.py`, `timetable.py`, `duty.py`, `geofence.py`, `student.py`, `system_setting.py`.

- **`app/schemas/`**: Pydantic Request & Response DTOs
  - Comprehensive schemas matching the Android Moshi DTO contracts.

---

## 3. DATABASE CONFIGURATION

- **Database Engine:** PostgreSQL 16+
- **Local Dev Database:** `postgresql://postgres@localhost:5432/credits_db`
- **ORM / Migrations:** SQLAlchemy 2.0+ & Alembic migrations
- **Timezone Standard:** UTC (`Asia/Kolkata` display translation)
- **Live Production URL:** `https://faflowgovernence.online`
