#!/bin/bash

# =============================================================================
# Credits — Production Deployment (Linux/Ubuntu)
# =============================================================================
#
# Automated production setup for Ubuntu/Debian. Installs all dependencies,
# configures PostgreSQL, builds the application, and sets up Nginx +
# Gunicorn as a systemd service.
#
# Prerequisites:
#   - Ubuntu 20.04 LTS or later / Debian 11+
#   - sudo access
#   - Domain name (optional, for SSL/TLS)
#
# Usage:
#   1. Log in to your server as a user with sudo access
#   2. git clone <your-repo>
#   3. cd credits-system
#   4. sudo bash scripts/deploy_linux.sh
#
# =============================================================================

set -e  # Exit on any error

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run with sudo"
        exit 1
    fi
}

# =============================================================================

log_info "Credits - Production Deployment"
log_info "Starting system configuration..."

check_root

log_info "[1/12] Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq

log_info "[2/12] Installing system dependencies..."
apt-get install -y -qq \
    python3 python3-venv python3-dev \
    postgresql postgresql-contrib \
    nodejs npm \
    nginx \
    curl git \
    build-essential libpq-dev

log_info "[3/12] Setting up application user..."
if ! id -u credits >/dev/null 2>&1; then
    useradd -m -d /home/credits -s /bin/bash credits
    log_info "Created user 'credits'"
else
    log_warn "User 'credits' already exists"
fi

APP_DIR="/home/credits/credits-system"
if [ ! -d "$APP_DIR" ]; then
    mkdir -p "$APP_DIR"
    cp -r . "$APP_DIR"
    chown -R credits:credits "$APP_DIR"
fi

log_info "[4/12] Initializing PostgreSQL..."
sudo -u postgres psql -c "CREATE DATABASE credits_db;" 2>/dev/null || log_warn "Database may already exist"

log_info "[5/12] Setting up backend Python environment..."
cd "$APP_DIR/backend"
sudo -u credits python3 -m venv venv
sudo -u credits venv/bin/pip install -q -r requirements.txt

SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")

log_info "[6/12] Creating backend configuration..."
cat > .env <<ENVEOF
DATABASE_URL=postgresql://postgres@localhost/credits_db
SECRET_KEY=$SECRET_KEY
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_CONTACT_EMAIL=admin@example.com
ENVEOF
chmod 600 .env
chown credits:credits .env

log_info "[7/12] Initializing database schema..."
sudo -u postgres psql -d credits_db -f ../database/schema.sql >/dev/null 2>&1 || true

log_info "[8/12] Running pre-flight checks..."
sudo -u credits venv/bin/python3 preflight_check.py

log_info "[9/12] Building frontend..."
cd "$APP_DIR/frontend"
sudo -u credits npm install -q
sudo -u credits npm run build -q

log_info "[10/12] Configuring Gunicorn service..."
cat > /etc/systemd/system/credits-backend.service <<SERVICEEOF
[Unit]
Description=Credits - Backend
After=network.target postgresql.service

[Service]
Type=notify
User=credits
WorkingDirectory=$APP_DIR/backend
Environment="PATH=$APP_DIR/backend/venv/bin"
ExecStart=$APP_DIR/backend/venv/bin/gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 127.0.0.1:8000 --access-logfile - --error-logfile -
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SERVICEEOF

systemctl daemon-reload
systemctl enable credits-backend.service
systemctl start credits-backend.service
log_info "Backend service started"

log_info "[11/12] Configuring Nginx..."
cat > /etc/nginx/sites-available/credits <<'NGINXEOF'
upstream credits_backend {
    server 127.0.0.1:8000;
}

server {
    listen 80;
    server_name _;

    client_max_body_size 100M;

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
        root /home/credits/credits-system/frontend/dist;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # SPA Entrypoint (index.html must not be aggressively cached)
    location / {
        root /home/credits/credits-system/frontend/dist;
        try_files $uri /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header X-Content-Type-Options "nosniff";
        add_header X-Frame-Options "SAMEORIGIN";
    }

    location /api/ {
        proxy_pass http://credits_backend/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/credits /etc/nginx/sites-enabled/credits
rm -f /etc/nginx/sites-enabled/default

nginx -t >/dev/null 2>&1 && systemctl restart nginx
log_info "Nginx configured and restarted"

log_info "[12/12] Running health checks..."
sleep 2
if curl -s http://localhost:8000/health | grep -q "ok"; then
    log_info "Backend is healthy"
else
    log_warn "Could not verify backend health (may still be starting)"
fi

if [ -f "$APP_DIR/frontend/dist/index.html" ]; then
    log_info "Frontend built successfully"
else
    log_warn "Frontend build not found"
fi

cat << 'DONEEOF'

================================================================================
    Deployment Complete!
================================================================================

Your system is now running:
  - Backend (Gunicorn):  http://localhost:8000
  - Frontend (Nginx):    http://localhost
  - Database:            PostgreSQL (localhost:5432)

To access the application:

  1. Open http://<your-domain-or-IP> in your browser
  2. Log in with:
     Username: admin
     Password: admin
  3. You will be required to set a new username and password immediately
  4. Go to "Calendar & Day Order" and set up at least one Academic Year,
     Semester, and a few working days with Day Orders — leave and
     timetable features reject any date with no calendar entry

Service Management:

  View backend logs:      sudo journalctl -u credits-backend -f
  Restart backend:        sudo systemctl restart credits-backend
  Restart Nginx:          sudo systemctl restart nginx
  Check service status:   sudo systemctl status credits-backend
                           sudo systemctl status nginx

SSL/TLS Setup (recommended):

  sudo apt-get install certbot python3-certbot-nginx
  sudo certbot --nginx -d <your-domain>
  sudo systemctl enable certbot.timer

Database Backup:

  Backup:   sudo -u postgres pg_dump -d credits_db > backup.sql
  Restore:  sudo -u postgres psql -d credits_db < backup.sql

Next Steps:

  - Create additional admin accounts via the Settings panel
  - Configure departments, subjects, classes, rooms
  - Set up the Academic Calendar and build the timetable

For troubleshooting, see README.md and DEPLOYMENT.md

================================================================================

DONEEOF
