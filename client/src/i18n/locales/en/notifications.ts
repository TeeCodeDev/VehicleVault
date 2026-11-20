import type { notifications as nl } from '../nl/notifications.js';

export const notifications: Record<keyof typeof nl, string> = {
  // Notifications & Alerts
  fleetAlerts: 'Fleet Alerts',
  apkNotice: 'APK Inspection Attention',
  syncApk: 'Synchronize APK Status Now',
  syncing: 'Syncing...',

  // Notifications settings tab
  notifTitle: 'Notification System (APK & Maintenance Alerts)',
  notifSubtitle: 'Receive automatic reminders on your phone when an APK inspection is about to expire (< 30d, < 7d) or maintenance is due.',
  notifProviderDisabled: 'Disabled',
  notifProviderEmail: 'Email',
  notifProviderWebhook: 'Custom Webhook',
  pushoverUserKeyPlaceholder: '30-character User or Group Key',
  pushoverTokenPlaceholder: '30-character Application Token',
  pushoverDeviceLabel: 'Device Name (Optional)',
  pushoverDevicePlaceholder: 'Optional specific device name',
  ntfyUrlLabel: 'Ntfy Topic or Full URL *',
  ntfyUrlPlaceholder: 'https://ntfy.sh/my-secret-car-alerts',
  ntfyTokenLabel: 'Authentication Token (optional, for private ntfy servers)',
  gotifyUrlPlaceholder: 'https://gotify.mynetwork.com',
  notifTriggerApk: 'APK Reminders (30d and 7d before expiry)',
  notifTriggerMaintenance: 'Overdue Maintenance Reminders',
  notifTriggerTireSwap: 'Tire Swap Reminders (Seasonal Change)',
  notifTriggerTireTread: 'Tire Tread Warnings (≤ 3.0 mm and ≤ 1.6 mm)',
  notifSending: 'Sending...',
  notifSendTestEmail: 'Send Test Email',
  notifSendTest: 'Send Test Notification',
  notifSaved: 'Saved',
  notifSave: 'Save Notifications',
  notifSaveFailed: 'Error saving notification settings',
  notifTestFailed: 'Error sending test notification',

  // Per-vehicle notifications
  vehicleNotifLoading: 'Loading vehicle preferences...',
  vehicleNotifTitle: 'Per-Vehicle Notifications',
  vehicleNotifHint: 'Configure alerts per vehicle. Mute maintenance, inspection, or tire notices for secondary vehicles.',
  vehicleNotifAlerts: 'Alerts',
  vehicleNotifMaintenance: 'Maint.',
  vehicleNotifTireSwap: 'Swap',
  vehicleNotifTread: 'Tread',
  vehicleNotifUpdateFailed: 'Error updating vehicle notification setting',
};
