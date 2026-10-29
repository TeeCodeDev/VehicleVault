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
  LineChart,
  Route,
  Settings as SettingsIcon,
} from 'lucide-react';
import { OfflineBanner } from './OfflineBanner.js';
import { useAuth } from '../context/AuthContext.js';

export const Layout: React.FC = () => {
  const { user } = useAuth();
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

      <div className="flex-1 flex overflow-hidden min-h-0">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
          <Outlet context={{ vehicles, selectedVehicle, selectedVehicleId, refreshVehicles: fetchVehicles }} />
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-white/95 dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-800 flex items-center justify-around z-40 px-1 backdrop-blur shadow-lg overflow-x-auto">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center text-[10px] px-1.5 py-1 ${
              isActive ? 'text-accent-600 dark:text-accent-400 font-bold' : 'text-slate-500'
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
              `flex flex-col items-center justify-center text-[10px] px-1.5 py-1 ${
                isActive ? 'text-accent-600 dark:text-accent-400 font-bold' : 'text-slate-500'
              }`
            }
          >
            <Car className="w-4 h-4 mb-0.5" />
            <span>Garage</span>
          </NavLink>
        )}

        <NavLink
          to="/fuel"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center text-[10px] px-1.5 py-1 ${
              isActive ? 'text-accent-600 dark:text-accent-400 font-bold' : 'text-slate-500'
            }`
          }
        >
          <Fuel className="w-4 h-4 mb-0.5" />
          <span>Tanken</span>
        </NavLink>

        <NavLink
          to="/trips"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center text-[10px] px-1.5 py-1 ${
              isActive ? 'text-accent-600 dark:text-accent-400 font-bold' : 'text-slate-500'
            }`
          }
        >
          <Route className="w-4 h-4 mb-0.5" />
          <span>Ritten</span>
        </NavLink>

        {!isDriver && (
          <>
            <NavLink
              to="/fixed-expenses"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center text-[10px] px-1.5 py-1 ${
                  isActive ? 'text-accent-600 dark:text-accent-400 font-bold' : 'text-slate-500'
                }`
              }
            >
              <Landmark className="w-4 h-4 mb-0.5" />
              <span>Lasten</span>
            </NavLink>

            <NavLink
              to="/analytics"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center text-[10px] px-1.5 py-1 ${
                  isActive ? 'text-accent-600 dark:text-accent-400 font-bold' : 'text-slate-500'
                }`
              }
            >
              <LineChart className="w-4 h-4 mb-0.5" />
              <span>TCO</span>
            </NavLink>

            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center text-[10px] px-1.5 py-1 ${
                  isActive ? 'text-accent-600 dark:text-accent-400 font-bold' : 'text-slate-500'
                }`
              }
            >
              <SettingsIcon className="w-4 h-4 mb-0.5" />
              <span>Opties</span>
            </NavLink>
          </>
        )}
      </nav>
    </div>
  );
};
