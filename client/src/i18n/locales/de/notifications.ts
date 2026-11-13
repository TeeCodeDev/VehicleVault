import type { notifications as nl } from '../nl/notifications.js';

export const notifications: Record<keyof typeof nl, string> = {
  // Notifications & Alerts
  fleetAlerts: 'Fuhrpark-Hinweise',
  apkNotice: 'Achtung: APK-Prüfung',
  syncApk: 'APK-Status jetzt synchronisieren',
  syncing: 'Wird synchronisiert...',
};
