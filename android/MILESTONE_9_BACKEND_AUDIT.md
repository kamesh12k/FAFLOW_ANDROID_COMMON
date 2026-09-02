# Milestone 9 Backend & Architecture Audit: FAFLOW Staff Attendance Integration

## 1. Existing System & Architecture Summary
- **Primary Backend**: FastAPI + PostgreSQL (`https://github.com/kamesh12k/FACULTY_FLOW.git`).
- **Target User Hierarchy**: Faculty & Staff members (Teachers, HODs, Lab Technicians, Non-Teaching Staff, Principals, Managers). **No student entities exist or are involved.**
- **Authentication**: JWT Bearer token authentication via OAuth2 password flow (`/auth/token`). Token carries `sub` (username/staff ID) and institutional role.
- **Geofence Infrastructure**: Milestone 4 established `campus_geofences` table in PostgreSQL, supporting circular and polygonal boundary definitions (`GeoJSON` geometry with tolerance margins).
- **On-Device Biometric Verification**: Milestones 5–8 established front-camera CameraX, InsightFace SCRFD 500M face detection, 5-point Umeyama canonical alignment, ArcFace 512-D embedding extraction, and multi-layer presentation attack defenses (temporal motion, 3D head-pose estimation, randomized interactive challenge-response).

---

## 2. Existing Database & Entity Conventions
- **Database Engine**: PostgreSQL with SQLAlchemy ORM.
- **User Identity**: `users` table (`id`, `username`, `name`, `email`, `role`, `department_id`, `is_active`).
- **Timetable & Academic Model**: `timetable_slots`, `academic_calendar`, `day_order_calendars`.
- **Leave & Workload**: `leaves`, `staff_leaves`, `credit_transactions`, `substitution_preferences`.
- **Campus Geofencing**: `campus_geofences` (`id`, `name`, `type`, `center_latitude`, `center_longitude`, `radius_meters`, `geometry`, `tolerance_meters`, `is_active`).

---

## 3. Required Attendance Entities
To integrate on-device verification with authoritative institutional recording, the backend introduces the normalized `staff_attendance_records` table:

```sql
CREATE TABLE staff_attendance_records (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    check_in_time TIMESTAMP WITH TIME ZONE,
    check_out_time TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'PRESENT',
    
    check_in_latitude FLOAT,
    check_in_longitude FLOAT,
    check_in_accuracy FLOAT,
    check_in_geofence_id INTEGER REFERENCES campus_geofences(id) ON DELETE SET NULL,
    
    check_out_latitude FLOAT,
    check_out_longitude FLOAT,
    check_out_accuracy FLOAT,
    check_out_geofence_id INTEGER REFERENCES campus_geofences(id) ON DELETE SET NULL,
    
    face_similarity_score FLOAT,
    liveness_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verification_method VARCHAR(50) NOT NULL DEFAULT 'FACE_ON_DEVICE',
    
    idempotency_key VARCHAR(64) UNIQUE,
    device_reference VARCHAR(100),
    sync_source VARCHAR(20) NOT NULL DEFAULT 'DIRECT',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_staff_attendance_user_date ON staff_attendance_records(user_id, attendance_date);
CREATE INDEX idx_staff_attendance_idempotency ON staff_attendance_records(idempotency_key);
```

---

## 4. API Route Conventions
Following existing FastAPI REST conventions in `app/routes/`:
- `POST /attendance/check-in` — Validates staff JWT, server-side geofence, accuracy, face verification score, idempotency, and records check-in.
- `POST /attendance/check-out` — Validates prior check-in for the day, server-side geofence, idempotency, and records check-out.
- `GET /attendance/today` — Fetches today's active shift status for the authenticated staff member.
- `GET /attendance/my` — Fetches paginated attendance history for the authenticated staff member.

---

## 5. Security & Privacy Guarantees
1. **Zero Raw Biometric Upload**: No camera photos, frame buffers, or raw facial embedding arrays are transmitted to or stored on the backend. Only verification metadata (similarity score, liveness boolean, verification method string) is received.
2. **Server-Side Independent Verification**: The backend validates GPS coordinates against active campus geofence polygons, enforces allowable accuracy ($\le 50.0\text{m}$), and rejects duplicate or inverted operations.
3. **Idempotency & Replay Defense**: Every request requires a UUID idempotency key. Duplicate network submissions return the original authoritative transaction receipt without double-counting attendance.
4. **Offline Resilience**: Mobile client enqueues transactions in a local SQLite/Room database and uses Android `WorkManager` with exponential backoff for guaranteed background delivery upon network restoration.
