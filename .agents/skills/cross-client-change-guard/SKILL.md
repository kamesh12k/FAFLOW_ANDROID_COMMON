---
name: cross-client-change-guard
description: Use this skill when modifying or auditing any mobile (Android) client workflow, screen, or model to verify that its business logic, validation rules, error handling, role permissions, and API contract strictly adhere to the canonical Web frontend implementation.
---

# Cross-Client Change Guard

## Goal
Ensure that the mobile client (Android) remains in strict lockstep with the canonical Web frontend (rontend/src/**). The Web frontend is the single source of truth for all business logic, validation rules, error messaging, and role behaviors across the entire role matrix. Mobile clients must faithfully reproduce Web behavior rather than inventing independent interpretations.

## Instructions
1. **Identify the Canonical Web Reference**:
   - For every mobile file, screen, ViewModel, or workflow being created or modified, locate its exact counterpart in the Web application (rontend/src/pages/teacher/*.jsx, rontend/src/pages/common/*.jsx, and HOD-accessible admin pages under rontend/src/pages/admin/*.jsx).
2. **Perform Multi-Dimensional Parity Comparison**:
   - **Role Boundaries & Access**: Verify that only authorized roles (	eacher and HOD with dmin_level=secondary_admin on mobile) can access the workflow, matching Web navigation and route gating.
   - **Validation Rules & Constraints**: Check required fields, date range rules, allowable values, boundary conditions, and inline warnings against Web's form validation logic.
   - **API Payload & Sequencing**: Verify that HTTP endpoints called, query parameters, request bodies, and error response interpretations match what Web's services (rontend/src/api/services.js) send and receive.
   - **Edge Cases & Failure Handling**: Verify non-working day exclusions, conflict detection, partial failure handling, and idempotent retry semantics match Web's behavior.
3. **Enforce Precedence Rules**:
   - **Web Wins**: Where Android differs from Web without an explicit, approved mobile UX adaptation, align Android to match Web.
   - **Web Bug Protocol**: If Web itself contains an unambiguous defect, do NOT copy the defect into Android. Log it as a Web-side defect with root cause analysis and request approval before modifying Web code (due to cross-role blast radius).
   - **Backend Root Cause**: If an endpoint behaves incorrectly for both clients, verify against backend router/service logic and report as a backend defect.
4. **Per-File Audit & Verification**:
   - When reviewing changes, evaluate each changed file individually against its Web counterpart and declare parity status (MATCH, ADAPTED-MOBILE-UX, or DIVERGENT).

## Constraints
- Never invent mobile-specific business rules or validation shortcuts that contradict Web's behavior.
- Never weaken security, permission checks, or timing constraints on mobile.
- Always document cross-client parity findings with specific file citations on both Web and mobile sides.
