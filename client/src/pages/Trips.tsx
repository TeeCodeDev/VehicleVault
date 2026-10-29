import React, { useEffect, useState, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Route as RouteIcon,
  Plus,
  FileSpreadsheet,
  FileText,
  ChevronDown,
  Loader2,
  Briefcase,
  Building2,
  Home,
  ArrowRight,
  ArrowLeftRight,
  Pencil,
  Trash2,
  Gauge,
  X,
  AlertCircle,
} from 'lucide-react';
import { Vehicle, Trip, TripSummary } from '../types/index.js';
import { apiFetch } from '../api/client.js';
import { useLanguage } from '../context/LanguageContext.js';
import { DatePicker } from '../components/DatePicker.js';
import { formatDisplayDate } from '../utils/format.js';
import { formatLicensePlate } from '../utils/licensePlate.js';

interface ContextType {
  vehicles: Vehicle[];
  selectedVehicle: Vehicle | null;
}

export const Trips: React.FC = () => {
  const { selectedVehicle } = useOutletContext<ContextType>();
  const { lang } = useLanguage();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [summary, setSummary] = useState<TripSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const currentYear = new Date().getFullYear().toString();
  const [selectedYear, setSelectedYear] = useState<string>(currentYear);
  const [selectedPurpose, setSelectedPurpose] = useState<string>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Form Fields
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [startOdo, setStartOdo] = useState<string>('');
  const [endOdo, setEndOdo] = useState<string>('');
  const [distanceKm, setDistanceKm] = useState<string>('');
  const [fromLoc, setFromLoc] = useState<string>('');
  const [toLoc, setToLoc] = useState<string>('');
  const [purpose, setPurpose] = useState<'business' | 'commute' | 'private'>('business');
  const [description, setDescription] = useState<string>('');
  const [createReturnTrip, setCreateReturnTrip] = useState<boolean>(false);

  const fetchTrips = async () => {
    if (!selectedVehicle) return;
    try {
      setLoading(true);
      setError(null);
      let url = `/api/trips?vehicleId=${selectedVehicle.id}`;
      if (selectedYear && selectedYear !== 'all') {
        url += `&year=${selectedYear}`;
      }
      if (selectedPurpose && selectedPurpose !== 'all') {
        url += `&purpose=${selectedPurpose}`;
      }
      const data = await apiFetch<{ trips: Trip[]; summary: TripSummary }>(url);
      setTrips(data.trips || []);
      setSummary(data.summary || null);
    } catch (err: any) {
      setError(err?.message || 'Kon ritten niet ophalen');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, [selectedVehicle?.id, selectedYear, selectedPurpose]);

  // Auto-calculate distance when odometers change
  const handleStartOdoChange = (val: string) => {
    setStartOdo(val);
    const s = parseFloat(val);
    const e = parseFloat(endOdo);
    if (!isNaN(s) && !isNaN(e) && e >= s) {
      setDistanceKm((e - s).toFixed(1));
    }
  };

  const handleEndOdoChange = (val: string) => {
    setEndOdo(val);
    const s = parseFloat(startOdo);
    const e = parseFloat(val);
    if (!isNaN(s) && !isNaN(e) && e >= s) {
      setDistanceKm((e - s).toFixed(1));
    }
  };

  const handleDistanceChange = (val: string) => {
    setDistanceKm(val);
    const d = parseFloat(val);
    const s = parseFloat(startOdo);
    if (!isNaN(d) && !isNaN(s) && d >= 0) {
      setEndOdo((s + d).toFixed(1));
    }
  };

  const openCreateModal = () => {
    setEditingTrip(null);
    setDate(new Date().toISOString().split('T')[0]);
    // Pre-fill start odometer from latest trip end odometer or vehicle current odometer
    const latestOdo = trips.length > 0 ? trips[0].end_odometer : (selectedVehicle?.initial_odometer || 0);
    setStartOdo(latestOdo ? latestOdo.toString() : '');
    setEndOdo('');
    setDistanceKm('');
    setFromLoc('');
    setToLoc('');
    setPurpose('business');
    setDescription('');
    setCreateReturnTrip(false);
    setModalError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (t: Trip) => {
    setEditingTrip(t);
    setDate(t.date);
    setStartOdo(t.start_odometer.toString());
    setEndOdo(t.end_odometer.toString());
    setDistanceKm(t.distance_km.toString());
    setFromLoc(t.from_location);
    setToLoc(t.to_location);
    setPurpose(t.purpose);
    setDescription(t.description || '');
    setCreateReturnTrip(false);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSaveTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle) return;

    const s = parseFloat(startOdo);
    const endVal = parseFloat(endOdo);
    const dist = parseFloat(distanceKm);

    if (isNaN(s) || isNaN(endVal) || endVal < s) {
      setModalError('Eindstand moet groter of gelijk zijn aan de beginstand.');
      return;
    }

    if (!fromLoc.trim() || !toLoc.trim()) {
      setModalError('Vertrek- en aankomstadres zijn verplicht.');
      return;
    }

    try {
      setSaving(true);
      setModalError(null);

      if (editingTrip) {
        await apiFetch(`/api/trips/${editingTrip.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            date,
            startOdometer: s,
            endOdometer: endVal,
            distanceKm: !isNaN(dist) ? dist : endVal - s,
            fromLocation: fromLoc.trim(),
            toLocation: toLoc.trim(),
            purpose,
            description: description.trim(),
          }),
        });
      } else {
        await apiFetch('/api/trips', {
          method: 'POST',
          body: JSON.stringify({
            vehicleId: selectedVehicle.id,
            date,
            startOdometer: s,
            endOdometer: endVal,
            distanceKm: !isNaN(dist) ? dist : endVal - s,
            fromLocation: fromLoc.trim(),
            toLocation: toLoc.trim(),
            purpose,
            description: description.trim(),
            isReturnTrip: false,
          }),
        });

        // If create return trip toggle is checked, also post return trip
        if (createReturnTrip) {
          const returnDist = !isNaN(dist) ? dist : endVal - s;
          const returnEnd = endVal + returnDist;
          await apiFetch('/api/trips', {
            method: 'POST',
            body: JSON.stringify({
              vehicleId: selectedVehicle.id,
              date,
              startOdometer: endVal,
              endOdometer: returnEnd,
              distanceKm: returnDist,
              fromLocation: toLoc.trim(),
              toLocation: fromLoc.trim(),
              purpose,
              description: description.trim() ? `${description.trim()} (Retour)` : 'Retourrit',
              isReturnTrip: true,
            }),
          });
        }
      }

      setIsModalOpen(false);
      fetchTrips();
    } catch (err: any) {
      setModalError(err?.message || 'Fout bij het opslaan van de rit');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickReturn = async (t: Trip) => {
    if (!selectedVehicle) return;
    try {
      const returnDist = Number(t.distance_km);
      const returnStart = Number(t.end_odometer);
      const returnEnd = returnStart + returnDist;

      await apiFetch('/api/trips', {
        method: 'POST',
        body: JSON.stringify({
          vehicleId: selectedVehicle.id,
          date: t.date,
          startOdometer: returnStart,
          endOdometer: returnEnd,
          distanceKm: returnDist,
          fromLocation: t.to_location,
          toLocation: t.from_location,
          purpose: t.purpose,
          description: t.description ? `${t.description} (Retour)` : 'Retourrit',
          isReturnTrip: true,
        }),
      });
      fetchTrips();
    } catch (err: any) {
      alert(err?.message || 'Kon retourrit niet toevoegen');
    }
  };

  const handleDeleteTrip = async (id: string) => {
    if (!window.confirm('Weet je zeker dat je deze rit wilt verwijderen?')) return;
    try {
      await apiFetch(`/api/trips/${id}`, { method: 'DELETE' });
      fetchTrips();
    } catch (err: any) {
      alert(err?.message || 'Kon rit niet verwijderen');
    }
  };

  // Export dropdown state
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [exportingType, setExportingType] = useState<string | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const triggerDownload = (blob: Blob, defaultFilename: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleDownloadCsv = async () => {
    if (!selectedVehicle) return;
    try {
      setExportingType('csv');
      let url = `/api/trips/export/csv?vehicleId=${selectedVehicle.id}`;
      if (selectedYear && selectedYear !== 'all') url += `&year=${selectedYear}`;
      const blob = await apiFetch<Blob>(url);
      const plate = selectedVehicle.license_plate ? selectedVehicle.license_plate.replace(/[^a-zA-Z0-9]/g, '_') : 'ritten';
      const yearStr = selectedYear && selectedYear !== 'all' ? selectedYear : 'compleet';
      triggerDownload(blob, `Rittenregistratie_${plate}_${yearStr}.csv`);
    } catch (err: any) {
      alert(err?.message || 'Kon CSV niet downloaden');
    } finally {
      setExportingType(null);
      setIsExportMenuOpen(false);
    }
  };

  const handleDownloadExcel = async () => {
    if (!selectedVehicle) return;
    try {
      setExportingType('excel');
      let url = `/api/trips/export/excel?vehicleId=${selectedVehicle.id}`;
      if (selectedYear && selectedYear !== 'all') url += `&year=${selectedYear}`;
      const blob = await apiFetch<Blob>(url);
      const plate = selectedVehicle.license_plate ? selectedVehicle.license_plate.replace(/[^a-zA-Z0-9]/g, '_') : 'ritten';
      const yearStr = selectedYear && selectedYear !== 'all' ? selectedYear : 'compleet';
      triggerDownload(blob, `Rittenregistratie_${plate}_${yearStr}.xlsx`);
    } catch (err: any) {
      alert(err?.message || 'Kon Excel niet downloaden');
    } finally {
      setExportingType(null);
      setIsExportMenuOpen(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!selectedVehicle) return;
    try {
      setExportingType('pdf');
      let url = `/api/trips/export/pdf?vehicleId=${selectedVehicle.id}`;
      if (selectedYear && selectedYear !== 'all') url += `&year=${selectedYear}`;
      const blob = await apiFetch<Blob>(url);
      const plate = selectedVehicle.license_plate ? selectedVehicle.license_plate.replace(/[^a-zA-Z0-9]/g, '_') : 'ritten';
      const yearStr = selectedYear && selectedYear !== 'all' ? selectedYear : 'compleet';
      triggerDownload(blob, `Rittenregistratie_${plate}_${yearStr}.pdf`);
    } catch (err: any) {
      alert(err?.message || 'Kon PDF niet downloaden');
    } finally {
      setExportingType(null);
      setIsExportMenuOpen(false);
    }
  };

  if (!selectedVehicle) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md mx-auto my-12">
        <RouteIcon className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Geen voertuig geselecteerd</h2>
        <p className="text-xs text-slate-500 mt-1">Selecteer een voertuig in de balk bovenin om ritten te bekijken of te registreren.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center space-x-2">
            <RouteIcon className="w-5 h-5 text-indigo-500" />
            <span>Ritregistratie</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Fiscaal sluitende kilometeradministratie voor de Belastingdienst ({selectedVehicle.name} • {formatLicensePlate(selectedVehicle.license_plate)}).
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Export Dropdown */}
          <div className="relative inline-block text-left" ref={exportMenuRef}>
            <button
              type="button"
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold inline-flex items-center space-x-2 transition border border-slate-200 dark:border-slate-700 shadow-sm"
            >
              {exportingType ? (
                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
              ) : (
                <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
              )}
              <span>Exporteren</span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isExportMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  Exportformaat kiezen
                </div>

                <button
                  type="button"
                  onClick={handleDownloadExcel}
                  disabled={!!exportingType}
                  className="w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center space-x-3 transition group"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                      Excel (.xlsx)
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Met opmaak, formules & KPI totalen
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={!!exportingType}
                  className="w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center space-x-3 transition group"
                >
                  <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-red-600 dark:group-hover:text-red-400">
                      PDF Rapport
                    </div>
                    <div className="text-[10px] text-slate-400">
                      A4 liggend voor belastingarchief
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  disabled={!!exportingType}
                  className="w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center space-x-3 transition group"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      Belastingdienst CSV
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Standaard UTF-8 met puntkomma
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>

          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-accent-600 hover:bg-accent-700 text-white rounded-xl text-xs font-bold inline-flex items-center space-x-2 shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Rit Toevoegen</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Totaal Afstand</span>
              <Gauge className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
              {summary.totalDistance.toLocaleString('nl-NL')} <span className="text-xs font-normal text-slate-500">km</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">{summary.totalTrips} ritten geregistreerd</div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Zakelijk</span>
              <Briefcase className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="mt-2 text-2xl font-black text-indigo-600 dark:text-indigo-400">
              {summary.businessDistance.toLocaleString('nl-NL')} <span className="text-xs font-normal text-slate-500">km</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 font-medium">{summary.businessPercentage}% zakelijk aandeel</div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">Woon-werk</span>
              <Building2 className="w-4 h-4 text-sky-500" />
            </div>
            <div className="mt-2 text-2xl font-black text-sky-600 dark:text-sky-400">
              {summary.commuteDistance.toLocaleString('nl-NL')} <span className="text-xs font-normal text-slate-500">km</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Vaste woon-werkkilometers</div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Privé</span>
              <Home className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {summary.privateDistance.toLocaleString('nl-NL')} <span className="text-xs font-normal text-slate-500">km</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {summary.privateDistance <= 500 ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Onder de 500 km grens</span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400 font-semibold">Boven de 500 km grens</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 shadow-sm">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Jaar:</span>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Alle jaren</option>
            <option value={currentYear}>{currentYear}</option>
            <option value={(parseInt(currentYear) - 1).toString()}>{parseInt(currentYear) - 1}</option>
            <option value={(parseInt(currentYear) - 2).toString()}>{parseInt(currentYear) - 2}</option>
          </select>
        </div>

        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => setSelectedPurpose('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              selectedPurpose === 'all'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Alle Ritten
          </button>
          <button
            onClick={() => setSelectedPurpose('business')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition inline-flex items-center space-x-1.5 ${
              selectedPurpose === 'business'
                ? 'bg-accent-600 text-white shadow-sm'
                : 'text-accent-600 dark:text-accent-400 hover:bg-accent-50 dark:hover:bg-accent-100/10'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Zakelijk</span>
          </button>
          <button
            onClick={() => setSelectedPurpose('commute')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition inline-flex items-center space-x-1.5 ${
              selectedPurpose === 'commute'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Woon-werk</span>
          </button>
          <button
            onClick={() => setSelectedPurpose('private')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition inline-flex items-center space-x-1.5 ${
              selectedPurpose === 'private'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span>Privé</span>
          </button>
        </div>
      </div>

      {/* Trips Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500 font-mono">Ritten laden...</div>
        ) : error ? (
          <div className="p-6 text-center text-xs text-rose-500">{error}</div>
        ) : trips.length === 0 ? (
          <div className="p-12 text-center">
            <RouteIcon className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Nog geen ritten geregistreerd</h3>
            <p className="text-xs text-slate-500 mt-1">Begin direct met het vastleggen van je zakelijke en privé kilometers.</p>
            <button
              onClick={openCreateModal}
              className="mt-4 px-4 py-2 bg-accent-600 hover:bg-accent-700 text-white rounded-xl text-xs font-bold inline-flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Eerste Rit Vastleggen</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-950/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Datum</th>
                  <th className="py-3 px-4">Traject (Van ➔ Naar)</th>
                  <th className="py-3 px-4">Karakter</th>
                  <th className="py-3 px-4 text-right">Begin (km)</th>
                  <th className="py-3 px-4 text-right">Eind (km)</th>
                  <th className="py-3 px-4 text-right">Afstand</th>
                  <th className="py-3 px-4">Toelichting</th>
                  <th className="py-3 px-4 text-center">Acties</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {trips.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-700 dark:text-slate-300">
                      {formatDisplayDate(t.date, lang)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-1.5 font-semibold text-slate-900 dark:text-white">
                        <span>{t.from_location}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{t.to_location}</span>
                      </div>
                      {Boolean(t.is_return_trip) && (
                        <span className="inline-flex items-center space-x-1 text-[10px] text-indigo-500 font-bold mt-0.5">
                          <ArrowLeftRight className="w-3 h-3" />
                          <span>Retourrit</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {t.purpose === 'business' ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60">
                          <Briefcase className="w-3 h-3" />
                          <span>Zakelijk</span>
                        </span>
                      ) : t.purpose === 'commute' ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-400 border border-sky-200 dark:border-sky-800/60">
                          <Building2 className="w-3 h-3" />
                          <span>Woon-werk</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                          <Home className="w-3 h-3" />
                          <span>Privé</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-400">
                      {t.start_odometer.toLocaleString('nl-NL')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-400">
                      {t.end_odometer.toLocaleString('nl-NL')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                      {t.distance_km} km
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                      {t.description || '-'}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <div className="inline-flex items-center space-x-1">
                        <button
                          onClick={() => handleQuickReturn(t)}
                          title="1-klik Terugrit toevoegen"
                          className="p-1.5 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEditModal(t)}
                          title="Bewerken"
                          className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTrip(t.id)}
                          title="Verwijderen"
                          className="p-1.5 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <RouteIcon className="w-4 h-4 text-indigo-500" />
                <span>{editingTrip ? 'Rit Bewerken' : 'Nieuwe Rit Registreren'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-400 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveTrip} className="space-y-4">
              {/* Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Datum</label>
                <DatePicker value={date} onChange={setDate} />
              </div>

              {/* Traject: Van -> Naar */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Vertrekadres</label>
                  <input
                    type="text"
                    required
                    placeholder="bijv. Thuis, Amsterdam"
                    value={fromLoc}
                    onChange={(e) => setFromLoc(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Aankomstadres</label>
                  <input
                    type="text"
                    required
                    placeholder="bijv. Kantoor, Utrecht"
                    value={toLoc}
                    onChange={(e) => setToLoc(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Odometer & Distance */}
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Beginstand (km)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={startOdo}
                    onChange={(e) => handleStartOdoChange(e.target.value)}
                    className="w-full text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Eindstand (km)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={endOdo}
                    onChange={(e) => handleEndOdoChange(e.target.value)}
                    className="w-full text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Afstand (km)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={distanceKm}
                    onChange={(e) => handleDistanceChange(e.target.value)}
                    className="w-full text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Karakter / Purpose Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Karakter van de rit</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPurpose('business')}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition flex items-center justify-center space-x-1.5 ${
                      purpose === 'business'
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-700 dark:text-indigo-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Briefcase className="w-3.5 h-3.5" />
                    <span>Zakelijk</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPurpose('commute')}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition flex items-center justify-center space-x-1.5 ${
                      purpose === 'commute'
                        ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-500 text-sky-700 dark:text-sky-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Woon-werk</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPurpose('private')}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition flex items-center justify-center space-x-1.5 ${
                      purpose === 'private'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Home className="w-3.5 h-3.5" />
                    <span>Privé</span>
                  </button>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Toelichting / Project / Klant</label>
                <input
                  type="text"
                  placeholder="bijv. Klantafspraak Romani B.V."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Return trip toggle (only on create) */}
              {!editingTrip && (
                <div className="flex items-center space-x-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
                  <input
                    type="checkbox"
                    id="returnTripCheckbox"
                    checked={createReturnTrip}
                    onChange={(e) => setCreateReturnTrip(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="returnTripCheckbox" className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                    Direct ook de terugrit aanmaken (omgekeerde route)
                  </label>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-bold bg-accent-600 hover:bg-accent-700 text-white rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {saving ? 'Opslaan...' : 'Rit Opslaan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
