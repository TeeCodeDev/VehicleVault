import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { db } from '../db/database.js';
import { GraphMailService, type GraphConfig } from './graphMailService.js';
import { describeSmtpError, formatFailure } from './mailErrors.js';
import { MailConnections } from './mailConnections.js';
import { MicrosoftError } from './microsoftMailService.js';
import { GoogleError } from './googleMailService.js';

/** smtp: own or provider server; graph: Microsoft app registration (app-only); microsoft / gmail: signed in as the account. */
export type MailTransport = 'smtp' | 'graph' | 'microsoft' | 'gmail';
const TRANSPORTS: MailTransport[] = ['smtp', 'graph', 'microsoft', 'gmail'];

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** "a@x.nl, b@y.nl; c@z.nl" -> ['a@x.nl', 'b@y.nl', 'c@z.nl'] */
const splitRecipients = (value: string): string[] =>
  value
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean);

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  to: string;
  /** Accept a certificate that does not verify (own CA, self-signed). Off by default. */
  ignoreTlsErrors: boolean;
  /** Refuse to send when the server does not offer STARTTLS. */
  requireTls: boolean;
}

export class EmailService {
  private static cachedTransporter: Transporter | null = null;
  private static lastConfigKey = '';

  public static getSmtpConfig(): SmtpConfig {
    const getVal = (key: string, envKey: string, def = '') => {
      try {
        const row = db.get<{ value: string }>('SELECT value FROM system_settings WHERE key = ?', [key]);
        if (row && row.value !== undefined && row.value !== '') return row.value;
      } catch {}
      return process.env[envKey] || def;
    };

    const host = getVal('smtp_host', 'SMTP_HOST', '');
    const port = parseInt(getVal('smtp_port', 'SMTP_PORT', '587'), 10) || 587;
    const secureVal = getVal('smtp_secure', 'SMTP_SECURE', port === 465 ? 'true' : 'false');
    const secure = secureVal === 'true' || secureVal === '1';
    const user = getVal('smtp_user', 'SMTP_USER', '');
    const pass = getVal('smtp_pass', 'SMTP_PASS', '');
    const from = getVal('smtp_from', 'SMTP_FROM', 'VehicleVault <notificaties@vehiclevault.local>');
    const to = getVal('smtp_to', 'SMTP_TO', '');
    const ignoreTlsErrors = ['true', '1'].includes(getVal('smtp_ignore_tls_errors', 'SMTP_IGNORE_TLS_ERRORS', 'false'));
    const requireTls = ['true', '1'].includes(getVal('smtp_require_tls', 'SMTP_REQUIRE_TLS', 'false'));

    return {
      host,
      port,
      secure,
      user,
      pass,
      from,
      to,
      ignoreTlsErrors,
      requireTls,
    };
  }

  private static getSetting(key: string, envKey: string, def = ''): string {
    try {
      const row = db.get<{ value: string }>('SELECT value FROM system_settings WHERE key = ?', [key]);
      if (row && row.value !== undefined && row.value !== '') return row.value;
    } catch {}
    return process.env[envKey] || def;
  }

