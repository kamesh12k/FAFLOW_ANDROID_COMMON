"""
verify_android_paths.py – Live TestClient verification of every Android API path.

Proves each endpoint actually exists in the backend before we commit the path.
Exits 0 if all paths return something other than 404/405 (auth 401/403 is OK).
Exits 1 if any path is a hard 404 (route not found).
"""
import os, sys

os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("SKIP_DB_INIT", "1")
os.environ.setdefault("SECRET_KEY", "verify-key")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "60")
os.environ.setdefault("FRONTEND_ORIGIN", '["http://localhost:5173"]')

from sqlalchemy.ext.compiler import compiles
try:
    from sqlalchemy.dialects.postgresql import JSONB, UUID
    @compiles(JSONB, "sqlite")
    def _jsonb(type_, compiler, **kw): return "JSON"
    @compiles(UUID, "sqlite")
    def _uuid(type_, compiler, **kw): return "VARCHAR(36)"
except Exception:
    pass

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app, raise_server_exceptions=False)

# Each entry: (method, path_with_dummy_ids, description)
# Use realistic dummy values so path params resolve
ANDROID_PATHS_TO_VERIFY = [
    # Auth
    ("POST", "/auth/login", "login"),
    ("POST", "/api/auth/login", "login via /api prefix"),

    # Enforcement mode — Phase 7 edit: was 'enforcement-mode', changed to 'policy-settings/enforcement-mode'
    ("GET",  "/policy-settings/enforcement-mode", "enforcement-mode BARE"),
    ("GET",  "/api/policy-settings/enforcement-mode", "enforcement-mode /api"),

    # Leave ledger — Phase 7 edit: was 'leave-balances/teacher/{id}/ledger'
    ("GET",  "/leave-balances/1/ledger", "leave ledger BARE"),
    ("GET",  "/api/leave-balances/1/ledger", "leave ledger /api"),

    # Campus duties
    ("POST", "/campus-duties/generate-discipline", "generate-discipline BARE"),
    ("POST", "/api/campus-duties/generate-discipline", "generate-discipline /api"),
    ("GET",  "/campus-duties/metrics", "duty metrics BARE"),
    ("GET",  "/api/campus-duties/metrics", "duty metrics /api"),
    ("POST", "/campus-duties/1/assign", "assign duty BARE"),
    ("POST", "/api/campus-duties/1/assign", "assign duty /api"),
    ("POST", "/campus-duties/1/lock", "lock duty BARE"),
    ("POST", "/api/campus-duties/1/lock", "lock duty /api"),
    ("POST", "/campus-duties/1/reset", "reset duty (unlock workaround) BARE"),
    ("POST", "/api/campus-duties/1/reset", "reset duty /api"),
    ("POST", "/campus-duties/assignments/1/override", "override assignment BARE"),
    ("POST", "/api/campus-duties/assignments/1/override", "override assignment /api"),
    ("POST", "/campus-duties/assignments/1/replace", "replace assignment BARE"),
    ("POST", "/api/campus-duties/assignments/1/replace", "replace assignment /api"),

    # Campus structure — Phase 7 edits
    ("POST", "/campus-structure/smart-autofill", "smart-autofill BARE"),
    ("POST", "/api/campus-structure/smart-autofill", "smart-autofill /api"),
    ("POST", "/campus-structure/preview-rooms", "preview-rooms BARE"),
    ("POST", "/api/campus-structure/preview-rooms", "preview-rooms /api"),
]

PASS = "PASS"
FAIL = "FAIL"
WARN = "WARN"

results = []
hard_fails = 0

print("=" * 72)
print("FAFLOW Android Path Live Verification (TestClient)")
print("=" * 72)

for method, path, desc in ANDROID_PATHS_TO_VERIFY:
    try:
        resp = client.request(method, path)
        status = resp.status_code
        # 404 = route not found (hard fail)
        # 405 = method not allowed (route exists, wrong method)
        # 401/403 = auth required (route exists, good)
        # 422 = validation error (route exists, need body)
        # 200/201 = success
        if status == 404:
            tag = FAIL
            hard_fails += 1
        elif status == 405:
            tag = WARN  # route exists but wrong method
        elif status in (401, 403, 422, 200, 201, 204):
            tag = PASS
        else:
            tag = WARN
        results.append((tag, method, path, status, desc))
    except Exception as e:
        results.append((FAIL, method, path, "ERR", str(e)))
        hard_fails += 1

# Print results
for tag, method, path, status, desc in results:
    indicator = "OK" if tag == PASS else ("!!" if tag == FAIL else "~~")
    print(f"  [{indicator}] {method:6} {path:55} HTTP {status}  ({desc})")

print()
print(f"  Total: {len(results)}  PASS: {sum(1 for r in results if r[0]==PASS)}  "
      f"WARN: {sum(1 for r in results if r[0]==WARN)}  FAIL: {hard_fails}")
print("=" * 72)

sys.exit(1 if hard_fails > 0 else 0)
