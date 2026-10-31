# 🔔 Notifications, Multi-User Sharing & Security

---

## 1. Push & Email Notification Channels

Under **Settings → Meldingen (Notifications)**, configure automated alerts for:
- **Approaching APK / Technical Inspections** (within 30 days or overdue)
- **Maintenance Intervals** (`warning` at 90% or `overdue` at 100%)
- **Expiring Glovebox Documents** (insurance policies, green cards, warranties expiring within 30 days)

### Supported Providers
| Provider | Configuration |
| :--- | :--- |
| **Web Push (PWA)** | No account or settings needed: each person turns it on for their own device under **Settings → Notifications → Web Push**. Alerts go to every enabled device (see below) |
| **Pushover** | User Key + Application API Token + optional target Device name (priority `1` for overdue alerts, HTML formatting) |
| **Ntfy.sh** | Self-hosted or public topic URL + optional Bearer access token |
| **Gotify** | Server URL + Application Token |
| **Webhook (Discord / Slack / Generic)** | Automatically formats rich embeds for Discord/Slack or dispatches a structured JSON payload |
| **SMTP Email** | Host, Port (`587`/`465`), TLS, Username, Password, Sender (`From`), and Recipient (`To`) |

### Web Push (PWA)
VehicleVault sends Web Push messages (RFC 8030, signed with VAPID keys) straight to the push service of the browser (Google, Apple, Mozilla, Microsoft). No external notification service is involved.

1. An admin selects **Web Push (PWA)** as the provider and saves.
2. Every person opens **Settings → Notifications** on their own phone or computer and presses **Turn on for this device**, then allows notifications when the browser asks. **Send test to my devices** verifies it.
3. APK, maintenance and document alerts go to **all** enabled devices of **all** users. Devices that the browser has revoked (HTTP 404/410 from the push service) are removed automatically.

Requirements and limits:
- **HTTPS is required** (or `localhost`). Put VehicleVault behind a reverse proxy with a certificate.
- **iPhone / iPad (iOS 16.4+):** Safari only allows Web Push for the app added to the Home Screen (Share → *Add to Home Screen*); open it from there before turning notifications on.
- A user can enable at most 10 devices. Endpoints must be `https` DNS names of a push service, so the server never POSTs to IP addresses or internal hosts.
- The VAPID key pair is generated on first use and stored in the database (`system_settings`), so it is included in backups. To manage the keys yourself, set `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` (and optionally `VAPID_SUBJECT`, a `mailto:` or `https:` contact). If the key pair changes, devices must press **Turn on** again; the app re-subscribes them with the new key.

---

## 2. Multi-User Garage Isolation & Vehicle Sharing

### Strict Per-User Isolation
By default, every registered user has a strictly isolated garage: User A cannot see User B's vehicles.

### Granular Vehicle Sharing (`vehicle_shares`)
Want to share a family car with your partner, parents, or co-driver?
1. Go to **My Garage (`Mijn Garage`)** and click the **Share (`Delen`)** button on any vehicle you own.
2. Select or enter the email address of a registered user and choose their access level:
   - **`Editor (Bewerker)`:** Can view and log fuel fill-ups, maintenance records, documents, tire measurements, trips, fixed expenses, and view TCO analytics. Only the owner can delete the vehicle itself.
   - **`Viewer (Kijker)`:** Read-only access to the vehicle's dashboard, fuel history, maintenance history, documents, tires, and TCO analytics.
3. Shared vehicles display a **`Gedeeld door ...` (Shared by)** badge in the recipient's garage.

### Roles (`admin`, `user`, `driver`)
- **`admin`:** Full system access, AI/Notification/Backup settings, and user management.
- **`user`:** Full VehicleVault interface for their own vehicles and any vehicles shared with them.
- **`driver` (`Chauffeur Modus`):** Simplified, high-contrast mobile dashboard focused on 1-click fueling, EV charging, and trip logging.

---

## 3. Reverse Proxy SSO & No-Auth Mode

- **Zero-Config Reverse Proxy SSO:** Supports **Pangolin**, **Authelia**, **Authentik**, **Traefik**, and **Cloudflare Access** via `Remote-Email`, `X-Forwarded-Email`, or `X-Pangolin-User` headers.
- **No-Auth Mode (`DISABLE_AUTH=true`):** Can be toggled in **Settings → Algemeen** or via `.env` for trusted local home networks.

---

## 4. Passkeys & Recovery Codes

Passkeys let you sign in with a fingerprint, face or device PIN instead of typing a password. They work **next to** the password, which stays available as the fallback.

### Requirements
- A **domain name** and **HTTPS** (or `localhost`). Browsers refuse passkeys on IP addresses and plain HTTP; the login page then shows why and the password keeps working.
- Behind a reverse proxy, set the public address explicitly and forward `X-Forwarded-Proto`:

```env
RP_ID=vault.yourdomain.com
RP_ORIGINS=https://vault.yourdomain.com
```

Without these, VehicleVault uses the address of the request. Passkeys are bound to `RP_ID`: if you move to another domain, existing passkeys stop working (your password and recovery codes still do).

### Using them
1. **Settings → Gebruikers & Toegang → Passkeys:** name the passkey and press **Passkey toevoegen**.
2. On the login page, press **Inloggen met passkey**. No e-mail address is needed.
3. You can rename or remove passkeys there. The last way to sign in cannot be removed.

### Recovery codes
- Your first passkey comes with **8 one-time recovery codes**. They are shown **once**; store them somewhere safe.
- Lost your device? On the login page open **Apparaat kwijt?**, enter a code, and add a new passkey in Settings.
- Codes are stored only as SHA-256 hashes and are consumed on use. **Nieuwe codes maken** replaces all of them.

### Notes
- Passkeys are not offered when you sign in through a reverse proxy (SSO), with an API key, or with authentication disabled.
- Implementation: `@simplewebauthn/server` verifies origin, relying-party ID, challenge and signature; VehicleVault stores the public key and signature counter per passkey.
