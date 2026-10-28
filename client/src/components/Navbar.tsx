import React from 'react';
import { Shield, Sun, Moon, LogOut, Car } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useTheme } from '../context/ThemeContext.js';
import { useLanguage } from '../context/LanguageContext.js';
import { Vehicle } from '../types/index.js';

interface NavbarProps {
  vehicles: Vehicle[];
  selectedVehicleId: string | null;
  onSelectVehicle: (id: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  vehicles,
  selectedVehicleId,
  onSelectVehicle,
}) => {
  const { user, logout, authDisabled } = useAuth();
  const { setTheme, isDark } = useTheme();
  const { lang, t } = useLanguage();

  return (
    <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 backdrop-blur px-4 flex items-center justify-between sticky top-0 z-40 transition-colors shadow-sm">
      {/* Brand & Active vehicle selector */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white dark:bg-slate-800 dark:text-slate-100 border border-slate-700/40 flex items-center justify-center shadow-sm">
            <Shield className="w-4 h-4 text-sky-400" />
          </div>
          <span className="font-extrabold text-sm tracking-wider text-slate-900 dark:text-slate-100 hidden sm:inline">
            VEHICLE<span className="text-sky-500">VAULT</span>
          </span>
        </div>

        {/* Global Vehicle Quick-Selector */}
        {vehicles.length > 0 && (
          <div className="flex items-center space-x-2 pl-4 border-l border-slate-200 dark:border-slate-800">
            <Car className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <select
              value={selectedVehicleId || ''}
              onChange={(e) => onSelectVehicle(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-md px-2.5 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-sky-500 shadow-sm"
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} {v.license_plate ? `(${v.license_plate})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right controls */}
      <div className="flex items-center space-x-2.5">
        {/* Theme toggle button */}
        <button
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition shadow-sm"
          title={isDark ? (lang === 'nl' ? 'Lichte modus' : 'Light mode') : (lang === 'nl' ? 'Donkere modus' : 'Dark mode')}
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
        </button>

        {/* User & Logout */}
        <div className="flex items-center space-x-2 pl-2 border-l border-slate-200 dark:border-slate-800 text-xs">
          <span className="text-slate-600 dark:text-slate-400 hidden md:inline truncate max-w-[150px] font-medium">
            {user?.email || 'admin@local'}
          </span>
          {authDisabled ? (
            <span
              className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
              title="Inloggen is uitgeschakeld (Pangolin / No-Auth modus)"
            >
              No-Auth
            </span>
          ) : (
            <button
              onClick={logout}
              className="p-2 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title={t('logout')}
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
