import logging
import os
import time
from fastapi import FastAPI, Depends, Request, HTTPException
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

def sync_postgres_enums():
    """Ensure all required PostgreSQL ENUM types exist and contain all active values.
    Runs with isolation_level='AUTOCOMMIT' because ALTER TYPE ADD VALUE cannot run inside
    a multi-statement transaction block in PostgreSQL.
    """
    logger = logging.getLogger(__name__)
    if engine.dialect.name != "postgresql":
        return

    from sqlalchemy import Enum as SAEnum
    enums_to_sync: dict[str, list[str]] = {}
    for table in Base.metadata.sorted_tables:
        for col in table.columns:
            if isinstance(col.type, SAEnum) and col.type.name:
                name = col.type.name
                values = list(col.type.enums)
                if name not in enums_to_sync:
                    enums_to_sync[name] = list(values)
                else:
                    for v in values:
                        if v not in enums_to_sync[name]:
                            enums_to_sync[name].append(v)

    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        # Also ensure legacy 'role' type has 'governance' if a pre-existing DB used it
        legacy_role_exists = conn.execute(
            text("SELECT 1 FROM pg_type WHERE typname = 'role'")
        ).scalar()
        if legacy_role_exists:
            existing_role_labels = {
                r[0] for r in conn.execute(
                    text("SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'role')")
                ).fetchall()
            }
            if "governance" not in existing_role_labels:
                try:
                    conn.execute(text("ALTER TYPE role ADD VALUE IF NOT EXISTS 'governance'"))
                    logger.info("Added 'governance' to legacy PostgreSQL enum 'role'.")
                except Exception as e:
                    logger.warning("Could not add 'governance' to legacy 'role' enum: %s", e)

        for type_name, values in enums_to_sync.items():
            type_exists = conn.execute(
                text("SELECT 1 FROM pg_type WHERE typname = :name"),
                {"name": type_name}
            ).scalar()

            if not type_exists:
                quoted_vals = ", ".join(f"'{v}'" for v in values)
                sql = f"CREATE TYPE {type_name} AS ENUM ({quoted_vals})"
                conn.execute(text(sql))
                logger.info("Created PostgreSQL enum type '%s' with %d values.", type_name, len(values))
            else:
                existing_labels = {
                    r[0] for r in conn.execute(
                        text("SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = :name)"),
                        {"name": type_name}
                    ).fetchall()
                }
                for v in values:
                    if v not in existing_labels:
                        try:
                            conn.execute(text(f"ALTER TYPE {type_name} ADD VALUE IF NOT EXISTS '{v}'"))
                            logger.info("Added value '%s' to PostgreSQL enum '%s'.", v, type_name)
                        except Exception as e:
                            logger.warning("Could not add '%s' to %s enum: %s", v, type_name, e)


