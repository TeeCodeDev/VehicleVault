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
   * Formats a license plate into official Dutch sidecode format with hyphens (e.g. "GBB-01-B", "NK-956-Z").
   * Supports all 14 official RDW sidecodes.
   */
  public static formatPlate(plate?: string | null): string {
    if (!plate) return '';
    const clean = plate.toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
    if (clean.length !== 6) return plate.trim().toUpperCase();

    if (/^[A-Z]{2}[0-9]{2}[0-9]{2}$/.test(clean)) return `${clean.slice(0, 2)}-${clean.slice(2, 4)}-${clean.slice(4, 6)}`;
    if (/^[0-9]{2}[0-9]{2}[A-Z]{2}$/.test(clean)) return `${clean.slice(0, 2)}-${clean.slice(2, 4)}-${clean.slice(4, 6)}`;
    if (/^[0-9]{2}[A-Z]{2}[0-9]{2}$/.test(clean)) return `${clean.slice(0, 2)}-${clean.slice(2, 4)}-${clean.slice(4, 6)}`;
    if (/^[A-Z]{2}[0-9]{2}[A-Z]{2}$/.test(clean)) return `${clean.slice(0, 2)}-${clean.slice(2, 4)}-${clean.slice(4, 6)}`;
    if (/^[A-Z]{2}[A-Z]{2}[0-9]{2}$/.test(clean)) return `${clean.slice(0, 2)}-${clean.slice(2, 4)}-${clean.slice(4, 6)}`;
    if (/^[0-9]{2}[A-Z]{2}[A-Z]{2}$/.test(clean)) return `${clean.slice(0, 2)}-${clean.slice(2, 4)}-${clean.slice(4, 6)}`;
    if (/^[0-9]{2}[A-Z]{3}[0-9]{1}$/.test(clean)) return `${clean.slice(0, 2)}-${clean.slice(2, 5)}-${clean.slice(5, 6)}`;
    if (/^[0-9]{1}[A-Z]{3}[0-9]{2}$/.test(clean)) return `${clean.slice(0, 1)}-${clean.slice(1, 4)}-${clean.slice(4, 6)}`;
    if (/^[A-Z]{2}[0-9]{3}[A-Z]{1}$/.test(clean)) return `${clean.slice(0, 2)}-${clean.slice(2, 5)}-${clean.slice(5, 6)}`;
    if (/^[A-Z]{1}[0-9]{3}[A-Z]{2}$/.test(clean)) return `${clean.slice(0, 1)}-${clean.slice(1, 4)}-${clean.slice(4, 6)}`;
    if (/^[A-Z]{3}[0-9]{2}[A-Z]{1}$/.test(clean)) return `${clean.slice(0, 3)}-${clean.slice(3, 5)}-${clean.slice(5, 6)}`;
    if (/^[A-Z]{1}[0-9]{2}[A-Z]{3}$/.test(clean)) return `${clean.slice(0, 1)}-${clean.slice(1, 3)}-${clean.slice(3, 6)}`;
    if (/^[0-9]{1}[A-Z]{2}[0-9]{3}$/.test(clean)) return `${clean.slice(0, 1)}-${clean.slice(1, 3)}-${clean.slice(3, 6)}`;
    if (/^[0-9]{3}[A-Z]{2}[0-9]{1}$/.test(clean)) return `${clean.slice(0, 3)}-${clean.slice(3, 5)}-${clean.slice(5, 6)}`;
    return `${clean.slice(0, 2)}-${clean.slice(2, 4)}-${clean.slice(4, 6)}`;
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

      // Fetch fuel and hybrid classification from RDW dataset 8ys7-d773
      let detectedFuel = 'Benzine';
      try {
        const fuelUrl = `https://opendata.rdw.nl/resource/8ys7-d773.json?kenteken=${cleanPlate}`;
        const fuelRes = await fetch(fuelUrl, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'VehicleVault-Tracker/1.0',
          },
        });
        if (fuelRes.ok) {
          const fuelItems = (await fuelRes.json()) as any[];
          if (Array.isArray(fuelItems) && fuelItems.length > 0) {
            const isOvc = fuelItems.some((f) => String(f.klasse_hybride_elektrisch_voertuig || '').toUpperCase().includes('OVC-HEV'));
            const isNovc = fuelItems.some((f) => String(f.klasse_hybride_elektrisch_voertuig || '').toUpperCase().includes('NOVC-HEV'));
            const hasElectric = fuelItems.some((f) => String(f.brandstof_omschrijving || '').toLowerCase().includes('elektr'));
            const hasDiesel = fuelItems.some((f) => String(f.brandstof_omschrijving || '').toLowerCase().includes('diesel'));
            const hasLpg = fuelItems.some((f) => String(f.brandstof_omschrijving || '').toLowerCase().includes('lpg'));
            const hasCng = fuelItems.some((f) => String(f.brandstof_omschrijving || '').toLowerCase().includes('cng'));
            const hasWaterstof = fuelItems.some((f) => String(f.brandstof_omschrijving || '').toLowerCase().includes('waterstof'));

            if (isOvc) {
              detectedFuel = hasDiesel ? 'Plug-in Hybride (Diesel)' : 'Plug-in Hybride (Benzine)';
            } else if (isNovc || (hasElectric && fuelItems.length > 1)) {
              detectedFuel = hasDiesel ? 'Hybride (Diesel)' : 'Hybride (Benzine)';
            } else if (hasElectric && fuelItems.length === 1) {
              detectedFuel = 'Elektrisch';
            } else if (hasDiesel) {
              detectedFuel = 'Diesel';
            } else if (hasLpg) {
              detectedFuel = 'LPG';
            } else if (hasCng) {
              detectedFuel = 'CNG';
            } else if (hasWaterstof) {
              detectedFuel = 'Waterstof';
            } else {
              const primary = fuelItems[0]?.brandstof_omschrijving;
              detectedFuel = primary ? primary.charAt(0).toUpperCase() + primary.slice(1).toLowerCase() : 'Benzine';
            }
          }
        }
      } catch (err) {
        console.warn('Could not fetch RDW fuel dataset for plate:', cleanPlate, err);
      }

      return {
        kenteken: cleanPlate,
        voertuigsoort: item.voertuigsoort,
        merk: item.merk,
        handelsbenaming: item.handelsbenaming,
        inrichting: item.inrichting,
        massa_rijklaar: item.massa_rijklaar,
        datum_eerste_toelating: formatRdwDate(item.datum_eerste_toelating),
        vervaldatum_apk: apkFormatted,
        brandstof_omschrijving: detectedFuel,
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

