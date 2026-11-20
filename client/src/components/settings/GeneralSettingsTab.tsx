import React, { useState, useEffect } from 'react';
import {
  Sun,
  Moon,
  Monitor,
  Languages,
  Palette,
  Layers,
  Fuel,
  Route,
  Wrench,
  Disc,
  Landmark,
  FolderLock,
  LineChart,
  Table,
  CheckCircle2,
  RefreshCw,
  Coffee,
  ExternalLink,
} from 'lucide-react';
import { useTheme, ACCENT_COLOR_OPTIONS, ACCENT_LABEL_KEYS } from '../../context/ThemeContext.js';
import { useLanguage } from '../../context/LanguageContext.js';
import { useModules, EnabledModules } from '../../context/ModuleContext.js';
import { apiFetch } from '../../api/client.js';

interface GeneralSettingsTabProps {
  health?: any;
  diagnosticsRefreshing?: boolean;
  onRefreshDiagnostics?: () => Promise<void>;
}

export const GeneralSettingsTab: React.FC<GeneralSettingsTabProps> = ({
  health: propHealth,
  diagnosticsRefreshing: propRefreshing,
  onRefreshDiagnostics,
}) => {
  const [internalHealth, setInternalHealth] = useState<any>(null);
  const [internalRefreshing, setInternalRefreshing] = useState(false);

  const health = propHealth !== undefined ? propHealth : internalHealth;
  const diagnosticsRefreshing = propRefreshing !== undefined ? propRefreshing : internalRefreshing;

  const handleRefresh = async () => {
    if (onRefreshDiagnostics) {
      await onRefreshDiagnostics();
      return;
    }
    try {
      setInternalRefreshing(true);
      const res = await apiFetch<any>('/healthz');
      setInternalHealth(res);
    } catch {
      // ignore
    } finally {
      setInternalRefreshing(false);
    }
  };

  useEffect(() => {
    if (propHealth === undefined) {
      handleRefresh();
    }
  }, []);
  const { theme, setTheme, accentColor, setAccentColor } = useTheme();
  const { lang, setLang, t } = useLanguage();
  const { modules, toggleModule } = useModules();

  const moduleItems: { key: keyof EnabledModules; label: string; desc: string; icon: React.FC<{ className?: string }> }[] = [
    { key: 'fuel', label: t('moduleFuelLabel'), desc: t('moduleFuelDesc'), icon: Fuel },
    { key: 'trips', label: t('moduleTripsLabel'), desc: t('moduleTripsDesc'), icon: Route },
    { key: 'maintenance', label: t('moduleMaintenanceLabel'), desc: t('moduleMaintenanceDesc'), icon: Wrench },
    { key: 'tires', label: t('moduleTiresLabel'), desc: t('moduleTiresDesc'), icon: Disc },
    { key: 'vignettes', label: t('moduleVignettesLabel'), desc: t('moduleVignettesDesc'), icon: Table },
    { key: 'documents', label: t('moduleDocumentsLabel'), desc: t('moduleDocumentsDesc'), icon: FolderLock },
    { key: 'fixedExpenses', label: t('moduleFixedExpensesLabel'), desc: t('moduleFixedExpensesDesc'), icon: Landmark },
    { key: 'analytics', label: t('moduleAnalyticsLabel'), desc: t('moduleAnalyticsDesc'), icon: LineChart },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* Weergave & Taal */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <Sun className="w-4 h-4 text-amber-500" />
            <span>{t('appearanceAndLanguage')}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t('appearanceAndLanguageHint')}
          </p>
        </div>

        <div className="space-y-4 pt-1">
          {/* Theme Selector */}
          <div className="space-y-2.5 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800/80">
            <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span>{t('colorTheme')}</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {t('colorThemeHint')}
            </p>

            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-200/70 dark:bg-slate-800/80 rounded-xl shadow-inner mt-2">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                  theme === 'light'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>{t('themeLight')}</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                  theme === 'dark'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
                <span>{t('themeDark')}</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme('system')}
                className={`inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                  theme === 'system'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Monitor className="w-3.5 h-3.5 text-sky-500" />
                <span>{t('themeSystem')}</span>
              </button>
            </div>
          </div>

          {/* Language Selector */}
          <div className="space-y-2.5 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800/80">
            <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
              <Languages className="w-3.5 h-3.5 text-sky-500" />
              <span>{t('languageLabel')}</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {t('languageHint')}
            </p>

            <div className="grid grid-cols-3 gap-2 mt-2">
              <button
                type="button"
                onClick={() => setLang('nl')}
                className={`p-3 rounded-xl border text-left transition flex items-center space-x-3 ${
                  lang === 'nl'
                    ? 'border-sky-500 bg-sky-50/60 dark:bg-sky-950/40 text-slate-900 dark:text-white ring-1 ring-sky-500 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-900'
                }`}
              >
                <span className="text-lg">🇳🇱</span>
                <div>
                  <span className="font-bold text-xs block">Nederlands</span>
                  <span className="text-[10px] text-slate-500">Standaard</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setLang('en')}
                className={`p-3 rounded-xl border text-left transition flex items-center space-x-3 ${
                  lang === 'en'
                    ? 'border-sky-500 bg-sky-50/60 dark:bg-sky-950/40 text-slate-900 dark:text-white ring-1 ring-sky-500 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-900'
                }`}
              >
                <span className="text-lg">🇬🇧</span>
                <div>
                  <span className="font-bold text-xs block">English</span>
                  <span className="text-[10px] text-slate-500">International</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setLang('de')}
                className={`p-3 rounded-xl border text-left transition flex items-center space-x-3 ${
                  lang === 'de'
                    ? 'border-sky-500 bg-sky-50/60 dark:bg-sky-950/40 text-slate-900 dark:text-white ring-1 ring-sky-500 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-900'
                }`}
              >
                <span className="text-lg">🇩🇪</span>
                <div>
                  <span className="font-bold text-xs block">Deutsch</span>
                  <span className="text-[10px] text-slate-500">Deutschland</span>
                </div>
              </button>
            </div>
          </div>

          {/* Accent Color Picker */}
          <div className="space-y-2.5 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800/80">
            <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
              <Palette className="w-3.5 h-3.5 text-purple-500" />
              <span>{t('accentColor')}</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {t('accentColorHint')}
            </p>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-1">
              {ACCENT_COLOR_OPTIONS.map((opt) => {
                const isSelected = accentColor === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setAccentColor(opt.id)}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition ${
                      isSelected
                        ? 'border-slate-900 dark:border-white bg-white dark:bg-slate-900 shadow-xs ring-1 ring-slate-900 dark:ring-white'
                        : 'border-slate-200/80 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-900/60'
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full mb-1.5 shadow-xs" style={{ backgroundColor: opt.dotColor }} />
                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate w-full text-center">
                      {t(ACCENT_LABEL_KEYS[opt.id])}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Modules & Systeeminformatie */}
      <div className="space-y-6">
        {/* Module Management */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <Layers className="w-4 h-4 text-sky-500" />
              <span>{t('activeModules')}</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t('activeModulesHint')}
            </p>
          </div>

          <div className="space-y-2 pt-1">
            {moduleItems.map((item) => {
              const Icon = item.icon;
              const isEnabled = modules[item.key];
              return (
                <div
                  key={item.key}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/60 hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition"
                >
                  <div className="flex items-center space-x-3 pr-3">
                    <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white block">{item.label}</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block line-clamp-1">{item.desc}</span>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => toggleModule(item.key)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500" />
                  </label>
                </div>
              );
            })}
          </div>
        </div>

        {/* Diagnostics & Support */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>{t('systemInfo')}</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t('systemInfoHint')}
              </p>
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={diagnosticsRefreshing}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold inline-flex items-center space-x-1.5 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-sky-500 ${diagnosticsRefreshing ? 'animate-spin' : ''}`} />
              <span>{diagnosticsRefreshing ? '...' : t('refresh')}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800/80">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t('versionLabel')}</span>
              <span className="text-xs font-bold text-slate-900 dark:text-white block mt-0.5">
                {health?.version ? `v${health.version}` : 'v2.1.0'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800/80">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t('databaseLabel')}</span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5 flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{health?.database || 'SQLite WAL'}</span>
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800/80 col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t('status')}</span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5">
                {health?.status === 'ok' ? t('statusOnline') : t('statusActive')}
              </span>
            </div>
          </div>

          {/* Support on Ko-fi */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-rose-50/80 to-amber-50/60 dark:from-rose-950/30 dark:to-amber-950/20 border border-rose-200/80 dark:border-rose-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs mt-3">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-900/50 border border-rose-200 dark:border-rose-800/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Coffee className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-xs text-slate-900 dark:text-white">
                  {t('supportTitle')}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {t('supportHint')}
                </p>
              </div>
            </div>
            <a
              href="https://ko-fi.com/D1D51ZGUNL"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold inline-flex items-center justify-center space-x-1.5 transition shrink-0"
            >
              <Coffee className="w-3.5 h-3.5" />
              <span>{t('supportOnKofi')}</span>
              <ExternalLink className="w-3 h-3 ml-0.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

