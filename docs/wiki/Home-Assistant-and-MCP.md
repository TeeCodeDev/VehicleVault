# 🏠 Home Assistant, Calendar Feed (`.ics`) & MCP Server

VehicleVault integrates with your smart home, calendar apps, and AI coding/chat assistants.

---

## 1. Home Assistant Integration

Navigate to **Settings → Home Assistant** to generate ready-to-copy YAML snippets and API keys.

### Outbound: Vehicle Sensors (`GET /api/integrations/ha/states`)
Exposes all active vehicles with their current odometer, APK expiration date & countdown days, fuel consumption (`L/100km` and `km/L`), TCO metrics, and maintenance interval statuses:

```yaml
rest:
  - resource: "http://YOUR_VEHICLEVAULT_IP:3084/api/integrations/ha/states"
    scan_interval: 3600
    headers:
      X-API-Key: "vkv_your_generated_api_key"
    sensor:
      - name: "VehicleVault Fleet"
        value_template: "{{ value_json.count }}"
        json_attributes:
          - vehicles
```

### Inbound: Live Odometer Webhook (`POST /api/integrations/ha/odometer`)
Automatically push your car's live odometer reading from Home Assistant (e.g., via Kia UVO / Hyundai Bluelink, Tesla, BMW ConnectedDrive, Volkswagen WeConnect, or ESPHome OBD2) into VehicleVault:

```yaml
rest_command:
  vehiclevault_update_odometer:
    url: "http://YOUR_VEHICLEVAULT_IP:3084/api/integrations/ha/odometer"
    method: POST
    headers:
      X-API-Key: "vkv_your_generated_api_key"
      Content-Type: "application/json"
    payload: '{"license_plate": "K-123-BB", "odometer": {{ states("sensor.car_odometer") | int }}}'
```

---

## 2. RFC 5545 Calendar Export (`.ics`)

Subscribe to or download your vehicle's inspection and maintenance schedule in **Google Calendar**, **Apple Calendar**, **Outlook**, or **Nextcloud**:
- **Per-Vehicle or Fleet-Wide `.ics`:** Available via `GET /api/vehicles/:id/calendar.ics` or from the **My Garage** page.
- Includes upcoming **APK / MOT / TÜV expiration dates**, **time-based maintenance intervals**, and **document expiration reminders** with built-in `VALARM` notifications (30 days and 7 days prior).

---

## 3. Model Context Protocol (MCP) Server

VehicleVault includes a native **MCP Server** (`POST /api/mcp` and `stdio`) so AI assistants like **Claude Desktop** and **Antigravity** can query and log vehicle data directly:

- `list_vehicles`: List all active vehicles and current odometer readings
- `get_vehicle_summary`: Retrieve complete TCO, fuel economy, APK status, and maintenance health
- `log_fuel_entry`: Record a new fuel fill-up or EV charge session
- `log_service_entry`: Log a maintenance or repair entry
- `check_maintenance_alerts`: Inspect upcoming or overdue service intervals across your fleet
