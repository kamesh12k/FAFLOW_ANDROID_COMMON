# FAFLOW Integration & Architecture Specification

**Document Version:** 1.0.0-PROD  
**Target Repository:** [`https://github.com/kamesh12k/FACULTY_FLOW.git`](https://github.com/kamesh12k/FACULTY_FLOW.git)  
**System Role:** Main Android Application for the FAFLOW Academic & Attendance Ecosystem

---

## 1. Executive Summary & Core Principle

> [!IMPORTANT]
> **Single Unified Ecosystem**: The Android application is **the official mobile client for FAFLOW**, not a disconnected side project. The existing FAFLOW FastAPI backend and PostgreSQL database remain the single authoritative source of truth for:
> - User authentication & tokens (JWT)
> - Faculty profiles & Department scoping
> - Classes, Semesters & Rooms
> - Day Order calendar rotation (Day Orders 1–6)
> - Timetable slots & Period schedules (Periods 1–5)
> - Leave requests, Substitutions & Credit balances
> - **Student Records & Biometric Face Attendance Sessions**

---

## 2. FAFLOW Backend & System Architecture

```
                                  +-------------------------------------------------------------+
                                  |                     FAFLOW BACKEND                          |
                                  |           (FastAPI + PostgreSQL + SQLAlchemy)               |
                                  +-------------------------------------------------------------+
                                     /            |                  |               \
                                    /             |                  |                \
        +----------------------------+   +-------------------+  +---------------+   +-----------------------+
        | Auth & RBAC Domain         |   | Timetable Domain  |  | Leave/Credits |   | Facial Attendance     |
        | - /auth/login              |   | - TimetableSlot   |  | - LeaveRequest|   | (NEW EXTENSION)       |
        | - /teachers/me             |   | - DayOrderCalendar|  | - AlterAssign |   | - Student Registry    |
        | - /departments             |   | - Periods 1-5     |  | - CreditLedger|   | - FaceProfile ONNX    |
        +----------------------------+   +-------------------+  +---------------+   | - AttendanceSession   |
                                                                                    | - AttendanceRecord    |
                                                                                    +-----------------------+
                                                                                                ^
                                                                                                | HTTPS / JWT
                                                                                                v
+-----------------------------------------------------------------------------------------------------------------------+
|                                             FAFLOW ANDROID APPLICATION                                                |
|                                                                                                                       |
|  +------------------------------------------------------+   +------------------------------------------------------+  |
|  |                 FAFLOW CORE MODULES                  |   |            FACIAL ATTENDANCE AI MODULE               |  |
|  | - Teacher Auth & JWT Session Storage                 |   | - CameraX Preview & Frame Throttling (8-10 FPS)      |  |
|  | - Daily Timetable (Day Order 1-6 / Periods 1-5)       |   | - InsightFace SCRFD ONNX Detector + 5-pt Landmarks   |  |
|  | - Leave Applications & Emergency Leave               |   | - Umeyama 5-Point Affine Warp Aligner (112x112)      |  |
|  | - Teacher Substitution Delegation & Lock             |   | - ArcFace MobileFaceNet ONNX Embedder (512-dim)      |  |
|  | - Credit Balance Dashboard (+1 / -1 Ledger)          |   | - Liveness / Anti-Spoofing Verification              |  |
|  | - Department Notices & Push Notifications            |   | - Multi-Student Attendance Marking Engine            |  |
|  +------------------------------------------------------+   +------------------------------------------------------+  |
|                                            \                     /                                                    |
|                                             v                   v                                                     |
|                                   +-----------------------------------------------+                                   |
|                                   |  Offline-First Room DB & WorkManager SyncQ    |                                   |
|                                   +-----------------------------------------------+                                   |
+-----------------------------------------------------------------------------------------------------------------------+
```

---

## 3. Database Schema & Data Model

### Existing FAFLOW Tables (Reused Directly)
1. **`users`**: Teachers, Department Admins (HODs), Principals, Managers, Governance.
   - `id`, `name`, `email` (teacher identifier), `username` (admin identifier), `password_hash`, `role` (`teacher`, `admin`, `principal`, `manager`), `department_id`, `is_active`.
2. **`departments`**: `id`, `name`, `code` (e.g., `CS`, `IT`, `ME`).
3. **`classes`**: `id`, `name` (e.g., `III B.Sc CS`), `section` (`A`/`B`), `department_id`, `semester` (1–8), `default_room_id`.
4. **`rooms`**: `id`, `room_number`, `building`, `capacity`, `type` (`classroom`/`lab`).
5. **`subjects`**: `id`, `name`, `code`, `department_id`, `semester`, `is_lab`, `credits`.
6. **`timetable_slots`**: `id`, `teacher_id`, `subject_id`, `class_id`, `room_id`, `day_order` (1–6), `period_number` (1–5).
7. **`day_order_calendar` / `calendar_days`**: `date`, `day_order` (1–6), `is_working_day`, `is_holiday`, `is_exam_day`.
8. **`leave_requests`**: `id`, `teacher_id`, `date`, `day_order`, `period_number`, `reason`, `status`, `is_emergency`, `batch_id`.
9. **`alter_assignments`**: `id`, `leave_request_id`, `substitute_teacher_id`, `assignment_type`, `compatibility_score`, `is_locked`.
10. **`teacher_credits` & `credit_transactions`**: `teacher_id`, `balance`, `change` ($+1/-1$), `category`, `reason`.

### New Facial Attendance Tables Added to Backend
11. **`students`**:
    - `id`: `Integer` (PK, auto-increment)
    - `roll_number`: `String(50)` (Unique index, e.g., `21CS042`)
    - `name`: `String(100)` (Student full name)
    - `class_id`: `Integer` (FK to `classes.id`)
    - `department_id`: `Integer` (FK to `departments.id`)
    - `email`: `String(150)` (Nullable)
    - `is_active`: `Boolean` (Default `True`)
    - `created_at`: `DateTime`
12. **`student_face_profiles`**:
    - `id`: `Integer` (PK)
    - `student_id`: `Integer` (FK to `students.id`, unique index)
    - `embedding`: `JSONB` / `ARRAY(Float)` / `LargeBinary` (512-dimensional vector)
    - `model_name`: `String(50)` (e.g., `InsightFace_ArcFace_MobileFaceNet`)
    - `model_version`: `String(20)` (e.g., `w600k_mbf_v1`)
    - `quality_score`: `Float` (e.g., `0.94`)
    - `is_active`: `Boolean` (Default `True`)
    - `updated_at`: `DateTime`
13. **`attendance_sessions`**:
    - `id`: `UUID` / `String(50)` (PK)
    - `timetable_slot_id`: `Integer` (FK to `timetable_slots.id`, nullable for ad-hoc)
    - `class_id`: `Integer` (FK to `classes.id`)
    - `teacher_id`: `Integer` (FK to `users.id` — teacher who took attendance)
    - `subject_id`: `Integer` (FK to `subjects.id`)
    - `date`: `Date`
    - `day_order`: `Integer` (1–6)
    - `period_number`: `Integer` (1–5)
    - `started_at`: `DateTime`
    - `ended_at`: `DateTime`
    - `status`: `Enum('active', 'completed', 'cancelled')`
14. **`attendance_records`**:
    - `id`: `UUID` / `String(50)` (PK)
    - `session_id`: `UUID` / `String(50)` (FK to `attendance_sessions.id`)
    - `student_id`: `Integer` (FK to `students.id`)
    - `timestamp`: `DateTime`
    - `status`: `Enum('present', 'absent', 'late', 'rejected')`
    - `recognition_score`: `Float` (Cosine similarity, e.g., `0.982`)
    - `liveness_score`: `Float` (Anti-spoof score, e.g., `0.995`)
    - `liveness_status`: `Enum('verified', 'suspicious', 'spoof_detected')`
    - `device_id`: `String(100)`
    - `idempotency_key`: `String(100)` (Unique constraint to prevent duplicate sync)

---

## 4. Authentication Flow
- **Endpoint**: `POST /auth/login`
- **Identifier**: Teachers use `email` (e.g., `kamesh@institution.edu`), Admins use `username`.
- **Response**: JWT Token containing `sub` (user email/username), `role` (`teacher`/`admin`), and standard expiry.
- **Android Integration**: Token is stored in hardware-encrypted SharedPreferences (`EncryptedSharedPreferences`). An `AuthInterceptor` attaches `Authorization: Bearer <token>` to all Retrofit requests.
- **Profile Endpoint**: `GET /teachers/me` returns the authenticated teacher's details, department ID, active roles, and credit balance.

---

## 5. Existing FAFLOW API Endpoints (Direct Reuse in Android)

| Feature Area | Endpoint | Method | Role Required | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Auth** | `/auth/login` | `POST` | Public | Teacher / Admin login |
| **Teacher Profile** | `/teachers/me` | `GET` | `teacher` | Current teacher info & department |
| **Credits** | `/teachers/{id}/credits` | `GET` | `teacher` / `admin` | Current credit balance |
| **Timetable** | `/timetable/teacher/{id}` | `GET` | `teacher` / `admin` | Full 6-day rotation timetable |
| **Class Timetable** | `/timetable/class/{id}` | `GET` | Any Auth | Timetable for specific class |
| **Day Order** | `/academic-calendar/today` | `GET` | Any Auth | Today's Day Order (1–6) & status |
| **Leaves** | `/leaves/my` | `GET` | `teacher` | List teacher's leave requests |
| **Apply Leave** | `/leaves/apply` | `POST` | `teacher` | Submit period/day leave request |
| **Substitutions** | `/teacher/substitution/my-leaves` | `GET` | `teacher` | Teacher's leaves with substitute assignments |
| **Candidates** | `/teacher/substitution/leave/{id}/candidates`| `GET` | `teacher` | Recommended substitutes for a period |
| **Assign Sub** | `/teacher/substitution/leave/{id}/assign/{sub_id}` | `POST` | `teacher` | Self-delegate a class substitute |

---

## 6. Teacher Academic & Operational Flow in the Android App

```
1. Teacher Logs In (JWT obtained)
       ↓
2. App fetches /academic-calendar/today (Determines today is Day Order 3)
       ↓
3. App queries /timetable/teacher/{me.id} (Filters slots where day_order == 3)
       ↓
4. Dashboard displays Today's Schedule:
   - Period 1 (09:00 - 09:50): III B.Sc CS (Sub: Deep Learning, Room 302) -> [ TAKE ATTENDANCE ]
   - Period 2 (09:50 - 10:40): Free Period
   - Period 3 (10:55 - 11:45): II B.Sc CS (Sub: Operating Systems, Room 204) -> [ TAKE ATTENDANCE ]
   - Period 4 (11:45 - 12:35): Substitute Duty for Prof. Raman (I M.Sc CS) -> [ TAKE ATTENDANCE ]
   - Period 5 (01:30 - 02:20): Lab Session
       ↓
5. Teacher taps [ TAKE ATTENDANCE ] on Period 1
       ↓
6. App fetches class enrolled student profiles (cached in Room)
       ↓
7. CameraX + InsightFace runs real-time multi-face scanning & anti-spoofing
       ↓
8. Real-time checklist updates (Arun: ✓, Priya: ✓, Kamesh: ✓)
       ↓
9. Teacher taps [ Submit Attendance ] -> Recorded in Room DB + Synced to Backend
```

---

## 7. New Facial Attendance API Endpoints for FAFLOW Backend

```python
# 1. Students Management
POST   /api/v1/students                  # Create student (Admin)
GET    /api/v1/students?class_id={id}    # List students in a class
GET    /api/v1/students/{id}             # Get student details

# 2. Biometric Face Profiles
POST   /api/v1/students/{id}/face        # Enroll 512-dim embedding + metadata
GET    /api/v1/students/{id}/face        # Fetch embedding vector
GET    /api/v1/classes/{id}/face-profiles # Bulk fetch all embeddings for a class (cached locally on Android)
DELETE /api/v1/students/{id}/face        # Delete biometric profile (privacy compliance)

# 3. Attendance Sessions & Records
POST   /api/v1/attendance/sessions       # Start attendance session
GET    /api/v1/attendance/sessions/{id}  # Get session details & report
POST   /api/v1/attendance/records/sync   # Bulk submit attendance records (idempotent)
GET    /api/v1/attendance/class/{id}/summary # Class-wise attendance percentage report
```

---

## 8. Mapping FAFLOW Students $\longleftrightarrow$ InsightFace Biometrics

$$\begin{matrix}
\textbf{FAFLOW Student Record} & \longleftrightarrow & \textbf{Biometric Face Profile} \\
\hline
\text{ID: } 42 & & \text{student\_id: } 42 \\
\text{Roll: } \text{"21CS042"} & & \text{embedding: } [\text{Float}_0, \text{Float}_1, \dots, \text{Float}_{511}] \\
\text{Name: } \text{"Arun Kumar"} & & \text{model\_name: } \text{"InsightFace\_ArcFace\_MobileFaceNet"} \\
\text{Class: } \text{"III B.Sc CS (Sec A)"} & & \text{model\_version: } \text{"w600k\_mbf\_v1"} \\
\text{Dept: } \text{"Computer Science"} & & \text{liveness\_verified: } \text{True}
\end{matrix}$$

---

## 9. Offline & Caching Architecture (Room + WorkManager)

```
[ ONLINE SYNC (Morning) ]
Teacher opens app → Downloads all student embeddings for their classes into Room DB
       ↓
[ OFFLINE CLASSROOM (Zero Internet) ]
Teacher opens CameraX in classroom
InsightFace runs 100% on-device (ONNX Runtime Mobile)
Attendance marks stored locally in Room DB:
   - AttendanceRecord(status=PRESENT, syncStatus=PENDING, idempotencyKey=UUID)
       ↓
[ CONNECTIVITY RESTORED ]
WorkManager triggers SyncWorker with ExponentialBackoff
Sends POST /api/v1/attendance/records/sync
Server validates idempotencyKey and marks records synchronized
```

---

## 10. Security & Biometric Privacy Safeguards
1. **Raw Images Never Stored**: Android captures frames, computes 512-dim floating-point embeddings in memory, and immediately recycles the raw image bitmap.
2. **Encrypted Storage**: Embeddings and tokens stored in Room and SharedPreferences use Android Keystore with AES-256-GCM.
3. **Audit Trail**: Every attendance session records `teacher_id`, `device_id`, timestamp, and recognition confidence scores in backend audit logs.
4. **Idempotency Safeguard**: Unique constraint on `(session_id, student_id)` and `idempotency_key` prevents double-marking or replay attacks.

---

## 11. Conclusion & Next Steps
FAFLOW integration architecture is fully mapped with zero disruption to the existing backend. All entities, API endpoints, day order rotations, timetable slots, and credit rules are preserved.

**Ready for Milestone 2: CameraX Integration & Live Frame Pipeline.**
