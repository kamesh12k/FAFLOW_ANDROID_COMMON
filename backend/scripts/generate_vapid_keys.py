#!/usr/bin/env python3
"""
VAPID Key Generation Utility for FAFLOW Web Push Notifications.

Generates standard VAPID public and private keys (RFC 8292) and outputs
values ready to paste into your .env file or automatically updates .env.
"""

import os
import sys
import base64
from pathlib import Path


def generate_vapid_keys():
    try:
        from py_vapid import Vapid
    except ImportError:
        print("[ERROR] py_vapid / pywebpush is not installed.")
        print("Please run: pip install pywebpush")
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

    # Check if .env exists in backend/ or current directory
    backend_env = Path(__file__).resolve().parent.parent / ".env"
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
