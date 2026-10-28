# 🚗 VehicleVault — Self-Hosted Vehicle & Maintenance Tracker

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-24%20LTS-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-cyan.svg)](https://react.dev/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://www.docker.com/)
[![MCP](https://img.shields.io/badge/MCP-Model%20Context%20Protocol-8A2BE2.svg)](https://modelcontextprotocol.io/)

**VehicleVault** is a privacy-first, self-hosted vehicle lifecycle, fuel, maintenance, digital glovebox, and TCO (Total Cost of Ownership) platform. Built with a responsive **React 19 PWA**, a **Node.js 24 TypeScript REST API**, an intelligent **Tesseract OCR parsing pipeline**, and a first-class **Model Context Protocol (MCP) Server** enabling AI agents (such as Claude Desktop or Antigravity) to read, inspect, and log vehicle telemetry.

---

## ✨ Key Features

### 🚘 Fleet & Vehicle Management
- **Multi-Type Support:** Passenger Cars, Motorcycles, Trailers, and Commercial Vans.
- **Visual Profiles:** Upload custom vehicle avatar/cover images (`.jpg`, `.png`, `.webp`).
- **Financial & Telemetry Tracking:** Track purchase dates, purchase prices, initial & current odometers, and Markdown notes.
- **Active & Archived States:** Archive sold or inactive vehicles while preserving all historical telemetry and TCO analytics.
- **Dutch RDW Open Data Integration:**
  - One-click autofill for Dutch license plates via the official `opendata.rdw.nl` API.
  - Automatically imports Make, Model, Body type, and Curb weight.
  - Periodic background sync of APK (`vervaldatum_apk`) inspection dates with automatic alert badges for due soon (< 30 days) and overdue statuses.

### ⛽ Quick-Log Fueling & Tesseract OCR Receipt Scanner
- **Fast Mobile PWA UI:** Optimized for quick logging directly at the fuel pump.
- **Smart OCR Scanner:** Drag-and-drop or photograph gas station receipts; server-side preprocessing and Tesseract OCR extract Liters, Unit Price per Liter (€/L), and Total Paid (€).
- **Odometer Sanity Validation:** Real-time warnings for odometer decreases or unusually large distance deltas.
- **Accurate Consumption Engine:** Full Tank and Missed Fill-up flags ensure rolling average calculations ($L/100\text{km}$ and $\text{km}/L$) are never corrupted.

### 📁 Digital Glovebox & Document Vault
- **Organized Vehicle Repository:** Securely store vehicle registrations, green cards (insurance policies), APK inspection forms, garage invoices, and user manuals.
- **Category Filter Pills:** Quickly filter documents by category with file size, upload dates, and direct download links.
- **High-Capacity File Support:** Accepts PDF and image documents up to 30MB stored persistently in `/data/documents/`.

### 🛠️ Dual-Trigger Maintenance & DIY Cost Split
- **Dual-Trigger Engine:** Configurable distance (e.g. 15,000 km) and time (e.g. 12 months) intervals governed by **"whichever comes first"** logic.
- **Visual Health Bars:** Clean color-coded indicators: Green ($<90\%$) ➔ Amber ($90-99\%$) ➔ Red (Overdue).
- **Parts vs. Labor Cost Split:** Split garage service costs into replacement parts vs. workshop labor fees.
- **DIY Savings Benchmark:** Flag self-performed services to highlight saved labor costs and view total accumulated DIY savings across your fleet.
- **Interactive Editing:** Edit intervals on the fly with pencil action triggers and category presets.

### 📊 Dynamic TCO & Advanced Tank Analytics
- **Total Cost of Ownership (TCO):** Instant calculation of Cost per Kilometer and Cost per Month.
- **Asset TCO Toggle:** Explicit toggle to include or exclude the initial vehicle purchase price.
- **Interactive Charts (Recharts):**
  - Fuel economy history with a 3-fill rolling average trend line.
  - Fuel price evolution (€/L) across configurable timeframes (30 days, 6 months, YTD, All-time).
  - Stacked monthly cost breakdown (Fuel, Regular Maintenance, Unscheduled Repairs).
- **Extended Tank & Range Analytics:**
  - Average and maximum range achieved on a single full tank.
  - Fuel cost trend (€ per 100 km).
  - Gas station & brand breakdown (comparing spend, liters, and average €/L between Shell, BP, Esso, Tango, TinQ, etc.).
- **PDF Service Dossier Export:** Generates an elegant, publication-ready PDF digital service booklet with optional receipt thumbnails, ideal for vehicle sales or insurance dossiers.

### 📶 Progressive Web App (PWA) & Offline Mode
- **Offline Caching:** Full Service Worker caching of application assets and static bundles.
- **Offline Fuel Queue:** Enter fuel fill-ups while underground or without cellular coverage. Submissions are queued in local storage and seamlessly synchronized as soon as internet connectivity returns.
- **Persistent Language Preferences:** Built-in Dutch (NL) and English (EN) language support, switchable directly from the Settings panel.

### 🤖 First-Class Model Context Protocol (MCP) Server
- Integrate AI assistants (Claude Desktop, Antigravity, custom agents) using either **stdio transport** or authenticated **HTTP/SSE endpoints** (`/api/mcp`).
- Secure API key authorization system (`vkv_...`) with SHA-256 database hashing.

---

## 🛠 Tech Stack

| Component | Technology | Description |
|---|---|---|
| **Backend API** | Node.js 24 LTS, TypeScript, Express | Clean modular REST API with Zod schema validation & Helmet security |
| **Database** | SQLite 3 with WAL Mode (`better-sqlite3`) | Fast, zero-config embedded database stored in `/data/vehiclevault.db` |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS | High-density neutral SaaS design system with native dark/light mode |
| **Visualizations** | Recharts | Responsive SVG charts for TCO, fuel trends, and monthly spend |
| **OCR Pipeline** | Tesseract.js | Preprocessed receipt optical character recognition with regex extraction |
| **PDF Engine** | PDFKit | Clean, multi-page vector PDF service booklet generator |
| **MCP Protocol** | `@modelcontextprotocol/sdk` | Official SDK exposing vehicle telemetry and logging tools to AI agents |

---

## 🚀 Quick Start with Docker

The easiest way to run VehicleVault is with Docker Compose.

### 1. Clone the Repository
```bash
git clone https://github.com/TeeCodeDev/VehicleVault.git
cd VehicleVault
cp .env.example .env
```

### 2. Launch the Container
```bash
docker compose up -d
```

Visit **`http://localhost:3001`** in your browser. The first account created automatically receives Administrator privileges.

All persistent files (database, vehicle photos, receipt scans, documents, and invoices) are stored in `./data`.

---

## 🤖 Model Context Protocol (MCP) Configuration

VehicleVault provides two MCP integration methods:

### Option 1: Stdio Transport (Claude Desktop / Antigravity)
Add this configuration to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "vehiclevault": {
      "command": "node",
      "args": ["/absolute/path/to/VehicleVault/server/dist/mcp/stdio.js"],
      "env": {
        "DATA_DIR": "/absolute/path/to/VehicleVault/data"
      }
    }
  }
}
```

### Option 2: HTTP / SSE Transport (`/api/mcp`)
1. In VehicleVault, navigate to **Settings ➔ API Keys & MCP Integration**.
2. Create an API Key (prefixed with `vkv_...`).
3. Query or mutate telemetry via HTTP:

```bash
# Check available MCP tools
curl -H "X-API-Key: vkv_YOUR_KEY" http://localhost:3001/api/mcp/tools

# Execute an MCP tool (e.g., retrieve vehicle summary)
curl -X POST http://localhost:3001/api/mcp/execute \
  -H "X-API-Key: vkv_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "get_vehicle_summary",
    "arguments": { "vehicle_id": "YOUR_VEHICLE_UUID" }
  }'
