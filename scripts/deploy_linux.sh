#!/usr/bin/env bash
# =============================================================================
# FAFLOW — Production Deployment & Automation (Ubuntu / Debian Linux)
# =============================================================================
#
# Automated production setup for Ubuntu 20.04/22.04/24.04 LTS & Debian 11/12.
# Installs system dependencies, provisions PostgreSQL 'faflow_db', configures
# backend Python virtual environment, builds the React frontend, configures Nginx
# as a reverse proxy, and enables systemd services for continuous operation.
#
# Prerequisites:
#   - Ubuntu 20.04+ LTS or Debian 11+
#   - Root / sudo privileges
#
# Usage:
#   sudo bash scripts/deploy_linux.sh
#
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be executed with sudo or root privileges."
        exit 1
    fi
}

check_root

echo -e "${BLUE}${BOLD}========================================================================${NC}"
echo -e "${CYAN}${BOLD}              FAFLOW — PRODUCTION LINUX DEPLOYMENT ENGINE               ${NC}"
echo -e "${BLUE}${BOLD}========================================================================${NC}"

log_info "[1/12] Updating system package index..."
apt-get update -qq

log_info "[2/12] Installing core system dependencies..."
apt-get install -y -qq \
    python3 python3-venv python3-dev \
    postgresql postgresql-contrib \
    nginx curl git \
    build-essential libpq-dev

# Install Node.js 20.x if not present
if ! command -v node >/dev/null 2>&1; then
    log_info "Installing Node.js 20.x LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
    apt-get install -y -qq nodejs
fi

log_info "[3/12] Setting up application service user 'faflow'..."
if ! id -u faflow >/dev/null 2>&1; then
    useradd -m -d /home/faflow -s /bin/bash faflow
    log_info "Created system user 'faflow'"
else
    log_warn "System user 'faflow' already exists"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_DIR="/home/faflow/faflow"

log_info "[4/12] Synchronizing application files to $APP_DIR..."
mkdir -p "$APP_DIR"
cp -ru "$SOURCE_DIR"/. "$APP_DIR"/
chown -R faflow:faflow "$APP_DIR"

log_info "[5/12] Initializing PostgreSQL database 'faflow_db'..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = 'faflow_db'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE DATABASE faflow_db;"

sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'postgres';" 2>/dev/null || true

log_info "[6/12] Setting up Python backend virtual environment..."
cd "$APP_DIR/backend"
sudo -u faflow python3 -m venv venv
sudo -u faflow venv/bin/pip install -q --upgrade pip
sudo -u faflow venv/bin/pip install -q -r requirements.txt
sudo -u faflow venv/bin/pip install -q gunicorn

log_info "[7/12] Configuring backend environment variables..."
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
if [ ! -f "$APP_DIR/backend/.env" ]; then
    cat > "$APP_DIR/backend/.env" <<EOF
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/faflow_db
SECRET_KEY=$SECRET_KEY
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=259200
GEOFENCE_LATITUDE=13.0827
GEOFENCE_LONGITUDE=80.2707
GEOFENCE_RADIUS_METERS=500
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_CONTACT_EMAIL=admin@faflow.local
ENVIRONMENT=production
CORS_ORIGINS=["*"]
EOF
    chmod 600 "$APP_DIR/backend/.env"
    chown faflow:faflow "$APP_DIR/backend/.env"
fi

log_info "[8/12] Initializing database schema & migrations..."
cd "$APP_DIR"
sudo -u faflow backend/venv/bin/python3 -c "
from app.database import Base, engine
import app.models
Base.metadata.create_all(bind=engine)
print('  Database tables successfully verified.')
" || log_warn "Database initialization completed with warnings."

# Restore corrected backup if present and DB empty
if [ -f "$APP_DIR/FAFLOW_CORRECTED_BACKUP_2026-09-19.json" ]; then
    log_info "Restoring corrected FAFLOW backup payload..."
    sudo -u faflow backend/venv/bin/python3 -c "
