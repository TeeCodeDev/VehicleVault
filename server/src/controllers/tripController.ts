import { Request, Response } from 'express';
import crypto from 'node:crypto';
import { db } from '../db/database.js';

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

      const id = crypto.randomUUID();
      const userId = req.user?.userId || '00000000-0000-0000-0000-000000000001';
      const now = new Date().toISOString();

      db.run(
        `INSERT INTO trips (
          id, vehicle_id, user_id, date, start_odometer, end_odometer, distance_km,
          from_location, to_location, purpose, description, is_return_trip, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          vehicleId,
          userId,
          date,
          start,
          end,
          dist,
          fromLocation.trim(),
          toLocation.trim(),
          purpose,
          description?.trim() || null,
          isReturnTrip ? 1 : 0,
          now,
        ]
      );

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
}

