import crypto from 'node:crypto';
import net from 'node:net';
import webpush from 'web-push';
import { db } from '../db/database.js';

export type PushPriority = 'low' | 'default' | 'high' | 'urgent';

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
  last_used_at: string | null;
}

export interface PushSendResult {
  success: boolean;
  message: string;
  sent: number;
  removed: number;
  failed: number;
}

type PushSender = (
  subscription: PushSubscriptionInput,
  payload: string,
  options: webpush.RequestOptions
) => Promise<unknown>;

const MAX_SUBSCRIPTIONS_PER_USER = 10;
const MAX_ENDPOINT_LENGTH = 2048;
const FALLBACK_SUBJECT = 'https://github.com/TeeCodeDev/VehicleVault';

/**
 * Web Push (RFC 8030) with VAPID (RFC 8292): the server sends encrypted messages to the push service of the
 * browser (FCM, Mozilla autopush, Apple, WNS); the service worker in the PWA shows them. No third-party account
 * is needed. The VAPID key pair is generated on first use and kept in system_settings, or taken from the
 * VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY environment variables.
 */
export class PushService {
  /** Replaceable in tests so no network traffic is needed. */
  public static sender: PushSender = (subscription, payload, options) =>
    webpush.sendNotification(subscription, payload, options);

  private static getSetting(key: string): string {
    try {
      return db.get<{ value: string }>('SELECT value FROM system_settings WHERE key = ?', [key])?.value || '';
    } catch {
      return '';
    }
  }

