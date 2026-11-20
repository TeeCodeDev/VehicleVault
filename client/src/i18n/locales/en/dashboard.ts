import type { dashboard as nl } from '../nl/dashboard.js';

export const dashboard: Record<keyof typeof nl, string> = {
  // Dashboard page
  dashDriverMode: '🚗 Driver Mode',
  dashMyVehicle: 'My Vehicle',
  dashFuelFallback: 'Fuel',
  dashLastRefuel: 'Last Refuel',
  dashLogCharge: '⚡ Log EV Charge',
  dashLogFuelOrCharge: '⛽ Log Fuel or Charge',
  dashLogFuel: '⛽ Log Fuel Fill-up',
  dashRecentLogs: 'Recent {count} Logs',
  dashNoFuelYet: 'No fill-ups logged yet.',
  dashSalesPageTooltip: 'Sales Showcase & Vehicle Passport',
  dashSalesPage: 'Sales Page',
  dashService: 'Service',
  dashPdfDossier: 'Dossier',
  dashCalendarTooltip: 'Export inspection, service and documents to Apple/Google/Outlook Calendar',
  dashCalendar: 'Calendar',
  dashHaSyncNow: 'Sync with Home Assistant now',
  dashViewSyncLog: 'View sync log',
  dashInspectionLabel: '{term} Inspection',
  dashDaysOverdue: '{days} d overdue!',
  dashAlerts: 'alerts',
  dashOverdueCount: '{count} overdue',
  dashDueSoonCount: '{count} due soon',
  dashTotalAlerts: '{count} total alerts',
  dashLatestFuelHint: 'Latest logged fuel stops',
  dashConsumptionBadge: '{l100} L/100km',

  // Mobile bottom navigation
  navFuel: 'Fuel',
  navService: 'Service',
  navTires: 'Tires',
  navDocs: 'Docs',
  navVignettes: 'Vignettes',
  navTrips: 'Trips',
  navExpenses: 'Expenses',
  navSettings: 'Settings',

  // Top navbar
  navSwitchVehicle: 'Switch active vehicle',
  navVehicleCount: '{count} vehicles',
  navManageVehicles: 'Manage vehicles in garage',
  navShowcaseLiveTooltip: "This vehicle's public sales page is LIVE. Click to view.",
  navShowcaseLive: 'Showcase Live',
  navLightMode: 'Light mode',
  navDarkMode: 'Dark mode',
  navOpenProfile: 'Open My Profile & Security',
  navNoAuthTooltip: 'Sign-in is disabled (No-Auth / SSO mode)',

  // Status badges
  statusGood: 'Good',
  statusDueSoon: 'Due Soon',
  statusOverdue: 'Overdue',

  // Date picker
  dateSelectPlaceholder: 'Select date...',
  dateClear: 'Clear',
  datePrevMonth: 'Previous month',
  dateNextMonth: 'Next month',
  dateMinus7Days: '-7 days',
};
