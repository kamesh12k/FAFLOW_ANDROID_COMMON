# Milestone 15: Legacy FAFLOW Parity & Subsystem Audit
## Source of Truth Cross-Platform Comparison Matrix

---

## 1. Feature Parity Matrix (Web, Android & Backend)

| Existing FAFLOW Feature | Web Application | Android Staff Mobile | FastAPI Backend Route | Access / RBAC Role | Parity Status |
|---|---|---|---|---|---|
| **User Authentication** | OAuth2 Password Form | Native JWT Bearer (`TokenManager`) | `POST /auth/login` | All Roles | **UNIFIED & PARITY VERIFIED** |
| **Faculty Dashboard** | Stats Cards & Schedule | Native Compose Stats Cards | `GET /teacher/dashboard` | `teacher`, `hod`, `principal`, `admin` | **UNIFIED & PARITY VERIFIED** |
| **Day Order Timetable** | 6-Day Weekly Matrix | Native Compose Daily Schedule | `GET /teacher/timetable` | `teacher`, `hod`, `principal`, `admin` | **UNIFIED & PARITY VERIFIED** |
| **Faculty Leave Application** | Period & Full-Day Forms | Native Apply Leave Flow | `POST /teacher/leave` | `teacher`, `hod` | **UNIFIED & PARITY VERIFIED** |
| **Leave Approval & History** | HOD/Principal Approval Table | Native Leave History & Cancellation | `GET /teacher/leave`, `GET /hod/leaves` | `teacher`, `hod`, `principal` | **UNIFIED & PARITY VERIFIED** |
| **Casual Leave & Duty Credits** | Workload Ledger | Native Credit Balance Ledger | `GET /teacher/credits` | `teacher`, `hod`, `principal`, `admin` | **UNIFIED & PARITY VERIFIED** |
| **Substitution Allocation** | Suggestion & Assignment Panel | Native Substitution Duty List | `GET /teacher/substitution`, `POST /substitutions/` | `teacher`, `hod`, `admin` | **UNIFIED & PARITY VERIFIED** |
| **Substitution Preferences** | Max Daily/Weekly Sliders | Native Preferences Screen | `GET /preferences/`, `PUT /preferences/` | `teacher`, `hod` | **UNIFIED & PARITY VERIFIED** |
| **Campus Geofence Management** | Web Polygon/Circle Editor | Native Canvas Geofence Screen | `GET /geofences/`, `POST /geofences/` | `admin`, `principal`, `hod`, `manager` | **UNIFIED & PARITY VERIFIED** |
| **Biometric Face Attendance** | Manual/Web Check-in fallback | FAFLOW SCRFD + ArcFace + Liveness | `POST /attendance/check-in`, `/check-out` | `teacher`, `staff`, `hod`, `principal` | **UNIFIED & PARITY VERIFIED** |
| **Supervisor Live Dashboard** | Admin Attendance Table | Real-time Live Status Query | `GET /attendance/admin/live-status` | `admin`, `principal`, `hod`, `manager` | **UNIFIED & PARITY VERIFIED** |
| **Institutional Notifications** | Notification Center | Push & Polled Notification Screen | `GET /notifications/`, `PUT /notifications/{id}/read` | All Roles | **UNIFIED & PARITY VERIFIED** |
| **Faculty Profile & Preferences** | Profile Settings | Native Profile Screen | `GET /teacher/profile` | All Roles | **UNIFIED & PARITY VERIFIED** |
| **Immutable Audit Logs** | Admin Audit Table | Server-Side Verification Telemetry | `GET /admin/audit-logs` | `admin`, `super_admin` | **UNIFIED & PARITY VERIFIED** |
