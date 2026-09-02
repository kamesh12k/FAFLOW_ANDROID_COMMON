# Milestone 17 — Complete FAFLOW Legacy Feature Inventory
## Canonical Forensics & Cross-Platform Inventory

### 1. Executive Summary
This document provides an exhaustive, machine-and-human-readable inventory of every capability discovered across the original FAFLOW web application (`FACULTY_FLOW`), FastAPI backend, PostgreSQL database models, and Android client within `B:\FAFLOW_UNIFIED`.

---

### 2. Discovered Feature Inventory

#### A. Authentication & Session Management (`AUTH`)
- **FEAT-AUTH-01: Identifier/Password Login**
  - **Module**: Authentication
  - **Original Web**: `/login`, `src/pages/auth/Login.jsx`
  - **Backend Route**: `POST /auth/login`
  - **Backend Service**: `app/services/auth_service.py::authenticate_user`
  - **Database Tables**: `users`
  - **Supported Roles**: `teacher`, `admin`, `principal`, `manager`, `system_admin`
  - **Permissions**: Public endpoint returning JWT Bearer token
  - **Unified Status**: FULL across Web, Backend, and Android (`LoginScreen.kt`)

- **FEAT-AUTH-02: Initial Password / Credential Reset Flow**
  - **Module**: Authentication
  - **Original Web**: `must_change_credentials` dialog in `App.jsx` & `Profile.jsx`
  - **Backend Route**: `POST /auth/change-credentials`
  - **Backend Service**: `app/services/auth_service.py`
  - **Database Tables**: `users.must_change_credentials`, `users.hashed_password`
  - **Unified Status**: FULL

- **FEAT-AUTH-03: Session Logout & Revocation**
  - **Module**: Authentication
  - **Original Web**: Navbar User Menu
  - **Backend Route**: Client token clearance + `POST /auth/logout`
  - **Unified Status**: FULL

---

#### B. Teacher Profile & Faculty Identity (`PROFILE`)
- **FEAT-PROF-01: View Profile & Department Details**
  - **Module**: Profile
  - **Original Web**: `src/pages/common/Profile.jsx`
  - **Backend Route**: `GET /auth/me`
  - **Database Tables**: `users`, `departments`
  - **Supported Roles**: All authenticated roles
  - **Unified Status**: FULL across Web and Android (`ProfileScreen.kt`)

- **FEAT-PROF-02: Change Password**
  - **Module**: Profile
  - **Original Web**: `src/pages/common/Profile.jsx`
  - **Backend Route**: `POST /auth/change-password`
  - **Database Tables**: `users`
  - **Unified Status**: FULL

---

#### C. Academic Calendar & Day Order (`CALENDAR`)
- **FEAT-CAL-01: Resolve Date to Day Order**
  - **Module**: Calendar
  - **Original Web**: `src/pages/admin/AcademicCalendar.jsx`
  - **Backend Route**: `GET /academic-calendar/resolve?date={date}`
  - **Backend Service**: `app/services/academic_calendar_service.py::resolve_date`
  - **Database Tables**: `academic_calendars`, `day_order_calendars`
  - **Unified Status**: FULL

- **FEAT-CAL-02: Daily Teacher Academic Summary**
  - **Module**: Calendar
  - **Original Web**: Faculty Dashboard Banner
  - **Backend Route**: `GET /academic-calendar/my-today-summary`
  - **Backend Service**: `app/services/academic_calendar_service.py::get_teacher_today_summary`
  - **Database Tables**: `academic_calendars`, `day_order_calendars`, `leaves`, `alter_assignments`
  - **Unified Status**: FULL across Web and Android (`TeacherTodaySummaryDto`, `DayOrderBadge.kt`)

---

#### D. Timetable Management (`TIMETABLE`)
- **FEAT-TT-01: Teacher Weekly Schedule**
  - **Module**: Timetable
  - **Original Web**: `/timetable`, `src/pages/teacher/Timetable.jsx`
  - **Backend Route**: `GET /timetable/teacher/{id}`
  - **Backend Service**: `app/services/timetable_service.py`
  - **Database Tables**: `timetable`, `subjects`, `classes`, `rooms`
  - **Supported Roles**: `teacher`, `admin`, `principal`
  - **Unified Status**: FULL across Web and Android (`TimetableScreen.kt`)

- **FEAT-TT-02: Classwise Timetable Matrix**
  - **Module**: Timetable
  - **Original Web**: `src/pages/admin/Timetable.jsx` (Class View)
  - **Backend Route**: `GET /timetable/?class_id={id}&day_order={do}`
  - **Backend Service**: `app/services/timetable_service.py`
  - **Database Tables**: `timetable`, `classes`
  - **Unified Status**: FULL across Web and Android (`ClasswiseTimetableScreen.kt`)

