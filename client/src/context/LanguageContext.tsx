import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations, Language, TranslationKey } from '../i18n/translations.js';

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  translateCategory: (categoryName?: string | null) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const categoryTranslations: Record<string, { nl: string; en: string }> = {
  'Engine Oil & Filter': { nl: 'Motorolie & Oliefilter', en: 'Engine Oil & Filter' },
  'Motorolie & Oliefilter': { nl: 'Motorolie & Oliefilter', en: 'Engine Oil & Filter' },
  'Spark Plugs': { nl: 'Bougies', en: 'Spark Plugs' },
  'Bougies': { nl: 'Bougies', en: 'Spark Plugs' },
  'Brake Fluid': { nl: 'Remvloeistof', en: 'Brake Fluid' },
  'Remvloeistof': { nl: 'Remvloeistof', en: 'Brake Fluid' },
  'Tires (Front)': { nl: 'Banden (Voor)', en: 'Tires (Front)' },
  'Banden (Voor)': { nl: 'Banden (Voor)', en: 'Tires (Front)' },
  'Tires (Rear)': { nl: 'Banden (Achter)', en: 'Tires (Rear)' },
  'Banden (Achter)': { nl: 'Banden (Achter)', en: 'Tires (Rear)' },
  'Transmission Fluid': { nl: 'Versnellingsbakolie', en: 'Transmission Fluid' },
  'Transmissievloeistof': { nl: 'Versnellingsbakolie', en: 'Transmission Fluid' },
  'Versnellingsbakolie': { nl: 'Versnellingsbakolie', en: 'Transmission Fluid' },
  'Air / Cabin Filter': { nl: 'Lucht- / Interieurfilter', en: 'Air / Cabin Filter' },
  'Lucht- & Interieurfilter': { nl: 'Lucht- / Interieurfilter', en: 'Air / Cabin Filter' },
  'Lucht- / Interieurfilter': { nl: 'Lucht- / Interieurfilter', en: 'Air / Cabin Filter' },
  'Chain & Sprockets (Motorcycle)': { nl: 'Ketting & Tandwielen (Motor)', en: 'Chain & Sprockets (Motorcycle)' },
  'Ketting & Tandwielen (Motor)': { nl: 'Ketting & Tandwielen (Motor)', en: 'Chain & Sprockets (Motorcycle)' },
  'General Inspection / Custom': { nl: 'Algemene Inspectie / Maatwerk', en: 'General Inspection / Custom' },
  'Algemene Inspectie / Maatwerk': { nl: 'Algemene Inspectie / Maatwerk', en: 'General Inspection / Custom' },
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(() => {
    const saved = localStorage.getItem('vv_lang');
    if (saved === 'nl' || saved === 'en') return saved;
    return 'nl'; // Default to Dutch as requested by user, with instant English switch
  });

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem('vv_lang', newLang);
  };

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    const dict = translations[lang] || translations.nl;
    let text: string = dict[key] || translations.nl[key] || String(key);

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

