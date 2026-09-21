#!/usr/bin/env bash
# =============================================================================
# FAFLOW — Automatic Linux Configuration & Runner
# =============================================================================
#
# Complete, zero-friction setup and runner for Linux distributions.
# Automatically detects environment, installs/configures backend venv,
# frontend node_modules, .env secrets, database schema/migrations, and launches
# both services with graceful process management.
#
# Usage:
#   bash run_linux.sh [OPTIONS]
#
# Options:
#   --dev            Run in development mode (FastAPI reload + Vite dev server) [Default]
#   --prod           Build frontend and run backend in production mode
#   --setup-only     Run configuration and dependency installation only, do not launch
#   --restore-backup [FILE]  Restore database from backup JSON (defaults to FAFLOW_CORRECTED_BACKUP_2026-09-19.json)
#   --host <ip>      Bind host (default: 0.0.0.0)
#   --port <port>    Backend port (default: 8000)
#   --help           Show this message
#
# =============================================================================

set -e

# ANSI Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Determine Script & Project Directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

MODE="dev"
SETUP_ONLY=false
RESTORE_BACKUP=""
HOST="0.0.0.0"
BACKEND_PORT="8000"
FRONTEND_PORT="5173"

# Parse CLI Arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dev)
      MODE="dev"
      shift
      ;;
    --prod)
      MODE="prod"
      shift
      ;;
    --setup-only)
      SETUP_ONLY=true
      shift
      ;;
    --restore-backup)
      if [[ -n "$2" && "$2" != --* ]]; then
        RESTORE_BACKUP="$2"
        shift 2
      else
        RESTORE_BACKUP="$ROOT_DIR/FAFLOW_CORRECTED_BACKUP_2026-09-19.json"
        shift
      fi
      ;;
    --host)
      HOST="$2"
      shift 2
      ;;
    --port)
      BACKEND_PORT="$2"
      shift 2
      ;;
    --help|-h)
      head -n 25 "$0" | grep -E '^# ' | sed 's/^# //'
      exit 0
      ;;
    *)
      echo -e "${YELLOW}Unknown option: $1. Run with --help for options.${NC}"
      shift
      ;;
  esac
done

echo -e "${BLUE}${BOLD}========================================================================${NC}"
echo -e "${CYAN}${BOLD}                  FAFLOW — LINUX AUTOMATION & RUNNER                   ${NC}"
echo -e "${BLUE}${BOLD}========================================================================${NC}"
echo -e "Mode:       ${GREEN}${MODE}${NC}"
echo -e "Root Dir:   ${ROOT_DIR}"
echo ""

# -----------------------------------------------------------------------------
# 1. System & Dependency Checks
# -----------------------------------------------------------------------------
echo -e "${CYAN}[1/7] Detecting Linux environment & checking tools...${NC}"

if command -v python3 >/dev/null 2>&1; then
  PY_VER=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
  PY_OK=$(python3 -c "import sys; print(1 if sys.version_info >= (3, 11) else 0)")
  if [ "$PY_OK" -eq 1 ]; then
    echo -e "  Python:       ${GREEN}v$PY_VER (OK)${NC}"
  else
    echo -e "  Python:       ${RED}v$PY_VER (Requires 3.11+)${NC}"
    echo -e "  ${YELLOW}Please install Python 3.11+: sudo apt install python3.11 python3.11-venv${NC}"
    exit 1
  fi
else
  echo -e "  Python:       ${RED}Not found${NC}"
  echo -e "  ${YELLOW}Please install Python 3.11+: sudo apt install python3 python3-venv python3-pip${NC}"
  exit 1
fi

if command -v node >/dev/null 2>&1; then
  NODE_VER=$(node -v)
  echo -e "  Node.js:      ${GREEN}$NODE_VER (OK)${NC}"
else
  echo -e "  Node.js:      ${RED}Not found${NC}"
  echo -e "  ${YELLOW}Please install Node.js 18+: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs${NC}"
  exit 1
fi

if command -v npm >/dev/null 2>&1; then
  NPM_VER=$(npm -v)
  echo -e "  npm:          ${GREEN}v$NPM_VER (OK)${NC}"
else
  echo -e "  npm:          ${RED}Not found${NC}"
  exit 1
fi

