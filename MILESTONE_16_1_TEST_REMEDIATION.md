# Milestone 16.1: Test Remediation & Forensic Analysis

> Repository: `B:\FAFLOW_UNIFIED\backend`  
> Baseline: 479 collected tests  
> Result: **479 passed (100%)** in 126.92s

---

## 1. Executive Summary

During the initial baseline execution of the unified backend test suite (`pytest`), 476 tests passed and 3 failed (plus 1 test had a missing optional dependency `pywebpush` that was quickly restored). The 3 failing tests were thoroughly analyzed rather than skipped or marked as `xfail`. 

All 3 were proven to be:
1. **Time-dependent test fragility**: 2 tests hardcoded an absolute calendar date (`2026-09-01`) which expired when the clock passed the 5:00 PM IST substitution cutoff on September 1, 2026.
2. **Authentication semantic mismatch**: 1 test asserted HTTP 401 Unauthorized for an unauthenticated request, but FastAPI's default `HTTPBearer(auto_error=True)` intercepted with HTTP 403 Forbidden.

After applying surgical, production-safe fixes:
- **Zero test cases skipped**
- **Zero production security guards weakened**
- **479 / 479 tests passed cleanly**

---

## 2. Detailed Root-Cause Analysis & Fixes

### Failure 1 & 2: `test_leave_service::TestAssignSubstitute`
- **Tests Affected**:
  - `TestAssignSubstitute::test_success`
  - `TestAssignSubstitute::test_teacher_not_found`
- **Observed Error**:
  ```text
  fastapi.exceptions.HTTPException: 400: Cannot assign substitute for an expired substitution (cutoff is 5:00 PM in Asia/Kolkata on the substitution date)
  ```
  and for `test_teacher_not_found`:
  ```text
  AssertionError: assert 400 == 404
  ```
- **Root Cause**:
  In `tests/test_leave_service.py`, `TestAssignSubstitute._setup` defined:
  ```python
  test_date = date(2026, 9, 1)
  ```
  FAFLOW business logic strictly enforces in `app/services/leave_service.py`:
  ```python
  if is_substitution_expired(leave.date):
      raise HTTPException(status_code=400, detail="Cannot assign substitute for an expired substitution (cutoff is 5:00 PM in Asia/Kolkata on the substitution date)")
  ```
  Where `is_substitution_expired(d)` marks any date in the past (`sub_date < today`) or today after 17:00:00 IST as expired.
  When the test was authored prior to September 2026, `2026-09-01` was in the future. As time advanced past September 1, 2026, the hardcoded date became past/expired. The test logic correctly triggered the production cutoff guard.
- **Remediation**:
  The production cutoff guard is working as intended. The test fixture was updated to use a dynamic, future-relative calendar date:
  ```python
  test_date = get_institution_today() + timedelta(days=7)
  ```
  This guarantees that regardless of when test suites execute in CI/CD, the test assignment date is always active and upcoming.
- **Verification**:
  Both tests passed immediately. `test_success` returned the assignment, and `test_teacher_not_found` correctly reached the teacher query and raised HTTP 404.

---

### Failure 3: `test_substitution_dashboard::test_get_today_substitutions_unauthorized`
- **Test Affected**:
  `test_substitution_dashboard.py:130`
- **Observed Error**:
  ```text
  AssertionError: assert 403 == 401
  where 403 = <Response [403 Forbidden]>.status_code
  ```
- **Root Cause**:
  The test was verifying that unauthenticated requests to `/substitutions/today` are rejected with HTTP 401 Unauthorized.
  However, in `app/core/dependencies.py`:
  ```python
  bearer_scheme = HTTPBearer()
  ```
  By default in FastAPI, `HTTPBearer(auto_error=True)` intercepts requests lacking an `Authorization` header and raises `HTTPException(status_code=403, detail="Not authenticated")`.
  This is a known deviation from RFC 7235 Section 3.1 / RFC 9110, which states:
  > *401 Unauthorized: The request has not been applied because it lacks valid authentication credentials for the target resource.*
  HTTP 403 Forbidden should be reserved for authenticated users who lack permissions (e.g. Teacher calling an Admin endpoint).
