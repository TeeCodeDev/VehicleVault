import { Request, Response } from 'express';
import { NotificationService } from '../services/notificationService.js';
import { EmailService } from '../services/emailService.js';
import { PushService } from '../services/pushService.js';
import { MailConnections } from '../services/mailConnections.js';
import {
  ANY_ORGANIZATION,
  CLIENT_ID_PATTERN,
  DEFAULT_CLIENT_ID,
  MicrosoftError,
  TENANT_PATTERN,
} from '../services/microsoftMailService.js';
import { GOOGLE_CLIENT_ID_PATTERN, GOOGLE_CLIENT_SECRET_PATTERN } from '../services/googleMailService.js';

const GOOGLE_CALLBACK_PATH = '/api/notifications/mail/google/callback';

/** Where Google sends the browser back to. PUBLIC_URL wins (behind a proxy the Host header may be internal). */
function publicBase(req: Request): string {
  const configured = process.env.PUBLIC_URL?.trim().replace(/\/+$/, '');
  if (configured && /^https?:\/\/[^\s/]+$/i.test(configured)) return configured;
  return `${req.protocol}://${req.get('host')}`;
}

/** What the last Google sign-in came back with. The return URL carries no text (anyone could forge it). */
let lastGoogleResult: { ok: boolean; message: string; at: number } | undefined;

export class NotificationController {
  public static getSettings(_req: Request, res: Response): void {
    try {
      const settings = NotificationService.getSettings();
      res.json(settings);
    } catch (err: any) {
      console.error('Get notification settings error:', err);
      res.status(500).json({ error: 'Fout bij ophalen van notificatie-instellingen' });
    }
  }

  public static updateSettings(req: Request, res: Response): void {
    try {
      NotificationService.saveSettings(req.body);
      const updated = NotificationService.getSettings();
      res.json({ success: true, settings: updated });
    } catch (err: any) {
      console.error('Update notification settings error:', err);
      res.status(500).json({ error: 'Fout bij opslaan van notificatie-instellingen' });
    }
  }

  public static async testNotification(_req: Request, res: Response): Promise<void> {
    try {
      const result = await NotificationService.testNotification();
      if (!result.success) {
        res.status(400).json(result);
        return;
      }
      res.json(result);
    } catch (err: any) {
      console.error('Test notification error:', err);
      res.status(500).json({ success: false, message: err?.message || 'Fout bij verzenden van testmelding' });
    }
  }

  public static async testSmtp(req: Request, res: Response): Promise<void> {
    try {
      const { targetTo } = req.body || {};
      const result = await EmailService.sendTestEmail(targetTo);
      if (!result.success) {
        res.status(400).json(result);
        return;
      }
      res.json(result);
    } catch (err: any) {
      console.error('Test SMTP error:', err);
      res.status(500).json({ success: false, message: err?.message || 'Fout bij testen van SMTP-verbinding' });
    }
  }

  public static async checkAlerts(_req: Request, res: Response): Promise<void> {
    try {
      const result = await NotificationService.checkAndDispatchAlerts();
      res.json(result);
    } catch (err: any) {
      console.error('Check alerts error:', err);
      res.status(500).json({ error: 'Fout bij controleren van notificaties' });
    }
  }

