import type { notifications as nl } from '../nl/notifications.js';

export const notifications: Record<keyof typeof nl, string> = {
  // Notifications & Alerts
  fleetAlerts: 'Avisos de la flota',
  apkNotice: 'Atención: inspección APK',
  syncApk: 'Sincronizar estado de la APK ahora',
  syncing: 'Sincronizando...',
};
