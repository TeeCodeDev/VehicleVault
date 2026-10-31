import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { db } from '../db/database.js';
import { initializeDatabase } from '../db/schema.js';
import { seal, unseal } from '../utils/secretBox.js';
import { EmailService } from '../services/emailService.js';
import { MailConnections } from '../services/mailConnections.js';
import { MicrosoftSignIn } from '../services/microsoftSignIn.js';
import {
  DEFAULT_CLIENT_ID,
  MicrosoftError,
  MicrosoftMailClient,
  pollDeviceCode,
  requestDeviceCode,
} from '../services/microsoftMailService.js';
import { GoogleError, GoogleMailClient, GoogleSignIn } from '../services/googleMailService.js';
import { NotificationController } from '../controllers/notificationController.js';

const jwt = (claims: Record<string, unknown>) =>
  ['x', Buffer.from(JSON.stringify(claims)).toString('base64url'), 'sig'].join('.');

type Call = { url: string; init: RequestInit };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const form = (call: Call) => new URLSearchParams(String(call.init.body));

/** A fetch whose answers come from `handler`; every call is recorded. */
function fakeFetch(handler: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const impl = (async (url: any, init: RequestInit = {}) => {
    const call = { url: String(url), init };
    calls.push(call);
    return handler(call);
  }) as typeof fetch;
  return { calls, impl };
}

const MS_TOKEN = {
  access_token: jwt({ scp: 'Mail.Send User.Read openid profile email' }) + 'xxxxxxxx',
  refresh_token: 'refresh-token-from-microsoft-1',
  expires_in: 3600,
  id_token: jwt({ tid: '11111111-2222-3333-4444-555555555555', preferred_username: 'vault@contoso.com' }),
};
const DEVICE = { device_code: 'device-code-1234567890', user_code: 'ABCD-EFGH', verification_uri: 'https://microsoft.com/devicelogin', expires_in: 900, interval: 5 };

function call(handler: (req: any, res: any) => any, req: Record<string, any> = {}) {
  let status = 200;
  let payload: any;
  let location = '';
  const res: any = {
    status(code: number) {
      status = code;
      return res;
    },
    json(value: any) {
      payload = value;
      return res;
    },
    redirect(url: string) {
      status = 302;
      location = url;
      return res;
    },
  };
  const request = { body: {}, query: {}, protocol: 'https', get: () => 'vault.example.org', user: { userId: 'admin-1', role: 'admin' }, ...req };
  return Promise.resolve(handler(request, res)).then(() => ({ status, payload, location }));
}

