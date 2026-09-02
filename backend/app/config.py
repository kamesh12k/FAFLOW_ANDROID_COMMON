from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration. Values here can be overridden via
    environment variables or `.env` without touching code — see
    `.env.example` for every supported key.

    Two customization tiers, by design:
      - PERIODS_PER_DAY / DAY_ORDER_MAX below are read by the application
        layer (Pydantic validators in schemas/, the Day Order rotation
        engine in services/day_order_service.py) and take effect the
        moment you change the env var and restart the backend.
      - The database itself also enforces period_number/day_order ranges
        via CHECK constraints (chk_timetable_period_number,
        chk_leave_period_number, the day_order BETWEEN 1 AND 6 check on
        calendar_days) as a hard backstop against bad data even if a
        future code change has a bug. Those are NOT read from this
        settings object — changing PERIODS_PER_DAY here without also
        running a migration to widen the matching CHECK constraint will
        cause the database to reject any period number outside the
        *original* 1-5 range. See database/README.md for the migration
        template if you need to change these ranges for real.
    """

    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # ---------- Customization: schedule shape ----------
    PERIODS_PER_DAY: int = 5
    DAY_ORDER_MAX: int = 6

    # ---------- Customization: branding / look ----------
    APP_NAME: str = "FAFLOW"
    PRIMARY_COLOR: str = "#4f46e5"  # Tailwind indigo-600; surfaced to the frontend via /settings/public

    # ---------- Customization: deployment ----------
    FRONTEND_ORIGIN: List[str] = ["http://localhost:5173"]
    MAX_SECONDARY_ADMINS: int = 3
    TIMEZONE: str = "Asia/Kolkata"

    # ---------- Database Connection Pool ----------
    DB_POOL_SIZE: int = 50
    DB_MAX_OVERFLOW: int = 30
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_RECYCLE: int = 300

    # ---------- Backup & Restore ----------
    # Directory for backup files (relative to backend root, or absolute).
    BACKUP_STORAGE_PATH: str = "./backups"
    # Soft maximum number of user-created backups to keep (pre-restore backups excluded).
    BACKUP_RETENTION_COUNT: int = 50
    # Maximum allowed backup file size in megabytes.
    BACKUP_MAX_SIZE_MB: int = 500

    # ---------- Web Push (VAPID) ----------
    VAPID_PUBLIC_KEY: str = ""
    VAPID_PRIVATE_KEY: str = ""
    VAPID_CLAIM_EMAIL: str = "mailto:admin@faflow.local"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