- **Remediation**:
  Configured `bearer_scheme = HTTPBearer(auto_error=False)` in `app/core/dependencies.py` and updated `get_current_user` to explicitly enforce authentication:
  ```python
  bearer_scheme = HTTPBearer(auto_error=False)

  def get_current_user(
      credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
      db: Session = Depends(get_db),
  ) -> User:
      if not credentials:
          raise HTTPException(
              status_code=status.HTTP_401_UNAUTHORIZED,
              detail="Not authenticated",
              headers={"WWW-Authenticate": "Bearer"},
          )
      token = credentials.credentials
      payload = decode_token(token)
      ...
  ```
- **Security Impact**:
  Strengthens compliance with RFC 7235 and OpenAPI standards by issuing standard `401 Unauthorized` with `WWW-Authenticate: Bearer` challenge when no token is present, while preserving `403 Forbidden` for RBAC permission denials.
- **Verification**:
  `test_substitution_dashboard.py` passed with HTTP 401. All existing RBAC 403 tests (e.g. `test_clear_history_unauthorized`, `test_security_hardening.py`) continue to pass.

---

## 3. Test Suite Summary Table

| Test Module | Test Count | Pass Count | Status |
|---|---|---|---|
| `test_academic_calendar_service.py` | 8 | 8 | ✅ PASSED |
| `test_admin_service.py` | 14 | 14 | ✅ PASSED |
| `test_attendance.py` | 11 | 11 | ✅ PASSED |
| `test_auth_service.py` | 9 | 9 | ✅ PASSED |
| `test_backup_service.py` | 36 | 36 | ✅ PASSED |
| `test_class_service.py` | 13 | 13 | ✅ PASSED |
| `test_core_dependencies.py` | 6 | 6 | ✅ PASSED |
| `test_core_security.py` | 8 | 8 | ✅ PASSED |
| `test_credit_service.py` | 8 | 8 | ✅ PASSED |
| `test_data_retention_service.py` | 9 | 9 | ✅ PASSED |
| `test_day_order_service.py` | 27 | 27 | ✅ PASSED |
| `test_department_service.py` | 12 | 12 | ✅ PASSED |
| `test_dependencies.py` | 12 | 12 | ✅ PASSED |
| `test_geofence_service.py` | 8 | 8 | ✅ PASSED |
| `test_geofences.py` | 3 | 3 | ✅ PASSED |
| `test_governance.py` | 3 | 3 | ✅ PASSED |
| `test_governance_control.py` | 23 | 23 | ✅ PASSED |
| `test_leave_aware_substitution_fairness.py` | 12 | 12 | ✅ PASSED |
| `test_leave_cancellation.py` | 16 | 16 | ✅ PASSED |
| `test_leave_service.py` | 20 | 20 | ✅ PASSED |
| `test_main.py` | 2 | 2 | ✅ PASSED |
| `test_manager_operational_staff.py` | 4 | 4 | ✅ PASSED |
| `test_notification_service.py` | 9 | 9 | ✅ PASSED |
| `test_push_notifications.py` | 6 | 6 | ✅ PASSED |
| `test_room_service.py` | 15 | 15 | ✅ PASSED |
| `test_routes.py` | 27 | 27 | ✅ PASSED |
| `test_schemas.py` | 29 | 29 | ✅ PASSED |
| `test_security.py` | 13 | 13 | ✅ PASSED |
| `test_security_hardening.py` | 6 | 6 | ✅ PASSED |
| `test_services_admin_service.py` | 12 | 12 | ✅ PASSED |
| `test_services_auth_service.py` | 6 | 6 | ✅ PASSED |
| `test_services_day_order_service.py` | 11 | 11 | ✅ PASSED |
| `test_services_department_subject.py` | 10 | 10 | ✅ PASSED |
| `test_staff_leaves_and_credits.py` | 1 | 1 | ✅ PASSED |
| `test_subject_service.py` | 10 | 10 | ✅ PASSED |
| `test_substitution_cutoff.py` | 6 | 6 | ✅ PASSED |
| `test_substitution_dashboard.py` | 5 | 5 | ✅ PASSED |
| `test_substitution_limit_warning.py` | 8 | 8 | ✅ PASSED |
| `test_substitution_service.py` | 28 | 28 | ✅ PASSED |
| `test_timetable_service.py` | 13 | 13 | ✅ PASSED |
| **TOTAL** | **479** | **479** | **100% PASS** |
