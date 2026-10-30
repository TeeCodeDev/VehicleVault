# 🚀 Installatie & Docker Deployment

VehicleVault draait volledig zelfstandig in één lichtgewicht Docker-container (beschikbaar voor zowel `linux/amd64` als `linux/arm64` / Raspberry Pi) met een ingebouwde SQLite 3 database in WAL-modus.

---

## 1. Snelstart met Docker Compose

Maak een `docker-compose.yml` bestand aan of clone de repository:

```yaml
services:
  vehiclevault:
    image: ghcr.io/teecodedev/vehiclevault:latest
    container_name: vehiclevault
    restart: unless-stopped
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - DATA_DIR=/data
      - JWT_SECRET=vervang_dit_door_een_lange_willekeurige_sleutel_van_64_tekens
      - JWT_REFRESH_SECRET=vervang_dit_ook_door_een_unieke_geheime_sleutel_van_64_tekens
      - TZ=Europe/Amsterdam
    volumes:
      - ./data:/data
```

Start de container met:
```bash
docker compose up -d
```

Open vervolgens **`http://localhost:3001`** (of het IP-adres van je server).
> **Let op:** Het allereerste account dat je registreert krijgt automatisch **Beheerder (Admin)**-rechten.

---

## 2. Opslag & Mapstructuur (`/data`)

Alle data wordt persistent bewaard in de gemounte `/data` map:
- `/data/vehiclevault.db` — De SQLite 3 database (inclusief WAL-journal).
- `/data/vehicles/` — Geüploade voertuigfoto's en galerijafbeeldingen.
- `/data/receipts/` — Gescande tankbonnen en laadbonnen.
- `/data/invoices/` — Gekoppelde onderhoudsfacturen (PDF & foto's).
- `/data/documents/` — Documenten in de Digitale Handschoenenkast.

---

## 3. Omgevingsvariabelen (`.env`)

| Variabele | Standaard | Beschrijving |
|---|---|---|
| `PORT` | `3001` | Poort waarop zowel de webinterface als de REST API luistert |
| `DATA_DIR` | `/data` | Map voor de SQLite-database en alle bijlagen |
| `JWT_SECRET` | *(verplicht)* | Geheime sleutel voor het ondertekenen van sessietokens |
| `JWT_REFRESH_SECRET` | *(verplicht)* | Geheime sleutel voor refresh-cookies |
| `DISABLE_AUTH` | `false` | Zet op `true` als je lokaal zonder inlogscherm wilt werken (ook instelbaar in de UI) |
| `TRUST_PROXY_AUTH` | `false` | Zet op `true` om Single Sign-On headers van Authelia/Authentik/Pangolin te vertrouwen |

---

## 4. Reverse Proxy & Single Sign-On (SSO)

Als je VehicleVault achter **Pangolin**, **Authelia**, **Authentik**, **Cloudflare Access** of **Traefik** draait, kun je `TRUST_PROXY_AUTH=true` instellen. VehicleVault herkent automatisch de volgende geauthenticeerde headers:
- `Remote-Email` / `X-Forwarded-Email`
- `Remote-User` / `X-Forwarded-User`
- `X-Pangolin-User` / `Cf-Access-Authenticated-User-Email`

---

## 5. 1-Klik Backup & Herstel

Onder **Instellingen ➔ Systeem Backup & Herstel** kun je op elk moment:
1. Een **Volledige Backup (.zip)** downloaden (voert eerst een veilige SQLite `wal_checkpoint(TRUNCATE)` uit en pakt de database plus alle mappen `vehicles`, `receipts`, `invoices` en `documents` in).
2. Een eerder gedownloade `.zip` backup met **1 klik terugzetten** (maakt automatisch eerst een `.bak` veiligheidskopie aan).

