#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
export NEXT_PUBLIC_BUILD_ID="$TIMESTAMP"

echo "=== Build and prepare an auditable EZTor package ==="
echo "[1/2] Building (application marker: $TIMESTAMP)..."
npm run build

echo "[2/2] Preparing the strict allowlist package..."
node scripts/prepare-deploy-package.mjs

cat <<'NOTICE'

Package preparation only; no remote connection or release was performed.
Before remote release, inspect target disk blocks/inodes, verify a complete off-host database backup,
review migrations and code/data rollback compatibility, verify the package SHA-256, inspect its manifest,
and transfer only the exact reviewed package while preserving referenced live/rollback assets.
NOTICE
