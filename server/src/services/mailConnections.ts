import { db } from '../db/database.js';
import { seal, unseal } from '../utils/secretBox.js';
import { DEFAULT_CLIENT_ID, MicrosoftMailClient, type MicrosoftSettings } from './microsoftMailService.js';
import { GoogleMailClient, GoogleSignIn, type GoogleSettings } from './googleMailService.js';
import { MicrosoftSignIn } from './microsoftSignIn.js';

/**
 * What the admin has signed in with: Microsoft 365 (device code) and Google (authorization code). The sign-in
 * tokens and the Google client secret are stored sealed (see secretBox) and never returned to a page; only the
 * account name, the tenant and the client ID are shown.
 */

const KEY = {
  msTenant: 'mail_ms_tenant_id',
  msClient: 'mail_ms_client_id',
  msMailbox: 'mail_ms_mailbox',
  msRefresh: 'mail_ms_refresh_token',
  gClient: 'mail_google_client_id',
  gSecret: 'mail_google_client_secret',
  gAccount: 'mail_google_account',
  gRefresh: 'mail_google_refresh_token',
} as const;

const get = (key: string): string => {
  try {
    return db.get<{ value: string }>('SELECT value FROM system_settings WHERE key = ?', [key])?.value ?? '';
  } catch {
    return '';
  }
};
const put = (key: string, value: string): void => {
  db.run(
    `INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, value, new Date().toISOString()]
  );
};
const drop = (...keys: string[]): void => {
  for (const key of keys) db.run('DELETE FROM system_settings WHERE key = ?', [key]);
};

export class MailConnections {
  /** Replaceable in tests. */
  public static fetchImpl: typeof fetch | undefined;
  public static microsoftSignIn = new MicrosoftSignIn({ fetch: (...args) => (MailConnections.fetchImpl ?? fetch)(...args), now: () => Date.now() });
  public static googleSignIn = new GoogleSignIn({ fetch: (...args) => (MailConnections.fetchImpl ?? fetch)(...args), now: () => Date.now() });

  private static msClient: { key: string; client: MicrosoftMailClient } | undefined;
  private static googleClient: { key: string; client: GoogleMailClient } | undefined;

  // ---- Microsoft 365 ----

  public static microsoftSettings(): MicrosoftSettings | null {
    const tenantId = get(KEY.msTenant);
    const clientId = get(KEY.msClient);
    const mailbox = get(KEY.msMailbox);
    return tenantId && clientId && mailbox && unseal(get(KEY.msRefresh)) ? { tenantId, clientId, mailbox } : null;
  }

  public static microsoft(): MicrosoftMailClient | null {
    const s = this.microsoftSettings();
    if (!s) {
      this.msClient = undefined;
      return null;
    }
    const key = `${s.tenantId}|${s.clientId}|${s.mailbox}`;
    if (this.msClient?.key === key) return this.msClient.client;
    const client = new MicrosoftMailClient(
      s,
      { read: () => unseal(get(KEY.msRefresh)), write: (token) => put(KEY.msRefresh, seal(token)) },
      { fetch: (...args) => (this.fetchImpl ?? fetch)(...args) }
    );
    this.msClient = { key, client };
    return client;
  }

  public static saveMicrosoft(input: { tenantId: string; clientId: string; mailbox: string; refreshToken: string }): void {
    put(KEY.msTenant, input.tenantId);
    put(KEY.msClient, input.clientId);
    put(KEY.msMailbox, input.mailbox);
    put(KEY.msRefresh, seal(input.refreshToken));
    this.msClient = undefined;
  }

  public static clearMicrosoft(): void {
    drop(KEY.msTenant, KEY.msClient, KEY.msMailbox, KEY.msRefresh);
    this.msClient = undefined;
  }

  public static microsoftStatus() {
    const clientId = get(KEY.msClient);
    return {
      signedIn: this.microsoftSettings() !== null,
      mailbox: get(KEY.msMailbox) || undefined,
      tenantId: get(KEY.msTenant) || undefined,
      clientId: clientId || undefined,
      ownApp: Boolean(clientId) && clientId !== DEFAULT_CLIENT_ID,
    };
  }

  // ---- Google ----

  /** The OAuth client the admin entered; the secret is only ever read here and by the sign-in. */
  public static googleClientCredentials(): { clientId: string; clientSecret: string } | null {
    const clientId = get(KEY.gClient);
    const clientSecret = unseal(get(KEY.gSecret));
    return clientId && clientSecret ? { clientId, clientSecret } : null;
  }

  public static saveGoogleClient(input: { clientId: string; clientSecret?: string }): void {
    put(KEY.gClient, input.clientId);
    if (input.clientSecret) put(KEY.gSecret, seal(input.clientSecret));
    this.googleClient = undefined;
  }

  public static saveGoogleSignIn(input: { account: string; refreshToken: string; clientId: string; clientSecret: string }): void {
    this.saveGoogleClient({ clientId: input.clientId, clientSecret: input.clientSecret });
    put(KEY.gAccount, input.account);
    put(KEY.gRefresh, seal(input.refreshToken));
    this.googleClient = undefined;
  }

  /** Removes the sign-in; the client ID and secret stay so connecting again is one click. */
  public static clearGoogleSignIn(): void {
    drop(KEY.gAccount, KEY.gRefresh);
    this.googleClient = undefined;
  }

  public static googleSettings(): GoogleSettings | null {
    const creds = this.googleClientCredentials();
    const account = get(KEY.gAccount);
    return creds && account && unseal(get(KEY.gRefresh)) ? { ...creds, account } : null;
  }

  public static google(): GoogleMailClient | null {
    const s = this.googleSettings();
    if (!s) {
      this.googleClient = undefined;
      return null;
    }
    const key = `${s.clientId}|${s.account}|${s.clientSecret.length}`;
    if (this.googleClient?.key === key) return this.googleClient.client;
    const client = new GoogleMailClient(s, { read: () => unseal(get(KEY.gRefresh)) }, { fetch: (...args) => (this.fetchImpl ?? fetch)(...args) });
    this.googleClient = { key, client };
    return client;
  }

  public static googleStatus() {
    return {
      signedIn: this.googleSettings() !== null,
      account: get(KEY.gAccount) || undefined,
      clientId: get(KEY.gClient) || undefined,
      hasClientSecret: Boolean(this.googleClientCredentials()),
    };
  }
}
