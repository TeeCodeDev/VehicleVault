/**
 * Dynamic inspection terms helper for VehicleVault.
 * Automatically adapts technical inspection terminology depending on the vehicle's
 * registered country (NL -> APK, BE -> Autokeuring, DE -> TÜV / HU, UK/Intl -> MOT / Inspection).
 *
 * The country decides the inspection name; the UI language decides the surrounding words.
 * Texts come straight from the translation dictionaries so this also works outside the
 * LanguageProvider (e.g. on the public showcase page).
 */
import { translations, Language, TranslationKey } from '../i18n/translations.js';

export interface InspectionTerm {
  short: string;        // "APK", "Autokeuring", "TÜV / HU", "MOT"
  dateLabel: string;    // "APK Vervaldatum", "TÜV-Ablaufdatum", "MOT Expiry Date", etc.
  badgeValid: string;   // "Geldig", "Valid", "Gültig"
  badgeDueSoon: string; // "Binnenkort", "Due Soon", "Bald fällig"
  badgeOverdue: string; // "Verlopen!", "Overdue!", "Abgelaufen!"
  syncLabel: string;    // "RDW APK Synchroniseren", "Sync TÜV", etc.
}

export function getInspectionTerm(country?: string | null, lang: string = 'nl'): InspectionTerm {
  const c = (country || 'NL').toUpperCase();
  const dict = translations[lang as Language] || translations.en;
  const tr = (key: TranslationKey, term?: string) => {
    const text = dict[key] || translations.en[key];
    return term === undefined ? text : text.replace(/\{term\}/g, term);
  };

  // `short` is shown as the inspection name; `term` is used inside the sentences.
  let short: string;
  let term: string;
  let syncTerm: string;

  if (c === 'BE') {
    short = tr('inspShortBe');
    term = tr('inspTermBe');
    syncTerm = term;
  } else if (c === 'DE') {
    short = 'TÜV / HU';
    term = 'TÜV';
    syncTerm = term;
  } else if (c === 'UK' || c === 'GB' || (lang === 'en' && c !== 'NL')) {
    short = 'MOT';
    term = 'MOT';
    syncTerm = term;
  } else {
    // Default: NL (APK, synced from the RDW register)
    short = 'APK';
    term = 'APK';
    syncTerm = 'RDW APK';
  }

  return {
    short,
    dateLabel: tr('inspDateLabel', term),
    badgeValid: tr('inspBadgeValid'),
    badgeDueSoon: tr('inspBadgeDueSoon'),
    badgeOverdue: tr('inspBadgeOverdue'),
    syncLabel: tr('inspSyncLabel', syncTerm),
  };
}
