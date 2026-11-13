import type { notifications as nl } from '../nl/notifications.js';

export const notifications: Record<keyof typeof nl, string> = {
  // Notifications & Alerts
  fleetAlerts: 'Fleet Alerts',
  apkNotice: 'APK Inspection Attention',
  syncApk: 'Synchronize APK Status Now',
  syncing: 'Syncing...',
};
