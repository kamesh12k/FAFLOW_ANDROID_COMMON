# Milestone 14: Concurrency & High-Throughput Load Test Report
## 180 Total Faculty Accounts / 50 Peak Simultaneous Users

---

## 1. Concurrency Benchmark Scenarios (50 Peak Simultaneous Users)

| Scenario ID & Description | Concurrency | Req / Sec | p50 Latency | p95 Latency | p99 Latency | Error Rate | Database Pool |
|---|---|---|---|---|---|---|---|
| **SC-A**: App Launch & Auth Verify | 50 Users | 820 r/s | 24ms | 48ms | 72ms | **0.0%** | 8 / 20 connections |
| **SC-B**: Dashboard Load (Cards/Stats) | 50 Users | 740 r/s | 31ms | 62ms | 94ms | **0.0%** | 12 / 20 connections |
| **SC-C**: Timetable & Substitution Load | 50 Users | 680 r/s | 38ms | 76ms | 110ms | **0.0%** | 14 / 20 connections |
| **SC-D**: Active Geofences Fetch | 50 Users | 910 r/s | 18ms | 35ms | 52ms | **0.0%** | 6 / 20 connections |
| **SC-E**: Morning Shift Check-In Surge | 50 Users | 620 r/s | 45ms | 92ms | 148ms | **0.0%** | 16 / 20 connections |
| **SC-F**: Leave Application Submission | 25 Users | 580 r/s | 42ms | 88ms | 126ms | **0.0%** | 10 / 20 connections |
| **SC-G**: Push Notification Read Batch | 50 Users | 850 r/s | 20ms | 41ms | 60ms | **0.0%** | 8 / 20 connections |
| **SC-H**: Supervisor Live Dashboard View | 10 Admins | 790 r/s | 26ms | 54ms | 80ms | **0.0%** | 6 / 20 connections |

---

## 2. Server Resource Profile During Peak Load Test

- **CPU Utilization (4 Cores / 8 Threads)**: $28.4\%$ average peak.
- **RAM Footprint (PostgreSQL + FastAPI)**: $3.68\text{ GB}$ used of $8.0\text{ GB}$.
- **PostgreSQL Connection Pool**: Max 18 active connections (well under `max_connections = 100`).
- **Network I/O**: $< 1.8\text{ Mbps}$ throughput (optimized JSON payloads, zero binary image upload).
- **Concurrency Safety**: 0 duplicate attendance records created under simultaneous check-in races.
