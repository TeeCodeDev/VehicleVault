import React, { useState } from 'react';
import { Camera, Upload, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.js';

interface ReceiptScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExtracted: (data: {
    date?: string | null;
    liters: number | null;
    pricePerLiter: number | null;
    totalCost: number | null;
    receiptPath: string;
  }) => void;
}

export const ReceiptScannerModal: React.FC<ReceiptScannerModalProps> = ({ isOpen, onClose, onExtracted }) => {
  const { t, lang } = useLanguage();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<any | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
      setOcrResult(null);
      setError(null);
    }
  };

  const handleProcessOcr = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('receipt', file);

    try {
      const token = localStorage.getItem('vv_token');
      const res = await fetch('/api/fuel/ocr', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Failed to scan receipt');
      }

      const data = await res.json();
      setOcrResult(data);
    } catch (err: any) {
      setError(err?.message || 'OCR processing failed');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (ocrResult) {
      onExtracted({
        date: ocrResult.extracted?.date || null,
        liters: ocrResult.extracted?.liters ?? null,
        pricePerLiter: ocrResult.extracted?.pricePerLiter ?? null,
        totalCost: ocrResult.extracted?.totalCost ?? null,
        receiptPath: ocrResult.receiptPath,
      });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-5 text-slate-900 dark:text-slate-100 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-950 flex items-center justify-center text-sky-600 dark:text-sky-400">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">{t('ocrReceiptScanner')}</h3>
              <p className="text-[11px] text-slate-500">{t('ocrSupportedFormats')}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="flex items-center space-x-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 text-xs p-3 rounded-xl mb-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-3.5">
          {/* File picker */}
          <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 rounded-xl p-5 text-center cursor-pointer transition bg-slate-50/50 dark:bg-slate-950/30">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
              id="receipt-file-input"
            />
            <label htmlFor="receipt-file-input" className="cursor-pointer flex flex-col items-center">
              <Upload className="w-7 h-7 text-slate-400 mb-2" />
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {file ? file.name : t('ocrDropzoneText')}
              </span>
              <span className="text-[11px] text-slate-500 mt-0.5">JPG, PNG, WEBP, HEIC</span>
            </label>
          </div>

          {previewUrl && (
            <div className="flex items-center space-x-3 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
              <img src={previewUrl} alt="Receipt preview" className="w-14 h-14 object-cover rounded-lg shadow-sm shrink-0" />
              <div className="flex-1 min-w-0 text-xs">
                <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{file?.name}</p>
                <p className="text-slate-500 text-[11px]">{Math.round((file?.size || 0) / 1024)} KB</p>
              </div>
              <button
                type="button"
                onClick={handleProcessOcr}
                disabled={loading}
                className="shrink-0 px-3.5 py-2 bg-slate-900 hover:bg-black text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white rounded-lg text-xs font-semibold inline-flex items-center space-x-1.5 transition disabled:opacity-50 shadow-sm"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>{loading ? (lang === 'nl' ? 'Analyseren...' : 'Analyzing...') : (lang === 'nl' ? 'Start OCR Scan' : 'Start OCR Scan')}</span>
              </button>
            </div>
          )}

          {loading && (
            <div className="flex items-center space-x-3 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 p-3 rounded-xl text-xs text-sky-800 dark:text-sky-200">
              <Loader2 className="w-4 h-4 animate-spin text-sky-600 dark:text-sky-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-semibold block">{t('scanningReceipt')}</span>
                <span className="text-[11px] text-sky-600 dark:text-sky-400">
                  {lang === 'nl' ? 'Tekst, datum, liters en bedragen worden geanalyseerd...' : 'Parsing text, date, liters, and amounts...'}
                </span>
              </div>
            </div>
          )}

          {/* OCR Result Preview */}
          {ocrResult && (
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 text-xs space-y-2.5">
              <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800 pb-2">
                <span>{lang === 'nl' ? 'Herkende Gegevens' : 'Recognized Data'}</span>
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center space-x-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{t('ocrSuccess')}</span>
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
                <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">{t('date')}</span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {ocrResult.extracted?.date || '—'}
                  </span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">{t('liters')}</span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {ocrResult.extracted?.liters ? `${ocrResult.extracted.liters} L` : '—'}
                  </span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">{t('pricePerLiter')}</span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {ocrResult.extracted?.pricePerLiter ? `€ ${ocrResult.extracted.pricePerLiter}` : '—'}
                  </span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">{t('totalCost')}</span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {ocrResult.extracted?.totalCost ? `€ ${ocrResult.extracted.totalCost}` : '—'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end space-x-2 mt-5 border-t border-slate-100 dark:border-slate-800 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!ocrResult}
            className="px-4 py-1.5 bg-slate-900 text-white hover:bg-black dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white rounded-lg text-xs font-semibold disabled:opacity-50 transition shadow-sm"
          >
            {lang === 'nl' ? 'Gegevens overnemen' : 'Apply values'}
          </button>
        </div>
      </div>
    </div>
  );
};
