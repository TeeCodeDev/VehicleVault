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
  if (
    imagePath.startsWith('http://') ||
    imagePath.startsWith('https://') ||
    imagePath.startsWith('data:')
  ) {
    return imagePath;
  }
  if (imagePath.startsWith('/uploads/vehicles/')) {
    return imagePath;
  }
  if (imagePath.startsWith('/uploads/')) {
    return imagePath.replace('/uploads/', '/uploads/vehicles/');
  }
  if (imagePath.startsWith('uploads/vehicles/')) {
    return `/${imagePath}`;
  }
  if (imagePath.startsWith('uploads/')) {
    return `/uploads/vehicles/${imagePath.replace('uploads/', '')}`;
  }
  return `/uploads/vehicles/${imagePath}`;
}

export const Navbar: React.FC<NavbarProps> = ({
  vehicles,
  selectedVehicleId,
  onSelectVehicle,
}) => {
  const { user, logout, authDisabled } = useAuth();
  const { setTheme, isDark } = useTheme();
  const { lang, t } = useLanguage();

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

      {/* Mobile Brand Column (only visible on mobile screens where sidebar is hidden) */}
      <div className="md:hidden flex items-center px-3 shrink-0">
        <NavLink to="/" className="flex items-center space-x-2">
          <img src="/icon-192.png" alt="VehicleVault" className="w-7 h-7 rounded-lg" />
          <span className="font-extrabold text-xs tracking-wider text-slate-900 dark:text-slate-100">
            VEHICLE<span className="text-accent-500">VAULT</span>
          </span>
        </NavLink>
      </div>

      {/* Main Header Area: Starts cleanly at the sidebar boundary */}
      <div className="flex-1 h-full flex items-center justify-between px-3 md:px-5 min-w-0">
        {/* Prominent Vehicle Selector */}
        {vehicles.length > 0 && activeVehicle ? (
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="relative" ref={dropdownRef}>
              <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className={`flex items-center space-x-2 sm:space-x-3 px-2.5 sm:px-3 py-1.5 rounded-xl border transition shadow-xs text-left group ${
                isDropdownOpen
                  ? 'bg-accent-50/80 border-accent-300 dark:bg-accent-950/40 dark:border-accent-700 ring-2 ring-accent-500/20'
                  : 'bg-slate-50/90 dark:bg-slate-950/70 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
              title={lang === 'nl' ? 'Wissel van actief voertuig' : 'Switch active vehicle'}
            >
              {/* Vehicle Icon Badge (crisp vector icon, avoiding micro-scaled blurry vehicle photos in header) */}
              <div className="w-7 h-7 rounded-lg bg-accent-100/70 dark:bg-accent-950/70 text-accent-600 dark:text-accent-400 flex items-center justify-center shrink-0 border border-accent-200/80 dark:border-accent-800 shadow-2xs">
                <Car className="w-4 h-4" />
              </div>

              {/* Vehicle Name & Dutch Plate Badge */}
              <div className="flex items-center space-x-2 min-w-0">
                <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white truncate max-w-[110px] sm:max-w-[220px]">
                  {activeVehicle.name}
                </span>

                {activeVehicle.license_plate && (
                  <LicensePlateBadge
                    plate={activeVehicle.license_plate}
                    size="xs"
                    className="hidden xs:inline-flex shrink-0"
                  />
                )}
              </div>

              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-transform shrink-0 ${
                  isDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute left-0 mt-2 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span>{lang === 'nl' ? 'Actief Voertuig Kiezen' : 'Select Active Vehicle'}</span>
                  <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                    {vehicles.length} {lang === 'nl' ? 'in garage' : 'in garage'}
                  </span>
                </div>

                <div className="max-h-72 overflow-y-auto py-1 scrollbar-thin divide-y divide-slate-100 dark:divide-slate-800/60">
                  {vehicles.map((v) => {
                    const isSelected = v.id === activeVehicle.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          onSelectVehicle(v.id);
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/60 transition group ${
                          isSelected ? 'bg-accent-50/60 dark:bg-accent-950/30' : ''
                        }`}
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          {getVehicleImageUrl(v.image_path) && !failedImages[v.id] ? (
                            <img
                              src={getVehicleImageUrl(v.image_path)!}
                              alt={v.name}
                              onError={() => handleImageError(v.id)}
                              className="w-12 h-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0 shadow-2xs"
                            />
                          ) : (
                            <div className="w-12 h-8 rounded-lg bg-accent-50/60 dark:bg-accent-950/40 text-accent-600 dark:text-accent-400 flex items-center justify-center shrink-0 border border-accent-100 dark:border-accent-900/50">
                              <Car className="w-4 h-4" />
                            </div>
                          )}

                          <div className="min-w-0">
                            <div className="flex items-center space-x-2">
                              <span
                                className={`font-bold text-xs truncate ${
                                  isSelected
                                    ? 'text-accent-600 dark:text-accent-400 font-extrabold'
                                    : 'text-slate-800 dark:text-slate-200'
                                }`}
                              >
                                {v.name}
                              </span>
                              {v.license_plate && (
                                <LicensePlateBadge
                                  plate={v.license_plate}
                                  size="xs"
                                  className="shrink-0"
                                />
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate mt-0.5">
                              {v.make && v.model ? `${v.make} ${v.model}` : 'Voertuig'}
                              {v.year ? ` • ${v.year}` : ''}
                              {v.fuel_type ? ` • ${v.fuel_type}` : ''}
                            </div>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-accent-600 text-white flex items-center justify-center shrink-0 shadow-xs ml-2">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
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
                    <span>
                      {lang === 'nl'
                        ? 'Voertuigen beheren in Mijn Garage'
                        : 'Manage vehicles in garage'}
                    </span>
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
                className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-black bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shadow-2xs hover:bg-emerald-100 dark:hover:bg-emerald-900/50 hover:scale-[1.02] transition group shrink-0"
                title="De openbare verkooppagina van dit voertuig staat LIVE. Klik om te bekijken."
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="hidden sm:inline">Verkoop Live</span>
                <span className="sm:hidden">Live</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100" />
              </a>
            )}
          </div>
        ) : (
          <div />
        )}

        {/* Right controls */}
        <div className="flex items-center space-x-2">
          {/* Theme toggle button */}
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition shadow-2xs"
            title={
              isDark
                ? lang === 'nl'
                  ? 'Lichte modus'
                  : 'Light mode'
                : lang === 'nl'
                ? 'Donkere modus'
                : 'Dark mode'
            }
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </button>

          {/* User & Logout */}
          <div className="flex items-center space-x-2 pl-2 border-l border-slate-200 dark:border-slate-800 text-xs">
            <span className="text-slate-600 dark:text-slate-400 hidden md:inline truncate max-w-[150px] font-medium">
              {user?.email || 'admin@local'}
            </span>
            {authDisabled ? (
              <span
                className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                title="Inloggen is uitgeschakeld (No-Auth / SSO modus)"
              >
                No-Auth
              </span>
            ) : (
              <button
                onClick={logout}
                className="p-2 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
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