# -----------------------------------------------------------------------------
# 2. Virtual Environment & Python Dependencies
# -----------------------------------------------------------------------------
echo -e "${CYAN}[2/7] Setting up Python virtual environment...${NC}"
VENV_DIR="$BACKEND_DIR/venv"
if [ ! -d "$VENV_DIR" ]; then
  echo -e "  Creating virtual environment in $VENV_DIR..."
  python3 -m venv "$VENV_DIR"
fi

PYTHON="$VENV_DIR/bin/python3"
PIP="$VENV_DIR/bin/pip"

# Ensure pip is up to date
"$PIP" install --upgrade pip -q

echo -e "  Installing / verifying backend dependencies..."
"$PIP" install -q -r "$BACKEND_DIR/requirements.txt"
echo -e "  Backend dependencies: ${GREEN}OK${NC}"

# -----------------------------------------------------------------------------
# 3. Environment Configuration (.env)
# -----------------------------------------------------------------------------
echo -e "${CYAN}[3/7] Checking environment configuration...${NC}"
ENV_FILE="$BACKEND_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo -e "  Creating default ${YELLOW}.env${NC} for FAFLOW..."
  SECRET_KEY=$("$PYTHON" -c "import secrets; print(secrets.token_hex(32))")
  
  cat > "$ENV_FILE" <<EOF
# FAFLOW Auto-Generated Linux Configuration
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/faflow_db
SECRET_KEY=$SECRET_KEY
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=259200

# Biometric & Mobile Geofence
GEOFENCE_LATITUDE=13.0827
GEOFENCE_LONGITUDE=80.2707
GEOFENCE_RADIUS_METERS=500

# Push Notifications (Generate with scripts/generate_vapid_keys.py if needed)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_CONTACT_EMAIL=admin@faflow.local

ENVIRONMENT=production
CORS_ORIGINS=["*"]
EOF
  echo -e "  Generated:    ${GREEN}$ENV_FILE${NC}"
else
  echo -e "  Found existing: ${GREEN}$ENV_FILE${NC}"
fi

# -----------------------------------------------------------------------------
# 4. Frontend Dependencies
# -----------------------------------------------------------------------------
echo -e "${CYAN}[4/7] Setting up frontend dependencies...${NC}"
cd "$FRONTEND_DIR"
if [ ! -d "node_modules" ]; then
  echo -e "  Running npm install in frontend..."
  npm install --silent
else
  echo -e "  Frontend dependencies already installed: ${GREEN}OK${NC}"
fi

