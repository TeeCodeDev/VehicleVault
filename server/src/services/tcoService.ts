import { db } from '../db/database.js';

export interface TcoFilterOptions {
  vehicleId: string;
  startDate?: string;
  endDate?: string;
  minOdometer?: number;
  maxOdometer?: number;
  includePurchasePrice?: boolean;
  includeFixedExpenses?: boolean;
}

export interface FuelTrendPoint {
  date: string;
  odometer: number;
  liters: number;
  pricePerLiter: number;
  totalCost: number;
  lPer100Km: number | null;
  kmPerLiter: number | null;
  rollingAvgLPer100Km: number | null;
}

export interface MonthlySpendBreakdown {
  month: string; // YYYY-MM
  fuel: number;
  regularMaintenance: number;
  unscheduledRepairs: number;
  fixedExpenses: number;
  total: number;
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
  avgNormalLPer100Km: number | null;
  avgTowingLPer100Km: number | null;
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

export interface VehicleTcoSummary {
  vehicleId: string;
  vehicleName: string;
  totalDistanceKm: number;
  totalMonths: number;
  fuelTotal: number;
  serviceTotal: number;
  fixedExpensesTotal: number;
  monthlyFixedCost: number;
  includeFixedExpenses: boolean;
  purchasePrice: number;
  includePurchasePrice: boolean;
  totalCost: number;
  costPerKm: number;
  costPerMonth: number;
  avgLPer100Km: number | null;
  avgKmPerLiter: number | null;
  avgPricePerLiter: number | null;
  fuelTrends: FuelTrendPoint[];
  monthlyBreakdown: MonthlySpendBreakdown[];
  fuelStats?: FuelDetailedStats;
  priceStats?: FuelPriceStats;
}

export class TcoService {
  /**
   * Returns the effective ownership start date (YYYY-MM-DD) for a vehicle,
   * checking purchase_date first and falling back to RDW datum_tenaamstelling.
   */
  public static getOwnershipStartDate(vehicle: any): string | null {
    if (!vehicle) return null;
    if (vehicle.purchase_date && typeof vehicle.purchase_date === 'string' && vehicle.purchase_date.trim()) {
      return vehicle.purchase_date.trim().slice(0, 10);
    }
    if (vehicle.rdw_data) {
      try {
        const parsed = typeof vehicle.rdw_data === 'string' ? JSON.parse(vehicle.rdw_data) : vehicle.rdw_data;
        const rawTenaam = parsed?.datum_tenaamstelling || parsed?.raw?.datum_tenaamstelling;
        if (rawTenaam) {
          const s = String(rawTenaam).trim();
          if (/^\d{8}$/.test(s)) {
            return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
          }
          if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
            return s.slice(0, 10);
          }
        }
      } catch {}
    }
    return null;
  }

  /**
   * Determines whether a service record belongs to pre-ownership history
   * (either explicitly marked exclude_from_tco, dated before purchase/tenaamstelling,
   * or logged at an odometer reading lower than initial_odometer).
   */
  public static isExcludedFromTco(record: any, vehicle: any): boolean {
    if (!record) return false;
    if (record.exclude_from_tco === 1 || record.exclude_from_tco === true) {
      return true;
    }
    if (!vehicle) return false;

    const ownershipStart = TcoService.getOwnershipStartDate(vehicle);
    if (ownershipStart && record.date && String(record.date).slice(0, 10) < ownershipStart) {
      return true;
    }

    const initOdo = Number(vehicle.initial_odometer) || 0;
    const recOdo = Number(record.odometer) || 0;
    if (initOdo > 0 && recOdo > 0 && recOdo < initOdo) {
      return true;
    }

    return false;
  }

