# FAFLOW — Enterprise Architecture Specification

## 1. System Architecture Overview

FAFLOW is engineered as a high-throughput, multi-tenant academic workload, timetable, leave, and autonomous substitution platform designed to reliably support **1,000+ concurrent institutional users**.

```text
                                Internet / Client Devices
                               (Desktop, Tablet, Mobile)
                                          │
                                          ▼
                                   [ Load Balancer /
                                   Reverse Proxy Nginx ]
                                          │
                   ┌──────────────────────┴──────────────────────┐
                   │                                             │
                   ▼                                             ▼
        [ FAFLOW App Instance 1 ]                     [ FAFLOW App Instance 2 ]
          (FastAPI ASGI Worker)                         (FastAPI ASGI Worker)
                   │                                             │
                   └──────────────────────┬──────────────────────┘
                                          │
                                          ▼
                              [ PostgreSQL 14+ RDBMS ]
                              (Connection Pool: 50-80)
                                          │
                        ┌─────────────────┴─────────────────┐
                        │                                   │
                        ▼                                   ▼
             [ Atomic Ledger Storage ]            [ Durable Disk Backups ]
```

---

## 2. Layered Architecture

1. **Presentation Layer (Frontend)**:
   - React 18 SPA built with Vite 5.
   - Dynamic route-level code splitting via `React.lazy` and `Suspense`.
   - Vendor rollup chunking (`vendor-react`, `vendor-router`, `vendor-http`, `vendor-pdf`), reducing initial payload from ~2 MB to under 150 KB gzip.
   - Tailored design tokens with responsive layout shells (`AppShell`, `Sidebar`, `TopBar`, `MobileDrawer`).

2. **API Gateway & Routing Layer**:
   - FastAPI ASGI controllers with Pydantic request/response serialization.
   - Middleware pipeline: CORS, SlowAPI rate limiting, Request Correlation ID (`X-Request-ID`), and structured latency logging.
   - Safe enterprise exception handler returning uniform RFC-compliant payloads without stack trace leaks.

3. **Domain Service Layer**:
   - Encapsulated business rules for academic calendar day orders, credit balancing, timetable matrix conflict detection, and autonomous substitution recommendations.
   - 100% backward-compatible interfaces.

4. **Persistence & Data Layer**:
   - PostgreSQL 14+ with SQLAlchemy 2.0 connection pooling (`QueuePool`, pre-ping enabled, connection recycling).
   - Row-level locking (`with_for_update`) for credit mutations and atomic substitution allocation.
   - Batch query prefetching eliminating N+1 database round-trips.

---

## 3. Horizontal Scalability Strategy

- **Stateless App Instances**: All session state is encoded in cryptographically signed JWT tokens (HS256) and verified on each request. No in-process mutable global state.
- **Database Concurrency**: Database constraints (`UNIQUE`, foreign keys) and transactional row locks guarantee consistency across any number of app instances (`N instances`).
- **Graceful Degradation**: Built-in connection timeouts and pre-ping health checks ensure instances fail fast and self-heal without hanging requests.
