#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────────────
# deploy-api.sh  —  Build & deploy the Smart Files backend
# ──────────────────────────────────────────────────────────
# Usage: ./scripts/deploy-api.sh
#
# Steps:
#   1. Install monorepo dependencies (npm ci if needed)
#   2. Generate Prisma Client
#   3. Build NestJS backend
#   4. Run database migrations
#   5. Restart backend via PM2
# ──────────────────────────────────────────────────────────

# Load Node via nvm (npx/npm not in default PATH)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$REPO_DIR/packages/backend"
SHARED_DIR="$REPO_DIR/packages/shared"

echo "=== Smart Files — API Deploy ==="
echo "  Repo: $REPO_DIR"
echo ""

# -------------------------------------------------------
# 1. Install dependencies
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
# 2. Generate Prisma Client
# -------------------------------------------------------
echo "→ Generating Prisma Client..."
cd "$SHARED_DIR"
npx prisma generate
echo ""

# -------------------------------------------------------
# 3. Build Backend (NestJS)
# -------------------------------------------------------
echo "→ Building backend..."
cd "$BACKEND_DIR"
npm run build
echo ""

# -------------------------------------------------------
# 4. Run database migrations
# -------------------------------------------------------
echo "→ Running database migrations..."
cd "$REPO_DIR"
set -a
. "$REPO_DIR/.env"
set +a
cd "$SHARED_DIR"
npx prisma migrate deploy
echo ""

# -------------------------------------------------------
# 5. Restart backend via PM2
# -------------------------------------------------------
echo "→ Restarting backend via PM2..."
cd "$REPO_DIR"
if npx pm2 show smart-files-backend > /dev/null 2>&1; then
  npx pm2 restart smart-files-backend
else
  npx pm2 start ecosystem.config.js
fi
npx pm2 save
echo ""

# -------------------------------------------------------
# Summary
# -------------------------------------------------------
echo "=== API Deploy Complete ==="
if command -v npx &>/dev/null; then
  npx pm2 show smart-files-backend 2>/dev/null | grep -E 'status|uptime' | tr -d ' '
fi
