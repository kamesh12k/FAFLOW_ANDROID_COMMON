# Milestone 10 Audit: Production Hardening, Audit Logs & Performance Telemetry
## FAFLOW Staff Mobile & FastAPI Backend

---

## 1. Existing System Audit (Milestones 1–9)

| Layer | Component | Current Implementation Status |
|---|---|---|
| **Auth & Network** | `TokenManager`, `FaflowApiService`, `FaflowApiClient` | JWT bearer authentication, encrypted token storage, automated header injection. |
| **Geofencing & GPS** | `GeofenceValidator`, `StaffLocationProvider`, `GeofenceMathEngine` | Haversine circle + Jordan curve ray-casting polygon evaluation, mock-location rejection, accuracy filtering ($\le 30\text{m}$). |
| **CameraX Pipeline** | `CameraController`, `CameraAnalyzer`, `CameraOverlay` | Front-facing camera preview, throttled frame delivery, non-blocking single-frame inference lock. |
| **Face AI Subsystem** | `ScrfdFaceDetector`, `UmeyamaFaceAligner`, `ArcFaceEmbedder`, `CosineFaceMatcher` | InsightFace SCRFD 500M ($640 \times 640$ NCHW), 5-point Umeyama similarity alignment to $112 \times 112$, ArcFace 512-D embedding with $L_2$-norm, cosine matching ($\ge 0.60$). |
| **Liveness & PAD** | `LivenessEngine`, `MotionAnalyzer`, `HeadPoseAnalyzer`, `ActiveLivenessDetector` | Temporal observation window ($N = 20$), photostatic variance analysis (static 2D photo defense), 3D head pose ($\pm 18^\circ$ yaw, $\pm 12^\circ$ pitch), randomized interactive challenges. |
| **Attendance & Sync** | `AttendanceRepository`, `AttendanceLocalQueue`, `AttendanceSyncWorker` | Direct FastAPI endpoints (`/attendance/check-in`, `/attendance/check-out`, `/attendance/today`, `/attendance/my`), UUID idempotency, SQLite offline queue, WorkManager network-bound sync. |

---

## 2. Identified Gaps & Production Hardening Scope

### A. Security & Attestation Gaps
- **Play Integrity / Device Attestation**: Missing an extensible device integrity abstraction (`DeviceIntegrityVerifier`) to detect rooted devices, emulators, or untrusted execution environments.
- **Audit Logging**: Backend needs explicit structured audit records (`AuditLog`) for all attendance acceptance, rejection, mock GPS detection, and geofence failure events.

### B. Institutional Administration Gaps
- **Supervisor / HOD Live Dashboard**: Backend lacks dedicated administrative endpoints (`/attendance/admin/live-status`, `/attendance/admin/summary`) for Department Heads and Principals to view real-time shift statuses, anomalies, and geofence exceptions.

### C. State Machine & User Experience Gaps
- **Granular Pipeline Statuses**: The UI needs a unified, exhaustive state machine covering all 28 operational stages (from permission requests, GPS acquisition, and face sizing to server acceptance and offline queueing) with plain-language guidance.

### D. Observability & Telemetry Gaps
- **Non-Sensitive Performance Telemetry**: Need a lightweight telemetry provider (`AttendanceTelemetry`) measuring GPS latency, face detection latency, inference times, and sync performance without collecting biometric data.

### E. ProGuard & Build Optimization Gaps
- **ProGuard / R8 Rules**: Explicit keep rules needed for ONNX Runtime Mobile, Moshi DTOs, and WorkManager to guarantee production release stability.

---

## 3. Exact Files Requiring Creation / Modification

### Android Files to Create / Update:
1. `app/src/main/java/com/governence/faflow/core/security/DeviceIntegrityVerifier.kt` (NEW)
2. `app/src/main/java/com/governence/faflow/core/telemetry/AttendanceTelemetry.kt` (NEW)
3. `app/src/main/java/com/governence/faflow/attendance/model/AttendancePipelineStatus.kt` (NEW)
4. `app/src/main/java/com/governence/faflow/ui/screens/AttendanceHistoryScreen.kt` (NEW/UPDATED)
5. `app/src/main/java/com/governence/faflow/ui/viewmodels/AttendanceViewModel.kt` (MODIFY)
6. `app/src/main/java/com/governence/faflow/ui/screens/AttendanceCheckInOutScreen.kt` (MODIFY)
7. `app/proguard-rules.pro` (MODIFY)
8. `app/src/test/java/com/governence/faflow/FaflowIntegrationTest.kt` (MODIFY)

### Backend Files to Create / Update:
1. `scratch/FACULTY_FLOW/backend/app/services/attendance_service.py` (MODIFY — Add supervisor live status, structured audit events)
2. `scratch/FACULTY_FLOW/backend/app/routes/attendance.py` (MODIFY — Add `/attendance/admin/live-status`, `/attendance/admin/summary`)
3. `scratch/FACULTY_FLOW/backend/tests/test_attendance.py` (MODIFY — Add supervisor RBAC & audit tests)

### Documentation Files to Create / Update:
1. `MILESTONE_10_PRODUCTION_HARDENING.md` (NEW)
2. `MILESTONE_10_SECURITY_AUDIT.md` (NEW)
3. `MILESTONE_10_DEVICE_TEST_PLAN.md` (NEW)
4. `FAFLOW_MOBILE_ARCHITECTURE.md` (MODIFY)
