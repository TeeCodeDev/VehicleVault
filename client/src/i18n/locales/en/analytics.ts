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
  includeReceipts: 'Include receipt & invoice thumbnails',
  generatePdf: 'Generate & Download PDF',
  generatingPdf: 'Building PDF booklet...',
};
