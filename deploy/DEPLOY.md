# Active24 Deployment Guide

## Local development (Windows — no Docker)

Docker is **not required** on your dev machine. From the repo root:

```powershell
.\start-local.ps1
```

Or manually: `.\db-start.ps1` → `cd backend; npm run dev` → `cd "Billing System"; npm run dev`

Open **http://localhost:5173**. Backend uses `backend/.env` (not the root `.env`).

---

## Quick start (Docker — staging / production server)

**Requires Docker Desktop (Windows/Mac) or Docker Engine (Linux).** If you see `docker : The term 'docker' is not recognized`, install Docker or use local dev above.

```bash
cp deploy/.env.example .env
# Edit .env — set JWT secrets and PO credentials for go-live

docker compose up --build -d
docker compose exec backend npm run db:seed   # first run only
```

Open **http://localhost:8080** (or `HTTP_PORT` from `.env`).

Default logins (after seed):
- Manager: `manager@active24.lk` / `Manager@123`
- Admin: `admin@active24.lk` / `Admin@123`
- Cashier: `cashier@active24.lk` / `Cashier@123`

## Architecture

```
Browser → Nginx (:8080) → /api/* → Backend (:4000)
                        → /*     → Frontend (static SPA)
Backend → PostgreSQL (:5432 internal)
Backend → po.geniuslanka.com (PO sync when PO_USE_MOCK=false)
```

## Production checklist (Day 7–8)

1. **Secrets** — Generate JWT secrets: `openssl rand -hex 48`
2. **PO credentials** — Set `PO_USE_MOCK=false`, `PO_SYSTEM_USERNAME`, `PO_SYSTEM_PASSWORD`
3. **SSL** — Terminate TLS at Nginx or a reverse proxy (Certbot / Cloudflare)
4. **Backups** — Schedule `deploy/scripts/backup-db.sh` daily; backups land in `./backups`
5. **Monitoring** — Watch `docker compose logs -f`, health endpoints `/api/health`
6. **UAT** — Full flow: PO sync → PI → GRN (barcodes) → POS sale → print invoice → reports
7. **Go-live** — Run `docker compose exec backend npm run db:deploy` before traffic

## Local development (without Docker)

```powershell
.\db-start.ps1
cd backend && npm run dev
cd "Billing System" && npm run dev
```
