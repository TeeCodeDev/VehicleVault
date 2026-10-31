import crypto from 'node:crypto';
import MailComposer from 'nodemailer/lib/mail-composer/index.js';
import { z } from 'zod';

/**
 * Sending mail through Gmail as the signed-in Google account (delegated access, Gmail API). Google's device-code
 * flow does not allow the Gmail scopes, so the admin signs in with the authorization-code flow (with PKCE) using an
 * OAuth client of their own: client ID and secret from their Google Cloud project, entered once in the app. The
 * only permission asked for is gmail.send: the app can send as that account and cannot read any mail.
 */

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
const SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
const SIGN_IN_SCOPE = `openid email ${SEND_SCOPE}`;

export const GOOGLE_CLIENT_ID_PATTERN = /^[0-9]{6,}-[A-Za-z0-9_-]{8,}\.apps\.googleusercontent\.com$/;
/** Secrets look like GOCSPX-…; only the characters Google uses are accepted. */
export const GOOGLE_CLIENT_SECRET_PATTERN = /^[A-Za-z0-9_-]{10,200}$/;

export interface GoogleSettings {
  clientId: string;
  clientSecret: string;
  /** The account that signed in, and so the address mail is sent from. */
  account: string;
}

export interface RefreshTokenStore {
  read(): string | undefined;
}

export interface GoogleMailMessage {
  to: string[];
  subject: string;
  text?: string;
  html?: string;
}

export class GoogleError extends Error {
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
  scope: z.string().optional(),
});
const ErrorSchema = z.object({ error: z.string().optional() });
const GmailErrorSchema = z.object({
  error: z
    .object({
      status: z.string().optional(),
      message: z.string().optional(),
      errors: z.array(z.object({ reason: z.string().optional() })).optional(),
    })
    .optional(),
});

const UNREACHABLE = 'Google is niet bereikbaar (netwerkfout of time-out).';

function claimsOf(token: string | undefined): Record<string, unknown> {
  const payload = token?.split('.')[1];
  if (!payload) return {};
  try {
    const claims: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof claims === 'object' && claims !== null && !Array.isArray(claims) ? (claims as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const gmailProblem = (status: number, body: unknown): string => {
  const parsed = GmailErrorSchema.safeParse(body).data?.error;
  const reason = parsed?.errors?.[0]?.reason ?? '';
  if (status === 401) return 'Google weigert de aanmelding (401). Verbind opnieuw met Google.';
  if (status === 403 && /accessNotConfigured|has not been used in project|is disabled/i.test(`${reason} ${parsed?.message ?? ''}`)) {
    return 'De Gmail API staat niet aan in je Google Cloud-project. Zet hem aan onder API\'s en services → Bibliotheek → Gmail API.';
  }
  if (status === 403) return 'Google weigert het versturen (403). De aanmelding heeft geen recht om mail te versturen (gmail.send). Verbind opnieuw en laat dat recht aangevinkt.';
  if (status === 429) return 'Google beperkt het aantal berichten (429). Probeer het later opnieuw.';
  return `Google antwoordde ${status}${parsed?.status ? ` (${parsed.status})` : ''}.`;
};

export class GoogleMailClient {
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private token: { value: string; until: number } | undefined;
  private refreshing: Promise<string> | undefined;

  constructor(
    private readonly settings: GoogleSettings,
    private readonly store: RefreshTokenStore,
    options: { fetch?: typeof fetch; now?: () => number } = {}
  ) {
    this.fetchImpl = options.fetch ?? fetch;
    this.now = options.now ?? Date.now;
  }

  get account(): string {
    return this.settings.account;
  }

  private accessToken(): Promise<string> {
    if (this.token && this.token.until > this.now()) return Promise.resolve(this.token.value);
    this.refreshing ??= this.refresh().finally(() => {
      this.refreshing = undefined;
    });
    return this.refreshing;
  }

  private async refresh(): Promise<string> {
    const refreshToken = this.store.read();
    if (!refreshToken) throw new GoogleError('Er is geen aanmelding bij Google (meer). Verbind opnieuw met Google.');
    let response: Response;
    try {
      response = await this.fetchImpl(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams({
          client_id: this.settings.clientId,
          client_secret: this.settings.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }).toString(),
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new GoogleError(UNREACHABLE);
    }
    const json: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error = ErrorSchema.safeParse(json).data?.error;
      const hint =
        error === 'invalid_grant'
          ? ' De aanmelding is verlopen of ingetrokken. Staat je OAuth-toestemmingsscherm op "Testen", dan verloopt hij na 7 dagen: zet de publicatiestatus op "In productie".'
          : error === 'invalid_client'
            ? ' Client-ID of -geheim klopt niet meer.'
            : '';
      throw new GoogleError(`Google weigert de aanmelding (${response.status}).${hint} Verbind opnieuw met Google.`, response.status);
    }
    const parsed = TokenSchema.safeParse(json);
    if (!parsed.success) throw new GoogleError('Onverwacht antwoord van Google bij het aanmelden.');
    this.token = { value: parsed.data.access_token, until: this.now() + Math.max(0, parsed.data.expires_in - 60) * 1000 };
    return parsed.data.access_token;
  }

  /** Gets a fresh token without sending anything: proves the sign-in is still valid. */
  async check(): Promise<{ ok: true }> {
    await this.accessToken();
    return { ok: true };
  }

  async send(message: GoogleMailMessage): Promise<void> {
    const token = await this.accessToken();
    const raw = await new Promise<Buffer>((resolve, reject) => {
      new MailComposer({
        from: this.settings.account,
        to: message.to,
        subject: message.subject,
        text: message.text ?? '',
        html: message.html,
      })
        .compile()
        .build((err, buf) => (err ? reject(err) : resolve(buf)));
    });
    let response: Response;
    try {
      response = await this.fetchImpl(SEND_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ raw: raw.toString('base64url') }),
        signal: AbortSignal.timeout(60_000),
      });
    } catch {
      throw new GoogleError(UNREACHABLE);
    }
    if (!response.ok) {
      throw new GoogleError(gmailProblem(response.status, await response.json().catch(() => null)), response.status);
    }
  }
}