  private static setSetting(key: string, val: string): void {
    db.run(
      `INSERT INTO system_settings (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, val, new Date().toISOString()]
    );
  }

  public static getTransport(): MailTransport {
    const value = this.getSetting('mail_transport', 'MAIL_TRANSPORT', 'smtp') as MailTransport;
    return TRANSPORTS.includes(value) ? value : 'smtp';
  }

  public static getGraphConfig(): GraphConfig {
    return {
      tenantId: this.getSetting('graph_tenant_id', 'GRAPH_TENANT_ID'),
      clientId: this.getSetting('graph_client_id', 'GRAPH_CLIENT_ID'),
      clientSecret: this.getSetting('graph_client_secret', 'GRAPH_CLIENT_SECRET'),
      sender: this.getSetting('graph_sender', 'GRAPH_SENDER'),
    };
  }

  public static saveMailConfig(config: {
    transport?: MailTransport;
    graphTenantId?: string;
    graphClientId?: string;
    graphClientSecret?: string;
    graphSender?: string;
  }): void {
    if (config.transport !== undefined) this.setSetting('mail_transport', TRANSPORTS.includes(config.transport) ? config.transport : 'smtp');
    if (config.graphTenantId !== undefined) this.setSetting('graph_tenant_id', config.graphTenantId.trim());
    if (config.graphClientId !== undefined) this.setSetting('graph_client_id', config.graphClientId.trim());
    if (config.graphSender !== undefined) this.setSetting('graph_sender', config.graphSender.trim());
    // The secret is never sent back to the browser: an empty value or the mask keeps the stored one.
    if (config.graphClientSecret !== undefined && config.graphClientSecret !== '' && !config.graphClientSecret.includes('••••')) {
      this.setSetting('graph_client_secret', config.graphClientSecret.trim());
    }
    GraphMailService.resetTokenCache();
  }

  public static saveSmtpConfig(config: Partial<SmtpConfig>): void {
    const now = new Date().toISOString();
    const setVal = (key: string, val: string) => {
      db.run(
        `INSERT INTO system_settings (key, value, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [key, val, now]
      );
    };

    if (config.host !== undefined) setVal('smtp_host', config.host.trim());
    if (config.port !== undefined) setVal('smtp_port', String(config.port));
    if (config.secure !== undefined) setVal('smtp_secure', config.secure ? 'true' : 'false');
    if (config.user !== undefined) setVal('smtp_user', config.user.trim());
    if (config.pass !== undefined && config.pass !== '' && !config.pass.includes('••••')) {
      setVal('smtp_pass', config.pass);
    }
    if (config.from !== undefined) setVal('smtp_from', config.from.trim());
    if (config.to !== undefined) setVal('smtp_to', config.to.trim());
    if (config.ignoreTlsErrors !== undefined) setVal('smtp_ignore_tls_errors', config.ignoreTlsErrors ? 'true' : 'false');
    if (config.requireTls !== undefined) setVal('smtp_require_tls', config.requireTls ? 'true' : 'false');

    // Invalidate cached transporter on settings save
    this.cachedTransporter = null;
  }

  public static isSmtpConfigured(): boolean {
    const config = this.getSmtpConfig();
    return Boolean(config.host && (config.user || config.from));
  }

  /** True when mail can be sent with the selected transport (SMTP or Microsoft Graph). */
  public static isConfigured(): boolean {
    switch (this.getTransport()) {
      case 'graph':
        return GraphMailService.isConfigured(this.getGraphConfig());
      case 'microsoft':
        return MailConnections.microsoft() !== null;
      case 'gmail':
        return MailConnections.google() !== null;
      default:
        return this.isSmtpConfigured();
    }
  }

  /** The address mail goes out from for the signed-in transports. */
  public static signedInAddress(): string | undefined {
    const transport = this.getTransport();
    if (transport === 'microsoft') return MailConnections.microsoft()?.mailbox;
    if (transport === 'gmail') return MailConnections.google()?.account;
    return undefined;
  }

  public static getTransporter(): Transporter {
    const config = this.getSmtpConfig();
    const currentKey = `${config.host}:${config.port}:${config.secure}:${config.user}:${config.pass}:${config.ignoreTlsErrors}:${config.requireTls}`;

    if (this.cachedTransporter && this.lastConfigKey === currentKey) {
      return this.cachedTransporter;
    }

    const transportOptions: any = {
      host: config.host,
      port: config.port,
      secure: config.secure,
      requireTLS: config.requireTls && !config.secure,
      tls: {
        rejectUnauthorized: !config.ignoreTlsErrors,
      },
    };

    if (config.user) {
      transportOptions.auth = {
        user: config.user,
        pass: config.pass,
      };
    }

    this.cachedTransporter = nodemailer.createTransport(transportOptions);
    this.lastConfigKey = currentKey;
    return this.cachedTransporter;
  }

