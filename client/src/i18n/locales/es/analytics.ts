import type { analytics as nl } from '../nl/analytics.js';

export const analytics: Record<keyof typeof nl, string> = {
  // Analytics & TCO
  analyticsTitle: 'Análisis completo de TCO y del vehículo',
  analyticsSubtitle: 'Información detallada sobre el coste total de propiedad, las tendencias de consumo, la evolución del precio del combustible y el desglose de costes.',
  operationalTco: 'TCO operativo (combustible + mantenimiento)',
  assetTco: 'TCO total del activo (incluido el precio de compra)',
  costPerKm: 'Coste por kilómetro',
  costPerMonth: 'Coste mensual',
  totalFleetSpend: 'Gasto total de la flota',
  fuelSpend: 'Gasto en combustible',
  maintenanceSpend: 'Gasto en mantenimiento',
  purchaseSpend: 'Valor de compra',
  includePurchaseToggle: 'Incluir el precio de compra en el cálculo del TCO',
  timeRange: 'Periodo',
  last30Days: 'Últimos 30 días',
  last6Months: 'Últimos 6 meses',
  ytd: 'Año en curso',
  allTime: 'Todo el historial',
  customRange: 'Periodo personalizado',
  fuelEconomyTrend: 'Evolución del consumo (L/100 km y km/L)',
  fuelPriceTrend: 'Evolución del precio del combustible (€/L)',
  monthlyCostBreakdown: 'Desglose mensual de costes (apilado)',
  rollingAverage: 'Media móvil (3 repostajes)',
  exportPdf: 'Descargar historial del vehículo (PDF)',

  // PDF Export Modal
  pdfModalTitle: 'Exportar historial y dosier del vehículo',
  pdfModalSubtitle: 'Genera un resumen de los mantenimientos y repostajes para tus archivos personales o para la venta del vehículo.',
  includeFuel: 'Incluir repostajes y estadísticas de consumo',
  includeReceipts: 'Incluir miniaturas de tickets y facturas',
  generatePdf: 'Generar y descargar PDF',
  generatingPdf: 'Creando el PDF...',
};