// ---- Signing in (authorization code + PKCE) ----

interface Pending {
  userId: string;
  verifier: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
  expiresAt: number;
}

export type GoogleSignInResult =
  | { state: 'done'; refreshToken: string; account: string; clientId: string; clientSecret: string }
  | { state: 'failed'; message: string };

/**
 * The sign-ins in progress. The browser comes back from Google without any login of ours, so the `state` value is
 * the proof: 256 random bits, made by a request of a signed-in admin, valid once and for ten minutes. The verifier
 * and the client secret stay in memory here and never reach a page or a URL.
 */
export class GoogleSignIn {
  private readonly pending = new Map<string, Pending>();
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;

  constructor(options: { fetch?: typeof fetch; now?: () => number } = {}) {
    this.fetchImpl = options.fetch ?? fetch;
    this.now = options.now ?? Date.now;
  }

  private sweep(): void {
    for (const [state, p] of this.pending) if (p.expiresAt <= this.now()) this.pending.delete(state);
  }

  start(userId: string, input: { clientId: string; clientSecret: string; redirectUri: string }): { url: string } {
    this.sweep();
    const mine = [...this.pending].filter(([, p]) => p.userId === userId);
    while (mine.length >= 3) {
      const oldest = mine.shift();
      if (oldest) this.pending.delete(oldest[0]);
    }
    const state = crypto.randomBytes(32).toString('base64url');
    const verifier = crypto.randomBytes(48).toString('base64url');
    this.pending.set(state, { userId, verifier, ...input, expiresAt: this.now() + 10 * 60_000 });
    const url = new URL(AUTH_URL);
    url.search = new URLSearchParams({
      client_id: input.clientId,
      redirect_uri: input.redirectUri,
      response_type: 'code',
      scope: SIGN_IN_SCOPE,
      access_type: 'offline',
      // Without this Google only returns a refresh token the first time an account ever consents.
      prompt: 'consent',
      state,
      code_challenge: crypto.createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
    }).toString();
    return { url: url.toString() };
  }

  /** The admin pressed cancel at Google: forget the attempt. */
  discard(state: string): void {
    this.pending.delete(state);
  }

  /** Called with what Google put in the return URL. The state is spent whatever the outcome. */
  async complete(state: string, code: string): Promise<GoogleSignInResult> {
    this.sweep();
    const p = this.pending.get(state);
    if (!p) return { state: 'failed', message: 'Deze aanmelding bestaat niet meer of is verlopen. Begin opnieuw.' };
    this.pending.delete(state);

    let response: Response;
    try {
      response = await this.fetchImpl(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams({
          client_id: p.clientId,
          client_secret: p.clientSecret,
          code,
          code_verifier: p.verifier,
          grant_type: 'authorization_code',
          redirect_uri: p.redirectUri,
        }).toString(),
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      return { state: 'failed', message: UNREACHABLE };
    }
    const json: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error = ErrorSchema.safeParse(json).data?.error;
      if (error === 'invalid_client') {
        return { state: 'failed', message: 'Google kent dit client-ID of -geheim niet. Controleer beide in je Google Cloud-project.' };
      }
      if (error === 'redirect_uri_mismatch') {
        return { state: 'failed', message: 'De omleidings-URL is niet toegevoegd aan je OAuth-client. Voeg de URL uit het scherm daar toe.' };
      }
      return { state: 'failed', message: `Google heeft de aanmelding niet afgerond (${response.status}). Begin opnieuw.` };
    }
    const parsed = TokenSchema.safeParse(json);
    if (!parsed.success || !parsed.data.refresh_token) {
      return {
        state: 'failed',
        message: 'Google gaf geen verversingstoken. Trek de toegang van VehicleVault in bij je Google-account (Beveiliging → Apps met toegang) en verbind opnieuw.',
      };
    }
    if (!(parsed.data.scope ?? '').split(' ').includes(SEND_SCOPE)) {
      return { state: 'failed', message: 'Verbonden, maar zonder het recht om mail te versturen. Verbind opnieuw en laat "E-mail versturen" aangevinkt.' };
    }
    const claims = claimsOf(parsed.data.id_token);
    const account = typeof claims.email === 'string' ? claims.email : '';
    if (!account || claims.email_verified === false) {
      return { state: 'failed', message: 'Google meldde niet met welk account je bent aangemeld. Probeer het opnieuw.' };
    }
    return { state: 'done', refreshToken: parsed.data.refresh_token, account, clientId: p.clientId, clientSecret: p.clientSecret };
  }
}
