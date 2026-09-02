#!/bin/bash
# =============================================================================
# FAFLOW — Linux Auto-Updater Installation Script
# =============================================================================
#
# Sets up automated periodic background updates via systemd timer and logrotate.
#
# Usage:
#   sudo bash scripts/setup_auto_updater.sh [INTERVAL_MINUTES]
#
# Default interval: 5 minutes (checks git remote, pulls & rebuilds only on change)
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}[ERROR] This installation script must be run as root (use sudo).${NC}" 
   exit 1
fi

INTERVAL="${1:-5}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo -e "${CYAN}========================================================"
echo -e "FAFLOW — Auto-Updater Installation"
echo -e "Repository Root : $REPO_ROOT"
echo -e "Update Interval : Every $INTERVAL minutes"
echo -e "========================================================${NC}"

# 1. Make updater script executable
chmod +x "$REPO_ROOT/scripts/auto_update.sh"

# 2. Create log directory & logrotate configuration
mkdir -p /var/log/faflow
chmod 755 /var/log/faflow

cat > /etc/logrotate.d/faflow-updater <<LOGROTATE_EOF
/var/log/faflow/updater.log {
    weekly
    rotate 8
    compress
    missingok
    notifempty
    copytruncate
}
LOGROTATE_EOF

# 3. Create dynamic systemd service file with absolute paths
cat > /etc/systemd/system/faflow-updater.service <<SERVICE_EOF
[Unit]
Description=FAFLOW Automatic System Updater
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=root
WorkingDirectory=$REPO_ROOT
ExecStart=/bin/bash $REPO_ROOT/scripts/auto_update.sh
StandardOutput=append:/var/log/faflow/updater.log
StandardError=append:/var/log/faflow/updater.log

[Install]
WantedBy=multi-user.target
SERVICE_EOF

# 4. Create dynamic systemd timer file
cat > /etc/systemd/system/faflow-updater.timer <<TIMER_EOF
[Unit]
Description=FAFLOW Periodic Auto-Update Timer
After=network-online.target

[Timer]
OnBootSec=2min
OnUnitActiveSec=${INTERVAL}min
Persistent=true

[Install]
WantedBy=timers.target
TIMER_EOF

# 5. Reload systemd daemon, enable and start timer
systemctl daemon-reload
systemctl enable --now faflow-updater.timer

echo -e "${GREEN}✔ Auto-updater timer successfully installed and activated!${NC}"
echo ""
echo -e "Useful management commands:"
echo -e "  • Check timer status:   ${CYAN}sudo systemctl status faflow-updater.timer${NC}"
echo -e "  • List scheduled timers:${CYAN}sudo systemctl list-timers | grep faflow${NC}"
echo -e "  • Run manual update now:${CYAN}sudo bash $REPO_ROOT/scripts/auto_update.sh --force${NC}"
echo -e "  • View live updater log:${CYAN}sudo tail -f /var/log/faflow/updater.log${NC}"
echo ""
echo -e "${GREEN}Done! Your Linux server will now automatically keep FAFLOW updated.${NC}"
