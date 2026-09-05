import logging
import os
import time
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.errors import RateLimitExceeded
    from slowapi.util import get_remote_address
except ImportError:
    class RateLimitExceeded(Exception):
        pass
    def _rate_limit_exceeded_handler(request, exc):
        return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded"})
    def get_remote_address(request):
        return "127.0.0.1"
    class Limiter:
        def __init__(self, key_func=None):
            pass
        def limit(self, limit_value):
            def decorator(func):
                return func
            return decorator
from app.core.traffic import traffic_manager

from app.config import settings
from app.database import Base, engine, SessionLocal, get_db
import app.models  # ensure all models are registered with Base before create_all

from app.routes import (
    auth, teachers, timetable, leaves, credits, notifications,
    departments, subjects, classes, rooms, day_order, admin, academic_calendar,
    campus_operations, teacher_substitution, substitutions, principal, manager, staff,
    backup, governance, data_retention, geofences, attendance, system_control,
)
from app.services.admin_service import bootstrap_default_super_admin
from app.services.governance_service import bootstrap_governance_user
from sqlalchemy import text

logging.basicConfig(level=logging.INFO)

def sync_database_schema():
    """Sync PostgreSQL enums and table constraints, retrying if the DB is still
    in recovery mode at startup (e.g. after a crash or fast OS restart).

    Strategy:
      - Up to 10 attempts, exponential back-off: 2s, 4s, 6s … 18s  (≈ 90 s total)
      - Only retries on transient errors (recovery mode, connection refused, …)
      - Logs clearly at each step so the admin can follow progress in the console
      - Falls through gracefully on failure so the app still starts and individual
        routes surface proper DB errors instead of a hard crash at boot time.
    """
    logger = logging.getLogger(__name__)

    # ── PostgreSQL path ───────────────────────────────────────────────────────
    if engine.dialect.name == "postgresql":
        max_retries = 10
        base_wait   = 2  # seconds

        for attempt in range(1, max_retries + 1):
            try:
                with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:

                    # 1) Enum value additions
                    try:
                        conn.execute(text("ALTER TYPE role ADD VALUE IF NOT EXISTS 'governance'"))
                    except Exception as e:
                        logger.warning("Could not add 'governance' to role enum: %s", e)

                    try:
                        conn.execute(text("ALTER TYPE assignment_type ADD VALUE IF NOT EXISTS 'combined_class'"))
                    except Exception as e:
                        logger.warning("Could not add 'combined_class' to assignment_type enum: %s", e)

                    # 2) Table constraint syncs
                    try:
                        conn.execute(text("""
                            DO $$
                            BEGIN
                                IF EXISTS (
                                    SELECT 1 FROM pg_constraint WHERE conname = 'chk_user_department_role'
                                ) THEN
                                    ALTER TABLE users DROP CONSTRAINT chk_user_department_role;
                                    ALTER TABLE users ADD CONSTRAINT chk_user_department_role CHECK (
                                        (role IN ('admin', 'teacher') AND department_id IS NOT NULL) OR
                                        (role IN ('manager', 'lab_staff', 'non_teaching_staff')) OR
                                        (role IN ('system_admin', 'principal', 'governance') AND department_id IS NULL)
                                    );
                                END IF;

                                IF EXISTS (
                                    SELECT 1 FROM pg_constraint WHERE conname = 'chk_user_identity'
                                ) THEN
                                    ALTER TABLE users DROP CONSTRAINT chk_user_identity;
                                    ALTER TABLE users ADD CONSTRAINT chk_user_identity CHECK (
                                        (role = 'teacher' AND email IS NOT NULL) OR
                                        (role IN ('admin', 'system_admin', 'principal', 'manager', 'lab_staff', 'non_teaching_staff', 'governance') AND username IS NOT NULL)
                                    );
                                END IF;

                                IF EXISTS (
                                    SELECT 1 FROM pg_constraint WHERE conname = 'chk_admin_level'
                                ) THEN
                                    ALTER TABLE users DROP CONSTRAINT chk_admin_level;
                                    ALTER TABLE users ADD CONSTRAINT chk_admin_level CHECK (
                                        (role = 'admin' AND admin_level IS NOT NULL) OR
                                        (role IN ('teacher', 'system_admin', 'principal', 'manager', 'lab_staff', 'non_teaching_staff', 'governance') AND admin_level IS NULL)
                                    );
                                END IF;

                                -- Drop strict single-staff constraints to allow multi-staff combined classes
                                IF EXISTS (
                                    SELECT 1 FROM pg_constraint WHERE conname = 'uq_teacher_day_period'
                                ) THEN
                                    ALTER TABLE timetable_slots DROP CONSTRAINT uq_teacher_day_period;
                                END IF;

                                IF EXISTS (
                                    SELECT 1 FROM pg_constraint WHERE conname = 'uq_class_day_period'
                                ) THEN
                                    ALTER TABLE timetable_slots DROP CONSTRAINT uq_class_day_period;
                                END IF;

                                IF EXISTS (
                                    SELECT 1 FROM pg_constraint WHERE conname = 'uq_room_day_period'
                                ) THEN
                                    ALTER TABLE timetable_slots DROP CONSTRAINT uq_room_day_period;
                                END IF;

                                IF NOT EXISTS (
                                    SELECT 1 FROM pg_constraint WHERE conname = 'uq_teacher_class_day_period'
                                ) THEN
                                    ALTER TABLE timetable_slots ADD CONSTRAINT uq_teacher_class_day_period UNIQUE (teacher_id, class_id, day_order, period_number);
                                END IF;

                                -- Ensure default_room_id exists on classes table
                                IF NOT EXISTS (
                                    SELECT 1 FROM information_schema.columns
                                    WHERE table_name = 'classes' AND column_name = 'default_room_id'
                                ) THEN
                                    ALTER TABLE classes ADD COLUMN default_room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL;
                                END IF;

                                -- Ensure only_my_classes column exists on substitution_preferences
                                IF NOT EXISTS (
                                    SELECT 1 FROM information_schema.columns
                                    WHERE table_name = 'substitution_preferences' AND column_name = 'only_my_classes'
                                ) THEN
                                    ALTER TABLE substitution_preferences ADD COLUMN only_my_classes BOOLEAN NOT NULL DEFAULT FALSE;
                                END IF;
                            END $$;
                        """))
                    except Exception as e:
                        logger.warning("Could not sync PostgreSQL table constraints: %s", e)

                # ── All SQL completed successfully — stop retrying ─────────
                if attempt > 1:
                    logger.info("Database schema sync succeeded on attempt %d.", attempt)
                break

            except Exception as e:
                err_str = str(e).lower()
                is_recovery = "recovery mode" in err_str or "recovery" in err_str
                is_transient = (
                    is_recovery
                    or "connection refused" in err_str
                    or "could not connect" in err_str
                    or "server closed the connection" in err_str
                    or "no connection to the server" in err_str
                    or "connection reset" in err_str
                )

                if is_transient and attempt < max_retries:
                    wait = base_wait * attempt  # 2s, 4s, 6s … 18s
                    logger.warning(
                        "Database not ready yet (attempt %d/%d) — %s. Retrying in %ds…",
                        attempt, max_retries,
                        "PostgreSQL is in recovery mode" if is_recovery else "transient connection error",
                        wait,
                    )
                    time.sleep(wait)
                else:
                    logger.error(
                        "Could not complete schema sync after %d attempt(s): %s. "
                        "The app will start anyway — check DB connectivity.",
                        attempt, e,
                    )
                    break

    # ── SQLite path (dev / testing) ───────────────────────────────────────────
    elif engine.dialect.name == "sqlite":
        with engine.connect() as conn:
            try:
                res = conn.execute(text("PRAGMA table_info(classes)")).fetchall()
                col_names = [r[1] for r in res]
                if "default_room_id" not in col_names:
                    conn.execute(text("ALTER TABLE classes ADD COLUMN default_room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL"))
                    conn.commit()
            except Exception as e:
                logger.warning("Could not sync sqlite classes default_room_id: %s", e)

