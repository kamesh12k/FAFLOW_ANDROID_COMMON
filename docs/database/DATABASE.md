# FAFLOW — Database Architecture & Concurrency Model

## 1. Relational Database Overview

FAFLOW utilizes **PostgreSQL 14+** in production (with SQLite dialect support for fast unit testing). The database is structured into 19 relational entities managing the academic operational lifecycle.

---

## 2. Concurrency Control & Row-Level Locking

### 2.1 Credit Transaction Ledger Atomicity
- Credit adjustments (`apply_credit_change`) use PostgreSQL row-level locks (`SELECT ... FOR UPDATE` via `query.with_for_update()`) on `TeacherCredit`.
- Guarantees serialization of concurrent credit mutations (preventing lost updates, double deductions, or balance drift).

### 2.2 Timetable Matrix Integrity
- Strict unique constraint `uq_teacher_class_day_period UNIQUE (teacher_id, class_id, day_order, period_number)` prevents duplicate slot creation.
- Transactional conflict checks verify teacher, class, and room availability before committing new slots.

---

## 3. High-Frequency Query Indexing

- **`timetable_slots`**:
  - `idx_timetable_slots_teacher` on `(teacher_id)`
  - `idx_timetable_slots_room` on `(room_id)`
  - `idx_timetable_slots_class` on `(class_id)`
  - `idx_timetable_slots_day_order` on `(day_order)`
- **`leave_requests`**:
  - `idx_leave_requests_teacher` on `(teacher_id)`
  - `idx_leave_requests_status` on `(status)`
  - `idx_leave_requests_date` on `(date)`
  - `idx_leave_requests_batch_id` on `(batch_id)`
- **`calendar_days`**:
  - `idx_calendar_days_date` on `(date)`
  - `idx_calendar_days_day_type` on `(day_type)`
  - `idx_calendar_days_day_order` on `(day_order)`

---

## 4. Connection Pooling Configuration

| Parameter | Value | Rationale |
| :--- | :--- | :--- |
| `DB_POOL_SIZE` | `50` | Supports sustained high concurrency across worker processes |
| `DB_MAX_OVERFLOW` | `30` | Handles sudden spikes up to 80 total database connections |
| `pool_pre_ping` | `True` | Validates connection liveness before executing queries |
| `pool_recycle` | `300s` | Recycles idle connections before database server timeouts |
| `pool_timeout` | `30s` | Fails fast to prevent connection hangs under heavy load |
