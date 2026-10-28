import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Fuel,
  Camera,
  AlertTriangle,
  Trash2,
  Image,
  CheckCircle2,
  History,
  Paperclip,
  X,
  FileText,
} from 'lucide-react';
import { Vehicle, FuelEntry } from '../types/index.js';
import { apiFetch } from '../api/client.js';
import { ReceiptScannerModal } from '../components/ReceiptScannerModal.js';
import { DatePicker } from '../components/DatePicker.js';
import { useLanguage } from '../context/LanguageContext.js';
import { addToOfflineQueue } from '../utils/offlineQueue.js';

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
  const [liters, setLiters] = useState<string>('');
  const [pricePerLiter, setPricePerLiter] = useState<string>('');
  const [totalCost, setTotalCost] = useState<string>('');
  const [isFullTank, setIsFullTank] = useState(true);
  const [missedPrevious, setMissedPrevious] = useState(false);
  const [notes, setNotes] = useState('');
  const [receiptPath, setReceiptPath] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  // Warnings / Validation State
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  const handleTotalChange = (val: string) => {
    setTotalCost(val);
    const tVal = parseFloat(val);
    const l = parseFloat(liters);
    if (!isNaN(tVal) && !isNaN(l) && l > 0) {
      setPricePerLiter((tVal / l).toFixed(3));
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

  const handleOcrExtracted = (data: {
    date?: string | null;
    liters: number | null;
    pricePerLiter: number | null;
    totalCost: number | null;
    receiptPath: string;
  }) => {
    if (data.date) setDate(data.date);
    if (data.liters) setLiters(String(data.liters));
    if (data.pricePerLiter) setPricePerLiter(String(data.pricePerLiter));
    if (data.totalCost) setTotalCost(String(data.totalCost));
    setReceiptPath(data.receiptPath);
    setReceiptFile(null);
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
      });

      alert(t('offlineSavedAlert'));
      setLiters('');
      setPricePerLiter('');
      setTotalCost('');
      setNotes('');
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
        const formData = new FormData();
        formData.append('receipt', receiptFile);
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
          liters: parseFloat(liters),
          price_per_liter: parseFloat(pricePerLiter),
          total_cost: parseFloat(totalCost),
          is_full_tank: isFullTank,
          missed_previous: missedPrevious,
          notes: notes || null,
          receipt_path: finalReceiptPath || null,
        }),
      });

      // Reset fields
      setLiters('');
      setPricePerLiter('');
      setTotalCost('');
      setNotes('');
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
        });
        alert(t('offlineSavedAlert'));
        setLiters('');
        setPricePerLiter('');
        setTotalCost('');
        setNotes('');
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

  if (!selectedVehicle) {
    return <div className="text-slate-400 text-xs py-8">{t('welcomeSubtitle')}</div>;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center space-x-2">
            <Fuel className="w-5 h-5 text-amber-500" />
            <span>{t('fuelTitle')}</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {lang === 'nl' ? 'Tankbeurt invoeren voor' : 'Log fill-up for'}{' '}
            <span className="font-semibold text-slate-900 dark:text-white">{selectedVehicle.name}</span>
          </p>
        </div>

        <button
          onClick={() => setIsOcrOpen(true)}
          className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold inline-flex items-center space-x-2 transition shadow-sm"
        >
          <Camera className="w-4 h-4 text-amber-500" />
          <span>{t('ocrReceiptScanner')}</span>
        </button>
      </div>

      {/* Quick Fuel Entry Form */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm transition-colors">
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
                placeholder={lang === 'nl' ? 'bijv. Shell A1, Euro 95 E10' : 'e.g. Shell A1, Euro 95 E10'}
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
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                {receiptFile || receiptPath ? '' : (lang === 'nl' ? 'PDF of foto (.jpg, .png) van de kassabon' : 'PDF or receipt image (.jpg, .png)')}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
            <div className="text-[11px] text-slate-500">
              {receiptPath ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center space-x-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{t('ocrSuccess')}</span>
                </span>
              ) : (
                lang === 'nl'
                  ? 'Tip: Gebruik de OCR scanner om snel een kassabon van het tankstation in te lezen.'
                  : 'Tip: Use the OCR scanner to quickly capture your fuel receipt.'
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || uploadingReceipt}
              className="px-5 py-2 bg-slate-900 text-white hover:bg-black dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white rounded-xl font-bold text-xs transition disabled:opacity-50 shadow-sm hover:scale-[1.02]"
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
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-200">{f.date}</td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-300">
                      {f.odometer.toLocaleString()} km
                    </td>
                    <td className="py-3 px-4 font-semibold">{f.liters.toFixed(2)} L</td>
                    <td className="py-3 px-4">€ {f.price_per_liter.toFixed(3)}</td>
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
                      <button
                        onClick={() => handleDelete(f.id)}
                        className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 rounded transition"
                        title={t('delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );})}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ReceiptScannerModal
        isOpen={isOcrOpen}
        onClose={() => setIsOcrOpen(false)}
        onExtracted={handleOcrExtracted}
      />
    </div>
  );
};
