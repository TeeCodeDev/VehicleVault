import { z } from 'zod';

/**
 * Sending mail through Microsoft 365 as the signed-in mailbox (delegated access). The admin signs in once with a
 * device code (no app registration of their own) and the app keeps the refresh token, encrypted, to get a new
 * short-lived access token whenever it has to send. The only permission asked for is Mail.Send: the app can send as
 * that account and cannot read any mail. Only the two Microsoft hosts below are called, and no message built here
 * contains a token or a response body.
 */

const LOGIN_HOST = 'https://login.microsoftonline.com';
const GRAPH_HOST = 'https://graph.microsoft.com';

/**
 * Microsoft's own public client "Microsoft Graph Command Line Tools", published for this kind of sign-in (device
 * code, a delegated Graph permission after the user consents). A tenant can block it; an app registration of your
 * own (a public client with the device code flow switched on) can then be used by entering its client ID.
 */
export const DEFAULT_CLIENT_ID = '14d82eec-204b-4c2f-b7e8-296a70dab67e';

/** `openid profile` make Microsoft return who signed in; `offline_access` is what yields the refresh token. */
const SIGN_IN_SCOPE = `${GRAPH_HOST}/Mail.Send offline_access openid profile`;
const SEND_SCOPE = `${GRAPH_HOST}/Mail.Send offline_access`;

/** A directory (tenant) is a GUID or a domain name; nothing else can end up in the URL. */
export const TENANT_PATTERN =
  /^(?:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+)$/;
export const CLIENT_ID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
export const MAILBOX_PATTERN =
  /^[^\s@<>()[\],;:"\\]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;

/** What signing in without a known directory uses: any work or school account. */
export const ANY_ORGANIZATION = 'organizations';

export interface MicrosoftSettings {
  tenantId: string;
  clientId: string;
  /** The account that signed in, and so the mailbox mail is sent from. */
  mailbox: string;
}

/** Where the refresh token lives. Microsoft rotates it on use, so the client reads and writes it every time. */
export interface RefreshTokenStore {
  read(): string | undefined;
  write(token: string): void;
}

export interface MailMessage {
  to: string[];
  subject: string;
  text?: string;
  html?: string;
}

export class MicrosoftError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
  }
}

const TokenSchema = z.object({
  access_token: z.string().min(10),
  expires_in: z.coerce.number().int().positive(),
  refresh_token: z.string().min(10).optional(),
  id_token: z.string().optional(),
});
const ErrorSchema = z.object({ error: z.string().optional() });
const GraphErrorSchema = z.object({ error: z.object({ code: z.string().optional(), message: z.string().optional() }).optional() });

const UNREACHABLE = 'Microsoft is niet bereikbaar (netwerkfout of time-out).';

