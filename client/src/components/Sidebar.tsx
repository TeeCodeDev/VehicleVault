import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Car,
  Landmark,
  Fuel,
  Wrench,
  FolderLock,
  LineChart,
  Route,
  Disc,
  Settings as SettingsIcon,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.js';
import { useAuth } from '../context/AuthContext.js';

export const Sidebar: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const isDriver = user?.role === 'driver';

  const fullNavItems = [
    { label: t('dashboard'), path: '/', icon: LayoutDashboard },
    { label: t('myGarage'), path: '/vehicles', icon: Car },
    { label: t('fuel'), path: '/fuel', icon: Fuel },
    { label: t('trips') || 'Ritregistratie', path: '/trips', icon: Route },
    { label: t('maintenance'), path: '/maintenance', icon: Wrench },
    { label: t('tires') || 'Bandenbeheer', path: '/tires', icon: Disc },
    { label: t('fixedExpenses') || 'Vaste Lasten', path: '/fixed-expenses', icon: Landmark },
    { label: t('documents'), path: '/documents', icon: FolderLock },
    { label: t('analytics'), path: '/analytics', icon: LineChart },
  ];

  const driverNavItems = [
    { label: t('dashboard'), path: '/', icon: LayoutDashboard },
    { label: t('fuel'), path: '/fuel', icon: Fuel },
    { label: t('trips') || 'Ritregistratie', path: '/trips', icon: Route },
  ];

  const navItems = isDriver ? driverNavItems : fullNavItems;

  return (
    <aside className="w-60 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-3 hidden md:flex flex-col justify-between transition-colors h-full overflow-hidden">
      {/* Scrollable Navigation List */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-1.5 scrollbar-thin">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 py-1">
          {isDriver ? 'Chauffeur Modus' : t('appTitle')}
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                    isActive
                      ? 'bg-accent-600 text-white shadow-sm font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section: Always Visible & Pinned to the Bottom */}
      <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800 shrink-0 mt-auto">
        {!isDriver && (
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                isActive
                  ? 'bg-accent-600 text-white shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50'
              }`
            }
          >
            <SettingsIcon className="w-4 h-4 shrink-0" />
            <span>{t('settings')}</span>
          </NavLink>
        )}

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400 shadow-sm">
          <div className="flex items-center justify-between font-mono mb-1 font-semibold text-slate-800 dark:text-slate-200">
            <div className="flex items-center space-x-1.5">
              <img src="/icon-192.png" alt="VehicleVault" className="w-4 h-4 object-contain rounded" />
              <span>VehicleVault</span>
            </div>
            <span className="text-emerald-600 dark:text-emerald-400 text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/60 font-mono">
              v1.0.24
            </span>
          </div>
          <p className="text-[10px] text-slate-500 leading-tight">Self-Hosted PWA &amp; Model Context Protocol</p>
        </div>
      </div>
    </aside>
  );
};
