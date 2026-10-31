import { Request, Response } from 'express';
import { NotificationService } from '../services/notificationService.js';
import { EmailService } from '../services/emailService.js';

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

  public static getMail(_req: Request, res: Response): void {
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

      if (body.transport !== undefined && body.transport !== 'smtp' && body.transport !== 'graph') {
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
}

