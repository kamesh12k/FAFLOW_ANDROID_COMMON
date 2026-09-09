# FAFLOW Backend Deployment Guide (Render + Supabase)

This document provides complete instructions for deploying the **FAFLOW** FastAPI backend on **Render** connected to a **Supabase PostgreSQL** database.

---

## 1. Architectural Overview & Startup Initialization

When the FAFLOW backend starts up, it automatically orchestrates a **5-stage idempotent database initialization pipeline** in `app/main.py`:

```
┌───────────────────────────────────────────────────────────────┐
│ Stage 1: Database Connection Probe with Exponential Backoff  │
│          (Polls SELECT 1 up to 300 seconds)                   │
└───────────────────────────────┬───────────────────────────────┘
                                │
┌───────────────────────────────▼───────────────────────────────┐
│ Stage 2: Sync PostgreSQL ENUM Types                           │
│          (Dynamically inspects models and executes            │
│           CREATE TYPE / ALTER TYPE ... ADD VALUE in AUTOCOMMIT)│
└───────────────────────────────┬───────────────────────────────┘
                                │
┌───────────────────────────────▼───────────────────────────────┐
│ Stage 3: Base.metadata.create_all                             │
│          (Creates all tables safely now that all enum types   │
│           are guaranteed to exist)                            │
└───────────────────────────────┬───────────────────────────────┘
                                │
┌───────────────────────────────▼───────────────────────────────┐
│ Stage 4: Table Constraints & Schema Compatibility Sync        │
│          (Idempotent DO $$ block with table existence guards) │
└───────────────────────────────┬───────────────────────────────┘
                                │
┌───────────────────────────────▼───────────────────────────────┐
│ Stage 5: Bootstrap Super Admin & Governance Command Users     │
│          (Seeds default credentials if not already present)   │
└───────────────────────────────┬───────────────────────────────┘
                                │
                                ▼
         FastAPI App Ready & Listening on 0.0.0.0:$PORT
```

### Key Safety Guarantees
- **Works on fresh databases**: On a newly provisioned Supabase instance, all ENUM types are created *before* `create_all` runs. This eliminates `psycopg2.errors.UndefinedObject` errors.
- **Works on existing databases**: All schema modifications use `IF NOT EXISTS` or existence guard checks (`pg_type`, `pg_enum`, `information_schema.tables`, `information_schema.columns`). No existing data is ever dropped.
- **Resilient to database wake-up delays**: If Supabase is paused or restarting, Stage 1 waits with exponential backoff for up to 300 seconds before starting the web server.

---

## 2. Supabase Connection Guidelines

### Connection String Types
Supabase provides two types of database connection strings in **Project Settings -> Database**:

1. **Session Pooler (Port 5432) / Direct Connection**:
   - URL format: `postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`
   - Recommended for FAFLOW because the backend uses prepared statements, session-level isolation, and transaction management.

2. **Transaction Pooler (Port 6543 / PgBouncer)**:
   - URL format: `postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres`
   - If using PgBouncer on port 6543, ensure `?sslmode=require` is appended.

### Connection Pool Configuration
To prevent exhausting Supabase free/nano connection limits (typically 15–30 max connections), FAFLOW is configured with conservative defaults in `app/config.py`:
- `DB_POOL_SIZE = 10`
- `DB_MAX_OVERFLOW = 10`
- `DB_POOL_TIMEOUT = 30`
- `DB_POOL_RECYCLE = 300`

You can override these on Render via environment variables if upgrading your Supabase tier.

---

## 3. Render Service Configuration

### Service Type
Create a **Web Service** on Render connected to your GitHub repository.

### Build and Start Settings
| Setting | Value | Notes |
| :--- | :--- | :--- |
| **Environment** | `Python` | Python 3.11+ |
| **Root Directory** | `backend` | If repository contains unified root |
| **Build Command** | `pip install -r requirements.txt` | Installs dependencies |
| **Start Command** | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` | Uses Render dynamic port |
| **Health Check Path** | `/health` | Responds HTTP 200 when DB is active |

---

## 4. Required Environment Variables on Render

Configure the following under **Environment** in the Render dashboard:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `DATABASE_URL` | Supabase PostgreSQL connection URI | `postgresql://postgres:pass@db.ref.supabase.co:5432/postgres` |
| `SECRET_KEY` | Strong random string (minimum 32 characters) | `openssl rand -hex 32` |
| `ALGORITHM` | JWT signing algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Session validity duration | `43200` (30 days) |
| `FRONTEND_ORIGIN` | Allowed CORS origins (JSON array or string) | `["https://your-frontend.onrender.com"]` |
| `APP_NAME` | Display name of the application | `FAFLOW` |
| `PRIMARY_COLOR` | Theme primary brand color | `#4f46e5` |
| `TIMEZONE` | Institution operational timezone | `Asia/Kolkata` |
| `PERIODS_PER_DAY` | Number of lecture slots per day | `5` |
| `DAY_ORDER_MAX` | Total rotating day orders | `6` |

---

## 5. Verifying Deployment Health

Once the Render deployment finishes:

1. **Check the Startup Logs**:
   Look for the five sequential stages:
   ```text
   INFO:app.main:Stage 1: Waiting for PostgreSQL to become ready (timeout 300s)…
   INFO:app.main:PostgreSQL is ready after 0s. Beginning startup initialization.
   INFO:app.main:Stage 2: Syncing PostgreSQL ENUM types…
   INFO:app.main:Stage 3: Creating tables via Base.metadata.create_all…
   INFO:app.main:Stage 4: Syncing table constraints and column additions…
   INFO:app.main:Stage 5: Bootstrapping super admin and governance users…
   INFO:app.main:FAFLOW startup database initialization completed successfully.
   ```

2. **Probe the Health Check Endpoint**:
   ```bash
   curl -i https://<your-render-service>.onrender.com/health
   ```
   Expected response:
   ```json
   HTTP/1.1 200 OK
   Content-Type: application/json

   {
     "status": "ok",
     "service": "FAFLOW API",
     "database": "connected"
   }
   ```
   If the database is unreachable, the endpoint returns HTTP 503 with `"status": "degraded"` and `"database": "unreachable"`.

3. **Initial Logins**:
   - **System Admin**: Username `admin`, Password `admin` (change immediately on first login).
   - **Governance Center**: Username `governence@26022006`, Password `Governence@26022006`.
