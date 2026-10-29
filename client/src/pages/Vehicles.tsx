import React, { useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import {
  Plus,
  Sparkles,
  Archive,
  RefreshCw,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Car,
  Camera,
  X,
} from 'lucide-react';
import { Vehicle, VehicleType } from '../types/index.js';
import { apiFetch } from '../api/client.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { DatePicker } from '../components/DatePicker.js';
import { useLanguage } from '../context/LanguageContext.js';
import { formatDisplayDate } from '../utils/format.js';
import { compressImage } from '../utils/imageCompressor.js';

interface ContextType {
  vehicles: Vehicle[];
  refreshVehicles: () => void;
}

export const Vehicles: React.FC = () => {
  const { vehicles, refreshVehicles } = useOutletContext<ContextType>();
  const { t, lang } = useLanguage();
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'archived'>('active');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [type, setType] = useState<VehicleType>('car');
  const [licensePlate, setLicensePlate] = useState('');
  const [vin, setVin] = useState('');
  const [year, setYear] = useState<string>('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [fuelType, setFuelType] = useState('Benzine');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [purchasePrice, setPurchasePrice] = useState<string>('0');
  const [initialOdometer, setInitialOdometer] = useState<string>('0');
  const [apkDate, setApkDate] = useState('');
  const [notes, setNotes] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [rdwLoading, setRdwLoading] = useState(false);
  const [rdwSuccess, setRdwSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setName('');
    setType('car');
    setLicensePlate('');
    setVin('');
    setYear('');
    setMake('');
    setModel('');
    setFuelType(lang === 'nl' ? 'Benzine' : 'Petrol');
    setPurchaseDate('');
    setPurchasePrice('0');
    setInitialOdometer('0');
    setApkDate('');
    setNotes('');
    setImageFile(null);
    setImagePreview(null);
    setEditingVehicle(null);
    setError(null);
    setRdwSuccess(false);
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (v: Vehicle) => {
    setEditingVehicle(v);
    setName(v.name);
    setType(v.type);
    setLicensePlate(v.license_plate || '');
    setVin(v.vin || '');
    setYear(v.year ? String(v.year) : '');
    setMake(v.make || '');
    setModel(v.model || '');
    setFuelType(v.fuel_type || 'Benzine');
    setPurchaseDate(v.purchase_date || '');
    setPurchasePrice(String(v.purchase_price || 0));
    setInitialOdometer(String(v.initial_odometer || 0));
    setApkDate(v.apk_expiration_date || '');
    setNotes(v.notes || '');
    setImageFile(null);
    setImagePreview(v.image_path ? `/uploads/vehicles/${v.image_path}` : null);
    setError(null);
    setIsModalOpen(true);
  };

  const handleRdwLookup = async () => {
    if (!licensePlate) return;
    setRdwLoading(true);
    setError(null);
    setRdwSuccess(false);

    try {
      const data = await apiFetch<{ rdw: any }>(`/api/vehicles/rdw/${licensePlate}`);
      if (data && data.rdw) {
        if (data.rdw.merk) setMake(data.rdw.merk);
        if (data.rdw.handelsbenaming) setModel(data.rdw.handelsbenaming);
        if (data.rdw.vervaldatum_apk) setApkDate(data.rdw.vervaldatum_apk);
        if (data.rdw.datum_eerste_toelating) {
          const y = data.rdw.datum_eerste_toelating.substring(0, 4);
          setYear(y);
        }
        if (!name) {
          setName(`${data.rdw.merk} ${data.rdw.handelsbenaming}`);
        }
        setRdwSuccess(true);
      }
    } catch (err: any) {
      setError(err?.message || t('rdwNotFound'));
    } finally {
      setRdwLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const payload = {
      name,
      type,
      license_plate: licensePlate || null,
      vin: vin || null,
      year: year ? parseInt(year, 10) : null,
      make: make || null,
      model: model || null,
      fuel_type: fuelType || null,
      purchase_date: purchaseDate || null,
      purchase_price: parseFloat(purchasePrice) || 0,
      initial_odometer: parseFloat(initialOdometer) || 0,
      apk_expiration_date: apkDate || null,
      notes: notes || null,
    };

    try {
      let vehicleId = editingVehicle?.id;
      if (editingVehicle) {
        await apiFetch(`/api/vehicles/${editingVehicle.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        const res = await apiFetch<{ id: string }>('/api/vehicles', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        vehicleId = res.id;
      }

      // If a vehicle photo was chosen, upload it now
      if (imageFile && vehicleId) {
        const compressedImage = await compressImage(imageFile, 1200, 1200, 0.85);
        const formData = new FormData();
        formData.append('image', compressedImage);
        await apiFetch(`/api/vehicles/${vehicleId}/image`, {
          method: 'POST',
          body: formData,
        });
      }

      setIsModalOpen(false);
      resetForm();
      refreshVehicles();
    } catch (err: any) {
      setError(err?.message || 'Error saving vehicle');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm(t('confirmDeleteVehicle'))) {
      try {
        await apiFetch(`/api/vehicles/${id}`, { method: 'DELETE' });
        refreshVehicles();
      } catch (err: any) {
        alert(err?.message || 'Delete failed');
      }
    }
  };

  const handleToggleArchive = async (v: Vehicle) => {
    const newStatus = v.status === 'active' ? 'archived' : 'active';
    try {
      await apiFetch(`/api/vehicles/${v.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      refreshVehicles();
    } catch {
      // ignore
    }
  };

  const filteredVehicles = vehicles.filter((v) => {
    if (filterStatus === 'all') return true;
    return v.status === filterStatus;
  });

  const getVehicleTypeName = (vType: VehicleType) => {
    switch (vType) {
      case 'motorcycle': return t('motorcycle');
      case 'van': return t('van');
      case 'trailer': return t('trailer');
      default: return t('car');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center space-x-2">
            <Car className="w-5 h-5 text-sky-500" />
            <span>{t('myGarage')}</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t('garageSubtitle')}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Status Tabs */}
          <div className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 flex text-xs font-semibold">
            <button
              onClick={() => setFilterStatus('active')}
              className={`px-3 py-1 rounded-lg transition ${
                filterStatus === 'active'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t('active')} ({vehicles.filter((v) => v.status === 'active').length})
            </button>
            <button
              onClick={() => setFilterStatus('archived')}
              className={`px-3 py-1 rounded-lg transition ${
                filterStatus === 'archived'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t('archived')} ({vehicles.filter((v) => v.status === 'archived').length})
            </button>
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1 rounded-lg transition ${
                filterStatus === 'all'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t('all')}
            </button>
          </div>

          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-slate-900 text-white hover:bg-black dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 transition shadow-sm hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            <span>{t('addVehicle')}</span>
          </button>
        </div>
      </div>

      {/* Vehicle Grid */}
      {filteredVehicles.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center text-xs text-slate-400">
          {t('noVehiclesFound')}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredVehicles.map((v) => (
            <div
              key={v.id}
              className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-sky-500/50 rounded-2xl p-5 transition-all shadow-sm hover:shadow-md flex flex-col justify-between overflow-hidden"
            >
              <div>
                {/* Vehicle Photo Banner */}
                {v.image_path ? (
                  <div className="w-full h-44 rounded-xl overflow-hidden mb-3.5 bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-800/80 relative group shadow-xs">
                    <img
                      src={`/uploads/vehicles/${v.image_path}`}
                      alt={v.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                ) : null}

                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider bg-sky-50 dark:bg-sky-950/60 px-2 py-0.5 rounded-full border border-sky-100 dark:border-sky-900/40">
                    {getVehicleTypeName(v.type)}
                  </span>
                  <StatusBadge status={v.status} />
                </div>

                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">{v.name}</h3>
                  {v.license_plate && (
                    <div className="bg-amber-400 text-slate-950 font-mono font-black text-[11px] px-2 py-0.5 rounded border border-amber-500 shadow-sm shrink-0">
                      <span className="text-[9px] bg-blue-700 text-white px-1 py-0.2 rounded-l mr-1 font-bold">NL</span>
                      {v.license_plate}
                    </div>
                  )}
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 font-medium">
                  {v.year ? `${v.year} ` : ''}
                  {v.make || ''} {v.model || ''}
                </p>

                <div className="bg-slate-50 dark:bg-slate-950/70 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">{lang === 'nl' ? 'Huidige stand' : t('odometer')}</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {(v.current_odometer || v.initial_odometer || 0).toLocaleString()} km
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{lang === 'nl' ? 'Aankoopstand' : t('initialOdometer')}</span>
                    <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                      {(v.initial_odometer || 0).toLocaleString()} km
                    </span>
                  </div>
                  {(v.current_odometer || v.initial_odometer || 0) > (v.initial_odometer || 0) && (
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                      <span>{lang === 'nl' ? 'Gereden na aankoop' : 'Driven since purchase'}</span>
                      <span className="font-mono font-bold">
                        +{((v.current_odometer || v.initial_odometer || 0) - (v.initial_odometer || 0)).toLocaleString()} km
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t('apkDate')}</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {formatDisplayDate(v.apk_expiration_date)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t('fuelType')}</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{v.fuel_type || '—'}</span>
                  </div>
                  {v.purchase_price > 0 && (
                    <div className="flex justify-between border-t border-slate-200 dark:border-slate-800/80 pt-1.5">
                      <span className="text-slate-500">{t('purchasePrice')}</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        € {v.purchase_price.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3.5 mt-4 text-xs">
                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => openEditModal(v)}
                    className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                    title={t('editVehicle')}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleToggleArchive(v)}
                    className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                    title={v.status === 'active' ? t('archiveVehicle') : t('restoreVehicle')}
                  >
                    <Archive className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(v.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                    title={t('deleteVehicle')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <Link
                  to={`/analytics?vehicleId=${v.id}`}
                  className="text-sky-600 dark:text-sky-400 font-bold hover:underline flex items-center space-x-1 text-xs"
                >
                  <span>{t('tcoStats')}</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Vehicle Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 text-slate-900 dark:text-slate-100 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-base font-bold">
                {editingVehicle ? t('editVehicle') : t('addVehicle')}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="flex items-center space-x-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 text-xs p-3 rounded-lg mb-4">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              {/* Photo Upload Box */}
              <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-2">
                  {t('vehiclePhoto')}
                </label>
                <div className="flex items-center space-x-4">
                  {imagePreview ? (
                    <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0 border border-slate-300 dark:border-slate-700 relative group">
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          setImageFile(null);
                          setImagePreview(null);
                        }}
                        className="absolute top-1 right-1 bg-black/60 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition"
                        title={t('delete')}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-slate-100 dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-800 flex flex-col items-center justify-center text-slate-400 shrink-0">
                      <Camera className="w-5 h-5 mb-0.5" />
                      <span className="text-[9px]">{t('noPhoto')}</span>
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setImageFile(file);
                          const reader = new FileReader();
                          reader.onload = () => setImagePreview(reader.result as string);
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="w-full text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 dark:file:bg-slate-800 file:text-slate-800 dark:file:text-slate-200 hover:file:bg-slate-200 text-xs"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">{t('dragOrClickPhoto')}</p>
                  </div>
                </div>
              </div>

              {/* RDW License Plate lookup banner */}
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                <label className="text-slate-700 dark:text-slate-300 font-semibold block">
                  {t('licensePlate')} (RDW Open Data)
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={licensePlate}
                    onChange={(e) => setLicensePlate(e.target.value)}
                    placeholder="bijv. 12-AB-34"
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 uppercase font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={handleRdwLookup}
                    disabled={rdwLoading || !licensePlate}
                    className="px-3.5 py-2 bg-slate-900 text-white dark:bg-slate-800 dark:text-slate-100 hover:bg-black dark:hover:bg-slate-700 rounded-lg text-xs font-semibold inline-flex items-center space-x-1.5 transition disabled:opacity-50 shadow-sm"
                  >
                    {rdwLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-400" />}
                    <span>{t('rdwAutofill')}</span>
                  </button>
                </div>
                {rdwSuccess && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center space-x-1 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{t('rdwFound')}</span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    {t('vehicleName')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={lang === 'nl' ? 'bijv. Golf 7 Daily' : 'e.g. Golf 7 Daily'}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    {t('vehicleType')}
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as VehicleType)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 shadow-sm font-medium"
                  >
                    <option value="car">{t('car')}</option>
                    <option value="motorcycle">{t('motorcycle')}</option>
                    <option value="trailer">{t('trailer')}</option>
                    <option value="van">{t('van')}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">{t('make')}</label>
                  <input
                    type="text"
                    value={make}
                    onChange={(e) => setMake(e.target.value)}
                    placeholder="Volkswagen"
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">{t('model')}</label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="Golf"
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">{t('year')}</label>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    placeholder="2018"
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 shadow-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">{t('fuelType')}</label>
                  <input
                    type="text"
                    value={fuelType}
                    onChange={(e) => setFuelType(e.target.value)}
                    placeholder={lang === 'nl' ? 'Benzine, Diesel, Elektrisch' : 'Petrol, Diesel, Electric'}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">{t('vin')}</label>
                  <input
                    type="text"
                    value={vin}
                    onChange={(e) => setVin(e.target.value)}
                    placeholder="WVWZZZ..."
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 font-mono text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 shadow-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">{lang === 'nl' ? 'Aankoopstand (km)' : t('initialOdometer')}</label>
                  <p className="text-[10px] text-slate-400 mb-1">{lang === 'nl' ? 'Kilometerstand op het moment van aankoop' : 'Odometer when purchased'}</p>
                  <input
                    type="number"
                    value={initialOdometer}
                    onChange={(e) => setInitialOdometer(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 shadow-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">{t('purchasePrice')}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 shadow-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <DatePicker
                    label={t('purchaseDate')}
                    value={purchaseDate}
                    onChange={setPurchaseDate}
                  />
                </div>
                <div>
                  <DatePicker
                    label={t('apkDate')}
                    value={apkDate}
                    onChange={setApkDate}
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">{t('vehicleNotes')}</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={lang === 'nl' ? 'Kleurcode, opties, bandenmaten...' : 'Paint code, options, tire sizes...'}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 shadow-sm"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-500 hover:text-slate-800 dark:hover:text-white font-medium"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 text-white hover:bg-black dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white rounded-xl font-bold transition shadow-sm"
                >
                  {editingVehicle ? t('save') : t('create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
