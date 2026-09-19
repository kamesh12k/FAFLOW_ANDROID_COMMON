# FAFLOW — Diagnostics & Debug Kit

**Company:** GOVERNENCE  
**Product:** FAFLOW  
**Developer:** KAMESHGOVINDHAN  

---

## 1. High-Precision Latency Profiling

FAFLOW features a zero-allocation nanosecond telemetry engine (`AttendanceTelemetry.kt`) tracking stage-by-stage latencies:

- `METRIC_ATTENDANCE_SCREEN_OPEN_MS`: Warm-up latency from click to camera readiness.
- `METRIC_SCRFD_DETECTION_MS`: Duration of face detection forward pass.
- `METRIC_UMEYAMA_ALIGNMENT_MS`: Duration of landmark transformation to 112x112 canonical crop.
- `METRIC_MOBILEFACENET_EMBED_MS`: Duration of embedding vector generation.
- `METRIC_LIVENESS_MS`: Anti-spoofing / PAD evaluation duration.
- `METRIC_NETWORK_SUBMISSION_MS`: Round-trip API attendance ledger submission.
- `METRIC_TOTAL_ATTENDANCE_PIPELINE_MS`: End-to-end user tap-to-verified latency.

---

## 2. Server Correlation & Request IDs

- Every incoming HTTP request is assigned an `X-Request-ID` (UUIDv4) via FastAPI middleware.
- Exception handlers inject `request_id` into error envelopes, allowing staff to report precise correlation IDs to institutional support desks.
- Audit logs in PostgreSQL track security events (`FACE_VERIFICATION_FAILURE`, `GEOFENCE_FAILURE`, `GPS_ACCURACY_FAILURE`, `DUPLICATE_ATTENDANCE`).
