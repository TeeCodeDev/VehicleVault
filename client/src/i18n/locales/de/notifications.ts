import type { notifications as nl } from '../nl/notifications.js';

export const notifications: Record<keyof typeof nl, string> = {
  // Notifications & Alerts
  fleetAlerts: 'Fuhrpark-Hinweise',
  apkNotice: 'Achtung: APK-Prüfung',
  syncApk: 'APK-Status jetzt synchronisieren',
  syncing: 'Wird synchronisiert...',

  // Notifications settings tab
  notifTitle: 'Benachrichtigungssystem (APK- & Wartungsmeldungen)',
  notifSubtitle: 'Erhalte automatische Erinnerungen auf deinem Handy, wenn eine APK bald abläuft (< 30 Tage, < 7 Tage) oder eine Wartung fällig ist.',
  notifProviderDisabled: 'Deaktiviert',
  notifProviderEmail: 'E-Mail',
  notifProviderWebhook: 'Eigener Webhook',
  pushoverUserKeyPlaceholder: '30-stelliger User- oder Group-Key',
  pushoverTokenPlaceholder: '30-stelliges Application Token',
  pushoverDeviceLabel: 'Gerätename (optional)',
  pushoverDevicePlaceholder: 'Optional: bestimmter Gerätename',
  ntfyUrlLabel: 'Ntfy-Topic oder vollständige URL *',
  ntfyUrlPlaceholder: 'https://ntfy.sh/meine-geheimen-auto-benachrichtigungen',
  ntfyTokenLabel: 'Authentifizierungstoken (optional, für private ntfy-Server)',
  gotifyUrlPlaceholder: 'https://gotify.meinnetzwerk.de',
  notifTriggerApk: 'APK-Erinnerungen (30 und 7 Tage vor Ablauf)',
  notifTriggerMaintenance: 'Erinnerungen bei überfälliger Wartung',
  notifTriggerTireSwap: 'Reifenwechsel-Erinnerungen (Saisonwechsel)',
  notifTriggerTireTread: 'Reifenprofil-Warnungen (≤ 3,0 mm und ≤ 1,6 mm)',
  notifSending: 'Wird gesendet...',
  notifSendTestEmail: 'Test-E-Mail senden',
  notifSendTest: 'Testbenachrichtigung senden',
  notifSaved: 'Gespeichert',
  notifSave: 'Benachrichtigungen speichern',
  notifSaveFailed: 'Fehler beim Speichern der Benachrichtigungseinstellungen',
  notifTestFailed: 'Fehler beim Senden der Testbenachrichtigung',

  // Per-vehicle notifications
  vehicleNotifLoading: 'Fahrzeugeinstellungen werden geladen...',
  vehicleNotifTitle: 'Benachrichtigungen pro Fahrzeug',
  vehicleNotifHint: 'Lege hier pro Fahrzeug fest, ob du allgemeine Benachrichtigungen sowie Wartungs-, APK- oder Reifenerinnerungen erhalten möchtest.',
  vehicleNotifAlerts: 'Benachrichtigungen',
  vehicleNotifMaintenance: 'Wartung',
  vehicleNotifTireSwap: 'Reifenwechsel',
  vehicleNotifTread: 'Profil',
  vehicleNotifUpdateFailed: 'Fehler beim Aktualisieren der Benachrichtigungseinstellung des Fahrzeugs',
};
