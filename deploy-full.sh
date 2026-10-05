#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "=== Compatibility entry: prepare a review package only ==="
echo "Remote release requires disk/inode checks, an off-host database backup, migration and rollback compatibility review, and package SHA-256 verification."
echo "This script does not upload, switch services, migrate, delete backups/installers, or deploy."
exec "$SCRIPT_DIR/deploy.sh" "$@"
