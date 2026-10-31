import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { db } from '../db/database.js';
import { initializeDatabase } from '../db/schema.js';
import { EmailService } from '../services/emailService.js';
import { GraphMailService, type GraphConfig } from '../services/graphMailService.js';
import { describeGraphError, describeSmtpError } from '../services/mailErrors.js';
import { NotificationController } from '../controllers/notificationController.js';

const GRAPH: GraphConfig = {
  tenantId: '11111111-2222-3333-4444-555555555555',
  clientId: '66666666-7777-8888-9999-000000000000',
  clientSecret: 'super-secret-value',
  sender: 'vault@contoso.com',
};

type FetchCall = { url: string; init: RequestInit };

/** Replace global fetch for one test; `handler` answers per call. */
function mockFetch(handler: (call: FetchCall) => { status: number; body?: unknown }) {
  const original = globalThis.fetch;
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (url: any, init: RequestInit = {}) => {
    const call = { url: String(url), init };
    calls.push(call);
    const { status, body } = handler(call);
    const text = typeof body === 'string' ? body : JSON.stringify(body ?? {});
    return new Response(status === 202 ? null : text, { status });
  }) as typeof fetch;
  return { calls, restore: () => (globalThis.fetch = original) };
}

const tokenOk = { status: 200, body: { access_token: 'tok-123', expires_in: 3600 } };

function call(handler: (req: any, res: any) => any, body: any = {}) {
  let status = 200;
  let payload: any;
  const res: any = {
    status(code: number) {
      status = code;
      return res;
    },
    json(value: any) {
      payload = value;
      return res;
    },
  };
  const result = handler({ body } as any, res);
  return Promise.resolve(result).then(() => ({ status, payload }));
}