  public static getMail(req: Request, res: Response): void {
    try {
      const smtp = EmailService.getSmtpConfig();
      const graph = EmailService.getGraphConfig();
      res.json({
        transport: EmailService.getTransport(),
        configured: EmailService.isConfigured(),
        smtp: {
          host: smtp.host,
          port: smtp.port,
          secure: smtp.secure,
          user: smtp.user,
          // Secrets are never sent to the browser, only whether one is stored.
          pass: smtp.pass ? '••••••••' : '',
          from: smtp.from,
          to: smtp.to,
          ignoreTlsErrors: smtp.ignoreTlsErrors,
          requireTls: smtp.requireTls,
        },
        graph: {
          tenantId: graph.tenantId,
          clientId: graph.clientId,
          clientSecret: graph.clientSecret ? '••••••••' : '',
          sender: graph.sender,
        },
        microsoft: MailConnections.microsoftStatus(),
        google: {
          ...MailConnections.googleStatus(),
          redirectUri: `${publicBase(req)}${GOOGLE_CALLBACK_PATH}`,
          // Shown once after coming back from Google.
          lastResult: ((r) => {
            lastGoogleResult = undefined;
            return r && Date.now() - r.at < 10 * 60_000 ? { ok: r.ok, message: r.message } : undefined;
          })(lastGoogleResult),
        },
      });
    } catch (err: any) {
      console.error('Get mail settings error:', err);
      res.status(500).json({ error: 'Fout bij ophalen van e-mailinstellingen' });
    }
  }

  public static updateMail(req: Request, res: Response): void {
    try {
      const body = req.body || {};
      const text = (v: unknown, max = 300) => (typeof v === 'string' ? v.slice(0, max) : undefined);
      const bool = (v: unknown) => (typeof v === 'boolean' ? v : undefined);

      if (body.transport !== undefined && !['smtp', 'graph', 'microsoft', 'gmail'].includes(body.transport)) {
        res.status(400).json({ error: 'Onbekende verzendmethode' });
        return;
      }
      const smtp = body.smtp || {};
      const port = smtp.port === undefined ? undefined : Number(smtp.port);
      if (port !== undefined && (!Number.isInteger(port) || port < 1 || port > 65535)) {
        res.status(400).json({ error: 'Poort moet een getal tussen 1 en 65535 zijn' });
        return;
      }

      EmailService.saveSmtpConfig({
        host: text(smtp.host),
        port,
        secure: bool(smtp.secure),
        user: text(smtp.user),
        pass: text(smtp.pass, 500),
        from: text(smtp.from),
        to: text(smtp.to, 500),
        ignoreTlsErrors: bool(smtp.ignoreTlsErrors),
        requireTls: bool(smtp.requireTls),
      });
      const graph = body.graph || {};
      EmailService.saveMailConfig({
        transport: body.transport,
        graphTenantId: text(graph.tenantId),
        graphClientId: text(graph.clientId),
        graphClientSecret: text(graph.clientSecret, 500),
        graphSender: text(graph.sender),
      });
      const google = body.google || {};
      if (typeof google.clientId === 'string' && google.clientId.trim() !== '') {
        const clientId = google.clientId.trim();
        const secret = typeof google.clientSecret === 'string' ? google.clientSecret.trim() : '';
        const keepSecret = secret === '' || secret.includes('••••');
        if (!GOOGLE_CLIENT_ID_PATTERN.test(clientId)) {
          res.status(400).json({ error: 'Het Google client-ID eindigt op .apps.googleusercontent.com' });
          return;
        }
        if (!keepSecret && !GOOGLE_CLIENT_SECRET_PATTERN.test(secret)) {
          res.status(400).json({ error: 'Het Google client-geheim bevat ongeldige tekens' });
          return;
        }
        MailConnections.saveGoogleClient({ clientId, clientSecret: keepSecret ? undefined : secret });
      }
      res.json({ success: true, configured: EmailService.isConfigured() });
    } catch (err: any) {
      console.error('Update mail settings error:', err);
      res.status(500).json({ error: 'Fout bij opslaan van e-mailinstellingen' });
    }
  }

  /** Checks the connection and the login without sending anything. */
  public static async verifyMail(_req: Request, res: Response): Promise<void> {
    try {
      const result = await EmailService.verifyConnection();
      res.status(result.success ? 200 : 400).json(result);
    } catch (err: any) {
      console.error('Verify mail error:', err);
      res.status(500).json({ success: false, message: err?.message || 'Fout bij controleren van de verbinding' });
    }
  }

  // ---- Microsoft 365: sign in with a device code ----

