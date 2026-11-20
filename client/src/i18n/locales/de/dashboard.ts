import type { dashboard as nl } from '../nl/dashboard.js';

export const dashboard: Record<keyof typeof nl, string> = {
  // Dashboard page
  dashDriverMode: '🚗 Fahrermodus',
  dashMyVehicle: 'Mein Fahrzeug',
  dashFuelFallback: 'Kraftstoff',
  dashLastRefuel: 'Zuletzt getankt',
  dashLogCharge: '⚡ Ladevorgang erfassen',
  dashLogFuelOrCharge: '⛽ Tank- oder Ladevorgang erfassen',
  dashLogFuel: '⛽ Tankvorgang erfassen',
  dashRecentLogs: 'Letzte {count} Einträge',
  dashNoFuelYet: 'Noch keine Tankvorgänge erfasst.',
  dashSalesPageTooltip: 'Verkaufsseite & digitaler Fahrzeugpass',
  dashSalesPage: 'Verkaufsseite',
  dashService: 'Wartung',
  dashPdfDossier: 'PDF-Dossier',
  dashCalendarTooltip: 'APK, Wartungen und Dokumente in deinen Apple-/Google-/Outlook-Kalender exportieren',
  dashCalendar: 'Kalender',
  dashHaSyncNow: 'Jetzt mit Home Assistant synchronisieren',
  dashViewSyncLog: 'Sync-Protokoll anzeigen',
  dashInspectionLabel: '{term}-Prüfung',
  dashDaysOverdue: '{days} T. überfällig!',
  dashAlerts: 'Hinweise',
  dashOverdueCount: '{count} überfällig',
  dashDueSoonCount: '{count} bald fällig',
  dashTotalAlerts: '{count} Meldungen gesamt',
  dashLatestFuelHint: 'Zuletzt erfasste Tankvorgänge',
  dashConsumptionBadge: '{l100} L/100km',

  // Mobile bottom navigation
  navFuel: 'Tanken',
  navService: 'Wartung',
  navTires: 'Reifen',
  navDocs: 'Dokumente',
  navVignettes: 'Vignetten',
  navTrips: 'Fahrten',
  navExpenses: 'Kosten',
  navSettings: 'Optionen',

  // Top navbar
  navSwitchVehicle: 'Aktives Fahrzeug wechseln',
  navVehicleCount: '{count} Fahrzeuge',
  navManageVehicles: 'Fahrzeuge in Meine Garage verwalten',
  navShowcaseLiveTooltip: 'Die öffentliche Verkaufsseite dieses Fahrzeugs ist LIVE. Klicke zum Ansehen.',
  navShowcaseLive: 'Verkauf live',
  navLightMode: 'Heller Modus',
  navDarkMode: 'Dunkler Modus',
  navOpenProfile: 'Mein Profil & Sicherheit öffnen',
  navNoAuthTooltip: 'Anmeldung ist deaktiviert (No-Auth-/SSO-Modus)',

  // Status badges
  statusGood: 'In Ordnung',
  statusDueSoon: 'Bald fällig',
  statusOverdue: 'Überfällig',

  // Date picker
  dateSelectPlaceholder: 'Datum auswählen...',
  dateClear: 'Löschen',
  datePrevMonth: 'Vorheriger Monat',
  dateNextMonth: 'Nächster Monat',
  dateMinus7Days: '-7 Tage',
};
