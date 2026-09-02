# Database Setup — Credits (v3)

## Files
- `schema.sql` — full v3 schema: RBAC, audit logs, Academic Calendar (Academic Years, Semesters, Calendar Days/Day Order/Holiday management), timetable/leave/credit tables (5 periods/day)
- `seed.sql` — sample departments, teachers, subjects, classes, rooms, one Academic Year + Semester, an example Day-Order-pause-for-holiday week, timetable slots, and leave requests
- `migrations/002_add_rbac_and_audit.sql` — upgrades a v1 database to v2 (RBAC, audit logs, factory reset support)
- `migrations/003_academic_calendar.sql` — upgrades a v2 database to v3 (Academic Calendar tables, 5-period constraint)

## Fresh install

```bash
createdb credits_db
psql -d credits_db -f schema.sql
psql -d credits_db -f seed.sql   # optional — sample data for local dev only
```

The Super Admin bootstrap account (`username: admin` / `password: admin`) is created automatically the first time the backend starts — **not** by these SQL files. Log in with it immediately; the dashboard is locked until you set new credentials.

## Upgrading an existing database

```bash
# v1 -> v2
psql -d credits_db -f migrations/002_add_rbac_and_audit.sql
# v2 -> v3
psql -d credits_db -f migrations/003_academic_calendar.sql
```

Both migrations are safe to re-run (idempotent guards via `IF NOT EXISTS` / `ON CONFLICT`). Migration 003 deliberately adds the new `period_number` range constraint as `NOT VALID` so it won't fail outright on a database with historical periods 6-8 — see the comments at the bottom of that file for the manual follow-up steps to fully validate it.

## Seeded login credentials (sample data only — do not use in production)

All seeded teachers share the password **`password123`**.

| Email | Role | Department |
|---|---|---|
| anita.sharma@college.edu | teacher | Computer Science |
| rajesh.kumar@college.edu | teacher | Computer Science |
| meena.iyer@college.edu | teacher | Mathematics |
| vikram.rao@college.edu | teacher | Mathematics |
| sunita.patel@college.edu | teacher | Physics |
| arjun.nair@college.edu | teacher | Physics |

Admin: `username: admin` / `password: admin` (bootstrap, forced credential change on first login — not from seed.sql).

## Notes on design choices

**`calendar_days` is the single source of truth for "is this date usable."** Every other date-driven calculation — leave submission, timetable scheduling, substitute detection, credit/workload reports — checks `day_type` here before doing anything. A date with no row at all is treated as *not* a working day (conservative-by-default), so a forgotten calendar entry produces a clear 400 error instead of a silently wrong credit number.

**Day Order, not weekday, drives `timetable_slots` / `leave_requests`.** The rotation (1–6) is independent of the literal weekday and can pause/resume across holidays without touching a single timetable row — only `calendar_days` changes when a holiday is inserted.

**`chk_calendar_day_order`** — a CHECK constraint that makes it structurally impossible for a non-`working` day to carry a Day Order, mirroring the same "enforce the invariant in the database, not just application code" philosophy as the existing self-substitution trigger.

**Semesters (date-bound) are intentionally separate from the integer `semester` column on `subjects`/`classes`.** The latter is curriculum sequencing (1–8) and predates this feature; the former is a calendar period used for Academic-Calendar reporting and Day-Order/holiday scoping. They are not migrated into each other.

**`CHECK (period_number BETWEEN 1 AND 5)`** — tightened from the original 1–8 range per the updated five-periods-per-day spec, enforced at the database layer on both `timetable_slots` and `leave_requests`.

**`teacher_credits` as a cached balance + `credit_transactions` as the source of truth** — unchanged from v1/v2: reads of "current balance" are O(1), while the ledger remains the full audit trail.
