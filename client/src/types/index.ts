export type VehicleType = 'car' | 'motorcycle' | 'trailer' | 'van';

export interface ApkStatus {
  daysRemaining: number | null;
  isOverdue: boolean;
  isDueSoon: boolean;
}

export interface Vehicle {
  id: string;
  user_id: string;
  name: string;
  type: VehicleType;
  license_plate?: string | null;
  vin?: string | null;
  year?: number | null;
  make?: string | null;
  model?: string | null;
  fuel_type?: string | null;
  purchase_date?: string | null;
  purchase_price: number;
  initial_odometer: number;
  current_odometer?: number;
  notes?: string | null;
  status: 'active' | 'archived';
  rdw_data?: string | null;
  apk_expiration_date?: string | null;
  apk_status?: ApkStatus;
  plate_country?: 'NL' | 'BE' | 'DE' | 'EU' | 'OTHER' | string;
  image_path?: string | null;
  is_owner?: boolean;
  access_role?: 'owner' | 'editor' | 'viewer';
  owner_email?: string;
  is_showcase_active?: boolean;
  showcase_slug?: string;
  created_at: string;
  updated_at: string;
}

export interface VehicleShare {
  id: string;
  vehicle_id: string;
  user_id: string;
  email: string;
  role: 'editor' | 'viewer';
  created_at: string;
}

export interface FuelEntry {
  id: string;
  vehicle_id: string;
  date: string;
  odometer: number;
  energy_type?: 'fuel' | 'electric';
  kwh?: number | null;
  price_per_kwh?: number | null;
  liters: number;
  price_per_liter: number;
  total_cost: number;
  is_full_tank: number | boolean;
  missed_previous: number | boolean;
  notes?: string | null;
  receipt_path?: string | null;
  station_name?: string | null;
  station_address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  is_towing?: number | boolean;
  created_at: string;
}

export interface GasStation {
  id: string;
  name: string;
  brand?: string;
  address: string;
  street?: string;
  houseNumber?: string;
  city?: string;
  postcode?: string;
  lat: number;
  lon: number;
  distanceMeters?: number;
  distanceFormatted?: string;
}

export interface ServiceCategory {
  id: string;
  name: string;
  is_preset: number;
  default_distance_interval?: number;
  default_time_months?: number;
}

export interface MaintenanceInterval {
  id: string;
  vehicleId: string;
  categoryId: string;
  categoryName: string;
  customName: string | null;
  intervalKm: number | null;
  intervalMonths: number | null;
  lastServiceDate: string | null;
  lastServiceOdometer: number | null;
  currentOdometer: number;
  kmRemaining: number | null;
  daysRemaining: number | null;
  percentUsed: number;
  status: 'good' | 'warning' | 'overdue';
  triggerReason: 'distance' | 'time' | 'none';
}

export interface InvoiceLineItem {
  originalDescription: string;
  translatedDescription: string;
  category: 'parts' | 'labor' | 'other';
  quantity?: string | null;
  totalPrice: number | null;
}

export interface AiInvoiceExtraction {
  date: string | null;
  odometer: number | null;
  serviceTitle: string | null;
  garageName: string | null;
  garageAddress: string | null;
  detectedLanguage: string | null;
  totalCost: number | null;
  partsCost: number | null;
  laborCost: number | null;
  lineItems: InvoiceLineItem[];
  translatedNotes: string | null;
  engine: 'gemini' | 'openai';
  model: string;
}

export interface ServiceRecord {
  id: string;
  vehicle_id: string;
  category_id?: string | null;
  category_name?: string | null;
  maintenance_interval_id?: string | null;
  maintenance_interval_ids?: string | null;
  service_item: string;
  date: string;
  odometer: number;
  performing_party: 'self' | 'garage';
  cost: number;
  parts_cost?: number;
  labor_cost?: number;
  garage_name?: string | null;
  garage_address?: string | null;
  line_items?: string | null;
  notes?: string | null;
  invoice_path?: string | null;
  exclude_from_tco?: number | boolean;
  created_at: string;
}

export interface VehicleDocument {
  id: string;
  vehicle_id: string;
  user_id: string;
  name: string;
  category: 'registration' | 'insurance' | 'apk' | 'invoice' | 'manual' | 'other';
  file_path: string;
  file_size: number;
  mime_type: string;
  notes?: string | null;
  expires_at?: string | null;
  document_date?: string | null;
  created_at: string;
}

export interface VehicleVignette {
  id: string;
  vehicle_id: string;
  user_id: string;
  country: string;
  vignette_type: 'toll_digital' | 'toll_sticker' | 'emission_sticker' | 'other';
  name: string;
  valid_from?: string | null;
  valid_until?: string | null;
  cost: number;
  reference_number?: string | null;
  document_id?: string | null;
  document_name?: string | null;
  document_file_path?: string | null;
  notes?: string | null;
  created_at: string;
  status?: 'active' | 'expiring_soon' | 'expired' | 'future' | 'lifetime';
  days_remaining?: number | null;
}

export interface FuelTripMetric {
  date: string;
  odometer: number;
  deltaKm: number | null;
  liters: number;
  pricePerLiter: number;
  totalCost: number;
  costPer100Km: number | null;
  lPer100Km: number | null;
  station: string | null;
  is_towing?: number | boolean;
}

export interface StationComparison {
  name: string;
  totalSpend: number;
  totalLiters: number;
  avgPricePerLiter: number;
  fillCount: number;
}

