import React, { useState } from 'react';
import {
  X,
  FileText,
  Download,
  ExternalLink,
  RotateCw,
  ZoomIn,
  ZoomOut,
  FileImage,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.js';

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  url: string;
  fileSize?: number;
  date?: string;
  notes?: string;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  isOpen,
  onClose,
  title,
  url,
  fileSize,
  date,
  notes,
}) => {
  const { lang } = useLanguage();
  const [rotation, setRotation] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);

  if (!isOpen) return null;

  const isPdf = url.toLowerCase().endsWith('.pdf') || url.toLowerCase().includes('.pdf');
  const isImage = /\.(jpg|jpeg|png|webp|avif|gif)$/i.test(url);

  const formatFileSize = (bytes?: number): string => {
    if (!bytes || bytes === 0) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-md animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-950/30">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800/60 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 shadow-2xs">
              {isPdf ? <FileText className="w-5 h-5 text-rose-500" /> : <FileImage className="w-5 h-5 text-sky-500" />}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                {title}
              </h3>
              <div className="flex items-center space-x-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                <span className="font-semibold uppercase tracking-wider px-1.5 py-0.2 rounded bg-slate-200/70 dark:bg-slate-800 text-[10px]">
                  {isPdf ? 'PDF Document' : isImage ? (lang === 'nl' ? 'Afbeelding' : 'Image') : (lang === 'nl' ? 'Bestand' : 'File')}
                </span>
                {fileSize && (
                  <>
                    <span>•</span>
                    <span>{formatFileSize(fileSize)}</span>
                  </>
                )}
                {date && (
                  <>
                    <span>•</span>
                    <span>{date}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center space-x-1.5 shrink-0">
            {isImage && (
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5 mr-1 border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  disabled={zoomLevel <= 0.5}
                  className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 disabled:opacity-30 transition"
                  title={lang === 'nl' ? 'Uitzoomen' : 'Zoom out'}
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-[10px] font-mono font-bold px-1.5 text-slate-500 dark:text-slate-400 min-w-[38px] text-center">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  disabled={zoomLevel >= 3}
                  className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 disabled:opacity-30 transition"
                  title={lang === 'nl' ? 'Inzoomen' : 'Zoom in'}
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-0.5" />
                <button
                  type="button"
                  onClick={handleRotate}
                  className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition"
                  title={lang === 'nl' ? 'Draaien (90°)' : 'Rotate (90°)'}
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </div>
            )}

            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
              title={lang === 'nl' ? 'Open in nieuw tabblad' : 'Open in new tab'}
            >
              <ExternalLink className="w-4 h-4" />
            </a>

            <a
              href={url}
              download={title}
              className="p-2 text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
              title={lang === 'nl' ? 'Downloaden' : 'Download file'}
            >
              <Download className="w-4 h-4" />
            </a>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition ml-1"
              title={lang === 'nl' ? 'Sluiten' : 'Close'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {notes && (
          <div className="px-6 py-2 bg-amber-50/70 dark:bg-amber-950/30 border-b border-amber-200/60 dark:border-amber-900/40 text-[11px] text-amber-900 dark:text-amber-200 italic">
            "{notes}"
          </div>
        )}

        {/* Modal Content Body */}
        <div className="flex-1 overflow-auto bg-slate-100/70 dark:bg-slate-950/60 p-2 sm:p-4 flex items-center justify-center min-h-[300px]">
          {isPdf ? (
            <div className="w-full h-[72vh] md:h-[80vh] flex flex-col">
              <iframe
                src={`${url}#toolbar=1&navpanes=0`}
                className="w-full h-full rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm bg-white"
                title={title}
              />
              <div className="text-center pt-2 text-[11px] text-slate-500">
                {lang === 'nl'
                  ? 'Wordt de PDF niet goed geladen? '
                  : 'Having issues loading the PDF? '}
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-600 dark:text-sky-400 font-semibold hover:underline"
                >
                  {lang === 'nl' ? 'Klik hier om direct te openen' : 'Click here to open directly'}
                </a>
              </div>
            </div>
          ) : isImage ? (
            <div className="max-w-full max-h-[75vh] flex items-center justify-center overflow-auto p-2">
              <img
                src={url}
                alt={title}
                style={{
                  transform: `rotate(${rotation}deg) scale(${zoomLevel})`,
                  transition: 'transform 0.2s ease-in-out',
                }}
                className="max-h-[72vh] max-w-full object-contain rounded-lg shadow-md border border-slate-200/80 dark:border-slate-800"
              />
            </div>
          ) : (
            <div className="text-center py-12 p-6">
              <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {title}
              </p>
              <p className="text-[11px] text-slate-500 mb-4">
                {lang === 'nl'
                  ? 'Voor dit bestandsformaat is geen directe inline viewer beschikbaar.'
                  : 'Direct inline preview is not supported for this file type.'}
              </p>
              <a
                href={url}
                download={title}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold inline-flex items-center space-x-2 transition shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>{lang === 'nl' ? 'Bestand Downloaden' : 'Download File'}</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