  private static setSetting(key: string, value: string): void {
    db.run(
      `INSERT INTO system_settings (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, value, new Date().toISOString()]
    );
  }

  public static getVapidKeys(): { publicKey: string; privateKey: string } {
    const envPublic = process.env.VAPID_PUBLIC_KEY?.trim();
    const envPrivate = process.env.VAPID_PRIVATE_KEY?.trim();
    if (envPublic && envPrivate) return { publicKey: envPublic, privateKey: envPrivate };

    const storedPublic = this.getSetting('vapid_public_key');
    const storedPrivate = this.getSetting('vapid_private_key');
    if (storedPublic && storedPrivate) return { publicKey: storedPublic, privateKey: storedPrivate };

    const generated = webpush.generateVAPIDKeys();
    this.setSetting('vapid_public_key', generated.publicKey);
    this.setSetting('vapid_private_key', generated.privateKey);
    return generated;
  }

  public static getPublicKey(): string {
    return this.getVapidKeys().publicKey;
  }

  /** Contact for the push service operators: a mailto: or https: URL. Apple rejects anything else. */
  public static getSubject(): string {
    const configured = process.env.VAPID_SUBJECT?.trim();
    if (configured && /^(mailto:|https:\/\/)/i.test(configured)) return configured;
    try {
      const admin = db.get<{ email: string }>(
        "SELECT email FROM users WHERE role = 'admin' AND email LIKE '%_@_%.__%' ORDER BY created_at ASC LIMIT 1"
      );
      if (admin?.email && !admin.email.endsWith('.local')) return `mailto:${admin.email}`;
    } catch {}
    return FALLBACK_SUBJECT;
  }

  /**
   * Subscriptions come from the client, and the server later POSTs to the endpoint, so only accept what a real
   * push service looks like: https, a DNS name (not an IP literal, not localhost / a bare internal host).
   */
  public static isAcceptableEndpoint(endpoint: unknown): endpoint is string {
    if (typeof endpoint !== 'string' || endpoint.length === 0 || endpoint.length > MAX_ENDPOINT_LENGTH) return false;
    let url: URL;
    try {
      url = new URL(endpoint);
    } catch {
      return false;
    }
    if (url.protocol !== 'https:' || url.username || url.password) return false;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (net.isIP(host)) return false;
    if (!host.includes('.') || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
      return false;
    }
    return true;
  }

  public static validateSubscription(input: any): PushSubscriptionInput {
    if (!input || !this.isAcceptableEndpoint(input.endpoint)) {
      throw new Error('Ongeldig push-endpoint');
    }
    const p256dh = input.keys?.p256dh;
    const auth = input.keys?.auth;
    const isKey = (v: unknown, max: number) => typeof v === 'string' && /^[A-Za-z0-9_-]+={0,2}$/.test(v) && v.length <= max;
    if (!isKey(p256dh, 200) || !isKey(auth, 100)) {
      throw new Error('Ongeldige push-sleutels');
    }
    return { endpoint: input.endpoint, keys: { p256dh, auth } };
  }

  public static subscribe(userId: string, input: any, userAgent?: string): { id: string } {
    const sub = this.validateSubscription(input);
    const now = new Date().toISOString();

    const existing = db.get<{ id: string }>('SELECT id FROM push_subscriptions WHERE endpoint = ?', [sub.endpoint]);
    if (existing) {
      // Same browser re-subscribing (possibly after another user signed in on it): keep one row per endpoint.
      db.run('UPDATE push_subscriptions SET user_id = ?, p256dh = ?, auth = ?, user_agent = ? WHERE id = ?', [
        userId,
        sub.keys.p256dh,
        sub.keys.auth,
        userAgent?.slice(0, 300) ?? null,
        existing.id,
      ]);
      return { id: existing.id };
    }

    const count = db.get<{ n: number }>('SELECT COUNT(*) as n FROM push_subscriptions WHERE user_id = ?', [userId])?.n ?? 0;
    if (count >= MAX_SUBSCRIPTIONS_PER_USER) {
      throw new Error(`Maximaal ${MAX_SUBSCRIPTIONS_PER_USER} apparaten per gebruiker. Verwijder eerst een oud apparaat.`);
    }

    const id = crypto.randomUUID();
    db.run(
      `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth, userAgent?.slice(0, 300) ?? null, now]
    );
    return { id };
  }

  public static unsubscribe(userId: string, endpoint: string): boolean {
    const res = db.run('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?', [endpoint, userId]);
    return Number(res.changes) > 0;
  }

  public static listForUser(userId: string): PushSubscriptionRow[] {
    return db.query<PushSubscriptionRow>(
      'SELECT * FROM push_subscriptions WHERE user_id = ? ORDER BY created_at ASC',
      [userId]
    );
  }

  public static countAll(): number {
    return db.get<{ n: number }>('SELECT COUNT(*) as n FROM push_subscriptions')?.n ?? 0;
  }

  public static async sendToUser(
    userId: string,
    title: string,
    message: string,
    priority: PushPriority = 'default'
  ): Promise<PushSendResult> {
    return this.deliver(this.listForUser(userId), title, message, priority);
  }

  public static async sendToAll(title: string, message: string, priority: PushPriority = 'default'): Promise<PushSendResult> {
    const rows = db.query<PushSubscriptionRow>('SELECT * FROM push_subscriptions ORDER BY created_at ASC');
    return this.deliver(rows, title, message, priority);
  }

  private static async deliver(
    rows: PushSubscriptionRow[],
    title: string,
    message: string,
    priority: PushPriority
  ): Promise<PushSendResult> {
    if (rows.length === 0) {
      return {
        success: false,
        message: 'Geen apparaten geabonneerd op Web Push. Schakel meldingen in op minstens één apparaat.',
        sent: 0,
        removed: 0,
        failed: 0,
      };
    }

    const { publicKey, privateKey } = this.getVapidKeys();
    const payload = JSON.stringify({
      title,
      body: message,
      tag: `vv-${crypto.createHash('sha1').update(title).digest('hex').slice(0, 12)}`,
      url: '/',
      priority,
    });
    const options: webpush.RequestOptions = {
      vapidDetails: { subject: this.getSubject(), publicKey, privateKey },
      TTL: 60 * 60 * 24,
      urgency: priority === 'urgent' || priority === 'high' ? 'high' : priority === 'low' ? 'low' : 'normal',
      timeout: 15000,
    };

    let sent = 0;
    let removed = 0;
    let failed = 0;
    let lastError = '';

    await Promise.all(
      rows.map(async (row) => {
        try {
          await this.sender({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, payload, options);
          sent++;
          db.run('UPDATE push_subscriptions SET last_used_at = ? WHERE id = ?', [new Date().toISOString(), row.id]);
        } catch (err: any) {
          const status = err?.statusCode;
          if (status === 404 || status === 410) {
            // The browser revoked the subscription (permission removed, app uninstalled): stop sending to it.
            db.run('DELETE FROM push_subscriptions WHERE id = ?', [row.id]);
            removed++;
          } else {
            failed++;
            const status = err?.statusCode ? `HTTP ${err.statusCode}: ` : '';
            lastError = `${status}${err?.body || err?.message || 'Onbekende fout'}`;
            let host = 'onbekende host';
            try {
              host = new URL(row.endpoint).host;
            } catch {}
            console.warn(`Web Push naar ${host} mislukt (${lastError})`);
          }
        }
      })
    );

    console.log(`Web Push: ${sent} verzonden, ${removed} verwijderd, ${failed} mislukt (${rows.length} apparaten)`);

    if (sent > 0) {
      const extra = [removed ? `${removed} verlopen apparaat/apparaten verwijderd` : '', failed ? `${failed} mislukt` : '']
        .filter(Boolean)
        .join(', ');
      return {
        success: true,
        message: `Web Push verzonden naar ${sent} apparaat/apparaten${extra ? ` (${extra})` : ''}`,
        sent,
        removed,
        failed,
      };
    }
    return {
      success: false,
      message: failed
        ? `Web Push mislukt: ${lastError}`
        : 'Alle geabonneerde apparaten waren verlopen en zijn verwijderd. Schakel meldingen opnieuw in op je apparaat.',
      sent,
      removed,
      failed,
    };
  }
}
