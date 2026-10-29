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
}

