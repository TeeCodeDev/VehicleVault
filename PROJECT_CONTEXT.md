# VehicleVault — Project Context & Architecture

## High-Level Architecture
VehicleVault is a self-hosted, Dockerized vehicle lifecycle, fuel, maintenance, and TCO (Total Cost of Ownership) platform. It provides a modern high-density PWA, an authenticated REST API backend, an intelligent receipt OCR scanner (Tesseract), RDW (Netherlands Vehicle Authority) API synchronization, CSV migration wizards, PDF service dossier generation, and a first-class Model Context Protocol (MCP) server for AI agents.

```
                    ┌───────────────────────────────────────────────┐
                    │          Frontend: React 19 + Vite PWA        │
                    │   (Tailwind Slate/Zinc, Recharts, Offline SW)  │
                    └───────────────────────┬───────────────────────┘
                                            │ HTTP / JSON (JWT / vkv_*)
                                            ▼
┌──────────────────┐  stdio / SSE   ┌───────────────────────────────────────────────┐
│ AI Assistant     │ ────────────── │ Express REST API + MCP Server                 │
│ (Claude / AGY)   │                │ (Node.js 24 + TypeScript)                     │
└──────────────────┘                ├───────────────────────────────────────────────┤
                                    │ • Auth: Access JWT + HTTP-Only Refresh + vkv_ │
                                    │ • OCR Engine: Tesseract.js + Regex Parser    │
                                    │ • RDW Open Data Sync (NL APK expiry / specs)  │
                                    │ • Dual-Trigger Maintenance Engine             │
                                    │ • TCO & Analytics Aggregator                  │
                                    │ • PDF Dossier Generator (PDFKit)              │
                                    │ • CSV Importers (Fuelio, LubeLogger, Generic) │
                                    └───────────────────────┬───────────────────────┘
                                                            │
                                            ┌───────────────┴───────────────┐
                                            ▼                               ▼
                                    SQLite (WAL mode)             PostgreSQL (Optional)
                                    `/data/vehiclevault.db`       `DATABASE_URL`
```

---

## Chosen Tech Stack
- **Backend:** Node.js (TypeScript, ESModules / tsx / tsc), Express 4/5.
- **Database:** Unified Data Access Layer (DAL) supporting `node:sqlite` (with WAL mode enabled) and `pg` for PostgreSQL via `DATABASE_URL`.
- **Frontend:** Vite + React + TypeScript + Tailwind CSS (Slate/Zinc neutral palette, clean borders, high-density layouts, dark/light modes) + Lucide Icons + Recharts.
- **PWA:** Service Worker offline caching manifest (`manifest.json` + `sw.js`).
- **OCR Engine:** Tesseract.js with image preprocessing and fuel receipt extraction regex.
- **Reporting:** PDFKit for generating digital service booklets / dossiers.
- **MCP Server:** `@modelcontextprotocol/sdk` supporting both stdio transport (CLI) and HTTP/SSE transport (`/api/mcp`) authenticated via `vkv_...` API keys.
- **Deployment:** Single unified multi-stage `Dockerfile` and `docker-compose.yml` mounting `/data` for SQLite DB, uploads, receipts, and logs.

---

## Core Data Models
1. **users**: `id`, `email`, `password_hash`, `role`, `created_at`, `updated_at`
2. **api_keys**: `id`, `user_id`, `name`, `key_hash` (stores SHA256 of `vkv_...`), `prefix`, `last_used_at`, `created_at`
3. **refresh_tokens**: `id`, `user_id`, `token_hash`, `expires_at`, `created_at`
4. **vehicles**: `id`, `user_id`, `name`, `type` (`car`, `motorcycle`, `trailer`, `van`), `license_plate`, `vin`, `year`, `make`, `model`, `fuel_type`, `purchase_date`, `purchase_price`, `initial_odometer`, `notes`, `status` (`active`, `archived`), `rdw_data` (JSON), `apk_expiration_date`, `created_at`, `updated_at`
5. **fuel_entries**: `id`, `vehicle_id`, `date`, `odometer`, `liters`, `price_per_liter`, `total_cost`, `is_full_tank`, `missed_previous`, `notes`, `receipt_path`, `created_at`
6. **service_categories**: `id`, `name`, `is_preset`, `default_distance_interval`, `default_time_months`
7. **maintenance_intervals**: `id`, `vehicle_id`, `category_id`, `custom_name`, `interval_km`, `interval_months`, `last_service_date`, `last_service_odometer`, `created_at`
8. **service_records**: `id`, `vehicle_id`, `category_id`, `maintenance_interval_id`, `date`, `odometer`, `performing_party` (`self`, `garage`), `cost`, `notes`, `invoice_path`, `created_at`