# -----------------------------------------------------------------------------
# 5. Database Schema & Migration Verification
# -----------------------------------------------------------------------------
echo -e "${CYAN}[5/7] Verifying database connectivity and migrations...${NC}"
cd "$ROOT_DIR"
DB_STATUS=$("$PYTHON" -c "
import sys
try:
    from app.database import engine
    from sqlalchemy import text
    with engine.connect() as conn:
        conn.execute(text('SELECT 1'))
    print('CONNECTED')
except Exception as e:
    print(f'ERROR: {e}')
" 2>&1 || true)

if [[ "$DB_STATUS" == *"CONNECTED"* ]]; then
  echo -e "  Database:     ${GREEN}Connected successfully${NC}"
  
  # Run table migrations
  "$PYTHON" -c "
from app.database import Base, engine
import app.models
Base.metadata.create_all(bind=engine)
print('  Database tables verified & initialized.')
" 2>&1 || true

else
  echo -e "  ${YELLOW}Notice: Database is not directly reachable at current DATABASE_URL.${NC}"
  echo -e "  ${YELLOW}If running locally, ensure PostgreSQL is started: sudo systemctl start postgresql${NC}"
  echo -e "  ${YELLOW}Continuing startup; backend will attempt connection on boot.${NC}"
fi

# -----------------------------------------------------------------------------
# 6. Database Restore (Optional or Requested)
# -----------------------------------------------------------------------------
if [ -n "$RESTORE_BACKUP" ]; then
  echo -e "${CYAN}[6/7] Restoring backup payload from: $RESTORE_BACKUP...${NC}"
  if [ -f "$RESTORE_BACKUP" ]; then
    "$PYTHON" -c "
import sys
from app.database import SessionLocal
from app.services.backup_service import restore_backup_from_file

db = SessionLocal()
try:
    print('  Applying backup data to database...')
    res = restore_backup_from_file(db, '$RESTORE_BACKUP', actor_name='LinuxRunner')
    print('  Restore complete:', res)
except Exception as e:
    print('  Restore failed or skipped:', e)
finally:
    db.close()
"
  else
    echo -e "  ${YELLOW}Backup file not found at $RESTORE_BACKUP, skipping restore.${NC}"
  fi
else
  echo -e "${CYAN}[6/7] Backup restore check: ${GREEN}Skipped (no --restore-backup specified)${NC}"
fi

# If setup-only was requested, exit cleanly here
if [ "$SETUP_ONLY" = true ]; then
  echo -e "${GREEN}${BOLD}Setup complete! All configurations and dependencies are ready.${NC}"
  exit 0
fi

# -----------------------------------------------------------------------------
# 7. Launch Services
# -----------------------------------------------------------------------------
echo -e "${CYAN}[7/7] Launching FAFLOW in ${GREEN}${MODE}${CYAN} mode...${NC}"

# Cleanup function to kill all spawned child processes on exit
cleanup() {
  echo ""
  echo -e "${YELLOW}Stopping all FAFLOW processes...${NC}"
  if [ -n "$BACKEND_PID" ]; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  if [ -n "$FRONTEND_PID" ]; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
  wait 2>/dev/null || true
  echo -e "${GREEN}All services stopped cleanly.${NC}"
  exit 0
}

trap cleanup SIGINT SIGTERM EXIT

if [ "$MODE" = "dev" ]; then
  echo -e "  ${BOLD}Starting Backend (Uvicorn Reload) on port $BACKEND_PORT...${NC}"
  cd "$BACKEND_DIR"
  "$PYTHON" -m uvicorn app.main:app --host "$HOST" --port "$BACKEND_PORT" --reload &
  BACKEND_PID=$!

  echo -e "  ${BOLD}Starting Frontend (Vite Dev Server) on port $FRONTEND_PORT...${NC}"
  cd "$FRONTEND_DIR"
  npx vite --host "$HOST" --port "$FRONTEND_PORT" &
  FRONTEND_PID=$!

  echo ""
  echo -e "${GREEN}${BOLD}========================================================================${NC}"
  echo -e "${GREEN}${BOLD}  FAFLOW Development Server is Running!${NC}"
  echo -e "${GREEN}${BOLD}========================================================================${NC}"
  echo -e "  Web Application:  ${CYAN}${BOLD}http://localhost:${FRONTEND_PORT}${NC}"
  echo -e "  Backend API:      ${CYAN}${BOLD}http://localhost:${BACKEND_PORT}${NC}"
  echo -e "  API Docs:         ${CYAN}${BOLD}http://localhost:${BACKEND_PORT}/docs${NC}"
  echo -e "  Mobile Base URL:  ${CYAN}${BOLD}http://<YOUR-LAN-IP>:${BACKEND_PORT}${NC}"
  echo ""
  echo -e "${YELLOW}Press [Ctrl+C] to stop all servers.${NC}"
  echo ""

  # Wait for both processes
  wait "$BACKEND_PID" "$FRONTEND_PID"

elif [ "$MODE" = "prod" ]; then
  echo -e "  Building frontend production bundle..."
  cd "$FRONTEND_DIR"
  npm run build

  echo -e "  Starting Backend in production mode on port $BACKEND_PORT..."
  cd "$BACKEND_DIR"
  "$PYTHON" -m uvicorn app.main:app --host "$HOST" --port "$BACKEND_PORT" --workers 4 &
  BACKEND_PID=$!

  echo ""
  echo -e "${GREEN}${BOLD}========================================================================${NC}"
  echo -e "${GREEN}${BOLD}  FAFLOW Production Server is Running!${NC}"
  echo -e "${GREEN}${BOLD}========================================================================${NC}"
  echo -e "  Backend API:      ${CYAN}${BOLD}http://${HOST}:${BACKEND_PORT}${NC}"
  echo -e "  API Docs:         ${CYAN}${BOLD}http://${HOST}:${BACKEND_PORT}/docs${NC}"
  echo -e "  Frontend Build:   ${CYAN}${BOLD}$FRONTEND_DIR/dist${NC}"
  echo ""
  echo -e "${YELLOW}Press [Ctrl+C] to stop server.${NC}"
  echo ""

  wait "$BACKEND_PID"
fi
