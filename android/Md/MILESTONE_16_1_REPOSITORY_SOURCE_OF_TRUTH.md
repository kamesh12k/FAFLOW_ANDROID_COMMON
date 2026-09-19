# Milestone 16.1: Repository Source of Truth & Synchronization Policy

> Canonical Monorepo: `B:\FAFLOW_UNIFIED`  
> Legacy Repository: `B:\android`  
> Effective Date: September 2, 2026

---

## 1. Canonical Repository Designation

`B:\FAFLOW_UNIFIED` is the **single, authoritative source of truth** for all components of the FAFLOW platform:

```
B:\FAFLOW_UNIFIED\
├── backend/          ← Authoritative FastAPI + PostgreSQL application & test suite
├── frontend/         ← Authoritative React + Vite Web application
├── android/          ← Authoritative FAFLOW Staff Mobile application (Kotlin + Compose)
├── database/         ← Authoritative PostgreSQL schema, migrations, and seed scripts
├── deployment/       ← Authoritative Windows & Linux deployment scripts
├── docs/             ← Consolidated documentation library
├── scripts/          ← Tooling, benchmark, and maintenance scripts
└── README.md         ← Monorepo documentation
```

---

## 2. Status of `B:\android` (Legacy Repository)

`B:\android` was the dedicated development workspace for Milestones 1 through 16.
- **Classification**: **LEGACY / RETIRED DEVELOPMENT WORKSPACE**
- **Action Taken**:
  - All Android source files, ML models, Gradle configurations, and assets were copied into `B:\FAFLOW_UNIFIED\android`.
  - The Android project compiles and passes all unit tests from inside `B:\FAFLOW_UNIFIED\android`.
  - `B:\android` is retained intact on disk as a local safety fallback and must **NOT** be modified for future feature work.
- **Do Not Delete Rule**:
  `B:\android` is preserved on local storage to maintain commit history inspection until institutional deployment and archiving are signed off.

---

## 3. Synchronization & Workflow Protocol

To prevent branch drift and competing sources of truth:

1. **All Future Edits**:
   - Backend changes occur exclusively in `B:\FAFLOW_UNIFIED\backend`.
   - Web frontend changes occur exclusively in `B:\FAFLOW_UNIFIED\frontend`.
   - Android changes occur exclusively in `B:\FAFLOW_UNIFIED\android`.
   - Documentation updates occur exclusively in `B:\FAFLOW_UNIFIED\docs` and root markdown files.
2. **Android Studio Workspace**:
   - Developers should open `B:\FAFLOW_UNIFIED\android` in Android Studio.
   - Gradle builds, unit tests, and APK packaging target `B:\FAFLOW_UNIFIED\android`.
3. **Legacy Synchronization (if needed)**:
   - If emergency read-only inspections are required against `B:\android`, no commits should be made to `B:\android`. Any changes must be committed to `B:\FAFLOW_UNIFIED`.
4. **Eventual Archiving**:
   - Once institutional QA and production deployment reach stable production milestones, `B:\android` can be compressed into an offline backup archive (e.g. `B:\archive\android_m16_legacy.zip`) and removed from active project directories.
