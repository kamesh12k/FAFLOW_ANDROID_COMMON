"""
generate_openapi.py - Generate authoritative OpenAPI spec from the FastAPI app.

Usage:
    python scripts/generate_openapi.py [--out openapi_generated.yaml]

This replaces hand-maintaining openapi.yaml.
The CI step compares this against the committed file and fails if they differ.
"""
import os
import sys
import json
import yaml
import argparse

# Set required env vars before importing app
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("SKIP_DB_INIT", "1")
os.environ.setdefault("SECRET_KEY", "generate-spec-key")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "60")
os.environ.setdefault("FRONTEND_ORIGIN", '["http://localhost:5173"]')

# Patch SQLAlchemy JSONB/UUID for SQLite so models import cleanly
from sqlalchemy.ext.compiler import compiles
try:
    from sqlalchemy.dialects.postgresql import JSONB, UUID
    @compiles(JSONB, "sqlite")
    def compile_jsonb_sqlite(type_, compiler, **kw):
        return "JSON"
    @compiles(UUID, "sqlite")
    def compile_uuid_sqlite(type_, compiler, **kw):
        return "VARCHAR(36)"
except Exception:
    pass

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

def generate(out_path: str, deduplicate: bool = True) -> dict:
    from app.main import app

    spec = app.openapi()

    if deduplicate:
        # Remove /api/x duplicates; keep only the bare /x form as canonical.
        # The backend mounts every router twice (bare + /api prefix).
        # Canonical form = bare path (no /api prefix). Drop /api/* duplicates.
        paths = spec.get("paths", {})
        api_paths = {p for p in paths if p.startswith("/api/")}
        bare_paths = {p for p in paths if not p.startswith("/api/")}

        kept = 0
        removed = 0
        for api_p in sorted(api_paths):
            bare_equiv = api_p[4:]  # strip /api
            if bare_equiv in bare_paths:
                del paths[api_p]
                removed += 1
            else:
                # No bare equivalent - keep the /api/* path
                kept += 1

        print(f"[INFO] Deduplication: removed {removed} /api/* duplicates, kept {kept} /api/* with no bare equivalent")
        print(f"[INFO] Final path count: {len(paths)}")

    return spec


def main():
    parser = argparse.ArgumentParser(description="Generate FAFLOW OpenAPI spec from FastAPI app")
    parser.add_argument("--out", default="openapi_generated.yaml", help="Output file path")
    parser.add_argument("--check", action="store_true", help="Check committed file against generated without writing; fail if drift detected")
    parser.add_argument("--no-dedup", action="store_true", help="Skip deduplication of /api/* paths")
    parser.add_argument("--format", choices=["yaml", "json"], default="yaml")
    args = parser.parse_args()

    print("=" * 60)
    print("FAFLOW OpenAPI Spec Generator")
    print("=" * 60)

    spec = generate(args.out, deduplicate=not args.no_dedup)
    path_count = len(spec.get("paths", {}))

    if args.check:
        if not os.path.exists(args.out):
            print(f"[FAIL] Committed spec file not found: {args.out}")
            sys.exit(1)

        with open(args.out, "r", encoding="utf-8") as f:
            if args.out.endswith(".json"):
                committed = json.load(f)
            else:
                committed = yaml.safe_load(f)

        committed_paths = set(committed.get("paths", {}).keys())
        generated_paths = set(spec.get("paths", {}).keys())

        missing_in_committed = generated_paths - committed_paths
        extra_in_committed = committed_paths - generated_paths

        if missing_in_committed or extra_in_committed:
            print(f"[FAIL] Spec drift detected between backend code and {args.out}!")
            if missing_in_committed:
                print(f"  Missing in committed spec ({len(missing_in_committed)} paths):")
                for p in sorted(missing_in_committed)[:10]:
                    print(f"    + {p}")
            if extra_in_committed:
                print(f"  Extra in committed spec ({len(extra_in_committed)} paths):")
                for p in sorted(extra_in_committed)[:10]:
                    print(f"    - {p}")
            print("\nRun: python scripts/generate_openapi.py --out openapi_generated.yaml")
            sys.exit(1)

        print(f"[PASS] Spec is up-to-date with backend code ({path_count} paths match).")
        sys.exit(0)

    with open(args.out, "w", encoding="utf-8") as f:
        if args.format == "json":
            json.dump(spec, f, indent=2, ensure_ascii=False)
        else:
            yaml.dump(spec, f, allow_unicode=True, default_flow_style=False, sort_keys=False)

    print(f"[INFO] Spec written to: {args.out}")
    print(f"[INFO] Total paths in generated spec: {path_count}")


if __name__ == "__main__":
    main()
