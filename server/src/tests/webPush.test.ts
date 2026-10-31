import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { db } from '../db/database.js';
import { initializeDatabase } from '../db/schema.js';
import { PushService } from '../services/pushService.js';
import { NotificationService } from '../services/notificationService.js';

const b64url = (n: number) => crypto.randomBytes(n).toString('base64url');
const endpointFor = (host = 'fcm.googleapis.com') => `https://${host}/fcm/send/${b64url(24)}`;
const subscriptionFor = (endpoint = endpointFor()) => ({
  endpoint,
  keys: { p256dh: b64url(65), auth: b64url(16) },
});

describe('Web Push (VAPID)', () => {
  const originalSender = PushService.sender;
  const userA = crypto.randomUUID();
  const userB = crypto.randomUUID();
  const created = [userA, userB];

  const insertUser = (id: string, email: string, role = 'user') => {
    const now = new Date().toISOString();
    db.run('INSERT INTO users (id, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [
      id,
      email,
      'x',
      role,
      now,
      now,
    ]);
  };

  before(() => {
    initializeDatabase();
    insertUser(userA, `${userA}@webpush.test`);
    insertUser(userB, `${userB}@webpush.test`);
  });

  beforeEach(() => {
    db.run('DELETE FROM push_subscriptions');
    PushService.sender = originalSender;
  });

  after(() => {
    PushService.sender = originalSender;
    for (const id of created) db.run('DELETE FROM users WHERE id = ?', [id]);
    db.run("DELETE FROM system_settings WHERE key IN ('notification_provider')");
  });

  describe('VAPID keys', () => {
    it('generates a key pair once and keeps returning the same one', () => {
      const first = PushService.getVapidKeys();
      const second = PushService.getVapidKeys();
      assert.equal(first.publicKey, second.publicKey);
      assert.equal(first.privateKey, second.privateKey);
      // An uncompressed P-256 point is 65 bytes, base64url encoded.
      assert.equal(Buffer.from(first.publicKey, 'base64url').length, 65);
      assert.equal(Buffer.from(first.privateKey, 'base64url').length, 32);
    });

    it('prefers keys from the environment over stored ones', () => {
      const stored = PushService.getVapidKeys();
      process.env.VAPID_PUBLIC_KEY = 'env-public';
      process.env.VAPID_PRIVATE_KEY = 'env-private';
      try {
        assert.deepEqual(PushService.getVapidKeys(), { publicKey: 'env-public', privateKey: 'env-private' });
      } finally {
        delete process.env.VAPID_PUBLIC_KEY;
        delete process.env.VAPID_PRIVATE_KEY;
      }
      assert.equal(PushService.getVapidKeys().publicKey, stored.publicKey);
    });

    it('only uses a mailto: or https: subject', () => {
      process.env.VAPID_SUBJECT = 'not-a-url';
      try {
        assert.match(PushService.getSubject(), /^(mailto:|https:\/\/)/);
      } finally {
        delete process.env.VAPID_SUBJECT;
      }
      process.env.VAPID_SUBJECT = 'mailto:beheer@example.org';
      try {
        assert.equal(PushService.getSubject(), 'mailto:beheer@example.org');
      } finally {
        delete process.env.VAPID_SUBJECT;
      }
    });
  });

  describe('endpoint validation', () => {
    it('accepts the endpoints of the major push services', () => {
      for (const host of [
        'fcm.googleapis.com',
        'updates.push.services.mozilla.com',
        'web.push.apple.com',
        'wns2-par02p.notify.windows.com',
      ]) {
        assert.equal(PushService.isAcceptableEndpoint(endpointFor(host)), true, host);
      }
    });

    it('rejects anything the server should never POST to', () => {
      for (const bad of [
        'http://fcm.googleapis.com/fcm/send/abc',
        'https://127.0.0.1/x',
        'https://[::1]/x',
        'https://169.254.169.254/latest/meta-data',
        'https://localhost/x',
        'https://printer.local/x',
        'https://intranet/x',
        'https://user:pass@fcm.googleapis.com/x',
        'ftp://fcm.googleapis.com/x',
        'not a url',
        '',
        `https://fcm.googleapis.com/${'a'.repeat(3000)}`,
        undefined,
        42,
      ]) {
        assert.equal(PushService.isAcceptableEndpoint(bad as any), false, String(bad));
      }
    });

    it('rejects subscriptions with missing or malformed keys', () => {
      const base = subscriptionFor();
      assert.throws(() => PushService.validateSubscription({ endpoint: base.endpoint }));
      assert.throws(() => PushService.validateSubscription({ ...base, keys: { p256dh: base.keys.p256dh } }));
      assert.throws(() => PushService.validateSubscription({ ...base, keys: { ...base.keys, auth: 'a b!' } }));
      assert.throws(() => PushService.validateSubscription(null));
      assert.deepEqual(PushService.validateSubscription(base), base);
    });
  });

  describe('subscriptions', () => {
    it('stores a subscription per device and lists it for its owner only', () => {
      PushService.subscribe(userA, subscriptionFor(), 'Mozilla/5.0 (iPhone)');
      PushService.subscribe(userA, subscriptionFor());
      PushService.subscribe(userB, subscriptionFor());

      assert.equal(PushService.listForUser(userA).length, 2);
      assert.equal(PushService.listForUser(userB).length, 1);
      assert.equal(PushService.listForUser(userA)[0].user_agent, 'Mozilla/5.0 (iPhone)');
      assert.equal(PushService.countAll(), 3);
    });

    it('keeps one row per endpoint when the same browser subscribes again', () => {
      const sub = subscriptionFor();
      const first = PushService.subscribe(userA, sub);
      const rotated = { ...sub, keys: { p256dh: b64url(65), auth: b64url(16) } };
      const second = PushService.subscribe(userA, rotated);

      assert.equal(first.id, second.id);
      const rows = PushService.listForUser(userA);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].auth, rotated.keys.auth);
    });

    it('moves a device to the user who signs in on it next', () => {
      const sub = subscriptionFor();
      PushService.subscribe(userA, sub);
      PushService.subscribe(userB, sub);
      assert.equal(PushService.listForUser(userA).length, 0);
      assert.equal(PushService.listForUser(userB).length, 1);
    });

    it('limits the number of devices per user', () => {
      for (let i = 0; i < 10; i++) PushService.subscribe(userA, subscriptionFor());
      assert.throws(() => PushService.subscribe(userA, subscriptionFor()), /Maximaal 10/);
      // Re-subscribing an existing device is still fine at the limit.
      const existing = PushService.listForUser(userA)[0];
      assert.doesNotThrow(() =>
        PushService.subscribe(userA, { endpoint: existing.endpoint, keys: { p256dh: existing.p256dh, auth: existing.auth } })
      );
    });

    it("never lets one user unsubscribe another user's device", () => {
      const sub = subscriptionFor();
      PushService.subscribe(userA, sub);
      assert.equal(PushService.unsubscribe(userB, sub.endpoint), false);
      assert.equal(PushService.listForUser(userA).length, 1);
      assert.equal(PushService.unsubscribe(userA, sub.endpoint), true);
      assert.equal(PushService.listForUser(userA).length, 0);
    });

    it('is removed together with its user', () => {
      const temp = crypto.randomUUID();
      insertUser(temp, `${temp}@webpush.test`);
      PushService.subscribe(temp, subscriptionFor());
      db.run('DELETE FROM users WHERE id = ?', [temp]);
      assert.equal(PushService.listForUser(temp).length, 0);
    });
  });

  describe('delivery', () => {
    it('reports clearly when no device is subscribed', async () => {
      const res = await PushService.sendToAll('t', 'm');
      assert.equal(res.success, false);
      assert.equal(res.sent, 0);
      assert.match(res.message, /Geen apparaten/);
    });

    it('sends an encrypted-payload request with VAPID details and the right urgency', async () => {
      PushService.subscribe(userA, subscriptionFor());
      const calls: any[] = [];
      PushService.sender = async (sub, payload, options) => {
        calls.push({ sub, payload: JSON.parse(payload), options });
        return {};
      };

      const res = await PushService.sendToAll('APK Herinnering', 'Over 5 dagen', 'urgent');

      assert.equal(res.success, true);
      assert.equal(res.sent, 1);
      assert.equal(calls.length, 1);
      assert.equal(calls[0].payload.title, 'APK Herinnering');
      assert.equal(calls[0].payload.body, 'Over 5 dagen');
      assert.equal(calls[0].options.urgency, 'high');
      assert.equal(calls[0].options.vapidDetails.publicKey, PushService.getPublicKey());
      assert.match(calls[0].options.vapidDetails.subject, /^(mailto:|https:\/\/)/);
      assert.ok(PushService.listForUser(userA)[0].last_used_at);

      calls.length = 0;
      await PushService.sendToAll('t', 'm', 'low');
      assert.equal(calls[0].options.urgency, 'low');
      await PushService.sendToAll('t', 'm', 'default');
      assert.equal(calls[1].options.urgency, 'normal');
    });

    it('drops subscriptions the push service reports as gone (404 / 410) and keeps the rest', async () => {
      const gone = subscriptionFor();
      const alive = subscriptionFor();
      PushService.subscribe(userA, gone);
      PushService.subscribe(userA, alive);
      PushService.sender = async (sub) => {
        if (sub.endpoint === gone.endpoint) throw Object.assign(new Error('gone'), { statusCode: 410 });
        return {};
      };

      const res = await PushService.sendToAll('t', 'm');

      assert.equal(res.success, true);
      assert.equal(res.sent, 1);
      assert.equal(res.removed, 1);
      assert.deepEqual(
        PushService.listForUser(userA).map((r) => r.endpoint),
        [alive.endpoint]
      );
    });

    it('keeps subscriptions on temporary failures and reports the error', async () => {
      PushService.subscribe(userA, subscriptionFor());
      PushService.sender = async () => {
        throw Object.assign(new Error('boom'), { statusCode: 503, body: 'push service unavailable' });
      };

      const res = await PushService.sendToAll('t', 'm');

      assert.equal(res.success, false);
      assert.equal(res.failed, 1);
      assert.match(res.message, /push service unavailable/);
      assert.equal(PushService.listForUser(userA).length, 1);
    });

    it('sendToUser only reaches that user', async () => {
      PushService.subscribe(userA, subscriptionFor());
      PushService.subscribe(userB, subscriptionFor());
      let calls = 0;
      PushService.sender = async () => {
        calls++;
        return {};
      };
      const res = await PushService.sendToUser(userA, 't', 'm');
      assert.equal(res.sent, 1);
      assert.equal(calls, 1);
    });
  });

  describe('notification provider', () => {
    it('routes alerts through Web Push when it is the selected provider', async () => {
      NotificationService.saveSettings({ provider: 'webpush' });
      assert.equal(NotificationService.getSettings().provider, 'webpush');

      PushService.subscribe(userA, subscriptionFor());
      const titles: string[] = [];
      PushService.sender = async (_sub, payload) => {
        titles.push(JSON.parse(payload).title);
        return {};
      };

      const res = await NotificationService.testNotification();
      assert.equal(res.success, true);
      assert.equal(titles.length, 1);
      assert.match(titles[0], /Testnotificatie/);
    });
  });
});
