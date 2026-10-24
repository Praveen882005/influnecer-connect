# ==============================================================================
# Brand Bridge Backend - Production Startup Script (PowerShell)
# ==============================================================================
$ErrorActionPreference = "Stop"

Write-Host "=== Brand Bridge Backend Production Startup ===" -ForegroundColor Cyan
Write-Host "Runtime Environment: $($env:ENVIRONMENT ? $env:ENVIRONMENT : 'production')"
Write-Host "Listening Port:      $($env:PORT ? $env:PORT : 8000)"

Write-Host "Waiting for database readiness..." -ForegroundColor Yellow
python scripts/wait_for_db.py
if ($LASTEXITCODE -ne 0) {
    Write-Error "Database connectivity check failed! Aborting startup."
    exit 1
}
Write-Host "Database is ready." -ForegroundColor Green

Write-Host "Running database schema migrations (alembic upgrade head)..." -ForegroundColor Yellow
alembic upgrade head
if ($LASTEXITCODE -ne 0) {
    Write-Error "Database migrations failed! Aborting startup."
    exit 1
}
Write-Host "Database migrations completed successfully." -ForegroundColor Green

$port = if ($env:PORT) { $env:PORT } else { "8000" }
$workers = if ($env:WEB_CONCURRENCY) { $env:WEB_CONCURRENCY } else { "2" }

Write-Host "Starting Uvicorn server on port $port with $workers worker(s)..." -ForegroundColor Cyan
uvicorn app.main:app --host 0.0.0.0 --port $port --workers $workers --proxy-headers --forwarded-allow-ips '*'
