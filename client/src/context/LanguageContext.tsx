import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations, Language, TranslationKey } from '../i18n/translations.js';

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  translateCategory: (categoryName?: string | null) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const categoryTranslations: Record<string, { nl: string; en: string; de: string; es: string }> = {
  'Engine Oil & Filter': { nl: 'Motorolie & Oliefilter', en: 'Engine Oil & Filter', de: 'Motoröl & Ölfilter', es: 'Aceite de motor y filtro' },
  'Motorolie & Oliefilter': { nl: 'Motorolie & Oliefilter', en: 'Engine Oil & Filter', de: 'Motoröl & Ölfilter', es: 'Aceite de motor y filtro' },
  'Spark Plugs': { nl: 'Bougies', en: 'Spark Plugs', de: 'Zündkerzen', es: 'Bujías' },
  'Bougies': { nl: 'Bougies', en: 'Spark Plugs', de: 'Zündkerzen', es: 'Bujías' },
  'Brake Fluid': { nl: 'Remvloeistof', en: 'Brake Fluid', de: 'Bremsflüssigkeit', es: 'Líquido de frenos' },
  'Remvloeistof': { nl: 'Remvloeistof', en: 'Brake Fluid', de: 'Bremsflüssigkeit', es: 'Líquido de frenos' },
  'Tires (Front)': { nl: 'Banden (Voor)', en: 'Tires (Front)', de: 'Reifen (vorne)', es: 'Neumáticos (delanteros)' },
  'Banden (Voor)': { nl: 'Banden (Voor)', en: 'Tires (Front)', de: 'Reifen (vorne)', es: 'Neumáticos (delanteros)' },
  'Tires (Rear)': { nl: 'Banden (Achter)', en: 'Tires (Rear)', de: 'Reifen (hinten)', es: 'Neumáticos (traseros)' },
  'Banden (Achter)': { nl: 'Banden (Achter)', en: 'Tires (Rear)', de: 'Reifen (hinten)', es: 'Neumáticos (traseros)' },
  'Transmission Fluid': { nl: 'Versnellingsbakolie', en: 'Transmission Fluid', de: 'Getriebeöl', es: 'Aceite de la caja de cambios' },
  'Transmissievloeistof': { nl: 'Versnellingsbakolie', en: 'Transmission Fluid', de: 'Getriebeöl', es: 'Aceite de la caja de cambios' },
  'Versnellingsbakolie': { nl: 'Versnellingsbakolie', en: 'Transmission Fluid', de: 'Getriebeöl', es: 'Aceite de la caja de cambios' },
  'Air / Cabin Filter': { nl: 'Lucht- / Interieurfilter', en: 'Air / Cabin Filter', de: 'Luft- / Innenraumfilter', es: 'Filtro de aire / habitáculo' },
  'Lucht- & Interieurfilter': { nl: 'Lucht- / Interieurfilter', en: 'Air / Cabin Filter', de: 'Luft- / Innenraumfilter', es: 'Filtro de aire / habitáculo' },
  'Lucht- / Interieurfilter': { nl: 'Lucht- / Interieurfilter', en: 'Air / Cabin Filter', de: 'Luft- / Innenraumfilter', es: 'Filtro de aire / habitáculo' },
  'Chain & Sprockets (Motorcycle)': { nl: 'Ketting & Tandwielen (Motor)', en: 'Chain & Sprockets (Motorcycle)', de: 'Kette & Ritzel (Motorrad)', es: 'Cadena y piñones (moto)' },
  'Ketting & Tandwielen (Motor)': { nl: 'Ketting & Tandwielen (Motor)', en: 'Chain & Sprockets (Motorcycle)', de: 'Kette & Ritzel (Motorrad)', es: 'Cadena y piñones (moto)' },
  'General Inspection / Custom': { nl: 'Algemene Inspectie / Maatwerk', en: 'General Inspection / Custom', de: 'Allgemeine Inspektion / Individuell', es: 'Revisión general / personalizada' },
  'Algemene Inspectie / Maatwerk': { nl: 'Algemene Inspectie / Maatwerk', en: 'General Inspection / Custom', de: 'Allgemeine Inspektion / Individuell', es: 'Revisión general / personalizada' },
};

function getInitialLanguage(): Language {
  const saved = localStorage.getItem('vv_lang');
  if (saved === 'nl' || saved === 'en' || saved === 'de' || saved === 'es') return saved;

  if (typeof navigator !== 'undefined') {
    const navLang = (navigator.language || (navigator as any).userLanguage || '').toLowerCase();
    const navLangs = navigator.languages ? Array.from(navigator.languages).map((l) => l.toLowerCase()) : [];
    if (navLang.startsWith('nl') || navLangs.some((l) => l.startsWith('nl'))) {
      return 'nl';
    }
    if (navLang.startsWith('de') || navLangs.some((l) => l.startsWith('de'))) {
      return 'de';
    }
    if (navLang.startsWith('es') || navLangs.some((l) => l.startsWith('es'))) {
      return 'es';
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

