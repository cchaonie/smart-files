#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
WEB_DIR="$REPO_DIR/packages/web"
TARGET_DIR="/opt/smart-files/web-dist"

echo "=== Building Smart Files Web ==="

# 1. Install dependencies (if needed)
if [ ! -d "$REPO_DIR/node_modules" ]; then
  echo "→ Installing dependencies..."
  cd "$REPO_DIR"
  npm install
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

# Use sudo only if needed
if [ -w "$(dirname "$TARGET_DIR")" ]; then
  CP_CMD="cp -r"
  MV_CMD="mv"
  RM_CMD="rm -rf"
  MKDIR_CMD="mkdir -p"
else
  CP_CMD="sudo cp -r"
  MV_CMD="sudo mv"
  RM_CMD="sudo rm -rf"
  MKDIR_CMD="sudo mkdir -p"
fi

$RM_CMD "${TARGET_DIR}.old" 2>/dev/null || true
if [ -d "$TARGET_DIR" ]; then
  $MV_CMD "$TARGET_DIR" "${TARGET_DIR}.old"
fi
$MKDIR_CMD "$(dirname "$TARGET_DIR")"
$CP_CMD "$BUILD_DIR" "$TARGET_DIR"
$RM_CMD "${TARGET_DIR}.old" 2>/dev/null || true

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
