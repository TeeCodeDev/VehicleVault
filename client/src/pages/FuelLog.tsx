import React, { useEffect, useState, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Fuel,
  Zap,
  Camera,
  AlertTriangle,
  Trash2,
  Pencil,
  Check,
  Image,
  History,
  Paperclip,
  X,
  FileText,
  MapPin,
  Navigation,
  Search,
  Loader2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
} from 'lucide-react';
import { Vehicle, FuelEntry, GasStation } from '../types/index.js';
import { apiFetch } from '../api/client.js';
import { ReceiptScannerModal } from '../components/ReceiptScannerModal.js';
import { DatePicker } from '../components/DatePicker.js';
import { useLanguage } from '../context/LanguageContext.js';
import { addToOfflineQueue } from '../utils/offlineQueue.js';
import { formatDisplayDate } from '../utils/format.js';
import { compressImage } from '../utils/imageCompressor.js';

interface ContextType {
  vehicles: Vehicle[];
  selectedVehicle: Vehicle | null;
  selectedVehicleId: string | null;
}

export const FuelLog: React.FC = () => {
  const { selectedVehicle } = useOutletContext<ContextType>();
  const { t, lang } = useLanguage();
  const [entries, setEntries] = useState<FuelEntry[]>([]);
  const [isOcrOpen, setIsOcrOpen] = useState(false);

  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [odometer, setOdometer] = useState<string>('');
  const [energyType, setEnergyType] = useState<'fuel' | 'electric'>('fuel');
  const [liters, setLiters] = useState<string>('');
  const [pricePerLiter, setPricePerLiter] = useState<string>('');
  const [kwh, setKwh] = useState<string>('');
  const [pricePerKwh, setPricePerKwh] = useState<string>('');
  const [totalCost, setTotalCost] = useState<string>('');
  const [isFullTank, setIsFullTank] = useState(true);
  const [missedPrevious, setMissedPrevious] = useState(false);
  const [notes, setNotes] = useState('');
  const [receiptPath, setReceiptPath] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  // Station Location & GPS State
  const [stationName, setStationName] = useState('');
  const [stationAddress, setStationAddress] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [showLocationSection, setShowLocationSection] = useState(false);

  const [loadingGps, setLoadingGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [nearbyStations, setNearbyStations] = useState<GasStation[]>([]);
  const [showStationPicker, setShowStationPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchingStations, setSearchingStations] = useState(false);

  // Warnings / Validation State
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Edit Modal State
  const [editingEntry, setEditingEntry] = useState<FuelEntry | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editOdometer, setEditOdometer] = useState('');
  const [editEnergyType, setEditEnergyType] = useState<'fuel' | 'electric'>('fuel');
  const [editLiters, setEditLiters] = useState('');
  const [editPricePerLiter, setEditPricePerLiter] = useState('');
  const [editKwh, setEditKwh] = useState('');
  const [editPricePerKwh, setEditPricePerKwh] = useState('');
  const [editTotalCost, setEditTotalCost] = useState('');
  const [editIsFullTank, setEditIsFullTank] = useState(true);
  const [editMissedPrevious, setEditMissedPrevious] = useState(false);
  const [editNotes, setEditNotes] = useState('');
  const [editStationName, setEditStationName] = useState('');
  const [editStationAddress, setEditStationAddress] = useState('');
  const [editLatitude, setEditLatitude] = useState<number | null>(null);
  const [editLongitude, setEditLongitude] = useState<number | null>(null);
  const [editReceiptPath, setEditReceiptPath] = useState<string | null>(null);
  const [editReceiptFile, setEditReceiptFile] = useState<File | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Export State
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
      const blob = await apiFetch<Blob>(`/api/fuel/export/csv?vehicleId=${selectedVehicle.id}`);
      const plate = selectedVehicle.license_plate ? selectedVehicle.license_plate.replace(/[^a-zA-Z0-9]/g, '_') : 'tankbeurten';
      triggerDownload(blob, `Tankhistorie_${plate}.csv`);
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
      const blob = await apiFetch<Blob>(`/api/fuel/export/excel?vehicleId=${selectedVehicle.id}`);
      const plate = selectedVehicle.license_plate ? selectedVehicle.license_plate.replace(/[^a-zA-Z0-9]/g, '_') : 'tankbeurten';
      triggerDownload(blob, `Tankhistorie_${plate}.xlsx`);
    } catch (err: any) {
      alert(err?.message || 'Kon Excel niet downloaden');
    } finally {
      setExportingType(null);
      setIsExportMenuOpen(false);
    }
  };

  // Vehicle Energy Capability (Pure Combustion / Non-plug-in Hybrid / PHEV / Pure EV)
  const vehicleFuelType = (selectedVehicle?.fuel_type || '').toLowerCase();
  const isPhev = vehicleFuelType.includes('plug-in') || vehicleFuelType.includes('phev');
  const isElectricOnly = (vehicleFuelType.includes('elektrisch') || vehicleFuelType === 'ev' || vehicleFuelType.includes('elektriciteit')) && !isPhev;

  useEffect(() => {
    if (isElectricOnly) {
      setEnergyType('electric');
    } else if (!isPhev) {
      setEnergyType('fuel');
    }
  }, [isElectricOnly, isPhev, selectedVehicle?.id]);

  useEffect(() => {
    if (selectedVehicle) {
      loadEntries(selectedVehicle.id);
      window.dispatchEvent(new CustomEvent('vv_fuel_logged'));
      const current = selectedVehicle.current_odometer || selectedVehicle.initial_odometer || 0;
      setOdometer(current > 0 ? String(current) : '');
    }

    const handleSynced = () => {
      if (selectedVehicle) loadEntries(selectedVehicle.id);
    };
    window.addEventListener('vv_offline_synced', handleSynced);
    return () => window.removeEventListener('vv_offline_synced', handleSynced);
  }, [selectedVehicle?.id]);

  const loadEntries = async (vehicleId: string) => {
    try {
      const data = await apiFetch<{ entries: FuelEntry[] }>(`/api/fuel?vehicleId=${vehicleId}`);
      setEntries(data.entries);
    } catch {
      // ignore
    }
  };

  // Real-time calculation: when Liters or Price change, update Total Cost
  const handleLitersChange = (val: string) => {
    setLiters(val);
    const l = parseFloat(val);
    const p = parseFloat(pricePerLiter);
    if (!isNaN(l) && !isNaN(p) && l > 0 && p > 0) {
      setTotalCost((l * p).toFixed(2));
    }
  };

  const handlePriceChange = (val: string) => {
    setPricePerLiter(val);
    const l = parseFloat(liters);
    const p = parseFloat(val);
    if (!isNaN(l) && !isNaN(p) && l > 0 && p > 0) {
      setTotalCost((l * p).toFixed(2));
    }
  };

  const handleKwhChange = (val: string) => {
    setKwh(val);
    const k = parseFloat(val);
    const p = parseFloat(pricePerKwh);
    if (!isNaN(k) && !isNaN(p) && k > 0 && p > 0) {
      setTotalCost((k * p).toFixed(2));
    }
  };

  const handlePricePerKwhChange = (val: string) => {
    setPricePerKwh(val);
    const k = parseFloat(kwh);
    const p = parseFloat(val);
    if (!isNaN(k) && !isNaN(p) && k > 0 && p > 0) {
      setTotalCost((k * p).toFixed(2));
    }
  };

  const handleTotalChange = (val: string) => {
    setTotalCost(val);
    const tVal = parseFloat(val);
    if (energyType === 'electric') {
      const k = parseFloat(kwh);
      if (!isNaN(tVal) && !isNaN(k) && k > 0) {
        setPricePerKwh((tVal / k).toFixed(3));
      }
    } else {
      const l = parseFloat(liters);
      if (!isNaN(tVal) && !isNaN(l) && l > 0) {
        setPricePerLiter((tVal / l).toFixed(3));
      }
    }
  };

  // Odometer validation against previous highest
  const handleOdometerChange = (val: string) => {
    setOdometer(val);
    const num = parseFloat(val);
    if (!isNaN(num) && entries.length > 0) {
      const highest = Math.max(...entries.map((e) => e.odometer));
      if (num < highest) {
        setWarningMessage(
          lang === 'nl'
            ? `Let op: ${num.toLocaleString()} km is lager dan de vorige geregistreerde stand (${highest.toLocaleString()} km).`
            : `Warning: ${num.toLocaleString()} km is lower than the previous odometer (${highest.toLocaleString()} km).`
        );
      } else if (num - highest > 2500) {
        setWarningMessage(
          lang === 'nl'
            ? `Grote afstandssprong: +${(num - highest).toLocaleString()} km sinds vorige tankbeurt. Is er een tankbeurt gemist?`
            : `Large distance delta: +${(num - highest).toLocaleString()} km since last fill-up. Was a fill-up missed?`
        );
      } else {
        setWarningMessage(null);
      }
    } else {
      setWarningMessage(null);
    }
  };

  // Trigger browser GPS Geolocation to find nearest gas stations
  const handleGetGpsStations = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsError(lang === 'nl' ? 'GPS geolocatie wordt niet ondersteund door deze browser.' : 'Geolocation is not supported by your browser.');
      return;
    }

    setLoadingGps(true);
    setGpsError(null);
    setShowLocationSection(true);
    setShowStationPicker(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setLatitude(lat);
        setLongitude(lon);

        try {
          const res = await apiFetch<{ stations: GasStation[] }>(
            `/api/fuel/stations/nearby?lat=${lat}&lon=${lon}&radius=8`
          );
          setNearbyStations(res.stations || []);
          if (!res.stations || res.stations.length === 0) {
            setGpsError(lang === 'nl' ? 'Geen tankstations binnen 8 km gevonden.' : 'No gas stations found within 8 km.');
          }
        } catch (err: any) {
          setGpsError(err?.message || 'Fout bij ophalen van tankstations in de buurt.');
        } finally {
          setLoadingGps(false);
        }
      },
      (err) => {
        setLoadingGps(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsError(t('gpsPermissionDenied'));
        } else {
          setGpsError(err.message || 'GPS fout bij bepalen van positie.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  // Search stations by text query
  const handleSearchStations = async (q: string) => {
    setSearchQuery(q);
    if (q.trim().length < 2) return;

    setSearchingStations(true);
    setGpsError(null);
    try {
      const url = latitude && longitude
        ? `/api/fuel/stations/search?q=${encodeURIComponent(q)}&lat=${latitude}&lon=${longitude}`
        : `/api/fuel/stations/search?q=${encodeURIComponent(q)}`;
      const res = await apiFetch<{ stations: GasStation[] }>(url);
      setNearbyStations(res.stations || []);
      setShowStationPicker(true);
      setShowLocationSection(true);
    } catch {
      // ignore
    } finally {
      setSearchingStations(false);
    }
  };

  const handleSelectStation = (st: GasStation) => {
    setStationName(st.name);
    setStationAddress(st.address);
    setLatitude(st.lat);
    setLongitude(st.lon);
    setShowStationPicker(false);
    setShowLocationSection(true);
  };

  const handleOcrExtracted = (data: {
    date?: string | null;
    liters: number | null;
    pricePerLiter: number | null;
    totalCost: number | null;
    receiptPath: string;
    station?: string | null;
    stationAddress?: string | null;
    fuelType?: string | null;
  }) => {
    if (data.date) setDate(data.date);
    if (data.liters) setLiters(String(data.liters));
    if (data.pricePerLiter) setPricePerLiter(String(data.pricePerLiter));
    if (data.totalCost) setTotalCost(String(data.totalCost));
    setReceiptPath(data.receiptPath);
    setReceiptFile(null);

    if (data.station) {
      setStationName(data.station);
      setShowLocationSection(true);
    }

    if (data.stationAddress) {
      setStationAddress(data.stationAddress);
      setShowLocationSection(true);
    }

    if (data.station || data.fuelType) {
      const parts = [data.station, data.fuelType].filter(Boolean);
      if (parts.length > 0 && !notes) {
        setNotes(parts.join(' • '));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle) return;

    // Check if browser is offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      addToOfflineQueue({
        vehicle_id: selectedVehicle.id,
        date,
        odometer: parseFloat(odometer),
        liters: parseFloat(liters),
        price_per_liter: parseFloat(pricePerLiter),
        total_cost: parseFloat(totalCost),
        is_full_tank: isFullTank,
        missed_previous: missedPrevious,
        notes: notes || null,
        station_name: stationName || null,
        station_address: stationAddress || null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
      });

      alert(t('offlineSavedAlert'));
      setLiters('');
      setPricePerLiter('');
      setTotalCost('');
      setNotes('');
      setStationName('');
      setStationAddress('');
      setLatitude(null);
      setLongitude(null);
      setReceiptPath(null);
      setReceiptFile(null);
      setWarningMessage(null);
      return;
    }

    setSubmitting(true);
    try {
      let finalReceiptPath = receiptPath;

      if (receiptFile) {
        setUploadingReceipt(true);
        const compressed = await compressImage(receiptFile);
        const formData = new FormData();
        formData.append('receipt', compressed);
        const uploadRes = await apiFetch<{ fileName: string }>('/api/fuel/upload-receipt', {
          method: 'POST',
          body: formData,
        });
        finalReceiptPath = uploadRes.fileName;
      }

      await apiFetch('/api/fuel', {
        method: 'POST',
        body: JSON.stringify({
          vehicle_id: selectedVehicle.id,
          date,
          odometer: parseFloat(odometer),
          energy_type: energyType,
          liters: energyType === 'fuel' ? parseFloat(liters || '0') : 0,
          price_per_liter: energyType === 'fuel' ? parseFloat(pricePerLiter || '0') : 0,
          kwh: energyType === 'electric' ? parseFloat(kwh || '0') : null,
          price_per_kwh: energyType === 'electric' ? parseFloat(pricePerKwh || '0') : null,
          total_cost: parseFloat(totalCost),
          is_full_tank: isFullTank,
          missed_previous: missedPrevious,
          notes: notes || null,
          receipt_path: finalReceiptPath || null,
          station_name: stationName || null,
          station_address: stationAddress || null,
          latitude: latitude ?? null,
          longitude: longitude ?? null,
        }),
      });

      // Reset fields
      setLiters('');
      setPricePerLiter('');
      setKwh('');
      setPricePerKwh('');
      setTotalCost('');
      setNotes('');
      setStationName('');
      setStationAddress('');
      setLatitude(null);
      setLongitude(null);
      setReceiptPath(null);
      setReceiptFile(null);
      setWarningMessage(null);

      loadEntries(selectedVehicle.id);
    } catch (err: any) {
      if (!navigator.onLine || err?.message?.toLowerCase().includes('offline') || err?.message?.toLowerCase().includes('failed to fetch')) {
        addToOfflineQueue({
          vehicle_id: selectedVehicle.id,
          date,
          odometer: parseFloat(odometer),
          liters: parseFloat(liters),
          price_per_liter: parseFloat(pricePerLiter),
          total_cost: parseFloat(totalCost),
          is_full_tank: isFullTank,
          missed_previous: missedPrevious,
          notes: notes || null,
          station_name: stationName || null,
          station_address: stationAddress || null,
          latitude: latitude ?? null,
          longitude: longitude ?? null,
        });
        alert(t('offlineSavedAlert'));
        setLiters('');
        setPricePerLiter('');
        setTotalCost('');
        setNotes('');
        setStationName('');
        setStationAddress('');
        setLatitude(null);
        setLongitude(null);
        setReceiptPath(null);
        setReceiptFile(null);
        setWarningMessage(null);
      } else {
        alert(err?.message || 'Failed to save fuel entry');
      }
    } finally {
      setSubmitting(false);
      setUploadingReceipt(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm(t('confirmDeleteFuel'))) {
      try {
        await apiFetch(`/api/fuel/${id}`, { method: 'DELETE' });
        if (selectedVehicle) loadEntries(selectedVehicle.id);
      } catch (err: any) {
        alert(err?.message || 'Delete failed');
      }
    }
  };

  const handleOpenEditModal = (entry: FuelEntry) => {
    setEditingEntry(entry);
    setEditDate(entry.date);
    setEditOdometer(String(entry.odometer));
    setEditEnergyType((entry.energy_type as any) || 'fuel');
    setEditLiters(String(entry.liters || ''));
    setEditPricePerLiter(String(entry.price_per_liter || ''));
    setEditKwh(entry.kwh ? String(entry.kwh) : '');
    setEditPricePerKwh(entry.price_per_kwh ? String(entry.price_per_kwh) : '');
    setEditTotalCost(String(entry.total_cost));
    setEditIsFullTank(Boolean(entry.is_full_tank));
    setEditMissedPrevious(Boolean(entry.missed_previous));
    setEditNotes(entry.notes || '');
    setEditStationName(entry.station_name || '');
    setEditStationAddress(entry.station_address || '');
    setEditLatitude(entry.latitude ?? null);
    setEditLongitude(entry.longitude ?? null);
    setEditReceiptPath(entry.receipt_path || null);
    setEditReceiptFile(null);
  };

  const handleCloseEditModal = () => {
    setEditingEntry(null);
    setEditReceiptFile(null);
  };

  const handleEditLitersChange = (val: string) => {
    setEditLiters(val);
    const l = parseFloat(val);
    const p = parseFloat(editPricePerLiter);
    if (!isNaN(l) && !isNaN(p) && l > 0 && p > 0) {
      setEditTotalCost((Math.round(l * p * 100) / 100).toFixed(2));
    }
  };

  const handleEditPriceChange = (val: string) => {
    setEditPricePerLiter(val);
    const l = parseFloat(editLiters);
    const p = parseFloat(val);
    if (!isNaN(l) && !isNaN(p) && l > 0 && p > 0) {
      setEditTotalCost((Math.round(l * p * 100) / 100).toFixed(2));
    }
  };

  const handleEditKwhChange = (val: string) => {
    setEditKwh(val);
    const k = parseFloat(val);
    const p = parseFloat(editPricePerKwh);
    if (!isNaN(k) && !isNaN(p) && k > 0 && p > 0) {
      setEditTotalCost((Math.round(k * p * 100) / 100).toFixed(2));
    }
  };

  const handleEditPricePerKwhChange = (val: string) => {
    setEditPricePerKwh(val);
    const k = parseFloat(editKwh);
    const p = parseFloat(val);
    if (!isNaN(k) && !isNaN(p) && k > 0 && p > 0) {
      setEditTotalCost((Math.round(k * p * 100) / 100).toFixed(2));
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry || !selectedVehicle) return;

    setSavingEdit(true);
    try {
      let finalReceiptPath = editReceiptPath;

      if (editReceiptFile) {
        const compressed = await compressImage(editReceiptFile);
        const formData = new FormData();
        formData.append('receipt', compressed);
        const uploadRes = await apiFetch<{ fileName: string }>('/api/fuel/upload-receipt', {
          method: 'POST',
          body: formData,
        });
        finalReceiptPath = uploadRes.fileName;
      }

      await apiFetch(`/api/fuel/${editingEntry.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          date: editDate,
          odometer: parseFloat(editOdometer),
          energy_type: editEnergyType,
          liters: editEnergyType === 'fuel' ? parseFloat(editLiters || '0') : 0,
          price_per_liter: editEnergyType === 'fuel' ? parseFloat(editPricePerLiter || '0') : 0,
          kwh: editEnergyType === 'electric' ? parseFloat(editKwh || '0') : null,
          price_per_kwh: editEnergyType === 'electric' ? parseFloat(editPricePerKwh || '0') : null,
          total_cost: parseFloat(editTotalCost),
          is_full_tank: editIsFullTank,
          missed_previous: editMissedPrevious,
          notes: editNotes || null,
          receipt_path: finalReceiptPath || null,
          station_name: editStationName || null,
          station_address: editStationAddress || null,
          latitude: editLatitude,
          longitude: editLongitude,
        }),
      });

      handleCloseEditModal();
      loadEntries(selectedVehicle.id);
      window.dispatchEvent(new CustomEvent('vv_fuel_logged'));
    } catch (err: any) {
      alert(err?.message || 'Fout bij bijwerken van tankbeurt');
    } finally {
      setSavingEdit(false);
    }
  };

  if (!selectedVehicle) {
    return <div className="text-slate-400 text-xs py-8">{t('welcomeSubtitle')}</div>;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center space-x-2">
            {energyType === 'electric' ? (
              <Zap className="w-5 h-5 text-cyan-500" />
            ) : (
              <Fuel className="w-5 h-5 text-amber-500" />
            )}
            <span>
              {energyType === 'electric'
                ? (lang === 'nl' ? 'Laadsessies & Energiebeheer' : 'EV Charging Management')
                : t('fuelTitle')}
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {energyType === 'electric'
              ? (lang === 'nl' ? 'Laadbeurt invoeren voor' : 'Log charging session for')
              : (lang === 'nl' ? 'Tankbeurt invoeren voor' : 'Log fill-up for')}{' ' }
            <span className="font-semibold text-slate-900 dark:text-white">{selectedVehicle.name}</span>
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Export Dropdown */}
          <div className="relative inline-block text-left" ref={exportMenuRef}>
            <button
              type="button"
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold inline-flex items-center space-x-2 transition border border-slate-200 dark:border-slate-700 shadow-sm"
              title="Exporteer tankhistorie naar Excel of CSV"
            >
              {exportingType ? (
                <Loader2 className="w-4 h-4 animate-spin text-accent-500" />
              ) : (
                <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
              )}
              <span>{lang === 'nl' ? 'Exporteren' : 'Export'}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isExportMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  {lang === 'nl' ? 'Tankhistorie Exporteren' : 'Export Format'}
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
                      {lang === 'nl' ? 'Met KPI-totalen, opmaak & verbruik' : 'With totals, metrics & formatting'}
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
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      CSV Bestand (.csv)
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {lang === 'nl' ? 'Universeel UTF-8 met puntkomma' : 'Universal semicolon-separated'}
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsOcrOpen(true)}
            className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold inline-flex items-center space-x-2 transition shadow-sm"
          >
            <Camera className="w-4 h-4 text-amber-500" />
            <span>{t('ocrReceiptScanner')}</span>
          </button>
        </div>
      </div>

      {/* Quick Fuel Entry Form */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm transition-colors">
        {/* Energy Type Switcher - Alleen tonen bij PHEV (zowel benzine tanken als stekker laden mogelijk) */}
        {isPhev && (
          <div className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl w-fit mb-4 border border-slate-200/70 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setEnergyType('fuel')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                energyType === 'fuel'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Fuel className="w-3.5 h-3.5 text-amber-500" />
              <span>{lang === 'nl' ? 'Brandstof (Liters)' : 'Fuel (Liters)'}</span>
            </button>
            <button
              type="button"
              onClick={() => setEnergyType('electric')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                energyType === 'electric'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-cyan-500" />
              <span>{lang === 'nl' ? 'Laadbeurt (kWh)' : 'Charging (kWh)'}</span>
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {warningMessage && (
            <div className="flex items-center space-x-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300 p-3 rounded-xl font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{warningMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
            <div>
              <DatePicker
                label={t('date')}
                value={date}
                onChange={setDate}
                required
              />
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                {t('odometer')} (km) *
              </label>
              <input
                type="number"
                required
                value={odometer}
                onChange={(e) => handleOdometerChange(e.target.value)}
                placeholder={lang === 'nl' ? 'bijv. 58240' : 'e.g. 58240'}
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-1.5 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-sky-500 shadow-sm"
              />
            </div>

            {energyType === 'fuel' ? (
              <>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    {t('liters')} (L) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={liters}
                    onChange={(e) => handleLitersChange(e.target.value)}
                    placeholder={lang === 'nl' ? 'bijv. 45.20' : 'e.g. 45.20'}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-1.5 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    {t('pricePerLiter')} (€/L) *
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={pricePerLiter}
                    onChange={(e) => handlePriceChange(e.target.value)}
                    placeholder={lang === 'nl' ? 'bijv. 1.949' : 'e.g. 1.949'}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-1.5 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 shadow-sm"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    {lang === 'nl' ? 'Stroom geladen (kWh) *' : 'Energy charged (kWh) *'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={kwh}
                    onChange={(e) => handleKwhChange(e.target.value)}
                    placeholder={lang === 'nl' ? 'bijv. 38.50' : 'e.g. 38.50'}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-1.5 text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    {lang === 'nl' ? 'Tarief (€/kWh) *' : 'Rate (€/kWh) *'}
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={pricePerKwh}
                    onChange={(e) => handlePricePerKwhChange(e.target.value)}
                    placeholder={lang === 'nl' ? 'bijv. 0.350' : 'e.g. 0.350'}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-1.5 text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 shadow-sm"
                  />
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 items-end">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                {t('totalCost')} (€)
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={totalCost}
                onChange={(e) => handleTotalChange(e.target.value)}
                placeholder={lang === 'nl' ? 'Berekend of handmatig' : 'Calculated or manual'}
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-1.5 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 shadow-sm"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                {t('notes')}
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={lang === 'nl' ? 'bijv. Euro 95 E10, bandenspanning gecheckt' : 'e.g. Euro 95 E10, tire pressure checked'}
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-1.5 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 shadow-sm"
              />
            </div>

            <div className="flex items-center space-x-5 pb-1">
              <label className="flex items-center space-x-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isFullTank}
                  onChange={(e) => setIsFullTank(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                />
                <span className="text-slate-800 dark:text-slate-200 font-bold">{t('fullTank')}</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={missedPrevious}
                  onChange={(e) => setMissedPrevious(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                />
                <span className="text-slate-800 dark:text-slate-200 font-medium">{t('missedPrevious')}</span>
              </label>
            </div>
          </div>

          {/* Optional Station & GPS Location Section */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={() => setShowLocationSection(!showLocationSection)}
                className="text-slate-700 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 font-bold text-xs inline-flex items-center space-x-1.5 transition"
              >
                <MapPin className="w-3.5 h-3.5 text-sky-500" />
                <span>{t('stationAndLocation')}</span>
                {showLocationSection ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleGetGpsStations}
                  disabled={loadingGps}
                  className="inline-flex items-center space-x-1.5 px-3 py-1 bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60 hover:bg-sky-100 dark:hover:bg-sky-900/60 rounded-lg text-[11px] font-bold transition shadow-sm disabled:opacity-50"
                >
                  {loadingGps ? <Loader2 className="w-3 h-3 animate-spin text-sky-500" /> : <Navigation className="w-3 h-3 text-sky-500" />}
                  <span>{loadingGps ? t('gettingGps') : t('findNearbyGps')}</span>
                </button>
              </div>
            </div>

            {showLocationSection && (
              <div className="space-y-3 bg-slate-50/70 dark:bg-slate-950/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                {/* Search Bar for Stations */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    {searchingStations ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchStations(e.target.value)}
                    placeholder={t('searchStationPlaceholder')}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 shadow-sm"
                  />
                </div>

                {gpsError && (
                  <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 text-[11px] flex items-center space-x-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{gpsError}</span>
                  </div>
                )}

                {/* Nearby Stations List Dropdown */}
                {showStationPicker && nearbyStations.length > 0 && (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-md">
                    <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase px-2 py-1 tracking-wider flex items-center justify-between">
                      <span>{t('gpsNearbyFound')} ({nearbyStations.length})</span>
                      <button
                        type="button"
                        onClick={() => setShowStationPicker(false)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    {nearbyStations.map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => handleSelectStation(st)}
                        className="w-full text-left p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between group transition"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
                            <span>{st.name}</span>
                            {st.distanceFormatted && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-sky-50 dark:bg-sky-950/80 text-sky-600 dark:text-sky-400 font-semibold border border-sky-100 dark:border-sky-900/40">
                                {st.distanceFormatted}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {st.address}
                          </div>
                        </div>
                        <MapPin className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-500 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Direct Fields for Station Name and Address */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {t('stationName')}
                    </label>
                    <input
                      type="text"
                      value={stationName}
                      onChange={(e) => setStationName(e.target.value)}
                      placeholder={lang === 'nl' ? 'bijv. Fieten Olie, Shell, Tango' : 'e.g. Shell, BP, Esso'}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-1.5 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 shadow-sm"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        {t('stationAddress')}
                      </label>
                      {latitude && longitude && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center space-x-0.5"
                        >
                          <span>{t('openInMaps')}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                    <input
                      type="text"
                      value={stationAddress}
                      onChange={(e) => setStationAddress(e.target.value)}
                      placeholder={lang === 'nl' ? 'bijv. Eeser Gaard 2, 8332 VN Steenwijk' : 'e.g. Main Street 12, London'}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-1.5 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 shadow-sm"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Manual Receipt Attachment or OCR Preview */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              {receiptFile || receiptPath ? (
                <div className="inline-flex items-center space-x-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs shadow-sm">
                  <Paperclip className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="font-semibold max-w-[220px] truncate">
                    {receiptFile ? receiptFile.name : (lang === 'nl' ? 'Kassabon gekoppeld' : 'Receipt attached')}
                  </span>
                  {receiptPath && (
                    <a
                      href={`/uploads/receipts/${receiptPath}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-600 dark:text-sky-400 underline font-semibold hover:text-sky-700 ml-1 text-[11px]"
                    >
                      {lang === 'nl' ? 'Bekijken' : 'View'}
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setReceiptFile(null);
                      setReceiptPath(null);
                    }}
                    className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-lg text-emerald-700 dark:text-emerald-300 transition"
                    title={t('removeAttachment')}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer inline-flex items-center space-x-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 transition shadow-sm">
                  <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                  <span>{t('attachReceipt')}</span>
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        setReceiptFile(e.target.files[0]);
                        setReceiptPath(null);
                      }
                    }}
                  />
                </label>
              )}
            </div>

            <div className="text-[11px] text-slate-400">
              {entries.length > 0 ? (
                <span>
                  {lang === 'nl'
                    ? `Vorige stand: ${Math.max(...entries.map((e) => e.odometer)).toLocaleString()} km`
                    : `Previous: ${Math.max(...entries.map((e) => e.odometer)).toLocaleString()} km`}
                </span>
              ) : (
                lang === 'nl'
                  ? 'Tip: Gebruik de OCR scanner om snel je tankbon over te nemen.'
                  : 'Tip: Use the OCR scanner to quickly capture your fuel receipt.'
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || uploadingReceipt}
              className="px-5 py-2 bg-accent-600 hover:bg-accent-700 text-white rounded-xl font-bold text-xs transition disabled:opacity-50 shadow-sm hover:scale-[1.02]"
            >
              {submitting || uploadingReceipt ? t('saving') : t('newFuelEntry')}
            </button>
          </div>
        </form>
      </div>

      {/* Fuel Entry Logs Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm transition-colors">
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <History className="w-4 h-4 text-slate-500" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">
              {t('recentFuelEntries')} ({entries.length})
            </h3>
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="text-xs text-slate-400 text-center py-10">
            {t('noFuelEntries')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">{t('date')}</th>
                  <th className="py-3 px-4">{t('odometer')}</th>
                  <th className="py-3 px-4">{t('liters')}</th>
                  <th className="py-3 px-4">{t('pricePerLiter')}</th>
                  <th className="py-3 px-4">{t('totalCost')}</th>
                  <th className="py-3 px-4">{t('status')}</th>
                  <th className="py-3 px-4">{t('receiptThumbnail')}</th>
                  <th className="py-3 px-4 text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {entries.map((f, idx) => {
                  const nextChronological = entries[idx + 1];
                  let economyText: string | null = null;
                  if (f.is_full_tank && !f.missed_previous && nextChronological && nextChronological.is_full_tank) {
                    const deltaKm = f.odometer - nextChronological.odometer;
                    if (deltaKm > 0 && f.liters > 0) {
                      const kml = deltaKm / f.liters;
                      const l100 = (f.liters / deltaKm) * 100;
                      economyText = lang === 'nl' ? `1 op ${kml.toFixed(1)} (${l100.toFixed(1)} L/100)` : `${l100.toFixed(1)} L/100km`;
                    }
                  }

                  return (
                    <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-200">{formatDisplayDate(f.date)}</div>
                        {(f.station_name || f.station_address) && (
                          <div className="flex items-center space-x-1 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            <MapPin className="w-3 h-3 text-sky-500 shrink-0" />
                            <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[140px]" title={f.station_name || ''}>
                              {f.station_name || ''}
                            </span>
                            {f.station_name && f.station_address && <span>•</span>}
                            <span className="truncate max-w-[150px]" title={f.station_address || ''}>
                              {f.station_address || ''}
                            </span>
                            {f.latitude && f.longitude && (
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${f.latitude},${f.longitude}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sky-500 hover:text-sky-600 inline-flex items-center ml-0.5"
                                title={t('openInMaps')}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-300">
                        {f.odometer.toLocaleString()} km
                      </td>
                      <td className="py-3 px-4 font-semibold">
                        {f.energy_type === 'electric' ? (
                          <span className="inline-flex items-center space-x-1 text-cyan-600 dark:text-cyan-400 font-bold bg-cyan-50 dark:bg-cyan-950/60 px-2 py-0.5 rounded-md border border-cyan-200 dark:border-cyan-800/60">
                            <Zap className="w-3 h-3 text-cyan-500" />
                            <span>{(f.kwh || 0).toFixed(2)} kWh</span>
                          </span>
                        ) : (
                          <span>{f.liters.toFixed(2)} L</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {f.energy_type === 'electric' ? (
                          <span>€ {(f.price_per_kwh || 0).toFixed(3)}/kWh</span>
                        ) : (
                          <span>€ {f.price_per_liter.toFixed(3)}/L</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-black text-slate-900 dark:text-white text-sm">
                        € {f.total_cost.toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700 w-fit">
                            {f.is_full_tank ? t('fullTank') : (lang === 'nl' ? 'Deeltank' : 'Partial')}
                          </span>
                          {economyText && (
                            <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {economyText}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {f.receipt_path ? (
                          <a
                            href={`/uploads/receipts/${f.receipt_path}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center space-x-1 font-semibold"
                          >
                            {f.receipt_path.toLowerCase().endsWith('.pdf') ? (
                              <FileText className="w-3.5 h-3.5" />
                            ) : (
                              <Image className="w-3.5 h-3.5" />
                            )}
                            <span>{t('view')}</span>
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(f)}
                            className="text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            title={t('edit')}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(f.id)}
                            className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            title={t('delete')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Fuel Entry Modal */}
      {editingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-5 text-slate-900 dark:text-slate-100 shadow-2xl my-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-950 flex items-center justify-center text-sky-600 dark:text-sky-400">
                  <Fuel className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">{t('editFuelEntry')}</h3>
                  <p className="text-[11px] text-slate-500">{formatDisplayDate(editingEntry.date)} • {editingEntry.odometer.toLocaleString()} km</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseEditModal}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              {/* Date & Odometer */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">{t('date')}</label>
                  <DatePicker value={editDate} onChange={setEditDate} />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">{t('odometer')} (km)</label>
                  <input
                    type="number"
                    step="1"
                    required
                    value={editOdometer}
                    onChange={(e) => setEditOdometer(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Energy Type Switcher in Edit Modal */}
              <div className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl w-fit border border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditEnergyType('fuel')}
                  className={`flex items-center space-x-1 px-3 py-1 rounded-lg text-xs font-bold transition ${
                    editEnergyType === 'fuel'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500'
                  }`}
                >
                  <Fuel className="w-3 h-3 text-amber-500" />
                  <span>{lang === 'nl' ? 'Brandstof' : 'Fuel'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditEnergyType('electric')}
                  className={`flex items-center space-x-1 px-3 py-1 rounded-lg text-xs font-bold transition ${
                    editEnergyType === 'electric'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500'
                  }`}
                >
                  <Zap className="w-3 h-3 text-cyan-500" />
                  <span>{lang === 'nl' ? 'Laadbeurt (kWh)' : 'Charging'}</span>
                </button>
              </div>

              {/* Liters & Price per Liter OR kWh & Price per kWh */}
              {editEnergyType === 'fuel' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">{t('liters')} (L)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={editLiters}
                      onChange={(e) => handleEditLitersChange(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">{t('pricePerLiter')} (€)</label>
                    <input
                      type="number"
                      step="0.001"
                      required
                      value={editPricePerLiter}
                      onChange={(e) => handleEditPriceChange(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      {lang === 'nl' ? 'Stroom (kWh)' : 'Energy (kWh)'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={editKwh}
                      onChange={(e) => handleEditKwhChange(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      {lang === 'nl' ? 'Tarief (€/kWh)' : 'Rate (€/kWh)'}
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      required
                      value={editPricePerKwh}
                      onChange={(e) => handleEditPricePerKwhChange(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              )}

              {/* Total Cost */}
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">{t('totalCost')} (€)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editTotalCost}
                  onChange={(e) => setEditTotalCost(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Toggles: Full Tank & Missed Previous */}
              <div className="flex flex-wrap items-center gap-4 py-1">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editIsFullTank}
                    onChange={(e) => setEditIsFullTank(e.target.checked)}
                    className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                  <span className="font-medium text-slate-700 dark:text-slate-300">{t('fullTank')}</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editMissedPrevious}
                    onChange={(e) => setEditMissedPrevious(e.target.checked)}
                    className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="font-medium text-slate-700 dark:text-slate-300">{t('missedPrevious')}</span>
                </label>
              </div>

              {/* Station Name & Address */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">{t('station')}</label>
                  <input
                    type="text"
                    placeholder="bijv. Fieten Olie, Shell"
                    value={editStationName}
                    onChange={(e) => setEditStationName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">{lang === 'nl' ? 'Adres / Plaats' : 'Address / City'}</label>
                  <input
                    type="text"
                    placeholder="bijv. Eeser Gaard 2, Steenwijk"
                    value={editStationAddress}
                    onChange={(e) => setEditStationAddress(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">{t('notes')}</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder={lang === 'nl' ? 'bijv. Euro 95 E10, bandenspanning gecheckt' : 'e.g. Euro 95 E10, tire pressure checked'}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Receipt File */}
              <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">
                  {lang === 'nl' ? 'Tankbon / Factuur' : 'Receipt / Invoice'}
                </label>
                {editReceiptPath && !editReceiptFile && (
                  <div className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                    <div className="flex items-center space-x-2 truncate">
                      <FileText className="w-4 h-4 text-sky-500 shrink-0" />
                      <a
                        href={`/uploads/receipts/${editReceiptPath}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sky-600 dark:text-sky-400 hover:underline truncate"
                      >
                        {editReceiptPath}
                      </a>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditReceiptPath(null)}
                      className="text-rose-500 hover:text-rose-700 p-1"
                      title={t('removeReceipt')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setEditReceiptFile(e.target.files[0]);
                      }
                    }}
                    className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-200 dark:file:bg-slate-800 file:text-slate-700 dark:file:text-slate-300 hover:file:bg-slate-300 cursor-pointer"
                  />
                  {editReceiptFile && (
                    <button
                      type="button"
                      onClick={() => setEditReceiptFile(null)}
                      className="text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleCloseEditModal}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 bg-accent-600 hover:bg-accent-700 text-white rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 transition shadow-sm disabled:opacity-50"
                >
                  {savingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{savingEdit ? t('saving') : t('save')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ReceiptScannerModal
        isOpen={isOcrOpen}
        onClose={() => setIsOcrOpen(false)}
        onExtracted={handleOcrExtracted}
      />
    </div>
  );
};
