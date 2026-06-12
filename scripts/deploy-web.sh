#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────────────
# deploy-web.sh  —  Build & deploy the Smart Files web frontend
# ──────────────────────────────────────────────────────────
# Usage: ./scripts/deploy-web.sh [--target /custom/path]
#
# Options:
#   --target PATH   Target directory for the built static files
#                   (default: /opt/smart-files/web-dist)
#
# Steps:
#   1. Install monorepo dependencies (npm ci if needed)
#   2. Build the Vite frontend
#   3. Copy build output to the target directory
#   4. Show nginx config suggestion if not already set up
# ──────────────────────────────────────────────────────────

# Load Node via nvm (npx/npm not in default PATH)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WEB_DIR="$REPO_DIR/packages/web"
WEB_TARGET="/opt/smart-files/web-dist"

# Parse optional --target flag
while [ $# -gt 0 ]; do
  case "$1" in
    --target) WEB_TARGET="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

echo "=== Smart Files — Web Deploy ==="
echo "  Repo:   $REPO_DIR"
echo "  Target: $WEB_TARGET"
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
# 2. Build Web frontend (Vite)
# -------------------------------------------------------
echo "→ Building web frontend..."
cd "$WEB_DIR"
npm run build

BUILD_DIR="$WEB_DIR/dist"
if [ ! -d "$BUILD_DIR" ]; then
  echo "ERROR: Build output not found at $BUILD_DIR"
  exit 1
fi
echo ""

# -------------------------------------------------------
# 3. Deploy to target directory
# -------------------------------------------------------
echo "→ Deploying web to $WEB_TARGET..."
WEB_PARENT="$(dirname "$WEB_TARGET")"
if [ ! -d "$WEB_PARENT" ]; then
  sudo mkdir -p "$WEB_PARENT"
  sudo chown "$(id -u):$(id -g)" "$WEB_PARENT"
fi

mkdir -p "$WEB_TARGET"
cp -r "$BUILD_DIR"/* "$WEB_TARGET"

echo "  ✓ Done ($(du -sh "$WEB_TARGET" | cut -f1))"
echo ""

# -------------------------------------------------------
# 4. Nginx config suggestion
# -------------------------------------------------------
if [ ! -f /etc/nginx/sites-enabled/smart-files ]; then
  echo "=== Nginx config suggestion ==="
  echo "Create /etc/nginx/sites-available/smart-files:"
  echo ""
  cat << 'NGINX'
server {
    listen 80;
    server_name your-domain.com;

    root /opt/smart-files/web-dist;
    index index.html;

    # Serve static files directly
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Proxy API requests to the backend
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Share links (no auth)
    location /share/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # API docs
    location /docs {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    # SPA fallback — serve index.html for all other routes
    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINX
fi

echo ""
echo "=== Web Deploy Complete ==="
echo "  Output: $BUILD_DIR"
echo "  Target: $WEB_TARGET"
