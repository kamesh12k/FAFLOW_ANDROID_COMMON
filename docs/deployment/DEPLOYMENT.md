# Deployment Guide — Credits

Two paths through this guide:
- **[Run it on your own computer](#run-it-on-your-own-computer)** — for trying it out or developing
- **[Deploy it to a real server](#deploy-it-to-a-real-server)** — for actually putting it in front of users

Both need the same three pieces: a PostgreSQL database, the FastAPI backend, and the React frontend.

---

## Prerequisites

| Tool | Version | What it's for |
|---|---|---|
| Python | 3.11+ (3.14 supported) | Runs the backend |
| Node.js | 18+ | Builds the frontend |
| PostgreSQL | 14+ | Stores the data |
| Git | any | Getting the code |

---

## Run it on your own computer

### Option A: Using Windows Launcher Scripts (Recommended)

FAFLOW comes with automated Windows launcher scripts located in the project root for quick startup:

*   **Development Mode Launcher (`StartDev.bat`)**:
    Automatically verifies prerequisites (Git, Python, Node), creates a virtual environment, installs backend/frontend dependencies, configures `.env`, performs pre-flight database schema checks, and launches both servers in the background with hot-reloading enabled.
*   **Production Deployment Launcher (`StartProd.bat`)**:
    Performs production frontend compilation (`npm run build`), installs dependencies, runs pre-flight database verification, initializes a clean database (without demo data), and runs high-performance production server workers.
*   **Local Network (LAN) Auto-Detection**:
    At launch completion, both scripts automatically query your active system network adapter to display the exact **Local URL** (e.g. `http://localhost:5173`) and **Network URLs** (e.g. `http://172.23.251.207:5173`) for easy browser access from mobile devices or other computers on the same network.
*   **Dynamic CORS & Telemetry**:
    The backend automatically registers detected local IPs on startup as allowed CORS origins, while the frontend adapts its API baseURL to the client's current hostname on port `8000`.
*   **Stopping & Restarting**:
    - Use `StopDev.bat` / `RestartDev.bat` to manage development services.
    - Use `StopProd.bat` / `RestartProd.bat` to manage production deployment services.

Simply double-click the desired script to execute it.

### Option B: Manual Setup (Mac/Linux/Windows)

#### 1. Create the database

```bash
# Install PostgreSQL if you don't have it:
#   macOS:  brew install postgresql@16 && brew services start postgresql@16
#   Ubuntu: sudo apt install postgresql && sudo systemctl start postgresql

createdb credits_db
psql -d credits_db -f database/schema.sql  # sets up the full, latest schema directly
psql -d credits_db -f database/seed.sql    # optional — adds sample teachers/classes so the app isn't empty
```

### 2. Start the backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Open .env and fill in:
#   DATABASE_URL  — should already match the database you just created
#   SECRET_KEY    — generate one with: python3 -c "import secrets; print(secrets.token_hex(32))"

python3 preflight_check.py      # catches config mistakes before you start the server
uvicorn app.main:app --reload --port 8000
```

The backend is now running at `http://localhost:8000` — API docs are at `http://localhost:8000/docs`.

### 3. Start the frontend

In a **second terminal**:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. It automatically talks to the backend on port 8000 (configured in `vite.config.js`).

### 4. Log in for the first time

1. Username `admin`, password `admin`.
2. You'll be forced to set a real username and password immediately — that's intentional, the dashboard stays locked until you do.
3. Go to **Calendar & Day Order** and add at least one Academic Year, Semester, and a few working days with Day Orders assigned. Leave requests and timetable entries are rejected for any date that hasn't been marked on the calendar yet — this is the most common "why isn't this working" moment for a fresh install.

That's it — you have a working local copy.

---

## Deploy it to a real server

### Option A — Automated script (Linux)

If you're deploying to a fresh Ubuntu/Debian server, `scripts/deploy_linux.sh` does steps 1-6 below for you in one go: installs dependencies, creates the database, generates a secret key, builds the frontend, and sets up Nginx + a systemd service.

```bash
git clone <your-repo-url> credits-system
cd credits-system
sudo bash scripts/deploy_linux.sh
```

Read through the script first if you want to understand what it's doing — it assumes a single server running everything (database, backend, frontend) together. The manual steps below are what it automates, useful if you're deploying differently (managed database, separate frontend host, Docker, etc).

A Windows equivalent, `scripts/deploy_windows.bat`, handles local setup but not full production hosting (Windows Server deployments vary too much to script generically) — use it to prep the environment, then follow the manual steps for actually serving the app.

### Option B — Manual steps

**1. Set up the database.** Either a managed provider (Render, Railway, Supabase, RDS, etc.) or self-hosted:

```sql
-- Self-hosted: create a dedicated, limited-privilege app user
CREATE USER credits_app WITH PASSWORD 'use-a-strong-password-here';
CREATE DATABASE credits_db OWNER credits_app;
GRANT ALL PRIVILEGES ON DATABASE credits_db TO credits_app;
```

```bash
psql "<your-connection-string>" -f database/schema.sql
# Do NOT run seed.sql here — it creates demo accounts you don't want in production.
```

Upgrading an existing installation instead of starting fresh? Run whichever migrations bring you up to date:
```bash
psql -d credits_db -f database/migrations/002_add_rbac_and_audit.sql   # from v1 to v1.1
psql -d credits_db -f database/migrations/003_academic_calendar.sql    # from v1.1 to v2
psql -d credits_db -f database/migrations/004_autonomous_substitution.sql # from v2 to v3
psql -d credits_db -f database/migrations/005_add_cancelled_leave_status.sql # from v3 to v3.1
psql -d credits_db -f database/migrations/006_multi_department.sql     # from v3.1 to v3.2 (multi-department)
```

**2. Run the backend with a real server process** (not `--reload`, which is dev-only):

```bash
pip install gunicorn
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
```

Before going live, update CORS in `backend/app/main.py` (or via the `FRONTEND_ORIGIN` setting — see `.env.example`) to your real frontend domain instead of `localhost`.

Prefer containers? A minimal Dockerfile:
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["gunicorn", "app.main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000"]
```

**3. Build and serve the frontend:**

```bash
cd frontend
npm run build   # outputs static files to frontend/dist/
```

Serve `frontend/dist/` and proxy `/api/*` to the backend from the same Nginx host, so the frontend's existing relative API path keeps working unchanged:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    root /var/www/credits/dist;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host $host;
    }
}
```

(Hosting frontend and backend on separate domains instead? Change `baseURL` in `frontend/src/api/client.js` to the backend's full URL and rebuild.)

**4. Add HTTPS** once your domain points at the server:
```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
sudo systemctl enable certbot.timer   # auto-renewal
```

---

## Environment variables reference

| Variable | What it does | Example / default |
|---|---|---|
| `DATABASE_URL` | Where the database lives | `postgresql://user:pass@host:5432/credits_db` |
| `SECRET_KEY` | Signs login tokens — **must** be long and random in production | generate with `python3 -c "import secrets; print(secrets.token_hex(32))"` |
| `ALGORITHM` | Token signing algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | How long someone stays logged in | `60` |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_CONTACT_EMAIL` | Optional — enables browser push notifications | leave blank to disable |
| `PERIODS_PER_DAY` | How many class periods exist in a day | `5` |
| `DAY_ORDER_MAX` | How many Day Orders the rotation cycles through | `6` |
| `APP_NAME` | Shown on the login screen, sidebar, and browser tab | `Credits` |
| `PRIMARY_COLOR` | Accent color used throughout the UI | `#4f46e5` |
| `FRONTEND_ORIGIN` | Which domain is allowed to call the backend (CORS) | `http://localhost:5173` |
| `MAX_SECONDARY_ADMINS` | Cap on how many Secondary Admin accounts can exist | `3` |

`PERIODS_PER_DAY` and `DAY_ORDER_MAX` only change validation in the application — the database also enforces these ranges at a lower level as a safety net, and widening that requires an actual migration. See `database/README.md` if you need to change these for real, not just the defaults.

The frontend needs no `.env` for local development — Vite's proxy handles routing automatically.

---

---

## IT Administrator Hosting Guide: Internet & Existing Domain Integration

This guide provides step-by-step instructions for IT administrators, system engineers, and network administrators to host FAFLOW on the public internet, attach SSL/TLS certificates, and integrate FAFLOW into an existing college website.

---

### System Architecture & Ports Overview

In production, FAFLOW runs behind **Nginx** (acting as a reverse proxy, SSL termination node, and static file server) connected to a **Gunicorn + Uvicorn** FastAPI backend and a **PostgreSQL** database:

```
[ Internet Client ]
       │  (HTTPS 443 / SSL)
       ▼
[ Nginx Reverse Proxy & Static Host ]
       │
       ├──► Serves Static SPA (frontend/dist/)
       │
       └──► Proxies API Requests (http://127.0.0.1:8000) ──► [ Gunicorn/FastAPI ] ──► [ PostgreSQL ]
```

| Component | Default Port | Internal/External | Recommended Production Service |
|---|---|---|---|
| **Nginx Web Server** | `80` (HTTP), `443` (HTTPS) | Public | Nginx Systemd Service |
| **FastAPI Backend** | `8000` | Localhost Only (`127.0.0.1`) | Gunicorn + Uvicorn Workers |
| **PostgreSQL Database** | `5432` | Localhost / Private Subnet | PostgreSQL 14+ / Managed Service |

---

### Scenario A: Hosting on a Dedicated Subdomain (Recommended)
*Example: `https://faflow.yourcollege.edu` or `https://faculty.yourcollege.edu`*

#### Step 1: DNS & Domain Record Setup
1. In your domain provider (Cloudflare, GoDaddy, Namecheap, or College DNS Server), add an **A Record**:
   - **Host / Name**: `faflow` (or `faculty`)
   - **Value / IP**: Your Server's Public IPv4 Address (e.g. `203.0.113.45`)
   - **TTL**: Auto / 300s

#### Step 2: Configure Systemd Service for Backend
Create `/etc/systemd/system/faflow-backend.service`:

```ini
[Unit]
Description=FAFLOW FastAPI Backend Service
After=network.target postgresql.service

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/faflow/backend
EnvironmentFile=/var/www/faflow/backend/.env
ExecStart=/var/www/faflow/backend/venv/bin/gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 127.0.0.1:8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start the backend service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable faflow-backend
sudo systemctl start faflow-backend
sudo systemctl status faflow-backend
```

#### Step 3: Nginx Subdomain Configuration
Create `/etc/nginx/sites-available/faflow.conf`:

```nginx
server {
    listen 80;
    server_name faflow.yourcollege.edu;

    # Root directory for compiled React build
    root /var/www/faflow/frontend/dist;
    index index.html;

    # Client upload size limit for documents/excel
    client_max_body_size 25M;

    # Modern Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 256;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/x-javascript
        application/xml
        application/xml+rss
        image/svg+xml;

    # Immutable Cache for Hashed Vite Assets (/assets/*.js, /assets/*.css)
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # Frontend Single-Page Application fallback
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header X-Content-Type-Options "nosniff";
        add_header X-Frame-Options "SAMEORIGIN";
    }

    # Proxy API calls directly to Gunicorn/Uvicorn backend
    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Link configuration and test Nginx syntax:
```bash
sudo ln -s /etc/nginx/sites-available/faflow.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### Step 4: Secure with Let's Encrypt SSL (HTTPS)
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d faflow.yourcollege.edu
```

---

### Scenario B: Hosting Under Existing College Website Subpath
*Example: Hosting FAFLOW under `https://yourcollege.edu/faflow/`*

If your college already has an active main website running on `yourcollege.edu`, you can host FAFLOW seamlessly under a subpath `/faflow/`.

#### Step 1: Configure Frontend Base Path
In `frontend/vite.config.js` or build environment, specify the base path:
```bash
cd frontend
npm run build -- --base=/faflow/
```

#### Step 2: Update Nginx Location Blocks on Existing Website
In your main website's Nginx configuration `/etc/nginx/sites-available/yourcollege.conf`:

```nginx
server {
    listen 443 ssl http2;
    server_name yourcollege.edu;

    # ... Existing college website configuration ...

    # ── FAFLOW Application Subpath ──
    location /faflow/ {
        alias /var/www/faflow/frontend/dist/;
        try_files $uri $uri/ /faflow/index.html;
    }

    # ── FAFLOW API Subpath ──
    location /faflow/api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Reload Nginx:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

#### Step 3: Backend CORS Environment Variable
In `backend/.env`, set `FRONTEND_ORIGIN` to match your college domain:
```env
FRONTEND_ORIGIN=https://yourcollege.edu
```

---

### Scenario C: Hosting Behind Cloudflare / Reverse Proxy Load Balancer

If FAFLOW is hosted behind Cloudflare or a Hardware Load Balancer (F5 / Fortinet):

1. **SSL Mode**: Set Cloudflare SSL/TLS encryption mode to **Full (Strict)**.
2. **Real IP Headers**: Ensure Nginx restores the real client IP:
   ```nginx
   set_real_ip_from 103.21.244.0/22;
   set_real_ip_from 103.31.4.0/22;
   # ... add Cloudflare IP ranges ...
   real_ip_header CF-Connecting-IP;
   ```

---

### Automated Database Backup Cron Job

Create a daily automated PostgreSQL database backup script `/var/www/faflow/scripts/backup_db.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/var/www/faflow/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p $BACKUP_DIR

pg_dump -U credits_app -h localhost credits_db | gzip > "$BACKUP_DIR/faflow_backup_$TIMESTAMP.sql.gz"

# Keep last 30 days of backups
find $BACKUP_DIR -type f -name "*.sql.gz" -mtime +30 -delete
```

Add to system crontab (`crontab -e`):
```cron
0 2 * * * /bin/bash /var/www/faflow/scripts/backup_db.sh
```

---

## Post-deployment checklist

- [ ] `SECRET_KEY` is unique and at least 32 characters — not the placeholder from `.env.example`
- [ ] `FRONTEND_ORIGIN` / CORS is set to your real domain, not `localhost`
- [ ] `seed.sql` was **not** run against this database
- [ ] HTTPS is enabled on both frontend and backend
- [ ] Database backups are scheduled
- [ ] At least one Academic Year, Semester, and some working days with Day Orders exist before anyone tries to apply for leave or build a timetable
- [ ] `backend/backups/` and `backend/logs/` exist and are writable (Factory Reset needs them)

---

## If something goes wrong

**`pip install` fails on Python 3.13/3.14** — see the Troubleshooting section in `README.md`; the short version is `pip install --upgrade -r requirements.txt` to make sure you're getting current package releases, not stale cached ones.

**Backend won't start / config errors** — run `python3 manage.py verify` from inside `backend/`. It checks your `.env`, database connection, and schema before you waste time chasing a confusing stack trace.

**Locked out of the admin account entirely** — `cd backend && python3 scripts/factory_reset.py`. This wipes all data and resets to the bootstrap `admin`/`admin` login, so only use it as a last resort. A backup is written automatically first.

**Anything else** — `README.md` has a fuller troubleshooting section, and `database/README.md` covers schema/migration-specific issues.

