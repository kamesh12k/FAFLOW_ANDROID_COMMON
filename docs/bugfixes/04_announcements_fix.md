# Bug Fix Report: Phase 4 — Announcements & Circulars Module (Bug 5, 6a, 6b)

> **Milestone**: Bug Fixing & Production Hardening  
> **Phase**: 4 – Announcements & Circulars (P1 / P2)  
> **Bugs Addressed**: Bug 5, Bug 6a, Bug 6b  
> **Affected Routes**: `/announcements`, `/announcements/:id`  
> **Status**: RESOLVED & VERIFIED  

---

## 1. Executive Summary

Phase 4 addressed three interrelated defects within the FAFLOW Announcements & Circulars module (`/announcements`):

1. **Bug 5 (Target Audience Display)**: In circular detail views (`AnnouncementDetail.jsx`), the audience field rendered raw internal JSON token arrays (e.g. `["ROLE:TEACHER", "DEPT:1"]`) instead of human-readable institutional descriptions (e.g. `"Teachers, Department: Computer Science"` or `"Computer Science Department"`).
2. **Bug 6a (Acknowledgement Flow)**: Teachers attempting to formally acknowledge directives requiring acknowledgement experienced broken state transitions, lack of optimistic/reactive feedback, and raw unformatted backend error handling.
3. **Bug 6b (System Admin / College-Wide Privilege Scope)**: Elevated administrators (such as System Admins and Super Admins without departmental bounds) encountered permission blocks when attempting to author college-wide circulars or open the announcement composer with institution-wide broadcast scope.

All three bugs were systematically diagnosed, resolved at both the backend service and frontend component layers, and verified using unit tests (11/11 Vitest), backend integration tests (17/17 pytest), and end-to-end browser automation (3/3 Playwright tests).

---

## 2. Root Cause Analysis

### 2.1 Bug 5: Raw JSON Token Serialization in Audience UI (`AnnouncementDetail.jsx`)
- **Symptoms**: The directive detail modal rendered `["ROLE:TEACHER", "DEPT:1"]` or `["ROLE:ADMIN"]` directly into the DOM.
- **Root Cause**: `formatAudience` only handled trivial string literals (`"COLLEGE"`, `"DEPARTMENT"`, `"USER"`). When the backend stored complex target descriptors as serialized JSON arrays (e.g., `'["ROLE:TEACHER", "DEPT:1"]'`), the function failed to parse the JSON and fell back to returning `data.target_summary`, which displayed the raw JSON token string directly to the end user.
- **Remediation**: Implemented a comprehensive audience parsing and formatting engine (`formatAudience` + `formatSingleAudienceToken`) that:
  - Detects JSON strings and parses array or object targets.
  - Maps role identifiers (`ROLE:TEACHER`, `ROLE:ADMIN`, `ROLE:HOD`, `ROLE:STAFF`, etc.) to proper human titles (`Teachers`, `Administrators`, `Department Heads (HODs)`, `Staff`).
  - Resolves departmental tokens (`DEPT:<id>`) against structured target models, explicit response metadata (`department_name`), and institutional department registries.
  - Gracefully handles comma-separated strings, array inputs, and legacy single targets.

### 2.2 Bug 6a: Acknowledgement State & Error Handling (`AnnouncementDetail.jsx`)
- **Symptoms**: Teachers attempting to acknowledge directives did not receive immediate local state updates, causing the modal to remain in an ambiguous state until a full reload or failing silently if any network hiccup occurred.
- **Root Cause**: 
  - `handleAcknowledge` lacked debouncing and guard conditions against double-submitting while `acknowledging` was in-flight.
  - The component did not optimistically set `is_acknowledged: true` or update `can_acknowledge: false` prior to or immediately following the successful API call.
  - Error catching did not route through `formatErrorMessage` from `errorUtils.js`, causing raw error objects to display.
- **Remediation**: Hardened `handleAcknowledge` with state protection, immediate optimistic state update with current ISO timestamp, safe error formatting, and coordinated parent feed refresh.

### 2.3 Bug 6b: Backend Tenancy & College-Wide Permission Scope (`backend/app/services/announcement_service.py`, `AnnouncementComposerModal.jsx`)
- **Symptoms**: Elevated administrators without explicit department assignments (e.g., System Admins and Super Admins) were blocked by `validate_target_permissions` with `403 Access denied` or could not access college-wide target options in the composer modal.
- **Root Cause**:
  - `backend/app/services/announcement_service.py`: Permission checks checked `current_user.role in (Role.principal, Role.system_admin)` but omitted `current_user.role == Role.admin and current_user.department_id is None`. Additionally, HOD departmental checks did not cleanly bifurcate college-wide admins from department-scoped HODs.
  - `frontend/src/pages/announcements/AnnouncementComposerModal.jsx`: Checked `isPrincipal = user?.role === 'principal' || user?.role === 'system_admin'`, locking out institutional administrators without departmental bounds.