---

## Security Decisions
1. **Authentication:** Short-lived access JWTs (15 min) + HTTP-only Secure SameSite=Strict refresh cookies (7 days).
2. **API Keys:** Formatted with `vkv_` prefix, hashed with SHA-256 before storage; raw key displayed only once upon generation.
3. **Rate Limiting:** Express rate-limiter applied to `/api/auth/*` (10 req/min) and file uploads (20 req/min).
4. **Input Validation:** Strict Zod schema validation on all request bodies, route params, and query filters.
5. **File Upload Security:** Safe directory placement in `/data/receipts` and `/data/invoices`, randomized filenames with UUIDs, and MIME-type verification (jpeg, png, heic, pdf).
6. **Health Check:** `/healthz` endpoint returning DB status, uptime, and system diagnostics.

---

## Current State of Development & Next Steps
- [x] Initial Context and Architecture Alignment (Phase 1)
- [x] Directory structure setup & Package configuration (root, server, client)
- [x] Database Schema & Migration system (SQLite WAL mode + Foreign Keys)
- [x] Backend Core: Express server, auth middleware, Zod schemas, rate limiters, controllers
- [x] Core Features implemented:
  - [x] Vehicle management, archiving & RDW Open Data Dutch plate sync (`/api/vehicles/rdw`)
  - [x] Fast PWA Fuel logging, sanity odometer validation, Tesseract OCR parsing pipeline (`/api/fuel/ocr`)
  - [x] Dual-trigger maintenance engine (distance + time "whichever comes first") with category presets
  - [x] Analytics & TCO engine with explicit purchase price toggle and rolling averages
  - [x] PDFKit Digital Service Booklet / Passport generation in Dutch (`/api/analytics/export-pdf`)
  - [x] Multi-format CSV Importers (Fuelio, LubeLogger, Generic mapper wizard) with pre-import validation
  - [x] Model Context Protocol (MCP) Server: Stdio CLI runner (`npm run mcp`) + Authenticated HTTP/SSE (`/api/mcp`) with `vkv_...` API keys
- [x] Frontend React 19 PWA implemented & Enhanced:
  - [x] Fix Light & Dark mode: completely dynamic theme toggle with system preference listener and full `dark:` variant coverage
  - [x] Interactive Dutch DatePicker & Calendar component with month navigation and quick shortcuts
  - [x] Full Dutch (NL) translation throughout all screens, labels, status badges, vehicle types, and dialogs
  - [x] Modern automotive SaaS UI overhaul: sleek vehicle hero cards, Dutch license plate badges, smooth area charts, and rich KPI widgets
  - [x] Expanded analytics & reporting: cost distribution bars, best/worst consumption metrics, and monthly stacked breakdowns
  - [x] Full offline caching service worker and PWA manifest (`manifest.json`, `sw.js`)
- [x] Automated Test Suite: 14/14 unit & integration tests passing (`npm test`)
- [x] Multi-stage production Dockerfile & docker-compose.yml with persistent `/data` volume
- [x] Documentation & README.md complete

## Verification Results
- Unit & Integration Tests: 14 passing, 0 failing.
- Client Vite PWA: Built and optimized into `client/dist`.
- Server TypeScript: Compiled into `server/dist`.
- Live API integration verification: User registration, JWT refresh cookies, vehicle creation, fuel logging, TCO calculation, and MCP tool execution with `vkv_...` API key verified.
- Static asset serving: Root path `/` serves PWA `index.html` with client-side SPA routing fallback.
- Health Check: `/healthz` operational.
