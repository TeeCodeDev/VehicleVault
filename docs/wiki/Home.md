# Welkom bij de VehicleVault Wiki 🚗🔐

**VehicleVault** is een privacy-first, zelf-gehost platform voor compleet voertuigbeheer, tankbeurten & EV-laadsessies, dual-trigger onderhoudsintervallen, AI-factuurvertaling, bandenbeheer, fiscale ritregistratie, digitale handschoenenkast en Total Cost of Ownership (TCO) analyse.

---

## 📚 Documentatie Overzicht

1. **[Installatie & Docker Deployment](Installation-and-Docker.md)**
   - Snelstart met Docker Compose, `.env` configuratie, Unraid / Portainer / CasaOS / Synology, Reverse Proxy SSO en 1-klik Backups.
2. **[AI Tankbon & Buitenlandse Factuur Scanner](AI-Receipt-and-Invoice-Scanner.md)**
   - Google Gemini & OpenAI Vision koppelen, tankbonnen scannen, en buitenlandse (bijv. Duitse) onderhoudsfacturen automatisch laten uitlezen en vertalen naar het Nederlands.
3. **[Onderhoud, Vaste Lasten & TCO Engine](Maintenance-and-TCO-Engine.md)**
   - Dual-trigger onderhoudsintervallen (km & maanden), meerdere intervallen tegelijk resetten, historische facturen van vorige eigenaren buiten je eigen TCO houden, en het PDF Onderhoudsdossier exporteren.
4. **[Bandenbeheer & Fiscale Ritregistratie](Tire-Management-and-Trips.md)**
   - Zomer-, winter- en 4-seizoenenbanden met 4-wiel profieldiepte-diagram en live gereden kilometers, plus Belastingdienst-conforme ritregistratie (Excel, PDF & CSV).
5. **[Home Assistant, Kalender (.ics) & MCP Server](Home-Assistant-and-MCP.md)**
   - Home Assistant REST-sensoren, automatische kilometerstand-webhook (`POST /api/ha/odometer`), `.ics` kalenderfeed en Model Context Protocol (MCP) voor AI-assistenten.
6. **[Notificaties, Multi-User Delen & Verkoopdossier](Notifications-and-Security.md)**
   - Pushover, Ntfy, Gotify, Webhooks & SMTP E-mail meldingen, voertuigen delen met gezinsleden, en de publieke Verkooppagina & Standalone Website ZIP-export.

---

## 🏗️ Systeemarchitectuur in het kort

```
┌───────────────────────────────────────────────────────────────────────┐
│                         VehicleVault Client                           │
│       React 19 + TypeScript + Tailwind CSS (Desktop & Mobiele PWA)    │
└───────────────────────────────────┬───────────────────────────────────┘
                                    │ REST API (JWT / API-Key / SSO)
┌───────────────────────────────────▼───────────────────────────────────┐
│                         VehicleVault Server                           │
│                  Node.js 24 LTS + Express + TypeScript                │
├─────────────────────┬─────────────────────────┬───────────────────────┤
│  SQLite 3 (WAL)     │  AI Vision & OCR        │  Integraties & Export │
│  /data/*.db         │  • Google Gemini Vision │  • Home Assistant API │
│  /data/invoices     │  • OpenAI GPT-4o Vision │  • MCP Server (Stdio) │
│  /data/receipts     │  • Tesseract.js OCR     │  • Pushover / Ntfy    │
│  /data/documents    │  • RDW Open Data API    │  • PDFKit & pdf-lib   │
└─────────────────────┴─────────────────────────┴───────────────────────┘
```

---

## ⚡ Kernpunten van v2.0.0

- **NL / BE / DE / EU Kenteken-ondersteuning:** Officiële kentekenplaten en keuringstermen (*APK*, *Autokeuring*, *TÜV/HU*) plus 1-klik RDW-ophalen voor Nederlandse voertuigen.
- **Slimme AI Factuurscanner & Vertaler:** Upload een Duitse of buitenlandse PDF-/fotofactuur; AI vertaalt elk onderdeel en arbeidsloon naar het Nederlands, leest het garage-adres uit (met Google Maps-koppeling), voegt de factuur toe aan *Documenten* en vinkt automatisch de juiste onderhoudsintervallen aan.
- **Zuivere Eigen TCO:** Facturen met een datum of kilometerstand vóór jouw aankoop (`Aankoopdatum` / `Aankoopstand`) blijven zichtbaar in het volledige onderhoudspaspoort van de auto, maar tellen niet mee in je eigen TCO-kosten.
- **Compleet PDF Voertuigdossier:** Exporteer een representatief PDF-boekje inclusief huidige bandenset & profieldieptes en alle gekoppelde PDF-/afbeeldingsfacturen als volwaardige losse bijlagepagina's achteraan het rapport.