- **Remediation**:
  - Backend: Updated `validate_target_permissions`, `get_announcement_detail`, `get_conversation_messages`, `delete_message`, `toggle_pin_message`, `get_candidate_directory`, and `get_mention_candidates` to explicitly recognize college-wide admins (`role == Role.admin and department_id is None`) alongside Principals and System Admins.
  - Frontend: Defined `isInstitutionAdmin = isPrincipal || isSystemAdmin || (isAdmin && !department_id)`, unlocking the `"Entire Institution"` audience scope button and directory listings.

---

## 3. Code Modifications

### 3.1 Backend Service (`backend/app/services/announcement_service.py`)
```python
# Extended college-wide administrative privileges
if current_user.role in (Role.principal, Role.system_admin) or (
    current_user.role == Role.admin and current_user.department_id is None
):
    if t_type == "COLLEGE":
        return "COLLEGE", [], []
    elif t_type in ("DEPARTMENT", "MULTIPLE_DEPARTMENTS"):
        ...
```

### 3.2 Frontend Detail View (`frontend/src/pages/announcements/AnnouncementDetail.jsx`)
- Added `formatSingleAudienceToken` and comprehensive `formatAudience` export.
- Integrated `formatErrorMessage` across detail fetching and acknowledgement handlers.
- Optimistic state update upon successful `POST /announcements/:id/acknowledge`.

### 3.3 Frontend Composer (`frontend/src/pages/announcements/AnnouncementComposerModal.jsx`)
- Support for institutional administrators without department locks.
- Sanitized error toasts with `formatErrorMessage`.
- Formatted candidate fetching and department multi-selection.

### 3.4 Frontend Feed (`frontend/src/pages/announcements/AnnouncementFeed.jsx`)
- Defensive extraction for feed items supporting both array and nested paginated responses (`res.data` / `res.data.announcements`).
- Auto-opening newly created circulars in the detail view upon publication.

---

## 4. Verification & Testing Evidence

### 4.1 Vitest Unit Tests (`frontend/src/test/announcements.test.jsx`)
```
✓ src/test/announcements.test.jsx (11 tests)
  ✓ formats raw JSON array string ["ROLE:TEACHER", "DEPT:1"] cleanly
  ✓ formats raw array of tokens cleanly
  ✓ formats single role token
  ✓ formats multiple roles cleanly
  ✓ formats single department token with ID lookup
  ✓ uses department_name from data or targets when resolving department
  ✓ formats standard COLLEGE target summary
  ✓ formats standard DEPARTMENT target summary with department_name
  ✓ formats structured targets array with departments and users
  ✓ formats comma-separated token string
  ✓ handles null/undefined gracefully

Test Files  1 passed (1)
     Tests  11 passed (11)
```

### 4.2 Backend Pytest Suite (`backend/tests/`)
```
pytest tests/ -k announcement -v
17 passed, 640 deselected in 19.13s (100% PASS)
```

### 4.3 Playwright End-to-End Suite (`frontend/e2e/announcements.spec.ts`)
```
Running 3 tests using 1 worker

  ok 1 [chromium] › e2e\announcements.spec.ts:63:3 › Bug 5 – Audience renders as human-readable text, not raw JSON tokens (2.4s)
  ok 2 [chromium] › e2e\announcements.spec.ts:106:3 › Bug 6a – Teacher can view and acknowledge a circular requiring acknowledgement (1.6s)
  ok 3 [chromium] › e2e\announcements.spec.ts:144:3 › Bug 6b – System Admin sees "New Announcement" button and can open composer with college-wide scope (1.8s)

  3 passed (6.7s)
```

### 4.4 Full Regression Gate Verification
| Verification Gate | Command | Result |
|---|---|---|
| **TypeScript Typecheck** | `npm run typecheck` | **PASS** (0 errors) |
| **Frontend Unit Tests** | `npm run test:unit` | **PASS** (46/46 passed) |
| **All Bugfix E2E Tests** | `npx playwright test e2e/setup_guide.spec.ts e2e/timetable.spec.ts e2e/announcements.spec.ts` | **PASS** (6/6 passed) |
| **Production Build** | `npm run build` | **PASS** (582 modules transformed, 6.19s) |
| **Backend Announcement Tests** | `pytest tests/ -k announcement` | **PASS** (17/17 passed) |

---

## 5. Conclusion
Phase 4 (Bugs 5, 6a, 6b) is fully resolved, hardened, and verified.
- Target audience descriptions render human-readable, professional typography with zero leaked tokens or bracket strings.
- Teachers can seamlessly review and acknowledge formal institutional directives with immediate UI confirmation.
- College-wide administrators have full authority to broadcast institutional circulars with accurate scope selection.
