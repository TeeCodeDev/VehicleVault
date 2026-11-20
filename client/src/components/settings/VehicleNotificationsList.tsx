import React, { useEffect, useState } from 'react';
import {
  Bell,
  BellOff,
  Wrench,
  ShieldAlert,
  Car,
  Bike,
  Truck,
  Loader2,
  RefreshCw,
  CircleGauge,
} from 'lucide-react';
import { Vehicle } from '../../types/index.js';
import { apiFetch } from '../../api/client.js';
import { useLanguage } from '../../context/LanguageContext.js';
import { LicensePlateBadge } from '../LicensePlateBadge.js';

export const VehicleNotificationsList: React.FC = () => {
  const { t } = useLanguage();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const res = await apiFetch<{ vehicles: Vehicle[] }>('/api/vehicles');
      setVehicles(res.vehicles || []);
    } catch (err) {
      console.error('Failed to load vehicles for notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  const handleUpdateVehicleSetting = async (
    vehicleId: string,
    field:
      | 'notifications_enabled'
      | 'maintenance_notifications_enabled'
      | 'apk_notifications_enabled'
      | 'tire_swap_notifications_enabled'
      | 'tire_tread_notifications_enabled',
    value: boolean
  ) => {
    setUpdatingId(vehicleId);
    try {
      await apiFetch(`/api/vehicles/${vehicleId}`, {
        method: 'PUT',
        body: JSON.stringify({ [field]: value }),
      });

      setVehicles((prev) =>
        prev.map((v) => (v.id === vehicleId ? { ...v, [field]: value } : v))
      );
    } catch (err: any) {
      alert(err?.message || t('vehicleNotifUpdateFailed'));
    } finally {
      setUpdatingId(null);
    }
  };

  const getVehicleIcon = (type: string) => {
    if (type === 'motorcycle') return <Bike className="w-4 h-4 text-sky-500" />;
    if (type === 'van' || type === 'trailer') return <Truck className="w-4 h-4 text-emerald-500" />;
    return <Car className="w-4 h-4 text-sky-500" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        <span>{t('vehicleNotifLoading')}</span>
      </div>
    );
  }

  if (vehicles.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
      <div>
        <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-1.5">
          <Bell className="w-3.5 h-3.5 text-purple-500" />
          <span>{t('vehicleNotifTitle')}</span>
        </h4>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
          {t('vehicleNotifHint')}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2.5">
        {vehicles.map((v) => {
          const isMasterOn = v.notifications_enabled !== false;
          const isMaintOn = v.maintenance_notifications_enabled !== false;
          const isApkOn = v.apk_notifications_enabled !== false;
          const isTireSwapOn = v.tire_swap_notifications_enabled !== false;
          const isTireTreadOn = v.tire_tread_notifications_enabled !== false;
          const isNoApkVehicle = v.type === 'motorcycle' || v.type === 'trailer';
          const isSaving = updatingId === v.id;

          return (
            <div
              key={v.id}
              className={`p-3.5 rounded-xl border transition-all ${
                isMasterOn
                  ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                  : 'bg-slate-50/70 dark:bg-slate-950/60 border-slate-200/60 dark:border-slate-800/60 opacity-80'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Vehicle Header Info */}
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0">
                    {getVehicleIcon(v.type)}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-xs text-slate-900 dark:text-white">
                        {v.name}
                      </span>
                      {v.license_plate && (
                        <LicensePlateBadge plate={v.license_plate} country={v.plate_country} size="xs" />
                      )}
                      {isSaving && <Loader2 className="w-3 h-3 animate-spin text-purple-500" />}
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
                      {v.make || ''} {v.model || ''} {v.year ? `(${v.year})` : ''}
                    </span>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {/* Master Toggle */}
                  <label className="flex items-center space-x-1.5 cursor-pointer bg-slate-50 dark:bg-slate-950/80 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
                    <input
                      type="checkbox"
                      checked={isMasterOn}
                      onChange={(e) =>
                        handleUpdateVehicleSetting(v.id, 'notifications_enabled', e.target.checked)
                      }
                      className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                      {isMasterOn ? (
                        <Bell className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <BellOff className="w-3 h-3 text-slate-400" />
                      )}
                      <span>{t('vehicleNotifAlerts')}</span>
                    </span>
                  </label>

                  {/* Maintenance Toggle */}
                  <label
                    className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border transition ${
                      !isMasterOn
                        ? 'opacity-40 pointer-events-none bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                        : isMaintOn
                        ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/40 cursor-pointer'
                        : 'bg-slate-50 dark:bg-slate-950/80 border-slate-200 dark:border-slate-800 cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={!isMasterOn}
                      checked={isMasterOn && isMaintOn}
                      onChange={(e) =>
                        handleUpdateVehicleSetting(v.id, 'maintenance_notifications_enabled', e.target.checked)
                      }
                      className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                      <Wrench className="w-3 h-3 text-amber-500" />
                      <span>{t('vehicleNotifMaintenance')}</span>
                    </span>
                  </label>

                  {/* APK Toggle */}
                  {!isNoApkVehicle && (
                    <label
                      className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border transition ${
                        !isMasterOn
                          ? 'opacity-40 pointer-events-none bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                          : isApkOn
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40 cursor-pointer'
                          : 'bg-slate-50 dark:bg-slate-950/80 border-slate-200 dark:border-slate-800 cursor-pointer'
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={!isMasterOn}
                        checked={isMasterOn && isApkOn}
                        onChange={(e) =>
                          handleUpdateVehicleSetting(v.id, 'apk_notifications_enabled', e.target.checked)
                        }
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                        <ShieldAlert className="w-3 h-3 text-emerald-500" />
                        <span>APK</span>
                      </span>
                    </label>
                  )}

                  {/* Tire Seasonal Swap Toggle */}
                  <label
                    className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border transition ${
                      !isMasterOn
                        ? 'opacity-40 pointer-events-none bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                        : isTireSwapOn
                        ? 'bg-sky-50/50 dark:bg-sky-950/20 border-sky-200/60 dark:border-sky-900/40 cursor-pointer'
                        : 'bg-slate-50 dark:bg-slate-950/80 border-slate-200 dark:border-slate-800 cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={!isMasterOn}
                      checked={isMasterOn && isTireSwapOn}
                      onChange={(e) =>
                        handleUpdateVehicleSetting(v.id, 'tire_swap_notifications_enabled', e.target.checked)
                      }
                      className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                      <RefreshCw className="w-3 h-3 text-sky-500" />
                      <span>{t('vehicleNotifTireSwap')}</span>
                    </span>
                  </label>

                  {/* Tire Tread Depth Warning Toggle */}
                  <label
                    className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border transition ${
                      !isMasterOn
                        ? 'opacity-40 pointer-events-none bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                        : isTireTreadOn
                        ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-900/40 cursor-pointer'
                        : 'bg-slate-50 dark:bg-slate-950/80 border-slate-200 dark:border-slate-800 cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={!isMasterOn}
                      checked={isMasterOn && isTireTreadOn}
                      onChange={(e) =>
                        handleUpdateVehicleSetting(v.id, 'tire_tread_notifications_enabled', e.target.checked)
                      }
                      className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                    />
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                      <CircleGauge className="w-3 h-3 text-rose-500" />
                      <span>{t('vehicleNotifTread')}</span>
                    </span>
                  </label>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
