# ==============================================================================
# Brand Bridge - Full-Stack Local Launcher (Windows PowerShell)
# ==============================================================================

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  Launching Brand Bridge Full-Stack Platform...       " -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

$projectRoot = $PSScriptRoot

# 1. Start FastAPI Backend in its own window
Write-Host "[1/2] Starting Backend Server (Uvicorn)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot'; `$env:PYTHONPATH='backend'; Write-Host 'FastAPI Backend running on http://127.0.0.1:8000' -ForegroundColor Green; .\.venv\Scripts\uvicorn.exe app.main:app --host 127.0.0.1 --port 8000 --reload"

# 2. Start Vite Frontend in its own window
Write-Host "[2/2] Starting Frontend App (Vite)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot\frontend'; Write-Host 'Vite Frontend running on http://127.0.0.1:3000' -ForegroundColor Green; npm run dev -- --host 127.0.0.1 --port 3000"

Write-Host ""
Write-Host "Services are initializing in separate background windows!" -ForegroundColor Green
Write-Host "  - Web App:      http://127.0.0.1:3000" -ForegroundColor Cyan
Write-Host "  - API Backend:  http://127.0.0.1:8000" -ForegroundColor Cyan
Write-Host "  - Swagger Docs: http://127.0.0.1:8000/api/v1/docs" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
