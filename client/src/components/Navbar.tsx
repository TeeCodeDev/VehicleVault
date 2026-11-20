import React, { useState, useRef, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Sun,
  Moon,
  LogOut,
  Car,
  ChevronDown,
  Check,
  Plus,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useTheme } from '../context/ThemeContext.js';
import { useLanguage } from '../context/LanguageContext.js';
import { Vehicle } from '../types/index.js';
import { LicensePlateBadge } from './LicensePlateBadge.js';

interface NavbarProps {
  vehicles: Vehicle[];
  selectedVehicleId: string | null;
  onSelectVehicle: (id: string) => void;
}

function getVehicleImageUrl(imagePath?: string | null): string | null {
  if (!imagePath) return null;
  if (/^(https?:|data:)/.test(imagePath)) return imagePath;
  const clean = imagePath.replace(/^\/?(uploads\/)?(vehicles\/)?/, '');
  return `/uploads/vehicles/${clean}`;
}

export const Navbar: React.FC<NavbarProps> = ({
  vehicles,
  selectedVehicleId,
  onSelectVehicle,
}) => {
  const { user, logout, authDisabled } = useAuth();
  const { setTheme, isDark } = useTheme();
  const { t } = useLanguage();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleImageError = (key: string) => {
    setFailedImages((prev) => ({ ...prev, [key]: true }));
  };

  const activeVehicle =
    vehicles.find((v) => v.id === selectedVehicleId) || vehicles[0] || null;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 backdrop-blur flex items-center sticky top-0 z-40 transition-colors shadow-xs shrink-0">
      {/* Left Brand Column: Exactly w-60 (240px) on desktop to align pixel-perfect with Sidebar border */}
      <div className="w-60 shrink-0 h-full hidden md:flex items-center px-4 border-r border-slate-200 dark:border-slate-800">
        <NavLink to="/" className="flex items-center space-x-2.5 group">
          <img
            src="/icon-192.png"
            alt="VehicleVault"
            className="w-8 h-8 rounded-lg object-contain shadow-xs group-hover:scale-105 transition-transform"
          />
          <span className="font-extrabold text-sm tracking-wider text-slate-900 dark:text-slate-100">
            VEHICLE<span className="text-accent-500">VAULT</span>
          </span>
        </NavLink>
      </div>

      {/* Mobile Brand Column (only logo on narrow mobile to avoid squishing top controls) */}
      <div className="md:hidden flex items-center pl-2.5 pr-1 sm:px-3 shrink-0">
        <NavLink to="/" className="flex items-center space-x-1.5 sm:space-x-2">
          <img src="/icon-192.png" alt="VehicleVault" className="w-7 h-7 rounded-lg shadow-2xs" />
          <span className="font-extrabold text-xs tracking-wider text-slate-900 dark:text-slate-100 hidden sm:inline">
            VEHICLE<span className="text-accent-500">VAULT</span>
          </span>
        </NavLink>
      </div>

      {/* Main Header Area: Starts cleanly at the sidebar boundary */}
      <div className="flex-1 h-full flex items-center justify-between px-2 sm:px-3 md:px-5 min-w-0">
        {/* Prominent Vehicle Selector */}
        {vehicles.length > 0 && activeVehicle ? (
          <div className="flex items-center space-x-1.5 sm:space-x-2.5 min-w-0">
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`flex items-center space-x-1.5 sm:space-x-3 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl border transition shadow-xs text-left group ${
                  isDropdownOpen
                    ? 'bg-accent-50/80 border-accent-300 dark:bg-accent-950/40 dark:border-accent-700 ring-2 ring-accent-500/20'
                    : 'bg-slate-50/90 dark:bg-slate-950/70 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
                title={t('navSwitchVehicle')}
              >
                {/* Vehicle Icon Badge */}
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-accent-100/70 dark:bg-accent-950/70 text-accent-600 dark:text-accent-400 flex items-center justify-center shrink-0 border border-accent-200/80 dark:border-accent-800 shadow-2xs">
                  <Car className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>

                {/* Vehicle Name & Dutch Plate Badge */}
                <div className="flex items-center space-x-1.5 sm:space-x-2 min-w-0">
                  <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white truncate max-w-[75px] xs:max-w-[120px] sm:max-w-[220px]">
                    {activeVehicle.name}
                  </span>

                  {activeVehicle.license_plate && (
                    <LicensePlateBadge
                      plate={activeVehicle.license_plate}
                      country={activeVehicle.plate_country}
                      size="xs"
                      className="hidden xs:inline-flex shrink-0"
                    />
                  )}
                </div>

                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
                    isDropdownOpen ? 'rotate-180 text-accent-500' : 'group-hover:text-slate-600'
                  }`}
                />
              </button>

              {/* Vehicle Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute left-0 mt-2 w-72 sm:w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                  <div className="p-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <span>{t('myGarage')}</span>
                    <span className="text-accent-500 font-mono">{t('navVehicleCount', { count: vehicles.length })}</span>
                  </div>

                  <div className="max-h-72 overflow-y-auto p-1.5 space-y-1">
                    {vehicles.map((v) => {
                      const isSelected = v.id === activeVehicle.id;
                      const hasImage = v.image_path && !failedImages[v.id];

                      return (
                        <button
                          key={v.id}
                          onClick={() => {
                            onSelectVehicle(v.id);
                            setIsDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition group ${
                            isSelected
                              ? 'bg-accent-50 dark:bg-accent-950/40 text-accent-700 dark:text-accent-300 font-bold'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <div className="flex items-center space-x-2.5 min-w-0">
                            {hasImage ? (
                              <img
                                src={getVehicleImageUrl(v.image_path) || ''}
                                alt={v.name}
                                onError={() => handleImageError(v.id)}
                                className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shadow-2xs shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center shrink-0">
                                <Car className="w-4 h-4" />
                              </div>
                            )}

                            <div className="min-w-0">
                              <div className="text-xs font-bold truncate">{v.name}</div>
                              <div className="text-[10px] text-slate-400 truncate flex items-center space-x-1.5">
                                {v.license_plate && <span>{v.license_plate}</span>}
                                {v.year && <span>• {v.year}</span>}
                              </div>
                            </div>
                          </div>

                          {isSelected && (
                            <Check className="w-4 h-4 text-accent-500 shrink-0 ml-2" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="p-1.5 border-t border-slate-100 dark:border-slate-800">
                    <NavLink
                      to="/vehicles"
                      onClick={() => setIsDropdownOpen(false)}
                      className="w-full px-3 py-2 text-xs font-bold text-accent-600 dark:text-accent-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-xl flex items-center space-x-2 transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t('navManageVehicles')}</span>
                    </NavLink>
                  </div>
                </div>
              )}
            </div>

            {/* If the vehicle has an active public showcase, display live indicator */}
            {activeVehicle.is_showcase_active && activeVehicle.showcase_slug && (
              <a
                href={`/showcase/${activeVehicle.showcase_slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl text-xs font-black bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shadow-2xs hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition group shrink-0"
                title={t('navShowcaseLiveTooltip')}
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="hidden sm:inline">
                  {t('navShowcaseLive')}
                </span>
                <span className="sm:hidden">Live</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100" />
              </a>
            )}
          </div>
        ) : (
          <div />
        )}

        {/* Right controls */}
        <div className="flex items-center space-x-1 sm:space-x-2 shrink-0">
          {/* Theme toggle button */}
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="p-1.5 sm:p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition shadow-2xs"
            title={isDark ? t('navLightMode') : t('navDarkMode')}
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>

          {/* User & Logout */}
          <div className="flex items-center space-x-1 sm:space-x-1.5 pl-1.5 sm:pl-2 border-l border-slate-200 dark:border-slate-800 text-xs">
            <NavLink
              to="/profile"
              className="flex items-center space-x-1 sm:space-x-1.5 px-1.5 sm:px-2 py-1 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition group"
              title={t('navOpenProfile')}
            >
              <span className="truncate max-w-[150px] font-medium hidden md:inline group-hover:text-accent-600 dark:group-hover:text-accent-400">
                {user?.email || 'admin@local'}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 uppercase tracking-wider">
                {user?.role || 'admin'}
              </span>
            </NavLink>
            {authDisabled ? (
              <span
                className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                title={t('navNoAuthTooltip')}
              >
                No-Auth
              </span>
            ) : (
              <button
                onClick={logout}
                className="p-1.5 sm:p-2 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                title={t('logout')}
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
