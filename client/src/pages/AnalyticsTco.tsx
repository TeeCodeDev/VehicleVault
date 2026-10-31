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
  TrendingDown,
  TrendingUp,
  Landmark,
  Building2,
  Car,
  Download,
  Table,
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
  ReferenceLine,
} from 'recharts';
import { Vehicle, TcoSummary } from '../types/index.js';
import { apiFetch } from '../api/client.js';
import { PdfExportModal } from '../components/PdfExportModal.js';
import { DatePicker } from '../components/DatePicker.js';
import { useLanguage } from '../context/LanguageContext.js';
import { formatDisplayDate } from '../utils/format.js';

interface ContextType {
  vehicles: Vehicle[];
  selectedVehicle: Vehicle | null;
}

export const AnalyticsTco: React.FC = () => {
  const { vehicles, selectedVehicle } = useOutletContext<ContextType>();
  const { t, lang } = useLanguage();
  const [reportScope, setReportScope] = useState<'vehicle' | 'fleet'>('vehicle');
  const [tco, setTco] = useState<TcoSummary | null>(null);
  const [fleetData, setFleetData] = useState<any>(null);
  const [fleetLoading, setFleetLoading] = useState(false);

  // Filters
  const [timePreset, setTimePreset] = useState<'30d' | '6m' | 'ytd' | 'all'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minOdometer, setMinOdometer] = useState('');
  const [maxOdometer, setMaxOdometer] = useState('');
  const [includePurchasePrice, setIncludePurchasePrice] = useState(false);
  const [includeFixedExpenses, setIncludeFixedExpenses] = useState(true);
  const [economyUnit, setEconomyUnit] = useState<'l100km' | 'kml'>(() => {
    const saved = localStorage.getItem('vv_lang') || 'nl';
    return saved === 'nl' ? 'kml' : 'l100km';
  });

  // Modal
  const [isPdfOpen, setIsPdfOpen] = useState(false);

  const loadTco = async (vehicleId: string) => {
    try {
      let query = `?includePurchasePrice=${includePurchasePrice}&includeFixedExpenses=${includeFixedExpenses}`;
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

  const loadFleetTco = async () => {
    try {
      setFleetLoading(true);
      let query = `?includePurchasePrice=${includePurchasePrice}&includeFixedExpenses=${includeFixedExpenses}`;
      if (startDate) query += `&startDate=${startDate}`;
      if (endDate) query += `&endDate=${endDate}`;
      const res = await apiFetch<any>(`/api/analytics/fleet${query}`);
      setFleetData(res);
    } catch {
      setFleetData(null);
    } finally {
      setFleetLoading(false);
    }
  };

  useEffect(() => {
    if (reportScope === 'fleet') {
      loadFleetTco();
    } else if (selectedVehicle) {
      loadTco(selectedVehicle.id);
    }
  }, [
    reportScope,
    selectedVehicle?.id,
    startDate,
    endDate,
    minOdometer,
    maxOdometer,
    includePurchasePrice,
    includeFixedExpenses,
  ]);

  const exportCsv = () => {
    const data = reportScope === 'fleet' ? fleetData?.monthlyBreakdown : tco?.monthlyBreakdown;
    if (!data || data.length === 0) return;

    const headers = ['Maand', 'Brandstof (EUR)', 'Regulier Onderhoud (EUR)', 'Reparaties (EUR)', 'Vaste Lasten (EUR)', 'Totaal (EUR)'];
    const rows = data.map((d: any) => [
      d.month,
      (d.fuel || 0).toFixed(2),
      (d.regularMaintenance || 0).toFixed(2),
      (d.unscheduledRepairs || 0).toFixed(2),
      (d.fixedExpenses || 0).toFixed(2),
      (d.total || 0).toFixed(2),
    ]);
    const csvContent = [headers.join(';'), ...rows.map((r: any) => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapportage-${reportScope === 'fleet' ? 'wagenpark' : (selectedVehicle?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'voertuig')}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
  const fixedSpend = (includeFixedExpenses ? tco?.fixedExpensesTotal : 0) || 0;
  const fuelPercent = totalSpend > 0 ? Math.round((fuelSpend / totalSpend) * 100) : 0;
  const servicePercent = totalSpend > 0 ? Math.round((serviceSpend / totalSpend) * 100) : 0;
  const fixedPercent = totalSpend > 0 ? Math.round((fixedSpend / totalSpend) * 100) : 0;

  // Best & Worst fuel consumption
  const validConsumption = tco?.fuelTrends
    .filter((f) => f.lPer100Km !== null && f.lPer100Km > 0)
    .map((f) => f.lPer100Km as number) || [];

  const bestL100 = validConsumption.length > 0 ? Math.min(...validConsumption) : null;
  const worstL100 = validConsumption.length > 0 ? Math.max(...validConsumption) : null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Scope Switcher: Individueel Voertuig vs Hele Wagenpark */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center space-x-2">
              <LineChartIcon className="w-5 h-5 text-sky-500" />
              <span>{t('analyticsTitle')}</span>
            </h1>

            <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setReportScope('vehicle')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                  reportScope === 'vehicle'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Car className="w-3.5 h-3.5 text-sky-500" />
                <span>{selectedVehicle.name}</span>
              </button>

              <button
                type="button"
                onClick={() => setReportScope('fleet')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                  reportScope === 'fleet'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                <span>{lang === 'nl' ? 'Hele Garage / Wagenpark' : 'Entire Garage / Fleet'}</span>
                {vehicles.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-950 text-slate-600 dark:text-slate-400 font-mono">
                    {vehicles.length}
                  </span>
                )}
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {reportScope === 'fleet'
              ? (lang === 'nl' ? `Geconsolideerde garageanalyse over alle ${vehicles.length} voertuigen` : `Consolidated fleet analytics across all ${vehicles.length} vehicles`)
              : `${lang === 'nl' ? 'Financiële rapportage voor' : 'Financial reporting for'} ${selectedVehicle.name}`}
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <button
            onClick={exportCsv}
            className="px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 transition shadow-xs hover:scale-[1.02]"
            title={lang === 'nl' ? 'Download Excel/CSV rapport' : 'Download CSV report'}
          >
            <Download className="w-4 h-4 text-emerald-500" />
            <span>CSV Rapport</span>
          </button>

          {reportScope === 'vehicle' && (
            <button
              onClick={() => setIsPdfOpen(true)}
              className="px-4 py-2 bg-accent-600 hover:bg-accent-700 text-white rounded-xl text-xs font-bold inline-flex items-center space-x-2 transition shadow-sm hover:scale-[1.02]"
            >
              <FileDown className="w-4 h-4 text-sky-400" />
              <span>{t('exportPdf')}</span>
            </button>
          )}
        </div>
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

          <div className="flex flex-wrap items-center gap-2">
            {/* Explicit TCO Toggle: Vaste lasten meerekenen */}
            <label className="flex items-center space-x-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3.5 py-2 rounded-xl cursor-pointer select-none shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition">
              <input
                type="checkbox"
                checked={includeFixedExpenses}
                onChange={(e) => setIncludeFixedExpenses(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
              />
              <span className="text-slate-800 dark:text-slate-200 font-bold flex items-center space-x-1.5 text-xs">
                <Landmark className="w-3.5 h-3.5 text-indigo-500" />
                <span>
                  {lang === 'nl' ? 'Vaste lasten meerekenen' : 'Include fixed expenses'}
                  {tco?.fixedExpensesTotal ? ` (€${tco.fixedExpensesTotal.toFixed(0)})` : ''}
                </span>
              </span>
            </label>

            {/* Explicit TCO Toggle: Aankoopbedrag meerekenen */}
            <label className="flex items-center space-x-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3.5 py-2 rounded-xl cursor-pointer select-none shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition">
              <input
                type="checkbox"
                checked={includePurchasePrice}
                onChange={(e) => setIncludePurchasePrice(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-0 cursor-pointer"
              />
              <span className="text-slate-800 dark:text-slate-200 font-bold text-xs">
                {t('includePurchaseToggle')} (€{selectedVehicle.purchase_price?.toLocaleString() || 0})
              </span>
            </label>
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

      {reportScope === 'fleet' ? (
        fleetLoading ? (
          <div className="py-16 text-center text-xs text-slate-400">
            {lang === 'nl' ? 'Wagenpark data laden...' : 'Loading fleet analytics...'}
          </div>
        ) : (
        <div className="space-y-6">
          {/* Fleet KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 rounded-xl shadow-sm transition-colors">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                <span className="text-xs font-semibold">{lang === 'nl' ? 'Totale Garage Uitgaven' : 'Total Fleet Spend'}</span>
                <div className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-950/60 flex items-center justify-center text-sky-600 dark:text-sky-400">
                  <Coins className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                € {fleetData?.fleetTotalCost ? fleetData.fleetTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
                {lang === 'nl' ? `Over ${fleetData?.vehicleCount || 0} actieve voertuigen` : `Across ${fleetData?.vehicleCount || 0} active vehicles`}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 rounded-xl shadow-sm transition-colors">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                <span className="text-xs font-semibold">{lang === 'nl' ? 'Gem. Kosten / KM (Vloot)' : 'Avg Cost / KM (Fleet)'}</span>
                <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Gauge className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                € {fleetData?.fleetCostPerKm ? fleetData.fleetCostPerKm.toFixed(2) : '0.00'}{' '}
                <span className="text-xs font-normal text-slate-400">/ km</span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {lang === 'nl' ? `Totaal ${fleetData?.fleetTotalDistanceKm ? fleetData.fleetTotalDistanceKm.toLocaleString() : 0} gereden km` : `Total ${fleetData?.fleetTotalDistanceKm ? fleetData.fleetTotalDistanceKm.toLocaleString() : 0} km`}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 rounded-xl shadow-sm transition-colors">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                <span className="text-xs font-semibold">{lang === 'nl' ? 'Brandstof & Laden' : 'Fuel & Charging'}</span>
                <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <Fuel className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                € {fleetData?.fleetFuelTotal ? fleetData.fleetFuelTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {lang === 'nl' ? 'Brandstof- & laadkosten' : 'Fuel and charging costs'}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 rounded-xl shadow-sm transition-colors">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                <span className="text-xs font-semibold">{lang === 'nl' ? 'Onderhoud & Reparaties' : 'Maintenance & Repairs'}</span>
                <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <Coins className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                € {fleetData?.fleetServiceTotal ? fleetData.fleetServiceTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {lang === 'nl' ? 'Periodiek onderhoud & herstel' : 'Regular service and repairs'}
              </span>
            </div>
          </div>

          {/* Wagenpark Vergelijkingstabel */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3 transition-colors">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  {lang === 'nl' ? 'Wagenpark Vergelijkingstabel' : 'Fleet Comparison Table'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {lang === 'nl' ? 'Kosten en prestaties naast elkaar per voertuig' : 'Side-by-side cost and performance per vehicle'}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">{lang === 'nl' ? 'Voertuig' : 'Vehicle'}</th>
                    <th className="py-2.5 px-3">{lang === 'nl' ? 'Kenteken' : 'Plate'}</th>
                    <th className="py-2.5 px-3 text-right">{lang === 'nl' ? 'Gereden KM' : 'Driven KM'}</th>
                    <th className="py-2.5 px-3 text-right">{lang === 'nl' ? 'Brandstof' : 'Fuel'}</th>
                    <th className="py-2.5 px-3 text-right">{lang === 'nl' ? 'Onderhoud' : 'Service'}</th>
                    <th className="py-2.5 px-3 text-right">{lang === 'nl' ? 'Vaste Lasten' : 'Fixed'}</th>
                    <th className="py-2.5 px-3 text-right font-bold">{lang === 'nl' ? 'Totale Kosten' : 'Total'}</th>
                    <th className="py-2.5 px-3 text-right">{lang === 'nl' ? 'Kosten / KM' : 'Cost / KM'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(fleetData?.vehicles || []).map((fv: any) => (
                    <tr key={fv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200">
                        {fv.name}
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
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm transition-colors">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  {lang === 'nl' ? 'Geconsolideerde Maandelijkse Kosten (Wagenpark)' : 'Consolidated Monthly Fleet Spend'}
                </h3>
              </div>
              <button
                type="button"
                onClick={exportCsv}
                className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center space-x-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV Exporteren</span>
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
                    <Bar dataKey="fuel" name={lang === 'nl' ? 'Brandstof (€)' : 'Fuel (€)'} stackId="a" fill="#f59e0b" />
                    <Bar dataKey="regularMaintenance" name={lang === 'nl' ? 'Periodiek Onderhoud (€)' : 'Maintenance (€)'} stackId="a" fill="#38bdf8" />
                    <Bar dataKey="unscheduledRepairs" name={lang === 'nl' ? 'Reparaties (€)' : 'Repairs (€)'} stackId="a" fill="#f43f5e" />
                    <Bar dataKey="fixedExpenses" name={lang === 'nl' ? 'Vaste Lasten (€)' : 'Fixed Expenses (€)'} stackId="a" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  {lang === 'nl' ? 'Geen maandelijkse gegevens beschikbaar voor het wagenpark.' : 'No monthly fleet data.'}
                </div>
              )}
            </div>
          </div>
        </div>
        )
      ) : (
        <>
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
            {tco?.fixedExpensesTotal ? ` • Vaste lasten: €${tco.fixedExpensesTotal.toFixed(2)}` : ''}
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
            € {tco?.costPerKm.toFixed(2) || '0.00'} <span className="text-xs font-normal text-slate-400">/ km</span>
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
              ? `Gemiddeld over ${tco?.totalMonths || 1} ${tco?.totalMonths === 1 ? 'maand' : 'maanden'}${tco?.monthlyFixedCost ? ` (incl. €${tco.monthlyFixedCost.toFixed(2)} vaste lasten)` : ''}`
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
              {economyUnit === 'l100km' ? 'L/100km' : (lang === 'nl' ? '1 op X' : 'km/L')}
            </button>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {economyUnit === 'kml'
              ? tco?.avgKmPerLiter
                ? (lang === 'nl' ? `1 op ${tco.avgKmPerLiter.toFixed(1)}` : `${tco.avgKmPerLiter.toFixed(1)} km/L`)
                : '—'
              : tco?.avgLPer100Km
              ? `${tco.avgLPer100Km.toFixed(2)} L/100`
              : '—'}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium flex items-center justify-between flex-wrap gap-1">
            <span>
              {economyUnit === 'kml'
                ? tco?.avgLPer100Km ? `(${tco.avgLPer100Km.toFixed(2)} L/100km)` : ''
                : tco?.avgKmPerLiter ? (lang === 'nl' ? `(1 op ${tco.avgKmPerLiter.toFixed(1)})` : `(${tco.avgKmPerLiter.toFixed(1)} km/L)`) : ''}
            </span>
            <span>{lang === 'nl' ? 'Gem. Literprijs:' : 'Avg Price/L:'} {tco?.avgPricePerLiter ? `€ ${tco.avgPricePerLiter.toFixed(3)}/L` : '—'}</span>
          </div>
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
          {includeFixedExpenses && fixedSpend > 0 && (
            <div
              className="bg-indigo-500 transition-all duration-500"
              style={{ width: `${fixedPercent}%` }}
              title={`Fixed: ${fixedPercent}% (€${fixedSpend.toFixed(2)})`}
            />
          )}
        </div>

        <div className="flex items-center justify-between text-xs font-semibold mt-3 text-slate-600 dark:text-slate-400 flex-wrap gap-2">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>{t('fuelSpend')}: {fuelPercent}% (€{fuelSpend.toFixed(2)})</span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
            <span>{t('maintenanceSpend')}: {servicePercent}% (€{serviceSpend.toFixed(2)})</span>
          </div>

          {includeFixedExpenses && fixedSpend > 0 && (
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              <span>Vaste lasten: {fixedPercent}% (€{fixedSpend.toFixed(2)})</span>
            </div>
          )}

          {bestL100 && worstL100 && (
            <div className="text-[11px] text-slate-500 hidden sm:block">
              {lang === 'nl' ? 'Zuinigste:' : 'Best:'}{' '}
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                {lang === 'nl' ? `1 op ${(100 / bestL100).toFixed(1)} (${bestL100} L/100km)` : `${bestL100} L/100km`}
              </span>{' '}
              • {lang === 'nl' ? 'Hoogste verbruik:' : 'Worst:'}{' '}
              <span className="text-rose-600 dark:text-rose-400 font-bold">
                {lang === 'nl' ? `1 op ${(100 / worstL100).toFixed(1)} (${worstL100} L/100km)` : `${worstL100} L/100km`}
              </span>
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

      {/* Maandelijkse Kostenspecificatie Matrix */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3 transition-colors">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-2">
            <Table className="w-4 h-4 text-sky-500" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              {lang === 'nl' ? 'Maandelijkse Kostenspecificatie Matrix' : 'Monthly Cost Specification Matrix'}
            </h3>
          </div>
          <button
            type="button"
            onClick={exportCsv}
            className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center space-x-1"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{lang === 'nl' ? 'Exporteer Tabel (CSV)' : 'Export Table (CSV)'}</span>
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-3">{lang === 'nl' ? 'Maand' : 'Month'}</th>
                <th className="py-2.5 px-3 text-right">{lang === 'nl' ? 'Brandstof' : 'Fuel'}</th>
                <th className="py-2.5 px-3 text-right">{lang === 'nl' ? 'Regulier Onderhoud' : 'Maintenance'}</th>
                <th className="py-2.5 px-3 text-right">{lang === 'nl' ? 'Reparaties' : 'Repairs'}</th>
                <th className="py-2.5 px-3 text-right">{lang === 'nl' ? 'Vaste Lasten' : 'Fixed'}</th>
                <th className="py-2.5 px-3 text-right font-bold">{lang === 'nl' ? 'Maandtotaal' : 'Total'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {tco && tco.monthlyBreakdown.length > 0 ? (
                tco.monthlyBreakdown.map((row) => (
                  <tr key={row.month} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200 font-mono">
                      {row.month}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                      € {row.fuel.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                      € {row.regularMaintenance.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                      € {row.unscheduledRepairs.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                      € {(row.fixedExpenses || 0).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                      € {row.total.toFixed(2)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-slate-400">
                    {lang === 'nl' ? 'Geen maandelijkse gegevens beschikbaar' : 'No monthly data'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>


      {/* Brandstofprijzen & Prijsverloop Sectie */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 space-y-5 shadow-sm transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-2">
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-2">
              <Fuel className="w-4 h-4 text-amber-500" />
              <span>{t('fuelPriceStatsTitle')}</span>
            </h3>
            <p className="text-[11px] text-slate-500">
              {t('fuelPriceStatsSubtitle')}
            </p>
          </div>
          {tco?.priceStats?.avgPrice && (
            <span className="text-[11px] font-bold px-2.5 py-1 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 rounded-lg border border-amber-200 dark:border-amber-800/40 self-start sm:self-auto font-mono">
              {t('weightedAverageOver', { liters: tco.fuelStats?.totalFuelLiters ? tco.fuelStats.totalFuelLiters.toFixed(1) : '0' })}
            </span>
          )}
        </div>

        {/* 3 Price Highlight Cards: Gemiddeld, Goedkoopste, Duurste */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Gemiddelde Brandstofprijs */}
          <div className="p-4 bg-slate-50/70 dark:bg-slate-950/60 rounded-xl border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-1.5">
              <span className="text-xs font-semibold">{t('avgFuelPrice')}</span>
              <div className="w-6 h-6 rounded-lg bg-amber-100 dark:bg-amber-950/80 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Fuel className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {tco?.priceStats?.avgPrice ? `€ ${tco.priceStats.avgPrice.toFixed(3)}` : '—'}{' '}
                <span className="text-xs font-normal text-slate-400">/ L</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {lang === 'nl' ? 'Gewogen gemiddelde literprijs' : 'Weighted average price per liter'}
              </p>
            </div>
          </div>

          {/* Goedkoopste Tankbeurt */}
          <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200/80 dark:border-emerald-800/50 flex flex-col justify-between">
            <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-400 mb-1.5">
              <span className="text-xs font-bold flex items-center space-x-1">
                <TrendingDown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>{t('cheapestFuel')}</span>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                {lang === 'nl' ? 'Laagste prijs' : 'Lowest price'}
              </span>
            </div>
            <div>
              <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 font-mono">
                {tco?.priceStats?.minPrice ? `€ ${tco.priceStats.minPrice.price.toFixed(3)}` : '—'}{' '}
                <span className="text-xs font-normal text-emerald-600/70 dark:text-emerald-400/70">/ L</span>
              </div>
              <p className="text-[11px] text-emerald-800/80 dark:text-emerald-400/80 mt-1">
                {tco?.priceStats?.minPrice ? (
                  <>
                    <span className="font-semibold">{formatDisplayDate(tco.priceStats.minPrice.date)}</span> • {tco.priceStats.minPrice.liters.toFixed(1)} L
                    {tco.priceStats.minPrice.station && ` • ${tco.priceStats.minPrice.station}`}
                  </>
                ) : (
                  lang === 'nl' ? 'Nog geen gegevens' : 'No data yet'
                )}
              </p>
            </div>
          </div>

          {/* Duurste Tankbeurt */}
          <div className="p-4 bg-rose-50/50 dark:bg-rose-950/20 rounded-xl border border-rose-200/80 dark:border-rose-800/50 flex flex-col justify-between">
            <div className="flex items-center justify-between text-rose-800 dark:text-rose-400 mb-1.5">
              <span className="text-xs font-bold flex items-center space-x-1">
                <TrendingUp className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                <span>{t('mostExpensiveFuel')}</span>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300">
                {lang === 'nl' ? 'Hoogste prijs' : 'Highest price'}
              </span>
            </div>
            <div>
              <div className="text-2xl font-black text-rose-700 dark:text-rose-400 font-mono">
                {tco?.priceStats?.maxPrice ? `€ ${tco.priceStats.maxPrice.price.toFixed(3)}` : '—'}{' '}
                <span className="text-xs font-normal text-rose-600/70 dark:text-rose-400/70">/ L</span>
              </div>
              <p className="text-[11px] text-rose-800/80 dark:text-rose-400/80 mt-1">
                {tco?.priceStats?.maxPrice ? (
                  <>
                    <span className="font-semibold">{formatDisplayDate(tco.priceStats.maxPrice.date)}</span> • {tco.priceStats.maxPrice.liters.toFixed(1)} L
                    {tco.priceStats.maxPrice.station && ` • ${tco.priceStats.maxPrice.station}`}
                  </>
                ) : (
                  lang === 'nl' ? 'Nog geen gegevens' : 'No data yet'
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Interactive Price Evolution Chart */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
              <Coins className="w-3.5 h-3.5 text-amber-500" />
              <span>{t('priceEvolution')}</span>
            </h4>
            <div className="flex items-center space-x-3 text-[11px] text-slate-500">
              <span className="flex items-center space-x-1">
                <span className="w-3 h-0.5 bg-amber-500 inline-block rounded" />
                <span>{lang === 'nl' ? 'Literprijs (€/L)' : 'Price / L (€)'}</span>
              </span>
              {tco?.priceStats?.avgPrice && (
                <span className="flex items-center space-x-1">
                  <span className="w-3 h-0.5 border-t border-dashed border-sky-400 inline-block" />
                  <span>{lang === 'nl' ? 'Gemiddelde' : 'Average'} (€{tco.priceStats.avgPrice.toFixed(3)})</span>
                </span>
              )}
            </div>
          </div>

          <div className="h-64 w-full bg-slate-50/50 dark:bg-slate-950/40 rounded-xl p-3 border border-slate-200/60 dark:border-slate-800/60">
            {tco?.priceStats?.history && tco.priceStats.history.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={tco.priceStats.history}>
                  <defs>
                    <linearGradient id="colorFuelPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" />
                  <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                  <YAxis
                    stroke="#94a3b8"
                    tick={{ fontSize: 10 }}
                    domain={['dataMin - 0.05', 'dataMax + 0.05']}
                    tickFormatter={(v) => `€${Number(v).toFixed(2)}`}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        const avg = tco?.priceStats?.avgPrice;
                        const diff = avg ? data.pricePerLiter - avg : 0;
                        return (
                          <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-xl text-white text-xs space-y-1">
                            <div className="font-bold text-slate-200 border-b border-slate-800 pb-1 mb-1 flex items-center justify-between gap-4">
                              <span>{formatDisplayDate(data.date)}</span>
                              <span className="font-mono text-slate-400">{data.odometer.toLocaleString()} km</span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-slate-400">{lang === 'nl' ? 'Literprijs:' : 'Price/L:'}</span>
                              <span className="font-mono font-black text-amber-400 text-sm">€ {data.pricePerLiter.toFixed(3)}/L</span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-slate-400">{lang === 'nl' ? 'Aantal liters:' : 'Volume:'}</span>
                              <span className="font-mono font-semibold">{data.liters.toFixed(2)} L</span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-slate-400">{lang === 'nl' ? 'Totaalbedrag:' : 'Total Cost:'}</span>
                              <span className="font-mono font-semibold">€ {data.totalCost.toFixed(2)}</span>
                            </div>
                            {data.station && (
                              <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-800/80 text-[11px]">
                                <span className="text-slate-400">{lang === 'nl' ? 'Pomp/Notitie:' : 'Station:'}</span>
                                <span className="text-slate-300 font-medium truncate max-w-[150px]">{data.station}</span>
                              </div>
                            )}
                            {avg && (
                              <div className="pt-1 text-[10px] font-medium flex items-center space-x-1">
                                <span className={diff > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                                  {diff > 0 ? `+€${diff.toFixed(3)}` : `-€${Math.abs(diff).toFixed(3)}`} {diff > 0 ? t('aboveAverage') : t('belowAverage')}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  {tco?.priceStats?.avgPrice && (
                    <ReferenceLine
                      y={tco.priceStats.avgPrice}
                      stroke="#38bdf8"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="pricePerLiter"
                    name={lang === 'nl' ? 'Literprijs (€/L)' : 'Price / L (€)'}
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorFuelPrice)"
                    dot={{ r: 3, fill: '#f59e0b', strokeWidth: 1, stroke: '#ffffff' }}
                    activeDot={{ r: 5, fill: '#f59e0b' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                {lang === 'nl' ? 'Voer minimaal 1 tankbeurt in om het brandstofprijsverloop te zien.' : 'Log at least 1 fill-up to view fuel price evolution.'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Uitgebreide Tank- & Actieradius Statistieken */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 space-y-6 shadow-sm transition-colors">
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

          {/* Towing Consumption Split */}
          {Boolean(tco?.fuelStats?.avgTowingLPer100Km) && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
              <div className="flex items-center space-x-2">
                <span className="text-xl">🏕️</span>
                <div>
                  <span className="font-bold text-amber-900 dark:text-amber-300">
                    {lang === 'nl' ? 'Caravan / Aanhanger Verbruiksvergelijking' : 'Towing / Trailer Consumption Split'}
                  </span>
                  <p className="text-[11px] text-amber-700/80 dark:text-amber-400">
                    {lang === 'nl'
                      ? 'Verbruikscijfers gesplitst op basis van tankbeurten met aanhanger/caravan.'
                      : 'Fuel consumption isolated for towing vs. solo driving.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-4 font-mono font-bold self-end sm:self-auto">
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block font-sans">SOLO VERBRUIK</span>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {tco?.fuelStats?.avgNormalLPer100Km ? `${tco.fuelStats.avgNormalLPer100Km.toFixed(2)} L/100km` : '—'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block font-sans">MET AANHANGER</span>
                  <span className="text-amber-600 dark:text-amber-400">
                    {tco?.fuelStats?.avgTowingLPer100Km ? `${tco.fuelStats.avgTowingLPer100Km.toFixed(2)} L/100km` : '—'}
                  </span>
                </div>
              </div>
            </div>
          )}

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

        </>
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