  public static async microsoftSignInStart(req: Request, res: Response): Promise<void> {
    const tenantId = typeof req.body?.tenantId === 'string' ? req.body.tenantId.trim() : '';
    const clientId = typeof req.body?.clientId === 'string' ? req.body.clientId.trim() : '';
    if (tenantId && !TENANT_PATTERN.test(tenantId)) {
      res.status(400).json({ error: 'Het tenant-id is een GUID of de domeinnaam van je Microsoft 365-omgeving. Laat het leeg als je het niet weet.' });
      return;
    }
    if (clientId && !CLIENT_ID_PATTERN.test(clientId)) {
      res.status(400).json({ error: 'Het client-id (toepassings-id) is een GUID. Laat het leeg voor de standaard.' });
      return;
    }
    try {
      const started = await MailConnections.microsoftSignIn.start(req.user!.userId, {
        tenant: tenantId || ANY_ORGANIZATION,
        clientId: clientId || DEFAULT_CLIENT_ID,
      });
      res.json({ id: started.id, userCode: started.userCode, verificationUri: started.verificationUri, expiresAt: started.expiresAt.toISOString() });
    } catch (err: any) {
      res.status(400).json({ error: err instanceof MicrosoftError ? err.message : 'Aanmelden starten is mislukt door een onverwachte fout.' });
    }
  }

  /** Polled by the page while the code waits; saves the sign-in when it is done. */
  public static async microsoftSignInStatus(req: Request, res: Response): Promise<void> {
    const id = typeof req.body?.id === 'string' ? req.body.id : '';
    if (!/^[A-Za-z0-9_-]{10,50}$/.test(id)) {
      res.status(400).json({ error: 'Ongeldige aanmelding' });
      return;
    }
    const result = await MailConnections.microsoftSignIn.poll(req.user!.userId, id);
    if (result.state === 'pending') {
      res.json({ state: 'pending', userCode: result.userCode, verificationUri: result.verificationUri, expiresAt: result.expiresAt.toISOString() });
      return;
    }
    if (result.state === 'unknown') {
      res.json({ state: 'failed', message: 'Deze aanmelding bestaat niet meer, de code is verlopen. Begin opnieuw.' });
      return;
    }
    if (result.state === 'failed') {
      res.json({ state: 'failed', message: result.message });
      return;
    }
    MailConnections.saveMicrosoft({
      tenantId: result.tenantId,
      clientId: result.clientId ?? DEFAULT_CLIENT_ID,
      mailbox: result.mailbox,
      refreshToken: result.refreshToken,
    });
    EmailService.saveMailConfig({ transport: 'microsoft' });
    res.json({ state: 'done', message: `Aangemeld als ${result.mailbox}. VehicleVault mag nu mail versturen als dit account.`, mailbox: result.mailbox });
  }

  public static microsoftSignInCancel(req: Request, res: Response): void {
    const id = typeof req.body?.id === 'string' ? req.body.id : '';
    MailConnections.microsoftSignIn.cancel(req.user!.userId, id);
    res.json({ success: true });
  }

  public static microsoftRemove(_req: Request, res: Response): void {
    MailConnections.clearMicrosoft();
    res.json({
      success: true,
      message: 'Verwijderd. Er kan geen mail meer via Microsoft 365 worden verstuurd. De toegang blijft bij Microsoft staan tot je die daar intrekt (Mijn account → Mijn apps).',
    });
  }

  // ---- Gmail: sign in with Google (authorization code + PKCE) ----

  public static googleStart(req: Request, res: Response): void {
    const creds = MailConnections.googleClientCredentials();
    if (!creds) {
      res.status(400).json({ error: 'Vul eerst het client-ID en het client-geheim van je Google OAuth-client in en sla op.' });
      return;
    }
    const { url } = MailConnections.googleSignIn.start(req.user!.userId, {
      ...creds,
      redirectUri: `${publicBase(req)}${GOOGLE_CALLBACK_PATH}`,
    });
    res.json({ url });
  }

