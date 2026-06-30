# Active24 Backend API

Express + Prisma + PostgreSQL API for the Active24 Billing & Inventory system.

## Stack
- Node.js (ESM) + Express
- PostgreSQL via Prisma ORM
- JWT auth (access token + httpOnly refresh cookie), bcrypt password hashing
- RBAC: central permission matrix + `requirePermission` middleware (Manager / Admin / Cashier)

## Prerequisites
- Node.js 18+ (tested on 22.x)
- A PostgreSQL database (local install, Docker, or a cloud provider such as Neon/Supabase/RDS)

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment. Copy `.env.example` to `.env` and set `DATABASE_URL` to your Postgres connection string and strong JWT secrets:
   ```bash
   cp .env.example .env
   ```
3. Apply the database schema and seed initial data:
   ```bash
   npm run db:deploy   # applies the baseline migration (prisma/migrations/0_init)
   npm run db:seed     # creates the 3 role users, settings, categories, suppliers, customers, products
   ```
   During active development you can instead use:
   ```bash
   npm run db:migrate  # creates/applies migrations interactively
   ```
4. Start the API:
   ```bash
   npm run dev         # http://localhost:4000  (watch mode)
   # or
   npm start
   ```

## Seeded login accounts
| Role    | Email                 | Default password |
|---------|-----------------------|------------------|
| Manager | manager@active24.lk   | Manager@123      |
| Admin   | admin@active24.lk     | Admin@123        |
| Cashier | cashier@active24.lk   | Cashier@123      |

(Override the defaults via `SEED_*_PASSWORD` env vars. Change these before go-live.)

## Auth endpoints (Day 1)
- `POST /api/auth/login` — `{ email, password }` → `{ user, accessToken }` (+ refresh cookie)
- `POST /api/auth/refresh` — uses the httpOnly refresh cookie → new `{ user, accessToken }`
- `POST /api/auth/logout` — clears the refresh cookie
- `GET  /api/auth/me` — current user + resolved permissions (requires `Authorization: Bearer <token>`)
- `GET  /api/health` — service check

## External PO sync (po.geniuslanka.com)

Purchase orders are mirrored from the **Genius PO System** at [https://po.geniuslanka.com](https://po.geniuslanka.com), which hosts both issuing companies:

| External system | Query param | Billing system company |
|---|---|---|
| Genius Associates | `company=GENIUS` | `GENIUS` |
| Active (Pvt) Ltd | `company=ACTIVE` | `ACTIVE24` |

Configure in `backend/.env`:

```env
PO_USE_MOCK=false
PO_SYSTEM_BASE_URL=https://po.geniuslanka.com
PO_SYSTEM_USERNAME=your_po_username
PO_SYSTEM_PASSWORD=your_po_password
```

While `PO_USE_MOCK=true` (default), sync uses local sample data for development.

Sync endpoint: `POST /api/purchase-orders/sync` with body `{ "company": "GENIUS" | "ACTIVE24" | "BOTH" }`.

## RBAC
The permission matrix lives in `src/rbac/permissions.js`. Protect any route with:
```js
import { authMiddleware, requirePermission } from './middleware/auth.js';
router.post('/products', authMiddleware, requirePermission('products.create'), handler);
```
`GET /auth/me` returns the caller's resolved permission list, which the frontend mirrors via `usePermission()` / `<Can>`.

## Project structure
```
prisma/
  schema.prisma          # all tables incl. serialized product_units & purchase_invoices
  migrations/0_init/     # baseline migration SQL
  seed.js                # users, settings, masters catalog
src/
  app.js / server.js     # Express app + bootstrap
  config/                # env + prisma client
  middleware/            # auth, requirePermission, validate, error handling
  rbac/permissions.js    # role -> permission matrix
  routes/index.js        # /api router (mounts modules)
  modules/auth/          # login / refresh / logout / me
  utils/                 # jwt, ApiError, asyncHandler
```

## Frontend dev proxy
The Vite frontend proxies `/api` to `http://localhost:4000` (see `vite.config.js`), so run both:
- Backend: `npm run dev` in `backend/`
- Frontend: `npm run dev` in `Billing System/`