```

### Supported MCP Tools:
- `list_vehicles`: Lists active vehicles, metadata, current odometers, and APK inspection dates.
- `get_vehicle_summary`: Computes average consumption, total spend, and upcoming maintenance alerts.
- `log_fuel_entry`: Records a new fuel fill-up with odometer, liters, price per liter, and full tank status.
- `log_service_entry`: Logs a completed maintenance record with performing party and cost split.
- `check_maintenance_alerts`: Returns all overdue or approaching maintenance intervals across your fleet.

---

## 💻 Local Development & Testing

### Prerequisites
- Node.js 24 LTS or higher
- npm 11 or higher

### Setup & Run
```bash
# 1. Install workspace dependencies
npm install

# 2. Run backend test suite (14/14 automated tests)
npm test

# 3. Build frontend and backend
npm run build

# 4. Start production server
npm start
```

### Development Watch Mode:
```bash
# Terminal 1: Watch and compile server
npm run dev

# Terminal 2: Run Vite client with hot-module replacement
npm run dev:client
```

---

## 🛡️ Security & Privacy

- **JWT Authentication:** Short-lived access tokens (15 min) paired with HTTP-only, secure, `SameSite=Strict` refresh cookies.
- **Hashed API Tokens:** Granular external client keys are hashed with SHA-256 before persistence.
- **Rate Limiting:** Protects `/api/auth/*` against brute-force attacks and limits upload endpoints.
- **Input Sanitization:** Strict Zod schema validation on all inputs; MIME-type verification for file uploads.
- **Health Checks:** Automated diagnostics endpoint available at `/healthz`.

---

## 📄 License

VehicleVault is open-source software licensed under the [MIT License](LICENSE).
