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
import { useTheme, ACCENT_COLOR_OPTIONS } from '../../context/ThemeContext.js';
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
    {
      key: 'fuel',
      label: lang === 'nl' ? 'Brandstof & Tankbeurten' : 'Fuel & Charging',
      desc: lang === 'nl' ? 'Bijhouden van tank- en laadbeurten, kosten per km en verbruik.' : 'Log fueling and charging sessions, cost per km and consumption.',
      icon: Fuel,
    },
    {
      key: 'trips',
      label: lang === 'nl' ? 'Ritregistratie' : 'Trip Log',
      desc: lang === 'nl' ? 'Fiscale rittenadministratie voor zakelijk, woon-werk en privé.' : 'Tax-compliant trip registration for business, commute and private.',
      icon: Route,
    },
    {
      key: 'maintenance',
      label: lang === 'nl' ? 'Onderhoud & Facturen' : 'Maintenance & Invoices',
      desc: lang === 'nl' ? 'Servicehistorie, facturen uploaden, AI bonherkenning en intervallen.' : 'Service history, invoice uploads, AI recognition and interval alerts.',
      icon: Wrench,
    },
    {
      key: 'tires',
      label: lang === 'nl' ? 'Bandenbeheer' : 'Tire Management',
      desc: lang === 'nl' ? 'Zomer-, winter- en all-season sets, profieldiepte per wielhoek.' : 'Summer, winter, and all-season sets with tread depth monitoring.',
      icon: Disc,
    },
    {
      key: 'vignettes',
      label: lang === 'nl' ? 'Tolvignetten & Stickers' : 'Toll Vignettes & Badges',
      desc: lang === 'nl' ? 'Vignetten (CH, AT, SI, CZ) en milieustickers (Crit\'Air, Umweltplakette).' : 'Digital toll vignettes and environmental emission stickers.',
      icon: Table,
    },
    {
      key: 'documents',
      label: lang === 'nl' ? 'Digitaal Dashboardkastje' : 'Digital Glovebox',
      desc: lang === 'nl' ? 'Kentekenbewijzen, polissen, APK-rapporten en handleidingen veilig bewaren.' : 'Secure storage for registration cards, policies, APK reports and manuals.',
      icon: FolderLock,
    },
    {
      key: 'fixedExpenses',
      label: lang === 'nl' ? 'Vaste Lasten & Verzekering' : 'Recurring Expenses',
      desc: lang === 'nl' ? 'Wegenbelasting (MRB), verzekering, pechhulp en periodieke kosten.' : 'Road tax, insurance, roadside assistance and recurring subscriptions.',
      icon: Landmark,
    },
    {
      key: 'analytics',
      label: lang === 'nl' ? 'TCO & Uitgebreide Rapporten' : 'TCO & Analytics',
      desc: lang === 'nl' ? 'Total Cost of Ownership, pure kilometerprijs en garage-overzicht.' : 'Total Cost of Ownership, cost-per-km breakdown and fleet overview.',
      icon: LineChart,
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* Weergave & Taal */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <Sun className="w-4 h-4 text-amber-500" />
            <span>{lang === 'nl' ? 'Weergave & Taal' : 'Appearance & Language'}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {lang === 'nl'
              ? 'Pas de interface van VehicleVault aan naar jouw persoonlijke voorkeur.'
              : 'Customize the appearance and interface language to your preference.'}
          </p>
        </div>

        <div className="space-y-4 pt-1">
          {/* Theme Selector */}
          <div className="space-y-2.5 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800/80">
            <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span>{lang === 'nl' ? 'Kleurthema' : 'Color Theme'}</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {lang === 'nl' ? 'Kies voor een lichte, donkere of automatische weergave.' : 'Choose between light, dark, or automatic system appearance.'}
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
              <span>{lang === 'nl' ? 'Taal' : 'Language'}</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {lang === 'nl' ? 'Selecteer de taal van de interface.' : 'Select the user interface language.'}
            </p>

            <div className="grid grid-cols-2 gap-2 mt-2">
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

              <button
                type="button"
                onClick={() => setLang('es')}
                className={`p-3 rounded-xl border text-left transition flex items-center space-x-3 ${
                  lang === 'es'
                    ? 'border-sky-500 bg-sky-50/60 dark:bg-sky-950/40 text-slate-900 dark:text-white ring-1 ring-sky-500 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-900'
                }`}
              >
                <span className="text-lg">🇪🇸</span>
                <div>
                  <span className="font-bold text-xs block">Español</span>
                  <span className="text-[10px] text-slate-500">España</span>
                </div>
              </button>
            </div>
          </div>

          {/* Accent Color Picker */}
          <div className="space-y-2.5 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800/80">
            <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
              <Palette className="w-3.5 h-3.5 text-purple-500" />
              <span>{lang === 'nl' ? 'Accentkleur' : 'Accent Color'}</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {lang === 'nl' ? 'Kies een accentkleur voor knoppen, links en markeringen.' : 'Select an accent color for buttons, badges, and focus rings.'}
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
                      {lang === 'nl' ? opt.name : opt.enName}
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
              <span>{lang === 'nl' ? 'Actieve Modules' : 'Active Modules'}</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {lang === 'nl'
                ? 'Schakel functies uit die je niet gebruikt om de navigatie rustig te houden.'
                : 'Disable unused modules to keep the sidebar and navigation minimal.'}
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
                <span>{lang === 'nl' ? 'Systeeminformatie' : 'System Information'}</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {lang === 'nl' ? 'Status van de server, database en achtergrondservices.' : 'Server status, database health, and background workers.'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={diagnosticsRefreshing}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold inline-flex items-center space-x-1.5 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-sky-500 ${diagnosticsRefreshing ? 'animate-spin' : ''}`} />
              <span>{diagnosticsRefreshing ? '...' : (lang === 'nl' ? 'Vernieuwen' : 'Refresh')}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800/80">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Versie</span>
              <span className="text-xs font-bold text-slate-900 dark:text-white block mt-0.5">
                {health?.version ? `v${health.version}` : 'v2.1.0'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800/80">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Database</span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5 flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{health?.database || 'SQLite WAL'}</span>
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800/80 col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Status</span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5">
                {health?.status === 'ok' ? 'Online' : 'Actief'}
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
                  {lang === 'nl' ? 'Ondersteun VehicleVault' : 'Support VehicleVault'}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {lang === 'nl'
                    ? 'Trakteer de ontwikkelaar op een kop koffie via Ko-fi!'
                    : 'Buy the developer a coffee on Ko-fi!'}
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
              <span>Support on Ko-fi</span>
              <ExternalLink className="w-3 h-3 ml-0.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

