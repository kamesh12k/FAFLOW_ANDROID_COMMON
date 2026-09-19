# FAFLOW — REST API Reference & Contracts

**Company:** GOVERNENCE  
**Product:** FAFLOW  
**Developer:** KAMESHGOVINDHAN  
**Base URL:** `/api/v1`  
**Authentication:** HTTP Bearer `Authorization: Bearer <JWT_ACCESS_TOKEN>`  

---

## 1. Attendance Endpoints

### 1.1 POST `/attendance/check-in`
Submits authenticated biometric check-in.

* **Request Body:**
```json
{
  "latitude": 11.016844,
  "longitude": 76.955833,
  "accuracy_meters": 6.2,
  "face_similarity_score": 0.89,
  "liveness_verified": true,
  "idempotency_key": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
}
```

* **Success Response (200 OK / 201 Created):**
```json
{
  "id": 1042,
  "user_id": 42,
  "staff_name": "Dr. Ramesh K",
  "staff_id": "STF-2024-001",
  "department_name": "Computer Science",
  "attendance_date": "2026-09-07",
  "check_in_time": "08:42:15",
  "check_out_time": null,
  "status": "PRESENT",
  "face_similarity_score": 0.89,
  "liveness_verified": true,
  "geofence_name": "Main Engineering Campus",
  "is_synced": true
}
```

* **Error Responses:**
  - `400 Bad Request`: GPS accuracy exceeds 50.0m, or location outside geofence perimeter, or similarity score $< 0.60$, or liveness failed, or duplicate check-in today.
  - `401 Unauthorized`: Missing or expired access token.
  - `403 Forbidden`: Deactivated staff account.

---

### 1.2 POST `/attendance/check-out`
Submits authenticated biometric check-out. Applies the identical biometric and geofence verification gates as check-in.

* **Request Body:** Identical to check-in.
* **Success Response (200 OK):** Updates `check_out_time` and recalculates duration.

---

### 1.3 GET `/attendance/today`
Returns the caller's attendance status and timestamps for the current date.

---

### 1.4 GET `/attendance/history`
Query parameters: `start_date`, `end_date`, `limit`. Returns historical attendance records for the authenticated user.

---

## 2. Geofence Endpoints

### 2.1 GET `/geofences/active`
Returns list of currently active campus perimeters for mobile on-device proximity checks.

### 2.2 POST `/geofences/test-location`
Calculates distance and containment for arbitrary coordinates against active geofences without submitting attendance.

### 2.3 POST `/geofences/` (SYSTEM ADMIN ONLY)
Creates a new circular or polygonal campus boundary.

### 2.4 PUT `/geofences/{id}` (SYSTEM ADMIN ONLY)
Updates perimeter boundaries, radius, or polygon vertices.

### 2.5 PATCH `/geofences/{id}/toggle` (SYSTEM ADMIN ONLY)
Activates or deactivates a geofence.

### 2.6 DELETE `/geofences/{id}` (SYSTEM ADMIN ONLY)
Soft-deletes a geofence.
