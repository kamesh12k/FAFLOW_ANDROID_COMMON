#!/bin/bash
# =============================================================================
# FAFLOW — Production Auto-Updater Engine (Linux)
# =============================================================================
#
# Automatically fetches the latest updates from Git, creates a pre-update
# database safety snapshot, installs updated dependencies, builds the frontend,
# runs backend preflight checks, reloads the systemd service, and verifies health.
#
# Usage:
#   sudo bash scripts/auto_update.sh [OPTIONS]
#
# Options:
#   --force          Force rebuild and restart even if no new git commits exist
#   --check-only     Check if new commits are available without applying
#   --no-backup      Skip pre-update database backup
#   --branch <name>  Target git branch (default: main)
#   --help           Show this help message
#
# =============================================================================

set -e

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Determine script & repository paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Configuration & Defaults
BRANCH="main"
FORCE_UPDATE=false
CHECK_ONLY=false
SKIP_BACKUP=false
LOG_DIR="/var/log/faflow"
LOG_FILE="$LOG_DIR/updater.log"

# Fallback local log directory if /var/log/faflow is not writable
if [ ! -d "$LOG_DIR" ] && [ "$EUID" -ne 0 ]; then
    LOG_DIR="$REPO_ROOT/logs"
    LOG_FILE="$LOG_DIR/updater.log"
fi

mkdir -p "$LOG_DIR" 2>/dev/null || true

# Logging helper
log() {
    local level="$1"
    local msg="$2"
    local timestamp
    timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
    local color=""

    case "$level" in
        INFO)  color="$GREEN" ;;
        WARN)  color="$YELLOW" ;;
        ERROR) color="$RED" ;;
        STEP)  color="$CYAN" ;;
        *)     color="$NC" ;;
    esac

    echo -e "${color}[$timestamp] [$level] $msg${NC}"
    echo "[$timestamp] [$level] $msg" >> "$LOG_FILE" 2>/dev/null || true
}

show_help() {
    cat << EOF
FAFLOW Linux Auto-Updater
Usage: sudo bash scripts/auto_update.sh [OPTIONS]

Options:
  --force          Force full update and build even if repository is up-to-date
  --check-only     Check if remote updates are available without applying them
  --no-backup      Skip pre-update database backup
  --branch <name>  Specify git branch (default: main)
  -h, --help       Show this help message
EOF
    exit 0
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --force)
            FORCE_UPDATE=true
            shift
            ;;
        --check-only)
            CHECK_ONLY=true
            shift
            ;;
        --no-backup)
            SKIP_BACKUP=true
            shift
            ;;
        --branch)
            BRANCH="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            ;;
        *)
            log "ERROR" "Unknown argument: $1"
            show_help
            ;;
    esac
done

cd "$REPO_ROOT"

log "INFO" "========================================================"
log "INFO" "FAFLOW Auto-Update Process Started (Branch: $BRANCH)"
log "INFO" "Repository Directory: $REPO_ROOT"

# Ensure Git repository exists
if [ ! -d ".git" ]; then
    log "ERROR" "No .git directory found at $REPO_ROOT. Aborting."
    exit 1
fi

# Detect systemd service name (faflow-backend or credits-backend)
SERVICE_NAME="faflow-backend"
if systemctl list-unit-files 2>/dev/null | grep -q "credits-backend.service"; then
    SERVICE_NAME="credits-backend"
fi

# Step 1: Fetch remote changes
log "STEP" "[1/7] Checking for remote updates from origin/$BRANCH..."
git fetch origin "$BRANCH" --quiet

LOCAL_HASH=$(git rev-parse HEAD)
REMOTE_HASH=$(git rev-parse "origin/$BRANCH")

if [ "$LOCAL_HASH" = "$REMOTE_HASH" ] && [ "$FORCE_UPDATE" = false ]; then
    log "INFO" "Repository is already up to date ($LOCAL_HASH). No update required."
    exit 0
fi

if [ "$CHECK_ONLY" = true ]; then
    log "INFO" "Update available! Local: $LOCAL_HASH -> Remote: $REMOTE_HASH"
    exit 0
fi

log "INFO" "Update detected: $LOCAL_HASH -> $REMOTE_HASH"

# Step 2: Safety Database Backup
if [ "$SKIP_BACKUP" = false ]; then
    log "STEP" "[2/7] Creating pre-update database backup..."
    BACKUP_DIR="$REPO_ROOT/backend/backups"
    mkdir -p "$BACKUP_DIR"
    TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
    BACKUP_FILE="$BACKUP_DIR/pre_update_${TIMESTAMP}.sql"

    # Extract DB name from backend/.env if available
    DB_NAME="credits_db"
    if [ -f "$REPO_ROOT/backend/.env" ]; then
        PARSED_DB=$(grep -E '^DATABASE_URL=' "$REPO_ROOT/backend/.env" | sed -E 's/.*\/([^?]+)(\?.*)?/\1/' | tr -d '\r\n')
        if [ -n "$PARSED_DB" ]; then
            DB_NAME="$PARSED_DB"
        fi
    fi

    if command -v pg_dump &>/dev/null; then
        if sudo -u postgres pg_dump -d "$DB_NAME" > "$BACKUP_FILE" 2>/dev/null; then
            log "INFO" "Database backup saved to: $BACKUP_FILE"
        else
            log "WARN" "Automated pg_dump failed. Proceeding with update."
        fi
    else
        log "WARN" "pg_dump not available in path, skipping database snapshot."
    fi
else
    log "INFO" "[2/7] Skipping database backup (--no-backup passed)."
fi

