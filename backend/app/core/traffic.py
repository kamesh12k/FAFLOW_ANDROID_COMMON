import time
import os
import uuid
from collections import deque
import threading
from dataclasses import dataclass, asdict
import psutil
from sqlalchemy import text
from sqlalchemy.orm import Session

START_TIME = time.time()

@dataclass
class RequestLog:
    id: str
    method: str
    path: str
    status_code: int
    process_time_ms: float
    client_ip: str
    timestamp: float

class TrafficManager:
    def __init__(self, max_logs: int = 200):
        self.logs = deque(maxlen=max_logs)
        self.lock = threading.Lock()
        self.total_requests = 0
        self.status_counts = {"2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0}
        self.total_latency_ms = 0.0

    def add_log(self, method: str, path: str, status_code: int, process_time_ms: float, client_ip: str):
        log_entry = RequestLog(
            id=str(uuid.uuid4()),
            method=method,
            path=path,
            status_code=status_code,
            process_time_ms=round(process_time_ms, 2),
            client_ip=client_ip,
            timestamp=time.time()
        )
        with self.lock:
            self.logs.appendleft(log_entry)
            self.total_requests += 1
            
            # Status code grouping
            group_key = f"{status_code // 100}xx"
            if group_key in self.status_counts:
                self.status_counts[group_key] += 1
            else:
                self.status_counts["other"] = self.status_counts.get("other", 0) + 1
                
            self.total_latency_ms += process_time_ms

    def get_stats(self):
        with self.lock:
            logs_list = [asdict(l) for l in self.logs]
            avg_latency = round(self.total_latency_ms / max(1, self.total_requests), 2)
            
            # Status distribution helper
            return {
                "total_requests": self.total_requests,
                "status_counts": self.status_counts,
                "avg_latency_ms": avg_latency,
                "logs": logs_list
            }

    def clear(self):
        with self.lock:
            self.logs.clear()
            self.total_requests = 0
            self.status_counts = {"2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0}
            self.total_latency_ms = 0.0

traffic_manager = TrafficManager()

def get_system_performance(db: Session) -> dict:
    # 1. CPU Usage
    # interval=None does a non-blocking check since last call.
    # First call might return 0.0, but subsequent calls will return active CPU load.
    cpu_usage = psutil.cpu_percent(interval=None)

    # 2. Memory Usage
    vm = psutil.virtual_memory()
    memory_usage = vm.percent
    total_memory_gb = round(vm.total / (1024 ** 3), 2)
    used_memory_gb = round(vm.used / (1024 ** 3), 2)

    # 3. Process Uptime
    uptime_seconds = round(time.time() - START_TIME, 0)

    # 4. Database connections
    db_connections = 1
    db_status = "healthy"
    try:
        # Check active connections
        db_connections = db.execute(text("SELECT count(*) FROM pg_stat_activity")).scalar()
    except Exception:
        db_status = "unreachable"

    return {
        "cpu_usage": cpu_usage,
        "memory_usage": memory_usage,
        "total_memory_gb": total_memory_gb,
        "used_memory_gb": used_memory_gb,
        "uptime_seconds": uptime_seconds,
        "db_connections": db_connections,
        "db_status": db_status
    }
