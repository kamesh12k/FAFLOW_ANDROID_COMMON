# Phase 1: Crash Fixes (P0) Report

**Date:** September 29, 2026  
**Branch:** `fix/bug-report-20260929`  
**Engineer:** Antigravity QA & Debugging Team  
**Status:** Completed & Verified  

---

## 1. Overview & Executive Summary

During Phase 1 (P0 Crash Fixes), two critical runtime crashes were addressed to stabilize the production application:
1. **Bug 1 (`/teacher/leave/apply`)**: A missing import caused a fatal `ReferenceError: AlertTriangleIcon is not defined`, crashing the entire page during policy violation warnings.
2. **Bug 4 (`/teacher/student-attendance` and system-wide)**: FastAPI / Pydantic V2 returns 422 HTTP validation errors structured as an array of error objects:
   ```json
   {
     "detail": [
       { "type": "string_type", "loc": ["body", "date"], "msg": "Field required", "input": null }
     ]
   }
   ```
   When component error handlers set `setError(err.response?.data?.detail)`, React attempted to render the array of raw objects directly (`{error}`), triggering React's fatal minified Error #31 (`Objects are not valid as a React child`).

Rather than patching single call sites, we implemented a **systemic defense-in-depth architecture**:
- Created a centralized error-sanitizing engine (`errorUtils.js`).
- Integrated error-sanitizing into `client.js` (`getApiErrorMessage`) and `useApiError.js`.
- Hardened all shared UI display components (`ErrorAlert`, `Input`, `Select`, `Textarea`).
- Upgraded `ErrorBoundary.jsx` with an inline recovery mode and applied it at route-level and inside `AppShell` `<Outlet />`.
- Fixed every direct `{error}` render across 21 pages and components.

---

## 2. Root Cause Analysis

### Bug 1: ReferenceError in `ApplyLeave.jsx`
- **Location**: `frontend/src/pages/teacher/ApplyLeave.jsx` (lines 1554 and 1562).
- **Trigger**: When a teacher selected a leave date with an active policy conflict or warning, the UI attempted to render `<AlertTriangleIcon />`.
- **Root Cause**: The icon component `AlertTriangleIcon` was imported neither locally nor from `components/icons`. Because no error boundary was scoped to this route, the unhandled JavaScript `ReferenceError` unmounted the entire React component tree, producing a blank white page for the user.

### Bug 4: React Minified Error #31
- **Location**: `frontend/src/pages/teacher/StudentAttendance.jsx` and 20 other pages.
- **Trigger**: Any API endpoint rejecting user input with HTTP 422 (Unprocessable Entity).
- **Root Cause**: Under FastAPI and Pydantic V2, validation errors are formatted as:
  ```json
  [
    {
      "type": "missing",
      "loc": ["body", "period_number"],
      "msg": "Field required",
      "input": null,
      "ctx": {}
    }
  ]
  ```
  Components previously executed:
  ```js
  .catch(err => setError(err.response?.data?.detail || 'Fallback'))
  ```
  which set state `error` to an `Array<Object>`. In JSX:
  ```jsx
  {error && <div ...>{error}</div>}
  ```
  React 18 throws `Error: Objects are not valid as a React child (found: object with keys {type, loc, msg, input, ctx}). If you meant to render a collection of children, use an array instead.`

---

## 3. Remediation & Architecture

### A. Centralized Error Sanitizer (`frontend/src/utils/errorUtils.js`)
Created a standalone, zero-dependency formatter that handles all possible JavaScript and backend error shapes:
- **String values**: Cleaned and trimmed; returns non-empty string or fallback.
- **FastAPI / Pydantic V2 422 lists**: Extracts each error item, filters out transport prefixes (`body`, `query`, `path`), formats location and human-readable message (`"field: message"`), and joins multiple violations with `; `.
- **Axios error objects**: Automatically inspects `response.data.detail`, `response.data.message`, `response.data.error`.
- **Standard `Error` instances**: Safely extracts `err.message`.
- **Nested error objects**: Recursively unfolds nested errors.
- **Arbitrary objects & Circular references**: Safely serializes with `JSON.stringify` inside `try...catch` with automatic fallback to prevent secondary crashes.
- **Guaranteed Output**: Output is strictly a primitive `string` — never an `Object`, `Array`, `undefined`, or `Symbol`.

