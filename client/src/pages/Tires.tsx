import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Disc,
  Sun,
  Snowflake,
  CloudSun,
  Plus,
  ArrowLeftRight,
  Gauge,
  Warehouse,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Pencil,
  Trash2,
  X,
  Info,
} from 'lucide-react';
import { Vehicle, TireSet } from '../types/index.js';
import { apiFetch } from '../api/client.js';
import { DatePicker } from '../components/DatePicker.js';
import { formatLicensePlate } from '../utils/licensePlate.js';

interface ContextType {
  vehicles: Vehicle[];
  selectedVehicle: Vehicle | null;
}

export const Tires: React.FC = () => {
  const { selectedVehicle } = useOutletContext<ContextType>();

  const [tireSets, setTireSets] = useState<TireSet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingSet, setEditingSet] = useState<TireSet | null>(null);
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [swapTargetSet, setSwapTargetSet] = useState<TireSet | null>(null);
  const [isTreadModalOpen, setIsTreadModalOpen] = useState(false);
  const [treadTargetSet, setTreadTargetSet] = useState<TireSet | null>(null);

  // Form states
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Add/Edit Fields
  const [name, setName] = useState('');
  const [season, setSeason] = useState<'summer' | 'winter' | 'all_season'>('summer');
  const [brandModel, setBrandModel] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [tireSize, setTireSize] = useState('');
  const [rimSize, setRimSize] = useState('');
  const [speedIndex, setSpeedIndex] = useState('');
  const [dotCode, setDotCode] = useState('');
  const [storageLocation, setStorageLocation] = useState('');
  const [status, setStatus] = useState<'mounted' | 'stored' | 'disposed'>('stored');
  const [treadFl, setTreadFl] = useState('');
  const [treadFr, setTreadFr] = useState('');
  const [treadRl, setTreadRl] = useState('');
  const [treadRr, setTreadRr] = useState('');
  const [notes, setNotes] = useState('');

  // Swap modal state
  const [swapOdometer, setSwapOdometer] = useState('');
  const [swapDate, setSwapDate] = useState(new Date().toISOString().split('T')[0]);

  // Quick tread modal state
  const [quickFl, setQuickFl] = useState('');
  const [quickFr, setQuickFr] = useState('');
  const [quickRl, setQuickRl] = useState('');
  const [quickRr, setQuickRr] = useState('');
  const [quickDate, setQuickDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchTireSets = async () => {
    if (!selectedVehicle) return;
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch<{ tireSets: TireSet[] }>(`/api/tires?vehicleId=${selectedVehicle.id}`);
      setTireSets(res.tireSets || []);
    } catch (err: any) {
      setError(err?.message || 'Kon bandensets niet ophalen');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTireSets();
  }, [selectedVehicle?.id]);

  const activeMountedSet = tireSets.find((s) => s.status === 'mounted');

  const openCreateModal = () => {
    setEditingSet(null);
    setName('');
    setSeason('summer');
    setBrandModel('');
    setBrand('');
    setModel('');
    setTireSize('');
    setRimSize('');
    setSpeedIndex('');
    setDotCode('');
    setStorageLocation('');
    setStatus(tireSets.length === 0 ? 'mounted' : 'stored');
    setTreadFl('7.5');
    setTreadFr('7.5');
    setTreadRl('7.5');
    setTreadRr('7.5');
    setNotes('');
    setModalError(null);
    setIsAddEditModalOpen(true);
  };

  const openEditModal = (set: TireSet) => {
    setEditingSet(set);
    setName(set.name);
    setSeason(set.season);
    setBrandModel(set.brand_model || '');
    setBrand(set.brand || (set.brand_model ? set.brand_model.split(' ')[0] : ''));
    setModel(set.model || (set.brand_model && set.brand_model.includes(' ') ? set.brand_model.substring(set.brand_model.indexOf(' ') + 1) : ''));
    setTireSize(set.tire_size || '');
    setRimSize(set.rim_size || '');
    setSpeedIndex(set.speed_index || '');
    setDotCode(set.dot_code || '');
    setStorageLocation(set.storage_location || '');
    setStatus(set.status);
    setTreadFl(set.tread_depth_fl !== null ? set.tread_depth_fl.toString() : '');
    setTreadFr(set.tread_depth_fr !== null ? set.tread_depth_fr.toString() : '');
    setTreadRl(set.tread_depth_rl !== null ? set.tread_depth_rl.toString() : '');
    setTreadRr(set.tread_depth_rr !== null ? set.tread_depth_rr.toString() : '');
    setNotes(set.notes || '');
    setModalError(null);
    setIsAddEditModalOpen(true);
  };

  const openSwapModal = (target: TireSet) => {
    setSwapTargetSet(target);
    setSwapOdometer(selectedVehicle?.initial_odometer ? selectedVehicle.initial_odometer.toString() : '');
    setSwapDate(new Date().toISOString().split('T')[0]);
    setModalError(null);
    setIsSwapModalOpen(true);
  };

  const openTreadModal = (target: TireSet) => {
    setTreadTargetSet(target);
    setQuickFl(target.tread_depth_fl !== null ? target.tread_depth_fl.toString() : '');
    setQuickFr(target.tread_depth_fr !== null ? target.tread_depth_fr.toString() : '');
    setQuickRl(target.tread_depth_rl !== null ? target.tread_depth_rl.toString() : '');
    setQuickRr(target.tread_depth_rr !== null ? target.tread_depth_rr.toString() : '');
    setQuickDate(new Date().toISOString().split('T')[0]);
    setModalError(null);
    setIsTreadModalOpen(true);
  };

  const handleSaveTireSet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle) return;

    if (!name.trim()) {
      setModalError('Naam van de bandenset is verplicht.');
      return;
    }

    try {
      setSaving(true);
      setModalError(null);

      const payload = {
        name: name.trim(),
        season,
        brand: brand.trim(),
        model: model.trim(),
        brandModel: brand.trim() ? `${brand.trim()}${model.trim() ? ` ${model.trim()}` : ''}` : brandModel.trim(),
        tireSize: tireSize.trim(),
        rimSize: rimSize.trim(),
        speedIndex: speedIndex.trim(),
        dotCode: dotCode.trim(),
        storageLocation: storageLocation.trim(),
        status,
        treadDepthFl: treadFl !== '' ? parseFloat(treadFl) : null,
        treadDepthFr: treadFr !== '' ? parseFloat(treadFr) : null,
        treadDepthRl: treadRl !== '' ? parseFloat(treadRl) : null,
        treadDepthRr: treadRr !== '' ? parseFloat(treadRr) : null,
        notes: notes.trim(),
      };

      if (editingSet) {
        await apiFetch(`/api/tires/${editingSet.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/tires', {
          method: 'POST',
          body: JSON.stringify({
            vehicleId: selectedVehicle.id,
            ...payload,
          }),
        });
      }

      setIsAddEditModalOpen(false);
      fetchTireSets();
    } catch (err: any) {
      setModalError(err?.message || 'Fout bij opslaan van bandenset');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!swapTargetSet) return;

    const odo = parseFloat(swapOdometer);
    if (isNaN(odo) || odo < 0) {
      setModalError('Voer een geldige kilometerstand in.');
      return;
    }

    try {
      setSaving(true);
      setModalError(null);
      await apiFetch(`/api/tires/${swapTargetSet.id}/swap`, {
        method: 'POST',
        body: JSON.stringify({
          currentOdometer: odo,
          date: swapDate,
        }),
      });
      setIsSwapModalOpen(false);
      fetchTireSets();
    } catch (err: any) {
      setModalError(err?.message || 'Fout bij het wisselen van bandenset');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!treadTargetSet) return;

    try {
      setSaving(true);
      setModalError(null);
      await apiFetch(`/api/tires/${treadTargetSet.id}/tread`, {
        method: 'PATCH',
        body: JSON.stringify({
          fl: quickFl !== '' ? parseFloat(quickFl) : null,
          fr: quickFr !== '' ? parseFloat(quickFr) : null,
          rl: quickRl !== '' ? parseFloat(quickRl) : null,
          rr: quickRr !== '' ? parseFloat(quickRr) : null,
          date: quickDate,
        }),
      });
      setIsTreadModalOpen(false);
      fetchTireSets();
    } catch (err: any) {
      setModalError(err?.message || 'Fout bij opslaan van profieldieptes');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTireSet = async (id: string) => {
    if (!window.confirm('Weet je zeker dat je deze bandenset wilt verwijderen?')) return;
    try {
      await apiFetch(`/api/tires/${id}`, { method: 'DELETE' });
      fetchTireSets();
    } catch (err: any) {
      alert(err?.message || 'Kon bandenset niet verwijderen');
    }
  };

  const getTreadColorClass = (depth: number | null | undefined, season: string) => {
    if (depth === null || depth === undefined) return 'text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700';
    if (depth < 1.6) return 'text-rose-700 bg-rose-100 dark:bg-rose-950/70 border-rose-300 dark:border-rose-700 font-black'; // Critical limit
    if (season === 'winter' && depth < 4.0) return 'text-amber-700 bg-amber-100 dark:bg-amber-950/70 border-amber-300 dark:border-amber-700 font-bold'; // Winter safety threshold
    if (depth < 2.5) return 'text-amber-700 bg-amber-100 dark:bg-amber-950/70 border-amber-300 dark:border-amber-700 font-bold'; // Wear warning
    return 'text-emerald-700 bg-emerald-100 dark:bg-emerald-950/70 border-emerald-300 dark:border-emerald-700 font-bold'; // Good
  };

  if (!selectedVehicle) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md mx-auto my-12">
        <Disc className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Geen voertuig geselecteerd</h2>
        <p className="text-xs text-slate-500 mt-1">Selecteer een voertuig in de balk bovenin om bandensets te beheren.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center space-x-2">
            <Disc className="w-5 h-5 text-amber-500" />
            <span>Bandenbeheer</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Beheer zomer-, winter- en 4-seizoenssets, profieldieptes per wiel en seizoenswissels ({selectedVehicle.name} • {formatLicensePlate(selectedVehicle.license_plate)}).
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-accent-600 hover:bg-accent-700 text-white rounded-xl text-xs font-bold inline-flex items-center space-x-2 shadow-sm transition self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Bandenset Toevoegen</span>
        </button>
      </div>

      {/* Active Mounted Tire Set Hero Card */}
      {activeMountedSet ? (
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-6 shadow-xl border border-slate-700/60 relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div className="space-y-3">
              <div className="flex items-center space-x-2.5">
                <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Momenteel Gemonteerd</span>
                </span>

                <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-white/10 text-white/90 border border-white/10 flex items-center space-x-1.5">
                  {activeMountedSet.season === 'summer' ? (
                    <>
                      <Sun className="w-3.5 h-3.5 text-amber-400" />
                      <span>Zomerset</span>
                    </>
                  ) : activeMountedSet.season === 'winter' ? (
                    <>
                      <Snowflake className="w-3.5 h-3.5 text-sky-400" />
                      <span>Winterset</span>
                    </>
                  ) : (
                    <>
                      <CloudSun className="w-3.5 h-3.5 text-emerald-400" />
                      <span>4-Seizoenen</span>
                    </>
                  )}
                </span>
              </div>

              <div>
                <h2 className="text-xl font-black tracking-tight">{activeMountedSet.name}</h2>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="text-xs font-bold text-white">
                    {activeMountedSet.brand 
                      ? `${activeMountedSet.brand}${activeMountedSet.model ? ` ${activeMountedSet.model}` : ''}`
                      : (activeMountedSet.brand_model || 'Merk onbekend')}
                  </span>
                  {activeMountedSet.tire_size && (
                    <span className="px-2 py-0.5 rounded-md bg-white/10 text-slate-200 font-mono text-[11px] font-bold border border-white/10">
                      {activeMountedSet.tire_size}
                    </span>
                  )}
                  {activeMountedSet.rim_size && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-300 font-mono text-[11px] font-bold border border-amber-400/30">
                      {activeMountedSet.rim_size} velgen
                    </span>
                  )}
                  {activeMountedSet.speed_index && (
                    <span className="px-2 py-0.5 rounded-md bg-sky-400/20 text-sky-200 font-mono text-[11px] font-bold border border-sky-400/30" title="Draagkracht & snelheidsindex">
                      Index: {activeMountedSet.speed_index}
                    </span>
                  )}
                  {activeMountedSet.dot_code && (
                    <span className="px-2 py-0.5 rounded-md bg-white/10 text-slate-300 font-mono text-[11px] border border-white/10">
                      DOT {activeMountedSet.dot_code}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-1 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Gereden Kilometers</span>
                  <span className="text-sm font-black font-mono text-white">{(activeMountedSet.total_km || 0).toLocaleString('nl-NL')} km</span>
                </div>
                {activeMountedSet.storage_location && (
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Opslaglocatie (indien gewisseld)</span>
                    <span className="text-sm font-semibold text-slate-200">{activeMountedSet.storage_location}</span>
                  </div>
                )}
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Wettelijke Status</span>
                  {activeMountedSet.treadStatus === 'critical' ? (
                    <span className="text-xs font-black text-rose-400 flex items-center space-x-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Afkeur APK (&lt;1.6 mm)</span>
                    </span>
                  ) : activeMountedSet.treadStatus === 'warning' ? (
                    <span className="text-xs font-bold text-amber-300 flex items-center space-x-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Vervanging advies</span>
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-emerald-400 flex items-center space-x-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Veilig profiel</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-2 flex items-center space-x-2">
                <button
                  onClick={() => openTreadModal(activeMountedSet)}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition inline-flex items-center space-x-1.5 border border-white/15"
                >
                  <Gauge className="w-3.5 h-3.5 text-amber-400" />
                  <span>Profieldiepte Meten</span>
                </button>
                <button
                  onClick={() => openEditModal(activeMountedSet)}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition"
                >
                  Details Bewerken
                </button>
              </div>
            </div>

            {/* Visual 4-Wheel Chassis Tread Depth Diagram */}
            <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-700/80 shrink-0 self-center">
              <div className="text-[11px] font-bold text-slate-400 text-center mb-3 uppercase tracking-wider flex items-center justify-center space-x-1">
                <span>Voertuig Onderstel (Bovenaanzicht)</span>
              </div>
              
              <div className="relative w-52 h-44 mx-auto flex flex-col justify-between p-2">
                {/* Car Silhouette Center Box */}
                <div className="absolute inset-x-12 inset-y-4 border-2 border-dashed border-slate-700 rounded-2xl flex items-center justify-center">
                  <div className="text-center text-[10px] text-slate-500 font-bold uppercase tracking-widest rotate-90">
                    VOOR ➔
                  </div>
                </div>

                {/* Front Row (Left Front & Right Front) */}
                <div className="flex items-center justify-between z-10">
                  <div className={`p-2 rounded-xl border text-center min-w-[70px] ${getTreadColorClass(activeMountedSet.tread_depth_fl, activeMountedSet.season)} shadow-sm`}>
                    <div className="text-[9px] uppercase font-bold tracking-wider">LV</div>
                    <div className="text-xs font-black">{activeMountedSet.tread_depth_fl !== null ? `${activeMountedSet.tread_depth_fl} mm` : '-'}</div>
                  </div>

                  <div className={`p-2 rounded-xl border text-center min-w-[70px] ${getTreadColorClass(activeMountedSet.tread_depth_fr, activeMountedSet.season)} shadow-sm`}>
                    <div className="text-[9px] uppercase font-bold tracking-wider">RV</div>
                    <div className="text-xs font-black">{activeMountedSet.tread_depth_fr !== null ? `${activeMountedSet.tread_depth_fr} mm` : '-'}</div>
                  </div>
                </div>

                {/* Rear Row (Left Rear & Right Rear) */}
                <div className="flex items-center justify-between z-10">
                  <div className={`p-2 rounded-xl border text-center min-w-[70px] ${getTreadColorClass(activeMountedSet.tread_depth_rl, activeMountedSet.season)} shadow-sm`}>
                    <div className="text-[9px] uppercase font-bold tracking-wider">LA</div>
                    <div className="text-xs font-black">{activeMountedSet.tread_depth_rl !== null ? `${activeMountedSet.tread_depth_rl} mm` : '-'}</div>
                  </div>

                  <div className={`p-2 rounded-xl border text-center min-w-[70px] ${getTreadColorClass(activeMountedSet.tread_depth_rr, activeMountedSet.season)} shadow-sm`}>
                    <div className="text-[9px] uppercase font-bold tracking-wider">RA</div>
                    <div className="text-xs font-black">{activeMountedSet.tread_depth_rr !== null ? `${activeMountedSet.tread_depth_rr} mm` : '-'}</div>
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 text-center mt-2 flex items-center justify-center space-x-3">
                <span className="inline-flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>&gt; 3.0 mm</span>
                </span>
                <span className="inline-flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span>&lt; 2.5 mm</span>
                </span>
                <span className="inline-flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                  <span>&lt; 1.6 mm APK</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-5 flex items-center space-x-4">
          <AlertCircle className="w-8 h-8 text-amber-500 shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">Geen actieve bandenset gemonteerd</h3>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              Markeer een van je opgeslagen bandensets hieronder als &apos;Gemonteerd&apos; of voeg een nieuwe set toe om kilometers en profiel te registreren.
            </p>
          </div>
        </div>
      )}

      {/* All Tire Sets Grid */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
          <Warehouse className="w-4 h-4 text-slate-500" />
          <span>Alle Bandensets ({tireSets.length})</span>
        </h2>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500 font-mono">Bandensets laden...</div>
        ) : error ? (
          <div className="p-6 text-center text-xs text-rose-500">{error}</div>
        ) : tireSets.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center">
            <Disc className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Geen bandensets opgeslagen</h3>
            <p className="text-xs text-slate-500 mt-1">Voeg je eerste set zomer- of winterbanden toe.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tireSets.map((set) => (
              <div
                key={set.id}
                className={`bg-white dark:bg-slate-900 border rounded-2xl p-4 shadow-sm transition flex flex-col justify-between ${
                  set.status === 'mounted'
                    ? 'border-emerald-500/80 ring-1 ring-emerald-500/20'
                    : 'border-slate-200/80 dark:border-slate-800'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {set.season === 'summer' ? (
                        <>
                          <Sun className="w-3 h-3 text-amber-500" />
                          <span>Zomer</span>
                        </>
                      ) : set.season === 'winter' ? (
                        <>
                          <Snowflake className="w-3 h-3 text-sky-500" />
                          <span>Winter</span>
                        </>
                      ) : (
                        <>
                          <CloudSun className="w-3 h-3 text-emerald-500" />
                          <span>4-Seizoenen</span>
                        </>
                      )}
                    </span>

                    <span
                      className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                        set.status === 'mounted'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                          : set.status === 'stored'
                          ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                      }`}
                    >
                      {set.status === 'mounted' ? 'Gemonteerd' : set.status === 'stored' ? 'Opgeslagen' : 'Afgedankt'}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{set.name}</h3>
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
                      {set.brand 
                        ? `${set.brand}${set.model ? ` ${set.model}` : ''}`
                        : (set.brand_model || 'Geen merk opgegeven')}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {set.tire_size && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[10px] font-bold border border-slate-200 dark:border-slate-700">
                          {set.tire_size}
                        </span>
                      )}
                      {set.rim_size && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 font-mono text-[10px] font-bold border border-amber-200 dark:border-amber-800/60">
                          {set.rim_size}
                        </span>
                      )}
                      {set.speed_index && (
                        <span className="px-1.5 py-0.5 rounded bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-400 font-mono text-[10px] font-bold border border-sky-200 dark:border-sky-800/60" title="Draagkracht- & snelheidsindex">
                          {set.speed_index}
                        </span>
                      )}
                      {set.dot_code && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-mono text-[10px]">
                          DOT {set.dot_code}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100 dark:border-slate-800/80">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Totaal gereden</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {(set.total_km || 0).toLocaleString('nl-NL')} km
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">
                        {set.status === 'mounted' ? 'Locatie' : 'Opslagplek'}
                      </span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300 truncate block">
                        {set.status === 'mounted'
                          ? 'Gemonteerd op voertuig'
                          : (set.storage_location || 'Niet gespecificeerd')}
                      </span>
                    </div>
                  </div>

                  {/* Tread depths summary pill row */}
                  <div className="pt-1 flex items-center justify-between text-center bg-slate-50 dark:bg-slate-950/60 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="text-[11px]">
                      <span className="text-[9px] text-slate-400 font-bold block">LV</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{set.tread_depth_fl ?? '-'} mm</span>
                    </div>
                    <div className="text-[11px]">
                      <span className="text-[9px] text-slate-400 font-bold block">RV</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{set.tread_depth_fr ?? '-'} mm</span>
                    </div>
                    <div className="text-[11px]">
                      <span className="text-[9px] text-slate-400 font-bold block">LA</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{set.tread_depth_rl ?? '-'} mm</span>
                    </div>
                    <div className="text-[11px]">
                      <span className="text-[9px] text-slate-400 font-bold block">RA</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{set.tread_depth_rr ?? '-'} mm</span>
                    </div>
                  </div>
                </div>

                {/* Action footer */}
                <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => openEditModal(set)}
                      title="Bewerken"
                      className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => openTreadModal(set)}
                      title="Profieldiepte Meten"
                      className="p-1.5 text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                    >
                      <Gauge className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteTireSet(set.id)}
                      title="Verwijderen"
                      className="p-1.5 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {set.status !== 'mounted' && (
                    <button
                      onClick={() => openSwapModal(set)}
                      className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 rounded-xl text-xs font-bold transition inline-flex items-center space-x-1 border border-amber-200 dark:border-amber-800/60"
                    >
                      <ArrowLeftRight className="w-3 h-3" />
                      <span>Nu Monteren</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Tire Set Modal */}
      {isAddEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Disc className="w-4 h-4 text-amber-500" />
                <span>{editingSet ? 'Bandenset Bewerken' : 'Nieuwe Bandenset Toevoegen'}</span>
              </h3>
              <button
                onClick={() => setIsAddEditModalOpen(false)}
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

            <form onSubmit={handleSaveTireSet} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Naam van de set</label>
                <input
                  type="text"
                  required
                  placeholder="bijv. Zomerset 18 inch sportvelgen"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Season pills */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Seizoen</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSeason('summer')}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition flex items-center justify-center space-x-1.5 ${
                      season === 'summer'
                        ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-500 text-amber-700 dark:text-amber-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                    <span>Zomer</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSeason('winter')}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition flex items-center justify-center space-x-1.5 ${
                      season === 'winter'
                        ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-500 text-sky-700 dark:text-sky-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Snowflake className="w-3.5 h-3.5 text-sky-500" />
                    <span>Winter</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSeason('all_season')}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition flex items-center justify-center space-x-1.5 ${
                      season === 'all_season'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <CloudSun className="w-3.5 h-3.5 text-emerald-500" />
                    <span>4-Seizoenen</span>
                  </button>
                </div>
              </div>

              {/* Merk & Model apart */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Bandenmerk
                  </label>
                  <input
                    type="text"
                    list="tire-brands-list"
                    placeholder="bijv. Continental of Michelin"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                  />
                  <datalist id="tire-brands-list">
                    <option value="Continental" />
                    <option value="Michelin" />
                    <option value="Bridgestone" />
                    <option value="Goodyear" />
                    <option value="Pirelli" />
                    <option value="Hankook" />
                    <option value="Vredestein" />
                    <option value="Dunlop" />
                    <option value="Falken" />
                    <option value="Yokohama" />
                    <option value="Nokian" />
                    <option value="Toyo" />
                    <option value="Kumho" />
                    <option value="Uniroyal" />
                    <option value="Kleber" />
                    <option value="Nexen" />
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Model / Type
                  </label>
                  <input
                    type="text"
                    placeholder="bijv. PremiumContact 7 of Primacy 4"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                  />
                </div>
              </div>

              {/* Bandenmaat, Velgmaat & Snelheidsindex */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Bandenmaat
                  </label>
                  <input
                    type="text"
                    placeholder="bijv. 225/45 of 205/55"
                    value={tireSize}
                    onChange={(e) => setTireSize(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Velgmaat
                  </label>
                  <select
                    value={rimSize}
                    onChange={(e) => setRimSize(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                  >
                    <option value="">Kies velgmaat...</option>
                    <option value='13"'>13 inch (13")</option>
                    <option value='14"'>14 inch (14")</option>
                    <option value='15"'>15 inch (15")</option>
                    <option value='16"'>16 inch (16")</option>
                    <option value='17"'>17 inch (17")</option>
                    <option value='18"'>18 inch (18")</option>
                    <option value='19"'>19 inch (19")</option>
                    <option value='20"'>20 inch (20")</option>
                    <option value='21"'>21 inch (21")</option>
                    <option value='22"'>22 inch (22")</option>
                    <option value='23"'>23 inch (23")</option>
                    <option value='24"'>24 inch (24")</option>
                    {rimSize && ![
                      '13"', '14"', '15"', '16"', '17"', '18"', '19"', '20"', '21"', '22"', '23"', '24"'
                    ].includes(rimSize) && (
                      <option value={rimSize}>{rimSize}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Snelheidsindex
                  </label>
                  <input
                    type="text"
                    placeholder="bijv. 92V of 91H"
                    value={speedIndex}
                    onChange={(e) => setSpeedIndex(e.target.value.toUpperCase())}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono font-bold uppercase"
                  />
                </div>
              </div>

              {/* Status & DOT code */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Status van de set
                  </label>
                  <select
                    value={status}
                    onChange={(e: any) => setStatus(e.target.value)}
                    className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="mounted">Momenteel gemonteerd op de auto</option>
                    <option value="stored">Opgeslagen (in bandenhotel of schuur)</option>
                    <option value="disposed">Afgedankt / Verkocht</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    DOT Code (Productieweek)
                  </label>
                  <input
                    type="text"
                    placeholder="bijv. 2324 (week 23, 2024)"
                    value={dotCode}
                    onChange={(e) => setDotCode(e.target.value)}
                    className="w-full text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Opslaglocatie (alleen relevant bij opslag/wissel) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {status === 'mounted' ? 'Opslaglocatie (optioneel na wissel)' : 'Opslaglocatie'}
                </label>
                <input
                  type="text"
                  placeholder={
                    status === 'mounted'
                      ? 'Niet van toepassing (banden zijn nu gemonteerd)'
                      : 'bijv. Bandenhotel Euromaster / Schuur / Garage'
                  }
                  value={storageLocation}
                  onChange={(e) => setStorageLocation(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Initial Tread Depths */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Profieldieptes (mm)</label>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block mb-0.5">Linksvoor</span>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="mm"
                      value={treadFl}
                      onChange={(e) => setTreadFl(e.target.value)}
                      className="w-full text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block mb-0.5">Rechtsvoor</span>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="mm"
                      value={treadFr}
                      onChange={(e) => setTreadFr(e.target.value)}
                      className="w-full text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block mb-0.5">Linksachter</span>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="mm"
                      value={treadRl}
                      onChange={(e) => setTreadRl(e.target.value)}
                      className="w-full text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block mb-0.5">Rechtsachter</span>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="mm"
                      value={treadRr}
                      onChange={(e) => setTreadRr(e.target.value)}
                      className="w-full text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Notities</label>
                <textarea
                  rows={2}
                  placeholder="bijv. Banden gebalanceerd in oktober"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-bold bg-accent-600 hover:bg-accent-700 text-white rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {saving ? 'Opslaan...' : 'Bandenset Opslaan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Swap Modal */}
      {isSwapModalOpen && swapTargetSet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <ArrowLeftRight className="w-4 h-4 text-amber-500" />
                <span>Bandenset Wisselen</span>
              </h3>
              <button
                onClick={() => setIsSwapModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex items-start space-x-2.5">
              <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                Je monteert nu: <strong className="font-bold">{swapTargetSet.name}</strong>.
                {activeMountedSet && (
                  <p className="mt-1">
                    De huidige set (<strong>{activeMountedSet.name}</strong>) wordt automatisch opgeslagen en de gereden kilometers worden berekend.
                  </p>
                )}
              </div>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-400">
                {modalError}
              </div>
            )}

            <form onSubmit={handleConfirmSwap} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Kilometerstand bij wissel (km)
                </label>
                <input
                  type="number"
                  step="1"
                  required
                  placeholder="bijv. 85400"
                  value={swapOdometer}
                  onChange={(e) => setSwapOdometer(e.target.value)}
                  className="w-full text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Datum van de wissel</label>
                <DatePicker value={swapDate} onChange={setSwapDate} />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSwapModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-bold bg-accent-600 hover:bg-accent-700 text-white rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {saving ? 'Wisselen...' : 'Wissel Bevestigen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Tread Update Modal */}
      {isTreadModalOpen && treadTargetSet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Gauge className="w-4 h-4 text-amber-500" />
                <span>Profieldiepte Meten: {treadTargetSet.name}</span>
              </h3>
              <button
                onClick={() => setIsTreadModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-400">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSaveTread} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Linksvoor (mm)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="bijv. 6.5"
                    value={quickFl}
                    onChange={(e) => setQuickFl(e.target.value)}
                    className="w-full text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Rechtsvoor (mm)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="bijv. 6.5"
                    value={quickFr}
                    onChange={(e) => setQuickFr(e.target.value)}
                    className="w-full text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Linksachter (mm)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="bijv. 7.0"
                    value={quickRl}
                    onChange={(e) => setQuickRl(e.target.value)}
                    className="w-full text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Rechtsachter (mm)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="bijv. 7.0"
                    value={quickRr}
                    onChange={(e) => setQuickRr(e.target.value)}
                    className="w-full text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Datum van meting</label>
                <DatePicker value={quickDate} onChange={setQuickDate} />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsTreadModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-bold bg-accent-600 hover:bg-accent-700 text-white rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {saving ? 'Opslaan...' : 'Meting Opslaan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
