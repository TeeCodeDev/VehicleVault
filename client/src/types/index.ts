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
  image_path?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FuelEntry {
  id: string;
  vehicle_id: string;
  date: string;
  odometer: number;
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

export interface ServiceRecord {
  id: string;
  vehicle_id: string;
  category_id?: string | null;
  category_name?: string | null;
  maintenance_interval_id?: string | null;
  service_item: string;
  date: string;
  odometer: number;
  performing_party: 'self' | 'garage';
  cost: number;
  parts_cost?: number;
  labor_cost?: number;
  notes?: string | null;
  invoice_path?: string | null;
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
  created_at: string;
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

