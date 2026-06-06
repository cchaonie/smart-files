#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
WEB_DIR="$REPO_DIR/../packages/web"
TARGET_DIR="/opt/smart-files/web-dist"

echo "=== Building Smart Files Web ==="

# 1. Install dependencies (if needed)
if [ ! -d "$REPO_DIR/node_modules" ]; then
  echo "→ Installing dependencies..."
  cd "$REPO_DIR"
  npm ci
else
  echo "→ Dependencies already installed."
fi

# 2. Build the web frontend
echo "→ Building web frontend..."
cd "$WEB_DIR"
npm run build

BUILD_DIR="$WEB_DIR/dist"
if [ ! -d "$BUILD_DIR" ]; then
  echo "ERROR: Build output not found at $BUILD_DIR"
  exit 1
fi

# 3. Deploy to target directory
echo "→ Deploying to $TARGET_DIR..."

# Ensure target parent exists and is owned by us (one-time sudo)
TARGET_PARENT="$(dirname "$TARGET_DIR")"
if [ ! -d "$TARGET_PARENT" ]; then
  sudo mkdir -p "$TARGET_PARENT"
  sudo chown "$(id -u):$(id -g)" "$TARGET_PARENT"
fi

# Deploy — copy build output to target, overwriting in place
# (non-atomic but avoids sudo for root-owned leftovers)
mkdir -p "$TARGET_DIR"
cp -r "$BUILD_DIR"/* "$TARGET_DIR"

echo "✓ Build placed in $TARGET_DIR"
echo "  $(du -sh "$TARGET_DIR" | cut -f1) deployed"
echo ""

# 4. Recommend nginx config
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

echo "=== Done ==="
