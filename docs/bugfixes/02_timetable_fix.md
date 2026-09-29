# Bug Fix Report: Phase 2 — Broken Timetable Data Loading (P0)

**Date**: 2026-09-29  
**Branch**: `fix/bug-report-20260929`  
**Severity**: P0 (High Impact / Broken Data Loading)  
**Route**: `/admin/timetable`  
**Error**: `"Failed to load timetable"` toast error upon opening page or selecting a teacher  

---

## 1. Executive Summary

When administrators navigated to `/admin/timetable`, the frontend immediately displayed a persistent `"Failed to load timetable"` error toast. Furthermore, selecting teachers from different departments failed to display their scheduled periods, rendering the timetable matrix blank.

Through systematic reproduction using FastAPI's `TestClient` against the production PostgreSQL database (`credits_db`), we isolated four interlocking root causes across backend tenancy rules, service layer access controls, client contract definition, and frontend component error handling.

All issues have been resolved. The fix is backed by both backend pytest unit/integration tests and a Playwright browser E2E test verifying that `/admin/timetable` loads with zero errors and renders timetable slot cards.

---

## 2. Root Cause Analysis

### A. Backend Tenant Isolation Flaw (`backend/app/core/dependencies.py`)
`get_tenant_department_id` is the core dependency responsible for scoping database queries to a specific department. While system administrators, principals, and governance users were granted institution-wide access (returning `None`), **Super Admins** (`current_user.role == Role.admin and current_user.admin_level == AdminLevel.super_admin`) were omitted from this bypass. Because seeded super admins (such as `CSHOD`, `id=6`) are assigned a primary department (`department_id=1`), the dependency locked the Super Admin into department 1.

```python
# Before (dependencies.py line 150):
if current_user.role in (Role.system_admin, Role.principal, Role.governance) or (current_user.role == Role.manager and current_user.department_id is None):
    ...
return current_user.department_id
```

### B. Artificial Read Block in Service Layer (`backend/app/services/timetable_service.py`)
In `get_by_teacher`, an artificial tenant department check threw `403 Forbidden` (`{"detail": "Access denied"}`) whenever `tenant_department_id` did not match the teacher's department. Furthermore, if a teacher did not exist, it threw `403 Access denied` rather than a standard RESTful `404 Not Found`.
By contrast, timetable endpoints (`get_by_class` and `list_slots`) allow cross-department timetable queries for institutional scheduling and substitution planning.

```python
# Before (timetable_service.py lines 222-225):
if tenant_department_id is not None:
    teacher = db.query(User).filter(User.id == teacher_id).first()
    if not teacher or teacher.department_id != tenant_department_id:
        raise HTTPException(status_code=403, detail="Access denied")
```

### C. Client Service Contract Gap (`frontend/src/api/services.js`)
`timetableApi` lacked a `list: (params) => api.get('/timetable/', { params })` method corresponding to the generated OpenAPI spec endpoint `GET /timetable/`.

### D. Frontend State & Error Handling (`frontend/src/pages/admin/Timetable.jsx`)
1. **Unformatted Error Masking**: `loadSlots` caught errors and invoked `toast('Failed to load timetable', 'error')`, masking backend status codes (403, 422) and Pydantic validation messages.
2. **Missing Teacher ID Validation**: When switching departments or before initial selection, `selectedTeacherId` could be invalid or non-integer, sending `GET /timetable/teacher/undefined` which provoked a `422 Unprocessable Entity` validation crash.
3. **Restricted Department Filtering for Super Admins**: The department filter select and teacher filtering checked `!isSystemAdmin`, locking Super Admins out of viewing other department timetables.

---

## 3. Actual Failing Request & Response Captured

### Failing Request 1: Super Admin Accessing Cross-Department Teacher Timetable
- **Method**: `GET /timetable/teacher/36` (Teacher in Dept 2: Electrical Engineering)
- **User**: `CSHOD` (`id=6`, `role=admin`, `admin_level=super_admin`, `department_id=1`)
- **Status**: `403 Forbidden`
- **Response Body**:
```json
{
  "detail": "Access denied"
}
```

### Failing Request 2: Invalid/Undefined Teacher Param
- **Method**: `GET /timetable/teacher/undefined`
- **Status**: `422 Unprocessable Entity`
- **Response Body**:
```json
{
  "detail": [
    {
      "type": "int_parsing",
      "loc": ["path", "teacher_id"],
      "msg": "Input should be a valid integer, unable to parse string as an integer",
      "input": "undefined"
    }
  ]
}
```

---

## 4. Remediation & Implementation Details

