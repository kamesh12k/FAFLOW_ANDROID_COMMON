# Milestone 11: Real Device End-to-End Attendance Audit
## FAFLOW Staff Mobile & FastAPI Backend

---

## 1. Complete System Inventory & Pipeline Audit

| Subsystem | Implemented Components | Wiring & Hardware Readiness | Status |
|---|---|---|---|
| **Authentication & Profile** | `TokenManager`, `FaflowApiService`, `UserOutDto` | Bearer JWT securely injected by `AuthInterceptor`; automatic 401 handling. | Verified |
| **GPS & Geofencing** | `StaffLocationProvider`, `GeofenceValidator`, `GeofenceMathEngine` | FusedLocationProviderClient live GPS tracking, circular & polygonal perimeter containment, mock-location blocking. | Verified |
| **CameraX Subsystem** | `CameraController`, `CameraPreviewView`, `CameraOverlay` | Front camera lifecycle bound to Compose, `KEEP_ONLY_LATEST` frame analysis, rotation-aware. | Verified |
| **SCRFD Face Detection** | `ScrfdFaceDetector`, `ScrfdModelManager` | InsightFace SCRFD 500M ONNX inference ($640 \times 640$ NCHW), anchor decoding, IoU NMS, 5-point landmarks. | Verified |
| **Face Alignment & Embedding** | `UmeyamaFaceAligner`, `ArcFaceEmbedder`, `CosineFaceMatcher` | Umeyama 5-point similarity transform to $112 \times 112$, MobileFaceNet ArcFace 512-D embedding with $L_2$-normalization. | Verified |
| **Face Enrollment** | `FaceEnrollmentScreen`, `LocalFaceEnrollmentRepository` | Hardware TEE `EncryptedSharedPreferences` enrollment repository; multi-frame face quality checking. | Verified |
| **Liveness & PAD** | `LivenessEngine`, `MotionAnalyzer`, `HeadPoseAnalyzer`, `ActiveLivenessDetector` | Temporal observation window ($N = 20$), photostatic variance analysis ($\sigma^2 \ge 0.15$), dynamic head pose challenges. | Verified |
| **Authoritative Attendance** | `AttendanceRepository`, `AttendanceLocalQueue`, `AttendanceSyncWorker` | FastAPI endpoints (`POST /attendance/check-in`, `POST /attendance/check-out`), UUID idempotency, SQLite offline queue, WorkManager sync. | Verified |
| **Supervisor Dashboard** | `GET /attendance/admin/live-status`, `AuditLog` | Real-time institutional faculty presence tracking and immutable audit trail under strict RBAC. | Verified |

---

## 2. Identified Risks & Real Device Considerations
1. **Camera Sensor Mirroring**: Front-facing camera preview requires mirroring while analytical frame inference maintains coordinate consistency.
2. **GPS Environmental Factors**: Indoors / dense concrete roofs can reduce GPS accuracy $> 50\text{m}$; UI provides clear prompt "GPS accuracy is too low. Move to an open area."
3. **Zero Biometric Network Leakage**: Re-verified that no raw JPEG frames or 512-D vectors are transmitted or saved in local SQLite databases.
