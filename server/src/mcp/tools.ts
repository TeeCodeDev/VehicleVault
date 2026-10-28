import crypto from 'node:crypto';
import { db } from '../db/database.js';
import { MaintenanceService } from '../services/maintenanceService.js';
import { TcoService } from '../services/tcoService.js';

export const MCP_TOOL_DEFINITIONS = [
  {
    name: 'list_vehicles',
    description: 'Retrieve all active vehicles, metadata, current odometers, and APK expiration dates.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['active', 'archived', 'all'],
          description: 'Filter by vehicle status (default: active)',
        },
      },
    },
  },
  {
    name: 'get_vehicle_summary',
    description: 'Get detailed statistics for a vehicle (average consumption, total spend, upcoming maintenance alerts).',
    inputSchema: {
      type: 'object',
      properties: {
        vehicle_id: {
          type: 'string',
          description: 'The unique UUID of the vehicle',
        },
        include_purchase_price: {
          type: 'boolean',
          description: 'Whether to include initial purchase price in TCO spend (default: false)',
        },
      },
      required: ['vehicle_id'],
    },
  },
  {
    name: 'log_fuel_entry',
    description: 'Record a new fuel fill-up for a vehicle.',
    inputSchema: {
      type: 'object',
      properties: {
        vehicle_id: { type: 'string', description: 'Vehicle UUID' },
        odometer: { type: 'number', description: 'Current odometer in KM' },
        liters: { type: 'number', description: 'Liters filled' },
        price_per_liter: { type: 'number', description: 'Price per liter in EUR' },
        is_full_tank: { type: 'boolean', description: 'True if filled to full tank' },
        missed_previous: { type: 'boolean', description: 'True if previous fill-up was missed' },
        date: { type: 'string', description: 'Fill-up date (YYYY-MM-DD), defaults to today' },
        notes: { type: 'string', description: 'Optional notes or fuel station info' },
      },
      required: ['vehicle_id', 'odometer', 'liters', 'price_per_liter'],
    },
  },
  {
    name: 'log_service_entry',
    description: 'Record a completed service or maintenance event for a vehicle.',
    inputSchema: {
      type: 'object',
      properties: {
        vehicle_id: { type: 'string', description: 'Vehicle UUID' },
        service_item: { type: 'string', description: 'Name of the service (e.g. Engine Oil, Brake Pads)' },
        odometer: { type: 'number', description: 'Odometer at service in KM' },
        cost: { type: 'number', description: 'Cost of service in EUR' },
        date: { type: 'string', description: 'Service date (YYYY-MM-DD), defaults to today' },
        performing_party: { type: 'string', enum: ['self', 'garage'], description: 'Who did the work' },
        notes: { type: 'string', description: 'Detailed technician or parts notes' },
      },
      required: ['vehicle_id', 'service_item', 'odometer', 'cost'],
    },
  },
  {
    name: 'check_maintenance_alerts',
    description: 'List all overdue or upcoming maintenance items and APK expiration alerts across the fleet.',
    inputSchema: {
      type: 'object',
      properties: {
        vehicle_id: {
          type: 'string',
          description: 'Optional vehicle ID filter; omits to check entire fleet',
        },
      },
    },
  },
];