  /**
   * Google sends the browser back here. There is no login on this request (the app keeps its token in the page),
   * so the one-time `state` made by googleStart is the proof; the page then shows the outcome from lastGoogleResult.
   */
  public static async googleCallback(req: Request, res: Response): Promise<void> {
    const back = (flag: string) => res.redirect(`/settings?tab=notifications&mail=${flag}`);
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    if (req.query.error || !state || !code) {
      // The user pressed cancel at Google, or the return URL is not one of ours.
      if (state) MailConnections.googleSignIn.discard(state);
      lastGoogleResult = { ok: false, message: 'De aanmelding bij Google is geannuleerd of niet afgerond.', at: Date.now() };
      return back('google');
    }
    const result = await MailConnections.googleSignIn.complete(state, code);
    if (result.state === 'done') {
      MailConnections.saveGoogleSignIn({
        account: result.account,
        refreshToken: result.refreshToken,
        clientId: result.clientId,
        clientSecret: result.clientSecret,
      });
      EmailService.saveMailConfig({ transport: 'gmail' });
      lastGoogleResult = { ok: true, message: `Verbonden met Google als ${result.account}. VehicleVault mag nu mail versturen als dit account.`, at: Date.now() };
    } else {
      lastGoogleResult = { ok: false, message: result.message, at: Date.now() };
    }
    back('google');
  }

  public static googleRemove(_req: Request, res: Response): void {
    MailConnections.clearGoogleSignIn();
    res.json({
      success: true,
      message: 'Verwijderd. Er kan geen mail meer via Gmail worden verstuurd. De toegang blijft bij Google staan tot je die daar intrekt (Beveiliging → Apps met toegang).',
    });
  }
  public static getPushPublicKey(_req: Request, res: Response): void {
    try {
      res.json({ publicKey: PushService.getPublicKey() });
    } catch (err: any) {
      console.error('Get VAPID public key error:', err);
      res.status(500).json({ error: 'Fout bij ophalen van de Web Push sleutel' });
    }
  }

  public static getPushStatus(req: Request, res: Response): void {
    try {
      const subscriptions = PushService.listForUser(req.user!.userId).map((s) => ({
        id: s.id,
        endpoint: s.endpoint,
        userAgent: s.user_agent,
        createdAt: s.created_at,
        lastUsedAt: s.last_used_at,
      }));
      res.json({ subscriptions, totalDevices: PushService.countAll() });
    } catch (err: any) {
      console.error('Get push status error:', err);
      res.status(500).json({ error: 'Fout bij ophalen van Web Push apparaten' });
    }
  }

  public static pushSubscribe(req: Request, res: Response): void {
    try {
      const { id } = PushService.subscribe(req.user!.userId, req.body, req.get('user-agent') || undefined);
      res.json({ success: true, id });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Kon apparaat niet registreren voor Web Push' });
    }
  }

  public static pushUnsubscribe(req: Request, res: Response): void {
    try {
      const endpoint = req.body?.endpoint;
      if (typeof endpoint !== 'string' || !endpoint) {
        res.status(400).json({ error: 'Endpoint ontbreekt' });
        return;
      }
      res.json({ success: true, removed: PushService.unsubscribe(req.user!.userId, endpoint) });
    } catch (err: any) {
      console.error('Push unsubscribe error:', err);
      res.status(500).json({ error: 'Fout bij uitschrijven van Web Push' });
    }
  }

  /** Test message to the signed-in user's own devices only, so non-admins can verify their device. */
  public static async pushTest(req: Request, res: Response): Promise<void> {
    try {
      const result = await PushService.sendToUser(
        req.user!.userId,
        '🚗 VehicleVault Testnotificatie',
        'Web Push werkt op dit apparaat.',
        'default'
      );
      res.status(result.success ? 200 : 400).json(result);
    } catch (err: any) {
      console.error('Push test error:', err);
      res.status(500).json({ success: false, message: err?.message || 'Fout bij verzenden van testmelding' });
    }
  }
}

