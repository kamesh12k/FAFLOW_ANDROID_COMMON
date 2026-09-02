# Milestone 17 — Substitution Engine Parity Specification

### 1. Overview
The FAFLOW substitution subsystem is an intelligent, multi-parameter workload balancing and slot allocation engine. It supports autonomous assignments, candidate compatibility scoring, fairness indexing, consecutive class penalties, emergency same-day substitutions, and teacher-driven preferences.

---

### 2. Multi-Parameter Scoring Engine (`substitution_service.py`)

1. **Free Slot Requirement**:
   Candidate teacher MUST NOT have an existing class scheduled in the same `day_order` and `period_number`, and must not already be on approved leave for that period.
2. **Workload Fairness & Daily Balance**:
   - Baseline score: 100 points.
   - Deduction per existing period taught today: `-15 points`.
   - Penalty for consecutive back-to-back blocks (4+ periods without break): `-30 points`.
   - Fairness adjustment based on total substitutions accepted in the current cycle: `-5 points per substitution`.
3. **Department Affinity & Cross-Department Boundary**:
   - Same-department candidate bonus: `+20 points`.
   - Cross-department candidate is only evaluated if `willing_for_cross_department == True` or campus-wide emergency mode is active.
4. **Teacher Substitution Policy & Gating**:
   - Teacher-directed candidate selection is governed by institutional policy (`institution_policy.teacher_substitution_mode`).
   - When policy is set to `auto` or `admin_only`, teachers cannot manually select replacements; the engine allocates automatically or queues for HOD review.
   - When policy is set to `open` / `teacher_choice`, teachers can pick from scored candidate recommendations.

---

### 3. HOD Coverage & Slot Management
- HODs monitor the real-time coverage board (`TodayCoverageScreen.kt` / `GET /substitutions/today`).
- Covered vs Uncovered metrics are calculated dynamically.
- For uncovered slots, HOD can assign an available substitute teacher via `AssignSubstituteDialog` / `POST /leaves/{id}/assign`.
