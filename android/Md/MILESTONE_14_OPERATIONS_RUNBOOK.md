# Milestone 14: Enterprise Operations & Incident Runbook
## Troubleshooting, Alerting & Recovery Procedures

---

## 1. Incident Recovery Workflows

### A. SERVER / FASTAPI DOWN
- **Detection**: Health check endpoint `/health` returns non-200 or connection refused.
- **Diagnosis**: Run `systemctl status faflow-backend` and inspect `/var/log/faflow/error.log`.
- **Recovery**: `sudo systemctl restart faflow-backend`
- **Verification**: `curl -fsS http://127.0.0.1:8000/health` returns `{"status":"ok"}`.

### B. DATABASE DOWN
- **Detection**: Backend logs report `psycopg2.OperationalError: could not connect to server`.
- **Diagnosis**: Run `systemctl status postgresql` and check `/var/log/postgresql/`.
- **Recovery**: `sudo systemctl restart postgresql`
- **Verification**: `sudo -u postgres psql -d faflow_db -c "SELECT count(*) FROM staff_attendance;"`.

### C. DISK FULL (>90% Capacity)
- **Detection**: Server monitoring alert on `/var` partition.
- **Diagnosis**: Run `df -h` and `du -sh /var/log/faflow/* /var/backups/faflow/*`.
- **Recovery**: Rotate logs with `logrotate -f /etc/logrotate.d/faflow` and prune backups older than 30 days.
- **Verification**: `df -h` shows $> 30\%$ free space available.

### D. HTTPS / SSL CERTIFICATE EXPIRED OR FAILING
- **Detection**: Mobile app reports SSL Handshake exception or certificate expired.
- **Diagnosis**: Run `sudo certbot certificates` or check certificate expiration dates.
- **Recovery**: `sudo certbot renew --nginx` or reinstall institutional TLS certificate.
- **Verification**: `openssl s_client -connect faflow.college.edu:443 -servername faflow.college.edu`.

### E. HIGH CPU / HIGH RAM USAGE
- **Detection**: Server load average $> 4.0$ or RAM usage $> 7.2\text{ GB}$.
- **Diagnosis**: Run `top -b -n 1` or `htop` to identify CPU-heavy worker processes.
- **Recovery**: Reload Gunicorn workers gracefully with `sudo systemctl reload faflow-backend`.
- **Verification**: `free -m` shows at least $2.5\text{ GB}$ available RAM.

### F. ATTENDANCE SUBMISSION FAILURE
- **Detection**: Mobile app logs offline queue fallback count increasing.
- **Diagnosis**: Check `AuditLog` table for `ATTENDANCE_CHECK_IN_REJECTED` events and server error logs.
- **Recovery**: Confirm PostgreSQL connection pool capacity and active geofence definitions.
- **Verification**: Submit test check-in; confirm instant HTTP 200 receipt and ledger persistence.
