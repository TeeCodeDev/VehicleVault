# 🚗 Welcome to the VehicleVault Wiki

**VehicleVault v2.0.0** is a complete, self-hosted, privacy-first vehicle lifecycle, fuel & EV charging, AI maintenance invoice translator, tire management, fiscal trip registration, digital glovebox, and Total Cost of Ownership (TCO) platform.

---

## 📚 Documentation Overview

1. **[Installation & Docker Deployment](Installation-and-Docker)**
   - Quick start with `docker-compose.yml`
   - Unraid / Portainer / Synology NAS configuration
   - Environment variables (`.env`) & persistent volumes
   - 1-Click ZIP Backup & Restore

2. **[AI Receipt & Invoice Scanner](AI-Receipt-and-Invoice-Scanner)**
   - Scanning fuel receipts at the pump (Google Gemini Vision, OpenAI Vision & Local Tesseract OCR)
   - **Smart Foreign Maintenance Invoice Scanner & Translator** (automatic translation of German, French, and English garage invoices into your configured language)
   - Automatic extraction of labor vs. parts, VAT/MwSt reconciliation, and garage address with Google Maps link

3. **[Maintenance, TCO & PDF Dossier Export](Maintenance-and-TCO-Engine)**
   - Dual-Trigger Maintenance Engine (*whichever comes first*: kilometers or months)
   - **Multi-Interval Reset** (reset multiple maintenance intervals simultaneously from a single invoice)
   - **Pure Ownership TCO vs. Pre-Ownership History** (excluding invoices dated before your purchase date or below your initial odometer from TCO)
   - **PDF Dossier Export (`pdf-lib`)** including optional tire status and full-page merged PDF/image maintenance invoices

4. **[Tire Management & Fiscal Trip Logging](Tire-Management-and-Trips)**
   - Summer, Winter & All-Season tire sets with Brand, Model, Size, Rim Size, and Load/Speed Index (`92V`)
   - Dynamic live mileage tracking & 4-wheel tread depth diagram (`LV`, `RV`, `LA`, `RA` in mm)
   - Fiscal trip registration (`Ritregistratie`) with CSV, Excel (`.xlsx`), and landscape A4 PDF exports

5. **[Home Assistant, Calendar & MCP Server](Home-Assistant-and-MCP)**
   - Home Assistant REST sensor integration & live odometer webhook (`POST /api/ha/odometer`)
   - RFC 5545 `.ics` Calendar Feed for APK/MOT/TÜV and maintenance reminders
   - Model Context Protocol (MCP) server for Claude Desktop & Antigravity

6. **[Notifications, Multi-User Sharing & Security](Notifications-and-Security)**
   - Push & email notifications via **Web Push (PWA)**, **Pushover**, **Ntfy**, **Gotify**, **Discord/Slack Webhooks**, and **SMTP**
   - Multi-user vehicle isolation, granular **Vehicle Sharing (`editor` / `viewer`)**, and **Driver Mode (`Chauffeur Modus`)**
   - Reverse Proxy SSO (`Remote-Email` / Pangolin / Authelia / Authentik)

---

## ⚡ Quick Links

- **GitHub Repository:** [github.com/TeeCodeDev/VehicleVault](https://github.com/TeeCodeDev/VehicleVault)
- **Container Image:** `ghcr.io/teecodedev/vehiclevault:latest`
- **Health Check Endpoint:** `GET /healthz`
- **MCP Endpoint:** `POST /api/mcp`
