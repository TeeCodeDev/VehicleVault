import { db } from '../db/database.js';
import { RdwService } from './rdwService.js';

export interface NotificationSettings {
  provider: 'none' | 'ntfy' | 'gotify' | 'webhook';
  ntfyUrl: string;
  ntfyToken?: string;
  gotifyUrl: string;
  gotifyToken?: string;
  webhookUrl: string;
  enabledApk: boolean;
  enabledMaintenance: boolean;
}

export class NotificationService {
  public static getSettings(): NotificationSettings {
    const getVal = (key: string, def = '') => {
      try {
        const row = db.get<{ value: string }>('SELECT value FROM system_settings WHERE key = ?', [key]);
        return row?.value || def;
      } catch {
        return def;
      }
    };

    return {
      provider: (getVal('notification_provider', 'none') as any) || 'none',
      ntfyUrl: getVal('notification_ntfy_url', ''),
      ntfyToken: getVal('notification_ntfy_token', ''),
      gotifyUrl: getVal('notification_gotify_url', ''),
      gotifyToken: getVal('notification_gotify_token', ''),
      webhookUrl: getVal('notification_webhook_url', ''),
      enabledApk: getVal('notification_enabled_apk', 'true') === 'true',
      enabledMaintenance: getVal('notification_enabled_maintenance', 'true') === 'true',
    };
  }

  public static saveSettings(settings: Partial<NotificationSettings>): void {
    const now = new Date().toISOString();
    const setVal = (key: string, val: string) => {
      db.run(
        `INSERT INTO system_settings (key, value, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [key, val, now]
      );
    };

    if (settings.provider !== undefined) setVal('notification_provider', settings.provider);
    if (settings.ntfyUrl !== undefined) setVal('notification_ntfy_url', settings.ntfyUrl.trim());
    if (settings.ntfyToken !== undefined) setVal('notification_ntfy_token', settings.ntfyToken.trim());
    if (settings.gotifyUrl !== undefined) setVal('notification_gotify_url', settings.gotifyUrl.trim());
    if (settings.gotifyToken !== undefined) setVal('notification_gotify_token', settings.gotifyToken.trim());
    if (settings.webhookUrl !== undefined) setVal('notification_webhook_url', settings.webhookUrl.trim());
    if (settings.enabledApk !== undefined) setVal('notification_enabled_apk', settings.enabledApk ? 'true' : 'false');
    if (settings.enabledMaintenance !== undefined) setVal('notification_enabled_maintenance', settings.enabledMaintenance ? 'true' : 'false');
  }

  public static async send(
    title: string,
    message: string,
    priority: 'low' | 'default' | 'high' | 'urgent' = 'default',
    tags: string[] = ['car', 'wrench']
  ): Promise<{ success: boolean; message: string }> {
    const config = this.getSettings();
    if (config.provider === 'none') {
      return { success: false, message: 'Notificaties zijn momenteel uitgeschakeld in de instellingen.' };
    }

    try {
      if (config.provider === 'ntfy') {
        if (!config.ntfyUrl) throw new Error('Geen Ntfy URL of topic ingesteld');
        const url = config.ntfyUrl.startsWith('http') ? config.ntfyUrl : `https://ntfy.sh/${config.ntfyUrl}`;
        const headers: Record<string, string> = {
          Title: title,
          Priority: priority === 'urgent' ? '5' : priority === 'high' ? '4' : '3',
          Tags: tags.join(','),
        };
        if (config.ntfyToken) {
          headers.Authorization = `Bearer ${config.ntfyToken}`;
        }

        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: message,
        });

        if (!res.ok) {
          throw new Error(`Ntfy error (${res.status}): ${await res.text()}`);
        }
        return { success: true, message: 'Ntfy notificatie succesvol verzonden' };
      }

