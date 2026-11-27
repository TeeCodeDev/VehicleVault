import React from 'react';
import { Coins, Gauge, Fuel, Download } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { useLanguage } from '../../context/LanguageContext.js';
import { FleetBenchmarkCard } from './FleetBenchmarkCard.js';
import { PeriodComparisonCard } from './PeriodComparisonCard.js';
import { StatusBadge } from '../StatusBadge.js';

interface FleetAnalyticsViewProps {
  fleetData: any;
  fleetLoading: boolean;
  exportCsv: () => void;
  vehicleType?: string;
  onVehicleTypeChange?: (type: string) => void;
  includeInactive?: boolean;
  onIncludeInactiveChange?: (val: boolean) => void;
}

export const FleetAnalyticsView: React.FC<FleetAnalyticsViewProps> = ({
  fleetData,
  fleetLoading,
  exportCsv,
  vehicleType = 'all',
  onVehicleTypeChange,
  includeInactive = false,
  onIncludeInactiveChange,
}) => {
  const { t } = useLanguage();

  if (fleetLoading) {
    return (
      <div className="py-16 text-center text-xs text-slate-400">
        {t('fleetLoading')}
      </div>
    );
  }

  const availableTypes: string[] = fleetData?.availableTypes || [];
  const categoryOptions = [
    { id: 'all', label: t('categoryAll') },
    { id: 'car', label: t('categoryCars') },
    { id: 'motorcycle', label: t('categoryMotorcycles') },
    { id: 'van', label: t('categoryVans') },
    { id: 'trailer', label: t('categoryTrailers') },
  ].filter((opt) => opt.id === 'all' || availableTypes.includes(opt.id) || vehicleType === opt.id);

  return (
    <div className="space-y-6">
      {(onVehicleTypeChange && categoryOptions.length > 1 || onIncludeInactiveChange) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {onVehicleTypeChange && categoryOptions.length > 1 ? (
            <div className="flex items-center gap-1.5 flex-wrap bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-1.5 rounded-xl w-fit shadow-xs">
              {categoryOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onVehicleTypeChange(opt.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    vehicleType === opt.id
                      ? 'bg-accent-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : (
            <div />
          )}

          {onIncludeInactiveChange && (
            <label className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer shadow-xs">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => onIncludeInactiveChange(e.target.checked)}
                className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <span>{t('includeInactiveVehicles')}</span>
            </label>
          )}
        </div>
      )}

      {/* Fleet KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 rounded-xl shadow-xs transition-colors">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-semibold">
              {t('totalFleetSpend')}
            </span>
            <div className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-950/60 flex items-center justify-center text-sky-600 dark:text-sky-400">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            € {fleetData?.fleetTotalCost ? fleetData.fleetTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
            {t('fleetVehicleCount', { count: fleetData?.vehicleCount || 0 })}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 rounded-xl shadow-xs transition-colors">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-semibold">
              {t('fleetAvgCostPerKm')}
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Gauge className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            € {fleetData?.fleetCostPerKm ? fleetData.fleetCostPerKm.toFixed(2) : '0.00'}{' '}
            <span className="text-xs font-normal text-slate-400">/ km</span>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            {t('fleetTotalDistance', { km: fleetData?.fleetTotalDistanceKm ? fleetData.fleetTotalDistanceKm.toLocaleString() : 0 })}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 rounded-xl shadow-xs transition-colors">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-semibold">
              {t('fuelAndCharging')}
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Fuel className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            € {fleetData?.fleetFuelTotal ? fleetData.fleetFuelTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            {t('fuelAndChargingHint')}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 rounded-xl shadow-xs transition-colors">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-semibold">
              {t('maintenanceAndRepairs')}
            </span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            € {fleetData?.fleetServiceTotal ? fleetData.fleetServiceTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            {t('maintenanceAndRepairsHint')}
          </span>
        </div>
      </div>

      {/* Voertuig-Benchmark & Kostenranking */}
      <FleetBenchmarkCard vehicles={fleetData?.vehicles || []} />

      {/* Periodevergelijking (Jaar-op-jaar & Maandtrend) */}
      <PeriodComparisonCard monthlyBreakdown={fleetData?.monthlyBreakdown || []} />

      {/* Wagenpark Vergelijkingstabel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3 transition-colors">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              {t('fleetComparisonTitle')}
            </h3>
            <p className="text-[11px] text-slate-500">
              {t('fleetComparisonSubtitle')}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-3">{t('vehicle')}</th>
                <th className="py-2.5 px-3">{t('licensePlate')}</th>
                <th className="py-2.5 px-3 text-right">{t('drivenKm')}</th>
                <th className="py-2.5 px-3 text-right">{t('energyTypeFuel')}</th>
                <th className="py-2.5 px-3 text-right">{t('maintenance')}</th>
                <th className="py-2.5 px-3 text-right">{t('fixedExpenses')}</th>
                <th className="py-2.5 px-3 text-right font-bold">{t('totalCost')}</th>
                <th className="py-2.5 px-3 text-right">{t('costPerKmShort')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {(fleetData?.vehicles || []).map((fv: any) => (
                <tr key={fv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200">
                    <div className="flex items-center space-x-2">
                      <span>{fv.name}</span>
                      {fv.status && fv.status !== 'active' && <StatusBadge status={fv.status} />}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                    {fv.license_plate || '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                    {fv.totalDistanceKm ? `${fv.totalDistanceKm.toLocaleString()} km` : '0 km'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                    € {fv.fuelTotal ? fv.fuelTotal.toFixed(2) : '0.00'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                    € {fv.serviceTotal ? fv.serviceTotal.toFixed(2) : '0.00'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                    € {fv.fixedExpensesTotal ? fv.fixedExpensesTotal.toFixed(2) : '0.00'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                    € {fv.totalCost ? fv.totalCost.toFixed(2) : '0.00'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    € {fv.costPerKm ? fv.costPerKm.toFixed(2) : '0.00'} /km
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fleet Monthly Cost Chart & Matrix */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs transition-colors">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              {t('fleetMonthlyTitle')}
            </h3>
          </div>
          <button
            type="button"
            onClick={exportCsv}
            className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center space-x-1"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t('exportCsv')}</span>
          </button>
        </div>

        <div className="h-64 w-full">
          {fleetData && fleetData.monthlyBreakdown?.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fleetData.monthlyBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" />
                <XAxis dataKey="month" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    borderColor: '#334155',
                    fontSize: '11px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="fuel" name={`${t('energyTypeFuel')} (€)`} stackId="a" fill="#f59e0b" />
                <Bar dataKey="regularMaintenance" name={`${t('regularMaintenance')} (€)`} stackId="a" fill="#38bdf8" />
                <Bar dataKey="unscheduledRepairs" name={`${t('repairs')} (€)`} stackId="a" fill="#f43f5e" />
                <Bar dataKey="fixedExpenses" name={`${t('fixedExpenses')} (€)`} stackId="a" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              {t('noFleetMonthlyData')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