### 1. Backend Dependency (`backend/app/core/dependencies.py`)
Updated `get_tenant_department_id` to include Super Admin (`admin_level == AdminLevel.super_admin`) in cross-department administrative access:
```python
def get_tenant_department_id(
    current_user: User = Depends(require_credentials_set),
    x_department_id: str | None = Header(None, alias="X-Department-ID")
) -> int | None:
    is_cross_dept_admin = (
        current_user.role in (Role.system_admin, Role.principal, Role.governance)
        or (current_user.role == Role.admin and getattr(current_user, "admin_level", None) == AdminLevel.super_admin)
        or (current_user.role == Role.manager and current_user.department_id is None)
    )
    if is_cross_dept_admin:
        if isinstance(x_department_id, (str, int)):
            try:
                return int(x_department_id)
            except (ValueError, TypeError):
                pass
        return None
    return current_user.department_id
```

### 2. Timetable Service (`backend/app/services/timetable_service.py`)
Removed artificial 403 on read and added proper 404 handling:
```python
def get_by_teacher(teacher_id: int, db: Session, tenant_department_id: int | None = None) -> list[TimetableSlot]:
    teacher = db.query(User).filter(User.id == teacher_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    return (
        db.query(TimetableSlot)
        .options(
            joinedload(TimetableSlot.subject),
            joinedload(TimetableSlot.class_),
            joinedload(TimetableSlot.room),
        )
        .filter(TimetableSlot.teacher_id == teacher_id)
        .order_by(TimetableSlot.day_order, TimetableSlot.period_number)
        .all()
    )
```

### 3. Client Contract Service (`frontend/src/api/services.js`)
Added `list` query method to `timetableApi`:
```javascript
export const timetableApi = {
  list: (params) => api.get('/timetable/', { params }),
  getByTeacher: (teacherId) => api.get(`/timetable/teacher/${teacherId}`),
  ...
}
```

### 4. Admin Timetable Page (`frontend/src/pages/admin/Timetable.jsx`)
- Imported and utilized `formatErrorMessage(err, 'Failed to load timetable')` for all toast errors.
- Guarded `loadSlots` to validate `Number.isInteger(Number(selectedTeacherId)) && Number(selectedTeacherId) > 0`.
- Destructured `isSuperAdmin` and computed `canManageAllDepartments = isSystemAdmin || isSuperAdmin`.
- Enabled department filtering for Super Admins across teacher selection and timetable reset modals.

---

## 5. Verification & Test Evidence

### A. Python Backend Unit & Integration Tests
Ran `pytest tests/test_core_dependencies.py tests/test_timetable_service.py -v`:
- `test_get_tenant_department_id_super_admin`: **PASSED**
- `test_get_tenant_department_id_secondary_admin`: **PASSED**
- `test_get_by_teacher_success`: **PASSED**
- `test_get_by_teacher_cross_department_allowed`: **PASSED**
- `test_get_by_teacher_not_found`: **PASSED**
- Total: **24/24 PASSED**

Full backend regression suite:
- Ran `pytest tests/ -q`: **657/657 PASSED** (0 failures).

### B. Live TestClient Verification against Active DB
Executed `GET /timetable/teacher/36` authenticated as Super Admin `CSHOD`:
```
HTTP Request: GET http://testserver/timetable/teacher/36 "HTTP/1.1 200 OK"
STATUS: 200
BODY: []
```
Executed `GET /timetable/teacher/999999` (non-existent):
```
HTTP Request: GET http://testserver/timetable/teacher/999999 "HTTP/1.1 404 Not Found"
STATUS: 404
BODY: {'detail': 'Teacher not found'}
```

### C. Frontend Build & Quality Gates
- `npm run typecheck`: **0 errors** (`tsc --noEmit` exit 0).
- `npm run test:unit`: **35/35 vitest unit tests passing**.
- `npm run build`: **0 errors** (vite production build built in 13.24s).

### D. Playwright Browser E2E Test (`frontend/e2e/timetable.spec.ts`)
- Navigated to `http://localhost:5173/admin/timetable` as Super Admin `CSHOD`.
- Verified page header `Timetable` is visible.
- Verified 0 `.tt-toast--error` notifications appear.
- Verified department select is enabled.
- Switched department to Electrical Engineering (`id=2`) and selected cross-department teacher Dr. Bob Jones (`id=36`).
- Verified timetable grid rendered slot card with subject code `EE201` and `1 slot assigned`.
- Result: **3/3 Playwright tests passing**.

### E. CI Contract Parity Gate
- `python scripts/generate_openapi.py --out openapi_generated.yaml`: **333 paths**.
- `python scripts/ci_contract_check.py`:
  - **Status: PASS**
  - **HIGH: 0**
  - **MEDIUM: 0**
