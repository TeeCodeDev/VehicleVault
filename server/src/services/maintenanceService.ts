import { db } from '../db/database.js';

export interface IntervalStatus {
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
  status: 'good' | 'warning' | 'overdue'; // green, amber, red
  triggerReason: 'distance' | 'time' | 'none';
}

export class MaintenanceService {
  /**
   * Evaluates the dual-trigger interval status for all maintenance items of a vehicle.
   */
  public static getVehicleMaintenanceStatus(vehicleId: string): IntervalStatus[] {
    // Get vehicle initial odometer and highest odometer across fuel & service records
    const vehicle = db.get<{ initial_odometer: number }>(
      'SELECT initial_odometer FROM vehicles WHERE id = ?',
      [vehicleId]
    );

    const maxFuel = db.get<{ max_odo: number | null }>(
      'SELECT MAX(odometer) as max_odo FROM fuel_entries WHERE vehicle_id = ?',
      [vehicleId]
    );
    const maxService = db.get<{ max_odo: number | null }>(
      'SELECT MAX(odometer) as max_odo FROM service_records WHERE vehicle_id = ?',
      [vehicleId]
    );

    const currentOdometer = Math.max(
      vehicle?.initial_odometer || 0,
      maxFuel?.max_odo || 0,
      maxService?.max_odo || 0
    );

    const intervals = db.query<any>(
      `SELECT m.*, c.name as category_name
       FROM maintenance_intervals m
       JOIN service_categories c ON c.id = m.category_id
       WHERE m.vehicle_id = ?
       ORDER BY c.name ASC`,
      [vehicleId]
    );

    const now = new Date();

    return intervals.map((interval) => {
      let kmPercent = 0;
      let timePercent = 0;
      let kmRemaining: number | null = null;
      let daysRemaining: number | null = null;

      // Distance calculation
      if (interval.interval_km && interval.interval_km > 0) {
        const lastKm = interval.last_service_odometer ?? (vehicle?.initial_odometer || 0);
        const kmDriven = Math.max(0, currentOdometer - lastKm);
        kmPercent = (kmDriven / interval.interval_km) * 100;
        kmRemaining = interval.interval_km - kmDriven;
      }

      // Time calculation
      if (interval.interval_months && interval.interval_months > 0) {
        const lastDate = interval.last_service_date ? new Date(interval.last_service_date) : null;
        if (lastDate) {
          const diffMs = now.getTime() - lastDate.getTime();
          const daysPassed = Math.max(0, diffMs / (1000 * 60 * 60 * 24));
          const totalDaysInterval = interval.interval_months * 30.44;
          timePercent = (daysPassed / totalDaysInterval) * 100;
          daysRemaining = Math.round(totalDaysInterval - daysPassed);
        }
      }

      // Dual-trigger rule: "Whichever comes first" -> pick max %
      const percentUsed = Math.round(Math.max(kmPercent, timePercent));
      let triggerReason: 'distance' | 'time' | 'none' = 'none';
      if (kmPercent >= timePercent && kmPercent > 0) {
        triggerReason = 'distance';
      } else if (timePercent > kmPercent && timePercent > 0) {
        triggerReason = 'time';
      }

      let status: 'good' | 'warning' | 'overdue' = 'good';
      if (percentUsed >= 100) {
        status = 'overdue';
      } else if (percentUsed >= 90) {
        status = 'warning';
      }

      return {
        id: interval.id,
        vehicleId: interval.vehicle_id,
        categoryId: interval.category_id,
        categoryName: interval.category_name,
        customName: interval.custom_name,
        intervalKm: interval.interval_km,
        intervalMonths: interval.interval_months,
        lastServiceDate: interval.last_service_date,
        lastServiceOdometer: interval.last_service_odometer,
        currentOdometer,
        kmRemaining,
        daysRemaining,
        percentUsed,
        status,
        triggerReason,
      };
    });
  }

  /**
   * Retrieves all overdue or upcoming maintenance alerts fleet-wide.
   */
  public static getAllFleetMaintenanceAlerts(userId: string): any[] {
    const vehicles = db.query<any>(
      `SELECT id, name, license_plate FROM vehicles WHERE user_id = ? AND status = 'active'`,
      [userId]
    );

    const alerts: any[] = [];
    for (const v of vehicles) {
      const items = this.getVehicleMaintenanceStatus(v.id);
      for (const item of items) {
        if (item.status === 'warning' || item.status === 'overdue') {
          alerts.push({
            vehicleId: v.id,
            vehicleName: v.name,
            licensePlate: v.license_plate,
            categoryName: item.customName || item.categoryName,
            status: item.status,
            percentUsed: item.percentUsed,
            kmRemaining: item.kmRemaining,
            daysRemaining: item.daysRemaining,
            triggerReason: item.triggerReason,
          });
        }
      }
    }
    return alerts;
  }
}

