# Security Policy

## Supported Versions

VehicleVault receives active security and maintenance updates on the following releases:

| Version | Supported          |
| ------- | ------------------ |
| 2.0.x   | :white_check_mark: |
| < 2.0.0 | :x:                |

---

## Reporting a Vulnerability

Security is a core priority for VehicleVault. If you discover a security vulnerability, please report it responsibly:

1. **Do not open a public GitHub issue.**
2. Send an email to the repository maintainers or open a [Private Security Advisory](https://github.com/TeeCodeDev/VehicleVault/security/advisories) on GitHub.
3. Include detailed steps to reproduce the issue (proof of concept, curl commands, or environment details).

We will acknowledge receipt within 48 hours and work with you on a swift fix before public disclosure.

---

## Best Practices for Self-Hosting

When deploying VehicleVault in production:

1. **Change Default Secrets:**
   Always generate strong, random strings for `JWT_SECRET` and `JWT_REFRESH_SECRET` in your `.env` file:
   ```bash
   openssl rand -hex 32
   ```

2. **Reverse Proxy & SSL/TLS:**
   Deploy VehicleVault behind a trusted reverse proxy (such as Traefik, Nginx, Caddy, Cloudflare, or Pangolin) with HTTPS enabled.

3. **Reverse Proxy Authentication Headers:**
   Only enable reverse proxy authentication (`ENABLE_PROXY_AUTH=true`) when VehicleVault is exclusively accessible through your reverse proxy and not exposed directly to untrusted networks.

4. **Database & Backup Security:**
   The SQLite database (`vehiclevault.db`) contains operational vehicle and account information. Ensure file permissions on `./data` restrict unauthorized host access.
