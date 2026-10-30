/**
 * Dynamic inspection terms helper for VehicleVault.
 * Automatically adapts technical inspection terminology depending on the vehicle's
 * registered country (NL -> APK, BE -> Autokeuring, DE -> TÜV / HU, UK/Intl -> MOT / Inspection).
 */

export interface InspectionTerm {
  short: string;        // "APK", "Autokeuring", "TÜV", "MOT"
  full: string;         // "Algemene Periodieke Keuring (APK)", "Periodieke Autokeuring", etc.
  dateLabel: string;    // "APK Vervaldatum", "Keuringsdatum", "TÜV Vervaldatum", etc.
  dueSoon: string;      // "APK Verloopt Binnenkort", "Keuring Binnenkort", etc.
  overdue: string;      // "APK Verlopen!", "Keuring Verlopen!", etc.
  valid: string;        // "APK Geldig", "Keuring In Orde", etc.
  syncLabel: string;    // "RDW APK Synchroniseren"
}

export function getInspectionTerm(country?: string | null, lang: string = 'nl'): InspectionTerm {
  const c = (country || 'NL').toUpperCase();

  if (c === 'BE') {
    return {
      short: lang === 'nl' ? 'Autokeuring' : 'Inspection',
      full: lang === 'nl' ? 'Periodieke Autokeuring' : 'Technical Vehicle Inspection',
      dateLabel: lang === 'nl' ? 'Keuringsdatum' : 'Inspection Expiry Date',
      dueSoon: lang === 'nl' ? 'Keuring Verloopt Binnenkort' : 'Inspection Due Soon',
      overdue: lang === 'nl' ? 'Keuring Verlopen!' : 'Inspection Overdue!',
      valid: lang === 'nl' ? 'Keuring In Orde' : 'Inspection Valid',
      syncLabel: lang === 'nl' ? 'Keuring Synchroniseren' : 'Sync Inspection',
    };
  }

  if (c === 'DE') {
    return {
      short: 'TÜV / HU',
      full: 'TÜV Hauptuntersuchung (HU)',
      dateLabel: lang === 'nl' ? 'TÜV Vervaldatum' : 'TÜV Expiry Date',
      dueSoon: lang === 'nl' ? 'TÜV Binnenkort' : 'TÜV Due Soon',
      overdue: lang === 'nl' ? 'TÜV Verlopen!' : 'TÜV Overdue!',
      valid: lang === 'nl' ? 'TÜV Geldig' : 'TÜV Valid',
      syncLabel: lang === 'nl' ? 'TÜV Synchroniseren' : 'Sync TÜV',
    };
  }

  if (c === 'UK' || c === 'GB' || (lang === 'en' && c !== 'NL')) {
    return {
      short: 'MOT',
      full: 'Annual MOT Test',
      dateLabel: 'MOT Expiry Date',
      dueSoon: 'MOT Due Soon',
      overdue: 'MOT Overdue!',
      valid: 'MOT Valid',
      syncLabel: 'Sync Inspection',
    };
  }

  // Default: NL (APK)
  return {
    short: 'APK',
    full: 'Algemene Periodieke Keuring (APK)',
    dateLabel: lang === 'nl' ? 'APK Vervaldatum' : 'APK Expiry Date',
    dueSoon: lang === 'nl' ? 'APK Verloopt Binnenkort' : 'APK Due Soon',
    overdue: lang === 'nl' ? 'APK Verlopen!' : 'APK Overdue!',
    valid: lang === 'nl' ? 'APK Geldig' : 'APK Valid',
    syncLabel: lang === 'nl' ? 'RDW APK Synchroniseren' : 'Sync RDW APK',
  };
}

