import React, { createContext, useContext, useEffect, useState } from 'react';
import type { TranslationKey } from '../i18n/translations.js';

export type Theme = 'dark' | 'light' | 'system';
export type AccentColor = 'indigo' | 'sky' | 'emerald' | 'amber' | 'rose' | 'violet';

export interface AccentColorOption {
  id: AccentColor;
  name: string;
  enName: string;
  previewBg: string;
  dotColor: string;
}

export const ACCENT_COLOR_OPTIONS: AccentColorOption[] = [
  { id: 'indigo', name: 'Koningsblauw', enName: 'Royal Blue', previewBg: 'bg-blue-600', dotColor: '#2563eb' },
  { id: 'sky', name: 'Hemelsblauw', enName: 'Sky Blue', previewBg: 'bg-sky-500', dotColor: '#0ea5e9' },
  { id: 'emerald', name: 'Smaragdgroen', enName: 'Emerald Green', previewBg: 'bg-emerald-600', dotColor: '#059669' },
  { id: 'amber', name: 'Warm Oranje', enName: 'Warm Orange', previewBg: 'bg-orange-500', dotColor: '#ea580c' },
  { id: 'rose', name: 'Robijnrood', enName: 'Ruby Red', previewBg: 'bg-rose-600', dotColor: '#e11d48' },
  { id: 'violet', name: 'Dieppaars', enName: 'Deep Purple', previewBg: 'bg-purple-600', dotColor: '#9333ea' },
];

/** Translation key for each accent color's display name. */
export const ACCENT_LABEL_KEYS: Record<AccentColor, TranslationKey> = {
  indigo: 'accentIndigo',
  sky: 'accentSky',
  emerald: 'accentEmerald',
  amber: 'accentAmber',
  rose: 'accentRose',
  violet: 'accentViolet',
};

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
  accentColor: AccentColor;
  setAccentColor: (color: AccentColor) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('vv_theme') as Theme;
    if (saved === 'dark' || saved === 'light' || saved === 'system') {
      return saved;
    }
    return 'system';
  });

  const [accentColor, setAccentColorState] = useState<AccentColor>(() => {
    const saved = localStorage.getItem('vv_accent') as AccentColor;
    if (['indigo', 'sky', 'emerald', 'amber', 'rose', 'violet'].includes(saved)) {
      return saved;
    }
    return 'indigo';
  });

  const [isDark, setIsDark] = useState<boolean>(true);

  useEffect(() => {
    const applyTheme = () => {
      const root = document.documentElement;
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const computedDark = theme === 'dark' || (theme === 'system' && systemDark);

      setIsDark(computedDark);
      if (computedDark) {
        root.classList.add('dark');
        root.classList.remove('light');
      } else {
        root.classList.remove('dark');
        root.classList.add('light');
      }

      localStorage.setItem('vv_theme', theme);
    };

    applyTheme();

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = () => {
      if (theme === 'system') {
        applyTheme();
      }
    };

    mediaQuery.addEventListener('change', handleMediaChange);
    return () => mediaQuery.removeEventListener('change', handleMediaChange);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-accent', accentColor);
    localStorage.setItem('vv_accent', accentColor);
  }, [accentColor]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const setAccentColor = (newAccent: AccentColor) => {
    setAccentColorState(newAccent);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark, accentColor, setAccentColor }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