  public static calculateTco(options: TcoFilterOptions): VehicleTcoSummary {
    const {
      vehicleId,
      startDate,
      endDate,
      minOdometer,
      maxOdometer,
      includePurchasePrice = false,
      includeFixedExpenses = true,
    } = options;

    const vehicle = db.get<any>('SELECT * FROM vehicles WHERE id = ?', [vehicleId]);
    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    // Build query conditions for fuel
    let fuelSql = 'SELECT * FROM fuel_entries WHERE vehicle_id = ?';
    const fuelParams: any[] = [vehicleId];

    if (startDate) {
      fuelSql += ' AND date >= ?';
      fuelParams.push(startDate);
    }
    if (endDate) {
      fuelSql += ' AND date <= ?';
      fuelParams.push(endDate);
    }
    if (minOdometer !== undefined) {
      fuelSql += ' AND odometer >= ?';
      fuelParams.push(minOdometer);
    }
    if (maxOdometer !== undefined) {
      fuelSql += ' AND odometer <= ?';
      fuelParams.push(maxOdometer);
    }
    fuelSql += ' ORDER BY odometer ASC, date ASC';

    const fuelEntries = db.query<any>(fuelSql, fuelParams);

    // Build query conditions for services
    let serviceSql = 'SELECT * FROM service_records WHERE vehicle_id = ?';
    const serviceParams: any[] = [vehicleId];

    if (startDate) {
      serviceSql += ' AND date >= ?';
      serviceParams.push(startDate);
    }
    if (endDate) {
      serviceSql += ' AND date <= ?';
      serviceParams.push(endDate);
    }
    if (minOdometer !== undefined) {
      serviceSql += ' AND odometer >= ?';
      serviceParams.push(minOdometer);
    }
    if (maxOdometer !== undefined) {
      serviceSql += ' AND odometer <= ?';
      serviceParams.push(maxOdometer);
    }
    serviceSql += ' ORDER BY date ASC';

    const allServiceEntries = db.query<any>(serviceSql, serviceParams);
    // Exclude pre-ownership / previous owner maintenance invoices from TCO calculations
    const serviceEntries = allServiceEntries.filter((s) => !TcoService.isExcludedFromTco(s, vehicle));

    // 1. Calculate Fuel Trends & Economy
    const fuelTrends: FuelTrendPoint[] = [];
    let cumulativeLitersForAvg = 0;
    let cumulativeKmForAvg = 0;
    let totalFuelCost = 0;
    let totalFuelLiters = 0;

    for (let i = 0; i < fuelEntries.length; i++) {
      const current = fuelEntries[i];
      totalFuelCost += current.total_cost;
      totalFuelLiters += current.liters;

      let lPer100Km: number | null = null;
      let kmPerLiter: number | null = null;

      // Only calculate consumption if full tank and didn't miss previous fill-up
      if (i > 0 && current.is_full_tank && !current.missed_previous) {
        const prev = fuelEntries[i - 1];
        const deltaKm = current.odometer - prev.odometer;

        if (deltaKm > 0) {
          lPer100Km = Math.round((current.liters / deltaKm) * 100 * 100) / 100;
          kmPerLiter = Math.round((deltaKm / current.liters) * 100) / 100;

          cumulativeKmForAvg += deltaKm;
          cumulativeLitersForAvg += current.liters;
        }
      }

      const rollingAvg =
        cumulativeKmForAvg > 0
          ? Math.round((cumulativeLitersForAvg / cumulativeKmForAvg) * 100 * 100) / 100
          : null;

      fuelTrends.push({
        date: current.date,
        odometer: current.odometer,
        liters: current.liters,
        pricePerLiter: current.price_per_liter,
        totalCost: current.total_cost,
        lPer100Km,
        kmPerLiter,
        rollingAvgLPer100Km: rollingAvg,
      });
    }

    // 2. Service Spend
    let totalServiceCost = 0;
    let totalUnscheduledCost = 0;
    let totalRegularCost = 0;

    const monthlyMap = new Map<string, { fuel: number; regular: number; unscheduled: number }>();

    for (const f of fuelEntries) {
      const monthKey = f.date.substring(0, 7); // YYYY-MM
      const current = monthlyMap.get(monthKey) || { fuel: 0, regular: 0, unscheduled: 0 };
      current.fuel += f.total_cost;
      monthlyMap.set(monthKey, current);
    }

    for (const s of serviceEntries) {
      totalServiceCost += s.cost;
      const monthKey = s.date.substring(0, 7);
      const current = monthlyMap.get(monthKey) || { fuel: 0, regular: 0, unscheduled: 0 };

      // Identify unscheduled repair vs regular
      const isUnscheduled =
        s.service_item.toLowerCase().includes('repair') ||
        s.service_item.toLowerCase().includes('damage') ||
        s.service_item.toLowerCase().includes('fault');

      if (isUnscheduled) {
        totalUnscheduledCost += s.cost;
        current.unscheduled += s.cost;
      } else {
        totalRegularCost += s.cost;
        current.regular += s.cost;
      }
      monthlyMap.set(monthKey, current);
    }

    // 3. Distance & Time span
    const startOdo =
      minOdometer !== undefined
        ? minOdometer
        : fuelEntries.length > 0
        ? fuelEntries[0].odometer
        : vehicle.initial_odometer || 0;

    const endOdo =
      maxOdometer !== undefined
        ? maxOdometer
        : fuelEntries.length > 0
        ? fuelEntries[fuelEntries.length - 1].odometer
        : vehicle.initial_odometer || 0;

    const totalDistanceKm = Math.max(0, endOdo - startOdo);

    // Compute active months
    const allDates = [...fuelEntries.map((f: any) => f.date), ...serviceEntries.map((s: any) => s.date)].sort();
    let totalMonths = 1;
    if (allDates.length >= 2) {
      const d1 = new Date(allDates[0]);
      const d2 = new Date(allDates[allDates.length - 1]);
      const diffMonths = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
      totalMonths = Math.max(1, diffMonths + 1);
    }

    // 4. Fixed / Recurring Expenses (Wegenbelasting, Verzekering, Abonnementen)
    let recurringExpenses: any[] = [];
    try {
      recurringExpenses = db.query<any>(
        'SELECT * FROM recurring_expenses WHERE vehicle_id = ? AND is_active = 1',
        [vehicleId]
      );
    } catch {
      recurringExpenses = [];
    }

    let monthlyFixedCost = 0;
    for (const exp of recurringExpenses) {
      if (exp.frequency === 'monthly') {
        monthlyFixedCost += exp.amount;
      } else if (exp.frequency === 'quarterly') {
        monthlyFixedCost += exp.amount / 3;
      } else if (exp.frequency === 'yearly') {
        monthlyFixedCost += exp.amount / 12;
      }
    }
    monthlyFixedCost = Math.round(monthlyFixedCost * 100) / 100;
    const fixedExpensesTotal = Math.round(monthlyFixedCost * totalMonths * 100) / 100;

    const monthlyBreakdown: MonthlySpendBreakdown[] = Array.from(monthlyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, val]) => ({
        month,
        fuel: Math.round(val.fuel * 100) / 100,
        regularMaintenance: Math.round(val.regular * 100) / 100,
        unscheduledRepairs: Math.round(val.unscheduled * 100) / 100,
        fixedExpenses: includeFixedExpenses ? monthlyFixedCost : 0,
        total: Math.round((val.fuel + val.regular + val.unscheduled + (includeFixedExpenses ? monthlyFixedCost : 0)) * 100) / 100,
      }));

    // 4. Extended Fuel & Tank Statistics
    const tripMetrics: FuelTripMetric[] = [];
    const tankDistances: number[] = [];
    const stationMap = new Map<string, { totalSpend: number; totalLiters: number; count: number }>();

    const knownBrands = ['Shell', 'BP', 'Esso', 'Total', 'TotalEnergies', 'Texaco', 'Avia', 'Tango', 'TinQ', 'Q8', 'Lukoil', 'Circle K', 'Tamoil', 'Argos', 'Gulf', 'Firezone', 'Makro', 'Fieten', 'Fieten Olie', 'Haan', 'De Haan', 'Amigo', 'Berkman', 'Kuster', 'NXT', 'Sakko', 'SuperTank', 'Tam'];

    for (let i = 0; i < fuelEntries.length; i++) {
      const current = fuelEntries[i];
      let deltaKm: number | null = null;
      let costPer100Km: number | null = null;
      let lPer100Km: number | null = null;

      if (i > 0) {
        const prev = fuelEntries[i - 1];
        const dist = current.odometer - prev.odometer;
        if (dist > 0) {
          deltaKm = dist;
          if (current.is_full_tank && !current.missed_previous) {
            tankDistances.push(dist);
            lPer100Km = Math.round((current.liters / dist) * 100 * 100) / 100;
            costPer100Km = Math.round((current.total_cost / dist) * 100 * 100) / 100;
          }
        }
      }

      // Station detection from notes
      let detectedStation = 'Onbekend / Overig';
      if (current.notes && current.notes.trim()) {
        const noteText = current.notes.trim();
        const found = knownBrands.find((b) => new RegExp(`\\b${b}\\b`, 'i').test(noteText));
        if (found) {
          detectedStation = found;
        } else if (noteText.length <= 30) {
          detectedStation = noteText;
        } else {
          detectedStation = noteText.substring(0, 30) + '...';
        }
      }

      const st = stationMap.get(detectedStation) || { totalSpend: 0, totalLiters: 0, count: 0 };
      st.totalSpend += current.total_cost;
      st.totalLiters += current.liters;
      st.count += 1;
      stationMap.set(detectedStation, st);

      tripMetrics.push({
        date: current.date,
        odometer: current.odometer,
        deltaKm,
        liters: current.liters,
        pricePerLiter: current.price_per_liter,
        totalCost: current.total_cost,
        costPer100Km,
        lPer100Km,
        station: detectedStation,
        is_towing: Boolean(current.is_towing),
      });
    }

    const stations: StationComparison[] = Array.from(stationMap.entries())
      .map(([name, data]) => ({
        name,
        totalSpend: Math.round(data.totalSpend * 100) / 100,
        totalLiters: Math.round(data.totalLiters * 100) / 100,
        avgPricePerLiter: data.totalLiters > 0 ? Math.round((data.totalSpend / data.totalLiters) * 1000) / 1000 : 0,
        fillCount: data.count,
      }))
      .sort((a, b) => b.totalSpend - a.totalSpend);

    const avgDistancePerTank =
      tankDistances.length > 0
        ? Math.round(tankDistances.reduce((acc, val) => acc + val, 0) / tankDistances.length)
        : null;

    const maxDistancePerTank =
      tankDistances.length > 0 ? Math.max(...tankDistances) : null;

    const avgCostPer100Km =
      cumulativeKmForAvg > 0
        ? Math.round((totalFuelCost / cumulativeKmForAvg) * 100 * 100) / 100
        : null;

    const normalLPer100List = tripMetrics
      .filter((m) => !m.is_towing && m.lPer100Km !== null && m.lPer100Km > 0)
      .map((m) => m.lPer100Km as number);
    const towingLPer100List = tripMetrics
      .filter((m) => m.is_towing && m.lPer100Km !== null && m.lPer100Km > 0)
      .map((m) => m.lPer100Km as number);

    const avgNormalLPer100Km =
      normalLPer100List.length > 0
        ? Math.round((normalLPer100List.reduce((a, b) => a + b, 0) / normalLPer100List.length) * 100) / 100
        : null;
    const avgTowingLPer100Km =
      towingLPer100List.length > 0
        ? Math.round((towingLPer100List.reduce((a, b) => a + b, 0) / towingLPer100List.length) * 100) / 100
        : null;

    const fuelStats: FuelDetailedStats = {
      totalFuelLiters: Math.round(totalFuelLiters * 100) / 100,
      avgDistancePerTank,
      maxDistancePerTank,
      avgCostPer100Km,
      avgNormalLPer100Km,
      avgTowingLPer100Km,
      tripMetrics,
      stations,
    };
    // 5. Fuel Price Statistics & Price History
    let minPriceRecord: FuelPriceRecord | null = null;
    let maxPriceRecord: FuelPriceRecord | null = null;
    const priceHistory: FuelPricePoint[] = [];

    for (const current of fuelEntries) {
      if (current.price_per_liter && current.price_per_liter > 0) {
        let stationLabel: string | null = null;
        if (current.notes && current.notes.trim()) {
          const noteText = current.notes.trim();
          const found = knownBrands.find((b) => new RegExp(`\\b${b}\\b`, 'i').test(noteText));
          stationLabel = found || (noteText.length <= 40 ? noteText : noteText.substring(0, 40) + '...');
        }

        const priceRec: FuelPriceRecord = {
          price: current.price_per_liter,
          date: current.date,
          station: stationLabel,
          liters: current.liters,
          odometer: current.odometer,
          totalCost: current.total_cost,
        };

        if (!minPriceRecord || current.price_per_liter < minPriceRecord.price) {
          minPriceRecord = priceRec;
        }
        if (!maxPriceRecord || current.price_per_liter > maxPriceRecord.price) {
          maxPriceRecord = priceRec;
        }

        priceHistory.push({
          date: current.date,
          odometer: current.odometer,
          pricePerLiter: current.price_per_liter,
          liters: current.liters,
          totalCost: current.total_cost,
          station: stationLabel,
        });
      }
    }

    const avgPricePerLiter =
      totalFuelLiters > 0 ? Math.round((totalFuelCost / totalFuelLiters) * 1000) / 1000 : null;

    const priceStats: FuelPriceStats = {
      avgPrice: avgPricePerLiter,
      minPrice: minPriceRecord,
      maxPrice: maxPriceRecord,
      history: priceHistory,
    };



    // 6. Total Cost of Ownership
    const purchasePrice = vehicle.purchase_price || 0;
    const effectiveFixed = includeFixedExpenses ? fixedExpensesTotal : 0;
    const totalCost = Math.round(
      (totalFuelCost + totalServiceCost + effectiveFixed + (includePurchasePrice ? purchasePrice : 0)) * 100
    ) / 100;

    const costPerKm =
      totalDistanceKm > 0 ? Math.round((totalCost / totalDistanceKm) * 100) / 100 : 0;
    const costPerMonth = Math.round((totalCost / totalMonths) * 100) / 100;

    const avgLPer100Km =
      cumulativeKmForAvg > 0
        ? Math.round((cumulativeLitersForAvg / cumulativeKmForAvg) * 100 * 100) / 100
        : null;
    const avgKmPerLiter =
      avgLPer100Km && avgLPer100Km > 0 ? Math.round((100 / avgLPer100Km) * 100) / 100 : null;

    return {
      vehicleId: vehicle.id,
      vehicleName: vehicle.name,
      totalDistanceKm,
      totalMonths,
      fuelTotal: Math.round(totalFuelCost * 100) / 100,
      serviceTotal: Math.round(totalServiceCost * 100) / 100,
      fixedExpensesTotal,
      monthlyFixedCost,
      includeFixedExpenses,
      purchasePrice,
      includePurchasePrice,
      totalCost,
      costPerKm,
      costPerMonth,
      avgLPer100Km,
      avgKmPerLiter,
      avgPricePerLiter,
      fuelTrends,
      monthlyBreakdown,
      fuelStats,
      priceStats,
    };
  }
}

