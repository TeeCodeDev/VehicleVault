import { Request, Response } from 'express';
import { NotificationService } from '../services/notificationService.js';
import { EmailService } from '../services/emailService.js';
import { PushService } from '../services/pushService.js';

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

