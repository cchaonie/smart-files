#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────────────
# deploy.sh  —  Smart Files full-stack deploy (convenience wrapper)
# ──────────────────────────────────────────────────────────
# Runs deploy-api.sh and deploy-web.sh in sequence.
#
# Usage:
#   ./scripts/deploy.sh              # Full deploy (API + Web)
#   ./scripts/deploy.sh --skip-web   # API only (legacy flag)
#
# For fine-grained control, call the sub-scripts directly:
#   ./scripts/deploy-api.sh
#   ./scripts/deploy-web.sh [--target /custom/path]
# ──────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

SKIP_WEB=false
if [ "${1:-}" = "--skip-web" ]; then
  SKIP_WEB=true
fi

echo "=== Smart Files — Full-stack Deploy ==="
echo ""

# -------------------------------------------------------
# 1. API deploy
# -------------------------------------------------------
echo ">>> API phase <<<"
bash "$SCRIPT_DIR/deploy-api.sh"
echo ""

# -------------------------------------------------------
# 2. Web deploy
# -------------------------------------------------------
if [ "$SKIP_WEB" = false ]; then
  echo ">>> Web phase <<<"
  bash "$SCRIPT_DIR/deploy-web.sh"
  echo ""
else
  echo ">>> Web phase skipped (--skip-web) <<<"
fi

echo "=== Full-stack Deploy Complete ==="