# Step 3: Check which components changed
CHANGED_FILES=$(git diff --name-only "$LOCAL_HASH" "origin/$BRANCH" 2>/dev/null || echo "ALL")
PYTHON_CHANGED=false
FRONTEND_CHANGED=false

if echo "$CHANGED_FILES" | grep -qE '^backend/(requirements\.txt|app/|database/)'; then
    PYTHON_CHANGED=true
fi
if echo "$CHANGED_FILES" | grep -qE '^frontend/(package\.json|package-lock\.json|src/|index\.html|vite\.config)'; then
    FRONTEND_CHANGED=true
fi

if [ "$FORCE_UPDATE" = true ]; then
    PYTHON_CHANGED=true
    FRONTEND_CHANGED=true
fi

# Step 4: Pull git updates
log "STEP" "[3/7] Pulling changes from origin/$BRANCH..."
git pull origin "$BRANCH" --quiet
NEW_HASH=$(git rev-parse HEAD)
log "INFO" "Successfully updated codebase to commit $NEW_HASH"

# Step 5: Update Python Backend Dependencies
log "STEP" "[4/7] Updating backend Python environment..."
cd "$REPO_ROOT/backend"

PYTHON_BIN="python3"
if [ -d "venv/bin" ]; then
    PYTHON_BIN="venv/bin/python3"
    PIP_BIN="venv/bin/pip"
elif [ -d "venv/Scripts" ]; then
    PYTHON_BIN="venv/Scripts/python.exe"
    PIP_BIN="venv/Scripts/pip.exe"
else
    log "WARN" "No virtualenv found at backend/venv. Using system python3."
    PIP_BIN="pip3"
fi

if [ "$PYTHON_CHANGED" = true ] && [ -f "requirements.txt" ]; then
    log "INFO" "Installing/updating Python dependencies..."
    $PIP_BIN install -q --no-cache-dir -r requirements.txt || {
        log "WARN" "Pip install reported warnings or errors. Continuing..."
    }
fi

    # Ensure VAPID keys exist in .env for Web Push Notifications
    if ! grep -q "VAPID_PUBLIC_KEY=" .env 2>/dev/null || [ -z "$(grep "VAPID_PUBLIC_KEY=" .env 2>/dev/null | cut -d= -f2)" ]; then
        log "INFO" "Generating Web Push VAPID keys..."
        $PYTHON_BIN scripts/generate_vapid_keys.py 2>/dev/null || true
    fi

    # Run preflight checks if present
    if [ -f "preflight_check.py" ]; then
        log "INFO" "Running backend pre-flight configuration checks..."
        $PYTHON_BIN preflight_check.py || {
            log "WARN" "Preflight check warning encountered. Please verify .env settings."
        }
    fi

# Step 6: Update & Build Frontend
log "STEP" "[5/7] Checking frontend build..."
cd "$REPO_ROOT/frontend"

if [ "$FRONTEND_CHANGED" = true ] || [ ! -d "dist" ]; then
    log "INFO" "Frontend changes detected. Rebuilding production bundle..."
    if command -v npm &>/dev/null; then
        npm install --silent --no-audit --no-fund 2>/dev/null || npm install --silent
        npm run build --silent || {
            log "ERROR" "Frontend compilation failed! Please inspect frontend logs."
            exit 1
        }
        log "INFO" "Frontend build completed successfully."

        # If Nginx web root directory exists (e.g. /var/www/faflow), sync compiled dist files
        for web_root in "/var/www/faflow" "/var/www/credits"; do
            if [ -d "$web_root" ] && [ ! -L "$web_root" ]; then
                log "INFO" "Syncing compiled assets to $web_root..."
                cp -r "$REPO_ROOT/frontend/dist/"* "$web_root/" 2>/dev/null || true
            fi
        done
    else
        log "ERROR" "Node.js/npm not found. Could not build frontend."
    fi
else
    log "INFO" "Frontend has no changes. Skipping rebuild."
fi

# Step 7: Restart Application Services
log "STEP" "[6/7] Restarting backend service ($SERVICE_NAME)..."
cd "$REPO_ROOT"

if command -v systemctl &>/dev/null; then
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        systemctl restart "$SERVICE_NAME"
        log "INFO" "Service $SERVICE_NAME restarted."
    else
        log "WARN" "Service $SERVICE_NAME is not currently running. Attempting to start..."
        systemctl start "$SERVICE_NAME" 2>/dev/null || true
    fi

    # Reload Nginx if present and active
    if systemctl is-active --quiet nginx; then
        if nginx -t 2>/dev/null; then
            systemctl reload nginx 2>/dev/null || systemctl restart nginx 2>/dev/null
            log "INFO" "Nginx configuration verified and reloaded."
        fi
    fi
else
    log "WARN" "systemctl not available in this environment. Please restart your backend server manually."
fi

# Step 8: Health Check Verification
log "STEP" "[7/7] Verifying backend health..."
sleep 2

HEALTH_CHECK_URL="http://127.0.0.1:8000/health"
HEALTHY=false

for i in {1..5}; do
    if curl -s -f "$HEALTH_CHECK_URL" | grep -qE "ok|OK|true|status" 2>/dev/null; then
        HEALTHY=true
        break
    fi
    sleep 2
done

if [ "$HEALTHY" = true ]; then
    log "INFO" "✅ Update verified! Backend health check responded OK (HTTP 200)."
    log "INFO" "FAFLOW Auto-Update Completed Successfully to version $NEW_HASH."
else
    log "WARN" "⚠️ Backend health check did not respond on $HEALTH_CHECK_URL immediately. Please verify with: sudo journalctl -u $SERVICE_NAME -n 30"
fi

log "INFO" "========================================================"
exit 0
