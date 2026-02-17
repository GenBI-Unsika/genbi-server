#!/bin/sh
set -e

if [ -n "$DB_HOST" ]; then
  echo "[server] Waiting for MySQL at ${DB_HOST}:${DB_PORT:-3306}..."
  until nc -z "$DB_HOST" "${DB_PORT:-3306}"; do
    sleep 1
  done
fi

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[server] Applying Prisma migrations (deploy)..."
  npm run db:deploy || (
    echo "[server] migrate deploy failed; trying db push..." && npm run db:push
  )
fi

echo "[server] Starting app..."
exec "$@"
