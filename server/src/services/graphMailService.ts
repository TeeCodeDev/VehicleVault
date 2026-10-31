import crypto from 'node:crypto';
import { describeGraphError, formatFailure } from './mailErrors.js';

export interface GraphConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  /** Mailbox the messages are sent from (user principal name or primary address). */
  sender: string;
}

export interface GraphMessage {
  to: string[];
  subject: string;
  text?: string;
  html?: string;
}

const TOKEN_HOST = 'https://login.microsoftonline.com';
const GRAPH_HOST = 'https://graph.microsoft.com/v1.0';
const TIMEOUT_MS = 15000;

const TENANT_PATTERN = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[a-z0-9-]+(\.[a-z0-9-]+)+)$/i;
const CLIENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ADDRESS_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

/**
 * Sends mail through the Microsoft Graph API with app-only credentials (client credentials flow): an app
 * registration in Microsoft Entra ID with the Mail.Send application permission. No SMTP AUTH, no password of a
 * person, no browser sign-in on the server.
 */
export class GraphMailService {
  private static token: { key: string; value: string; expiresAt: number } | null = null;

  public static isConfigured(config: GraphConfig): boolean {
    return Boolean(config.tenantId && config.clientId && config.clientSecret && config.sender);
  }

  /** Reject values that do not look like what Entra ID hands out, before they end up in a URL. */
  public static validate(config: GraphConfig): string | null {
    if (!TENANT_PATTERN.test(config.tenantId)) return 'Tenant ID moet een GUID of een domeinnaam zijn (bijv. contoso.onmicrosoft.com).';
    if (!CLIENT_ID_PATTERN.test(config.clientId)) return 'Client ID moet een GUID zijn (Application (client) ID uit Azure).';
    if (!config.clientSecret) return 'Client secret ontbreekt.';
    if (!ADDRESS_PATTERN.test(config.sender)) return 'Afzender moet een e-mailadres zijn van een mailbox in je tenant.';
    return null;
  }

  private static async timedFetch(url: string, init: RequestInit): Promise<Response> {
    return fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  }

  public static async getAccessToken(config: GraphConfig): Promise<string> {
    const key = crypto
      .createHash('sha256')
      .update(`${config.tenantId}|${config.clientId}|${config.clientSecret}`)
      .digest('hex');
    if (this.token && this.token.key === key && this.token.expiresAt > Date.now() + 60_000) {
      return this.token.value;
    }

    const res = await this.timedFetch(`${TOKEN_HOST}/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
    });
    const body = await res.text();
    if (!res.ok) throw new Error(formatFailure(describeGraphError(res.status, body)));

    const json = JSON.parse(body);
    this.token = { key, value: json.access_token, expiresAt: Date.now() + Number(json.expires_in || 3600) * 1000 };
    return json.access_token;
  }

  public static resetTokenCache(): void {
    this.token = null;
  }

  /** Checks tenant, client ID and secret. Mail.Send itself can only be proven by sending a message. */
  public static async verify(config: GraphConfig): Promise<{ success: boolean; message: string }> {
    const invalid = this.validate(config);
    if (invalid) return { success: false, message: invalid };
    try {
      this.resetTokenCache();
      await this.getAccessToken(config);
      return {
        success: true,
        message: 'Aanmelden bij Microsoft is gelukt. Of de app mag versturen vanuit deze mailbox merk je bij het versturen van een testmail.',
      };
    } catch (err: any) {
      return { success: false, message: `Microsoft Graph: ${err?.message || 'Onbekende fout'}` };
    }
  }

  public static async send(config: GraphConfig, message: GraphMessage): Promise<{ success: boolean; message: string }> {
    const invalid = this.validate(config);
    if (invalid) return { success: false, message: invalid };

    try {
      const token = await this.getAccessToken(config);
      const res = await this.timedFetch(`${GRAPH_HOST}/users/${encodeURIComponent(config.sender)}/sendMail`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            subject: message.subject,
            body: message.html
              ? { contentType: 'HTML', content: message.html }
              : { contentType: 'Text', content: message.text || '' },
            toRecipients: message.to.map((address) => ({ emailAddress: { address } })),
          },
          saveToSentItems: false,
        }),
      });

      if (res.status === 202 || res.ok) {
        return { success: true, message: `E-mail succesvol verzonden via Microsoft Graph (${config.sender})` };
      }
      if (res.status === 401) this.resetTokenCache();
      const failure = describeGraphError(res.status, await res.text());
      return { success: false, message: `Verzenden mislukt: ${formatFailure(failure)}` };
    } catch (err: any) {
      const reason = err?.name === 'TimeoutError' ? 'Microsoft reageerde niet binnen 15 seconden' : err?.message || 'Onbekende fout';
      return { success: false, message: `Verzenden mislukt: ${reason}` };
    }
  }
}
