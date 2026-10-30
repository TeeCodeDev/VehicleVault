# 🐳 Installation & Docker Deployment

VehicleVault runs as a lightweight, self-contained Docker container with an embedded **SQLite (WAL mode)** database and persistent local storage for receipts, maintenance invoices, vehicle photos, and documents.

---

## 1. Quick Start (`docker-compose.yml`)

Create a `docker-compose.yml` file:

```yaml
services:
  vehiclevault:
    image: ghcr.io/teecodedev/vehiclevault:latest
    # container_name: vehiclevault # (Optional: omit to prevent container naming conflicts in Dockhand/Portainer)
    restart: unless-stopped
    ports:
      - "${PORT:-3084}:3084"
    environment:
      - NODE_ENV=production
      - DATA_DIR=/data
      - JWT_SECRET=${JWT_SECRET:-change_this_to_a_long_random_secret_string}
      - JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET:-change_this_to_another_long_random_secret_string}
    volumes:
      - ./data:/data
```

Start the container:

```bash
docker compose up -d
```

Open **`http://localhost:3084`** in your browser. The first account you register is automatically granted the **`admin`** role.

---

## 2. Persistent Storage Layout (`/data`)

All application data is stored inside the mounted `/data` volume:

| Path | Description |
| :--- | :--- |
| `/data/vehiclevault.db` | SQLite database in Write-Ahead Logging (`WAL`) mode |
| `/data/uploads/receipts/` | Fuel & EV charging receipt images |
| `/data/uploads/invoices/` | Maintenance & workshop invoices (`.pdf`, `.jpg`, `.png`, `.webp`) |
| `/data/uploads/documents/` | Digital glovebox documents & synced maintenance invoices |
| `/data/uploads/vehicles/` | Vehicle gallery photos & showcase images |

---

## 3. Environment Variables (`.env`)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3084` | HTTP port exposed by the Express server & PWA |
| `DATA_DIR` | `/data` | Directory for the SQLite database and uploaded files |
| `JWT_SECRET` | *(auto-generated)* | Secret key for signing JWT access tokens |
| `JWT_REFRESH_SECRET` | *(auto-generated)* | Secret key for signing long-lived refresh tokens |
| `DISABLE_AUTH` | `false` | Set to `true` to bypass login completely (e.g., behind a trusted LAN or tunnel) |
| `ENABLE_PROXY_AUTH` | `true` | Automatically authenticate users via reverse proxy headers (`Remote-Email`, `X-Forwarded-Email`) |
| `GEMINI_API_KEY` | *(optional)* | Default Google Gemini API key (can also be configured in the web UI) |
| `OPENAI_API_KEY` | *(optional)* | Default OpenAI API key (can also be configured in the web UI) |

---

## 4. 1-Click ZIP Backup & Restore

Under **Settings → Backup & Opslag**, administrators can:
- **Download Complete Backup (`.zip`):** Exports a consistent snapshot of `vehiclevault.db`, `manifest.json`, and all `/data/uploads/*` folders into a single ZIP archive.
- **Restore from Backup (`.zip`):** Upload any previously exported VehicleVault ZIP archive to restore the database and all attachments in one click.
