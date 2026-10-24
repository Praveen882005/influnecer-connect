#!/usr/bin/env python3
"""
==============================================================================
Brand Bridge - Database Backup & Disaster Recovery Utility
==============================================================================
Provides automated snapshot creation, backup archiving, and restoration
guidance for both PostgreSQL (production) and SQLite (staging/development).

Usage:
  python scripts/db_backup_restore.py backup [--dest ./backups]
  python scripts/db_backup_restore.py rollback [--revision -1]
  python scripts/db_backup_restore.py status
==============================================================================
"""

import argparse
import datetime
import os
import shutil
import subprocess
import sys
from pathlib import Path


def get_db_info():
    db_url = os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///./brand_bridge.db")
    is_postgres = db_url.startswith("postgres")
    is_sqlite = "sqlite" in db_url
    return db_url, is_postgres, is_sqlite


def run_backup(dest_dir: str):
    dest_path = Path(dest_dir)
    dest_path.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d_%H%M%S")
    db_url, is_postgres, is_sqlite = get_db_info()

    print(f"[*] Target Database Engine: {'PostgreSQL' if is_postgres else 'SQLite'}")

    if is_sqlite:
        sqlite_file = db_url.split(":///")[-1]
        src_path = Path(sqlite_file)
        if not src_path.exists():
            # Check relative to backend
            alt_path = Path("backend") / sqlite_file
            if alt_path.exists():
                src_path = alt_path

        if not src_path.exists():
            print(f"[-] SQLite database file not found at {src_path}")
            return False

        backup_file = dest_path / f"brand_bridge_backup_{timestamp}.sqlite.bak"
        shutil.copy2(src_path, backup_file)
        size_kb = round(backup_file.stat().st_size / 1024, 2)
        print(f"[+] Backup successfully generated: {backup_file} ({size_kb} KB)")
        return True

    elif is_postgres:
        backup_file = dest_path / f"brand_bridge_postgres_{timestamp}.dump"
        clean_url = db_url.replace("+asyncpg", "")
        print(f"[*] Running pg_dump to {backup_file}...")
        cmd = [
            "pg_dump",
            "--format=custom",
            "--no-owner",
            "--no-privileges",
            f"--dbname={clean_url}",
            f"--file={backup_file}",
        ]
        try:
            subprocess.run(cmd, check=True)
            print(f"[+] PostgreSQL dump created: {backup_file}")
            return True
        except FileNotFoundError:
            print("[-] 'pg_dump' utility not found on PATH.")
            print(f"[*] Manual command: pg_dump --format=c -d <DATABASE_URL> -f {backup_file}")
            return False
        except subprocess.CalledProcessError as e:
            print(f"[-] pg_dump failed with exit code {e.returncode}")
            return False


def run_rollback(revision: str):
    print(f"[*] Rolling back database migration to revision '{revision}'...")
    backend_dir = Path("backend")
    cwd = backend_dir if backend_dir.exists() else Path(".")
    cmd = ["alembic", "downgrade", revision]
    try:
        res = subprocess.run(cmd, cwd=cwd, check=True)
        print("[+] Migration successfully rolled back.")
        return True
    except subprocess.CalledProcessError as e:
        print(f"[-] Alembic rollback failed with exit code {e.returncode}")
        return False


def check_status():
    backend_dir = Path("backend")
    cwd = backend_dir if backend_dir.exists() else Path(".")
    print("[*] Checking Alembic current revision:")
    subprocess.run(["alembic", "current"], cwd=cwd)
    print("\n[*] Checking Alembic latest heads:")
    subprocess.run(["alembic", "heads"], cwd=cwd)


def main():
    parser = argparse.ArgumentParser(description="Brand Bridge Database Backup & Recovery")
    subparsers = parser.add_subparsers(dest="command", required=True)

    backup_parser = subparsers.add_parser("backup", help="Create a point-in-time snapshot")
    backup_parser.add_argument("--dest", default="./backups", help="Destination folder")

    rollback_parser = subparsers.add_parser("rollback", help="Roll back migration revision")
    rollback_parser.add_argument("--revision", default="-1", help="Target revision or -1")

    subparsers.add_parser("status", help="Print current Alembic status")

    args = parser.parse_args()

    if args.command == "backup":
        success = run_backup(args.dest)
        sys.exit(0 if success else 1)
    elif args.command == "rollback":
        success = run_rollback(args.revision)
        sys.exit(0 if success else 1)
    elif args.command == "status":
        check_status()


if __name__ == "__main__":
    main()
