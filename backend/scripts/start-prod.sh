#!/usr/bin/env bash
# ==============================================================================
# Brand Bridge Backend - Production Entrypoint
# ==============================================================================
set -e

echo "=== Brand Bridge Backend Production Startup ==="
echo "Runtime Environment: ${ENVIRONMENT:-production}"
echo "Listening Port:      ${PORT:-8000}"

# Run Alembic Database Migrations safely before web server starts
echo "Running database schema migrations (alembic upgrade head)..."
alembic upgrade head
echo "Database migrations completed successfully."

# Start Uvicorn with multi-worker process management and proxy header support
WORKERS=${WEB_CONCURRENCY:-2}
echo "Starting Uvicorn server with ${WORKERS} worker(s)..."
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port "${PORT:-8000}" \
  --workers "${WORKERS}" \
  --proxy-headers \
  --forwarded-allow-ips '*'