def _db_is_ready() -> bool:
    """Quick connection probe — returns True if Postgres accepts a connection."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


def wait_for_db_and_init(max_wait_seconds: int = 300) -> None:
    """Wait for PostgreSQL to finish recovery, then run all startup DB work.

    Covers three steps that all need a live DB:
      1. sync_database_schema()  — enum/constraint migrations
      2. Base.metadata.create_all() — create missing tables
      3. bootstrap_*()            — seed default users

    Polls every 5 s until Postgres is ready, up to max_wait_seconds (default
    5 minutes). Once ready, runs the three steps once with no further retrying
    (if they fail for a non-transient reason that's a real error worth seeing).
    """
    logger = logging.getLogger(__name__)
    poll_interval = 5
    elapsed = 0

    logger.info("Waiting for PostgreSQL to become ready (timeout %ds)…", max_wait_seconds)
    while not _db_is_ready():
        if elapsed >= max_wait_seconds:
            logger.error(
                "PostgreSQL did not become ready within %ds. "
                "Schema sync and table creation skipped — check DB connectivity.",
                max_wait_seconds,
            )
            return
        logger.warning(
            "PostgreSQL not ready yet (recovery mode or connection refused). "
            "Retrying in %ds… [%ds elapsed / %ds max]",
            poll_interval, elapsed, max_wait_seconds,
        )
        time.sleep(poll_interval)
        elapsed += poll_interval

    logger.info("PostgreSQL is ready after %ds. Running startup initialization.", elapsed)

    # Step 1 — enum / constraint migrations
    sync_database_schema()

    # Step 2 — create any missing tables (idempotent)
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        logger.error("Base.metadata.create_all failed: %s", e)

    # Step 3 — seed default admin + governance user (no-op if already exist)
    try:
        with SessionLocal() as _bootstrap_db:
            bootstrap_default_super_admin(_bootstrap_db)
            bootstrap_governance_user(_bootstrap_db)
    except Exception as e:
        logger.error("Bootstrap failed: %s", e)


# Run all DB startup work unless explicitly skipped (e.g. test environments)
if not os.environ.get("SKIP_DB_INIT"):
    wait_for_db_and_init()


def get_allowed_origins():
    import socket
    origins = list(settings.FRONTEND_ORIGIN)
    local_ips = ["127.0.0.1", "localhost"]
    try:
        hostname = socket.gethostname()
        local_ips.append(socket.gethostbyname(hostname))
    except Exception:
        pass
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ips.append(s.getsockname()[0])
        s.close()
    except Exception:
        pass
    for ip in set(local_ips):
        if ip:
            origins.append(f"http://{ip}:5173")
            origins.append(f"https://{ip}:5173")
            origins.append(f"http://{ip}:8000")
            origins.append(f"https://{ip}:8000")
    return list(set(origins))

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(
    title=settings.APP_NAME,
    version="3.0.0",
    description="Manage teacher leave requests, substitute assignments, credit workload balancing, timetables, and the academic calendar (Day Order rotation + holiday management).",
)
from app.core.exceptions import DomainException, domain_exception_handler

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_exception_handler(DomainException, domain_exception_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import uuid

@app.exception_handler(Exception)
async def global_unhandled_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    logging.getLogger("app.exceptions").exception("Unhandled server exception [request_id=%s]: %s", request_id, exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Please contact the administrator with the reference request ID.", "request_id": request_id},
        headers={"X-Request-ID": request_id}
    )

@app.middleware("http")
async def traffic_logger_middleware(request: Request, call_next):
    start_time = time.time()
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    request.state.request_id = request_id
    status_code = 500
    try:
        response = await call_next(request)
        status_code = response.status_code
        response.headers["X-Request-ID"] = request_id
        return response
    except Exception as e:
        status_code = 500
        raise e
    finally:
        process_time_ms = (time.time() - start_time) * 1000
        client_ip = request.client.host if request.client else "unknown"
        path = request.url.path
        if not path.startswith("/admin/system-metrics") and path != "/health":
            traffic_manager.add_log(
                method=request.method,
                path=path,
                status_code=status_code,
                process_time_ms=process_time_ms,
                client_ip=client_ip
            )

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(teachers.router)
app.include_router(timetable.router)
app.include_router(leaves.router)
app.include_router(credits.router)
app.include_router(notifications.router)
app.include_router(departments.router)
app.include_router(subjects.router)
app.include_router(classes.router)
app.include_router(rooms.router)
app.include_router(day_order.router)
app.include_router(academic_calendar.router)
app.include_router(campus_operations.router)
app.include_router(teacher_substitution.router)
app.include_router(substitutions.router)
app.include_router(principal.router)
app.include_router(manager.router)
app.include_router(staff.router)
app.include_router(backup.router)
app.include_router(governance.router)
app.include_router(data_retention.router)
app.include_router(geofences.router)
app.include_router(attendance.router)
app.include_router(system_control.router)  # Milestone 16: Governance Control Plane





@app.get("/health", tags=["Health"])
@app.get("/api/v1/health", tags=["Health"])
def health():
    return {"status": "ok", "service": "FAFLOW API"}


@app.get("/settings/public", tags=["Settings"])
def public_settings(db = Depends(get_db)):
    """Branding values the frontend reads on load — no auth required since
    this only exposes display customization (app name, accent color),
    nothing sensitive. Lets an institution rebrand the app via .env alone,
    without touching frontend code or rebuilding."""
    from app.services.department_service import list_departments
    depts = list_departments(db)
    return {
        "app_name": settings.APP_NAME,
        "primary_color": settings.PRIMARY_COLOR,
        "periods_per_day": settings.PERIODS_PER_DAY,
        "day_order_max": settings.DAY_ORDER_MAX,
        "departments": [{"id": d.id, "name": d.name, "code": d.code} for d in depts]
    }
