import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations, Language, TranslationKey } from '../i18n/translations.js';

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  translateCategory: (categoryName?: string | null) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const categoryTranslations: Record<string, { nl: string; en: string; de: string }> = {
  'Engine Oil & Filter': { nl: 'Motorolie & Oliefilter', en: 'Engine Oil & Filter', de: 'Motoröl & Ölfilter' },
  'Motorolie & Oliefilter': { nl: 'Motorolie & Oliefilter', en: 'Engine Oil & Filter', de: 'Motoröl & Ölfilter' },
  'Spark Plugs': { nl: 'Bougies', en: 'Spark Plugs', de: 'Zündkerzen' },
  'Bougies': { nl: 'Bougies', en: 'Spark Plugs', de: 'Zündkerzen' },
  'Brake Fluid': { nl: 'Remvloeistof', en: 'Brake Fluid', de: 'Bremsflüssigkeit' },
  'Remvloeistof': { nl: 'Remvloeistof', en: 'Brake Fluid', de: 'Bremsflüssigkeit' },
  'Tires (Front)': { nl: 'Banden (Voor)', en: 'Tires (Front)', de: 'Reifen (vorne)' },
  'Banden (Voor)': { nl: 'Banden (Voor)', en: 'Tires (Front)', de: 'Reifen (vorne)' },
  'Tires (Rear)': { nl: 'Banden (Achter)', en: 'Tires (Rear)', de: 'Reifen (hinten)' },
  'Banden (Achter)': { nl: 'Banden (Achter)', en: 'Tires (Rear)', de: 'Reifen (hinten)' },
  'Transmission Fluid': { nl: 'Versnellingsbakolie', en: 'Transmission Fluid', de: 'Getriebeöl' },
  'Transmissievloeistof': { nl: 'Versnellingsbakolie', en: 'Transmission Fluid', de: 'Getriebeöl' },
  'Versnellingsbakolie': { nl: 'Versnellingsbakolie', en: 'Transmission Fluid', de: 'Getriebeöl' },
  'Air / Cabin Filter': { nl: 'Lucht- / Interieurfilter', en: 'Air / Cabin Filter', de: 'Luft- / Innenraumfilter' },
  'Lucht- & Interieurfilter': { nl: 'Lucht- / Interieurfilter', en: 'Air / Cabin Filter', de: 'Luft- / Innenraumfilter' },
  'Lucht- / Interieurfilter': { nl: 'Lucht- / Interieurfilter', en: 'Air / Cabin Filter', de: 'Luft- / Innenraumfilter' },
  'Chain & Sprockets (Motorcycle)': { nl: 'Ketting & Tandwielen (Motor)', en: 'Chain & Sprockets (Motorcycle)', de: 'Kette & Ritzel (Motorrad)' },
  'Ketting & Tandwielen (Motor)': { nl: 'Ketting & Tandwielen (Motor)', en: 'Chain & Sprockets (Motorcycle)', de: 'Kette & Ritzel (Motorrad)' },
  'General Inspection / Custom': { nl: 'Algemene Inspectie / Maatwerk', en: 'General Inspection / Custom', de: 'Allgemeine Inspektion / Individuell' },
  'Algemene Inspectie / Maatwerk': { nl: 'Algemene Inspectie / Maatwerk', en: 'General Inspection / Custom', de: 'Allgemeine Inspektion / Individuell' },
};

function getInitialLanguage(): Language {
  const saved = localStorage.getItem('vv_lang');
  if (saved === 'nl' || saved === 'en' || saved === 'de') return saved;

  if (typeof navigator !== 'undefined') {
    const navLang = (navigator.language || (navigator as any).userLanguage || '').toLowerCase();
    const navLangs = navigator.languages ? Array.from(navigator.languages).map((l) => l.toLowerCase()) : [];
    if (navLang.startsWith('nl') || navLangs.some((l) => l.startsWith('nl'))) {
      return 'nl';
    }
    if (navLang.startsWith('de') || navLangs.some((l) => l.startsWith('de'))) {
      return 'de';
    }
  }

  return 'en';
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(getInitialLanguage);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem('vv_lang', newLang);
  };

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    const dict = translations[lang] || translations.en;
    let text: string = dict[key] || translations.en[key] || translations.nl[key] || String(key);

    if (params) {
      Object.entries(params).forEach(([paramKey, val]) => {
        text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(val));
      });
    }

    return text;
  };

  const translateCategory = (categoryName?: string | null): string => {
    if (!categoryName) return '';
    const trimmed = categoryName.trim().toLowerCase();
    const entry = Object.entries(categoryTranslations).find(
      ([key]) => key.toLowerCase() === trimmed
    );
    if (entry) {
      return entry[1][lang];
    }
    return categoryName;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, translateCategory }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

