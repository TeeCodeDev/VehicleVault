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
| **Pushover** | User Key + Application API Token + optional target Device name (priority `1` for overdue alerts, HTML formatting) |
| **Ntfy.sh** | Self-hosted or public topic URL + optional Bearer access token |
| **Gotify** | Server URL + Application Token |
| **Webhook (Discord / Slack / Generic)** | Automatically formats rich embeds for Discord/Slack or dispatches a structured JSON payload |
| **E-mail** | Sent through **SMTP** or **Microsoft Graph** (see below). Recipients (`To`) may be several addresses separated by commas |

### E-mail settings
Under **Settings → Notifications → E-mail**, one configuration serves the alert e-mails and the password-reset links.

**SMTP** — Host, port (`587` STARTTLS / `465` SSL), user, password, sender (`From`). One-click presets fill in host, port and encryption:

| Preset | Server | Notes |
| :--- | :--- | :--- |
| **Gmail** | `smtp.gmail.com:587` | Needs an app password (2-step verification on) |
| **Microsoft 365** | `smtp.office365.com:587` | SMTP AUTH must be enabled for the mailbox; the sender must be that mailbox. Where SMTP AUTH is off, use Graph |
| **Outlook.com** | `smtp-mail.outlook.com:587` | App password with 2-step verification |

Under *Advanced*: **Require STARTTLS** (refuse to send unencrypted) and **Ignore certificate errors** (own mail server with a self-signed certificate only).

**Microsoft Graph** — sends with app-only credentials, so no SMTP AUTH and no password of a person:
1. Microsoft Entra ID → *App registrations* → *New registration* (single tenant). Note the **Application (client) ID** and **Directory (tenant) ID**.
2. *Certificates & secrets* → *New client secret*. Copy the **value** straight away.
3. *API permissions* → *Microsoft Graph* → *Application permissions* → **Mail.Send** → *Grant admin consent*.
4. Enter tenant ID, client ID, client secret and the **sender mailbox** (must exist in the tenant with an Exchange Online licence) in VehicleVault.

`Mail.Send` as an application permission covers every mailbox in the tenant. Restrict the app to the sender mailbox with an *ApplicationAccessPolicy* in Exchange Online.

**Check connection** verifies the login without sending anything (for Graph: tenant, client ID and secret; the `Mail.Send` permission itself is only proven by **Send test mail**). Failures are explained: wrong app password, SMTP AUTH disabled, TLS mode that does not match the port, unreachable server, a missing Graph permission, and so on. Secrets are never sent back to the browser; leaving a secret field untouched keeps the stored value.

Settings can also come from the environment (`SMTP_*`, `SMTP_REQUIRE_TLS`, `SMTP_IGNORE_TLS_ERRORS`, `MAIL_TRANSPORT`, `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET`, `GRAPH_SENDER`); values saved in the UI take precedence.

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
