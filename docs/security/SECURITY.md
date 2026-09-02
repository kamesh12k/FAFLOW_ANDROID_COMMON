# FAFLOW — Security Hardening Specification

## 1. Security Baseline & Governance

FAFLOW employs a multi-tiered defense-in-depth security model to safeguard institutional records, faculty credentials, and departmental isolation.

---

## 2. Authentication & Credential Policy

1. **Password Hashing**:
   - Industry-standard `bcrypt` algorithm (12 rounds) with salt generation.
   - Enforced complexity validation: minimum 8 characters, requiring at least one letter and one number.
   - Blocked default password re-use (`changeme`, `admin`, `password`).

2. **Access Tokens (JWT)**:
   - JSON Web Tokens signed using HMAC-SHA256 (`HS256`).
   - Short-lived token lifespans with user status verification (`is_active == True`) on every authenticated request.
   - Mandatory credential rotation policy: users with `must_change_credentials == True` are strictly restricted from accessing domain endpoints until first-time password rotation is completed (`/first-login-setup`).

---

## 3. Role-Based Access Control (RBAC) & Tenant Isolation

- **Role Hierarchy**:
  - `system_admin`: Full institution oversight, department management, global settings, factory reset, audit logs.
  - `admin` (HOD / Secondary Admin): Scoped strictly to their designated `department_id`.
  - `principal`: Read-only college-wide visibility (all mutation endpoints return `403 Forbidden`).
  - `teacher`: Self-service portal (personal timetable, leave applications, substitution delegation, credit ledger).
  - `manager` & `staff`: Scoped operational staff workflows.
  - `governance`: Command center emergency audits.

- **Data Isolation Guarantee**:
  - Department scoping is enforced at the database query layer (`User.department_id == tenant_department_id`).
  - `X-Department-ID` header is strictly ignored for Teacher and HOD accounts, preventing unauthorized horizontal privilege escalation (IDOR).

---

## 4. API Hardening & Error Sanitization

- **Rate Limiting**: `slowapi` token-bucket rate limiting protecting login endpoints and high-volume requests.
- **Error Response Sanitization**: Global exception handlers sanitize server errors into structured JSON with a unique `request_id` correlation token. Internal SQL statements, Python tracebacks, and database connection strings are never leaked to clients.
- **Request Tracing**: Every inbound request is assigned an `X-Request-ID` header returned to the client and recorded in server logs for complete audit traceability.
