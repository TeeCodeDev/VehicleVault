import type { analytics as nl } from '../nl/analytics.js';

export const analytics: Record<keyof typeof nl, string> = {
  // Analytics & TCO
  analyticsTitle: 'Comprehensive TCO & Vehicle Analytics',
  analyticsSubtitle: 'Deep insights into Total Cost of Ownership, consumption trends, fuel price evolution, and cost breakdown.',
  operationalTco: 'Operational TCO (Fuel + Maintenance)',
  assetTco: 'Total Asset TCO (Including Purchase Price)',
  costPerKm: 'Cost per kilometer',
  costPerMonth: 'Cost per month',
  totalFleetSpend: 'Total Fleet Spend',
  fuelSpend: 'Fuel Spend',
  maintenanceSpend: 'Maintenance Spend',
  purchaseSpend: 'Purchase Value',
  includePurchaseToggle: 'Include purchase price in TCO calculations',
  timeRange: 'Time Range',
  last30Days: 'Last 30 days',
  last6Months: 'Last 6 months',
  ytd: 'Year to Date (YTD)',
  allTime: 'All-time Lifetime',
  customRange: 'Custom Range',
  fuelEconomyTrend: 'Fuel Economy Trend Over Time (L/100km & KM/L)',
  fuelPriceTrend: 'Fuel Price Evolution (€/L)',
  monthlyCostBreakdown: 'Monthly Cost Breakdown (Stacked)',
  rollingAverage: 'Rolling average (3 fill-ups)',
  exportPdf: 'Download Vehicle History (PDF)',

  // PDF Export Modal
  pdfModalTitle: 'Export Vehicle History & Dossier',
  pdfModalSubtitle: 'Generate a summary of maintenance and fuel stops for personal records or vehicle transfer.',
  includeFuel: 'Include fuel logs and consumption statistics',
  includeReceipts: 'Add invoices & fuel receipts as separate appendix pages',
  generatePdf: 'Generate & Download PDF',
  generatingPdf: 'Building PDF booklet...',
  pdfSelectedVehicle: 'Selected Vehicle',
  includeTires: 'Include current tires & tread depths',
  pdfGenerateFailed: 'Failed to generate PDF',

  // Analytics page
  fleetScope: 'Entire Garage / Fleet',
  fleetScopeSubtitle: 'Consolidated fleet analytics across all {count} vehicles',
  vehicleScopeSubtitle: 'Financial reporting for {name}',
  csvReport: 'CSV Report',
  csvReportTooltip: 'Download CSV report',

  // Filters (also used by the PDF export modal)
  includeFixedExpensesToggle: 'Include fixed expenses',
  filterStartDate: 'Start date',
  filterEndDate: 'End date',
  noStartFilter: 'No start filter',
  noEndFilter: 'No end filter',
  minOdometer: 'Minimum Odometer (km)',
  maxOdometer: 'Maximum Odometer (km)',

  // Shared labels (tables & charts)
  vehicle: 'Vehicle',
  month: 'Month',
  monthTotal: 'Total',
  regularMaintenance: 'Maintenance',
  repairs: 'Repairs',
  fixedShort: 'Fixed',
  drivenKm: 'Driven KM',
  costPerKmShort: 'Cost / KM',
  costPer100Km: 'Cost / 100km',
  kmPerLiterUnit: 'km/L',
  kmPerLiterValue: '{value} km/L',
  exportCsv: 'Export CSV',

  // Fleet view
  fleetLoading: 'Loading fleet analytics...',
  fleetVehicleCount: 'Across {count} active vehicles',
  fleetAvgCostPerKm: 'Avg Cost / KM (Fleet)',
  fleetTotalDistance: 'Total {km} km',
  fuelAndCharging: 'Fuel & Charging',
  fuelAndChargingHint: 'Fuel and charging costs',
  maintenanceAndRepairs: 'Maintenance & Repairs',
  maintenanceAndRepairsHint: 'Regular service and repairs',
  fleetComparisonTitle: 'Fleet Comparison Table',
  fleetComparisonSubtitle: 'Side-by-side cost and performance per vehicle',
  fleetMonthlyTitle: 'Consolidated Monthly Fleet Spend',
  noFleetMonthlyData: 'No monthly fleet data.',

  // Vehicle benchmark
  benchmarkTitle: 'Vehicle Benchmark & Cost Ranking',
  benchmarkSubtitle: 'Compare the cost efficiency and fuel economy across all your personal vehicles.',
  lowestCostPerKm: 'Lowest cost per kilometer',
  bestFuelEconomy: 'Best fuel economy',
  totalDriven: 'Total driven:',

  // Vehicle KPI cards & charts
  overDrivenKm: 'Over {km} driven km',
  averagedOverMonthsOne: 'Averaged over {count} month',
  averagedOverMonths: 'Averaged over {count} months',
  inclFixedCosts: '(incl. €{amount} fixed expenses)',
  avgPricePerLiterLabel: 'Avg Price/L:',
  costRatioTitle: 'Cost Ratio (Operational)',
  bestConsumption: 'Best:',
  worstConsumption: 'Worst:',
  consumptionTrendHint: 'Liters per 100 km across consecutive full tanks',
  lowerIsBetter: 'Lower = Better',
  fillUpConsumption: 'Fill-up (L/100km)',
  consumptionTrendEmpty: 'Log at least 2 consecutive full tanks to see fuel consumption trend.',
  monthlyBreakdownHint: 'Breakdown between fuel, regular service and repairs',
  perCalendarMonth: 'Per month',
  monthlyExpensesEmpty: 'No monthly expenses recorded in this period.',

  // Monthly cost table
  monthlyMatrixTitle: 'Monthly Cost Specification Matrix',
  exportTableCsv: 'Export Table (CSV)',
  noMonthlyData: 'No monthly data',

  // Seasonal stats
  seasonalTitle: 'Seasonal Fuel Impact (Summer vs. Winter)',
  seasonalSubtitle: 'Direct efficiency comparison between warm (Apr-Sep) and cold (Oct-Mar) periods.',
  inWinter: 'in winter',
  summerPeriod: 'Summer Period',
  winterPeriod: 'Winter Period',
  fillUpsCount: '{count} fill-ups',
  avgConsumption: 'Avg consumption',

  // Fuel price stats
  weightedAvgPricePerLiter: 'Weighted average price per liter',
  lowestPrice: 'Lowest price',
  highestPrice: 'Highest price',
  noDataYet: 'No data yet',
  pricePerLiterSeries: 'Price / L (€)',
  average: 'Average',
  pricePerLiterLabel: 'Price/L:',
  volumeLabel: 'Volume:',
  stationOrNoteLabel: 'Station:',
  fuelPriceEmpty: 'Log at least 1 fill-up to view fuel price evolution.',

  // Tank & range stats
  rangeStationBadge: 'Range & Station Intelligence',
  totalFuelLiters: 'Total Fuel Liters',
  towingSplitTitle: 'Towing / Trailer Consumption Split',
  towingSplitHint: 'Fuel consumption isolated for towing vs. solo driving.',
  soloConsumption: 'Solo consumption',
  towingConsumption: 'With trailer',
  rangeKm: 'Range (km)',
  tankRangeEmpty: 'Need at least 2 fill-ups to calculate tank range.',
  costPer100KmEmpty: 'No cost per 100km data available.',

  // Fleet category filters
  categoryAll: 'All categories',
  categoryCars: 'Cars',
  categoryMotorcycles: 'Motorcycles',
  categoryVans: 'Vans',
  categoryTrailers: 'Trailers',
  includeInactiveVehicles: 'Include sold / archived vehicles',

  // Period comparison
  periodComparisonTitle: 'Period Comparison (Year-over-Year & Monthly Trend)',
  periodComparisonSubtitle: 'Compare monthly total costs across years or inspect the change from the previous month.',
  previousMonthLabel: 'Previous month',
  periodDeltaLabel: 'Difference',
};
