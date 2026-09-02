#!/usr/bin/env python
import sys
import subprocess
import argparse
import urllib.request
from sqlalchemy import text

from app.database import engine, SessionLocal
from app.config import settings

def run_tests():
    print("[+] Running FAFLOW Test Suite...")
    result = subprocess.run([sys.executable, "-m", "pytest"], cwd=".")
    sys.exit(result.returncode)

def run_seed():
    print("[+] Seeding Cross-Department Test Data...")
    from seed_cross_department import seed_cross_department
    seed_cross_department()

def check_health():
    print("[+] Checking Database and System Health...")
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("[OK] Database Connection: HEALTHY")
        print(f"[OK] App Name: {settings.APP_NAME}")
        print(f"[OK] Database Pool: {engine.pool.size()} connections configured")
    except Exception as e:
        print(f"[FAIL] Health Check Failed: {e}")
        sys.exit(1)

def verify_environment():
    print("[+] Verifying Full Stack System Environment...")
    all_good = True

    # 1. Check Python Venv
    print(" 1. Python Environment: ", end="")
    if hasattr(sys, 'real_prefix') or (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix):
        print("OK (Virtualenv Active)")
    else:
        print("WARNING (Global Python environment)")

    # 2. Check Database Connectivity
    print(" 2. Database Connection: ", end="")
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("OK")
    except Exception as e:
        print(f"FAIL ({e})")
        all_good = False

    # 3. Check Backend Server Endpoint (Port 8000)
    print(" 3. Backend HTTP Server (http://127.0.0.1:8000/health): ", end="")
    try:
        req = urllib.request.urlopen("http://127.0.0.1:8000/health", timeout=2)
        if req.status == 200:
            print("OK")
        else:
            print(f"STATUS {req.status}")
    except Exception:
        print("OFFLINE (Not running or unreachable)")

    # 4. Check Frontend Web App (Port 5173)
    print(" 4. Frontend Web App (http://127.0.0.1:5173): ", end="")
    try:
        req = urllib.request.urlopen("http://127.0.0.1:5173", timeout=2)
        if req.status == 200:
            print("OK")
        else:
            print(f"STATUS {req.status}")
    except Exception:
        print("OFFLINE (Not running or unreachable)")

    if all_good:
        print("\n[SUCCESS] Environment Verification Complete — All Core Services Nominal!")
    else:
        print("\n[WARNING] Verification finished with issues. Please review outputs above.")

def main():
    parser = argparse.ArgumentParser(description="FAFLOW Backend CLI Management Tool")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    subparsers.add_parser("test", help="Run full backend test suite via pytest")
    subparsers.add_parser("seed", help="Seed cross-department timetable test slots")
    subparsers.add_parser("health", help="Check database connectivity and backend health")
    subparsers.add_parser("verify", help="Verify full stack system environment status")

    args = parser.parse_args()

    if args.command == "test":
        run_tests()
    elif args.command == "seed":
        run_seed()
    elif args.command == "health":
        check_health()
    elif args.command == "verify":
        verify_environment()
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
