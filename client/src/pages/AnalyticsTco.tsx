import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  LineChart as LineChartIcon,
  Coins,
  Gauge,
  Calendar,
  FileDown,
  Fuel,
  MapPin,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts';
import { Vehicle, TcoSummary } from '../types/index.js';
import { apiFetch } from '../api/client.js';
import { PdfExportModal } from '../components/PdfExportModal.js';
import { DatePicker } from '../components/DatePicker.js';
import { useLanguage } from '../context/LanguageContext.js';

interface ContextType {
  vehicles: Vehicle[];
  selectedVehicle: Vehicle | null;
}

export const AnalyticsTco: React.FC = () => {
  const { selectedVehicle } = useOutletContext<ContextType>();
  const { t, lang } = useLanguage();
  const [tco, setTco] = useState<TcoSummary | null>(null);

  // Filters
  const [timePreset, setTimePreset] = useState<'30d' | '6m' | 'ytd' | 'all'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minOdometer, setMinOdometer] = useState('');
  const [maxOdometer, setMaxOdometer] = useState('');
  const [includePurchasePrice, setIncludePurchasePrice] = useState(false);
  const [economyUnit, setEconomyUnit] = useState<'l100km' | 'kml'>('l100km');

  // Modal
  const [isPdfOpen, setIsPdfOpen] = useState(false);
  const [showTankStats, setShowTankStats] = useState(false);

  useEffect(() => {
    if (selectedVehicle) {
      loadTco(selectedVehicle.id);
    }
  }, [
    selectedVehicle?.id,
    startDate,
    endDate,
    minOdometer,
    maxOdometer,
    includePurchasePrice,
  ]);

  const loadTco = async (vehicleId: string) => {
    try {
      let query = `?includePurchasePrice=${includePurchasePrice}`;
      if (startDate) query += `&startDate=${startDate}`;
      if (endDate) query += `&endDate=${endDate}`;
      if (minOdometer) query += `&minOdometer=${minOdometer}`;
      if (maxOdometer) query += `&maxOdometer=${maxOdometer}`;

      const res = await apiFetch<TcoSummary>(`/api/analytics/tco/${vehicleId}${query}`);
      setTco(res);
    } catch {
      // ignore
    }
  };

  const handlePresetChange = (preset: '30d' | '6m' | 'ytd' | 'all') => {
    setTimePreset(preset);
    const now = new Date();
    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === '30d') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (preset === '6m') {
      const d = new Date();
      d.setMonth(d.getMonth() - 6);
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (preset === 'ytd') {
      const d = new Date(now.getFullYear(), 0, 1);
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    }
  };

  if (!selectedVehicle) {
    return <div className="text-slate-400 text-xs py-8">{t('welcomeSubtitle')}</div>;
  }

  // Calculate insights & percentages
  const totalSpend = tco?.totalCost || 0;
  const fuelSpend = tco?.fuelTotal || 0;
  const serviceSpend = tco?.serviceTotal || 0;
  const fuelPercent = totalSpend > 0 ? Math.round((fuelSpend / totalSpend) * 100) : 0;
  const servicePercent = totalSpend > 0 ? Math.round((serviceSpend / totalSpend) * 100) : 0;

  // Best & Worst fuel consumption
  const validConsumption = tco?.fuelTrends
    .filter((f) => f.lPer100Km !== null && f.lPer100Km > 0)
    .map((f) => f.lPer100Km as number) || [];

  const bestL100 = validConsumption.length > 0 ? Math.min(...validConsumption) : null;
  const worstL100 = validConsumption.length > 0 ? Math.max(...validConsumption) : null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center space-x-2">
            <LineChartIcon className="w-5 h-5 text-sky-500" />
            <span>{t('analyticsTitle')}</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {lang === 'nl' ? 'Financiële rapportage voor' : 'Financial reporting for'}{' '}
            <span className="font-semibold text-slate-900 dark:text-white">{selectedVehicle.name}</span>
          </p>
        </div>

        <button
          onClick={() => setIsPdfOpen(true)}
          className="px-4 py-2 bg-slate-900 text-white hover:bg-black dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white rounded-xl text-xs font-bold inline-flex items-center space-x-2 transition shadow-sm hover:scale-[1.02]"
        >
          <FileDown className="w-4 h-4 text-sky-400" />
          <span>{t('exportPdf')}</span>
        </button>
      </div>

      {/* Filter Toolbar met DatePicker & Bereik */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 space-y-4 text-xs shadow-sm transition-colors">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Preset Buttons */}
          <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 font-semibold">
            <button
              onClick={() => handlePresetChange('30d')}
              className={`px-3 py-1.5 rounded-lg transition ${
                timePreset === '30d'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t('last30Days')}
            </button>
            <button
              onClick={() => handlePresetChange('6m')}
              className={`px-3 py-1.5 rounded-lg transition ${
                timePreset === '6m'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t('last6Months')}
            </button>
            <button
              onClick={() => handlePresetChange('ytd')}
              className={`px-3 py-1.5 rounded-lg transition ${
                timePreset === 'ytd'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t('ytd')}
            </button>
            <button
              onClick={() => handlePresetChange('all')}
              className={`px-3 py-1.5 rounded-lg transition ${
                timePreset === 'all'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t('allTime')}
            </button>
          </div>

          <div className="flex items-center space-x-2">
            {/* Explicit TCO Toggle: Aankoopbedrag meerekenen */}
            <label className="flex items-center space-x-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3.5 py-2 rounded-xl cursor-pointer select-none shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition">
              <input
                type="checkbox"
                checked={includePurchasePrice}
                onChange={(e) => setIncludePurchasePrice(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-0"
              />
              <span className="text-slate-800 dark:text-slate-200 font-bold">
                {t('includePurchaseToggle')} (€{selectedVehicle.purchase_price?.toLocaleString() || 0})
              </span>
            </label>

            {/* Tankstatistieken Option Toggle */}
            <button
              type="button"
              onClick={() => setShowTankStats(!showTankStats)}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition shadow-sm ${
                showTankStats
                  ? 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600'
                  : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <Fuel className="w-3.5 h-3.5 text-amber-500 group-hover:text-amber-400" />
              <span>{showTankStats ? t('hideTankStats') : t('toggleTankStats')}</span>
              {showTankStats ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Custom DatePicker Range & Odometer Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/60">
          <div>
            <DatePicker
              label={lang === 'nl' ? 'Vanaf Datum' : 'Start Date'}
              value={startDate}
              onChange={(v) => {
                setTimePreset('all');
                setStartDate(v);
              }}
              placeholder={lang === 'nl' ? 'Geen beginfilter' : 'No start filter'}
            />
          </div>
          <div>
            <DatePicker
              label={lang === 'nl' ? 'Tot en met Datum' : 'End Date'}
              value={endDate}
              onChange={(v) => {
                setTimePreset('all');
                setEndDate(v);
              }}
              placeholder={lang === 'nl' ? 'Geen eindfilter' : 'No end filter'}
            />
          </div>
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1 text-xs">
              {lang === 'nl' ? 'Minimale KM-stand' : 'Minimum Odometer (km)'}
            </label>
            <input
              type="number"
              value={minOdometer}
              onChange={(e) => setMinOdometer(e.target.value)}
              placeholder="e.g. 50000"
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-md px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 font-mono focus:outline-none focus:border-sky-500 shadow-sm"
            />
          </div>
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1 text-xs">
              {lang === 'nl' ? 'Maximale KM-stand' : 'Maximum Odometer (km)'}
            </label>
            <input
              type="number"
              value={maxOdometer}
              onChange={(e) => setMaxOdometer(e.target.value)}
              placeholder="e.g. 75000"
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-md px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 font-mono focus:outline-none focus:border-sky-500 shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* Uitgebreide KPI Kaarten */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Totale Uitgaven */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 rounded-xl shadow-sm transition-colors">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-semibold">
              {includePurchasePrice ? t('assetTco') : t('operationalTco')}
            </span>
            <div className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-950/60 flex items-center justify-center text-sky-600 dark:text-sky-400">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            € {tco?.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
            {t('fuelSpend')}: €{tco?.fuelTotal.toFixed(2)} • {t('maintenanceSpend')}: €{tco?.serviceTotal.toFixed(2)}
          </div>
        </div>

        {/* Kosten per KM */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 rounded-xl shadow-sm transition-colors">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-semibold">{t('costPerKm')}</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Gauge className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            € {tco?.costPerKm.toFixed(3) || '0.000'} <span className="text-xs font-normal text-slate-400">/ km</span>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            {lang === 'nl' ? `Over ${tco?.totalDistanceKm.toLocaleString() || 0} gereden km` : `Over ${tco?.totalDistanceKm.toLocaleString() || 0} driven km`}
          </span>
        </div>

        {/* Kosten per Maand */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 rounded-xl shadow-sm transition-colors">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-semibold">{t('costPerMonth')}</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            € {tco?.costPerMonth.toFixed(2) || '0.00'} <span className="text-xs font-normal text-slate-400">/ {t('months')}</span>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            {lang === 'nl'
              ? `Gemiddeld over ${tco?.totalMonths || 1} ${tco?.totalMonths === 1 ? 'maand' : 'maanden'}`
              : `Averaged over ${tco?.totalMonths || 1} ${tco?.totalMonths === 1 ? 'month' : 'months'}`}
          </span>
        </div>

        {/* Brandstofverbruik */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 rounded-xl shadow-sm transition-colors">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-semibold">{t('consumption')}</span>
            <button
              onClick={() => setEconomyUnit(economyUnit === 'l100km' ? 'kml' : 'l100km')}
              className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 font-bold uppercase hover:bg-slate-200 transition"
            >
              {economyUnit === 'l100km' ? 'L/100km' : 'km/L'}
            </button>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {economyUnit === 'l100km'
              ? tco?.avgLPer100Km
                ? `${tco.avgLPer100Km} L/100`
                : '—'
              : tco?.avgKmPerLiter
              ? `${tco.avgKmPerLiter} km/L`
              : '—'}
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            {lang === 'nl' ? 'Gem. Literprijs:' : 'Avg Price/L:'} {tco?.avgPricePerLiter ? `€ ${tco.avgPricePerLiter.toFixed(3)}/L` : '—'}
          </span>
        </div>
      </div>

      {/* Financiële Uitsplitsing Bar (Brandstof vs Onderhoud) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 rounded-2xl shadow-sm transition-colors">
        <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2">
          {lang === 'nl' ? 'Verhouding Kostenposten (Operationeel)' : 'Cost Ratio (Operational)'}
        </h3>
        <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
          <div
            className="bg-amber-500 transition-all duration-500"
            style={{ width: `${fuelPercent}%` }}
            title={`Fuel: ${fuelPercent}% (€${fuelSpend.toFixed(2)})`}
          />
          <div
            className="bg-sky-500 transition-all duration-500"
            style={{ width: `${servicePercent}%` }}
            title={`Maintenance: ${servicePercent}% (€${serviceSpend.toFixed(2)})`}
          />
        </div>

        <div className="flex items-center justify-between text-xs font-semibold mt-3 text-slate-600 dark:text-slate-400">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>{t('fuelSpend')}: {fuelPercent}% (€{fuelSpend.toFixed(2)})</span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
            <span>{t('maintenanceSpend')}: {servicePercent}% (€{serviceSpend.toFixed(2)})</span>
          </div>

          {bestL100 && worstL100 && (
            <div className="text-[11px] text-slate-500 hidden sm:block">
              {lang === 'nl' ? 'Zuinigste:' : 'Best:'} <span className="text-emerald-600 dark:text-emerald-400 font-bold">{bestL100} L/100km</span> • {lang === 'nl' ? 'Hoogste:' : 'Worst:'} <span className="text-rose-600 dark:text-rose-400 font-bold">{worstL100} L/100km</span>
            </div>
          )}
        </div>
      </div>

      {/* Visualisaties (Recharts) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Brandstofverbruik Trend & Rolling Average */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-sm transition-colors">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                {t('fuelEconomyTrend')}
              </h3>
              <p className="text-[11px] text-slate-500">
                {lang === 'nl' ? 'Liters per 100 km over opeenvolgende volle tanks' : 'Liters per 100 km across consecutive full tanks'}
              </p>
            </div>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/40">
              {lang === 'nl' ? 'Lager = Zuiniger' : 'Lower = Better'}
            </span>
          </div>

          <div className="h-64 w-full">
            {tco && tco.fuelTrends.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={tco.fuelTrends}>
                  <defs>
                    <linearGradient id="colorTrip" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" />
                  <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} domain={['dataMin - 0.5', 'dataMax + 0.5']} />
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
                  <Area
                    type="monotone"
                    dataKey="lPer100Km"
                    name={lang === 'nl' ? 'Verbruik Tankbeurt (L/100km)' : 'Fill-up (L/100km)'}
                    stroke="#38bdf8"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorTrip)"
                  />
                  <Line
                    type="monotone"
                    dataKey="rollingAvgLPer100Km"
                    name={t('rollingAverage')}
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                {lang === 'nl'
                  ? 'Voer minimaal 2 opeenvolgende volle tankbeurten in om het verbruiksverloop te zien.'
                  : 'Log at least 2 consecutive full tanks to see fuel consumption trend.'}
              </div>
            )}
          </div>
        </div>

        {/* Maandelijkse Kostenverdeling (Gestapelde Bar Chart) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-sm transition-colors">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                {t('monthlyCostBreakdown')}
              </h3>
              <p className="text-[11px] text-slate-500">
                {lang === 'nl' ? 'Uitsplitsing tussen brandstof, beurten en reparaties' : 'Breakdown between fuel, regular service and repairs'}
              </p>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">
              {lang === 'nl' ? 'Per kalendermaand' : 'Per month'}
            </span>
          </div>

          <div className="h-64 w-full">
            {tco && tco.monthlyBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tco.monthlyBreakdown}>
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
                  <Bar dataKey="fuel" name={lang === 'nl' ? 'Brandstof (€)' : 'Fuel (€)'} stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="regularMaintenance" name={lang === 'nl' ? 'Periodiek Onderhoud (€)' : 'Maintenance (€)'} stackId="a" fill="#38bdf8" />
                  <Bar dataKey="unscheduledRepairs" name={lang === 'nl' ? 'Reparaties (€)' : 'Repairs (€)'} stackId="a" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                {lang === 'nl'
                  ? 'Nog geen maandelijkse uitgaven geregistreerd in dit tijdsbereik.'
                  : 'No monthly expenses recorded in this period.'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Uitgebreide Tank- & Actieradius Statistieken (Optioneel) */}
      {showTankStats && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 space-y-6 shadow-sm transition-colors animate-in fade-in-50 duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Fuel className="w-4 h-4 text-amber-500" />
                <span>{t('extendedTankStats')}</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t('fullTankOnlyWarning')}
              </p>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-1 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 rounded-lg border border-amber-200 dark:border-amber-800/40 self-start sm:self-auto">
              Actieradius &amp; Station Intelligence
            </span>
          </div>

          {/* 4 Mini KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3.5 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200/80 dark:border-slate-800">
              <span className="text-[11px] text-slate-500 font-medium block mb-1">{t('avgTankDistance')}</span>
              <span className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                {tco?.fuelStats?.avgDistancePerTank ? `${tco.fuelStats.avgDistancePerTank.toLocaleString()} km` : '—'}
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200/80 dark:border-slate-800">
              <span className="text-[11px] text-slate-500 font-medium block mb-1">{t('maxTankDistance')}</span>
              <span className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {tco?.fuelStats?.maxDistancePerTank ? `${tco.fuelStats.maxDistancePerTank.toLocaleString()} km` : '—'}
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200/80 dark:border-slate-800">
              <span className="text-[11px] text-slate-500 font-medium block mb-1">{t('fuelCostPer100Km')}</span>
              <span className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                {tco?.fuelStats?.avgCostPer100Km ? `€ ${tco.fuelStats.avgCostPer100Km.toFixed(2)}` : '—'}
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200/80 dark:border-slate-800">
              <span className="text-[11px] text-slate-500 font-medium block mb-1">{lang === 'nl' ? 'Totaal Getankte Liters' : 'Total Fuel Liters'}</span>
              <span className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400">
                {tco?.fuelStats?.totalFuelLiters ? `${tco.fuelStats.totalFuelLiters.toFixed(1)} L` : '—'}
              </span>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
            {/* Actieradius per Tankbeurt Chart */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                <Gauge className="w-3.5 h-3.5 text-sky-500" />
                <span>{t('tankDistanceTrend')}</span>
              </h4>
              <div className="h-60 w-full bg-slate-50/50 dark:bg-slate-950/40 rounded-xl p-3 border border-slate-200/60 dark:border-slate-800/60">
                {tco?.fuelStats?.tripMetrics && tco.fuelStats.tripMetrics.filter((m) => m.deltaKm !== null).length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tco.fuelStats.tripMetrics.filter((m) => m.deltaKm !== null)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" />
                      <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 10 }} />
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
                      <Bar dataKey="deltaKm" name={lang === 'nl' ? 'Actieradius (km)' : 'Range (km)'} fill="#38bdf8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">
                    {lang === 'nl' ? 'Minimaal 2 tankbeurten vereist om actieradius per tank te berekenen.' : 'Need at least 2 fill-ups to calculate tank range.'}
                  </div>
                )}
              </div>
            </div>

            {/* Brandstofkosten per 100km Trend */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                <Coins className="w-3.5 h-3.5 text-amber-500" />
                <span>{t('fuelCost100KmTrend')}</span>
              </h4>
              <div className="h-60 w-full bg-slate-50/50 dark:bg-slate-950/40 rounded-xl p-3 border border-slate-200/60 dark:border-slate-800/60">
                {tco?.fuelStats?.tripMetrics && tco.fuelStats.tripMetrics.filter((m) => m.costPer100Km !== null).length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={tco.fuelStats.tripMetrics.filter((m) => m.costPer100Km !== null)}>
                      <defs>
                        <linearGradient id="colorCost100" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" />
                      <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 10 }} />
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
                      <Area
                        type="monotone"
                        dataKey="costPer100Km"
                        name={lang === 'nl' ? 'Kosten per 100km (€)' : 'Cost / 100km (€)'}
                        stroke="#f59e0b"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorCost100)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">
                    {lang === 'nl' ? 'Geen kosten per 100km gegevens beschikbaar.' : 'No cost per 100km data available.'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tankstation & Brand Analysis Table */}
          {tco?.fuelStats?.stations && tco.fuelStats.stations.length > 0 && (
            <div className="pt-2">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2.5 flex items-center space-x-1.5">
                <MapPin className="w-3.5 h-3.5 text-rose-500" />
                <span>{t('stationComparison')}</span>
              </h4>
              <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">{t('station')}</th>
                      <th className="py-2.5 px-3">{t('fillCount')}</th>
                      <th className="py-2.5 px-3">{t('liters')}</th>
                      <th className="py-2.5 px-3">{t('avgPricePerLiterShort')}</th>
                      <th className="py-2.5 px-3 text-right">{t('totalSpendShort')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {tco.fuelStats.stations.map((st) => (
                      <tr key={st.name} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                          {st.name}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 font-mono">
                          {st.fillCount}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 font-mono">
                          {st.totalLiters.toFixed(1)} L
                        </td>
                        <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200 font-mono font-semibold">
                          € {st.avgPricePerLiter.toFixed(3)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                          € {st.totalSpend.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <PdfExportModal
        isOpen={isPdfOpen}
        onClose={() => setIsPdfOpen(false)}
        vehicleId={selectedVehicle.id}
        vehicleName={selectedVehicle.name}
      />
    </div>
  );
};
