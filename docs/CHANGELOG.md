# FAFLOW Changelog

## [Version 3.1.0-ENTERPRISE] - 2026-08-23

### Added
- **Route-Level Code Splitting**: All 38+ frontend views converted to dynamic `React.lazy` imports with `<Suspense>` and `<PageLoader />` fallback.
- **Rollup Vendor Chunking**: Isolated `vendor-react`, `vendor-router`, `vendor-http`, and `vendor-pdf` chunks in `vite.config.js`.
- **Request ID Correlation**: Global `X-Request-ID` middleware attached to all requests, responses, and structured audit logs.
- **Row-Level Concurrency Locks**: Added `with_for_update()` to credit balance adjustments and leave allocations for atomic transaction safety.
- **Multi-Tier Load Test Harness**: Upgraded `load_test.py` with concurrency testing from 1 to 1,000 virtual users and percentile latency reporting.
- **Enterprise Documentation Suite**: Added `ARCHITECTURE.md`, `PERFORMANCE.md`, `SECURITY.md`, `DATABASE.md`, `LOAD_TESTING.md`, and `DISASTER_RECOVERY.md`.

### Optimized
- **Initial Page Weight**: Reduced initial frontend payload from ~2 MB to under 150 KB gzip (~93% reduction).
- **Faculty Workload Queries**: Replaced 2N+1 query loop with batch query prefetching and dictionary grouping in `credit_service.py` (99% query count reduction).
- **Candidate Detection Queries**: Replaced 2N+1 query loop in `leave_service.py` (`detect_free_teachers`) with bulk timetable slot prefetching.
- **Server Error Sanitization**: Global exception handlers sanitize unexpected 500 errors into clean JSON payloads with request correlation IDs without leaking internal stack traces.

### Fixed
- Prevented potential lost-update race conditions during simultaneous credit transactions under heavy concurrency.
