#!/usr/bin/env python3
"""
ci_contract_check.py – FAFLOW Phase 7 API Contract Parity Gate
================================================================
Compares:
  1. OpenAPI spec  (openapi.yaml)  → canonical source of truth
  2. Android Retrofit interfaces   (Kotlin @GET/@POST/@PUT/@DELETE/@PATCH)
  3. Frontend axios/fetch calls    (frontend/src)

Writes a JSON report and exits with:
  0  – no critical mismatches
  1  – critical mismatches found (blocks CI merge)
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    print("PyYAML not installed – run: pip install pyyaml", file=sys.stderr)
    sys.exit(1)


# ── helpers ──────────────────────────────────────────────────────────────────

def load_openapi_paths(openapi_file: str) -> dict[str, set[str]]:
    """Return {normalized_path: {methods}} from the OpenAPI spec."""
    with open(openapi_file, encoding="utf-8") as f:
        spec = yaml.safe_load(f)
    result: dict[str, set[str]] = {}
    for path, methods in spec.get("paths", {}).items():
        norm = _norm(path)
        result.setdefault(norm, set()).update(
            m.upper() for m in methods if m.lower() in
            {"get", "post", "put", "delete", "patch", "head", "options"}
        )
    return result


def _norm(path: str) -> str:
    """Normalise path params: /users/{user_id} → /users/{*}, /users/${id} → /users/{*}"""
    # Handle JS template literal style: ${variable}
    path = re.sub(r'\$\{[^}]+\}', '{*}', path)
    # Handle OpenAPI style: {variable}
    path = re.sub(r'\{[^}]+\}', '{*}', path)
    return path.rstrip('/').lower()


def _all_variants(path: str) -> list[str]:
    """Return all candidate paths to try matching in the OpenAPI spec."""
    # Ensure leading slash
    if not path.startswith('/'):
        path = '/' + path
    variants = [path]
    if not path.startswith('/api/'):
        variants.append('/api' + path)
    else:
        variants.append(path[4:])  # strip /api prefix
    return variants


def scan_android_endpoints(android_dir: str) -> list[dict]:
    """Find all Retrofit annotations in .kt files."""
    pattern = re.compile(
        r'@(GET|POST|PUT|DELETE|PATCH)\("([^"]+)"\)', re.IGNORECASE
    )
    found = []
    for kt_file in Path(android_dir).rglob("*.kt"):
        text = kt_file.read_text(encoding="utf-8", errors="ignore")
        for method, path in pattern.findall(text):
            found.append({
                "method": method.upper(),
                "path": _norm(path),
                "source": str(kt_file.relative_to(android_dir)),
            })
    return found


def scan_frontend_endpoints(frontend_dir: str) -> list[dict]:
    """Find axios/fetch calls in .ts/.tsx/.js/.jsx files."""
    # Match axios.get/post/put/delete or fetch with common patterns
    axios_pattern = re.compile(
        r'axios\.(get|post|put|delete|patch)\([`\'"](\/[^`\'"]+)[`\'"\'"]',
        re.IGNORECASE,
    )
    fetch_pattern = re.compile(
        r'fetch\([`\'"](\/[^`\'"]+)[`\'"]',
        re.IGNORECASE,
    )
    api_call_pattern = re.compile(
        r'(?:api|apiClient|axiosInstance)\.(get|post|put|delete|patch)\([`\'"](\/[^`\'"]+)[`\'"]',
        re.IGNORECASE,
    )

    found = []
    for src_file in Path(frontend_dir).rglob("*"):
        if src_file.suffix not in {".ts", ".tsx", ".js", ".jsx"}:
            continue
        text = src_file.read_text(encoding="utf-8", errors="ignore")
        for method, path in axios_pattern.findall(text):
            found.append({
                "method": method.upper(),
                "path": _norm(path),
                "source": str(src_file.relative_to(frontend_dir)),
            })
        for method, path in api_call_pattern.findall(text):
            found.append({
                "method": method.upper(),
                "path": _norm(path),
                "source": str(src_file.relative_to(frontend_dir)),
            })
        for path in fetch_pattern.findall(text):
            found.append({
                "method": "GET",  # default assumption for bare fetch
                "path": _norm(path),
                "source": str(src_file.relative_to(frontend_dir)),
            })
    return found


def check_parity(
    spec_paths: dict[str, set[str]],
    client_endpoints: list[dict],
    client_name: str,
) -> list[dict]:
    """Return list of mismatches for a given client."""
    mismatches = []
    seen = set()  # deduplicate
    for ep in client_endpoints:
        path = ep["path"]
        method = ep["method"]
        key = (method, path)
        if key in seen:
            continue
        seen.add(key)

        # Try all path variants (with/without leading slash, with/without /api prefix)
        variants = _all_variants(path)
        found_path = None
        found_method_ok = False

        for variant in variants:
            if variant in spec_paths:
                found_path = variant
                if method in spec_paths[variant]:
                    found_method_ok = True
                break

        if found_path is None:
            mismatches.append({
                "severity": "HIGH",
                "type": "UNKNOWN_ENDPOINT",
                "client": client_name,
                "method": method,
                "path": path,
                "source": ep["source"],
                "message": f"{method} {path} not found in OpenAPI spec (tried: {variants})",
            })
        elif not found_method_ok:
            mismatches.append({
                "severity": "MEDIUM",
                "type": "METHOD_MISMATCH",
                "client": client_name,
                "method": method,
                "path": path,
                "source": ep["source"],
                "message": (
                    f"{method} {path} exists in spec but not with this method. "
                    f"Allowed: {sorted(spec_paths[found_path])}"
                ),
            })
    return mismatches


# ── main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="FAFLOW API Contract Parity Check")
    parser.add_argument("--openapi", default="openapi.yaml", help="Path to OpenAPI YAML")
    parser.add_argument("--android", default="android/app/src/main/java/com/governence/faflow")
    parser.add_argument("--frontend", default="frontend/src")
    parser.add_argument("--report", default="reports/contract_parity.json")
    args = parser.parse_args()

    print("=" * 60)
    print("FAFLOW · API Contract Parity Gate")
    print("=" * 60)

    # Load OpenAPI spec
    if not os.path.exists(args.openapi):
        print(f"[WARN] OpenAPI file not found: {args.openapi}", file=sys.stderr)
        spec_paths = {}
    else:
        spec_paths = load_openapi_paths(args.openapi)
        print(f"[INFO] OpenAPI spec: {len(spec_paths)} unique paths loaded")

    # Scan Android
    android_eps = scan_android_endpoints(args.android) if os.path.exists(args.android) else []
    print(f"[INFO] Android endpoints found: {len(android_eps)}")

    # Scan Frontend
    frontend_eps = scan_frontend_endpoints(args.frontend) if os.path.exists(args.frontend) else []
    print(f"[INFO] Frontend endpoints found: {len(frontend_eps)}")

    # Parity check
    android_mismatches = check_parity(spec_paths, android_eps, "Android")
    frontend_mismatches = check_parity(spec_paths, frontend_eps, "Web")
    all_mismatches = android_mismatches + frontend_mismatches

    high = [m for m in all_mismatches if m["severity"] == "HIGH"]
    medium = [m for m in all_mismatches if m["severity"] == "MEDIUM"]

    report = {
        "summary": {
            "openapi_paths": len(spec_paths),
            "android_endpoints": len(android_eps),
            "frontend_endpoints": len(frontend_eps),
            "total_mismatches": len(all_mismatches),
            "high_severity": len(high),
            "medium_severity": len(medium),
            "status": "FAIL" if high else ("WARN" if medium else "PASS"),
        },
        "mismatches": all_mismatches,
    }

    # Write report
    os.makedirs(os.path.dirname(args.report), exist_ok=True)
    with open(args.report, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"\n{'='*60}")
    print(f"  Status  : {report['summary']['status']}")
    print(f"  HIGH    : {len(high)}")
    print(f"  MEDIUM  : {len(medium)}")
    print(f"  Report  : {args.report}")
    print(f"{'='*60}\n")

    if high:
        for m in high:
            print(f"  [HIGH]  {m['client']} · {m['method']} {m['path']}")
            print(f"          {m['message']}")
            print(f"          Source: {m['source']}")
        sys.exit(1)

    print("Contract parity check PASSED.")
    sys.exit(0)


if __name__ == "__main__":
    main()