- **FEAT-TT-03: Department Timetable Matrix**
  - **Module**: Timetable
  - **Original Web**: `src/pages/admin/Timetable.jsx` (Dept View)
  - **Backend Route**: `GET /timetable/?department_id={id}&day_order={do}`
  - **Unified Status**: FULL across Web and Android (`ClasswiseTimetableScreen.kt`, `HodViewModel.kt`)

---

#### E. Leaves & Casual Leave Credits (`LEAVE`)
- **FEAT-LV-01: Apply Single Period Leave**
  - **Module**: Leaves
  - **Original Web**: `src/pages/teacher/ApplyLeave.jsx`
  - **Backend Route**: `POST /leaves/`
  - **Backend Service**: `app/services/leave_service.py::submit_leave`
  - **Database Tables**: `leaves`
  - **Unified Status**: FULL across Web and Android (`ApplyLeaveScreen.kt`)

- **FEAT-LV-02: Apply Batch / Whole-Day Leave**
  - **Module**: Leaves
  - **Original Web**: `src/pages/teacher/ApplyLeave.jsx` (Full Day Mode)
  - **Backend Route**: `POST /leaves/batch`
  - **Backend Service**: `app/services/leave_service.py::submit_leave_batch`
  - **Database Tables**: `leaves`
  - **Unified Status**: FULL across Web and Android (`ApplyLeaveScreen.kt`)

- **FEAT-LV-03: Leave History & Status Tracking**
  - **Module**: Leaves
  - **Original Web**: `src/pages/teacher/LeaveHistory.jsx`
  - **Backend Route**: `GET /leaves/my`
  - **Database Tables**: `leaves`, `alter_assignments`
  - **Unified Status**: FULL across Web and Android (`LeaveHistoryScreen.kt`)

- **FEAT-LV-04: Cancel Pending Leave**
  - **Module**: Leaves
  - **Original Web**: `src/pages/teacher/LeaveHistory.jsx` (Cancel Action)
  - **Backend Route**: `DELETE /leaves/{id}`
  - **Backend Service**: `app/services/leave_service.py::cancel_leave`
  - **Database Tables**: `leaves`, `alter_assignments`
  - **Unified Status**: FULL across Web and Android (`LeaveHistoryScreen.kt`)

- **FEAT-LV-05: Casual Leave Credit Balance & Transactions**
  - **Module**: Credits
  - **Original Web**: `src/pages/teacher/Credits.jsx`
  - **Backend Route**: `GET /teachers/{id}/credits`, `GET /credits/my/transactions`
  - **Backend Service**: `app/services/credit_service.py`
  - **Database Tables**: `credits`, `credit_transactions`
  - **Unified Status**: FULL across Web and Android (`CreditsScreen.kt`)

---

#### F. Substitution & Coverage Engine (`SUBSTITUTION`)
- **FEAT-SUB-01: Assigned Substitution Duties**
  - **Module**: Substitution
  - **Original Web**: `src/pages/teacher/Substitution.jsx`
  - **Backend Route**: `GET /teacher/substitution/my-duties`
  - **Backend Service**: `app/services/substitution_service.py`
  - **Database Tables**: `alter_assignments`, `leaves`, `timetable`
  - **Unified Status**: FULL across Web and Android (`SubstitutionScreen.kt`)

- **FEAT-SUB-02: Today's Slot Coverage & Substitute Status**
  - **Module**: Substitution
  - **Original Web**: `src/pages/admin/TodaySubstitutions.jsx`
  - **Backend Route**: `GET /substitutions/today`
  - **Backend Service**: `app/services/substitution_service.py::get_today_substitutions`
  - **Database Tables**: `leaves`, `alter_assignments`
  - **Unified Status**: FULL across Web and Android (`TodayCoverageScreen.kt`)

- **FEAT-SUB-03: Teacher Substitution Preferences**
  - **Module**: Substitution
  - **Original Web**: `src/pages/teacher/Preferences.jsx`
  - **Backend Route**: `GET /teacher/substitution/my-preferences`, `PUT /teacher/substitution/my-preferences`
  - **Backend Service**: `app/services/substitution_service.py`
  - **Database Tables**: `substitution_preferences`
  - **Unified Status**: FULL across Web and Android (`PreferencesScreen.kt`)

- **FEAT-SUB-04: Candidate Recommendation & Workload Scoring**
  - **Module**: Substitution
  - **Original Web**: `src/pages/teacher/Substitution.jsx` (ScoreBar & Workload Simulation)
  - **Backend Route**: `GET /substitutions/recommendations/{leave_id}`
  - **Backend Service**: `app/services/substitution_service.py::get_recommendations`
  - **Database Tables**: `timetable`, `leaves`, `alter_assignments`, `substitution_preferences`
  - **Unified Status**: FULL

---