  public static async verifyConnection(): Promise<{ success: boolean; message: string }> {
    const transport = this.getTransport();
    if (transport === 'graph') {
      return GraphMailService.verify(this.getGraphConfig());
    }
    if (transport === 'microsoft') {
      const client = MailConnections.microsoft();
      if (!client) return { success: false, message: 'Microsoft 365 is niet ingesteld. Meld eerst aan.' };
      try {
        const check = await client.check();
        return check.canSend
          ? { success: true, message: `Aangemeld bij Microsoft 365; VehicleVault mag mail versturen als ${client.mailbox}.` }
          : { success: false, message: 'Aangemeld, maar zonder het recht om mail te versturen (Mail.Send). Meld opnieuw aan en geef toestemming.' };
      } catch (err: any) {
        return { success: false, message: err instanceof MicrosoftError ? err.message : 'Controle van Microsoft 365 is mislukt.' };
      }
    }
    if (transport === 'gmail') {
      const client = MailConnections.google();
      if (!client) return { success: false, message: 'Gmail is niet ingesteld. Verbind eerst met Google.' };
      try {
        await client.check();
        return { success: true, message: `Verbonden met Google; VehicleVault mag mail versturen als ${client.account}.` };
      } catch (err: any) {
        return { success: false, message: err instanceof GoogleError ? err.message : 'Controle van Gmail is mislukt.' };
      }
    }

    const config = this.getSmtpConfig();
    if (!config.host) {
      return { success: false, message: 'Geen SMTP Host ingevuld. Voer een geldige server in (bijv. smtp.gmail.com of mail.uwdomein.nl).' };
    }

    try {
      const transporter = this.getTransporter();
      await transporter.verify();
      return { success: true, message: 'Verbinding met SMTP-server succesvol geverifieerd!' };
    } catch (err: any) {
      return { success: false, message: `SMTP Verbindingsfout: ${formatFailure(describeSmtpError(err, config.host))}` };
    }
  }