### B. Route-Level & Shell-Level Error Boundary
- **`ErrorBoundary.jsx`**: Enhanced with an `inline` prop, custom heading/title, and an interactive "Try Again" retry action with light institutional theme styling.
- **`App.jsx`**: Scoped route `/teacher/leave/apply` with:
  ```jsx
  <ErrorBoundary inline title="Apply Leave">
    <ApplyLeave />
  </ErrorBoundary>
  ```
- **`AppShell.jsx`**: Wrapped `<Outlet />` with `<ErrorBoundary inline title="Section Error">` to ensure that even if any unanticipated runtime error occurs on an internal view, the sidebar, top navbar, and user session remain completely intact.

### C. Systemic AST Audit & Sanitization Across All 21 Pages
Replaced every direct unformatted error assignment and JSX rendering across:
1. `frontend/src/pages/teacher/ApplyLeave.jsx` (Imported `AlertTriangleIcon` & sanitized catch handler)
2. `frontend/src/pages/teacher/StudentAttendance.jsx` (Sanitized alert banner & 5 catch handlers)
3. `frontend/src/pages/teacher/LeaveHistory.jsx`
4. `frontend/src/pages/teacher/TimetableView.jsx`
5. `frontend/src/pages/staff/Dashboard.jsx`
6. `frontend/src/pages/staff/Leaves.jsx`
7. `frontend/src/pages/admin/Attendance.jsx`
8. `frontend/src/pages/admin/CampusStructureBuilder.jsx`
9. `frontend/src/pages/admin/GovernanceRules.jsx`
10. `frontend/src/pages/admin/HodStudentAttendance.jsx`
11. `frontend/src/pages/admin/Leaves.jsx`
12. `frontend/src/pages/admin/Managers.jsx`
13. `frontend/src/pages/admin/PrincipalDashboard.jsx`
14. `frontend/src/pages/admin/PrincipalStudentAttendance.jsx`
15. `frontend/src/pages/admin/SetupGuide.jsx`
16. `frontend/src/pages/announcements/AnnouncementFeed.jsx`
17. `frontend/src/pages/auth/Login.jsx`
18. `frontend/src/pages/manager/Dashboard.jsx`
19. `frontend/src/pages/manager/LabStaff.jsx`
20. `frontend/src/pages/manager/NonTeachingStaff.jsx`
21. `frontend/src/pages/manager/StaffDirectory.jsx`
22. `frontend/src/pages/manager/StaffLeaves.jsx`

---

## 4. Test Verification & Evidence

### Frontend Unit & Regression Tests (`vitest`)
Ran all 3 test suites containing 35 automated tests:
- `src/utils/errorUtils.test.js`: 12/12 passed (edge cases, circular objects, Pydantic arrays, Axios responses).
- `src/components/ui/ui-components.test.jsx`: 19/19 passed.
- `src/test/crashFixes.test.jsx`: 4/4 passed.
  - Asserted `AlertTriangleIcon` is exported and renders SVG icon.
  - Asserted `ApplyLeave` renders without throwing `ReferenceError`.
  - Asserted `ErrorBoundary` prevents screen blanking when children throw errors.
  - Asserted `StudentAttendance` cleanly renders Pydantic 422 validation errors without crashing React.

### Frontend TypeScript & Build Gates
- `npm run typecheck`: **0 errors (Pass)**
- `npm run build`: **0 errors (Pass in 8.86s)**

---

## 5. Summary Table

| Issue | File | Root Cause | Fix Applied | Result |
|---|---|---|---|---|
| **Bug 1 (P0)** | `frontend/src/pages/teacher/ApplyLeave.jsx` | Missing `AlertTriangleIcon` import | Imported from `components/icons`; wrapped route with `ErrorBoundary` | Page renders cleanly with zero reference errors |
| **Bug 4 (P0)** | `frontend/src/pages/teacher/StudentAttendance.jsx` + 21 files | FastAPI 422 Pydantic objects rendered as React children | Built `formatErrorMessage` helper and sanitized all 21 components | 100% elimination of React minified error #31 |
