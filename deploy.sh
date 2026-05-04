#!/bin/bash
set -euo pipefail

echo "=== CET4 Web Deployment Script ==="
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "[1/4] Building..."
npm run build

echo ""
echo "[2/4] Fixing static file paths for standalone mode..."
rm -rf .next/standalone/.next/static
rm -rf .next/standalone/public
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
echo "  Static files and public assets copied to .next/standalone/"

echo ""
echo "[3/4] Creating deployment tarball..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
TARBALL="deploy_${TIMESTAMP}.tar.gz"
tar -czf "$TARBALL" --exclude='.env' --exclude='.env.*' .next/standalone
echo "  Tarball: $TARBALL ($(ls -lh "$TARBALL" | awk '{print $5}'))"

echo ""
echo "[4/4] Done!"
echo ""
echo "=== Deployment Instructions ==="
echo "1. Upload $TARBALL to server (114.55.58.90)"
echo "2. On server:"
echo "   cd /www/wwwroot/114.55.58.90"
echo "   rm -rf .next/standalone"
echo "   tar -xzf $TARBALL"
echo "   pm2 reload cet4-web"
echo "3. Clear browser cache (Hard Refresh: Cmd+Shift+R)"
echo ""
echo "=== Verification ==="
echo "After deployment, check on mobile:"
echo "  - /history header should not stack text vertically"
echo "  - /users header should not stack text vertically"
echo "  - /dictation header should not stack text vertically"
