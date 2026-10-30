# 🏠 Home Assistant, Kalender (.ics) & MCP Server

VehicleVault is gebouwd voor naadloze integratie met je smart home, digitale agenda en AI-agents.

---

## 1. Home Assistant Integratie

### A. Uitgaande Sensoren (`GET /api/ha/sensors`)
VehicleVault biedt een compleet JSON-endpoint voor Home Assistant `rest`-sensoren of de custom HACS-integratie.
Maak eerst onder **Instellingen ➔ API-sleutels** een sleutel aan (`vkv_...`) en voeg het volgende toe aan je `configuration.yaml` in Home Assistant:

```yaml
rest:
  - resource: "http://JOUW_SERVER_IP:3001/api/ha/sensors"
    scan_interval: 300
    headers:
      X-API-Key: "vkv_JOUW_API_SLEUTEL"
    sensor:
      - name: "Auto Kilometerstand"
        value_template: "{{ value_json.vehicles[0].odometer }}"
        unit_of_measurement: "km"
        icon: mdi:counter
      - name: "Auto APK Dagen Resterend"
        value_template: "{{ value_json.vehicles[0].apk.days_remaining }}"
        unit_of_measurement: "dagen"
        icon: mdi:calendar-check
      - name: "Auto Gemiddeld Verbruik"
        value_template: "{{ value_json.vehicles[0].fuel_stats.consumption_l_per_100km }}"
        unit_of_measurement: "L/100km"
        icon: mdi:gas-station
```

### B. Inkomende Kilometerstand Webhook (`POST /api/ha/odometer`)
Heeft je auto een eigen integratie in Home Assistant (zoals Kia UVO / Hyundai Bluelink, Tesla, BMW ConnectedDrive, Volkswagen WeConnect of een OBD2-dongle)?
Laat Home Assistant de actuele kilometerstand automatisch doorsturen naar VehicleVault zodat je onderhoudsintervallen én gemonteerde banden altijd realtime bijgewerkt zijn!

```yaml
rest_command:
  vehiclevault_update_odometer:
    url: "http://JOUW_SERVER_IP:3001/api/ha/odometer"
    method: POST
    headers:
      X-API-Key: "vkv_JOUW_API_SLEUTEL"
      Content-Type: "application/json"
    payload: >
      {
        "licensePlate": "NBL-41-K",
        "odometer": {{ states('sensor.kia_niro_odometer') | float(0) }}
      }
```

---

## 2. Kalender Feed (`.ics` / RFC 5545)

Via **Instellingen ➔ Notificaties & Integraties** (of op het Dashboard) kun je een standaard `.ics` kalenderbestand downloaden of koppelen. Hierin staan:
- APK / Keuring vervaldatums (met herinneringsalarmen op 30 dagen en 7 dagen vooraf).
- Geplande onderhoudsdeadlines op basis van je ingestelde tijdsintervallen.

---

## 3. Model Context Protocol (MCP) Server

Met de ingebouwde **MCP Server** kunnen AI-assistenten zoals **Claude Desktop** of **Antigravity** direct vragen beantwoorden over je wagenpark of tankbeurten en onderhoud registreren.

### Beschikbare MCP Tools
- `list_vehicles` — Toont alle actieve voertuigen met km-stand en APK-status.
- `get_vehicle_summary` — Geeft gedetailleerde TCO, verbruik en onderhoudsstatus van een voertuig.
- `log_fuel_entry` — Registreert een nieuwe tankbeurt of laadsessie.
- `log_service_entry` — Registreert een uitgevoerde onderhoudsbeurt.
- `check_maintenance_alerts` — Controleert welke onderdelen of keuringen binnenkort aandacht vragen.
