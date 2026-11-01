import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Table,
} from 'lucide-react';
import { Vehicle } from '../types/index.js';
import { apiFetch } from '../api/client.js';
import { useLanguage } from '../context/LanguageContext.js';

interface ContextType {
  vehicles: Vehicle[];
  selectedVehicle: Vehicle | null;
}

export const Importer: React.FC = () => {
  const { selectedVehicle } = useOutletContext<ContextType>();
  const { t, lang } = useLanguage();
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [forcedFormat, setForcedFormat] = useState<'auto' | 'fuelio' | 'lubelogger' | 'generic'>('auto');
  const [preview, setPreview] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Custom column mapping state if generic
  const [showMapping, setShowMapping] = useState(false);
  const [recordType, setRecordType] = useState<'fuel' | 'service'>('fuel');
  const [dateCol, setDateCol] = useState('');
  const [odoCol, setOdoCol] = useState('');
  const [costCol, setCostCol] = useState('');
  const [litersCol, setLitersCol] = useState('');
  const [notesCol, setNotesCol] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCsvFile(e.target.files[0]);
      setPreview(null);
      setResultMessage(null);
      setError(null);
    }
  };

  const handlePreview = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!csvFile || !selectedVehicle) return;

    setLoading(true);
    setError(null);
    setResultMessage(null);

    const formData = new FormData();
    formData.append('file', csvFile);
    formData.append('vehicleId', selectedVehicle.id);
    if (forcedFormat !== 'auto') {
      formData.append('forcedFormat', forcedFormat);
    }

    if (showMapping) {
      formData.append(
        'mapping',
        JSON.stringify({
          type: recordType,
          dateColumn: dateCol,
          odometerColumn: odoCol,
          costColumn: costCol,
          litersColumn: litersCol || undefined,
          notesColumn: notesCol || undefined,
        })
      );
    }

    try {
      const data = await apiFetch<any>('/api/import/preview', {
        method: 'POST',
        body: formData,
      });
      setPreview(data);

      if (data.detectedFormat === 'generic' && data.headers.length > 0 && !showMapping) {
        setShowMapping(true);
        setDateCol(data.headers[0] || '');
        setOdoCol(data.headers[1] || '');
        setCostCol(data.headers[2] || '');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to inspect CSV');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!preview || !selectedVehicle) return;

    setImporting(true);
    setError(null);
    try {
      const res = await apiFetch<any>('/api/import/execute', {
        method: 'POST',
        body: JSON.stringify({
          vehicleId: selectedVehicle.id,
          records: preview.records,
        }),
      });

      setResultMessage(res.message);
      setPreview(null);
      setCsvFile(null);
    } catch (err: any) {
      setError(err?.message || 'Import failed');
    } finally {
      setImporting(false);
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
            <FileSpreadsheet className="w-5 h-5 text-sky-500" />
            <span>{t('importTitle')}</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t('importSubtitle')} ({selectedVehicle.name})
          </p>
        </div>
      </div>

      {resultMessage && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300 p-4 rounded-xl text-xs flex items-center space-x-2.5 font-medium shadow-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{resultMessage}</span>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-rose-800 dark:text-rose-300 p-4 rounded-xl text-xs flex items-center space-x-2.5 font-medium shadow-sm">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Upload & Format Selector Box */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 space-y-5 shadow-sm transition-colors">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('importType')}
            </label>
            <select
              value={forcedFormat}
              onChange={(e) => setForcedFormat(e.target.value as any)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 shadow-sm"
            >
              <option value="auto">{lang === 'nl' ? 'Automatisch detecteren (Aanbevolen)' : 'Auto-detect format (Recommended)'}</option>
              <option value="fuelio">{t('fuelioCsv')}</option>
              <option value="lubelogger">{t('lubeLoggerCsv')}</option>
              <option value="generic">{t('genericCsv')}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('chooseCsvFile')}
            </label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 dark:file:bg-slate-800 file:text-slate-800 dark:file:text-slate-200 hover:file:bg-slate-200 cursor-pointer"
            />
          </div>
        </div>

        {/* Generic Column Mapper Wizard */}
        {showMapping && preview && (
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-3 text-xs">
            <h4 className="font-bold text-slate-900 dark:text-white">{lang === 'nl' ? 'Kolomtoewijzing Wizard' : 'Column Mapping Wizard'}</h4>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div>
                <label className="text-slate-500 font-medium block mb-1">{lang === 'nl' ? 'Type data' : 'Record Type'}</label>
                <select
                  value={recordType}
                  onChange={(e) => setRecordType(e.target.value as any)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white font-medium"
                >
                  <option value="fuel">{t('fuel')}</option>
                  <option value="service">{t('maintenance')}</option>
                </select>
              </div>
              <div>
                <label className="text-slate-500 font-medium block mb-1">{t('date')} *</label>
                <select
                  value={dateCol}
                  onChange={(e) => setDateCol(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white font-medium"
                >
                  {preview.headers.map((h: string) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-slate-500 font-medium block mb-1">{t('odometer')} *</label>
                <select
                  value={odoCol}
                  onChange={(e) => setOdoCol(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white font-medium"
                >
                  {preview.headers.map((h: string) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-slate-500 font-medium block mb-1">{t('cost')} *</label>
                <select
                  value={costCol}
                  onChange={(e) => setCostCol(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white font-medium"
                >
                  {preview.headers.map((h: string) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-slate-500 font-medium block mb-1">{t('liters')}</label>
                <select
                  value={litersCol}
                  onChange={(e) => setLitersCol(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white font-medium"
                >
                  <option value="">(None)</option>
                  {preview.headers.map((h: string) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-slate-500 font-medium block mb-1">{t('notes')}</label>
                <select
                  value={notesCol}
                  onChange={(e) => setNotesCol(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white font-medium"
                >
                  <option value="">(None)</option>
                  {preview.headers.map((h: string) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handlePreview()}
              className="mt-2 px-3.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 shadow-sm"
            >
              {lang === 'nl' ? 'Opnieuw berekenen met deze toewijzing' : 'Recompute with this mapping'}
            </button>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => handlePreview()}
            disabled={loading || !csvFile}
            className="px-5 py-2.5 bg-slate-900 text-white hover:bg-black dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white rounded-xl font-bold text-xs inline-flex items-center space-x-2 transition disabled:opacity-50 shadow-sm hover:scale-[1.02]"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Table className="w-4 h-4" />}
            <span>{t('previewData')}</span>
          </button>
        </div>
      </div>

      {/* Validation Preview Table */}
      {preview && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden space-y-3 shadow-sm transition-colors">
          {preview.vehicleInfo && (
            <div className="p-4 bg-sky-50/80 dark:bg-sky-950/40 border-b border-sky-100 dark:border-sky-900/50 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-sky-900 dark:text-sky-300">
                  {lang === 'nl' ? 'Gedetecteerd voertuig in export:' : 'Detected vehicle in export:'}
                </span>
                <span className="font-black px-2 py-0.5 rounded-lg bg-sky-100 dark:bg-sky-900/70 text-sky-800 dark:text-sky-200">
                  {preview.vehicleInfo.name || `${preview.vehicleInfo.make} ${preview.vehicleInfo.model}`}
                  {preview.vehicleInfo.plate ? ` (${preview.vehicleInfo.plate})` : ''}
                  {preview.vehicleInfo.year ? ` • ${preview.vehicleInfo.year}` : ''}
                </span>
              </div>
              {selectedVehicle && (
                <span className="text-slate-500 text-[11px]">
                  {lang === 'nl' ? 'Wordt geïmporteerd naar:' : 'Importing into:'}{' '}
                  <strong>{selectedVehicle.name}</strong>
                </span>
              )}
            </div>
          )}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="text-xs">
              <span className="font-bold text-slate-900 dark:text-white">
                {lang === 'nl' ? 'Gedetecteerd:' : 'Detected:'} {preview.detectedFormat.toUpperCase()}
              </span>
              <span className="text-slate-500 ml-3">
                {preview.validRows} {lang === 'nl' ? 'geldige rijen' : 'valid rows'} • {preview.errorRows} {lang === 'nl' ? 'ongeldig' : 'invalid'}
              </span>
            </div>

            <button
              onClick={handleExecuteImport}
              disabled={importing || preview.validRows === 0}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 transition disabled:opacity-50 shadow-sm"
            >
              {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>{t('executeImport')} ({preview.validRows})</span>
            </button>
          </div>

          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 sticky top-0 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">{t('date')}</th>
                  <th className="py-2.5 px-3">{t('odometer')}</th>
                  <th className="py-2.5 px-3">{lang === 'nl' ? 'Liters / Omschrijving' : 'Liters / Description'}</th>
                  <th className="py-2.5 px-3">{lang === 'nl' ? 'Station / Locatie' : 'Station / Location'}</th>
                  <th className="py-2.5 px-3">{t('cost')}</th>
                  <th className="py-2.5 px-3">{t('status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {preview.records.slice(0, 50).map((r: any, idx: number) => (
                  <tr key={idx} className={r.isValid ? 'hover:bg-slate-50 dark:hover:bg-slate-800/20' : 'bg-rose-50/50 dark:bg-rose-950/20'}>
                    <td className="py-2.5 px-3 font-bold uppercase text-[10px] text-slate-500">
                      {r.type === 'fuel' ? t('fuel') : t('maintenance')}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-200">{r.date}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800 dark:text-slate-300">
                      {r.odometer.toLocaleString()} km
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-medium">
                      {r.type === 'fuel' ? (r.liters ? `${r.liters} L` : '—') : r.serviceItem}
                      {r.notes ? <div className="text-[10px] text-slate-400 italic mt-0.5">{r.notes}</div> : null}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 font-medium">
                      {r.stationName || '—'}
                    </td>
                    <td className="py-2.5 px-3 font-black text-slate-900 dark:text-white">€ {r.totalCost.toFixed(2)}</td>
                    <td className="py-2.5 px-3">
                      {r.isValid ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">{lang === 'nl' ? 'Geldig' : 'Valid'}</span>
                      ) : (
                        <span className="text-rose-600 dark:text-rose-400 font-medium text-[11px]">{r.error}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
