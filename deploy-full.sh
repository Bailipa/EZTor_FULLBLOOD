#!/bin/bash
set -euo pipefail

echo "=== EZTor Deployment Script ==="
echo ""

# 配置
SERVER="root@114.55.58.90"
SERVER_DIR="/www/wwwroot/114.55.58.90"
SSH_PASS="Linux666"
SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=30"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
export NEXT_PUBLIC_BUILD_ID=$TIMESTAMP

echo "[1/6] Building (BUILD_ID=$TIMESTAMP)..."
npm run build

echo ""
echo "[2/6] Preparing standalone files..."
rm -rf .next/standalone/.next/static
rm -rf .next/standalone/public
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
echo "$TIMESTAMP" > .next/standalone/BUILD_ID.txt
echo "  ✓ Static files, public assets, and BUILD_ID copied"

echo ""
echo "[3/6] Creating deployment tarball (excluding .env files)..."
TARBALL="/tmp/eztor-deploy-${TIMESTAMP}.tar.gz"
tar -czf "$TARBALL" \
  --exclude='.env' \
  --exclude='.env.production' \
  --exclude='.env.local' \
  --exclude='.env.docker' \
  -C .next/standalone .
echo "  ✓ Tarball: $TARBALL ($(ls -lh "$TARBALL" | awk '{print $5}'))"

echo ""
echo "[4/6] Uploading to server..."
sshpass -p "$SSH_PASS" scp $SSH_OPTS "$TARBALL" "$SERVER:/tmp/"
echo "  ✓ Uploaded to server"

echo ""
echo "[5/6] Deploying on server..."
sshpass -p "$SSH_PASS" ssh $SSH_OPTS "$SERVER" << 'DEPLOY_EOF'
set -e

SERVER_DIR="/www/wwwroot/114.55.58.90"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Backup current version
echo "  Backing up current version..."
cd "$SERVER_DIR/.next"
if [ -d "standalone" ]; then
  mv standalone "standalone.bak.${TIMESTAMP}"
  echo "  ✓ Backed up to standalone.bak.${TIMESTAMP}"
fi

# Extract new version
echo "  Extracting new version..."
mkdir -p standalone
tar -xzf /tmp/eztor-deploy-*.tar.gz -C standalone 2>/dev/null | grep -v "LIBARCHIVE.xattr" || true
echo "  ✓ Extracted"

# Sync static files (nginx serves from .next/static)
echo "  Syncing static files..."
cd "$SERVER_DIR"
cp -r .next/static .next/standalone/.next/static 2>/dev/null || true
echo "  ✓ Static files synced"

# Copy server's .env to standalone (do NOT use local .env)
echo "  Using server's existing .env..."
if [ -f ".env" ]; then
  cp .env .next/standalone/.env
  echo "  ✓ Server .env copied to standalone"
else
  echo "  ⚠ Warning: No .env found in $SERVER_DIR"
fi

# Run database migrations if new migrations exist
echo "  Checking for database migrations..."
MIGRATION_COUNT=$(ls -d "$SERVER_DIR/prisma/migrations/"*/ 2>/dev/null | wc -l)
if [ "$MIGRATION_COUNT" -gt 0 ]; then
  DATABASE_URL=$(grep DATABASE_URL "$SERVER_DIR/.env" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
  if [ -n "$DATABASE_URL" ]; then
    cd "$SERVER_DIR"
    DATABASE_URL="$DATABASE_URL" npx prisma migrate deploy 2>&1 | tail -5
    echo "  ✓ Database migrations applied"
  else
    echo "  ⚠ Could not read DATABASE_URL, skipping migrations"
  fi
else
  echo "  No migrations to apply"
fi

# Restart PM2
echo "  Restarting PM2..."
pm2 restart cet4-web 2>&1 | tail -3
echo "  ✓ PM2 restarted"

# Cleanup
rm -f /tmp/eztor-deploy-*.tar.gz
echo "  ✓ Cleanup done"
DEPLOY_EOF

echo ""
echo "[6/6] Verifying deployment..."
sleep 2
BUILD_ID_CHECK=$(sshpass -p "$SSH_PASS" ssh $SSH_OPTS "$SERVER" "cat $SERVER_DIR/.next/standalone/BUILD_ID.txt" 2>/dev/null || echo "FAILED")
if [ "$BUILD_ID_CHECK" = "$TIMESTAMP" ]; then
  echo "  ✓ BUILD_ID verified: $TIMESTAMP"
else
  echo "  ✗ BUILD_ID mismatch! Expected: $TIMESTAMP, Got: $BUILD_ID_CHECK"
fi

# Check PM2 status
PM2_STATUS=$(sshpass -p "$SSH_PASS" ssh $SSH_OPTS "$SERVER" "pm2 list --no-color 2>/dev/null | grep cet4-web | head -1" || echo "FAILED")
echo "  PM2 status: $PM2_STATUS"

# Check server response
HTTP_STATUS=$(sshpass -p "$SSH_PASS" ssh $SSH_OPTS "$SERVER" "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/ 2>/dev/null || echo 'FAILED'")
echo "  HTTP status: $HTTP_STATUS"

echo ""
echo "=== Deployment Complete ==="
echo "BUILD_ID: $TIMESTAMP"
echo "Server: https://eztor.dogeggcode.cyou"
echo ""
echo "Rollback (if needed):"
echo "  sshpass -p '$SSH_PASS' ssh $SSH_OPTS $SERVER"
echo "  cd $SERVER_DIR/.next"
echo "  mv standalone standalone.failed"
echo "  mv standalone.bak.* standalone"
echo "  pm2 restart cet4-web"
