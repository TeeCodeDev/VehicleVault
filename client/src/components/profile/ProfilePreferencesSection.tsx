import React from 'react';
import { Palette, Globe, Sun, Moon, Laptop, Check } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.js';
import { useTheme, ACCENT_COLOR_OPTIONS, ACCENT_LABEL_KEYS } from '../../context/ThemeContext.js';

export const ProfilePreferencesSection: React.FC = () => {
  const { lang, setLang, t } = useLanguage();
  const { theme, setTheme, accentColor, setAccentColor } = useTheme();

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 text-slate-900 dark:text-white font-bold text-base">
        <Palette className="w-5 h-5 text-accent-500" />
        <span>{t('profileAppearancePrefs')}</span>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm transition-colors space-y-6">
        {/* Language selector */}
        <div>
          <label className="block text-xs font-bold text-slate-900 dark:text-white mb-2 flex items-center space-x-2">
            <Globe className="w-4 h-4 text-sky-500" />
            <span>{t('languageLabel')}</span>
          </label>
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => setLang('nl')}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition flex items-center space-x-2 ${
                lang === 'nl'
                  ? 'bg-accent-50 dark:bg-accent-950/60 border-accent-300 dark:border-accent-700 text-accent-700 dark:text-accent-300 shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:bg-slate-100'
              }`}
            >
              <span>🇳🇱 Nederlands</span>
              {lang === 'nl' && <Check className="w-3.5 h-3.5 ml-1 text-accent-600" />}
            </button>

            <button
              type="button"
              onClick={() => setLang('en')}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition flex items-center space-x-2 ${
                lang === 'en'
                  ? 'bg-accent-50 dark:bg-accent-950/60 border-accent-300 dark:border-accent-700 text-accent-700 dark:text-accent-300 shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:bg-slate-100'
              }`}
            >
              <span>🇬🇧 English</span>
              {lang === 'en' && <Check className="w-3.5 h-3.5 ml-1 text-accent-600" />}
            </button>

            <button
              type="button"
              onClick={() => setLang('de')}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition flex items-center space-x-2 ${
                lang === 'de'
                  ? 'bg-accent-50 dark:bg-accent-950/60 border-accent-300 dark:border-accent-700 text-accent-700 dark:text-accent-300 shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:bg-slate-100'
              }`}
            >
              <span>🇩🇪 Deutsch</span>
              {lang === 'de' && <Check className="w-3.5 h-3.5 ml-1 text-accent-600" />}
            </button>
          </div>
        </div>

        {/* Theme selector */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
          <label className="block text-xs font-bold text-slate-900 dark:text-white mb-2 flex items-center space-x-2">
            <Sun className="w-4 h-4 text-amber-500" />
            <span>{t('profileThemeLabel')}</span>
          </label>
          <div className="grid grid-cols-3 gap-3 max-w-md">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`p-3 rounded-xl border text-center transition flex flex-col items-center space-y-1.5 ${
                theme === 'light'
                  ? 'bg-accent-50 dark:bg-accent-950/60 border-accent-400 dark:border-accent-600 text-accent-700 dark:text-accent-300 font-bold'
                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Sun className="w-4 h-4 text-amber-500" />
              <span className="text-xs">{t('themeLight')}</span>
            </button>

            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`p-3 rounded-xl border text-center transition flex flex-col items-center space-y-1.5 ${
                theme === 'dark'
                  ? 'bg-accent-50 dark:bg-accent-950/60 border-accent-400 dark:border-accent-600 text-accent-700 dark:text-accent-300 font-bold'
                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Moon className="w-4 h-4 text-indigo-400" />
              <span className="text-xs">{t('themeDark')}</span>
            </button>

            <button
              type="button"
              onClick={() => setTheme('system')}
              className={`p-3 rounded-xl border text-center transition flex flex-col items-center space-y-1.5 ${
                theme === 'system'
                  ? 'bg-accent-50 dark:bg-accent-950/60 border-accent-400 dark:border-accent-600 text-accent-700 dark:text-accent-300 font-bold'
                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Laptop className="w-4 h-4 text-slate-400" />
              <span className="text-xs">{t('themeSystem')}</span>
            </button>
          </div>
        </div>

        {/* Accent color picker */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
          <label className="block text-xs font-bold text-slate-900 dark:text-white mb-2 flex items-center space-x-2">
            <Palette className="w-4 h-4 text-accent-500" />
            <span>{t('accentColor')}</span>
          </label>
          <div className="flex flex-wrap gap-2.5">
            {ACCENT_COLOR_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setAccentColor(opt.id as any)}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
                  accentColor === opt.id
                    ? 'border-slate-900 dark:border-white ring-2 ring-accent-500/30'
                    : 'border-slate-200 dark:border-slate-800 opacity-80 hover:opacity-100'
                }`}
              >
                <span
                  className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs"
                  style={{ backgroundColor: opt.dotColor }}
                />
                <span>{t(ACCENT_LABEL_KEYS[opt.id])}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

