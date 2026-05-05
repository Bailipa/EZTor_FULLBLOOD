#!/bin/bash
set -euo pipefail

echo "=== CET4 Web Deployment Script ==="
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
export NEXT_PUBLIC_BUILD_ID=$TIMESTAMP

echo "[1/4] Building (BUILD_ID=$TIMESTAMP)..."
npm run build

echo ""
echo "[2/4] Fixing static file paths for standalone mode..."
rm -rf .next/standalone/.next/static
rm -rf .next/standalone/public
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
# Write build ID into standalone for server-side verification
echo "$TIMESTAMP" > .next/standalone/BUILD_ID.txt
echo "  Static files and public assets copied to .next/standalone/"

echo ""
echo "[3/4] Creating deployment tarball..."
TARBALL="deploy_${TIMESTAMP}.tar.gz"
tar -czf "$TARBALL" --exclude='.env' --exclude='.env.production' --exclude='.env.local' .next/standalone
echo "  Tarball: $TARBALL ($(ls -lh "$TARBALL" | awk '{print $5}'))"

echo ""
echo "[4/4] Done!"
echo ""
echo "=== Server Deployment ==="
echo "scp $TARBALL root@114.55.58.90:/www/wwwroot/114.55.58.90/"
echo "ssh root@114.55.58.90"
echo "  cd /www/wwwroot/114.55.58.90"
echo "  rm -rf .next/standalone"
echo "  tar -xzf $TARBALL"
echo "  cp .env .next/standalone/.env           # restore .env (not in tarball)"
echo "  rm -f .next/standalone/.env.production   # ensure no env override"
echo "  pm2 restart cet4-web"
echo "  cat .next/standalone/BUILD_ID.txt        # verify deployed build"
echo ""
echo "=== Browser Verification ==="
echo "1. Open DevTools → Application → Clear site data"
echo "2. Reload page → check <html> tag has data-build-id=\"$TIMESTAMP\""
echo "3. Hard refresh: Cmd+Shift+R (Mac) / Ctrl+Shift+R (Win)"
