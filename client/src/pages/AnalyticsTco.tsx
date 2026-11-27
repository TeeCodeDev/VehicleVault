import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  LineChart as LineChartIcon,
  FileDown,
  Building2,
  Car,
  Download,
} from 'lucide-react';
import { Vehicle, TcoSummary } from '../types/index.js';
import { apiFetch } from '../api/client.js';
import { PdfExportModal } from '../components/PdfExportModal.js';
import { useLanguage } from '../context/LanguageContext.js';
import { TcoFilters } from '../components/analytics/TcoFilters.js';
import { FleetAnalyticsView } from '../components/analytics/FleetAnalyticsView.js';
import { VehicleAnalyticsView } from '../components/analytics/VehicleAnalyticsView.js';

interface ContextType {
  vehicles: Vehicle[];
  selectedVehicle: Vehicle | null;
}

export const AnalyticsTco: React.FC = () => {
  const { vehicles, selectedVehicle } = useOutletContext<ContextType>();
  const { t } = useLanguage();
  const [reportScope, setReportScope] = useState<'vehicle' | 'fleet'>('vehicle');
  const [fleetVehicleType, setFleetVehicleType] = useState<string>('all');
  const [includeInactiveFleet, setIncludeInactiveFleet] = useState(false);
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
      if (fleetVehicleType && fleetVehicleType !== 'all') query += `&vehicleType=${fleetVehicleType}`;
      if (includeInactiveFleet) query += '&includeInactive=true';
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
    fleetVehicleType,
    includeInactiveFleet,
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
                <span>{t('fleetScope')}</span>
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
              ? t('fleetScopeSubtitle', { count: vehicles.length })
              : t('vehicleScopeSubtitle', { name: selectedVehicle.name })}
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <button
            onClick={exportCsv}
            className="px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 transition shadow-xs hover:scale-[1.02]"
            title={t('csvReportTooltip')}
          >
            <Download className="w-4 h-4 text-emerald-500" />
            <span>{t('csvReport')}</span>
          </button>

          {reportScope === 'vehicle' && (
            <button
              onClick={() => setIsPdfOpen(true)}
              className="px-4 py-2 bg-accent-600 hover:bg-accent-700 text-white rounded-xl text-xs font-bold inline-flex items-center space-x-2 transition shadow-xs hover:scale-[1.02]"
            >
              <FileDown className="w-4 h-4 text-sky-400" />
              <span>{t('exportPdf')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <TcoFilters
        timePreset={timePreset}
        onPresetChange={handlePresetChange}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        minOdometer={minOdometer}
        setMinOdometer={setMinOdometer}
        maxOdometer={maxOdometer}
        setMaxOdometer={setMaxOdometer}
        includePurchasePrice={includePurchasePrice}
        setIncludePurchasePrice={setIncludePurchasePrice}
        includeFixedExpenses={includeFixedExpenses}
        setIncludeFixedExpenses={setIncludeFixedExpenses}
        setTimePreset={setTimePreset}
        selectedVehicle={selectedVehicle}
        tco={tco}
      />

      {/* Analytics Content */}
      {reportScope === 'fleet' ? (
        <FleetAnalyticsView
          fleetData={fleetData}
          fleetLoading={fleetLoading}
          exportCsv={exportCsv}
          vehicleType={fleetVehicleType}
          onVehicleTypeChange={setFleetVehicleType}
          includeInactive={includeInactiveFleet}
          onIncludeInactiveChange={setIncludeInactiveFleet}
        />
      ) : (
        <VehicleAnalyticsView
          tco={tco}
          includePurchasePrice={includePurchasePrice}
          includeFixedExpenses={includeFixedExpenses}
          economyUnit={economyUnit}
          setEconomyUnit={setEconomyUnit}
          exportCsv={exportCsv}
        />
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
