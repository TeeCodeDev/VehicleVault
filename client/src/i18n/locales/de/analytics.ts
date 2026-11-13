import type { analytics as nl } from '../nl/analytics.js';

export const analytics: Record<keyof typeof nl, string> = {
  // Analytics & TCO
  analyticsTitle: 'Umfassende TCO- & Fahrzeuganalyse',
  analyticsSubtitle: 'Detaillierte Einblicke in Gesamtbetriebskosten, Verbrauchstrends, Kraftstoffpreisentwicklung und Kostenaufteilung.',
  operationalTco: 'Betriebs-TCO (Kraftstoff + Wartung)',
  assetTco: 'Gesamt-TCO (inkl. Kaufpreis)',
  costPerKm: 'Kosten pro Kilometer',
  costPerMonth: 'Kosten pro Monat',
  totalFleetSpend: 'Gesamtausgaben Fuhrpark',
  fuelSpend: 'Kraftstoffkosten',
  maintenanceSpend: 'Wartungskosten',
  purchaseSpend: 'Kaufwert',
  includePurchaseToggle: 'Kaufpreis in TCO-Berechnung einbeziehen',
  timeRange: 'Zeitraum',
  last30Days: 'Letzte 30 Tage',
  last6Months: 'Letzte 6 Monate',
  ytd: 'Laufendes Jahr (YTD)',
  allTime: 'Gesamter Zeitraum',
  customRange: 'Benutzerdefinierter Zeitraum',
  fuelEconomyTrend: 'Verbrauchsentwicklung im Zeitverlauf (L/100km & KM/L)',
  fuelPriceTrend: 'Entwicklung des Kraftstoffpreises (€/L)',
  monthlyCostBreakdown: 'Monatliche Kostenaufteilung (gestapelt)',
  rollingAverage: 'Gleitender Durchschnitt (3 Tankvorgänge)',
  exportPdf: 'Fahrzeughistorie herunterladen (PDF)',

  // PDF Export Modal
  pdfModalTitle: 'Fahrzeughistorie & Dossier exportieren',
  pdfModalSubtitle: 'Erstelle eine Übersicht über Wartungen und Tankstopps für die eigenen Unterlagen oder einen Fahrzeugverkauf.',
  includeFuel: 'Tankvorgänge und Verbrauchsstatistiken einbeziehen',
  includeReceipts: 'Vorschaubilder von Belegen & Rechnungen einbeziehen',
  generatePdf: 'PDF erstellen & herunterladen',
  generatingPdf: 'PDF-Heft wird erstellt...',
};