export interface FuelDetailedStats {
  totalFuelLiters: number;
  avgDistancePerTank: number | null;
  maxDistancePerTank: number | null;
  avgCostPer100Km: number | null;
  avgNormalLPer100Km?: number | null;
  avgTowingLPer100Km?: number | null;
  tripMetrics: FuelTripMetric[];
  stations: StationComparison[];
}

export interface FuelPriceRecord {
  price: number;
  date: string;
  station: string | null;
  liters: number;
  odometer: number;
  totalCost: number;
}

export interface FuelPricePoint {
  date: string;
  odometer: number;
  pricePerLiter: number;
  liters: number;
  totalCost: number;
  station: string | null;
}

export interface FuelPriceStats {
  avgPrice: number | null;
  minPrice: FuelPriceRecord | null;
  maxPrice: FuelPriceRecord | null;
  history: FuelPricePoint[];
}

export interface TcoSummary {
  vehicleId: string;
  vehicleName: string;
  totalDistanceKm: number;
  totalMonths: number;
  fuelTotal: number;
  serviceTotal: number;
  fixedExpensesTotal?: number;
  monthlyFixedCost?: number;
  includeFixedExpenses?: boolean;
  purchasePrice: number;
  includePurchasePrice: boolean;
  totalCost: number;
  costPerKm: number;
  costPerMonth: number;
  avgLPer100Km: number | null;
  avgKmPerLiter: number | null;
  avgPricePerLiter: number | null;
  fuelTrends: {
    date: string;
    odometer: number;
    liters: number;
    pricePerLiter: number;
    totalCost: number;
    lPer100Km: number | null;
    kmPerLiter: number | null;
    rollingAvgLPer100Km: number | null;
  }[];
  monthlyBreakdown: {
    month: string;
    fuel: number;
    regularMaintenance: number;
    unscheduledRepairs: number;
    fixedExpenses?: number;
    total: number;
  }[];
  fuelStats?: FuelDetailedStats;
  priceStats?: FuelPriceStats;
}

export interface User {
  id: string;
  email: string;
  role: string;
}

export interface ApiKeyItem {
  id: string;
  name: string;
  prefix: string;
  last_used_at: string | null;
  created_at: string;
}

export interface PasskeyItem {
  id: string;
  label: string;
  deviceType: string | null;
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface RecurringExpense {
  id: string;
  vehicle_id: string;
  name: string;
  category: 'tax' | 'insurance' | 'roadside' | 'subscription' | 'lease' | 'inspection' | 'other';
  frequency: 'monthly' | 'quarterly' | 'yearly';
  amount: number;
  start_date: string;
  end_date: string | null;
  is_active: number;
  notes: string | null;
  purchase_price?: number | null;
  purchase_date?: string | null;
  invoice_file?: string | null;
  invoice_document_id?: string | null;
  wear_cost_per_1000km?: number | null;
  created_at: string;
}

export interface Trip {
  id: string;
  vehicle_id: string;
  user_id: string;
  date: string;
  start_odometer: number;
  end_odometer: number;
  distance_km: number;
  from_location: string;
  to_location: string;
  purpose: 'business' | 'commute' | 'private';
  description: string | null;
  is_return_trip: number;
  created_at: string;
}

export interface TripSummary {
  totalTrips: number;
  totalDistance: number;
  businessDistance: number;
  commuteDistance: number;
  privateDistance: number;
  businessPercentage: number;
}

export interface TireSet {
  id: string;
  vehicle_id: string;
  name: string;
  season: 'summer' | 'winter' | 'all_season';
  brand_model: string | null;
  brand?: string | null;
  model?: string | null;
  tire_size: string | null;
  rim_size?: string | null;
  speed_index?: string | null;
  dot_code: string | null;
  storage_location: string | null;
  status: 'mounted' | 'stored' | 'disposed';
  mounted_odometer: number | null;
  mounted_date: string | null;
  total_km: number;
  current_km?: number;
  tread_depth_fl: number | null;
  tread_depth_fr: number | null;
  tread_depth_rl: number | null;
  tread_depth_rr: number | null;
  last_measured_date: string | null;
  notes: string | null;
  purchase_price?: number | null;
  purchase_date?: string | null;
  invoice_file?: string | null;
  invoice_document_id?: string | null;
  wear_cost_per_1000km?: number | null;
  created_at: string;
  minDepth?: number | null;
  treadStatus?: 'ok' | 'warning' | 'critical' | 'unknown';
}


export type TripImportField = 'date' | 'from' | 'to' | 'start' | 'end' | 'distance' | 'purpose' | 'description' | 'return' | 'plate' | 'route';

export interface TripImportRecord {
  rowNumber: number;
  date: string;
  startOdometer: number;
  endOdometer: number;
  distanceKm: number;
  fromLocation: string;
  toLocation: string;
  purpose: 'business' | 'commute' | 'private';
  description: string;
  isReturnTrip: boolean;
  isValid: boolean;
  isDuplicate: boolean;
  section: number;
  error?: string;
  warning?: string;
}

export interface TripImportSection {
  index: number;
  label: string;
  plate: string | null;
  plateMatches: boolean | null;
  rows: number;
}

export interface TripImportPreview {
  format: 'csv' | 'xlsx';
  headers: string[];
  mapping: Partial<Record<TripImportField, string>>;
  missingRequired: TripImportField[];
  totalRows: number;
  validRows: number;
  errorRows: number;
  duplicateRows: number;
  sections: TripImportSection[];
  ignoredRows: { rowNumber: number; reason: string; text: string }[];
  records: TripImportRecord[];
}