describe('Mail sign-in (Microsoft 365 device code, Google)', () => {
  before(() => initializeDatabase());

  beforeEach(() => {
    MailConnections.clearMicrosoft();
    MailConnections.clearGoogleSignIn();
    db.run("DELETE FROM system_settings WHERE key LIKE 'mail_google_client%' OR key = 'mail_transport'");
    MailConnections.fetchImpl = undefined;
  });

  after(() => {
    MailConnections.clearMicrosoft();
    MailConnections.clearGoogleSignIn();
    db.run("DELETE FROM system_settings WHERE key LIKE 'mail_%'");
    MailConnections.fetchImpl = undefined;
  });

  describe('sealed tokens', () => {
    it('round-trips and never stores the plain text', () => {
      const sealed = seal('refresh-token-value');
      assert.ok(!sealed.includes('refresh-token-value'));
      assert.equal(unseal(sealed), 'refresh-token-value');
      assert.notEqual(seal('a'), seal('a'), 'a fresh IV each time');
    });

    it('refuses a value that was altered or is not ours', () => {
      const [p, iv, tag, data] = seal('secret').split('.');
      assert.equal(unseal([p, iv, tag, Buffer.from('tampered').toString('base64url')].join('.')), undefined);
      assert.equal(unseal(['v2', iv, tag, data].join('.')), undefined);
      assert.equal(unseal('plain text'), undefined);
      assert.equal(unseal(''), undefined);
      assert.equal(unseal(undefined), undefined);
    });
  });

  describe('Microsoft device code', () => {
    it('starts a sign-in and only trusts a Microsoft address for the code page', async () => {
      const ok = fakeFetch(() => json(200, DEVICE));
      const started = await requestDeviceCode('organizations', DEFAULT_CLIENT_ID, ok.impl);
      assert.equal(started.userCode, 'ABCD-EFGH');
      assert.equal(ok.calls[0].url, 'https://login.microsoftonline.com/organizations/oauth2/v2.0/devicecode');
      assert.equal(form(ok.calls[0]).get('client_id'), DEFAULT_CLIENT_ID);
      assert.match(form(ok.calls[0]).get('scope')!, /Mail\.Send/);
      assert.doesNotMatch(form(ok.calls[0]).get('scope')!, /Mail\.Read/);

      for (const evil of ['http://microsoft.com/devicelogin', 'https://evil.example/devicelogin', 'https://microsoft.com.evil.example/x', 'https://u:p@microsoft.com/x']) {
        const f = fakeFetch(() => json(200, { ...DEVICE, verification_uri: evil }));
        assert.equal((await requestDeviceCode('organizations', DEFAULT_CLIENT_ID, f.impl)).verificationUri, 'https://microsoft.com/devicelogin', evil);
      }
    });

    it('explains a refused start without echoing the response', async () => {
      const f = fakeFetch(() => json(400, { error: 'invalid_request', error_description: 'AADSTS70000 secret detail' }));
      await assert.rejects(requestDeviceCode('organizations', DEFAULT_CLIENT_ID, f.impl), (e: any) => e instanceof MicrosoftError && !e.message.includes('secret detail'));
    });

    it('polls: pending, slow down, declined, expired', async () => {
      const answer = (error: string) => fakeFetch(() => json(400, { error })).impl;
      assert.deepEqual(await pollDeviceCode('t', DEFAULT_CLIENT_ID, 'd', answer('authorization_pending')), { state: 'pending', slowDown: false });
      assert.deepEqual(await pollDeviceCode('t', DEFAULT_CLIENT_ID, 'd', answer('slow_down')), { state: 'pending', slowDown: true });
      assert.equal((await pollDeviceCode('t', DEFAULT_CLIENT_ID, 'd', answer('authorization_declined'))).state, 'failed');
      const expired: any = await pollDeviceCode('t', DEFAULT_CLIENT_ID, 'd', answer('expired_token'));
      assert.match(expired.message, /verlopen/);
    });

    it('finishes with the account, the tenant and the refresh token', async () => {
      const f = fakeFetch(() => json(200, MS_TOKEN));
      const done: any = await pollDeviceCode('organizations', DEFAULT_CLIENT_ID, 'device-code-1234567890', f.impl);
      assert.equal(done.state, 'done');
      assert.equal(done.mailbox, 'vault@contoso.com');
      assert.equal(done.tenantId, '11111111-2222-3333-4444-555555555555');
      assert.equal(done.refreshToken, MS_TOKEN.refresh_token);
      assert.equal(form(f.calls[0]).get('grant_type'), 'urn:ietf:params:oauth:grant-type:device_code');
    });

    it('fails when Mail.Send was not granted or the account is unknown', async () => {
      const noSend = fakeFetch(() => json(200, { ...MS_TOKEN, access_token: jwt({ scp: 'User.Read' }) + 'xxxxxxxx' }));
      const a: any = await pollDeviceCode('t', DEFAULT_CLIENT_ID, 'd', noSend.impl);
      assert.equal(a.state, 'failed');
      assert.match(a.message, /Mail\.Send/);

      const noAccount = fakeFetch(() => json(200, { ...MS_TOKEN, id_token: jwt({}) }));
      assert.equal(((await pollDeviceCode('t', DEFAULT_CLIENT_ID, 'd', noAccount.impl)) as any).state, 'failed');
    });
  });

  describe('Microsoft sign-in manager', () => {
    it('keeps the device code to itself and ties the sign-in to the admin who started it', async () => {
      const f = fakeFetch((c) => (c.url.endsWith('/devicecode') ? json(200, DEVICE) : json(400, { error: 'authorization_pending' })));
      let now = 1_000_000;
      const mgr = new MicrosoftSignIn({ fetch: f.impl, now: () => now });

      const started = await mgr.start('admin-1', { tenant: 'organizations', clientId: DEFAULT_CLIENT_ID });
      assert.ok(!JSON.stringify(started).includes('device-code-1234567890'), 'the page never gets the device code');

      assert.deepEqual(await mgr.poll('admin-2', started.id), { state: 'unknown' });
      const before = f.calls.length;
      assert.equal((await mgr.poll('admin-1', started.id)).state, 'pending');
      assert.equal(f.calls.length, before, 'asked too soon: Microsoft is not asked');

      now += 6000;
      assert.equal((await mgr.poll('admin-1', started.id)).state, 'pending');
      assert.equal(f.calls.length, before + 1);

      mgr.cancel('admin-2', started.id);
      assert.equal((await mgr.poll('admin-1', started.id)).state, 'pending', 'someone else cannot cancel it');
      mgr.cancel('admin-1', started.id);
      assert.deepEqual(await mgr.poll('admin-1', started.id), { state: 'unknown' });
    });

    it('limits the open sign-ins per admin and drops expired ones', async () => {
      const f = fakeFetch(() => json(200, DEVICE));
      let now = 1_000_000;
      const mgr = new MicrosoftSignIn({ fetch: f.impl, now: () => now });
      const a = await mgr.start('admin-1', { tenant: 't', clientId: DEFAULT_CLIENT_ID });
      await mgr.start('admin-1', { tenant: 't', clientId: DEFAULT_CLIENT_ID });
      await mgr.start('admin-1', { tenant: 't', clientId: DEFAULT_CLIENT_ID });
      assert.deepEqual(await mgr.poll('admin-1', a.id), { state: 'unknown' }, 'the oldest one was replaced');

      const b = await mgr.start('admin-1', { tenant: 't', clientId: DEFAULT_CLIENT_ID });
      now += 901_000;
      assert.deepEqual(await mgr.poll('admin-1', b.id), { state: 'unknown' });
    });
  });

  describe('Microsoft mail client', () => {
    const settings = { tenantId: '11111111-2222-3333-4444-555555555555', clientId: DEFAULT_CLIENT_ID, mailbox: 'vault@contoso.com' };
    const memoryStore = (initial?: string) => {
      let token = initial;
      return { read: () => token, write: (t: string) => void (token = t), get value() { return token; } };
    };

    it('refreshes, keeps the rotated refresh token, and sends as the signed-in account', async () => {
      const store = memoryStore('old-refresh-token-1234');
      const f = fakeFetch((c) => (c.url.includes('/token') ? json(200, { ...MS_TOKEN, refresh_token: 'new-refresh-token-5678' }) : new Response(null, { status: 202 })));
      const client = new MicrosoftMailClient(settings, store, { fetch: f.impl });

      await client.send({ to: ['a@example.com'], subject: 'Onderwerp', text: 'tekst', html: '<b>x</b>' });
      await client.send({ to: ['b@example.com'], subject: 's', text: 't' });

      assert.equal(store.value, 'new-refresh-token-5678');
      assert.equal(f.calls.filter((c) => c.url.includes('/token')).length, 1, 'the access token is reused');
      const send = f.calls.find((c) => c.url.endsWith('/v1.0/me/sendMail'))!;
      assert.match(String((send.init.headers as any).Authorization), /^Bearer /);
      const body = JSON.parse(String(send.init.body));
      assert.equal(body.message.body.contentType, 'HTML');
      assert.equal(body.saveToSentItems, true);
      assert.equal(form(f.calls[0]).get('grant_type'), 'refresh_token');
    });

    it('says to sign in again when the sign-in is gone, and never echoes tokens', async () => {
      await assert.rejects(new MicrosoftMailClient(settings, memoryStore(), { fetch: fakeFetch(() => json(200, {})).impl }).check(), /Meld opnieuw aan/);

      const gone = fakeFetch(() => json(400, { error: 'invalid_grant', error_description: 'AADSTS700082 refresh token secret' }));
      await assert.rejects(new MicrosoftMailClient(settings, memoryStore('old-refresh-token-1234'), { fetch: gone.impl }).check(), (e: any) => {
        assert.match(e.message, /verlopen of ingetrokken/);
        assert.ok(!e.message.includes('AADSTS700082'));
        return true;
      });
    });

    it('turns a refused send into a short explanation', async () => {
      const f = fakeFetch((c) => (c.url.includes('/token') ? json(200, MS_TOKEN) : json(403, { error: { code: 'ErrorAccessDenied', message: 'to: someone@example.com' } })));
      await assert.rejects(new MicrosoftMailClient(settings, memoryStore('old-refresh-token-1234'), { fetch: f.impl }).send({ to: ['a@example.com'], subject: 's', text: 't' }), (e: any) => {
        assert.match(e.message, /Mail\.Send/);
        assert.ok(!e.message.includes('someone@example.com'));
        return true;
      });
    });
  });

  describe('Microsoft 365 through the mail service', () => {
    it('stores the sign-in sealed and never shows the token', () => {
      MailConnections.saveMicrosoft({ tenantId: '11111111-2222-3333-4444-555555555555', clientId: DEFAULT_CLIENT_ID, mailbox: 'vault@contoso.com', refreshToken: 'refresh-token-from-microsoft-1' });
      const raw = db.get<{ value: string }>("SELECT value FROM system_settings WHERE key = 'mail_ms_refresh_token'")!.value;
      assert.ok(!raw.includes('refresh-token-from-microsoft-1'));
      const status = MailConnections.microsoftStatus();
      assert.equal(status.signedIn, true);
      assert.equal(status.mailbox, 'vault@contoso.com');
      assert.equal(status.ownApp, false);
      assert.ok(!JSON.stringify(status).includes('refresh-token'));

      MailConnections.clearMicrosoft();
      assert.equal(MailConnections.microsoftStatus().signedIn, false);
      assert.equal(MailConnections.microsoft(), null);
    });

    it('sends, verifies and picks the mailbox as default recipient', async () => {
      MailConnections.saveMicrosoft({ tenantId: '11111111-2222-3333-4444-555555555555', clientId: DEFAULT_CLIENT_ID, mailbox: 'vault@contoso.com', refreshToken: 'refresh-token-from-microsoft-1' });
      EmailService.saveMailConfig({ transport: 'microsoft' });
      db.run("DELETE FROM system_settings WHERE key = 'smtp_to'");
      const prev = process.env.SMTP_TO;
      delete process.env.SMTP_TO;
      const f = fakeFetch((c) => (c.url.includes('/token') ? json(200, MS_TOKEN) : new Response(null, { status: 202 })));
      MailConnections.fetchImpl = f.impl;
      try {
        assert.equal(EmailService.isConfigured(), true);
        const verified = await EmailService.verifyConnection();
        assert.equal(verified.success, true, verified.message);
        assert.match(verified.message, /vault@contoso\.com/);

        const sent = await EmailService.sendTestEmail();
        assert.equal(sent.success, true, sent.message);
        const body = JSON.parse(String(f.calls.find((c) => c.url.endsWith('/sendMail'))!.init.body));
        assert.equal(body.message.toRecipients[0].emailAddress.address, 'vault@contoso.com');
      } finally {
        if (prev !== undefined) process.env.SMTP_TO = prev;
      }
    });

    it('is not configured, and says so, when nobody has signed in', async () => {
      EmailService.saveMailConfig({ transport: 'microsoft' });
      assert.equal(EmailService.isConfigured(), false);
      const res = await EmailService.sendMail({ to: 'a@example.com', subject: 's', text: 't' });
      assert.equal(res.success, false);
      assert.match(res.message, /Microsoft 365 is niet ingesteld/);
    });

    it('serves the sign-in through the API', async () => {
      const f = fakeFetch((c) => (c.url.endsWith('/devicecode') ? json(200, DEVICE) : json(200, MS_TOKEN)));
      MailConnections.fetchImpl = f.impl;

      const bad = await call((req, res) => NotificationController.microsoftSignInStart(req, res), { body: { tenantId: '../x' } });
      assert.equal(bad.status, 400);
      const badClient = await call((req, res) => NotificationController.microsoftSignInStart(req, res), { body: { clientId: 'nope' } });
      assert.equal(badClient.status, 400);

      const start = await call((req, res) => NotificationController.microsoftSignInStart(req, res));
      assert.equal(start.payload.userCode, 'ABCD-EFGH');
      assert.ok(!JSON.stringify(start.payload).includes('device-code-1234567890'));

      // Not the admin who started it: the id is unknown.
      const other = await call((req, res) => NotificationController.microsoftSignInStatus(req, res), { body: { id: start.payload.id }, user: { userId: 'admin-2', role: 'admin' } });
      assert.equal(other.payload.state, 'failed');

      // Enough time has passed for the poll to ask Microsoft.
      const real = Date.now;
      Date.now = () => real() + 10_000;
      try {
        const done = await call((req, res) => NotificationController.microsoftSignInStatus(req, res), { body: { id: start.payload.id } });
        assert.equal(done.payload.state, 'done');
        assert.equal(done.payload.mailbox, 'vault@contoso.com');
      } finally {
        Date.now = real;
      }
      assert.equal(MailConnections.microsoftStatus().signedIn, true);
      assert.equal(EmailService.getTransport(), 'microsoft');

      const removed = await call((req, res) => NotificationController.microsoftRemove(req, res));
      assert.equal(removed.payload.success, true);
      assert.equal(MailConnections.microsoftStatus().signedIn, false);
    });
  });

  describe('Google sign-in', () => {
    const CLIENT = { clientId: '123456789012-abcdefghijklmnop.apps.googleusercontent.com', clientSecret: 'GOCSPX-abcdefghijklmnopqrstu', redirectUri: 'https://vault.example.org/api/notifications/mail/google/callback' };
    const GOOGLE_TOKEN = {
      access_token: 'google-access-token-12345',
      refresh_token: 'google-refresh-token-12345',
      expires_in: 3599,
      scope: 'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/gmail.send',
      id_token: jwt({ email: 'beheer@gmail.com', email_verified: true }),
    };
    const stateOf = (url: string) => new URL(url).searchParams.get('state')!;

    it('builds an authorization URL with PKCE, offline access and only the send permission', () => {
      const url = new URL(new GoogleSignIn().start('admin-1', CLIENT).url);
      assert.equal(url.origin + url.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
      assert.equal(url.searchParams.get('response_type'), 'code');
      assert.equal(url.searchParams.get('access_type'), 'offline');
      assert.equal(url.searchParams.get('prompt'), 'consent');
      assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
      assert.equal(url.searchParams.get('redirect_uri'), CLIENT.redirectUri);
      assert.ok(url.searchParams.get('scope')!.includes('https://www.googleapis.com/auth/gmail.send'));
      assert.ok(!url.searchParams.get('scope')!.includes('gmail.readonly'));
      assert.ok(!url.toString().includes(CLIENT.clientSecret), 'the secret is never in the URL');
      assert.ok(stateOf(url.toString()).length >= 40);
    });

    it('exchanges the code with the matching verifier, once', async () => {
      const f = fakeFetch(() => json(200, GOOGLE_TOKEN));
      const mgr = new GoogleSignIn({ fetch: f.impl });
      const url = mgr.start('admin-1', CLIENT).url;
      const state = stateOf(url);

      const done: any = await mgr.complete(state, 'auth-code-xyz');
      assert.equal(done.state, 'done');
      assert.equal(done.account, 'beheer@gmail.com');
      assert.equal(done.refreshToken, GOOGLE_TOKEN.refresh_token);

      const body = form(f.calls[0]);
      assert.equal(body.get('grant_type'), 'authorization_code');
      assert.equal(body.get('code'), 'auth-code-xyz');
      assert.equal(body.get('redirect_uri'), CLIENT.redirectUri);
      const challenge = new URL(url).searchParams.get('code_challenge');
      assert.equal(crypto.createHash('sha256').update(body.get('code_verifier')!).digest('base64url'), challenge);

      // The state is spent: replaying the return URL does nothing.
      assert.equal(((await mgr.complete(state, 'auth-code-xyz')) as any).state, 'failed');
      assert.equal(f.calls.length, 1);
    });

    it('rejects an unknown or expired state without calling Google', async () => {
      const f = fakeFetch(() => json(200, GOOGLE_TOKEN));
      let now = 1_000_000;
      const mgr = new GoogleSignIn({ fetch: f.impl, now: () => now });
      assert.equal(((await mgr.complete('forged-state', 'code')) as any).state, 'failed');
      const state = stateOf(mgr.start('admin-1', CLIENT).url);
      now += 11 * 60_000;
      assert.equal(((await mgr.complete(state, 'code')) as any).state, 'failed');
      assert.equal(f.calls.length, 0);
    });

    it('explains the failures that happen in practice', async () => {
      const run = async (response: Response) => {
        const mgr = new GoogleSignIn({ fetch: fakeFetch(() => response).impl });
        return (await mgr.complete(stateOf(mgr.start('admin-1', CLIENT).url), 'code')) as any;
      };
      assert.match((await run(json(401, { error: 'invalid_client' }))).message, /client-ID of -geheim/);
      assert.match((await run(json(400, { error: 'redirect_uri_mismatch' }))).message, /omleidings-URL/);
      assert.match((await run(json(200, { ...GOOGLE_TOKEN, refresh_token: undefined }))).message, /verversingstoken/);
      assert.match((await run(json(200, { ...GOOGLE_TOKEN, scope: 'openid email' }))).message, /E-mail versturen/);
      assert.equal((await run(json(200, { ...GOOGLE_TOKEN, id_token: jwt({}) }))).state, 'failed');
    });

    it('limits the open attempts per admin', async () => {
      const f = fakeFetch(() => json(200, GOOGLE_TOKEN));
      const mgr = new GoogleSignIn({ fetch: f.impl });
      const first = stateOf(mgr.start('admin-1', CLIENT).url);
      for (let i = 0; i < 3; i++) mgr.start('admin-1', CLIENT);
      assert.equal(((await mgr.complete(first, 'code')) as any).state, 'failed');
    });
  });

  describe('Gmail mail client', () => {
    const settings = { clientId: '123456789012-abcdefghijklmnop.apps.googleusercontent.com', clientSecret: 'GOCSPX-abcdefghijklmnopqrstu', account: 'beheer@gmail.com' };
    const store = { read: () => 'google-refresh-token-12345' };
    const ok = { access_token: 'google-access-token-12345', expires_in: 3599 };

    it('sends a MIME message as the signed-in account through the Gmail API', async () => {
      const f = fakeFetch((c) => (c.url.includes('/token') ? json(200, ok) : json(200, { id: 'm1' })));
      const client = new GoogleMailClient(settings, store, { fetch: f.impl });
      await client.send({ to: ['a@example.com', 'b@example.com'], subject: 'Onderwerp ✓', text: 'tekst', html: '<b>x</b>' });

      assert.equal(form(f.calls[0]).get('grant_type'), 'refresh_token');
      assert.equal(form(f.calls[0]).get('client_secret'), settings.clientSecret);
      const send = f.calls[1];
      assert.equal(send.url, 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
      assert.equal((send.init.headers as any).Authorization, 'Bearer google-access-token-12345');
      const mime = Buffer.from(JSON.parse(String(send.init.body)).raw, 'base64url').toString('utf8');
      assert.match(mime, /^From: .*beheer@gmail\.com/m);
      assert.match(mime, /^To: .*a@example\.com.*b@example\.com/m);
      assert.match(mime, /^Subject: /m);
      assert.match(mime, /text\/html/);
    });

    it('explains an expired sign-in, a disabled Gmail API and a missing permission', async () => {
      const expired = fakeFetch(() => json(400, { error: 'invalid_grant' }));
      await assert.rejects(new GoogleMailClient(settings, store, { fetch: expired.impl }).check(), (e: any) => e instanceof GoogleError && /7 dagen/.test(e.message));

      const send = (status: number, body: unknown) =>
        new GoogleMailClient(settings, store, { fetch: fakeFetch((c) => (c.url.includes('/token') ? json(200, ok) : json(status, body))).impl }).send({ to: ['a@example.com'], subject: 's', text: 't' });
      await assert.rejects(send(403, { error: { status: 'PERMISSION_DENIED', message: 'Gmail API has not been used in project 1 before or it is disabled', errors: [{ reason: 'accessNotConfigured' }] } }), /Gmail API staat niet aan/);
      await assert.rejects(send(403, { error: { status: 'PERMISSION_DENIED', errors: [{ reason: 'insufficientPermissions' }] } }), /gmail\.send/);
      await assert.rejects(send(429, {}), /beperkt/);
    });

    it('says to connect when there is no sign-in', async () => {
      await assert.rejects(new GoogleMailClient(settings, { read: () => undefined }, { fetch: fakeFetch(() => json(200, ok)).impl }).check(), /Verbind opnieuw/);
    });
  });

  describe('Gmail through the API and the mail service', () => {
    const CLIENT_ID = '123456789012-abcdefghijklmnop.apps.googleusercontent.com';
    const SECRET = 'GOCSPX-abcdefghijklmnopqrstu';

    it('validates and stores the OAuth client, and never returns the secret', async () => {
      const bad = await call((req, res) => NotificationController.updateMail(req, res), { body: { google: { clientId: 'not-a-client', clientSecret: SECRET } } });
      assert.equal(bad.status, 400);
      const badSecret = await call((req, res) => NotificationController.updateMail(req, res), { body: { google: { clientId: CLIENT_ID, clientSecret: 'x y!' } } });
      assert.equal(badSecret.status, 400);

      const saved = await call((req, res) => NotificationController.updateMail(req, res), { body: { google: { clientId: CLIENT_ID, clientSecret: SECRET } } });
      assert.equal(saved.status, 200);
      await call((req, res) => NotificationController.updateMail(req, res), { body: { google: { clientId: CLIENT_ID, clientSecret: '••••••••' } } });
      assert.equal(MailConnections.googleClientCredentials()?.clientSecret, SECRET, 'the mask keeps the stored secret');

      const raw = db.get<{ value: string }>("SELECT value FROM system_settings WHERE key = 'mail_google_client_secret'")!.value;
      assert.ok(!raw.includes(SECRET));
      const shown = await call((req, res) => NotificationController.getMail(req, res));
      assert.ok(!JSON.stringify(shown.payload).includes(SECRET));
      assert.equal(shown.payload.google.hasClientSecret, true);
      assert.equal(shown.payload.google.redirectUri, 'https://vault.example.org/api/notifications/mail/google/callback');
    });

    it('refuses to start without a client, then runs the whole round trip', async () => {
      const without = await call((req, res) => NotificationController.googleStart(req, res));
      assert.equal(without.status, 400);

      MailConnections.saveGoogleClient({ clientId: CLIENT_ID, clientSecret: SECRET });
      const f = fakeFetch((c) =>
        c.url.includes('/token')
          ? json(200, {
              access_token: 'google-access-token-12345',
              refresh_token: 'google-refresh-token-12345',
              expires_in: 3599,
              scope: 'openid email https://www.googleapis.com/auth/gmail.send',
              id_token: jwt({ email: 'beheer@gmail.com', email_verified: true }),
            })
          : json(200, { id: 'm1' })
      );
      MailConnections.fetchImpl = f.impl;

      const started = await call((req, res) => NotificationController.googleStart(req, res));
      const state = new URL(started.payload.url).searchParams.get('state')!;

      // Google sends the browser back: no login, only the state.
      const back = await call((req, res) => NotificationController.googleCallback(req, res), { query: { state, code: 'auth-code' }, user: undefined });
      assert.equal(back.status, 302);
      assert.equal(back.location, '/settings?tab=notifications&mail=google');
      assert.equal(MailConnections.googleStatus().account, 'beheer@gmail.com');
      assert.equal(EmailService.getTransport(), 'gmail');

      const raw = db.get<{ value: string }>("SELECT value FROM system_settings WHERE key = 'mail_google_refresh_token'")!.value;
      assert.ok(!raw.includes('google-refresh-token-12345'));

      // The page shows the outcome once.
      const shown = await call((req, res) => NotificationController.getMail(req, res));
      assert.equal(shown.payload.google.lastResult.ok, true);
      assert.match(shown.payload.google.lastResult.message, /beheer@gmail\.com/);
      assert.equal((await call((req, res) => NotificationController.getMail(req, res))).payload.google.lastResult, undefined);
      assert.ok(!JSON.stringify(shown.payload).includes('google-refresh-token-12345'));

      // And mail goes out through Gmail.
      const verified = await EmailService.verifyConnection();
      assert.equal(verified.success, true, verified.message);
      const sent = await EmailService.sendMail({ to: 'a@example.com', subject: 's', text: 't' });
      assert.equal(sent.success, true, sent.message);
      assert.match(sent.message, /Gmail \(beheer@gmail\.com\)/);

      const removed = await call((req, res) => NotificationController.googleRemove(req, res));
      assert.equal(removed.payload.success, true);
      assert.equal(MailConnections.googleStatus().signedIn, false);
      assert.equal(MailConnections.googleStatus().hasClientSecret, true, 'the client stays, so connecting again is one click');
    });

    it('survives a forged or replayed return URL and a cancel at Google', async () => {
      MailConnections.saveGoogleClient({ clientId: CLIENT_ID, clientSecret: SECRET });
      MailConnections.fetchImpl = fakeFetch(() => json(500, {})).impl;

      const forged = await call((req, res) => NotificationController.googleCallback(req, res), { query: { state: 'forged', code: 'c' }, user: undefined });
      assert.equal(forged.status, 302);
      assert.equal(MailConnections.googleStatus().signedIn, false);
      const shown = await call((req, res) => NotificationController.getMail(req, res));
      assert.equal(shown.payload.google.lastResult.ok, false);

      const started = await call((req, res) => NotificationController.googleStart(req, res));
      const state = new URL(started.payload.url).searchParams.get('state')!;
      const cancelled = await call((req, res) => NotificationController.googleCallback(req, res), { query: { state, error: 'access_denied' }, user: undefined });
      assert.equal(cancelled.status, 302);
      // The attempt was dropped: the state cannot be used afterwards.
      const replay = await call((req, res) => NotificationController.googleCallback(req, res), { query: { state, code: 'c' }, user: undefined });
      assert.equal(replay.status, 302);
      assert.equal(MailConnections.googleStatus().signedIn, false);
    });

    it('uses PUBLIC_URL for the redirect URL when it is set', async () => {
      process.env.PUBLIC_URL = 'https://vehiclevault.example.nl/';
      try {
        const shown = await call((req, res) => NotificationController.getMail(req, res));
        assert.equal(shown.payload.google.redirectUri, 'https://vehiclevault.example.nl/api/notifications/mail/google/callback');
        process.env.PUBLIC_URL = 'javascript:alert(1)';
        assert.match((await call((req, res) => NotificationController.getMail(req, res))).payload.google.redirectUri, /^https:\/\/vault\.example\.org\//);
      } finally {
        delete process.env.PUBLIC_URL;
      }
    });
  });
});
