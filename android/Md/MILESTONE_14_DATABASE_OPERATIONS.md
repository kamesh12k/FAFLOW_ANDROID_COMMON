# Milestone 14: Database Production Hardening & Operations
## PostgreSQL 15+ Tuning, Schema Indexes & Backup Strategy

---

## 1. PostgreSQL Engine Configuration for 8GB Server

Add to `/etc/postgresql/15/main/postgresql.conf`:
```ini
max_connections = 100
shared_buffers = 2GB
effective_cache_size = 6GB
maintenance_work_mem = 512MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 20MB
min_wal_size = 1GB
max_wal_size = 4GB
```

---

## 2. Production Index Audit & Verification

```sql
-- Enforces strictly ONE attendance record per staff per day
CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_attendance_user_date 
ON staff_attendance (user_id, attendance_date);

-- Fast lookup for idempotent retry verification
CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_attendance_idempotency 
ON staff_attendance (idempotency_key);

-- Fast active shift supervisor queries
CREATE INDEX IF NOT EXISTS idx_staff_attendance_date_active 
ON staff_attendance (attendance_date, check_out_time) 
WHERE check_out_time IS NULL;

-- Fast geofence lookup for active campus boundaries
CREATE INDEX IF NOT EXISTS idx_campus_geofences_active 
ON campus_geofences (is_active) 
WHERE is_active = TRUE;
```

---

## 3. Automated Backup & Disaster Recovery Strategy

Create `/opt/faflow/scripts/backup_db.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/var/backups/faflow"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/faflow_db_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

# Export PostgreSQL dump with compression
pg_dump -U faflow -h 127.0.0.1 -d faflow_db | gzip -9 > "${BACKUP_FILE}"

# Enforce 30-day retention policy
find "${BACKUP_DIR}" -type f -name "faflow_db_*.sql.gz" -mtime +30 -delete

echo "[$(date)] Backup completed successfully: ${BACKUP_FILE}"
```

Cron Schedule (`crontab -e`):
```cron
# Daily database backup at 2:00 AM UTC
0 2 * * * /opt/faflow/scripts/backup_db.sh >> /var/log/faflow/backup.log 2>&1
```
