# Seed default users, settings, and walk-in customer in the Docker database.
# Run once after: docker compose up --build -d
# Requires Docker Desktop / Docker CLI in PATH.

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Error "Docker not found. Install Docker Desktop or add docker to PATH, then run: docker compose exec backend npm run db:seed"
}

Write-Host "Applying migrations (if needed)..."
docker compose exec -T backend npx prisma migrate deploy

Write-Host "Seeding users (manager / admin / cashier)..."
docker compose exec -T backend npm run db:seed

Write-Host ""
Write-Host "Done. Log in at http://localhost:8080 with:"
Write-Host "  manager@active24.lk / Manager@123"
Write-Host "  admin@active24.lk   / Admin@123"
Write-Host "  cashier@active24.lk / Cashier@123"
Write-Host "(Or passwords from SEED_* in your root .env if set.)"
