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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useTheme } from '../context/ThemeContext.js';
import { useLanguage } from '../context/LanguageContext.js';
import { Vehicle } from '../types/index.js';

interface NavbarProps {
  vehicles: Vehicle[];
  selectedVehicleId: string | null;
  onSelectVehicle: (id: string) => void;
}

function formatLicensePlateDisplay(plate?: string | null): string {
  if (!plate) return '';
  const clean = plate.toUpperCase().trim().replace(/[^A-Z0-9-]/g, '');
  if (clean.includes('-')) return clean;

  if (clean.length === 6) {
    // 3-2-1 pattern, e.g. NBL41K -> NBL-41-K
    const m1 = clean.match(/^([A-Z]{3})([0-9]{2})([A-Z0-9]{1})$/);
    if (m1) return `${m1[1]}-${m1[2]}-${m1[3]}`;
    // 1-3-2 pattern, e.g. G001XX -> G-001-XX
    const m2 = clean.match(/^([A-Z0-9]{1})([0-9]{3})([A-Z]{2})$/);
    if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
    // 2-3-1 pattern, e.g. XX999X -> XX-999-X
    const m3 = clean.match(/^([A-Z]{2})([0-9]{3})([A-Z0-9]{1})$/);
    if (m3) return `${m3[1]}-${m3[2]}-${m3[3]}`;
    // 2-2-2 pattern fallback, e.g. 01XX99 -> 01-XX-99, XX01XX -> XX-01-XX
    return `${clean.slice(0, 2)}-${clean.slice(2, 4)}-${clean.slice(4, 6)}`;
  }
  return clean;
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
  const dropdownRef = useRef<HTMLDivElement>(null);

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
              {/* Vehicle Avatar / Icon */}
              {activeVehicle.image_path ? (
                <img
                  src={`/uploads/${activeVehicle.image_path}`}
                  alt={activeVehicle.name}
                  className="w-7 h-7 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0 shadow-2xs"
                />
              ) : (
                <div className="w-7 h-7 rounded-lg bg-accent-100/70 dark:bg-accent-950/70 text-accent-600 dark:text-accent-400 flex items-center justify-center shrink-0 border border-accent-200 dark:border-accent-800">
                  <Car className="w-4 h-4" />
                </div>
              )}

              {/* Vehicle Name & Dutch Plate Badge */}
              <div className="flex items-center space-x-2 min-w-0">
                <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white truncate max-w-[110px] sm:max-w-[220px]">
                  {activeVehicle.name}
                </span>

                {activeVehicle.license_plate && (
                  <span className="hidden xs:inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-[#f5c518] text-slate-950 font-black font-mono text-[10px] sm:text-[11px] tracking-wider shadow-2xs border border-amber-500/40 shrink-0">
                    <span className="bg-[#003399] text-white font-sans text-[7px] font-bold px-0.5 rounded-[1px] leading-none">
                      NL
                    </span>
                    <span>{formatLicensePlateDisplay(activeVehicle.license_plate)}</span>
                  </span>
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
                          {v.image_path ? (
                            <img
                              src={`/uploads/${v.image_path}`}
                              alt={v.name}
                              className="w-9 h-9 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center shrink-0">
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
                                <span className="inline-flex items-center space-x-0.5 px-1 py-0.2 rounded bg-[#f5c518] text-slate-950 font-black font-mono text-[9px] tracking-wider border border-amber-500/30 shrink-0">
                                  <span className="bg-[#003399] text-white font-sans text-[6px] font-bold px-0.5 rounded-[1px] leading-none">
                                    NL
                                  </span>
                                  <span>{formatLicensePlateDisplay(v.license_plate)}</span>
                                </span>
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
                title="Inloggen is uitgeschakeld (Pangolin / No-Auth modus)"
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
