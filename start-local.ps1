# Run Active24 locally WITHOUT Docker (Windows).
# Requires Node.js 20+. Starts portable PostgreSQL, backend API, and Vite frontend.

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

Write-Host "=== Active24 local dev ===" -ForegroundColor Cyan

# 1. Database
Write-Host "`nStarting PostgreSQL..." -ForegroundColor Yellow
& "$Root\db-start.ps1"

# 2. Backend (new window)
Write-Host "Starting backend on http://localhost:4000 ..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$Root\backend'; npm run dev"

Start-Sleep -Seconds 2

# 3. Frontend (new window)
Write-Host "Starting frontend on http://localhost:5173 ..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$Root\Billing System'; npm run dev"

Write-Host "`nDone. Open http://localhost:5173" -ForegroundColor Green
Write-Host "Logins: manager@active24.lk / Manager@123" -ForegroundColor Gray
Write-Host "`nNote: Docker is NOT required for local dev. Use docker compose only on a server with Docker installed." -ForegroundColor DarkGray
