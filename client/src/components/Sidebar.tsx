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
  Ticket,
  UserCircle,
  Settings as SettingsIcon,
  Coffee,
  ExternalLink,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.js';
import { useAuth } from '../context/AuthContext.js';
import { useModules, EnabledModules } from '../context/ModuleContext.js';

export const Sidebar: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { isModuleEnabled } = useModules();
  const isDriver = user?.role === 'driver';

  interface NavItem {
    label: string;
    path: string;
    icon: any;
    moduleKey?: keyof EnabledModules;
  }

  const fullNavItems: NavItem[] = [
    { label: t('dashboard'), path: '/', icon: LayoutDashboard },
    { label: t('myGarage'), path: '/vehicles', icon: Car },
    { label: t('fuel'), path: '/fuel', icon: Fuel, moduleKey: 'fuel' },
    { label: t('trips') || 'Ritregistratie', path: '/trips', icon: Route, moduleKey: 'trips' },
    { label: t('maintenance'), path: '/maintenance', icon: Wrench, moduleKey: 'maintenance' },
    { label: t('tires') || 'Bandenbeheer', path: '/tires', icon: Disc, moduleKey: 'tires' },
    { label: t('fixedExpenses') || 'Vaste Lasten', path: '/fixed-expenses', icon: Landmark, moduleKey: 'fixedExpenses' },
    { label: t('documents'), path: '/documents', icon: FolderLock, moduleKey: 'documents' },
    { label: t('vignettes') || 'Tol & Milieu', path: '/vignettes', icon: Ticket, moduleKey: 'vignettes' },
    { label: t('analytics'), path: '/analytics', icon: LineChart, moduleKey: 'analytics' },
  ];

  const driverNavItems: NavItem[] = [
    { label: t('dashboard'), path: '/', icon: LayoutDashboard },
    { label: t('fuel'), path: '/fuel', icon: Fuel, moduleKey: 'fuel' },
    { label: t('trips') || 'Ritregistratie', path: '/trips', icon: Route, moduleKey: 'trips' },
  ];

  const baseNavItems = isDriver ? driverNavItems : fullNavItems;
  const navItems = baseNavItems.filter((item) => !item.moduleKey || isModuleEnabled(item.moduleKey));

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
      <div className="space-y-1.5 pt-3 border-t border-slate-200 dark:border-slate-800 shrink-0 mt-auto">
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-semibold transition ${
              isActive
                ? 'bg-accent-600 text-white shadow-sm font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50'
            }`
          }
        >
          <UserCircle className="w-4 h-4 shrink-0" />
          <span>{t('myProfile') || 'Mijn Profiel'}</span>
        </NavLink>

        {(!isDriver && (user?.role === 'admin' || !user)) && (
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

        {/* Support on Ko-fi */}
        <a
          href="https://ko-fi.com/D1D51ZGUNL"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center justify-between p-2 rounded-xl bg-rose-50/70 hover:bg-rose-100/80 dark:bg-rose-950/25 dark:hover:bg-rose-900/35 border border-rose-200/80 dark:border-rose-900/40 transition shadow-2xs"
          title="Support the development on Ko-fi"
        >
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-rose-100 dark:bg-rose-900/50 border border-rose-200 dark:border-rose-800/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 shadow-2xs">
              <Coffee className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className="block font-bold text-xs text-slate-800 dark:text-slate-100 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition leading-tight truncate">
                Support on Ko-fi
              </span>
              <span className="block text-[10px] text-slate-500 dark:text-slate-400 leading-tight truncate">
                Buy the dev a coffee
              </span>
            </div>
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-500 dark:group-hover:text-rose-400 transition shrink-0 ml-1.5 opacity-70 group-hover:opacity-100" />
        </a>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400 shadow-sm">
          <div className="flex items-center justify-between font-mono mb-1 font-semibold text-slate-800 dark:text-slate-200">
            <div className="flex items-center space-x-1.5">
              <img src="/icon-192.png" alt="VehicleVault" className="w-4 h-4 object-contain rounded" />
              <span>VehicleVault</span>
            </div>
            <span className="text-emerald-600 dark:text-emerald-400 text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/60 font-mono">
              v2.0.0
            </span>
          </div>
          <p className="text-[10px] text-slate-500 leading-tight">Self-Hosted PWA &amp; Model Context Protocol</p>
        </div>
      </div>
    </aside>
  );
};
