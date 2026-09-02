#!/usr/bin/env python3
"""
VAPID Key Generation Utility for FAFLOW Web Push Notifications (Root Script).
"""
import os
import sys
from pathlib import Path

# Add backend to sys.path so we can import from backend/scripts/generate_vapid_keys.py
ROOT = Path(__file__).resolve().parent.parent
backend_dir = ROOT / "backend"
sys.path.insert(0, str(backend_dir))

# Check for venv python if run with system python
if "venv" not in sys.executable:
    venv_py = backend_dir / "venv" / "bin" / "python"
    venv_py_win = backend_dir / "venv" / "Scripts" / "python.exe"
    if venv_py.exists():
        os.execv(str(venv_py), [str(venv_py)] + sys.argv)
    elif venv_py_win.exists():
        os.execv(str(venv_py_win), [str(venv_py_win)] + sys.argv)

import base64


def generate_vapid_keys():
    try:
        from py_vapid import Vapid
    except ImportError:
        print("[ERROR] py_vapid / pywebpush is not installed in the current Python environment.")
        sys.exit(1)

    vapid = Vapid()
    vapid.generate_keys()

    raw_pub = (
        b"\x04"
        + vapid.public_key.public_numbers().x.to_bytes(32, "big")
        + vapid.public_key.public_numbers().y.to_bytes(32, "big")
    )
    public_key_b64 = base64.urlsafe_b64encode(raw_pub).rstrip(b"=").decode("ascii")

    raw_priv = vapid.private_key.private_numbers().private_value.to_bytes(32, "big")
    private_key_b64 = base64.urlsafe_b64encode(raw_priv).rstrip(b"=").decode("ascii")

    return public_key_b64, private_key_b64


def main():
    pub, priv = generate_vapid_keys()

    print("=" * 60)
    print("FAFLOW VAPID Keys Generated Successfully")
    print("=" * 60)
    print(f"VAPID_PUBLIC_KEY={pub}")
    print(f"VAPID_PRIVATE_KEY={priv}")
    print("VAPID_CLAIM_EMAIL=mailto:admin@faflow.local")
    print("=" * 60)

    # Check for backend/.env
    backend_env = backend_dir / ".env"
    if backend_env.exists():
        content = backend_env.read_text(encoding="utf-8", errors="ignore")
        lines = content.splitlines()
        has_pub = any(line.startswith("VAPID_PUBLIC_KEY=") for line in lines)
        has_priv = any(line.startswith("VAPID_PRIVATE_KEY=") for line in lines)
        has_email = any(line.startswith("VAPID_CLAIM_EMAIL=") for line in lines)

        new_lines = []
        for line in lines:
            if line.startswith("VAPID_PUBLIC_KEY="):
                new_lines.append(f"VAPID_PUBLIC_KEY={pub}")
            elif line.startswith("VAPID_PRIVATE_KEY="):
                new_lines.append(f"VAPID_PRIVATE_KEY={priv}")
            elif line.startswith("VAPID_CLAIM_EMAIL="):
                new_lines.append(f"VAPID_CLAIM_EMAIL=mailto:admin@faflow.local")
            else:
                new_lines.append(line)

        if not has_pub:
            new_lines.append(f"VAPID_PUBLIC_KEY={pub}")
        if not has_priv:
            new_lines.append(f"VAPID_PRIVATE_KEY={priv}")
        if not has_email:
            new_lines.append("VAPID_CLAIM_EMAIL=mailto:admin@faflow.local")

        backend_env.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
        print(f"[OK] Updated {backend_env} with generated VAPID keys.")


if __name__ == "__main__":
    main()
