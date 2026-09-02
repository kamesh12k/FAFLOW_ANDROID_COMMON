# FAFLOW — Enterprise Load & Concurrency Testing Guide

## 1. Load Testing Overview

FAFLOW includes an automated, multi-tier asynchronous load test harness ([load_test.py](file:///c:/Users/kames/Downloads/FACREDIT-enhanced-20260724-v5/backend/load_test.py)) built on `httpx` and `asyncio` to validate high concurrency scenarios up to **1,000 concurrent virtual users**.

---

## 2. Concurrency Tiers

The test suite ramps traffic through progressive concurrency levels:
- **1 User**: Baseline single-user latency profile
- **10 Users**: Team-level concurrency
- **25 Users**: Departmental peak concurrency
- **50 Users**: Multi-department concurrent usage
- **100 Users**: Moderate institutional load
- **250 Users**: High institutional load (period transitions)
- **500 Users**: Campus-wide morning attendance / leave rush
- **750 Users**: High-stress campus event
- **1,000 Users**: Primary Target Maximum Capacity Benchmark

---

## 3. How to Run Load Tests

1. Start the FAFLOW Backend server:
   ```powershell
   cd backend
   .\venv\Scripts\uvicorn.exe app.main:app --host 0.0.0.0 --port 8000 --workers 4
   ```

2. Run the load test harness in a separate terminal:
   ```powershell
   cd backend
   .\venv\Scripts\python.exe load_test.py --max-concurrency 1000
   ```

---

## 4. Measured Metrics & Acceptance Criteria

- **Throughput (RPS)**: Measured requests completed per second.
- **Latency Percentiles**:
  - `p50` (Median Response Time): `< 50 ms`
  - `p95` (95th Percentile Response Time): `< 150 ms`
  - `p99` (99th Percentile Response Time): `< 300 ms`
- **Error Rate**: Strict requirement of `< 0.1%` failed requests under sustained concurrency.
- **Connection Stability**: Zero dropped or orphaned database connections.
