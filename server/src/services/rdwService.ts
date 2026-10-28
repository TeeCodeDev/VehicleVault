import { db } from '../db/database.js';

export interface RdwVehicleData {
  kenteken: string;
  voertuigsoort?: string;
  merk?: string;
  handelsbenaming?: string;
  inrichting?: string;
  massa_rijklaar?: string;
  datum_eerste_toelating?: string;
  vervaldatum_apk?: string;
  brandstof_omschrijving?: string;
  raw?: any;
}

export class RdwService {
  /**
   * Cleans license plate string (removes dashes, spaces, uppercased).
   */
  public static normalizePlate(plate: string): string {
    return plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  }

  /**
   * Fetches official Netherlands vehicle data from RDW Open Data.
   */
  public static async fetchVehicleByPlate(plate: string): Promise<RdwVehicleData | null> {
    const cleanPlate = this.normalizePlate(plate);
    if (!cleanPlate) return null;

    try {
      const url = `https://opendata.rdw.nl/resource/m9d7-ebf2.json?kenteken=${cleanPlate}`;
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'VehicleVault-Tracker/1.0',
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as any[];
      if (!data || data.length === 0) {
        return null;
      }

      const item = data[0];

      // Convert RDW YYYYMMDD date format into YYYY-MM-DD
      const formatRdwDate = (val?: string): string | undefined => {
        if (!val || val.length !== 8) return undefined;
        return `${val.substring(0, 4)}-${val.substring(4, 6)}-${val.substring(6, 8)}`;
      };

      const apkFormatted = formatRdwDate(item.vervaldatum_apk);

      return {
        kenteken: cleanPlate,
        voertuigsoort: item.voertuigsoort,
        merk: item.merk,
        handelsbenaming: item.handelsbenaming,
        inrichting: item.inrichting,
        massa_rijklaar: item.massa_rijklaar,
        datum_eerste_toelating: formatRdwDate(item.datum_eerste_toelating),
        vervaldatum_apk: apkFormatted,
        raw: item,
      };
    } catch (err) {
      console.error('Error fetching RDW data:', err);
      return null;
    }
  }

  /**
   * Calculate days remaining until APK expiration and alert status.
   */
  public static evaluateApkStatus(apkDateString: string | null | undefined): {
    daysRemaining: number | null;
    isOverdue: boolean;
    isDueSoon: boolean; // within 30 days
  } {
    if (!apkDateString) {
      return { daysRemaining: null, isOverdue: false, isDueSoon: false };
    }

    const apkDate = new Date(apkDateString);
    const now = new Date();
    // Normalize to midnight UTC
    const diffTime = apkDate.getTime() - now.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return {
      daysRemaining,
      isOverdue: daysRemaining < 0,
      isDueSoon: daysRemaining >= 0 && daysRemaining <= 30,
    };
  }

  /**
   * Synchronize all active vehicles with license plates.
   */
  public static async syncAllVehiclesApk(): Promise<{ updatedCount: number; alerts: any[] }> {
    const vehicles = db.query<any>(
      `SELECT id, name, license_plate, apk_expiration_date FROM vehicles WHERE status = 'active' AND license_plate IS NOT NULL`
    );

    let updatedCount = 0;
    const alerts: any[] = [];

    for (const v of vehicles) {
      if (!v.license_plate) continue;
      const rdw = await this.fetchVehicleByPlate(v.license_plate);
      if (rdw && rdw.vervaldatum_apk) {
        db.run(
          `UPDATE vehicles 
           SET apk_expiration_date = ?, rdw_data = ?, updated_at = ?
           WHERE id = ?`,
          [rdw.vervaldatum_apk, JSON.stringify(rdw.raw), new Date().toISOString(), v.id]
        );
        updatedCount++;

        const status = this.evaluateApkStatus(rdw.vervaldatum_apk);
        if (status.isDueSoon || status.isOverdue) {
          alerts.push({
            vehicleId: v.id,
            vehicleName: v.name,
            licensePlate: v.license_plate,
            apkDate: rdw.vervaldatum_apk,
            daysRemaining: status.daysRemaining,
            isOverdue: status.isOverdue,
          });
        }
      }
    }

    return { updatedCount, alerts };
  }
}

