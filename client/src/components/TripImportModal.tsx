import React, { useEffect, useRef, useState } from 'react';
import { Upload, X, Loader2, AlertCircle, CheckCircle2, FileSpreadsheet, TriangleAlert } from 'lucide-react';
import { apiFetch } from '../api/client.js';
import { TripImportField, TripImportPreview, Vehicle } from '../types/index.js';
import { formatDisplayDate } from '../utils/format.js';
import { useLanguage } from '../context/LanguageContext.js';

interface Props {
  vehicle: Vehicle;
  onClose: () => void;
  onImported: () => void;
}

type Purpose = 'business' | 'commute' | 'private';

const MAPPABLE: TripImportField[] = ['date', 'from', 'to', 'start', 'end', 'distance', 'purpose', 'description'];

export const TripImportModal: React.FC<Props> = ({ vehicle, onClose, onImported }) => {
  const { t, lang } = useLanguage();
  const nl = lang === 'nl';

  const PURPOSE_LABEL: Record<Purpose, string> = {
    business: t('tripImportPurposeBusiness'),
    commute: t('tripImportPurposeCommute'),
    private: t('tripImportPurposePrivate'),
  };

  const FIELD_LABEL: Record<TripImportField, string> = {
    date: t('tripFieldDate'),
    from: t('tripFieldFrom'),
    to: t('tripFieldTo'),
    start: t('tripFieldStart'),
    end: t('tripFieldEnd'),
    distance: t('tripFieldDistance'),
    purpose: t('tripFieldPurpose'),
    description: t('tripFieldDescription'),
    return: t('tripFieldReturn'),
    plate: t('tripFieldPlate'),
    route: t('tripFieldRoute'),
  };

  const [file, setFile] = useState<File | null>(null);
  const [defaultPurpose, setDefaultPurpose] = useState<Purpose>('private');
  const [mapping, setMapping] = useState<Partial<Record<TripImportField, string>> | null>(null);
  const [preview, setPreview] = useState<TripImportPreview | null>(null);
  const [selectedSections, setSelectedSections] = useState<Set<number>>(new Set());
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ importedCount: number; skippedDuplicates: number; rejected: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const runPreview = async (f: File, purpose: Purpose, manual: Partial<Record<TripImportField, string>> | null) => {
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', f);
      form.append('vehicleId', vehicle.id);
      form.append('defaultPurpose', purpose);
      if (manual) form.append('mapping', JSON.stringify(manual));
      const data = await apiFetch<TripImportPreview>('/api/trips/import/preview', { method: 'POST', body: form });
      setPreview(data);
      // Pre-select the block that belongs to this vehicle (by plate); with no match every block is selected.
      const matching = data.sections.filter((s) => s.plateMatches === true).map((s) => s.index);
      setSelectedSections(new Set(matching.length > 0 ? matching : data.sections.map((s) => s.index)));
      if (!manual) setMapping(data.mapping);
    } catch (err: any) {
      setPreview(null);
      setError(err?.message || (nl ? 'Het bestand kon niet worden gelezen' : 'Could not read file'));
    } finally {
      setLoading(false);
    }
  };

  const handleFile = (f: File | null) => {
    setFile(f);
    setResult(null);
    setMapping(null);
    setPreview(null);
    if (f) runPreview(f, defaultPurpose, null);
  };

  const chosen = (preview?.records ?? []).filter((r) => r.isValid && selectedSections.has(r.section));
  const importable = skipDuplicates ? chosen.filter((r) => !r.isDuplicate) : chosen;

  const handleImport = async () => {
    setImporting(true);
    setError(null);
    try {
      const res = await apiFetch<{ importedCount: number; skippedDuplicates: number; rejected: number }>('/api/trips/import/execute', {
        method: 'POST',
        body: JSON.stringify({ vehicleId: vehicle.id, records: chosen, skipDuplicates }),
      });
      setResult(res);
      onImported();
    } catch (err: any) {
      setError(err?.message || (nl ? 'Importeren mislukt' : 'Import failed'));
    } finally {
      setImporting(false);
    }
  };

  const box = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl';
  const select = 'bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-900 dark:text-white';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="trip-import-title"
        className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <h2 id="trip-import-title" className="text-sm font-black text-slate-900 dark:text-white flex items-center space-x-2">
            <Upload className="w-4 h-4 text-indigo-500" />
            <span>{t('importTripsTitle').replace('{vehicle}', vehicle.name)}</span>
          </h2>
          <button type="button" onClick={onClose} aria-label={t('close')} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto text-xs">
          {result ? (
            <div className="space-y-3 text-center py-8">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {t('importTripsSuccess').replace('{count}', String(result.importedCount))}
              </p>
              {result.skippedDuplicates > 0 && (
                <p className="text-slate-500">
                  {t('importTripsSkippedDuplicates').replace('{count}', String(result.skippedDuplicates))}
                </p>
              )}
              {result.rejected > 0 && (
                <p className="text-amber-600">
                  {t('importTripsRejected').replace('{count}', String(result.rejected))}
                </p>
              )}
              <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-900 text-white hover:bg-black dark:bg-slate-100 dark:text-slate-900 rounded-xl font-bold">
                {t('close')}
              </button>
            </div>
          ) : (
            <>
              <div className={`${box} p-4 flex flex-col md:flex-row md:items-end gap-4`}>
                <div className="flex-1">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1" htmlFor="trip-import-file">
                    {t('tripImportFileLabel')}
                  </label>
                  <input
                    id="trip-import-file"
                    ref={inputRef}
                    type="file"
                    accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                    className="block w-full text-xs text-slate-600 dark:text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-900 file:text-white dark:file:bg-slate-100 dark:file:text-slate-900 file:font-bold"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">{t('tripImportXlsNotice')}</p>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1" htmlFor="trip-import-purpose">
                    {t('tripImportMissingPurposeLabel')}
                  </label>
                  <select
                    id="trip-import-purpose"
                    value={defaultPurpose}
                    onChange={(e) => {
                      const next = e.target.value as Purpose;
                      setDefaultPurpose(next);
                      if (file) runPreview(file, next, mapping && preview?.missingRequired.length ? mapping : null);
                    }}
                    className={select}
                  >
                    {(Object.keys(PURPOSE_LABEL) as Purpose[]).map((p) => (
                      <option key={p} value={p}>{PURPOSE_LABEL[p]}</option>
                    ))}
                  </select>
                </div>
              </div>

              {loading && (
                <div className="flex items-center space-x-2 text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('tripImportReadingFile')}</span>
                </div>
              )}

              {error && (
                <div className="flex items-center space-x-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 p-3 rounded-xl font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {preview && preview.missingRequired.length > 0 && (
                <div className={`${box} p-4 space-y-3`}>
                  <p className="font-bold text-amber-700 dark:text-amber-300 flex items-center space-x-1.5">
                    <TriangleAlert className="w-4 h-4" />
                    <span>{t('tripImportUnrecognizedColumns')}</span>
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {MAPPABLE.map((field) => (
                      <label key={field} className="block">
                        <span className="block text-slate-600 dark:text-slate-400 mb-1">
                          {FIELD_LABEL[field]}
                          {preview.missingRequired.includes(field) ? ' *' : ''}
                        </span>
                        <select
                          className={`${select} w-full`}
                          value={mapping?.[field] ?? ''}
                          onChange={(e) => setMapping({ ...(mapping ?? {}), [field]: e.target.value || undefined })}
                        >
                          <option value="">{t('tripImportNoneOption')}</option>
                          {preview.headers.filter(Boolean).map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={!file || loading}
                    onClick={() => file && runPreview(file, defaultPurpose, mapping ?? {})}
                    className="px-3 py-1.5 bg-slate-900 text-white hover:bg-black dark:bg-slate-100 dark:text-slate-900 rounded-lg font-bold disabled:opacity-50"
                  >
                    {t('tripImportRecheck')}
                  </button>
                </div>
              )}

              {preview && preview.missingRequired.length === 0 && (
                <>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold">
                      {t('tripImportValidRows').replace('{count}', String(preview.validRows))}
                    </span>
                    {preview.duplicateRows > 0 && (
                      <span className="px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 font-bold">
                        {t('tripImportDuplicateRows').replace('{count}', String(preview.duplicateRows))}
                      </span>
                    )}
                    {preview.errorRows > 0 && (
                      <span className="px-2.5 py-1 rounded-lg bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 font-bold">
                        {t('tripImportErrorRows').replace('{count}', String(preview.errorRows))}
                      </span>
                    )}
                    {preview.ignoredRows.length > 0 && (
                      <span className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                        {t('tripImportIgnoredRowsBadge').replace('{count}', String(preview.ignoredRows.length))}
                      </span>
                    )}
                  </div>

                  {preview.sections.length > 1 && (
                    <div className={`${box} p-4 space-y-2`}>
                      <p className="font-bold text-slate-800 dark:text-slate-100">
                        {t('tripImportMultipleVehicles').replace('{vehicle}', vehicle.name)}
                      </p>
                      {preview.sections.map((s) => (
                        <label key={s.index} className="flex items-start space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={selectedSections.has(s.index)}
                            onChange={(e) => {
                              const next = new Set(selectedSections);
                              if (e.target.checked) next.add(s.index);
                              else next.delete(s.index);
                              setSelectedSections(next);
                            }}
                          />
                          <span>
                            <span className="font-semibold text-slate-900 dark:text-white">{s.label}</span>
                            <span className="text-slate-500"> — {s.rows} {nl ? 'ritten' : 'trips'}</span>
                            {s.plateMatches === true && <span className="ml-2 text-emerald-600 font-bold">{t('tripImportPlateMatches')}</span>}
                            {s.plateMatches === false && <span className="ml-2 text-amber-600 font-bold">{t('tripImportPlateMismatch').replace('{vehicle}', vehicle.name)}</span>}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                  {preview.sections.length === 1 && preview.sections[0].plateMatches === false && (
                    <p className="flex items-center space-x-1.5 text-amber-700 dark:text-amber-300 font-medium">
                      <TriangleAlert className="w-4 h-4 shrink-0" />
                      <span>{t('tripImportPlateNotice').replace('{filePlate}', preview.sections[0].plate || '').replace('{vehicle}', vehicle.name)}</span>
                    </p>
                  )}

                  <div className={`${box} overflow-hidden`}>
                    <div className="max-h-72 overflow-auto">
                      <table className="w-full text-left">
                        <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          <tr>
                            <th className="px-3 py-2">{t('date')}</th>
                            <th className="px-3 py-2">{t('tripImportFromTo')}</th>
                            <th className="px-3 py-2 text-right">{t('tripImportOdometerHeader')}</th>
                            <th className="px-3 py-2 text-right">{t('tripImportDistanceHeader')}</th>
                            <th className="px-3 py-2">{t('tripImportPurposeHeader')}</th>
                            <th className="px-3 py-2">{t('tripImportCommentHeader')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {preview.records.map((r) => {
                            const out = !selectedSections.has(r.section);
                            return (
                              <tr key={r.rowNumber} className={out ? 'opacity-40' : r.isValid ? '' : 'bg-rose-50/60 dark:bg-rose-950/20'}>
                                <td className="px-3 py-1.5 whitespace-nowrap">{r.date ? formatDisplayDate(r.date) : '—'}</td>
                                <td className="px-3 py-1.5">{r.fromLocation || '—'} → {r.toLocation || '—'}</td>
                                <td className="px-3 py-1.5 text-right whitespace-nowrap">{r.startOdometer}–{r.endOdometer}</td>
                                <td className="px-3 py-1.5 text-right">{r.distanceKm}</td>
                                <td className="px-3 py-1.5">{PURPOSE_LABEL[r.purpose]}</td>
                                <td className="px-3 py-1.5 text-[11px]">
                                  {r.error ? <span className="text-rose-600 font-semibold">{nl ? `Regel ${r.rowNumber}: ${r.error}` : `Row ${r.rowNumber}: ${r.error}`}</span> : null}
                                  {!r.error && r.isDuplicate ? <span className="text-amber-600 font-semibold">{t('tripImportRowDuplicate')}</span> : null}
                                  {!r.error && r.warning ? <span className="text-slate-500"> {r.warning}</span> : null}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {preview.ignoredRows.length > 0 && (
                    <details className="text-slate-500">
                      <summary className="cursor-pointer font-semibold">
                        {t('tripImportIgnoredRowsSummary').replace('{count}', String(preview.ignoredRows.length))}
                      </summary>
                      <ul className="mt-1 space-y-0.5 pl-4 list-disc">
                        {preview.ignoredRows.map((r) => (
                          <li key={r.rowNumber}>
                            {nl ? `Regel ${r.rowNumber}: ${r.reason}` : `Row ${r.rowNumber}: ${r.reason}`}{' '}
                            <span className="text-slate-400">({r.text})</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </>
              )}

              {!preview && !loading && !error && (
                <div className="text-center text-slate-400 py-6">
                  <FileSpreadsheet className="w-8 h-8 mx-auto mb-2" />
                  <p>{t('tripImportPromptChooseFile')}</p>
                </div>
              )}
            </>
          )}
        </div>

        {!result && preview && preview.missingRequired.length === 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 border-t border-slate-200 dark:border-slate-800">
            <label className="flex items-center space-x-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
              <input type="checkbox" checked={skipDuplicates} onChange={(e) => setSkipDuplicates(e.target.checked)} />
              <span>{t('tripImportSkipDuplicates')}</span>
            </label>
            <div className="flex items-center space-x-2">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800">
                {t('cancel')}
              </button>
              <button
                type="button"
                disabled={importing || importable.length === 0}
                onClick={handleImport}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold disabled:opacity-50 flex items-center space-x-2"
              >
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                <span>{t('tripImportExecuteButton').replace('{count}', String(importable.length))}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
