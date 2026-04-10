#!/bin/sh
set -e
mkdir -p /data/storage
chown -R nextjs:nodejs /data 2>/dev/null || true
exec su-exec nextjs sh -c "cd /app && npx prisma migrate deploy && exec node server.js"
