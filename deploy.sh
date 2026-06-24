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
tar -czf "$TARBALL" --exclude='.env' --exclude='.env.production' --exclude='.env.local' .next/standalone prisma
echo "  Tarball: $TARBALL ($(ls -lh "$TARBALL" | awk '{print $5}'))"

echo ""
echo "[3a] Cleaning up old deployment tarballs (keep latest 1)..."
if compgen -G "deploy_*.tar.gz" > /dev/null; then
  ls -1t deploy_*.tar.gz | tail -n +2 | xargs -r rm -v
fi

echo ""
echo "# 3b. Restore prisma (schema + migrations for prisma migrate)"
echo "cp -r .next/standalone/../prisma . 2>/dev/null || true"
echo ""
echo "# 4. Run database migration (safe: additive table creation only)"
echo "npx prisma migrate deploy"
echo ""
echo "# 5. Restart"
echo "pm2 restart cet4-web"
echo ""
echo "# 6. Verify"
echo "tail -20 .next/standalone/.pm2/logs/cet4-web-out.log"
echo "cat .next/standalone/BUILD_ID.txt"
echo ""
echo "# Rollback (if needed):"
echo "#   pm2 stop cet4-web"
echo "#   rm -rf .next/standalone"
echo "#   mv .next/standalone.bak.* .next/standalone"
echo "#   cp .env .next/standalone/.env"
echo "#   pm2 restart cet4-web"
echo ""
echo "=== Browser Verification ==="
echo "1. Open DevTools → Application → Clear site data"
echo "2. Reload page → check <html> tag has data-build-id=\"$TIMESTAMP\""
echo "3. Hard refresh: Cmd+Shift+R (Mac) / Ctrl+Shift+R (Win)"
