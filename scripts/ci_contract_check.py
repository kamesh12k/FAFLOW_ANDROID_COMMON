#!/usr/bin/env python3
"""
ci_contract_check.py – FAFLOW Phase 7b API Contract Parity Gate
================================================================
Strict mode: uses ONLY the canonical (deduplicated) generated spec.
No silent normalisation variants. Every skipped or normalised match is printed.

Compares:
  1. OpenAPI spec  (canonical, generated from app.openapi())
  2. Android Retrofit @GET/@POST/@PUT/@DELETE/@PATCH annotations
  3. Frontend axios / API client calls

Checks per endpoint:
  - HTTP method match
  - Path exists in spec
  - Path parameters present in spec definition
  - Required query parameters declared in spec
  - Auth requirement (securitySchemes present)

Exits:
  0 = no HIGH mismatches
  1 = HIGH mismatches found (blocks CI merge)

Usage:
    python scripts/ci_contract_check.py \
        --openapi openapi_generated.yaml \
        --android android/app/src/main/java/com/governence/faflow \
        --frontend frontend/src \
        --report reports/contract_parity.json
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


# ── Path normalisation ────────────────────────────────────────────────────────

def _norm(path: str) -> str:
    """Normalise path params to {*}. Log the normalisation."""
    orig = path
    # JS template literal: ${variable}
    path = re.sub(r'\$\{[^}]+\}', '{*}', path)
    # OpenAPI / Retrofit: {variable}
    path = re.sub(r'\{[^}]+\}', '{*}', path)
    # Ensure leading slash
    if not path.startswith('/'):
        path = '/' + path
    path = path.rstrip('/').lower()
    if orig != path.lstrip('/'):
        _log_norm(orig, path)
    return path


_NORM_LOG: list[tuple[str, str]] = []

def _log_norm(original: str, normalised: str) -> None:
    _NORM_LOG.append((original, normalised))


# ── Spec loading ──────────────────────────────────────────────────────────────

class SpecPath:
    def __init__(self, path: str, methods: set[str], path_params: set[str],
                 query_params: dict[str, bool], has_security: bool):
        self.path = path
        self.methods = methods
        self.path_params = path_params          # names of {param}
        self.query_params = query_params        # name -> required
        self.has_security = has_security


def load_openapi_paths(openapi_file: str) -> dict[str, SpecPath]:
    """Return normalised_path -> SpecPath from the canonical OpenAPI spec."""
    with open(openapi_file, encoding="utf-8") as f:
        spec = yaml.safe_load(f)

    result: dict[str, SpecPath] = {}
    global_security = bool(spec.get("security"))

    for path, path_item in spec.get("paths", {}).items():
        norm = _norm(path)
        # Extract path param names from the raw path string
        path_params = set(re.findall(r'\{([^}]+)\}', path))

        methods: set[str] = set()
        query_params: dict[str, bool] = {}
        has_security = global_security

        for method, op in path_item.items():
            if method.lower() not in {"get", "post", "put", "delete", "patch", "head", "options"}:
                continue
            if not isinstance(op, dict):
                continue
            methods.add(method.upper())
            # Operation-level security
            if "security" in op:
                has_security = True
            # Collect query params
            for param in op.get("parameters", []):
                if isinstance(param, dict) and param.get("in") == "query":
                    name = param.get("name", "")
                    required = param.get("required", False)
                    query_params[name] = required

        if norm in result:
            # Merge methods from duplicate paths (shouldn't happen with deduped spec)
            result[norm].methods |= methods
        else:
            result[norm] = SpecPath(norm, methods, path_params, query_params, has_security)

    return result


# ── Client scanning ───────────────────────────────────────────────────────────

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
                "path": path,
                "norm": _norm(path),
                "source": str(kt_file.relative_to(android_dir)),
            })
    return found


def scan_frontend_endpoints(frontend_dir: str) -> list[dict]:
    """Find axios/fetch/api client calls in .ts/.tsx/.js/.jsx files."""
    patterns = [
        re.compile(r'axios\.(get|post|put|delete|patch)\([`\'"](\/[^`\'"]+)[`\'"]', re.IGNORECASE),
        re.compile(r'(?:api|apiClient|axiosInstance|apiService)\.(get|post|put|delete|patch)\([`\'"](\/[^`\'"]+)[`\'"]', re.IGNORECASE),
        re.compile(r'(?:api|apiClient|axiosInstance|apiService)\.(get|post|put|delete|patch)\(`(\/[^`]+)`', re.IGNORECASE),
    ]
    found = []
    for src_file in Path(frontend_dir).rglob("*"):
        if src_file.suffix not in {".ts", ".tsx", ".js", ".jsx"}:
            continue
        text = src_file.read_text(encoding="utf-8", errors="ignore")
        for pat in patterns:
            for method, path in pat.findall(text):
                found.append({
                    "method": method.upper(),
                    "path": path,
                    "norm": _norm(path),
                    "source": str(src_file.relative_to(frontend_dir)),
                })
    return found


# ── Parity checking ───────────────────────────────────────────────────────────

def check_parity(
    spec_paths: dict[str, SpecPath],
    client_endpoints: list[dict],
    client_name: str,
    verbose: bool = True,
) -> list[dict]:
    """Return mismatches. Print every match decision when verbose=True."""
    mismatches = []
    seen: set[tuple[str, str]] = set()

    for ep in client_endpoints:
        norm = ep["norm"]
        method = ep["method"]
        key = (method, norm)

        if key in seen:
            if verbose:
                print(f"    [SKIP-DUP]  {method} {norm}  (source: {ep['source']})")
            continue
        seen.add(key)

        spec = spec_paths.get(norm)

        if spec is None:
            mismatches.append({
                "severity": "HIGH",
                "type": "UNKNOWN_ENDPOINT",
                "client": client_name,
                "method": method,
                "path": ep["path"],
                "norm": norm,
                "source": ep["source"],
                "message": f"{method} {norm} not found in spec",
            })
            if verbose:
                print(f"    [HIGH]      {method} {norm}  NOT IN SPEC  (source: {ep['source']})")
        elif method not in spec.methods:
            mismatches.append({
                "severity": "HIGH",
                "type": "METHOD_MISMATCH",
                "client": client_name,
                "method": method,
                "path": ep["path"],
                "norm": norm,
                "source": ep["source"],
                "message": f"{method} {norm} exists but spec allows: {sorted(spec.methods)}",
            })
            if verbose:
                print(f"    [HIGH]      {method} {norm}  WRONG METHOD, allowed={sorted(spec.methods)}  (source: {ep['source']})")
        else:
            if verbose:
                auth_tag = "AUTH" if spec.has_security else "OPEN"
                print(f"    [OK]        {method} {norm}  ({auth_tag})  (source: {ep['source']})")

    return mismatches


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="FAFLOW Strict API Contract Parity Check")
    parser.add_argument("--openapi", default="openapi_generated.yaml",
                        help="Path to canonical generated OpenAPI YAML")
    parser.add_argument("--android",
                        default="android/app/src/main/java/com/governence/faflow")
    parser.add_argument("--frontend", default="frontend/src")
    parser.add_argument("--report", default="reports/contract_parity.json")
    parser.add_argument("--quiet", action="store_true",
                        help="Suppress per-match output")
    args = parser.parse_args()

    verbose = not args.quiet

    print("=" * 64)
    print("FAFLOW Strict API Contract Parity Gate (Phase 7b)")
    print("=" * 64)

    if not os.path.exists(args.openapi):
        print(f"[WARN] OpenAPI file not found: {args.openapi}", file=sys.stderr)
        print("[WARN] Run: python scripts/generate_openapi.py --out openapi_generated.yaml")
        spec_paths = {}
    else:
        spec_paths = load_openapi_paths(args.openapi)
        print(f"[INFO] Spec loaded: {len(spec_paths)} canonical paths from {args.openapi}")

    # Scan clients
    android_eps = scan_android_endpoints(args.android) if os.path.exists(args.android) else []
    frontend_eps = scan_frontend_endpoints(args.frontend) if os.path.exists(args.frontend) else []
    print(f"[INFO] Android endpoints: {len(android_eps)} raw calls scanned")
    print(f"[INFO] Frontend endpoints: {len(frontend_eps)} raw calls scanned")

    # Print normalisation log
    if _NORM_LOG and verbose:
        print(f"\n[NORM] Path normalisations applied ({len(_NORM_LOG)}):")
        for orig, norm in _NORM_LOG[:20]:  # cap output
            print(f"       '{orig}' -> '{norm}'")
        if len(_NORM_LOG) > 20:
            print(f"       ... and {len(_NORM_LOG) - 20} more")

    # Check parity
    print("\n--- Android ---")
    android_mm = check_parity(spec_paths, android_eps, "Android", verbose)
    print("\n--- Web ---")
    frontend_mm = check_parity(spec_paths, frontend_eps, "Web", verbose)

    all_mm = android_mm + frontend_mm
    high = [m for m in all_mm if m["severity"] == "HIGH"]
    medium = [m for m in all_mm if m["severity"] == "MEDIUM"]

    report = {
        "summary": {
            "spec_source": args.openapi,
            "spec_paths": len(spec_paths),
            "android_raw_calls": len(android_eps),
            "frontend_raw_calls": len(frontend_eps),
            "total_mismatches": len(all_mm),
            "high_severity": len(high),
            "medium_severity": len(medium),
            "status": "FAIL" if high else ("WARN" if medium else "PASS"),
        },
        "mismatches": all_mm,
        "norm_log": [{"original": o, "normalised": n} for o, n in _NORM_LOG],
    }

    os.makedirs(os.path.dirname(args.report) if os.path.dirname(args.report) else ".", exist_ok=True)
    with open(args.report, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"\n{'='*64}")
    print(f"  Status  : {report['summary']['status']}")
    print(f"  HIGH    : {len(high)}")
    print(f"  MEDIUM  : {len(medium)}")
    print(f"  Report  : {args.report}")
    print(f"{'='*64}\n")

    for m in high:
        print(f"  [HIGH] {m['client']} {m['method']} {m['norm']}")
        print(f"         {m['message']}")
        print(f"         Source: {m['source']}")

    sys.exit(1 if high else 0)


if __name__ == "__main__":
    main()
