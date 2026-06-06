#!/usr/bin/env bash
set -euo pipefail

# Load Node via nvm (npx/npm not in default PATH)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WEB_DIR="$REPO_DIR/packages/web"
BACKEND_DIR="$REPO_DIR/packages/backend"
SHARED_DIR="$REPO_DIR/packages/shared"
WEB_TARGET="/opt/smart-files/web-dist"

# Optional: pass --skip-web-only to only build backend (useful during backend-only fixes)
SKIP_WEB=false
if [ "${1:-}" = "--skip-web" ]; then
  SKIP_WEB=true
fi

echo "=== Smart Files Deploy ==="
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
# Load DATABASE_URL from project .env
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
if pm2 show smart-files-backend > /dev/null 2>&1; then
  pm2 restart smart-files-backend
else
  pm2 start ecosystem.config.js
fi
pm2 save
echo ""

# -------------------------------------------------------
# 6. Build & deploy Web frontend
# -------------------------------------------------------
if [ "$SKIP_WEB" = false ]; then
  echo "→ Building web frontend..."
  cd "$WEB_DIR"
  npm run build

  BUILD_DIR="$WEB_DIR/dist"
  if [ ! -d "$BUILD_DIR" ]; then
    echo "ERROR: Build output not found at $BUILD_DIR"
    exit 1
  fi

  echo "→ Deploying web to $WEB_TARGET..."
  WEB_PARENT="$(dirname "$WEB_TARGET")"
  if [ ! -d "$WEB_PARENT" ]; then
    sudo mkdir -p "$WEB_PARENT"
    sudo chown "$(id -u):$(id -g)" "$WEB_PARENT"
  fi

  mkdir -p "$WEB_TARGET"
  cp -r "$BUILD_DIR"/* "$WEB_TARGET"

  echo "✓ Web build placed in $WEB_TARGET ($(du -sh "$WEB_TARGET" | cut -f1))"
  echo ""

  # Nginx config suggestion
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
else
  echo "→ Skipping web build/deploy (--skip-web)."
fi

echo "=== Deploy complete ==="
echo "  Backend: $(pm2 show smart-files-backend 2>/dev/null | grep -E 'status|uptime' | tr -d ' ') "
