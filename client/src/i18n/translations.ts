import { nl } from './locales/nl/index.js';
import { en } from './locales/en/index.js';
import { de } from './locales/de/index.js';

export type Language = 'nl' | 'en' | 'de';

// `nl` is the source of truth for keys. Every other locale file is typed as
// Record<keyof typeof nl-area, string>, so a missing or misspelled key fails the build.
export type TranslationKey = keyof typeof nl;

export const translations: Record<Language, Record<TranslationKey, string>> = { nl, en, de };