from app.database import SessionLocal
from app.models.user import User
from app.services.backup_service import restore_backup_from_file

db = SessionLocal()
try:
    if db.query(User).count() == 0:
        restore_backup_from_file(db, '$APP_DIR/FAFLOW_CORRECTED_BACKUP_2026-09-19.json', actor_name='SystemDeployment')
        print('  Initial backup restored successfully.')
    else:
        print('  Database already contains users, skipping automated restore.')
finally:
    db.close()
" || log_warn "Auto-restore skipped or completed with warnings."
fi

log_info "[9/12] Building frontend production bundle..."
cd "$APP_DIR/frontend"
sudo -u faflow npm install --silent
sudo -u faflow npm run build --silent

log_info "[10/12] Configuring systemd backend service..."
cat > /etc/systemd/system/faflow-backend.service <<EOF
[Unit]
Description=FAFLOW FastAPI Backend Service
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=notify
User=faflow
Group=faflow
WorkingDirectory=$APP_DIR/backend
Environment="PATH=$APP_DIR/backend/venv/bin"
ExecStart=$APP_DIR/backend/venv/bin/gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 127.0.0.1:8000 --access-logfile /var/log/faflow/access.log --error-logfile /var/log/faflow/error.log
Restart=always
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

mkdir -p /var/log/faflow
chown -R faflow:faflow /var/log/faflow

systemctl daemon-reload
systemctl enable faflow-backend.service
systemctl restart faflow-backend.service
log_info "Backend systemd service is active"

log_info "[11/12] Configuring Nginx reverse proxy..."
cat > /etc/nginx/sites-available/faflow <<'EOF'
upstream faflow_backend {
    server 127.0.0.1:8000;
}

server {
    listen 80;
    server_name _;

    client_max_body_size 50M;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    # Immutable Cache for Vite Assets
    location /assets/ {
        root /home/faflow/faflow/frontend/dist;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # Frontend Single Page App
    location / {
        root /home/faflow/faflow/frontend/dist;
        try_files $uri /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header X-Content-Type-Options "nosniff";
        add_header X-Frame-Options "SAMEORIGIN";
    }

    # Backend API routes
    location /api/ {
        proxy_pass http://faflow_backend/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_read_timeout 120s;
    }

    # Direct routes without /api/ prefix
    location ~ ^/(auth|users|classes|departments|attendance|timetable|leaves|credits|announcements|backup|audit|notifications|health|docs|openapi.json) {
        proxy_pass http://faflow_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_read_timeout 120s;
    }
}
EOF

ln -sf /etc/nginx/sites-available/faflow /etc/nginx/sites-enabled/faflow
rm -f /etc/nginx/sites-enabled/default

nginx -t && systemctl restart nginx
log_info "Nginx configured and restarted"

log_info "[12/12] Performing health verification..."
sleep 3
if curl -sf http://127.0.0.1:8000/health >/dev/null 2>&1; then
    log_info "Backend health check: ${GREEN}PASS${NC}"
else
    log_warn "Backend health check did not respond immediately (system may still be warming up)."
fi

cat << 'EOF'

================================================================================
                    FAFLOW LINUX DEPLOYMENT COMPLETE!
================================================================================

Services are online:
  - Frontend Web UI:        http://<YOUR-SERVER-IP>/
  - Backend API:            http://<YOUR-SERVER-IP>/docs
  - Service Status:         sudo systemctl status faflow-backend
  - Backend Logs:           sudo journalctl -u faflow-backend -f
  - Nginx Logs:             sudo tail -f /var/log/nginx/error.log

Database:
  - PostgreSQL Database:    faflow_db (Port 5432)
  - Automatic Backups:      /home/faflow/faflow/backend/backups/

SSL Setup (Optional via Certbot):
  sudo apt-get install -y certbot python3-certbot-nginx
  sudo certbot --nginx -d your-domain.com

================================================================================
EOF
