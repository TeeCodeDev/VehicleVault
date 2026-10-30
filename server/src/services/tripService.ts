import crypto from 'node:crypto';
import { db } from '../db/database.js';

export type TripPurpose = 'business' | 'commute' | 'private';

export interface NewTrip {
  vehicleId: string;
  userId: string;
  date: string;
  startOdometer: number;
  endOdometer: number;
  distanceKm: number;
  fromLocation: string;
  toLocation: string;
  purpose: TripPurpose | string;
  description?: string | null;
  isReturnTrip?: boolean;
}

export class TripService {
  /** The one place a trip row is written, shared by the trip form and the import. */
  public static insert(trip: NewTrip): string {
    const id = crypto.randomUUID();
    db.run(
      `INSERT INTO trips (
        id, vehicle_id, user_id, date, start_odometer, end_odometer, distance_km,
        from_location, to_location, purpose, description, is_return_trip, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        trip.vehicleId,
        trip.userId,
        trip.date,
        trip.startOdometer,
        trip.endOdometer,
        trip.distanceKm,
        trip.fromLocation.trim(),
        trip.toLocation.trim(),
        trip.purpose,
        trip.description?.trim() || null,
        trip.isReturnTrip ? 1 : 0,
        new Date().toISOString(),
      ]
    );
    return id;
  }

  public static exists(vehicleId: string, date: string, startOdometer: number, endOdometer: number): boolean {
    return !!db.get(
      'SELECT id FROM trips WHERE vehicle_id = ? AND date = ? AND start_odometer = ? AND end_odometer = ?',
      [vehicleId, date, startOdometer, endOdometer]
    );
  }
}
