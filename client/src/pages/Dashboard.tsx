import React, { useEffect, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import {
  Gauge,
  Calendar,
  Fuel,
  Zap,
  Wrench,
  ShieldCheck,
  Plus,
  RefreshCw,
  FileDown,
  ArrowRight,
  Car,
} from 'lucide-react';
import { Vehicle, MaintenanceInterval, FuelEntry } from '../types/index.js';
import { apiFetch } from '../api/client.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { IntervalProgressBar } from '../components/IntervalProgressBar.js';
import { PdfExportModal } from '../components/PdfExportModal.js';
import { useLanguage } from '../context/LanguageContext.js';
import { formatDisplayDate } from '../utils/format.js';
import { useAuth } from '../context/AuthContext.js';

interface ContextType {
  vehicles: Vehicle[];
  selectedVehicle: Vehicle | null;
  refreshVehicles: () => void;
}

export const Dashboard: React.FC = () => {
  const { vehicles, selectedVehicle, refreshVehicles } = useOutletContext<ContextType>();
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const [intervals, setIntervals] = useState<MaintenanceInterval[]>([]);
  const [recentFuels, setRecentFuels] = useState<FuelEntry[]>([]);
  const [fleetAlerts, setFleetAlerts] = useState<any[]>([]);
  const [syncingApk, setSyncingApk] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  const vehicleFuelType = (selectedVehicle?.fuel_type || '').toLowerCase();
  const isPhev = vehicleFuelType.includes('plug-in') || vehicleFuelType.includes('phev');
  const isElectricOnly = (vehicleFuelType.includes('elektrisch') || vehicleFuelType === 'ev' || vehicleFuelType.includes('elektriciteit')) && !isPhev;

  useEffect(() => {
    if (selectedVehicle) {
      loadVehicleData(selectedVehicle.id);
    }
    loadFleetAlerts();

    const handleUpdate = () => {
      if (selectedVehicle) loadVehicleData(selectedVehicle.id);
    };
    window.addEventListener('vv_offline_synced', handleUpdate);
    window.addEventListener('vv_fuel_logged', handleUpdate);
    return () => {
      window.removeEventListener('vv_offline_synced', handleUpdate);
      window.removeEventListener('vv_fuel_logged', handleUpdate);
    };
  }, [selectedVehicle?.id]);

  const loadVehicleData = async (vehicleId: string) => {
    try {
      const [intRes, fuelRes] = await Promise.all([
        apiFetch<{ intervals: MaintenanceInterval[] }>(`/api/maintenance/intervals/${vehicleId}`).catch(() => ({ intervals: [] })),
        apiFetch<{ entries: FuelEntry[] }>(`/api/fuel?vehicleId=${vehicleId}`).catch(() => ({ entries: [] })),
      ]);
      setIntervals(intRes.intervals || []);
      setRecentFuels((fuelRes.entries || []).slice(0, 5));
    } catch {
      // ignore
    }
  };

  const loadFleetAlerts = async () => {
    try {
      const res = await apiFetch<{ alerts: any[] }>('/api/maintenance/alerts');
      setFleetAlerts(res.alerts);
    } catch {
      // ignore
    }
  };

  const handleSyncApk = async () => {
    setSyncingApk(true);
    try {
      await apiFetch('/api/vehicles/rdw/sync-apk', { method: 'POST' });
      refreshVehicles();
    } catch {
      // ignore
    } finally {
      setSyncingApk(false);
    }
  };

  if (vehicles.length === 0) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-sky-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border border-slate-200 dark:border-slate-800 flex items-center justify-center mx-auto mb-5 shadow-sm">
          <Car className="w-10 h-10 text-sky-500" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{t('welcomeTitle')}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
          {t('welcomeSubtitle')}
        </p>
        <Link
          to="/vehicles"
          className="mt-6 inline-flex items-center space-x-2 px-5 py-2.5 bg-accent-600 hover:bg-accent-700 text-white rounded-xl font-bold text-xs transition shadow-md"
        >
          <Plus className="w-4 h-4" />
          <span>{t('addFirstVehicle')}</span>
        </Link>
      </div>
    );
  }

  // Simplified high-contrast Driver Dashboard (ideal for quick mobile fueling & family members)
  if (user?.role === 'driver') {
    return (
      <div className="space-y-5 max-w-2xl mx-auto py-2">
        {/* Driver Hero Card */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 text-white p-6 rounded-3xl shadow-xl border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-3 py-1 rounded-full">
              🚗 Chauffeur Modus
            </span>
            {selectedVehicle?.license_plate && (
              <div className="inline-flex items-center bg-amber-400 text-slate-950 font-mono font-black text-xs px-2.5 py-0.5 rounded border border-amber-500 shadow-sm">
                <span className="text-[9px] bg-blue-700 text-white px-1 py-0.2 rounded-l mr-1.5 font-bold">NL</span>
                {selectedVehicle.license_plate}
              </div>
            )}
          </div>

          <h2 className="text-2xl font-black tracking-tight">{selectedVehicle?.name || 'Mijn Voertuig'}</h2>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            {selectedVehicle?.make} {selectedVehicle?.model} • {selectedVehicle?.fuel_type || 'Brandstof'}
          </p>

          <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Huidige Stand</span>
              <div className="text-xl font-mono font-black text-white mt-0.5">
                {(selectedVehicle?.current_odometer || 0).toLocaleString()} km
              </div>
            </div>
            {recentFuels[0] && (
              <div className="text-right">
                <span className="text-[11px] text-slate-400 uppercase font-semibold">Laatst Getankt</span>
                <div className="text-xs font-bold text-slate-200 mt-0.5">
                  {formatDisplayDate(recentFuels[0].date)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Big Action Button */}
        <Link
          to="/fuel"
          className="w-full py-4 px-6 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-2xl flex items-center justify-center space-x-3 text-sm md:text-base shadow-lg transition active:scale-95"
        >
          {isElectricOnly ? (
            <>
              <Zap className="w-6 h-6 shrink-0" />
              <span>⚡ Laadbeurt Invoeren</span>
            </>
          ) : isPhev ? (
            <>
              <Fuel className="w-6 h-6 shrink-0" />
              <span>⛽ Tank- of Laadbeurt Invoeren</span>
            </>
          ) : (
            <>
              <Fuel className="w-6 h-6 shrink-0" />
              <span>⛽ Tankbeurt Invoeren</span>
            </>
          )}
        </Link>

        {/* Recent Fuelings List */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm">
          <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
            Laatste 3 Registraties
          </h3>
          {recentFuels.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">Nog geen tankbeurten geregistreerd.</p>
          ) : (
            <div className="space-y-2.5">
              {recentFuels.slice(0, 3).map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                      {f.energy_type === 'electric' ? <Zap className="w-4 h-4 text-cyan-500" /> : <Fuel className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        {f.energy_type === 'electric' ? `${f.kwh || 0} kWh` : `${f.liters} Liter`}
                        {f.station_name && ` • ${f.station_name}`}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {formatDisplayDate(f.date)} • {f.odometer.toLocaleString()} km
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-slate-900 dark:text-white">€ {f.total_cost.toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const apkStatus = selectedVehicle?.apk_status;
  const overdueCount = intervals.filter((i) => i.status === 'overdue').length;
  const warningCount = intervals.filter((i) => i.status === 'warning').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Hero Vehicle Card: Modern, energetic automotive aesthetic */}
      <div className="relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 md:p-6 shadow-sm transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
          <div className="flex items-start space-x-4">
            {selectedVehicle?.image_path ? (
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-xl overflow-hidden shrink-0 border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <img
                  src={`/uploads/vehicles/${selectedVehicle.image_path}`}
                  alt={selectedVehicle.name}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : null}

            <div>
              <div className="flex items-center space-x-3 mb-1.5">
                <span className="text-[11px] font-extrabold tracking-wider uppercase text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 px-2.5 py-0.5 rounded-full border border-sky-200 dark:border-sky-800/40">
                  {selectedVehicle?.type === 'motorcycle'
                    ? t('motorcycle')
                    : selectedVehicle?.type === 'van'
                    ? t('van')
                    : selectedVehicle?.type === 'trailer'
                    ? t('trailer')
                    : t('car')}
                </span>
                <StatusBadge status={selectedVehicle?.status || 'active'} />
              </div>

              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  {selectedVehicle?.name}
                </h1>

                {/* Dutch style license plate badge */}
                {selectedVehicle?.license_plate && (
                  <div className="inline-flex items-center bg-amber-400 text-slate-950 font-mono font-black text-xs px-2.5 py-0.5 rounded border border-amber-500 shadow-sm">
                    <span className="text-[9px] bg-blue-700 text-white px-1 py-0.2 rounded-l mr-1.5 font-bold">NL</span>
                    {selectedVehicle.license_plate}
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                {selectedVehicle?.year ? `${selectedVehicle.year} ` : ''}
                {selectedVehicle?.make} {selectedVehicle?.model} • {t('fuelType')}: {selectedVehicle?.fuel_type || '—'}
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to="/fuel"
              className="px-4 py-2 bg-accent-600 hover:bg-accent-700 text-white rounded-xl text-xs font-bold inline-flex items-center space-x-2 transition shadow-sm hover:scale-[1.02]"
            >
              <Fuel className="w-4 h-4 text-amber-400" />
              <span>{t('newFuelEntry')}</span>
            </Link>

            <Link
              to="/maintenance"
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold inline-flex items-center space-x-1.5 transition border border-slate-200 dark:border-slate-700/60"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>{t('logService')}</span>
            </Link>

            <button
              onClick={() => setIsPdfModalOpen(true)}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold inline-flex items-center space-x-1.5 transition border border-slate-200 dark:border-slate-700/60"
              title={t('exportPdf')}
            >
              <FileDown className="w-3.5 h-3.5 text-sky-500" />
              <span>PDF Dossier</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modern High-Density KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Current Odometer */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 rounded-xl shadow-sm transition-colors">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-semibold">{t('odometer')}</span>
            <div className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-950/60 flex items-center justify-center text-sky-600 dark:text-sky-400">
              <Gauge className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            {(selectedVehicle?.current_odometer || selectedVehicle?.initial_odometer || 0).toLocaleString()}{' '}
            <span className="text-xs font-bold text-slate-400 uppercase">km</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium pt-1 border-t border-slate-100 dark:border-slate-800/80 mt-1">
            <span>{lang === 'nl' ? 'Aankoopstand' : 'Purchased at'}:</span>
            <span className="font-mono font-semibold text-slate-600 dark:text-slate-300">
              {(selectedVehicle?.initial_odometer || 0).toLocaleString()} km
            </span>
          </div>
        </div>

        {/* APK Inspection Status */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 rounded-xl shadow-sm transition-colors">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-semibold">{t('apkDate')}</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-base font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
            <span>{formatDisplayDate(selectedVehicle?.apk_expiration_date)}</span>
            {apkStatus?.isOverdue ? (
              <StatusBadge status="overdue" label={t('apkOverdue')} />
            ) : apkStatus?.isDueSoon ? (
              <StatusBadge status="warning" label={t('apkWarning')} />
            ) : selectedVehicle?.apk_expiration_date ? (
              <StatusBadge status="good" label={t('apkValid')} />
            ) : null}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium mt-1">
            <span>
              {apkStatus?.daysRemaining !== null && apkStatus?.daysRemaining !== undefined
                ? apkStatus.isOverdue
                  ? `${Math.abs(apkStatus.daysRemaining)} ${lang === 'nl' ? 'dagen verlopen!' : 'days overdue!'}`
                  : t('daysRemaining', { days: apkStatus.daysRemaining })
                : '—'}
            </span>
            <button
              onClick={handleSyncApk}
              disabled={syncingApk}
              className="text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center space-x-1"
              title={t('syncApk')}
            >
              <RefreshCw className={`w-3 h-3 ${syncingApk ? 'animate-spin' : ''}`} />
              <span className="text-[10px]">Sync</span>
            </button>
          </div>
        </div>

        {/* Maintenance Health */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 rounded-xl shadow-sm transition-colors">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-semibold">{t('maintenance')}</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white flex items-center space-x-2">
            <span>{overdueCount + warningCount}</span>
            <span className="text-xs font-semibold text-slate-500">
              {lang === 'nl' ? 'aandachtspunten' : 'alerts'}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center space-x-2 mt-1 font-medium">
            <span className={overdueCount > 0 ? 'text-rose-600 dark:text-rose-400 font-bold' : ''}>
              {overdueCount} {lang === 'nl' ? 'verlopen' : 'overdue'}
            </span>
            <span>•</span>
            <span className={warningCount > 0 ? 'text-amber-600 dark:text-amber-400 font-bold' : ''}>
              {warningCount} {lang === 'nl' ? 'binnenkort' : 'due soon'}
            </span>
          </div>
        </div>

        {/* Fleet Count */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 rounded-xl shadow-sm transition-colors">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-semibold">{t('myGarage')}</span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
              <Car className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {vehicles.filter((v) => v.status === 'active').length}{' '}
            <span className="text-xs font-bold text-slate-400 uppercase">{t('active')}</span>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">
            {fleetAlerts.length} {lang === 'nl' ? 'totale meldingen' : 'total alerts'}
          </span>
        </div>
      </div>

      {/* Main Grid: Maintenance Intervals & Recent Fill-Ups */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Dual-Trigger Maintenance Status */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm transition-colors">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-950/60 flex items-center justify-center text-sky-600 dark:text-sky-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  {t('monitoredParts')}
                </h2>
                <p className="text-[11px] text-slate-500">{t('colorLegend')}</p>
              </div>
            </div>
            <Link
              to="/maintenance"
              className="text-xs text-sky-600 dark:text-sky-400 font-bold hover:underline flex items-center space-x-1"
            >
              <span>{t('all')}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {intervals.length === 0 ? (
            <div className="text-xs text-slate-400 text-center py-8">
              {t('noIntervalsConfigured')}
            </div>
          ) : (
            <div className="space-y-4">
              {intervals.slice(0, 5).map((interval) => (
                <div key={interval.id} className="p-3 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-100 dark:border-slate-800/60">
                  <IntervalProgressBar interval={interval} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Recent Fuel Activity */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm transition-colors">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Fuel className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">{t('recentFuelEntries')}</h2>
                <p className="text-[11px] text-slate-500">
                  {lang === 'nl' ? 'Laatste geregistreerde brandstofuitgaven' : 'Latest logged fuel stops'}
                </p>
              </div>
            </div>
            <Link
              to="/fuel"
              className="text-xs text-sky-600 dark:text-sky-400 font-bold hover:underline flex items-center space-x-1"
            >
              <span>{t('all')}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentFuels.length === 0 ? (
            <div className="text-xs text-slate-400 text-center py-8">
              {t('noFuelEntries')}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {recentFuels.map((fuel, idx) => {
                const prevFuel = recentFuels[idx + 1];
                let consumptionBadge: string | null = null;
                if (fuel.is_full_tank && !fuel.missed_previous && prevFuel && prevFuel.is_full_tank) {
                  const dist = fuel.odometer - prevFuel.odometer;
                  if (dist > 0 && fuel.liters > 0) {
                    const kml = dist / fuel.liters;
                    const l100 = (fuel.liters / dist) * 100;
                    consumptionBadge = lang === 'nl' ? `1 op ${kml.toFixed(1)} (${l100.toFixed(1)} L/100)` : `${l100.toFixed(1)} L/100km`;
                  }
                }

                return (
                  <div key={fuel.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white text-sm">
                        {fuel.liters.toFixed(2)} L <span className="text-xs font-normal text-slate-500">@ €{fuel.price_per_liter.toFixed(3)}/L</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center space-x-1.5 flex-wrap">
                        <span>{formatDisplayDate(fuel.date)} • {fuel.odometer.toLocaleString()} km</span>
                        {consumptionBadge && (
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.2 rounded border border-emerald-200/60 dark:border-emerald-800/40 text-[10px]">
                            {consumptionBadge}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-slate-900 dark:text-white text-sm">€{fuel.total_cost.toFixed(2)}</div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border border-slate-200 dark:border-slate-700">
                        {fuel.is_full_tank ? t('fullTank') : (lang === 'nl' ? 'Deeltank' : 'Partial')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* PDF Export Modal */}
      {selectedVehicle && (
        <PdfExportModal
          isOpen={isPdfModalOpen}
          onClose={() => setIsPdfModalOpen(false)}
          vehicleId={selectedVehicle.id}
          vehicleName={selectedVehicle.name}
        />
      )}
    </div>
  );
};