      if (config.provider === 'gotify') {
        if (!config.gotifyUrl || !config.gotifyToken) {
          throw new Error('Gotify vereist zowel een Server URL als een App Token');
        }
        const endpoint = `${config.gotifyUrl.replace(/\/$/, '')}/message?token=${encodeURIComponent(config.gotifyToken)}`;
        const gotifyPriority = priority === 'urgent' ? 9 : priority === 'high' ? 7 : 4;

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            message,
            priority: gotifyPriority,
          }),
        });

        if (!res.ok) {
          throw new Error(`Gotify error (${res.status}): ${await res.text()}`);
        }
        return { success: true, message: 'Gotify notificatie succesvol verzonden' };
      }

      if (config.provider === 'webhook') {
        if (!config.webhookUrl) throw new Error('Geen Webhook URL geconfigureerd');

        const res = await fetch(config.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'vehiclevault_alert',
            title,
            message,
            priority,
            tags,
            timestamp: new Date().toISOString(),
          }),
        });

        if (!res.ok) {
          throw new Error(`Webhook error (${res.status}): ${await res.text()}`);
        }
        return { success: true, message: 'Webhook alert succesvol verzonden' };
      }

      return { success: false, message: 'Onbekende notificatie provider' };
    } catch (err: any) {
      console.error('Notification dispatch error:', err);
      return { success: false, message: err?.message || 'Fout bij verzenden van notificatie' };
    }
  }

  public static async testNotification(): Promise<{ success: boolean; message: string }> {
    return this.send(
      '🚗 VehicleVault Testnotificatie',
      'Dit is een succesvolle testmelding vanuit VehicleVault. Uw notificatiekoppeling werkt perfect!',
      'default',
      ['white_check_mark', 'car']
    );
  }

  public static async checkAndDispatchAlerts(): Promise<{ alertsSent: number; details: string[] }> {
    const config = this.getSettings();
    if (config.provider === 'none') {
      return { alertsSent: 0, details: ['Notificaties zijn uitgeschakeld'] };
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const details: string[] = [];
    let count = 0;

    const vehicles = db.query<any>(`
      SELECT v.*,
        MAX(COALESCE(f.max_f, 0), COALESCE(s.max_s, 0), v.initial_odometer) as current_odometer
      FROM vehicles v
      LEFT JOIN (SELECT vehicle_id, MAX(odometer) as max_f FROM fuel_entries GROUP BY vehicle_id) f ON f.vehicle_id = v.id
      LEFT JOIN (SELECT vehicle_id, MAX(odometer) as max_s FROM service_records GROUP BY vehicle_id) s ON s.vehicle_id = v.id
      WHERE v.status = 'active'
      GROUP BY v.id
    `);

    for (const v of vehicles) {
      // 1. APK Expiration Check
      if (config.enabledApk && v.apk_expiration_date) {
        const apk = RdwService.evaluateApkStatus(v.apk_expiration_date);
        if (apk.daysRemaining !== null && apk.daysRemaining <= 30) {
          const cacheKey = `notif_apk_${v.id}_${todayStr}`;
          const alreadySent = db.get<{ value: string }>('SELECT value FROM system_settings WHERE key = ?', [cacheKey]);

          if (!alreadySent) {
            const urgency = apk.daysRemaining <= 7 ? 'urgent' : 'high';
            const title = `⚠️ APK Herinnering: ${v.name} (${v.license_plate || 'Onbekend'})`;
            const msg = apk.daysRemaining < 0
              ? `De APK van ${v.name} is ${Math.abs(apk.daysRemaining)} dagen verlopen!`
              : `De APK van ${v.name} verloopt over ${apk.daysRemaining} dagen (${v.apk_expiration_date}). Plan tijdig een keuring.`;

            await this.send(title, msg, urgency, ['warning', 'car']);
            db.run('INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)', [
              cacheKey,
              'sent',
              new Date().toISOString(),
            ]);
            count++;
            details.push(`APK alert verzonden voor ${v.name}`);
          }
        }
      }

      // 2. Overdue Maintenance Check
      if (config.enabledMaintenance) {
        const intervals = db.query<any>(`
          SELECT mi.*, sc.name as category_name
          FROM maintenance_intervals mi
          JOIN service_categories sc ON sc.id = mi.category_id
          WHERE mi.vehicle_id = ?
        `, [v.id]);

        const currentOdo = Number(v.current_odometer) || 0;
        const now = new Date();

        for (const item of intervals) {
          let isOverdue = false;
          let reason = '';

          if (item.interval_km) {
            const baseKm = item.last_service_odometer !== null && item.last_service_odometer !== undefined
              ? Number(item.last_service_odometer)
              : Number(v.initial_odometer) || 0;
            const diff = (baseKm + Number(item.interval_km)) - currentOdo;
            if (diff < 0) {
              isOverdue = true;
              reason = `${Math.abs(diff)} km overschreden`;
            }
          }

          if (item.interval_months && !isOverdue) {
            const baseDate = item.last_service_date ? new Date(item.last_service_date) : new Date(v.purchase_date || v.created_at);
            const dueDate = new Date(baseDate);
            dueDate.setMonth(dueDate.getMonth() + Number(item.interval_months));
            if (dueDate < now) {
              isOverdue = true;
              reason = 'tijdsinterval verstreken';
            }
          }

          if (isOverdue) {
            const cacheKey = `notif_maint_${item.id}_${todayStr}`;
            const alreadySent = db.get<{ value: string }>('SELECT value FROM system_settings WHERE key = ?', [cacheKey]);

            if (!alreadySent) {
              const itemName = item.custom_name || item.category_name;
              const title = `🔧 Onderhoud Vereist: ${v.name}`;
              const msg = `Het onderhoudsinterval voor "${itemName}" is overschreden (${reason}).`;

              await this.send(title, msg, 'high', ['wrench', 'car']);
              db.run('INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)', [
                cacheKey,
                'sent',
                new Date().toISOString(),
              ]);
              count++;
              details.push(`Onderhoud alert verzonden voor ${v.name} (${itemName})`);
            }
          }
        }
      }
    }

    return { alertsSent: count, details };
  }
}