  public static async sendMail(options: {
    to: string;
    subject: string;
    text?: string;
    html?: string;
  }): Promise<{ success: boolean; message: string }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        message: {
          graph: 'Microsoft Graph e-mailinstellingen zijn nog niet volledig ingevuld in de instellingen.',
          microsoft: 'Microsoft 365 is niet ingesteld. Meld aan onder Instellingen → Notificaties → E-mail.',
          gmail: 'Gmail is niet ingesteld. Verbind met Google onder Instellingen → Notificaties → E-mail.',
          smtp: 'SMTP e-mailinstellingen zijn nog niet geconfigureerd in de instellingen.',
        }[this.getTransport()],
      };
    }

    if (this.getTransport() === 'microsoft' || this.getTransport() === 'gmail') {
      const recipients = splitRecipients(options.to);
      if (recipients.length === 0) return { success: false, message: 'Geen ontvangstadres opgegeven.' };
      const message = { to: recipients, subject: options.subject, text: options.text, html: options.html };
      try {
        if (this.getTransport() === 'microsoft') {
          const client = MailConnections.microsoft()!;
          await client.send(message);
          return { success: true, message: `E-mail succesvol verzonden via Microsoft 365 (${client.mailbox})` };
        }
        const client = MailConnections.google()!;
        await client.send(message);
        return { success: true, message: `E-mail succesvol verzonden via Gmail (${client.account})` };
      } catch (err: any) {
        const known = err instanceof MicrosoftError || err instanceof GoogleError;
        if (!known) console.error('Email send error:', err);
        return { success: false, message: `Verzenden mislukt: ${known ? err.message : 'onverwachte fout'}` };
      }
    }

    if (this.getTransport() === 'graph') {
      const graph = this.getGraphConfig();
      const recipients = splitRecipients(options.to);
      if (recipients.length === 0) return { success: false, message: 'Geen ontvangstadres opgegeven.' };
      return GraphMailService.send(graph, { to: recipients, subject: options.subject, text: options.text, html: options.html });
    }

    const config = this.getSmtpConfig();
    try {
      const transporter = this.getTransporter();
      const info = await transporter.sendMail({
        from: config.from || config.user,
        to: options.to,
        subject: options.subject,
        text: options.text || '',
        html: options.html,
      });

      return { success: true, message: `E-mail succesvol verzonden (Message ID: ${info.messageId})` };
    } catch (err: any) {
      console.error('Email send error:', err);
      return { success: false, message: `Verzenden mislukt: ${formatFailure(describeSmtpError(err, config.host))}` };
    }
  }

  /** Default recipient for notifications and tests: the configured To, else the sending mailbox. */
  private static defaultRecipient(targetTo?: string): string {
    if (targetTo) return targetTo;
    const config = this.getSmtpConfig();
    if (config.to) return config.to;
    const signedIn = this.signedInAddress();
    if (signedIn) return signedIn;
    return this.getTransport() === 'graph' ? this.getGraphConfig().sender : config.user;
  }

  public static async sendTestEmail(targetTo?: string): Promise<{ success: boolean; message: string }> {
    const recipient = this.defaultRecipient(targetTo);
    const via = { graph: 'Microsoft Graph', microsoft: 'Microsoft 365', gmail: 'Gmail', smtp: this.getSmtpConfig().host }[this.getTransport()];

    if (!recipient) {
      return { success: false, message: 'Geen ontvangstadres opgegeven voor de testmail.' };
    }

    const subject = '🚗 VehicleVault Test E-mailnotificatie';
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #0284c7; font-size: 24px; font-weight: 800; margin: 0;">VehicleVault</h1>
          <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">Self-Hosted Wagenpark & Voertuigbeheer</p>
        </div>

        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 18px; margin-bottom: 20px;">
          <h2 style="color: #166534; font-size: 16px; margin: 0 0 8px 0; font-weight: 700;">✅ Verbinding Geslaagd!</h2>
          <p style="color: #15803d; font-size: 13px; margin: 0; line-height: 1.5;">
            Uw e-mailconfiguratie in VehicleVault functioneert correct. Vanaf nu kunt u APK- en onderhoudsmeldingen en wachtwoordherstel per e-mail ontvangen.
          </p>
        </div>

        <div style="color: #475569; font-size: 12px; border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center;">
          Verzonden via ${escapeHtml(via)} op ${new Date().toLocaleString('nl-NL')}
        </div>
      </div>
    `;

    return this.sendMail({
      to: recipient,
      subject,
      text: 'Dit is een testbericht vanuit VehicleVault. Uw e-mailkoppeling werkt correct!',
      html,
    });
  }

  public static async sendNotificationEmail(
    title: string,
    message: string,
    priority: 'low' | 'default' | 'high' | 'urgent' = 'default',
    targetTo?: string
  ): Promise<{ success: boolean; message: string }> {
    const recipient = this.defaultRecipient(targetTo);

    if (!recipient) {
      return { success: false, message: 'Geen ontvangstadres (To) geconfigureerd voor notificaties.' };
    }

    const isUrgent = priority === 'urgent' || priority === 'high';
    const bannerColor = isUrgent ? '#fff1f2' : '#f8fafc';
    const borderColor = isUrgent ? '#fecdd3' : '#e2e8f0';
    const titleColor = isUrgent ? '#be123c' : '#0f172a';

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; border-bottom: 1px solid #f1f5f9; padding-bottom: 16px;">
          <h1 style="color: #0284c7; font-size: 20px; font-weight: 800; margin: 0;">VehicleVault Melding</h1>
          <span style="background: ${isUrgent ? '#ffe4e6' : '#e0f2fe'}; color: ${isUrgent ? '#9f1239' : '#0369a1'}; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase;">
            ${priority}
          </span>
        </div>

        <div style="background: ${bannerColor}; border: 1px solid ${borderColor}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <h2 style="color: ${titleColor}; font-size: 17px; margin: 0 0 10px 0; font-weight: 700;">${escapeHtml(title)}</h2>
          <p style="color: #334155; font-size: 14px; margin: 0; line-height: 1.6; white-space: pre-line;">${escapeHtml(message)}</p>
        </div>

        <div style="text-align: center; margin-bottom: 24px;">
          <p style="color: #64748b; font-size: 12px; margin: 0;">Log in op uw dashboard om direct onderhoud te registreren of het voertuigdossier in te zien.</p>
        </div>

        <div style="color: #94a3b8; font-size: 11px; border-top: 1px solid #f1f5f9; padding-top: 16px; text-align: center;">
          Automatisch gegenereerd door VehicleVault • ${new Date().toLocaleString('nl-NL')}
        </div>
      </div>
    `;

    return this.sendMail({
      to: recipient,
      subject: title,
      text: `${title}\n\n${message}`,
      html,
    });
  }

  public static async sendPasswordResetEmail(
    toEmail: string,
    resetLink: string
  ): Promise<{ success: boolean; message: string }> {
    const subject = '🔐 Wachtwoord Opnieuw Instellen - VehicleVault';
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #0284c7; font-size: 24px; font-weight: 800; margin: 0;">VehicleVault</h1>
          <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">Wachtwoord Herstellen</p>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <p style="color: #1e293b; font-size: 14px; margin: 0 0 12px 0; line-height: 1.5;">
            Hallo,
          </p>
          <p style="color: #334155; font-size: 14px; margin: 0 0 16px 0; line-height: 1.6;">
            We hebben een verzoek ontvangen om het wachtwoord voor uw account (<strong>${escapeHtml(toEmail)}</strong>) opnieuw in te stellen. Klik op de onderstaande knop om een nieuw wachtwoord aan te maken:
          </p>

          <div style="text-align: center; margin: 24px 0;">
            <a href="${escapeHtml(resetLink)}" style="background-color: #0284c7; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-size: 14px; font-weight: 700; display: inline-block; box-shadow: 0 2px 4px rgba(2, 132, 199, 0.25);">
              Wachtwoord Opnieuw Instellen
            </a>
          </div>

          <p style="color: #64748b; font-size: 12px; margin: 16px 0 0 0; line-height: 1.5;">
            Werkt de knop niet? Kopieer en plak dan de volgende link in uw browser:<br />
            <a href="${escapeHtml(resetLink)}" style="color: #0284c7; word-break: break-all; font-family: monospace; font-size: 11px;">${escapeHtml(resetLink)}</a>
          </p>
        </div>

        <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 12px; margin-bottom: 20px;">
          <p style="color: #92400e; font-size: 12px; margin: 0; line-height: 1.5;">
            ⚠️ <strong>Let op:</strong> Deze link is om veiligheidsredenen slechts <strong>1 uur geldig</strong>. Heeft u dit verzoek niet zelf gedaan? Dan kunt u deze e-mail veilig negeren; uw huidige wachtwoord blijft ongewijzigd.
          </p>
        </div>

        <div style="color: #94a3b8; font-size: 11px; border-top: 1px solid #f1f5f9; padding-top: 16px; text-align: center;">
          Beveiligingsmelding vanuit uw VehicleVault installatie
        </div>
      </div>
    `;

    return this.sendMail({
      to: toEmail,
      subject,
      text: `Wachtwoord Opnieuw Instellen voor VehicleVault\n\nKlik op de volgende link om uw wachtwoord opnieuw in te stellen (1 uur geldig):\n${resetLink}\n\nHeeft u dit verzoek niet gedaan? Negeer dan deze e-mail.`,
      html,
    });
  }
}
