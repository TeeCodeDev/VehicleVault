import { Request, Response } from 'express';
import crypto from 'node:crypto';
import { db } from '../db/database.js';
import { TripExportService } from '../services/tripExportService.js';
import { TripService } from '../services/tripService.js';
import { TripImportService, TripImportError, TripColumnMapping } from '../services/tripImportService.js';
import { getVehicleAccess } from '../utils/vehicleAccess.js';

export class TripController {
  public static async list(req: Request, res: Response): Promise<void> {
    try {
      const { vehicleId, year, purpose } = req.query;
      if (!vehicleId || typeof vehicleId !== 'string') {
        res.status(400).json({ error: 'vehicleId query parameter is required' });
        return;
      }

      let query = 'SELECT * FROM trips WHERE vehicle_id = ?';
      const params: any[] = [vehicleId];

      if (year && typeof year === 'string') {
        query += " AND strftime('%Y', date) = ?";
        params.push(year);
      }

      if (purpose && typeof purpose === 'string') {
        query += ' AND purpose = ?';
        params.push(purpose);
      }

      query += ' ORDER BY date DESC, start_odometer DESC, created_at DESC';
      const trips = db.query(query, params);

      // Compute statistics summary
      let totalDistance = 0;
      let businessDistance = 0;
      let commuteDistance = 0;
      let privateDistance = 0;

      for (const t of trips) {
        const dist = Number(t.distance_km) || 0;
        totalDistance += dist;
        if (t.purpose === 'business') businessDistance += dist;
        else if (t.purpose === 'commute') commuteDistance += dist;
        else if (t.purpose === 'private') privateDistance += dist;
      }

      res.json({
        trips,
        summary: {
          totalTrips: trips.length,
          totalDistance: Math.round(totalDistance * 10) / 10,
          businessDistance: Math.round(businessDistance * 10) / 10,
          commuteDistance: Math.round(commuteDistance * 10) / 10,
          privateDistance: Math.round(privateDistance * 10) / 10,
          businessPercentage: totalDistance > 0 ? Math.round(((businessDistance + commuteDistance) / totalDistance) * 100) : 0,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to list trips' });
    }
  }

  public static async create(req: Request, res: Response): Promise<void> {
    try {
      const {
        vehicleId,
        date,
        startOdometer,
        endOdometer,
        distanceKm,
        fromLocation,
        toLocation,
        purpose = 'business',
        description = '',
        isReturnTrip = false,
      } = req.body;

      if (!vehicleId || !date || startOdometer === undefined || endOdometer === undefined || !fromLocation || !toLocation) {
        res.status(400).json({ error: 'vehicleId, date, startOdometer, endOdometer, fromLocation, and toLocation are required' });
        return;
      }

      const start = Number(startOdometer);
      const end = Number(endOdometer);
      const dist = distanceKm !== undefined ? Number(distanceKm) : Math.max(0, Math.round((end - start) * 10) / 10);

      const userId = req.user?.userId || '00000000-0000-0000-0000-000000000001';
      const id = TripService.insert({
        vehicleId,
        userId,
        date,
        startOdometer: start,
        endOdometer: end,
        distanceKm: dist,
        fromLocation,
        toLocation,
        purpose,
        description,
        isReturnTrip,
      });

      // Optionally update vehicle's current odometer if endOdometer is higher
      const vehicle = db.get<{ initial_odometer: number }>('SELECT initial_odometer FROM vehicles WHERE id = ?', [vehicleId]);
      if (vehicle) {
        const latestMax = db.get<{ maxOdo: number }>(
          `SELECT MAX(odo) as maxOdo FROM (
            SELECT MAX(end_odometer) as odo FROM trips WHERE vehicle_id = ?
            UNION ALL
            SELECT MAX(odometer) as odo FROM fuel_entries WHERE vehicle_id = ?
            UNION ALL
            SELECT MAX(odometer) as odo FROM service_records WHERE vehicle_id = ?
          )`,
          [vehicleId, vehicleId, vehicleId]
        )?.maxOdo;

        if (latestMax && latestMax > (vehicle.initial_odometer || 0)) {
          // Keep database in sync
        }
      }

      const created = db.get('SELECT * FROM trips WHERE id = ?', [id]);
      res.status(201).json({ trip: created });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to create trip record' });
    }
  }

  public static async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const {
        date,
        startOdometer,
        endOdometer,
        distanceKm,
        fromLocation,
        toLocation,
        purpose,
        description,
        isReturnTrip,
      } = req.body;

      const existing = db.get('SELECT * FROM trips WHERE id = ?', [id]);
      if (!existing) {
        res.status(404).json({ error: 'Trip not found' });
        return;
      }

      const start = startOdometer !== undefined ? Number(startOdometer) : existing.start_odometer;
      const end = endOdometer !== undefined ? Number(endOdometer) : existing.end_odometer;
      const dist = distanceKm !== undefined ? Number(distanceKm) : Math.max(0, Math.round((end - start) * 10) / 10);

      db.run(
        `UPDATE trips SET
          date = COALESCE(?, date),
          start_odometer = ?,
          end_odometer = ?,
          distance_km = ?,
          from_location = COALESCE(?, from_location),
          to_location = COALESCE(?, to_location),
          purpose = COALESCE(?, purpose),
          description = COALESCE(?, description),
          is_return_trip = COALESCE(?, is_return_trip)
        WHERE id = ?`,
        [
          date ?? null,
          start,
          end,
          dist,
          fromLocation !== undefined ? fromLocation.trim() : null,
          toLocation !== undefined ? toLocation.trim() : null,
          purpose ?? null,
          description !== undefined ? description.trim() : null,
          isReturnTrip !== undefined ? (isReturnTrip ? 1 : 0) : null,
          id,
        ]
      );

      const updated = db.get('SELECT * FROM trips WHERE id = ?', [id]);
      res.json({ trip: updated });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to update trip' });
    }
  }

  public static async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = db.run('DELETE FROM trips WHERE id = ?', [id]);
      if (result.changes === 0) {
        res.status(404).json({ error: 'Trip not found' });
        return;
      }
      res.json({ message: 'Trip deleted' });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to delete trip' });
    }
  }

  /** The caller may add trips to this vehicle (owner or editor); answers the request itself when not. */
  private static canEditVehicle(req: Request, res: Response, vehicleId: unknown): vehicleId is string {
    if (!vehicleId || typeof vehicleId !== 'string') {
      res.status(400).json({ error: 'vehicleId is verplicht' });
      return false;
    }
    const access = getVehicleAccess(vehicleId, req.user?.userId);
    if ((!access.hasAccess || access.role === 'viewer') && req.user?.role !== 'admin') {
      res.status(access.hasAccess ? 403 : 404).json({
        error: access.hasAccess ? 'Geen bewerkrechten voor dit voertuig' : 'Voertuig niet gevonden',
      });
      return false;
    }
    return true;
  }

  public static async importPreview(req: Request, res: Response): Promise<void> {
    try {
      const { vehicleId, defaultPurpose, mapping } = req.body;
      if (!req.file) {
        res.status(400).json({ error: 'Kies een .csv- of .xlsx-bestand' });
        return;
      }
      if (!TripController.canEditVehicle(req, res, vehicleId)) return;

      let parsedMapping: TripColumnMapping | undefined;
      if (mapping) {
        try {
          parsedMapping = typeof mapping === 'string' ? JSON.parse(mapping) : mapping;
        } catch {
          res.status(400).json({ error: 'Ongeldige kolomkoppeling' });
          return;
        }
      }

      const plate = db.get<{ license_plate: string | null }>('SELECT license_plate FROM vehicles WHERE id = ?', [vehicleId])?.license_plate;
      const preview = await TripImportService.preview(req.file.buffer, vehicleId, {
        mapping: parsedMapping,
        defaultPurpose: ['business', 'commute', 'private'].includes(defaultPurpose) ? defaultPurpose : undefined,
        vehiclePlate: plate,
      });
      res.json(preview);
    } catch (err: any) {
      if (err instanceof TripImportError) {
        res.status(400).json({ error: err.message });
        return;
      }
      console.error('Trip import preview failed:', err);
      res.status(500).json({ error: 'Het bestand kon niet worden gelezen' });
    }
  }

  public static async importExecute(req: Request, res: Response): Promise<void> {
    try {
      const { vehicleId, records, skipDuplicates } = req.body;
      if (!Array.isArray(records) || records.length === 0) {
        res.status(400).json({ error: 'Geen ritten om te importeren' });
        return;
      }
      if (records.length > 5000) {
        res.status(400).json({ error: 'Maximaal 5000 ritten per import' });
        return;
      }
      if (!TripController.canEditVehicle(req, res, vehicleId)) return;

      const userId = req.user?.userId || '00000000-0000-0000-0000-000000000001';
      const result = TripImportService.execute(vehicleId, userId, records, skipDuplicates !== false);
      res.json({ success: true, ...result });
    } catch (err: any) {
      console.error('Trip import failed:', err);
      res.status(500).json({ error: 'Importeren mislukt; er is niets opgeslagen' });
    }
  }

  public static async exportCsv(req: Request, res: Response): Promise<void> {
    try {
      const { vehicleId, year } = req.query;
      if (!vehicleId || typeof vehicleId !== 'string') {
        res.status(400).json({ error: 'vehicleId query parameter is required' });
        return;
      }

      const vehicle = db.get<{ name: string; license_plate: string }>(
        'SELECT name, license_plate FROM vehicles WHERE id = ?',
        [vehicleId]
      );

      let query = 'SELECT * FROM trips WHERE vehicle_id = ?';
      const params: any[] = [vehicleId];
      if (year && typeof year === 'string') {
        query += " AND strftime('%Y', date) = ?";
        params.push(year);
      }
      query += ' ORDER BY date ASC, start_odometer ASC';

      const trips = db.query(query, params);

      // Build Belastingdienst compliant CSV (semicolon separated with UTF-8 BOM)
      const header = 'Datum;Vertrekadres;Aankomstadres;Beginstand (km);Eindstand (km);Afstand (km);Karakter rit;Toelichting/Omschrijving;Terugrit\r\n';
      const rows = trips.map((t) => {
        const purposeLabel = t.purpose === 'business' ? 'Zakelijk' : t.purpose === 'commute' ? 'Woon-werk' : 'Prive';
        const desc = (t.description || '').replace(/"/g, '""');
        const fromLoc = (t.from_location || '').replace(/"/g, '""');
        const toLoc = (t.to_location || '').replace(/"/g, '""');
        const returnLabel = t.is_return_trip ? 'Ja' : 'Nee';
        return `"${t.date}";"${fromLoc}";"${toLoc}";${t.start_odometer};${t.end_odometer};${t.distance_km};"${purposeLabel}";"${desc}";"${returnLabel}"`;
      });

      const csvContent = '\uFEFF' + header + rows.join('\r\n');
      const plate = vehicle?.license_plate || 'ritten';
      const yearStr = year || 'compleet';
      const filename = `Rittenregistratie_${plate}_${yearStr}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csvContent);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to export trips CSV' });
    }
  }

  public static async exportExcel(req: Request, res: Response): Promise<void> {
    try {
      const { vehicleId, year } = req.query;
      if (!vehicleId || typeof vehicleId !== 'string') {
        res.status(400).json({ error: 'vehicleId query parameter is required' });
        return;
      }

      const vehicle = db.get<any>(
        'SELECT * FROM vehicles WHERE id = ?',
        [vehicleId]
      );
      if (!vehicle) {
        res.status(404).json({ error: 'Vehicle not found' });
        return;
      }

      let query = 'SELECT * FROM trips WHERE vehicle_id = ?';
      const params: any[] = [vehicleId];
      if (year && typeof year === 'string') {
        query += " AND strftime('%Y', date) = ?";
        params.push(year);
      }
      query += ' ORDER BY date ASC, start_odometer ASC';

      const trips = db.query<any>(query, params);
      const buffer = await TripExportService.generateExcel(vehicle, trips, year as string | undefined);

      const plate = vehicle.license_plate ? vehicle.license_plate.replace(/[^a-zA-Z0-9]/g, '_') : 'ritten';
      const yearStr = year || 'compleet';
      const filename = `Rittenregistratie_${plate}_${yearStr}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to export trips Excel' });
    }
  }

  public static async exportPdf(req: Request, res: Response): Promise<void> {
    try {
      const { vehicleId, year } = req.query;
      if (!vehicleId || typeof vehicleId !== 'string') {
        res.status(400).json({ error: 'vehicleId query parameter is required' });
        return;
      }

      const vehicle = db.get<any>(
        'SELECT * FROM vehicles WHERE id = ?',
        [vehicleId]
      );
      if (!vehicle) {
        res.status(404).json({ error: 'Vehicle not found' });
        return;
      }

      let query = 'SELECT * FROM trips WHERE vehicle_id = ?';
      const params: any[] = [vehicleId];
      if (year && typeof year === 'string') {
        query += " AND strftime('%Y', date) = ?";
        params.push(year);
      }
      query += ' ORDER BY date ASC, start_odometer ASC';

      const trips = db.query<any>(query, params);
      const buffer = await TripExportService.generatePdf(vehicle, trips, year as string | undefined);

      const plate = vehicle.license_plate ? vehicle.license_plate.replace(/[^a-zA-Z0-9]/g, '_') : 'ritten';
      const yearStr = year || 'compleet';
      const filename = `Rittenregistratie_${plate}_${yearStr}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to export trips PDF' });
    }
  }
}

