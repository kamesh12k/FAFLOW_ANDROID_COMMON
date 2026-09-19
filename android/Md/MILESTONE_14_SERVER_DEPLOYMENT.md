# Milestone 14: Dedicated College Server Deployment Guide
## Target Hardware: Intel i3 / 8GB RAM / 1TB Storage (180 Total Staff, ~50 Peak Concurrent)

---

## 1. Hardware Capacity & Sizing Analysis

| Resource | Dedicated Server Spec | Expected Peak Utilization (~50 Concurrent) | Headroom / Margin |
|---|---|---|---|
| **CPU** | Intel Core i3 (4 Cores / 8 Threads) | 25% - 35% utilization during morning check-in rush | 65% Headroom |
| **RAM** | 8 GB DDR4 | 2.5 GB (PostgreSQL) + 1.2 GB (Gunicorn/FastAPI) + 0.3 GB (Nginx/OS) = ~4.0 GB | 4.0 GB Free |
| **Storage** | 1 TB SATA SSD / NVMe | ~50 MB database growth / year (biometrics kept on-device) | >99% Free |
| **Network** | 100/1000 Mbps Institutional LAN | Peak bandwidth: < 2.5 Mbps (metadata only, no raw images) | >95% Headroom |

---

## 2. Process Supervison (`systemd` Service)

Create `/etc/systemd/system/faflow-backend.service`:
```ini
[Unit]
Description=FAFLOW Institutional FastAPI Backend Service
After=network.target postgresql.service

[Service]
Type=simple
User=faflow
Group=faflow
WorkingDirectory=/opt/faflow/backend
EnvironmentFile=/opt/faflow/backend/.env
ExecStart=/opt/faflow/venv/bin/gunicorn app.main:app \
    --workers 4 \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind 127.0.0.1:8000 \
    --timeout 60 \
    --keep-alive 5 \
    --max-requests 5000 \
    --max-requests-jitter 500 \
    --access-logfile /var/log/faflow/access.log \
    --error-logfile /var/log/faflow/error.log

Restart=always
RestartSec=5s

# Security Hardening
PrivateTmp=true
ProtectSystem=full
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
```

---

## 3. Nginx Reverse Proxy & SSL Configuration

Create `/etc/nginx/sites-available/faflow.conf`:
```nginx
upstream faflow_backend {
    server 127.0.0.1:8000;
    keepalive 32;
}

server {
    listen 80;
    server_name faflow.college.edu;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name faflow.college.edu;

    ssl_certificate /etc/ssl/certs/faflow_college_edu.crt;
    ssl_certificate_key /etc/ssl/private/faflow_college_edu.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 10M;
    client_body_timeout 15s;

    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=30r/s;

    location / {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://faflow_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