/** The claims of a token, unverified: they only say what the admin is shown; Microsoft checks the token itself. */
export function claimsOf(token: string | undefined): Record<string, unknown> {
  const payload = token?.split('.')[1];
  if (!payload) return {};
  try {
    const claims: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof claims === 'object' && claims !== null && !Array.isArray(claims) ? (claims as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const scopesOf = (accessToken: string): string[] => {
  const scp = claimsOf(accessToken).scp;
  return typeof scp === 'string' ? scp.split(' ').filter(Boolean) : [];
};

/** What Graph says is not shown as it is: it can carry addresses and ids. A short code is enough. */
const graphProblem = (status: number, body: unknown): string => {
  const code = GraphErrorSchema.safeParse(body).data?.error?.code;
  if (status === 401) return 'Microsoft weigert de aanmelding (401). Meld opnieuw aan bij Microsoft 365.';
  if (status === 403) {
    return 'Microsoft weigert het versturen (403). De aanmelding heeft geen recht om mail te versturen (Mail.Send), of je beheerder blokkeert dat. Meld opnieuw aan.';
  }
  if (status === 404 || code === 'ErrorInvalidUser' || code === 'MailboxNotEnabledForRESTAPI') {
    return 'Dit account heeft geen mailbox die de Graph-API kan gebruiken (een licentie voor Exchange Online is nodig).';
  }
  if (status === 429) return 'Microsoft beperkt het aantal berichten (429). Probeer het over enkele minuten opnieuw.';
  return `Microsoft antwoordde ${status}${code ? ` (${code})` : ''}.`;
};

export class MicrosoftMailClient {
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private token: { value: string; until: number } | undefined;
  private refreshing: Promise<string> | undefined;

  constructor(
    private readonly settings: MicrosoftSettings,
    private readonly store: RefreshTokenStore,
    options: { fetch?: typeof fetch; now?: () => number } = {}
  ) {
    this.fetchImpl = options.fetch ?? fetch;
    this.now = options.now ?? Date.now;
  }

  get mailbox(): string {
    return this.settings.mailbox;
  }

  /** A token for Graph, kept until a minute before it expires. Two callers at once share one refresh. */
  private accessToken(): Promise<string> {
    if (this.token && this.token.until > this.now()) return Promise.resolve(this.token.value);
    this.refreshing ??= this.refresh().finally(() => {
      this.refreshing = undefined;
    });
    return this.refreshing;
  }

  private async refresh(): Promise<string> {
    const refreshToken = this.store.read();
    if (!refreshToken) throw new MicrosoftError('Er is geen aanmelding bij Microsoft 365 (meer). Meld opnieuw aan.');
    let response: Response;
    try {
      response = await this.fetchImpl(`${LOGIN_HOST}/${encodeURIComponent(this.settings.tenantId)}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams({
          client_id: this.settings.clientId,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          scope: SEND_SCOPE,
        }).toString(),
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new MicrosoftError(UNREACHABLE);
    }
    const json: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error = ErrorSchema.safeParse(json).data?.error;
      // invalid_grant: expired after 90 days of not being used, revoked, a new password, or a policy that asks to sign in again.
      const hint =
        error === 'invalid_grant' || error === 'interaction_required'
          ? ' De aanmelding is verlopen of ingetrokken (bijvoorbeeld door een nieuw wachtwoord of een beleid van je organisatie).'
          : '';
      throw new MicrosoftError(`Microsoft weigert de aanmelding (${response.status}).${hint} Meld opnieuw aan bij Microsoft 365.`, response.status);
    }
    const parsed = TokenSchema.safeParse(json);
    if (!parsed.success) throw new MicrosoftError('Onverwacht antwoord van Microsoft bij het aanmelden.');
    // Microsoft hands out a new refresh token each time; the new one lasts longer than the old one.
    if (parsed.data.refresh_token) this.store.write(parsed.data.refresh_token);
    this.token = { value: parsed.data.access_token, until: this.now() + Math.max(0, parsed.data.expires_in - 60) * 1000 };
    return parsed.data.access_token;
  }

  /** Gets a fresh token and reads which permissions it carries, without sending anything. */
  async check(): Promise<{ ok: true; scopes: string[]; canSend: boolean }> {
    const scopes = scopesOf(await this.accessToken());
    return { ok: true, scopes, canSend: scopes.includes('Mail.Send') };
  }

  /** Sends one message as the signed-in account and keeps a copy in its Sent Items. */
  async send(message: MailMessage): Promise<void> {
    const token = await this.accessToken();
    const body = {
      message: {
        subject: message.subject,
        body: message.html
          ? { contentType: 'HTML', content: message.html }
          : { contentType: 'Text', content: message.text ?? '' },
        toRecipients: message.to.map((address) => ({ emailAddress: { address } })),
      },
      saveToSentItems: true,
    };
    let response: Response;
    try {
      response = await this.fetchImpl(`${GRAPH_HOST}/v1.0/me/sendMail`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      });
    } catch {
      throw new MicrosoftError(UNREACHABLE);
    }
    // 202 Accepted: Microsoft has the message and delivers it; it says nothing more.
    if (response.status !== 202 && !response.ok) {
      throw new MicrosoftError(graphProblem(response.status, await response.json().catch(() => null)), response.status);
    }
  }
}

// ---- Signing in with a device code ----

const DeviceCodeSchema = z.object({
  device_code: z.string().min(10),
  user_code: z.string().regex(/^[A-Za-z0-9-]{4,20}$/),
  verification_uri: z.string().optional(),
  expires_in: z.coerce.number().int().positive(),
  interval: z.coerce.number().int().positive().optional(),
});

/** Where the admin enters the code. Taken from Microsoft's answer only when it is a Microsoft address over https. */
const DEVICE_LOGIN_URL = 'https://microsoft.com/devicelogin';
const microsoftAddress = (value: string | undefined): string => {
  try {
    const url = new URL(value ?? '');
    const host = url.hostname.toLowerCase();
    const ours = host === 'microsoft.com' || host.endsWith('.microsoft.com') || host === 'microsoftonline.com' || host.endsWith('.microsoftonline.com');
    return url.protocol === 'https:' && ours && !url.username && !url.password ? url.toString() : DEVICE_LOGIN_URL;
  } catch {
    return DEVICE_LOGIN_URL;
  }
};

export interface DeviceCodeRequest {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresInSeconds: number;
  intervalSeconds: number;
}

export async function requestDeviceCode(tenant: string, clientId: string, fetchImpl: typeof fetch = fetch): Promise<DeviceCodeRequest> {
  let response: Response;
  try {
    response = await fetchImpl(`${LOGIN_HOST}/${encodeURIComponent(tenant)}/oauth2/v2.0/devicecode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({ client_id: clientId, scope: SIGN_IN_SCOPE }).toString(),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new MicrosoftError(UNREACHABLE);
  }
  const json: unknown = await response.json().catch(() => null);
  const parsed = DeviceCodeSchema.safeParse(json);
  if (!response.ok || !parsed.success) {
    throw new MicrosoftError(
      `Microsoft wil de aanmelding niet starten (${response.status}). Controleer de tenant en het client-id, en of je organisatie aanmelden met een code toestaat.`,
      response.status
    );
  }
  return {
    deviceCode: parsed.data.device_code,
    userCode: parsed.data.user_code,
    verificationUri: microsoftAddress(parsed.data.verification_uri),
    expiresInSeconds: parsed.data.expires_in,
    intervalSeconds: Math.min(Math.max(parsed.data.interval ?? 5, 2), 30),
  };
}

export type DevicePoll =
  | { state: 'pending'; slowDown: boolean }
  | { state: 'failed'; message: string }
  | { state: 'done'; refreshToken: string; tenantId: string; mailbox: string; scopes: string[] };

/** One look at whether the admin has signed in yet. */
export async function pollDeviceCode(tenant: string, clientId: string, deviceCode: string, fetchImpl: typeof fetch = fetch): Promise<DevicePoll> {
  let response: Response;
  try {
    response = await fetchImpl(`${LOGIN_HOST}/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: deviceCode,
      }).toString(),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return { state: 'failed', message: UNREACHABLE };
  }
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    switch (ErrorSchema.safeParse(json).data?.error) {
      case 'authorization_pending':
        return { state: 'pending', slowDown: false };
      case 'slow_down':
        return { state: 'pending', slowDown: true };
      case 'authorization_declined':
        return { state: 'failed', message: 'De aanmelding is geweigerd bij Microsoft.' };
      case 'expired_token':
      case 'code_expired':
        return { state: 'failed', message: 'De code is verlopen. Begin opnieuw.' };
      default:
        return {
          state: 'failed',
          message: `Microsoft heeft de aanmelding niet afgerond (${response.status}). Je organisatie staat aanmelden met deze toepassing misschien niet toe; vraag een beheerder, of gebruik bij Geavanceerd het client-id van een eigen app.`,
        };
    }
  }
  const parsed = TokenSchema.safeParse(json);
  if (!parsed.success || !parsed.data.refresh_token) {
    return { state: 'failed', message: 'Onverwacht antwoord van Microsoft bij het aanmelden.' };
  }
  const scopes = scopesOf(parsed.data.access_token);
  if (!scopes.includes('Mail.Send')) {
    return {
      state: 'failed',
      message:
        'Aangemeld, maar zonder het recht om mail te versturen (Mail.Send). Waarschijnlijk is toestemming door gebruikers uitgeschakeld in je organisatie: laat een beheerder bij het aanmelden toestemming geven namens de organisatie.',
    };
  }
  const claims = claimsOf(parsed.data.id_token);
  const tenantId = typeof claims.tid === 'string' ? claims.tid : '';
  const mailbox = [claims.preferred_username, claims.email, claims.upn].find(
    (v): v is string => typeof v === 'string' && MAILBOX_PATTERN.test(v)
  );
  if (!TENANT_PATTERN.test(tenantId) || !mailbox) {
    return {
      state: 'failed',
      message: 'Microsoft meldde niet bij welk account en welke organisatie je bent aangemeld. Probeer het opnieuw met een werk- of schoolaccount.',
    };
  }
  return { state: 'done', refreshToken: parsed.data.refresh_token, tenantId, mailbox, scopes };
}