def sync_table_constraints_and_columns():
    """Sync table constraints and missing columns idempotently.
    Guarded by table existence checks so it is completely safe on both fresh and existing DBs.
    """
    logger = logging.getLogger(__name__)
    if engine.dialect.name == "postgresql":
        with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
            try:
                conn.execute(text("""
                    DO $$
                    BEGIN
                        -- 1. Users table constraints
                        IF EXISTS (
                            SELECT 1 FROM information_schema.tables 
                            WHERE table_schema = 'public' AND table_name = 'users'
                        ) THEN
                            IF EXISTS (
                                SELECT 1 FROM pg_constraint WHERE conname = 'chk_user_department_role'
                            ) THEN
                                ALTER TABLE users DROP CONSTRAINT chk_user_department_role;
                            END IF;
                            ALTER TABLE users ADD CONSTRAINT chk_user_department_role CHECK (
                                (role::text IN ('admin', 'teacher') AND department_id IS NOT NULL) OR
                                (role::text IN ('manager', 'lab_staff', 'non_teaching_staff')) OR
                                (role::text IN ('system_admin', 'principal', 'governance') AND department_id IS NULL)
                            );

                            IF EXISTS (
                                SELECT 1 FROM pg_constraint WHERE conname = 'chk_user_identity'
                            ) THEN
                                ALTER TABLE users DROP CONSTRAINT chk_user_identity;
                            END IF;
                            ALTER TABLE users ADD CONSTRAINT chk_user_identity CHECK (
                                (role::text = 'teacher' AND email IS NOT NULL) OR
                                (role::text IN ('admin', 'system_admin', 'principal', 'manager', 'lab_staff', 'non_teaching_staff', 'governance') AND username IS NOT NULL)
                            );

                            IF EXISTS (
                                SELECT 1 FROM pg_constraint WHERE conname = 'chk_admin_level'
                            ) THEN
                                ALTER TABLE users DROP CONSTRAINT chk_admin_level;
                            END IF;
                            ALTER TABLE users ADD CONSTRAINT chk_admin_level CHECK (
                                (role::text = 'admin' AND admin_level IS NOT NULL) OR
                                (role::text IN ('teacher', 'system_admin', 'principal', 'manager', 'lab_staff', 'non_teaching_staff', 'governance') AND admin_level IS NULL)
                            );
                        END IF;

                        -- 2. Timetable slots table constraints (allow multi-staff combined classes)
                        IF EXISTS (
                            SELECT 1 FROM information_schema.tables 
                            WHERE table_schema = 'public' AND table_name = 'timetable_slots'
                        ) THEN
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
                        END IF;

                        -- 3. Ensure default_room_id exists on classes table
                        IF EXISTS (
                            SELECT 1 FROM information_schema.tables 
                            WHERE table_schema = 'public' AND table_name = 'classes'
                        ) THEN
                            IF NOT EXISTS (
                                SELECT 1 FROM information_schema.columns
                                WHERE table_schema = 'public' AND table_name = 'classes' AND column_name = 'default_room_id'
                            ) THEN
                                ALTER TABLE classes ADD COLUMN default_room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL;
                            END IF;
                        END IF;

                        -- 4. Ensure only_my_classes column exists on substitution_preferences
                        IF EXISTS (
                            SELECT 1 FROM information_schema.tables 
                            WHERE table_schema = 'public' AND table_name = 'substitution_preferences'
                        ) THEN
                            IF NOT EXISTS (
                                SELECT 1 FROM information_schema.columns
                                WHERE table_schema = 'public' AND table_name = 'substitution_preferences' AND column_name = 'only_my_classes'
                            ) THEN
                                ALTER TABLE substitution_preferences ADD COLUMN only_my_classes BOOLEAN NOT NULL DEFAULT FALSE;
                            END IF;
                        END IF;
                    END $$;
                """))
            except Exception as e:
                logger.warning("Could not sync PostgreSQL table constraints and columns: %s", e)

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
    """Quick connection probe — returns True if database accepts a connection and executes SELECT 1."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


def wait_for_db_and_init(max_wait_seconds: int = 300) -> None:
    """Wait for PostgreSQL to be ready, then run deterministic 5-stage initialization.
    Stage 1: Connection probe with exponential backoff
    Stage 2: PostgreSQL ENUM sync & creation
    Stage 3: Base.metadata.create_all (create missing tables)
    Stage 4: Table constraints and column sync
    Stage 5: Bootstrap default super admin & governance users
    """
    logger = logging.getLogger(__name__)
    poll_interval = 2
    elapsed = 0

    logger.info("Stage 1: Waiting for PostgreSQL to become ready (timeout %ds)…", max_wait_seconds)
    while not _db_is_ready():
        if elapsed >= max_wait_seconds:
            logger.error(
                "PostgreSQL did not become ready within %ds. "
                "Startup initialization aborted — check DB connectivity.",
                max_wait_seconds,
            )
            return
        logger.warning(
            "PostgreSQL not ready yet. Retrying in %ds… [%ds elapsed / %ds max]",
            poll_interval, elapsed, max_wait_seconds,
        )
        time.sleep(poll_interval)
        elapsed += poll_interval
        poll_interval = min(poll_interval * 2, 10)

    logger.info("PostgreSQL is ready after %ds. Beginning startup initialization.", elapsed)

    # Stage 2: ENUM creation & sync (must happen before create_all for PostgreSQL)
    logger.info("Stage 2: Syncing PostgreSQL ENUM types…")
    try:
        sync_postgres_enums()
    except Exception as e:
        logger.error("Stage 2 ENUM sync failed: %s", e)
        raise

    # Stage 3: Create missing tables (idempotent)
    logger.info("Stage 3: Creating tables via Base.metadata.create_all…")
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        logger.error("Stage 3 Base.metadata.create_all failed: %s", e)
        raise

    # Stage 4: Sync constraints and schema additions
    logger.info("Stage 4: Syncing table constraints and column additions…")
    try:
        sync_table_constraints_and_columns()
    except Exception as e:
        logger.error("Stage 4 constraints sync failed: %s", e)
        raise

    # Stage 5: Seed default users
    logger.info("Stage 5: Bootstrapping super admin and governance users…")
    try:
        with SessionLocal() as _bootstrap_db:
            bootstrap_default_super_admin(_bootstrap_db)
            bootstrap_governance_user(_bootstrap_db)
    except Exception as e:
        logger.error("Stage 5 bootstrap failed: %s", e)
        raise

    logger.info("FAFLOW startup database initialization completed successfully.")


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
    if "https://faflow-android-common.vercel.app" not in origins:
        origins.append("https://faflow-android-common.vercel.app")
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

ROUTERS = [
    auth.router,
    admin.router,
    teachers.router,
    timetable.router,
    leaves.router,
    credits.router,
    notifications.router,
    departments.router,
    subjects.router,
    classes.router,
    rooms.router,
    day_order.router,
    academic_calendar.router,
    campus_operations.router,
    teacher_substitution.router,
    substitutions.router,
    principal.router,
    manager.router,
    staff.router,
    backup.router,
    governance.router,
    data_retention.router,
    geofences.router,
    attendance.router,
    system_control.router,  # Milestone 16: Governance Control Plane
]

for r in ROUTERS:
    app.include_router(r)
    app.include_router(r, prefix="/api")


@app.get("/health", tags=["Health"])
@app.get("/api/health", tags=["Health"])
@app.get("/api/v1/health", tags=["Health"])
def health():
    """Liveness and database readiness probe."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {
            "status": "ok",
            "service": "FAFLOW API",
            "database": "connected",
        }
    except Exception as e:
        logging.getLogger(__name__).warning("Health check DB probe failed: %s", e)
        raise HTTPException(
            status_code=503,
            detail={
                "status": "degraded",
                "service": "FAFLOW API",
                "database": "unreachable",
            },
        )


@app.get("/settings/public", tags=["Settings"])
@app.get("/api/settings/public", tags=["Settings"])
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
