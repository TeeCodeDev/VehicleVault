import React, { useEffect, useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Navbar } from './Navbar.js';
import { Sidebar } from './Sidebar.js';
import { Vehicle } from '../types/index.js';
import { apiFetch } from '../api/client.js';
import {
  LayoutDashboard,
  Car,
  Landmark,
  Fuel,
  Wrench,
  Disc,
  FolderLock,
  Ticket,
  LineChart,
  Route,
  Settings as SettingsIcon,
} from 'lucide-react';
import { OfflineBanner } from './OfflineBanner.js';
import { GuestTrialBanner } from './auth/GuestTrialBanner.js';
import { useAuth } from '../context/AuthContext.js';
import { useModules } from '../context/ModuleContext.js';
import { useLanguage } from '../context/LanguageContext.js';

export const Layout: React.FC = () => {
  const { user } = useAuth();
  const { isModuleEnabled } = useModules();
  const { t } = useLanguage();
  const isDriver = user?.role === 'driver';
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  const fetchVehicles = async () => {
    try {
      const data = await apiFetch<{ vehicles: Vehicle[] }>('/api/vehicles');
      setVehicles(data.vehicles);
      if (data.vehicles.length > 0) {
        const stored = localStorage.getItem('vv_active_vehicle');
        const exists = data.vehicles.find((v) => v.id === stored);
        const activeId = exists ? exists.id : data.vehicles[0].id;
        setSelectedVehicleId(activeId);
        localStorage.setItem('vv_active_vehicle', activeId);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchVehicles();
    const handleRefresh = () => {
      fetchVehicles();
    };
    window.addEventListener('vehicle:refresh', handleRefresh);
    window.addEventListener('showcase:changed', handleRefresh);
    return () => {
      window.removeEventListener('vehicle:refresh', handleRefresh);
      window.removeEventListener('showcase:changed', handleRefresh);
    };
  }, []);

  const handleSelectVehicle = (id: string) => {
    setSelectedVehicleId(id);
    localStorage.setItem('vv_active_vehicle', id);
    window.dispatchEvent(new CustomEvent('vehicle:changed', { detail: { vehicleId: id } }));
  };

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) || null;

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors overflow-hidden">
      <Navbar
        vehicles={vehicles}
        selectedVehicleId={selectedVehicleId}
        onSelectVehicle={handleSelectVehicle}
      />
      <OfflineBanner />
      <GuestTrialBanner />

      <div className="flex-1 flex overflow-hidden min-h-0">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
          <Outlet context={{ vehicles, selectedVehicle, selectedVehicleId, refreshVehicles: fetchVehicles }} />
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-white/95 dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-800 flex items-center justify-start sm:justify-around z-40 px-2 backdrop-blur shadow-lg overflow-x-auto scrollbar-none space-x-1">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center text-[10px] shrink-0 min-w-[54px] px-1 py-1 transition ${
              isActive ? 'text-accent-600 dark:text-accent-400 font-bold' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`
          }
        >
          <LayoutDashboard className="w-4 h-4 mb-0.5" />
          <span>Home</span>
        </NavLink>

        {!isDriver && (
          <NavLink
            to="/vehicles"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center text-[10px] shrink-0 min-w-[54px] px-1 py-1 transition ${
                isActive ? 'text-accent-600 dark:text-accent-400 font-bold' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`
            }
          >
            <Car className="w-4 h-4 mb-0.5" />
            <span>Garage</span>
          </NavLink>
        )}

        {isModuleEnabled('fuel') && (
          <NavLink
            to="/fuel"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center text-[10px] shrink-0 min-w-[54px] px-1 py-1 transition ${
                isActive ? 'text-accent-600 dark:text-accent-400 font-bold' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`
            }
          >
            <Fuel className="w-4 h-4 mb-0.5" />
            <span>{t('navFuel')}</span>
          </NavLink>
        )}

        {!isDriver && isModuleEnabled('maintenance') && (
          <NavLink
            to="/maintenance"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center text-[10px] shrink-0 min-w-[54px] px-1 py-1 transition ${
                isActive ? 'text-accent-600 dark:text-accent-400 font-bold' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`
            }
          >
            <Wrench className="w-4 h-4 mb-0.5" />
            <span>{t('navService')}</span>
          </NavLink>
        )}

        {!isDriver && isModuleEnabled('tires') && (
          <NavLink
            to="/tires"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center text-[10px] shrink-0 min-w-[54px] px-1 py-1 transition ${
                isActive ? 'text-accent-600 dark:text-accent-400 font-bold' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`
            }
          >
            <Disc className="w-4 h-4 mb-0.5" />
            <span>{t('navTires')}</span>
          </NavLink>
        )}

        {!isDriver && isModuleEnabled('documents') && (
          <NavLink
            to="/documents"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center text-[10px] shrink-0 min-w-[54px] px-1 py-1 transition ${
                isActive ? 'text-accent-600 dark:text-accent-400 font-bold' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`
            }
          >
            <FolderLock className="w-4 h-4 mb-0.5" />
            <span>{t('navDocs')}</span>
          </NavLink>
        )}

        {!isDriver && isModuleEnabled('vignettes') && (
          <NavLink
            to="/vignettes"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center text-[10px] shrink-0 min-w-[54px] px-1 py-1 transition ${
                isActive ? 'text-accent-600 dark:text-accent-400 font-bold' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`
            }
          >
            <Ticket className="w-4 h-4 mb-0.5" />
            <span>{t('navVignettes')}</span>
          </NavLink>
        )}

        {isModuleEnabled('trips') && (
          <NavLink
            to="/trips"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center text-[10px] shrink-0 min-w-[54px] px-1 py-1 transition ${
                isActive ? 'text-accent-600 dark:text-accent-400 font-bold' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`
            }
          >
            <Route className="w-4 h-4 mb-0.5" />
            <span>{t('navTrips')}</span>
          </NavLink>
        )}

        {!isDriver && (
          <>
            {isModuleEnabled('fixedExpenses') && (
              <NavLink
                to="/fixed-expenses"
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center text-[10px] shrink-0 min-w-[54px] px-1 py-1 transition ${
                    isActive ? 'text-accent-600 dark:text-accent-400 font-bold' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`
                }
              >
                <Landmark className="w-4 h-4 mb-0.5" />
                <span>{t('navExpenses')}</span>
              </NavLink>
            )}

            {isModuleEnabled('analytics') && (
              <NavLink
                to="/analytics"
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center text-[10px] shrink-0 min-w-[54px] px-1 py-1 transition ${
                    isActive ? 'text-accent-600 dark:text-accent-400 font-bold' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`
                }
              >
                <LineChart className="w-4 h-4 mb-0.5" />
                <span>TCO</span>
              </NavLink>
            )}

            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center text-[10px] shrink-0 min-w-[54px] px-1 py-1 transition ${
                  isActive ? 'text-accent-600 dark:text-accent-400 font-bold' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`
              }
            >
              <SettingsIcon className="w-4 h-4 mb-0.5" />
              <span>{t('navSettings')}</span>
            </NavLink>
          </>
        )}
      </nav>
    </div>
  );
};
