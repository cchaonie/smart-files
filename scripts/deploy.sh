#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────────────
# deploy.sh  —  Single entry point to update all running services
#
# Usage:
#   ./scripts/deploy.sh
#
# What it does:
#   1. Install dependencies (if missing)
#   2. Run Prisma migrations
#   3. Build backend + restart PM2
#   4. Build frontend + copy to target
# ──────────────────────────────────────────────────────────

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SHARED_DIR="$REPO_DIR/packages/shared"

echo "=== Smart Files — Full-stack Deploy ==="
echo ""

# -------------------------------------------------------
# 1. Install monorepo dependencies
# -------------------------------------------------------
if [ ! -d "$REPO_DIR/node_modules" ]; then
  echo "→ Installing dependencies..."
  cd "$REPO_DIR"
  npm ci
else
  echo "→ Dependencies already installed."
fi
echo ""

# -------------------------------------------------------
# 2. Prisma: generate client + run pending migrations
# -------------------------------------------------------
echo "→ Generating Prisma Client..."
cd "$SHARED_DIR"
npx prisma generate

echo "→ Running database migrations..."
set -a
. "$REPO_DIR/.env"
set +a
npx prisma migrate deploy
echo ""

# -------------------------------------------------------
# 3. Build backend & restart PM2
# -------------------------------------------------------
echo "→ Building API and restarting PM2..."
cd "$REPO_DIR"
npm run deploy:api
echo ""

# -------------------------------------------------------
# 4. Build & deploy web frontend
# -------------------------------------------------------
echo "→ Deploying Web..."
bash "$SCRIPT_DIR/deploy-web.sh"
echo ""

# -------------------------------------------------------
# Summary
# -------------------------------------------------------
echo "=== Full-stack Deploy Complete ==="
if command -v pm2 &>/dev/null; then
  pm2 show smart-files-backend 2>/dev/null | grep -E 'status|uptime' | tr -d ' '
fi
