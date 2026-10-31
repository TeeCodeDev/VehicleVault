import { apiFetch } from '../api/client.js';

export interface PushDevice {
  id: string;
  endpoint: string;
  userAgent: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

export type PushUnsupportedReason = 'insecure' | 'ios-not-installed' | 'unsupported';

export function isIos(): boolean {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac with touch support.
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1);
}

/** True when the app runs from the home screen / as an installed PWA rather than in a browser tab. */
export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
}

/** Why Web Push cannot work here, or null when it can. iOS only supports it for apps added to the Home Screen. */
export function pushUnsupportedReason(): PushUnsupportedReason | null {
  if (!window.isSecureContext) return 'insecure';
  if (isIos() && !isStandalone()) return 'ios-not-installed';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  return null;
}

export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function sameKey(a: ArrayBuffer | null, b: Uint8Array): boolean {
  if (!a) return false;
  const x = new Uint8Array(a);
  return x.length === b.length && x.every((v, i) => v === b[i]);
}

export async function getBrowserSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

/** Ask permission (must be called from a click), subscribe this browser and register it with the server. */
export async function enablePush(): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw Object.assign(new Error('permission-denied'), { code: 'permission-denied' });
  }

  const registration = await navigator.serviceWorker.ready;
  const { publicKey } = await apiFetch<{ publicKey: string }>('/api/notifications/push/public-key');
  const serverKey = urlBase64ToUint8Array(publicKey);

  let subscription = await registration.pushManager.getSubscription();
  // Keys changed (new VAPID pair on the server): the old subscription can never receive anything again.
  if (subscription && !sameKey(subscription.options.applicationServerKey, serverKey)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: serverKey as BufferSource,
    });
  }

  await apiFetch('/api/notifications/push/subscribe', {
    method: 'POST',
    body: JSON.stringify(subscription.toJSON()),
  });
}

export async function disablePush(): Promise<void> {
  const subscription = await getBrowserSubscription();
  if (subscription) {
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    await apiFetch('/api/notifications/push/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint }) });
  }
}

export async function removeDevice(endpoint: string): Promise<void> {
  await apiFetch('/api/notifications/push/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint }) });
}

/** Short, human label for a stored user agent. */
export function describeDevice(userAgent: string | null): string {
  if (!userAgent) return 'Onbekend apparaat';
  const os = /iPhone|iPad|iPod/.test(userAgent)
    ? 'iOS'
    : /Android/.test(userAgent)
      ? 'Android'
      : /Windows/.test(userAgent)
        ? 'Windows'
        : /Mac OS X|Macintosh/.test(userAgent)
          ? 'macOS'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : '';
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Firefox\//.test(userAgent)
      ? 'Firefox'
      : /Chrome\//.test(userAgent)
        ? 'Chrome'
        : /Safari\//.test(userAgent)
          ? 'Safari'
          : '';
  return [browser, os].filter(Boolean).join(' op ') || 'Onbekend apparaat';
}
