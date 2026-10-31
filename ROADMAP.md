# VehicleVault — Roadmap & Planned Features

Dit document bevat de geplande features en ideeën voor toekomstige releases van **VehicleVault**.

---

## Gepland voor volgende releases (v2.1+)

### 1. Opsplitsing Systeem/Admin-instellingen en "Mijn Profiel / Account"
- **Probleem:** Momenteel staan persoonlijke instellingen van de ingelogde gebruiker (zoals Passkeys, TOTP 2FA, eigen e-mailadres/wachtwoord, thema en taal) tussen globale beheerder-instellingen (zoals Module-activatie, AI Bonherkenning, SMTP/E-mail configuratie, OIDC SSO-koppeling en Database Backups). Een gewone gebruiker hoort geen server-beheeropties te zien, en een passkey of 2FA is strikt gebonden aan één individuele gebruiker.
- **Oplossing:**
  - Een duidelijke scheiding tussen:
    - **Mijn Profiel & Beveiliging (`/profile`):** Persoonlijke accountinstellingen (Passkeys toevoegen/beheren, TOTP 2FA activeren, sessies/herstelcodes inzien, wachtwoord wijzigen, persoonlijke weergavevoorkeuren).
    - **Systeembeheer (`/settings` of `/admin`):** Alleen zichtbaar voor beheerders (Module-instellingen, OIDC/SSO provider, AI Vision sleutels, Notificatiekanalen/SMTP, Gebruikersbeheer & Toegangsrechten, Backups).

### 2. Tolvignetten & Milieustickers als Apart Hoofdmenu-item
- **Probleem:** Vignetten en milieustickers (zoals het Zwitsers e-vignet, Oostenrijkse Autobahnvignet, Franse Crit'Air sticker, Duitse Umweltplakette) staan nu ingebed binnen het voertuigscherm.
- **Oplossing:**
  - Een eigen volwaardig hoofdmenu-item **🏷️ Vignetten & Milieustickers** toevoegen aan de navigatie (zijbalk en mobiele navigatie), net zoals Brandstof, Onderhoud, Banden en Documenten.
  - Een handig overzichtsscherm per voertuig of garage-breed met:
    - Actieve en verlopen vignetten per land.
    - Duidelijke statusbadge (Geldig, Bijna verlopen, Verlopen).
    - Countdown-timer tot verloopdatum en directe koppeling naar bijbehorend aankoopbewijs/PDF.
    - Filterbaar op land (CH, AT, FR, DE, SI, CZ, etc.) en voertuig.

### 3. Bandenbeheer: Aanschafprijs & Factuurkoppeling
- **Probleem:** Bij een set banden kun je nu merk, maat, dot-code en profieldiepte vastleggen, maar nog niet direct de totale aanschafprijs (inclusief montage) en de gekoppelde aankoopfactuur.
- **Oplossing:**
  - Velden `purchase_price` (€) en `purchase_date` toevoegen aan de `tire_sets` tabel en formulieren.
  - Directe factuurkoppeling: bij het registreren of bewerken van een bandenset direct de PDF/foto-aankoopnota kunnen uploaden of selecteren uit de bestaande Documenten.
  - Meenemen van bandenaanschafkosten in de TCO- en kilometerkostenberekeningen.

### 4. Caravan / Aanhanger modus bij Tank- & Laadbeurten (`Towing / Hauling`)
- **Probleem:** Een paar weken rijden met een caravan, vouwwagen, aanhanger of dakkoffer/fietsendrager trekt het reguliere gemiddelde verbruik van het voertuig flink omlaag.
- **Oplossing:**
  - Een optioneel vinkje **"Met aanhanger / caravan"** (`is_towing`) toevoegen bij het invoeren van een tank- of laadbeurt.
  - In het brandstofoverzicht, op het Dashboard en in de TCO-statistieken het gemiddelde verbruik splitsen in:
    - **Normaal verbruik** (zonder aanhanger)
    - **Verbruik met aanhanger/caravan**
  - Een filter-toggle in de grafieken om ritten met aanhanger wel of niet mee te nemen in het totaaloverzicht.

### 5. Garage-brede Kostenvergelijking & Uitgebreidere Rapportages (`Fleet / Garage Analytics`)
- **Probleem:** De huidige Rapportages & TCO-pagina toont gedetailleerde cijfers per geselecteerd voertuig, maar mist een totaaloverzicht over alle voertuigen heen en diepere trends.
- **Oplossing:**
  - Een **"Hele Garage" (Fleet)** weergave toevoegen aan de TCO & Rapportages-pagina.
  - Alle actieve voertuigen in de garage naast elkaar vergelijken (totale kosten dit jaar, kosten per maand, kosten per km en verdeling tussen brandstof, onderhoud en vaste lasten).
  - Maandelijkse kostentrend met voortschrijdend gemiddelde (*3-maands en 6-maands rolling average*).
  - Uitgebreidere exportmogelijkheden (CSV/Excel en periodieke PDF managementrapporten).

### 6. Remmen-status per Wielhoek gekoppeld aan Bandenbeheer (`Brakes Tracking`)
- **Probleem:** Naast bandenprofiel zijn remblokken en remschijven essentiële slijtageonderdelen die je vaak ziet zodra de wielen eraf zijn.
- **Oplossing:**
  - Uitbreiding op de module **Bandenbeheer**: per wielhoek (LV, RV, LA, RA) of per as (Voor / Achter) de dikte/staat van **remblokken (mm)** en **remschijven** kunnen bijhouden inclusief slijtage-indicatie.
  - **Slimme workflow:** Zodra je in Bandenbeheer een **bandenwissel** (bijv. zomer ↔ winter) registreert — het moment waarop de wielen er toch af liggen — direct een optionele prompt tonen om meteen de huidige remblokdikte te meten en vast te leggen.

### 7. Automatische Kilometerstand & Telemetrie Koppeling (Home Assistant, Merk-apps & OBD2)
- **Probleem:** De actuele kilometerstand wordt nu alleen bijgewerkt bij het invoeren van een tankbeurt, rit of onderhoudsbeurt.
- **Oplossing:**
  - Inkomende **Telemetry / Odometer Sync API & Webhook** (`/api/integrations/telemetry/odometer`) waarmee de actuele kilometerstand automatisch gepusht kan worden vanuit:
    1. **Home Assistant** (bijv. Kia Uvo / Hyundai Bluelink / Tesla integraties)
    2. **OBD2 / WiCAN / Torque Pro** dongles
    3. **iOS Opdrachten (Apple Shortcuts) / Android Tasker** (bijv. bij loskoppelen van CarPlay of Bluetooth in de auto)
  - Real-time onderhoudstriggers en bandenslijtageberekening tussen tankbeurten door.

---

## Reeds Gerealiseerd in v2.0 & v2.1
- ✅ **Passkeys (WebAuthn):** Direct inloggen via TouchID / FaceID / Windows Hello / YubiKey.
- ✅ **OIDC / SSO (OpenID Connect):** Koppel externe identity providers zoals Authentik, Keycloak, Authelia, Cloudflare Access of Google Workspace inclusief connection testing.
- ✅ **2FA (TOTP):** Twee-factor authenticatie met authenticator apps en eenmalige noodherstelcodes.
- ✅ **Documentbeheer:** In-line aanpassen van factuurdatum, titel, categorie en notities met datumsortering.
- ✅ **Native Web Push (VAPID):** Directe browser/PWA push-notificaties zonder externe clouddiensten.
- ✅ **E-mail & SMTP/Graph Integraties:** 1-klik presets voor Gmail, Microsoft 365, Graph API en device code login.