describe('Mail configuration', () => {
  before(() => initializeDatabase());

  beforeEach(() => {
    db.run("DELETE FROM system_settings WHERE key LIKE 'graph_%' OR key IN ('mail_transport','smtp_ignore_tls_errors','smtp_require_tls')");
    GraphMailService.resetTokenCache();
  });

  after(() => {
    db.run("DELETE FROM system_settings WHERE key LIKE 'graph_%' OR key LIKE 'smtp_%' OR key IN ('mail_transport')");
  });

  describe('SMTP error messages', () => {
    it('explains Gmail authentication failures with the app password', () => {
      const f = describeSmtpError({ code: 'EAUTH', message: 'Invalid login: 535-5.7.8 Username and Password not accepted' }, 'smtp.gmail.com');
      assert.match(f.hint!, /app-wachtwoord/i);
    });

    it('recognises Microsoft 365 with SMTP AUTH switched off and points at Graph', () => {
      const f = describeSmtpError(
        { code: 'EAUTH', message: 'Invalid login: 535 5.7.139 Authentication unsuccessful, SmtpClientAuthentication is disabled for the Tenant' },
        'smtp.office365.com'
      );
      assert.match(f.hint!, /SMTP AUTH/);
      assert.match(f.hint!, /Graph/);
    });

    it('explains a TLS mode that does not match the port', () => {
      const f = describeSmtpError({ code: 'ESOCKET', message: 'error:0A00010B:SSL routines:ssl3_get_record:wrong version number' }, 'mail.example.org');
      assert.match(f.hint!, /465/);
      assert.match(f.hint!, /587/);
    });

    it('explains unreachable servers, unknown hosts and untrusted certificates', () => {
      assert.match(describeSmtpError({ code: 'ETIMEDOUT', message: 'Connection timeout' }).hint!, /firewall/i);
      assert.match(describeSmtpError({ code: 'ENOTFOUND', message: 'getaddrinfo ENOTFOUND x' }).hint!, /servernaam/i);
      assert.match(describeSmtpError({ code: 'ESOCKET', message: 'self-signed certificate' }).hint!, /certificaat/i);
    });

    it('keeps the raw message and adds no hint for unknown errors', () => {
      const f = describeSmtpError({ message: 'weird' });
      assert.equal(f.message, 'weird');
      assert.equal(f.hint, undefined);
    });
  });

  describe('Graph error messages', () => {
    it('maps the usual Entra ID and Graph failures to a fix', () => {
      assert.match(
        describeGraphError(401, JSON.stringify({ error: 'invalid_client', error_description: 'AADSTS7000215: Invalid client secret provided.' })).hint!,
        /secret/i
      );
      assert.match(
        describeGraphError(400, JSON.stringify({ error: 'unauthorized_client', error_description: 'AADSTS700016: Application with identifier x was not found' })).hint!,
        /Client ID/
      );
      assert.match(describeGraphError(403, JSON.stringify({ error: { code: 'ErrorAccessDenied', message: 'Access is denied.' } })).hint!, /Mail\.Send/);
      assert.match(describeGraphError(404, JSON.stringify({ error: { code: 'ErrorInvalidUser', message: 'user not found' } })).hint!, /mailbox/i);
    });
  });

  describe('Graph configuration', () => {
    it('validates the values before they end up in a URL', () => {
      assert.equal(GraphMailService.validate(GRAPH), null);
      assert.equal(GraphMailService.validate({ ...GRAPH, tenantId: 'contoso.onmicrosoft.com' }), null);
      assert.ok(GraphMailService.validate({ ...GRAPH, tenantId: '../evil?x=' }));
      assert.ok(GraphMailService.validate({ ...GRAPH, tenantId: 'tenant/with/slash' }));
      assert.ok(GraphMailService.validate({ ...GRAPH, clientId: 'not-a-guid' }));
      assert.ok(GraphMailService.validate({ ...GRAPH, sender: 'no-address' }));
      assert.ok(GraphMailService.validate({ ...GRAPH, clientSecret: '' }));
    });

    it('keeps the stored secret when the browser sends the mask or nothing', () => {
      EmailService.saveMailConfig({ transport: 'graph', graphTenantId: GRAPH.tenantId, graphClientId: GRAPH.clientId, graphClientSecret: GRAPH.clientSecret, graphSender: GRAPH.sender });
      EmailService.saveMailConfig({ graphClientSecret: '••••••••' });
      EmailService.saveMailConfig({ graphClientSecret: '' });
      assert.equal(EmailService.getGraphConfig().clientSecret, GRAPH.clientSecret);
      EmailService.saveMailConfig({ graphClientSecret: 'new-secret' });
      assert.equal(EmailService.getGraphConfig().clientSecret, 'new-secret');
    });

    it('switches isConfigured() with the selected transport', () => {
      EmailService.saveSmtpConfig({ host: 'smtp.example.com', user: 'vault@example.com' });
      EmailService.saveMailConfig({ transport: 'smtp' });
      assert.equal(EmailService.isConfigured(), true);

      EmailService.saveMailConfig({ transport: 'graph' });
      assert.equal(EmailService.isConfigured(), false, 'Graph is not filled in yet');

      EmailService.saveMailConfig({ graphTenantId: GRAPH.tenantId, graphClientId: GRAPH.clientId, graphClientSecret: GRAPH.clientSecret, graphSender: GRAPH.sender });
      assert.equal(EmailService.isConfigured(), true);
    });

    it('never returns a secret through the API', async () => {
      EmailService.saveSmtpConfig({ host: 'smtp.example.com', user: 'u', pass: 'smtp-secret' });
      EmailService.saveMailConfig({ transport: 'graph', graphClientSecret: GRAPH.clientSecret });
      const { payload } = await call((req, res) => NotificationController.getMail(req, res));
      const serialised = JSON.stringify(payload);
      assert.ok(!serialised.includes('smtp-secret'));
      assert.ok(!serialised.includes(GRAPH.clientSecret));
      assert.equal(payload.smtp.pass, '••••••••');
      assert.equal(payload.graph.clientSecret, '••••••••');
    });

    it('rejects an unknown transport and a bad port', async () => {
      assert.equal((await call((req, res) => NotificationController.updateMail(req, res), { transport: 'pigeon' })).status, 400);
      assert.equal((await call((req, res) => NotificationController.updateMail(req, res), { smtp: { port: 99999 } })).status, 400);
      assert.equal((await call((req, res) => NotificationController.updateMail(req, res), { smtp: { port: 'abc' } })).status, 400);
    });

    it('stores the TLS options and uses them', async () => {
      await call((req, res) => NotificationController.updateMail(req, res), {
        smtp: { host: 'smtp.example.com', port: 587, secure: false, ignoreTlsErrors: true, requireTls: true },
      });
      const cfg = EmailService.getSmtpConfig();
      assert.equal(cfg.ignoreTlsErrors, true);
      assert.equal(cfg.requireTls, true);
      const transporter: any = EmailService.getTransporter();
      assert.equal(transporter.options.tls.rejectUnauthorized, false);
      assert.equal(transporter.options.requireTLS, true);
    });
  });

  describe('Sending through Microsoft Graph', () => {
    beforeEach(() => {
      EmailService.saveMailConfig({ transport: 'graph', graphTenantId: GRAPH.tenantId, graphClientId: GRAPH.clientId, graphClientSecret: GRAPH.clientSecret, graphSender: GRAPH.sender });
    });

    it('fetches a token, then posts the message to the sender mailbox', async () => {
      const mock = mockFetch(({ url }) => (url.includes('/oauth2/v2.0/token') ? tokenOk : { status: 202 }));
      try {
        const res = await EmailService.sendMail({ to: 'a@example.com, b@example.com', subject: 'Onderwerp', text: 'x', html: '<b>x</b>' });
        assert.equal(res.success, true, res.message);

        assert.equal(mock.calls.length, 2);
        const [tokenCall, sendCall] = mock.calls;
        assert.equal(tokenCall.url, `https://login.microsoftonline.com/${GRAPH.tenantId}/oauth2/v2.0/token`);
        const form = new URLSearchParams(String(tokenCall.init.body));
        assert.equal(form.get('grant_type'), 'client_credentials');
        assert.equal(form.get('scope'), 'https://graph.microsoft.com/.default');
        assert.equal(form.get('client_secret'), GRAPH.clientSecret);

        assert.equal(sendCall.url, 'https://graph.microsoft.com/v1.0/users/vault%40contoso.com/sendMail');
        assert.equal((sendCall.init.headers as any).Authorization, 'Bearer tok-123');
        const body = JSON.parse(String(sendCall.init.body));
        assert.equal(body.message.subject, 'Onderwerp');
        assert.equal(body.message.body.contentType, 'HTML');
        assert.deepEqual(body.message.toRecipients.map((r: any) => r.emailAddress.address), ['a@example.com', 'b@example.com']);
        assert.equal(body.saveToSentItems, false);
      } finally {
        mock.restore();
      }
    });

    it('reuses the token for the next message', async () => {
      const mock = mockFetch(({ url }) => (url.includes('/oauth2/v2.0/token') ? tokenOk : { status: 202 }));
      try {
        await EmailService.sendMail({ to: 'a@example.com', subject: 's', text: 't' });
        await EmailService.sendMail({ to: 'a@example.com', subject: 's', text: 't' });
        assert.equal(mock.calls.filter((c) => c.url.includes('/token')).length, 1);
      } finally {
        mock.restore();
      }
    });

    it('turns a refused send into a message with the fix', async () => {
      const mock = mockFetch(({ url }) =>
        url.includes('/oauth2/v2.0/token') ? tokenOk : { status: 403, body: { error: { code: 'ErrorAccessDenied', message: 'Access is denied.' } } }
      );
      try {
        const res = await EmailService.sendMail({ to: 'a@example.com', subject: 's', text: 't' });
        assert.equal(res.success, false);
        assert.match(res.message, /Mail\.Send/);
      } finally {
        mock.restore();
      }
    });

    it('reports a wrong client secret when verifying, without sending anything', async () => {
      const mock = mockFetch(() => ({
        status: 401,
        body: { error: 'invalid_client', error_description: 'AADSTS7000215: Invalid client secret provided.' },
      }));
      try {
        const res = await EmailService.verifyConnection();
        assert.equal(res.success, false);
        assert.match(res.message, /secret/i);
        assert.equal(mock.calls.length, 1);
      } finally {
        mock.restore();
      }
    });

    it('does not call Microsoft when the configuration is invalid', async () => {
      EmailService.saveMailConfig({ graphClientId: 'nope' });
      const mock = mockFetch(() => tokenOk);
      try {
        const res = await EmailService.sendMail({ to: 'a@example.com', subject: 's', text: 't' });
        assert.equal(res.success, false);
        assert.match(res.message, /Client ID/);
        assert.equal(mock.calls.length, 0);
      } finally {
        mock.restore();
      }
    });

    it('sends the test mail to the sender mailbox when no recipient is set', async () => {
      db.run("DELETE FROM system_settings WHERE key = 'smtp_to'");
      const prev = process.env.SMTP_TO;
      delete process.env.SMTP_TO;
      const mock = mockFetch(({ url }) => (url.includes('/oauth2/v2.0/token') ? tokenOk : { status: 202 }));
      try {
        const res = await EmailService.sendTestEmail();
        assert.equal(res.success, true, res.message);
        const body = JSON.parse(String(mock.calls[1].init.body));
        assert.equal(body.message.toRecipients[0].emailAddress.address, GRAPH.sender);
      } finally {
        mock.restore();
        if (prev !== undefined) process.env.SMTP_TO = prev;
      }
    });
  });

  describe('HTML in notification mails', () => {
    it('escapes titles and messages, so a vehicle name cannot inject markup', async () => {
      EmailService.saveMailConfig({ transport: 'graph', graphTenantId: GRAPH.tenantId, graphClientId: GRAPH.clientId, graphClientSecret: GRAPH.clientSecret, graphSender: GRAPH.sender });
      const mock = mockFetch(({ url }) => (url.includes('/oauth2/v2.0/token') ? tokenOk : { status: 202 }));
      try {
        await EmailService.sendNotificationEmail('<img src=x onerror=alert(1)>', '<script>alert(2)</script> & "quotes"', 'high', 'a@example.com');
        const body = JSON.parse(String(mock.calls[1].init.body));
        const html: string = body.message.body.content;
        assert.ok(!html.includes('<img src=x'));
        assert.ok(!html.includes('<script>'));
        assert.ok(html.includes('&lt;script&gt;alert(2)&lt;/script&gt; &amp; &quot;quotes&quot;'));
      } finally {
        mock.restore();
      }
    });
  });
});
