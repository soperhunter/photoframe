#!/usr/bin/env python3
"""
Bulk import photos from a folder into the photo frame database.

Usage:
  python scripts/bulk_import.py <folder> [host]

Environment:
  ADMIN_USER      (default: admin)
  ADMIN_PASSWORD  (default: changeme)

Examples:
  python scripts/bulk_import.py /opt/apps/photoframe/data/photos/originals/test
  ADMIN_PASSWORD=secret python scripts/bulk_import.py ~/photos http://localhost:8002
"""
import os
import sys
from pathlib import Path

try:
    import requests
except ImportError:
    print("Install requests first:  pip install requests")
    sys.exit(1)

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".tiff", ".tif"}


def main():
    folder = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".")
    host   = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:8002"
    user   = os.environ.get("ADMIN_USER", "admin")
    pw     = os.environ.get("ADMIN_PASSWORD", "changeme")

    if not folder.is_dir():
        print(f"Not a directory: {folder}")
        sys.exit(1)

    files = sorted(p for p in folder.rglob("*") if p.suffix.lower() in IMAGE_EXTS and p.is_file())
    if not files:
        print(f"No images found in {folder}")
        sys.exit(0)

    print(f"Found {len(files)} image(s) in {folder}\n")

    ok = err = skip = 0
    for i, path in enumerate(files, 1):
        print(f"[{i:>4}/{len(files)}] {path.name[:50]:<50}", end=" ", flush=True)
        with open(path, "rb") as f:
            res = requests.post(
                f"{host}/api/photos",
                files={"file": (path.name, f, "image/jpeg")},
                auth=(user, pw),
                timeout=60,
            )
        if res.status_code == 200:
            data = res.json()
            # If the DB already had this hash, server returns the existing record
            print("✓ imported" if not data.get("_dup") else "↩ already exists")
            ok += 1
        else:
            print(f"✗ {res.status_code}: {res.text[:60]}")
            err += 1

    print(f"\nDone — {ok} imported, {err} errors, {skip} skipped.")


if __name__ == "__main__":
    main()
