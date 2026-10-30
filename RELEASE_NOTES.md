> 🤖 **Note:** *This is an AI-generated release note summarizing the complete first official production release (`v2.0.0`) of VehicleVault.*

---

# 🚗 VehicleVault v2.0.0 — Official Production Release

**VehicleVault v2.0.0** is a complete, privacy-first, self-hosted vehicle lifecycle, fuel & EV charging, AI maintenance invoice translator, tire management, fiscal trip registration, digital glovebox, and Total Cost of Ownership (TCO) platform.

---

## ✨ Highlights & Key Features

### 🛠️ Smart AI Maintenance Invoice Scanner & Automatic Translator
- **Foreign & Local Invoice Extraction:** Upload any garage invoice (PDF or photo) in German, French, English, or Dutch. Powered by **Google Gemini Vision** or **OpenAI Vision**, VehicleVault automatically extracts and translates the service title, notes, and every individual **part and labor line item** into your configured language (`NL` or `EN`).
- **VAT / MwSt Reconciliation:** Automatically reconciles net vs. gross line item totals (e.g., 19% German MwSt or 21% Dutch VAT) into accurate Parts and Labor cost splits.
- **Garage Address & Google Maps Link:** Extracts the performing workshop's name and full address, linking directly to Google Maps in your service passport.
- **Dedicated Extracted Parts Modal:** View all translated parts, labor entries, quantities, and original foreign descriptions in a clean modal dialog.
- **Multi-Interval Reset Checkboxes:** Link and reset multiple maintenance intervals simultaneously from a single major service invoice (e.g., *Engine Oil* + *Brake Fluid* + *Cabin Filter* + *General Inspection*), with automatic AI interval detection.
- **Automatic Digital Glovebox Sync:** Uploaded maintenance invoices are automatically indexed under **Documenten (`Facturen & Bonnen`)** with clean `DD-MM-YYYY` dates.

### 📊 Pure Ownership TCO & Pre-Ownership History
- **Ownership & TCO Baseline:** Configure your vehicle's **Purchase Date** (auto-populated from RDW `datum_tenaamstelling`), **Initial Odometer (`Aankoopstand`)**, and **Purchase Price**.
- **Pre-Ownership Invoice Filtering:** Historical maintenance invoices dated prior to your purchase or below your purchase odometer are automatically flagged as `Vorige eigenaar (buiten TCO)`. They remain in your vehicle's complete service passport and update maintenance intervals, without inflating your personal TCO costs.
- **Recurring Fixed Expenses (`Vaste Lasten`):** Track monthly, quarterly, or annual road tax (MRB), insurance, roadside assistance, and subscriptions with dynamic TCO inclusion toggles.

### 📄 Complete PDF Vehicle Dossier Export
- **Optional Tire Set & Tread Depth Section:** Include your currently mounted tires (brand, model, size, rim size, load/speed index, DOT code, driven km, and 4-wheel tread depths in mm) directly on the PDF dossier.
- **Full-Page Merged PDF & Image Invoices:** Attached `.pdf` and image maintenance invoices are appended as full-size separate attachment pages at the end of the exported PDF dossier (`pdf-lib`) with custom identification headers.

### 🛞 Tire Set Management (`Bandenbeheer`)
- **Summer, Winter & All-Season Sets:** Track Brand, Model, Tire Size (`205/60`), Rim Size (`16"`), Load/Speed Index (`92V`), DOT code, and storage location.
- **Dynamic Live Mileage:** Automatically calculates driven kilometers on mounted tires from the vehicle's live odometer, with full manual edit support.
- **4-Wheel Tread Depth Diagram:** Visual chassis overview (`LV`, `RV`, `LA`, `RA` in mm) with legal (`< 1.6 mm`) and seasonal warning alerts.

### ⛽ Fueling, EV Charging & AI Receipt Scanner
- **AI Vision & Local Tesseract OCR:** Scan fuel receipts at the pump with automatic station name, address, liters, unit price, and total cost detection, plus nearby GPS station lookup and re-scan support.
- **PHEV & EV Support:** Log electric charging sessions (`kWh` and `€/kWh`).
- **Excel & CSV Exports:** Export fuel history to styled `.xlsx` workbooks or UTF-8 BOM CSV files.

### 🚗 Belastingdienst Fiscal Trip Logging (`Ritregistratie`)
- **Business, Commute & Private Trips:** Automatic distance calculation, 1-click return trip generation, and 1-click exports to Belastingdienst-compliant CSV, styled Excel (`.xlsx`), and landscape A4 PDF dossiers.

### 🌐 Public Sales Showcase & Standalone Website Export
- **Public Vehicle Passport (`/showcase/:slug`):** Shareable sales page with photo gallery, RDW specs, verified maintenance timeline, tire status, and WhatsApp/Phone/Email contact buttons.
- **1-Click Static Website ZIP:** Export a standalone HTML5/CSS3/JS website package ready to host on any static web server.

### 🏠 Home Assistant, Calendar (`.ics`), Notifications & MCP Server
- **Push & Email Notifications:** Native support for **Pushover**, **Ntfy**, **Gotify**, **Custom Webhooks**, and **SMTP Email** for approaching APK inspections, maintenance intervals, and expiring documents.
- **Home Assistant Integration:** Outbound REST sensor payload (`GET /api/ha/sensors`) and inbound live odometer webhook (`POST /api/ha/odometer`).
- **Calendar Feed:** RFC 5545 `.ics` export for APK and maintenance reminders.
- **Model Context Protocol (MCP):** Built-in `stdio` and HTTP MCP server for Claude Desktop and Antigravity.

---

## 🐳 Docker Deployment

```bash
docker pull ghcr.io/teecodedev/vehiclevault:latest
```

See the **[README](https://github.com/TeeCodeDev/VehicleVault#readme)** and **[Wiki Documentation](https://github.com/TeeCodeDev/VehicleVault/tree/main/docs/wiki/Home.md)** for full setup instructions.

