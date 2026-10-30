import React, { useState } from 'react';
import { FileDown, X, Loader2 } from 'lucide-react';
import { apiFetch } from '../api/client.js';
import { DatePicker } from './DatePicker.js';
import { useLanguage } from '../context/LanguageContext.js';

interface PdfExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicleId: string;
  vehicleName: string;
}

export const PdfExportModal: React.FC<PdfExportModalProps> = ({
  isOpen,
  onClose,
  vehicleId,
  vehicleName,
}) => {
  const { t, lang } = useLanguage();
  const [includeTires, setIncludeTires] = useState(true);
  const [includeFuel, setIncludeFuel] = useState(true);
  const [includeReceipts, setIncludeReceipts] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExport = async () => {
    setLoading(true);
    setError(null);

    try {
      const blob = await apiFetch<Blob>('/api/analytics/export-pdf', {
        method: 'POST',
        body: JSON.stringify({
          vehicleId,
          includeTires,
          includeFuel,
          includeReceipts,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }),
      });

      // Trigger browser download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Voertuighistorie_${vehicleName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to generate PDF');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 text-slate-900 dark:text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-accent-50 dark:bg-accent-100/10 flex items-center justify-center text-accent-600 dark:text-accent-400">
              <FileDown className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">{t('pdfModalTitle')}</h3>
              <p className="text-[11px] text-slate-500">{t('pdfModalSubtitle')}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 text-xs p-2.5 rounded-lg mb-3">
            {error}
          </div>
        )}

        <div className="space-y-4 text-xs">
          <div>
            <label className="text-slate-700 dark:text-slate-300 font-medium block mb-1">
              {lang === 'nl' ? 'Geselecteerd Voertuig' : 'Selected Vehicle'}
            </label>
            <div className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md font-semibold text-slate-900 dark:text-slate-100">
              {vehicleName}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <DatePicker
                label={lang === 'nl' ? 'Vanaf datum' : 'Start date'}
                value={startDate}
                onChange={setStartDate}
                placeholder={lang === 'nl' ? 'Geen beginfilter' : 'No start filter'}
              />
            </div>
            <div>
              <DatePicker
                label={lang === 'nl' ? 'Tot en met datum' : 'End date'}
                value={endDate}
                onChange={setEndDate}
                placeholder={lang === 'nl' ? 'Geen eindfilter' : 'No end filter'}
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
            <label className="flex items-center space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={includeTires}
                onChange={(e) => setIncludeTires(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-700 text-accent-600 focus:ring-accent-500"
              />
              <span className="text-slate-700 dark:text-slate-300 font-medium">
                {lang === 'nl'
                  ? 'Huidige bandenset & profieldieptes opnemen'
                  : 'Include current tires & tread depths'}
              </span>
            </label>

            <label className="flex items-center space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={includeFuel}
                onChange={(e) => setIncludeFuel(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-700 text-accent-600 focus:ring-accent-500"
              />
              <span className="text-slate-700 dark:text-slate-300 font-medium">{t('includeFuel')}</span>
            </label>

            <label className="flex items-center space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={includeReceipts}
                onChange={(e) => setIncludeReceipts(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-700 text-accent-600 focus:ring-accent-500"
              />
              <span className="text-slate-700 dark:text-slate-300 font-medium">
                {lang === 'nl'
                  ? 'Facturen & tankbonnen als aparte bijlagepagina\'s toevoegen'
                  : t('includeReceipts')}
              </span>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-2 mt-6 border-t border-slate-100 dark:border-slate-800 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={loading}
            className="px-4 py-2 bg-accent-600 hover:bg-accent-700 text-white rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 transition disabled:opacity-50 shadow-sm"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
            <span>{loading ? t('generatingPdf') : t('generatePdf')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
