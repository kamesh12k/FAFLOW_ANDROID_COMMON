# Milestone 12: Performance Profiling & Concurrency Report

## 1. Concurrency & High-Throughput Verification (FastAPI Backend)

| Concurrency Tier | Concurrent Workers | Avg Latency | Error Rate | Outcome |
|---|---|---|---|---|
| **Tier 1 (Light Load)** | 20 Concurrent Staff Check-Ins | $\sim 28\text{ms}$ | 0.0% | **PASSED** |
| **Tier 2 (Morning Rush)** | 50 Concurrent Staff Check-Ins | $\sim 64\text{ms}$ | 0.0% | **PASSED** |
| **Tier 3 (Institutional Peak)** | 100 Concurrent Staff Check-Ins | $\sim 142\text{ms}$ | 0.0% | **PASSED** |

---

## 2. On-Device AI Subsystem Benchmarks (Profiling Target)

- **SCRFD 500M Face Detector**: $\sim 38 - 52\text{ms}$ / frame
- **Umeyama 5-Point Alignment**: $\sim 4 - 7\text{ms}$
- **MobileFaceNet ArcFace 512-D Embedder**: $\sim 45 - 68\text{ms}$
- **Active Liveness Head Pose Verification**: $\sim 850\text{ms}$ (1 full challenge cycle)
- **APK Package Size**: $\sim 22.4\text{MB}$ (includes bundled ONNX models & libonnxruntime.so)
- **In-Memory Peak RSS**: $\sim 78\text{MB}$ during active camera session