#### G. HOD Department Administration (`HOD`)
- **FEAT-HOD-01: Department Overview Dashboard**
  - **Module**: HOD
  - **Original Web**: `src/pages/admin/Dashboard.jsx` (Secondary Admin Mode)
  - **Backend Route**: `GET /academic-calendar/my-today-summary`, `GET /leaves/`, `GET /teachers/`, `GET /attendance/admin/live-status`
  - **Database Tables**: `leaves`, `users`, `staff_attendance`
  - **Supported Roles**: `admin` (`secondary_admin`)
  - **Unified Status**: FULL across Web and Android (`HodDashboardScreen.kt`, `HodViewModel.kt`)

- **FEAT-HOD-02: Department Leave Review & Action (Approve/Reject)**
  - **Module**: HOD
  - **Original Web**: `src/pages/admin/Leaves.jsx`
  - **Backend Route**: `GET /leaves/`, `PATCH /leaves/{id}/approve`, `PATCH /leaves/{id}/reject`
  - **Backend Service**: `app/services/leave_service.py`
  - **Database Tables**: `leaves`
  - **Unified Status**: FULL across Web and Android (`HodLeaveApprovalScreen.kt`)

- **FEAT-HOD-03: Assign Substitute for Department Leave**
  - **Module**: HOD
  - **Original Web**: `src/pages/admin/Leaves.jsx` (Assign Modal)
  - **Backend Route**: `POST /leaves/{id}/assign`
  - **Backend Service**: `app/services/leave_service.py::assign_substitute`
  - **Database Tables**: `alter_assignments`
  - **Unified Status**: FULL across Web and Android (`AssignSubstituteDialog`)

- **FEAT-HOD-04: Department Faculty Directory**
  - **Module**: HOD
  - **Original Web**: `src/pages/admin/Teachers.jsx`
  - **Backend Route**: `GET /teachers/` (scoped by `get_tenant_department_id`)
  - **Backend Service**: `app/services/teacher_service.py`
  - **Database Tables**: `users`
  - **Unified Status**: FULL across Web and Android (`HodFacultyDirectoryScreen.kt`)

- **FEAT-HOD-05: Supervisor Live Attendance Status**
  - **Module**: Attendance / HOD
  - **Original Web**: `src/pages/admin/Attendance.jsx`
  - **Backend Route**: `GET /attendance/admin/live-status`
  - **Backend Service**: `app/services/attendance_service.py::get_supervisor_live_status`
  - **Database Tables**: `staff_attendance`, `users`
  - **Unified Status**: FULL across Web and Android (`HodAttendanceScreen.kt`)

---

#### H. Biometric Attendance Subsystem (`ATTENDANCE`)
- **FEAT-ATT-01: GPS Geofenced Check-In & Check-Out**
  - **Module**: Attendance
  - **Backend Route**: `POST /attendance/check-in`, `POST /attendance/check-out`
  - **Backend Service**: `app/services/attendance_service.py`
  - **Database Tables**: `staff_attendance`, `campus_geofences`
  - **Unified Status**: FULL across Web and Android (`AttendanceCheckInOutScreen.kt`)

- **FEAT-ATT-02: Active 3D Liveness & Anti-Spoofing**
  - **Module**: Biometrics
  - **Components**: `UmeyamaFaceAligner`, `ArcFaceEmbedder`, `ActiveLivenessDetector`, `ScrfdFaceDetector`
  - **Unified Status**: FULL in Android

- **FEAT-ATT-03: Offline Queue & Background Sync**
  - **Module**: Attendance Sync
  - **Components**: `PendingAttendanceEntity`, `PendingAttendanceDao`, `AttendanceSyncWorker`
  - **Unified Status**: FULL in Android

---

#### I. Face Enrollment Subsystem (`BIOMETRIC_ENROLLMENT`)
- **FEAT-FACE-01: Staff Face Biometric Enrollment**
  - **Module**: Face AI
  - **Backend Route**: `POST /attendance/enroll-face`
  - **Database Tables**: `users.face_embedding`
  - **Unified Status**: FULL in Android (`FaceEnrollmentScreen.kt`)

- **FEAT-FACE-02: Policy Gating for Face Enrollment**
  - **Module**: Governance / Security
  - **Backend Route**: `GET /system/institutions/{id}/policy`
  - **Database Tables**: `institution_policies`, `governance_controls`
  - **Unified Status**: FULL across Web and Android

---

#### J. Institutional Notifications (`NOTIF`)
- **FEAT-NTF-01: Notification Center & Unread Count**
  - **Module**: Notifications
  - **Backend Route**: `GET /notifications/`, `GET /notifications/unread-count`, `PATCH /notifications/{id}/read`
  - **Database Tables**: `notifications`
  - **Unified Status**: FULL across Web and Android (`NotificationsScreen.kt`)
