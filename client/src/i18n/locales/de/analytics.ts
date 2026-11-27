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
  includeReceipts: 'Rechnungen & Tankbelege als eigene Anhangseiten beifügen',
  generatePdf: 'PDF erstellen & herunterladen',
  generatingPdf: 'PDF-Heft wird erstellt...',
  pdfSelectedVehicle: 'Ausgewähltes Fahrzeug',
  includeTires: 'Aktuellen Reifensatz & Profiltiefen einbeziehen',
  pdfGenerateFailed: 'PDF konnte nicht erstellt werden',

  // Analytics page
  fleetScope: 'Gesamte Garage / Fuhrpark',
  fleetScopeSubtitle: 'Zusammengefasste Auswertung über alle {count} Fahrzeuge',
  vehicleScopeSubtitle: 'Kostenauswertung für {name}',
  csvReport: 'CSV-Bericht',
  csvReportTooltip: 'Bericht als Excel/CSV herunterladen',

  // Filters (also used by the PDF export modal)
  includeFixedExpensesToggle: 'Fixkosten einbeziehen',
  filterStartDate: 'Startdatum',
  filterEndDate: 'Enddatum',
  noStartFilter: 'Kein Startdatum',
  noEndFilter: 'Kein Enddatum',
  minOdometer: 'Min. Kilometerstand (km)',
  maxOdometer: 'Max. Kilometerstand (km)',

  // Shared labels (tables & charts)
  vehicle: 'Fahrzeug',
  month: 'Monat',
  monthTotal: 'Monatssumme',
  regularMaintenance: 'Regelmäßige Wartung',
  repairs: 'Reparaturen',
  fixedShort: 'Fixkosten',
  drivenKm: 'Gefahrene km',
  costPerKmShort: 'Kosten / km',
  costPer100Km: 'Kosten / 100 km',
  kmPerLiterUnit: 'km/L',
  kmPerLiterValue: '{value} km/L',
  exportCsv: 'CSV exportieren',

  // Fleet view
  fleetLoading: 'Fuhrparkdaten werden geladen...',
  fleetVehicleCount: 'Über {count} aktive Fahrzeuge',
  fleetAvgCostPerKm: 'Ø Kosten / km (Fuhrpark)',
  fleetTotalDistance: 'Insgesamt {km} km gefahren',
  fuelAndCharging: 'Kraftstoff & Laden',
  fuelAndChargingHint: 'Kraftstoff- & Ladekosten',
  maintenanceAndRepairs: 'Wartung & Reparaturen',
  maintenanceAndRepairsHint: 'Regelmäßige Wartung & Reparaturen',
  fleetComparisonTitle: 'Fuhrpark-Vergleichstabelle',
  fleetComparisonSubtitle: 'Kosten und Leistung je Fahrzeug im direkten Vergleich',
  fleetMonthlyTitle: 'Zusammengefasste Monatskosten (Fuhrpark)',
  noFleetMonthlyData: 'Für den Fuhrpark sind keine monatlichen Daten verfügbar.',

  // Vehicle benchmark
  benchmarkTitle: 'Fahrzeug-Benchmark & Kostenranking',
  benchmarkSubtitle: 'Vergleiche Kosteneffizienz und Verbrauch all deiner Fahrzeuge untereinander.',
  lowestCostPerKm: 'Am günstigsten pro Kilometer',
  bestFuelEconomy: 'Niedrigster Verbrauch',
  totalDriven: 'Insgesamt gefahren:',

  // Vehicle KPI cards & charts
  overDrivenKm: 'Über {km} gefahrene km',
  averagedOverMonthsOne: 'Durchschnitt über {count} Monat',
  averagedOverMonths: 'Durchschnitt über {count} Monate',
  inclFixedCosts: '(inkl. €{amount} Fixkosten)',
  avgPricePerLiterLabel: 'Ø Literpreis:',
  costRatioTitle: 'Kostenverteilung (Betrieb)',
  bestConsumption: 'Niedrigster Verbrauch:',
  worstConsumption: 'Höchster Verbrauch:',
  consumptionTrendHint: 'Liter pro 100 km über aufeinanderfolgende Vollbetankungen',
  lowerIsBetter: 'Niedriger = sparsamer',
  fillUpConsumption: 'Verbrauch je Tankvorgang (L/100km)',
  consumptionTrendEmpty: 'Erfasse mindestens 2 aufeinanderfolgende Vollbetankungen, um den Verbrauchsverlauf zu sehen.',
  monthlyBreakdownHint: 'Aufteilung nach Kraftstoff, Wartung und Reparaturen',
  perCalendarMonth: 'Pro Kalendermonat',
  monthlyExpensesEmpty: 'In diesem Zeitraum sind noch keine monatlichen Ausgaben erfasst.',

  // Monthly cost table
  monthlyMatrixTitle: 'Monatliche Kostenaufstellung',
  exportTableCsv: 'Tabelle exportieren (CSV)',
  noMonthlyData: 'Keine monatlichen Daten verfügbar',

  // Seasonal stats
  seasonalTitle: 'Saisonaler Einfluss auf den Verbrauch (Sommer vs. Winter)',
  seasonalSubtitle: 'Vergleich von Verbrauch und Kraftstoffkosten zwischen den warmen (Apr–Sep) und kalten (Okt–Mär) Monaten.',
  inWinter: 'im Winter',
  summerPeriod: 'Sommerhalbjahr',
  winterPeriod: 'Winterhalbjahr',
  fillUpsCount: '{count} Tankvorgänge',
  avgConsumption: 'Ø Verbrauch',

  // Fuel price stats
  weightedAvgPricePerLiter: 'Gewichteter durchschnittlicher Literpreis',
  lowestPrice: 'Niedrigster Preis',
  highestPrice: 'Höchster Preis',
  noDataYet: 'Noch keine Daten',
  pricePerLiterSeries: 'Literpreis (€/L)',
  average: 'Durchschnitt',
  pricePerLiterLabel: 'Literpreis:',
  volumeLabel: 'Menge:',
  stationOrNoteLabel: 'Tankstelle/Notiz:',
  fuelPriceEmpty: 'Erfasse mindestens einen Tankvorgang, um die Preisentwicklung zu sehen.',

  // Tank & range stats
  rangeStationBadge: 'Reichweite & Tankstellen-Analyse',
  totalFuelLiters: 'Getankte Liter gesamt',
  towingSplitTitle: 'Verbrauchsvergleich mit Wohnwagen / Anhänger',
  towingSplitHint: 'Verbrauchswerte getrennt nach Tankvorgängen mit und ohne Anhänger/Wohnwagen.',
  soloConsumption: 'Verbrauch solo',
  towingConsumption: 'Mit Anhänger',
  rangeKm: 'Reichweite (km)',
  tankRangeEmpty: 'Für die Reichweite pro Tank sind mindestens 2 Tankvorgänge nötig.',
  costPer100KmEmpty: 'Keine Daten zu Kosten pro 100 km verfügbar.',

  // Fleet category filters
  categoryAll: 'Alle Kategorien',
  categoryCars: 'Autos',
  categoryMotorcycles: 'Motorräder',
  categoryVans: 'Transporter',
  categoryTrailers: 'Anhänger',
  includeInactiveVehicles: 'Verkaufte / archivierte Fahrzeuge einbeziehen',

  // Period comparison
  periodComparisonTitle: 'Periodenvergleich (Jahresvergleich & Monatstrend)',
  periodComparisonSubtitle: 'Vergleiche monatliche Gesamtkosten zwischen Jahren oder sieh den Trend zum Vormonat.',
  previousMonthLabel: 'Vormonat',
  periodDeltaLabel: 'Differenz',
};
