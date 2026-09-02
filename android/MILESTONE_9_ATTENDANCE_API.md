# Milestone 9: FAFLOW Staff Attendance API Contract

## 1. Overview
The FAFLOW Staff Attendance API allows mobile clients to submit on-device verified attendance transactions with server-side validation, idempotency, and audit logging.

## 2. Authentication & Headers
- **Authorization**: `Bearer <JWT_ACCESS_TOKEN>`
- **Content-Type**: `application/json`

## 3. Endpoints

### 3.1 POST `/attendance/check-in`
Processes a staff shift check-in transaction.

#### Request Body
```json
{
  "idempotency_key": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "latitude": 11.016844,
  "longitude": 76.955833,
  "accuracy_meters": 8.5,
  "face_similarity_score": 0.88,
  "liveness_verified": true,
  "verification_method": "FACE_ON_DEVICE",
  "device_reference": "FAFLOW_STAFF_MOBILE"
}
```

#### Response (HTTP 200 OK)
```json
{
  "id": 101,
  "user_id": 42,
  "staff_name": "Dr. Kamesh V",
  "attendance_date": "2026-09-02",
  "check_in_time": "2026-09-02T08:30:15Z",
  "check_out_time": null,
  "status": "PRESENT",
  "check_in_geofence_name": "Main Campus Perimeter",
  "check_out_geofence_name": null,
  "face_similarity_score": 0.88,
  "liveness_verified": true,
  "verification_method": "FACE_ON_DEVICE",
  "working_hours": null,
  "is_synced": true
}
```

### 3.2 POST `/attendance/check-out`
Processes a staff shift check-out transaction.

#### Request Body
```json
{
  "idempotency_key": "4c2aeb3f-1c5d-4f1a-8bbd-1e0d7c3dca2f",
  "latitude": 11.016844,
  "longitude": 76.955833,
  "accuracy_meters": 6.2,
  "face_similarity_score": 0.90,
  "liveness_verified": true,
  "verification_method": "FACE_ON_DEVICE",
  "device_reference": "FAFLOW_STAFF_MOBILE"
}
```

#### Response (HTTP 200 OK)
```json
{
  "id": 101,
  "user_id": 42,
  "staff_name": "Dr. Kamesh V",
  "attendance_date": "2026-09-02",
  "check_in_time": "2026-09-02T08:30:15Z",
  "check_out_time": "2026-09-02T16:30:45Z",
  "status": "PRESENT",
  "check_in_geofence_name": "Main Campus Perimeter",
  "check_out_geofence_name": "Main Campus Perimeter",
  "face_similarity_score": 0.90,
  "liveness_verified": true,
  "verification_method": "FACE_ON_DEVICE",
  "working_hours": "8h 0m",
  "is_synced": true
}
```

### 3.3 GET `/attendance/today`
Retrieves the current shift status for the authenticated staff member.

#### Response (HTTP 200 OK)
```json
{
  "is_checked_in": true,
  "is_checked_out": false,
  "check_in_time": "2026-09-02T08:30:15Z",
  "check_out_time": null,
  "working_duration": null,
  "record": { ... }
}
```

### 3.4 GET `/attendance/my`
Retrieves paginated attendance history for the authenticated staff member (`?limit=30&offset=0`).

---

## 4. Server-Side Validation Rules
1. **JWT Authentication**: Requires a valid, non-expired staff bearer token.
2. **Account Active Check**: Inactive accounts receive `HTTP 403 Forbidden`.
3. **Server Geofence Check**: Client coordinates $(lat, lon)$ must fall within an active `campus_geofences` boundary (plus configured tolerance margin).
4. **Accuracy Threshold**: GPS accuracy must be $\le 50.0\text{m}$.
5. **Biometric Similarity**: Must report similarity score $\ge 0.60$ and `liveness_verified == true`.
6. **Idempotency Deduplication**: Duplicate requests with the same `idempotency_key` return the existing transaction record without creating a second record.
7. **Sequence Enforcement**:
   - Duplicate check-in for the same date returns `HTTP 400 Bad Request`.
   - Check-out without prior check-in returns `HTTP 400 Bad Request`.
   - Duplicate check-out returns `HTTP 400 Bad Request`.
