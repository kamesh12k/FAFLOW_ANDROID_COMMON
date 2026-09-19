# FAFLOW — Database Architecture & PostgreSQL Schema

**Company:** GOVERNENCE  
**Product:** FAFLOW  
**Developer:** KAMESHGOVINDHAN  
**Engine:** PostgreSQL 18  

---

## 1. Schema Overview

The FAFLOW database comprises 41 normalized relational tables supporting multi-department academic structures, facial biometric status flags, geofence definitions, and audit logs.

### Core Tables

1. **`users`**: Master staff & faculty table.
   - Primary key: `id` (INTEGER SERIAL)
   - Unique: `email`, `username`, `staff_id`
   - Role enum: `admin`, `teacher`, `system_admin`, `principal`, `manager`, `lab_staff`, `non_teaching_staff`, `governance`
   - Biometric flag: `has_face_enrolled` (BOOLEAN DEFAULT FALSE)
2. **`campus_geofences`**: Institutional geofence perimeters.
   - Geometry: `center_latitude` (DOUBLE PRECISION), `center_longitude` (DOUBLE PRECISION), `radius_meters` (DOUBLE PRECISION), `polygon_vertices` (JSONB)
   - Tolerances: `tolerance_meters` (DOUBLE PRECISION DEFAULT 15.0)
   - Status: `is_active` (BOOLEAN DEFAULT TRUE)
3. **`staff_attendance_records`**: Immutable attendance transaction ledger.
   - Verification: `face_similarity_score` (DOUBLE PRECISION), `liveness_verified` (BOOLEAN)
   - Location: `latitude`, `longitude`, `accuracy_meters`, `geofence_id` (FK $\to$ `campus_geofences.id`)
   - Idempotency: `idempotency_key` (VARCHAR(64) UNIQUE NOT NULL)
   - Status: `status` (`PRESENT`, `HALF_DAY`, `ABSENT`, `ON_DUTY`)
4. **`audit_logs`**: Tamper-resistant security log.
   - Fields: `user_id`, `action`, `details` (JSONB), `created_at` (TIMESTAMP WITH TIME ZONE)