export async function executeMcpTool(name: string, args: any, userId?: string): Promise<any> {
  switch (name) {
    case 'list_vehicles': {
      const statusFilter = args.status === 'all' ? '%' : args.status || 'active';
      let sql = `SELECT v.*, 
                 MAX(COALESCE(f.max_f, 0), COALESCE(s.max_s, 0), v.initial_odometer) as current_odometer
                 FROM vehicles v
                 LEFT JOIN (SELECT vehicle_id, MAX(odometer) as max_f FROM fuel_entries GROUP BY vehicle_id) f ON f.vehicle_id = v.id
                 LEFT JOIN (SELECT vehicle_id, MAX(odometer) as max_s FROM service_records GROUP BY vehicle_id) s ON s.vehicle_id = v.id
                 WHERE v.status LIKE ?`;
      const params: any[] = [statusFilter];
      if (userId) {
        sql += ' AND v.user_id = ?';
        params.push(userId);
      }
      sql += ' GROUP BY v.id ORDER BY v.name ASC';

      const vehicles = db.query(sql, params);
      return { vehicles };
    }

    case 'get_vehicle_summary': {
      const { vehicle_id, include_purchase_price = false } = args;
      const vehicle = db.get('SELECT * FROM vehicles WHERE id = ?', [vehicle_id]);
      if (!vehicle) {
        throw new Error(`Vehicle not found for ID ${vehicle_id}`);
      }

      const tco = TcoService.calculateTco({
        vehicleId: vehicle_id,
        includePurchasePrice: include_purchase_price,
      });

      const maintenance = MaintenanceService.getVehicleMaintenanceStatus(vehicle_id);
      const upcomingAlerts = maintenance.filter((m) => m.status === 'warning' || m.status === 'overdue');

      return {
        vehicle: {
          id: vehicle.id,
          name: vehicle.name,
          licensePlate: vehicle.license_plate,
          type: vehicle.type,
          vin: vehicle.vin,
          apkExpiration: vehicle.apk_expiration_date,
        },
        tco: {
          totalCost: tco.totalCost,
          fuelSpend: tco.fuelTotal,
          serviceSpend: tco.serviceTotal,
          costPerKm: tco.costPerKm,
          costPerMonth: tco.costPerMonth,
          avgLPer100Km: tco.avgLPer100Km,
          avgKmPerLiter: tco.avgKmPerLiter,
        },
        upcomingMaintenanceAlerts: upcomingAlerts,
      };
    }

    case 'log_fuel_entry': {
      const { vehicle_id, odometer, liters, price_per_liter, is_full_tank = true, missed_previous = false, date, notes } = args;
      const entryId = crypto.randomUUID();
      const entryDate = date || new Date().toISOString().split('T')[0];
      const totalCost = Math.round(liters * price_per_liter * 100) / 100;

      db.run(
        `INSERT INTO fuel_entries (id, vehicle_id, date, odometer, liters, price_per_liter, total_cost, is_full_tank, missed_previous, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [entryId, vehicle_id, entryDate, odometer, liters, price_per_liter, totalCost, is_full_tank ? 1 : 0, missed_previous ? 1 : 0, notes || null, new Date().toISOString()]
      );

      return {
        success: true,
        id: entryId,
        message: `Successfully logged ${liters}L fuel entry at ${odometer} km (€${totalCost}).`,
      };
    }

    case 'log_service_entry': {
      const { vehicle_id, service_item, odometer, cost, date, performing_party = 'self', notes } = args;
      const entryId = crypto.randomUUID();
      const serviceDate = date || new Date().toISOString().split('T')[0];

      db.run(
        `INSERT INTO service_records (id, vehicle_id, service_item, date, odometer, performing_party, cost, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [entryId, vehicle_id, service_item, serviceDate, odometer, performing_party, cost, notes || null, new Date().toISOString()]
      );

      // Also update any matching maintenance interval if applicable
      const matchingInterval = db.get<any>(
        `SELECT m.id FROM maintenance_intervals m
         JOIN service_categories c ON c.id = m.category_id
         WHERE m.vehicle_id = ? AND (LOWER(c.name) = LOWER(?) OR LOWER(m.custom_name) = LOWER(?))`,
        [vehicle_id, service_item, service_item]
      );

      if (matchingInterval) {
        db.run(
          `UPDATE maintenance_intervals 
           SET last_service_date = ?, last_service_odometer = ?
           WHERE id = ?`,
          [serviceDate, odometer, matchingInterval.id]
        );
      }

      return {
        success: true,
        id: entryId,
        message: `Successfully logged service "${service_item}" at ${odometer} km (€${cost}).`,
      };
    }

    case 'check_maintenance_alerts': {
      const { vehicle_id } = args;
      let alerts: any[] = [];

      if (vehicle_id) {
        const items = MaintenanceService.getVehicleMaintenanceStatus(vehicle_id);
        alerts = items
          .filter((i) => i.status === 'warning' || i.status === 'overdue')
          .map((i) => ({
            vehicleId: vehicle_id,
            categoryName: i.customName || i.categoryName,
            status: i.status,
            percentUsed: i.percentUsed,
            kmRemaining: i.kmRemaining,
            daysRemaining: i.daysRemaining,
            triggerReason: i.triggerReason,
          }));
      } else {
        const vehicles = db.query<any>('SELECT id, name, license_plate FROM vehicles WHERE status = "active"');
        for (const v of vehicles) {
          const items = MaintenanceService.getVehicleMaintenanceStatus(v.id);
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
      }

      return { count: alerts.length, alerts };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

