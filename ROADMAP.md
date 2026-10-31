# VehicleVault — Roadmap & Planned Features

Dit document bevat de geplande features en ideeën voor toekomstige releases van **VehicleVault**.

---

## Gepland voor volgende releases (v2.1+)

### 1. Caravan / Aanhanger modus bij Tank- & Laadbeurten (`Towing / Hauling`)
- **Probleem:** Een paar weken rijden met een caravan, vouwwagen, aanhanger of dakkoffer/fietsendrager trekt het reguliere gemiddelde verbruik van het voertuig flink omlaag.
- **Oplossing:**
  - Een optioneel vinkje **"Met aanhanger / caravan"** (`is_towing`) toevoegen bij het invoeren van een tank- of laadbeurt.
  - In het brandstofoverzicht, op het Dashboard en in de TCO-statistieken het gemiddelde verbruik splitsen in:
    - **Normaal verbruik** (zonder aanhanger)
    - **Verbruik met aanhanger/caravan**
  - Een filter-toggle in de grafieken om ritten met aanhanger wel of niet mee te nemen in het totaaloverzicht.

### 2. Garage-brede Kostenvergelijking (`Fleet / Garage Analytics`)
- **Probleem:** De huidige Rapportages & TCO-pagina toont gedetailleerde cijfers per geselecteerd voertuig, maar mist een totaaloverzicht over alle voertuigen heen.
- **Oplossing:**
  - Een **"Hele Garage" (Fleet)** weergave toevoegen aan de TCO & Rapportages-pagina.
  - Alle actieve voertuigen in de garage naast elkaar vergelijken (totale kosten dit jaar, kosten per maand, kosten per km en verdeling tussen brandstof, onderhoud en vaste lasten).
  - Maandelijkse kostentrend met voortschrijdend gemiddelde (*3-maands en 6-maands rolling average*).

### 3. Remmen-status per Wielhoek gekoppeld aan Bandenbeheer (`Brakes Tracking`)
- **Probleem:** Naast bandenprofiel zijn remblokken en remschijven essentiële slijtageonderdelen die je vaak ziet zodra de wielen eraf zijn.
- **Oplossing:**
  - Uitbreiding op de module **Bandenbeheer**: per wielhoek (LV, RV, LA, RA) of per as (Voor / Achter) de dikte/staat van **remblokken (mm)** en **remschijven** kunnen bijhouden inclusief slijtage-indicatie.
  - **Slimme workflow:** Zodra je in Bandenbeheer een **bandenwissel** (bijv. zomer ↔ winter) registreert — het moment waarop de wielen er toch af liggen — direct een optionele prompt tonen om meteen de huidige remblokdikte te meten en vast te leggen.

### 4. Automatische Kilometerstand & Telemetrie Koppeling (Mijn Kia / Merk-apps, Home Assistant & OBD2)
- **Probleem:** De actuele kilometerstand wordt nu alleen bijgewerkt bij het invoeren van een tankbeurt, rit of onderhoudsbeurt, terwijl veel moderne auto's hun actuele kilometerstand al digitaal doorgeven via een merk-app (zoals **Mijn Kia / Kia Connect**, Hyundai Bluelink, VW WeConnect, Tesla, Peugeot/Stellantis, BMW ConnectedDrive) of een OBD2-dongle.
- **Oplossing:**
  - **Directe / Cloud Merk-koppelingen & Home Assistant Bridge:**
    - Een inkomende **Telemetry / Odometer Sync API & Webhook** (`/api/integrations/telemetry/odometer`) waarmee de actuele kilometerstand (en eventueel EV-accustatus / brandstofniveau / locatie) automatisch gepusht kan worden vanuit:
      1. **Home Assistant** (waar integraties zoals *Kia Uvo / Hyundai Bluelink* de data uit de **Mijn Kia** app al kant-en-klaar uitlezen) of rechtstreekse koppeling met merk-API's.
      2. **OBD2 / WiCAN / Torque Pro** dongles die bij thuiskomst via WiFi/HTTP of MQTT hun data doorsturen.
      3. **iOS Opdrachten (Apple Shortcuts) / Android Tasker** (bijv. automatisch bij loskoppelen van CarPlay of Bluetooth in de auto).
  - Doordat de kilometerstand dagelijks op de achtergrond synchroon blijft, lopen ook alle **onderhoudsintervallen (km-triggers)** en **bandenslijtage-berekeningen** altijd real-time gelijk met de auto, zelfs tussen twee tankbeurten in.

### 5. Native Web Push (VAPID) Notificaties in de PWA & E-mail Presets (Gmail / Microsoft 365)
- ✅ **Native PWA Web Push:** Gerealiseerd. Browser/PWA push-notificaties via de Web Push standaard (VAPID, Service Worker), zonder externe notificatieservice.
- **E-mail Presets & OAuth2 / Graph opties:** Snelle 1-klik presets in de UI voor o.a. **Gmail** (`smtp.gmail.com`) en **Microsoft 365 / Outlook.com** (`smtp.office365.com` / Microsoft Graph API).

### 6. Native Passkey / WebAuthn Ondersteuning
- **Passkeys (FaceID / TouchID / Windows Hello / YubiKey):** Naast de bestaande ondersteuning voor Reverse Proxy SSO (Authelia, Authentik, Pangolin, Cloudflare Access) ook directe ingebouwde WebAuthn / Passkey-authenticatie toevoegen voor passwordless inloggen.



