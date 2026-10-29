import { db } from '../db/database.js';

export interface VehicleAccessResult {
  hasAccess: boolean;
  isOwner: boolean;
  role: 'owner' | 'editor' | 'viewer' | null;
  vehicle: any | null;
}

/**
 * Checks whether the given user is either the owner of the vehicle or has
 * explicitly been granted access via the vehicle_shares table.
 */
export function getVehicleAccess(vehicleId: string, userId?: string | null): VehicleAccessResult {
  if (!userId) {
    return { hasAccess: false, isOwner: false, role: null, vehicle: null };
  }

  const vehicle = db.get<any>('SELECT * FROM vehicles WHERE id = ?', [vehicleId]);
  if (!vehicle) {
    return { hasAccess: false, isOwner: false, role: null, vehicle: null };
  }

  // 1. Owner check
  if (vehicle.user_id === userId) {
    return { hasAccess: true, isOwner: true, role: 'owner', vehicle };
  }

  // 2. Shared vehicle check
  const share = db.get<{ role: string }>(
    'SELECT role FROM vehicle_shares WHERE vehicle_id = ? AND user_id = ?',
    [vehicleId, userId]
  );

  if (share) {
    return {
      hasAccess: true,
      isOwner: false,
      role: (share.role as 'editor' | 'viewer') || 'editor',
      vehicle,
    };
  }

  return { hasAccess: false, isOwner: false, role: null, vehicle };
}
