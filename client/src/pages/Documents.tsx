import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  FolderLock,
  Plus,
  FileText,
  FileCheck,
  Download,
  Trash2,
  X,
  UploadCloud,
  File,
  Eye,
  LayoutList,
  LayoutGrid,
  Tag,
} from 'lucide-react';
import { Vehicle, VehicleDocument } from '../types/index.js';
import { apiFetch } from '../api/client.js';
import { useLanguage } from '../context/LanguageContext.js';
import { compressImage } from '../utils/imageCompressor.js';
import { formatDisplayDate } from '../utils/format.js';
import { DatePicker } from '../components/DatePicker.js';
import { DocumentPreviewModal } from '../components/DocumentPreviewModal.js';
import { VignetteManager } from '../components/VignetteManager.js';

interface ContextType {
  vehicles: Vehicle[];
  selectedVehicle: Vehicle | null;
}

type DocCategory = 'all' | 'registration' | 'insurance' | 'apk' | 'invoice' | 'manual' | 'other';

export const Documents: React.FC = () => {
  const { selectedVehicle } = useOutletContext<ContextType>();
  const { t, lang } = useLanguage();

  const [activeSection, setActiveSection] = useState<'documents' | 'vignettes'>('documents');
  const [documents, setDocuments] = useState<VehicleDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<DocCategory>('all');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'name_asc'>('date_desc');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    return (localStorage.getItem('vv_documents_view') as 'list' | 'grid') || 'list';
  });

  const handleSetViewMode = (mode: 'list' | 'grid') => {
    setViewMode(mode);
    localStorage.setItem('vv_documents_view', mode);
  };

  // Document preview state
  const [previewDoc, setPreviewDoc] = useState<{
    isOpen: boolean;
    title: string;
    url: string;
    date?: string;
    fileSize?: number;
    notes?: string;
  } | null>(null);

  // Upload modal state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docName, setDocName] = useState('');
  const [docCategory, setDocCategory] = useState<'registration' | 'insurance' | 'apk' | 'invoice' | 'manual' | 'other'>('registration');
  const [docNotes, setDocNotes] = useState('');
  const [docExpiresAt, setDocExpiresAt] = useState('');
  const [docDate, setDocDate] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [compressionRatio, setCompressionRatio] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (selectedVehicle) {
      loadDocuments(selectedVehicle.id);
    }
  }, [selectedVehicle?.id]);

  const loadDocuments = async (vehicleId: string) => {
    setLoading(true);
    try {
      const res = await apiFetch<{ documents: VehicleDocument[] }>(`/api/documents/${vehicleId}`);
      setDocuments(res.documents);
    } catch {
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const processSelectedFile = async (file: File) => {
    setCompressionRatio(null);
    if (!docName) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '');
      setDocName(cleanName);
    }
    if (!docDate) {
      const dmy = file.name.match(/\b([0-3]?[0-9])[-/.]([0-1]?[0-9])[-/.]([12][0-9]{3})\b/);
      if (dmy) {
        setDocDate(`${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`);
      } else {
        const ymd = file.name.match(/\b([12][0-9]{3})[-/.]([0-1]?[0-9])[-/.]([0-3]?[0-9])\b/);
        if (ymd) {
          setDocDate(`${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`);
        } else {
          setDocDate(new Date().toISOString().split('T')[0]);
        }
      }
    }
    if (file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic)$/i.test(file.name)) {
      setCompressing(true);
      try {
        const origKb = (file.size / 1024).toFixed(0);
        const compressed = await compressImage(file, 1600, 2200, 0.82);
        const compKb = (compressed.size / 1024).toFixed(0);
        setDocFile(compressed);
        setCompressionRatio(`${origKb} KB → ${compKb} KB`);
      } catch (err) {
        console.warn('Compression error, using raw file', err);
        setDocFile(file);
      } finally {
        setCompressing(false);
      }
    } else {
      setDocFile(file);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processSelectedFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const validExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.heic'];
      const lower = file.name.toLowerCase();
      const isSupported = validExtensions.some((ext) => lower.endsWith(ext)) || file.type.startsWith('image/') || file.type === 'application/pdf';
      if (!isSupported) {
        alert(
          lang === 'nl'
            ? 'Alleen PDF- of afbeeldingsbestanden (.pdf, .jpg, .png, .webp) zijn toegestaan.'
            : 'Only PDF or image files (.pdf, .jpg, .png, .webp) are supported.'
        );
        return;
      }
      await processSelectedFile(file);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle || !docFile) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', docFile);
      formData.append('document', docFile);
      formData.append('name', docName || docFile.name);
      formData.append('category', docCategory);
      if (docNotes) formData.append('notes', docNotes);
      if (docExpiresAt) formData.append('expires_at', docExpiresAt);
      if (docDate) formData.append('document_date', docDate);

      await apiFetch(`/api/documents/${selectedVehicle.id}`, {
        method: 'POST',
        body: formData,
      });

      setIsUploadModalOpen(false);
      setDocFile(null);
      setDocName('');
      setDocNotes('');
      setDocExpiresAt('');
      setDocDate('');
      setCompressionRatio(null);
      setDocCategory('registration');
      setIsDragging(false);
      await loadDocuments(selectedVehicle.id);
    } catch (err: any) {
      alert(err?.message || 'Upload mislukt. Controleer bestandsformaat (PDF, JPG, PNG) en bestandsgrootte (max 30MB).');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm(t('confirmDeleteDocument'))) return;
    try {
      await apiFetch(`/api/documents/${docId}`, {
        method: 'DELETE',
      });
      if (selectedVehicle) {
        await loadDocuments(selectedVehicle.id);
      }
    } catch {
      // ignore
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatDocumentTitle = (title: string): string => {
    if (!title) return '';
    return title.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, '$3-$2-$1');
  };

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'registration':
        return {
          label: t('docCatRegistration'),
          badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/40',
        };
      case 'insurance':
        return {
          label: t('docCatInsurance'),
          badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40',
        };
      case 'apk':
        return {
          label: t('docCatApk'),
          badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40',
        };
      case 'invoice':
        return {
          label: t('docCatInvoices'),
          badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/40',
        };
      case 'manual':
        return {
          label: t('docCatManual'),
          badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/40',
        };
      default:
        return {
          label: t('docCatOther'),
          badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
        };
    }
  };

  const extractDocumentDate = (doc: VehicleDocument): string => {
    if (doc.document_date && /^\d{4}-\d{2}-\d{2}$/.test(doc.document_date)) {
      return doc.document_date;
    }
    const dmyMatch = doc.name ? doc.name.match(/\b([0-3]?[0-9])[-/.]([0-1]?[0-9])[-/.]([12][0-9]{3})\b/) : null;
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, '0');
      const month = dmyMatch[2].padStart(2, '0');
      const year = dmyMatch[3];
      return `${year}-${month}-${day}`;
    }
    const ymdMatch = doc.name ? doc.name.match(/\b([12][0-9]{3})[-/.]([0-1]?[0-9])[-/.]([0-3]?[0-9])\b/) : null;
    if (ymdMatch) {
      return `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}-${ymdMatch[3].padStart(2, '0')}`;
    }
    if (doc.created_at) {
      return doc.created_at.split('T')[0];
    }
    return '1970-01-01';
  };

  const filteredDocuments = documents
    .filter((doc) => {
      if (activeCategory === 'all') return true;
      return doc.category === activeCategory;
    })
    .sort((a, b) => {
      if (sortBy === 'name_asc') {
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      }
      const dateA = extractDocumentDate(a);
      const dateB = extractDocumentDate(b);
      if (sortBy === 'date_asc') {
        return dateA.localeCompare(dateB) || a.created_at.localeCompare(b.created_at);
      }
      // default: date_desc (nieuwste datum eerst)
      return dateB.localeCompare(dateA) || b.created_at.localeCompare(a.created_at);
    });

  const categories: { key: DocCategory; label: string }[] = [
    { key: 'all', label: t('docCatAll') },
    { key: 'registration', label: t('docCatRegistration') },
    { key: 'insurance', label: t('docCatInsurance') },
    { key: 'apk', label: t('docCatApk') },
    { key: 'invoice', label: t('docCatInvoices') },
    { key: 'manual', label: t('docCatManual') },
    { key: 'other', label: t('docCatOther') },
  ];

  if (!selectedVehicle) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <FolderLock className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
        <h3 className="text-base font-bold text-slate-800 dark:text-white">
          {lang === 'nl' ? 'Geen voertuig geselecteerd' : 'No vehicle selected'}
        </h3>
        <p className="text-xs text-slate-500 max-w-sm mt-1">
          {lang === 'nl'
            ? 'Selecteer een voertuig in het menu hierboven om de digitale handschoenenkast te bekijken.'
            : 'Select a vehicle from the top menu to access the digital glovebox.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Section Switcher: Documenten vs Tolvignetten */}
      <div className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl border border-slate-200 dark:border-slate-800 w-fit">
        <button
          type="button"
          onClick={() => setActiveSection('documents')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
            activeSection === 'documents'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <FolderLock className="w-3.5 h-3.5 text-sky-500" />
          <span>{lang === 'nl' ? 'Documenten & Facturen' : 'Documents & Invoices'}</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 font-mono">
            {documents.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('vignettes')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
            activeSection === 'vignettes'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Tag className="w-3.5 h-3.5 text-amber-500" />
          <span>{lang === 'nl' ? 'Tolvignetten & Milieustickers' : 'Vignettes & Badges'}</span>
        </button>
      </div>

      {activeSection === 'vignettes' ? (
        <VignetteManager vehicle={selectedVehicle} />
      ) : (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center space-x-2">
                <FolderLock className="w-5 h-5 text-sky-500" />
                <span>{t('documentsTitle')}</span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t('documentsSubtitle')} • <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedVehicle.name}</span>
              </p>
            </div>

            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="px-4 py-2 bg-accent-600 hover:bg-accent-700 text-white rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 transition shadow-sm hover:scale-[1.02] self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>{t('uploadDocument')}</span>
            </button>
          </div>

      {/* Filter Tabs & View Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => {
            const count = cat.key === 'all' ? documents.length : documents.filter((d) => d.category === cat.key).length;
            const isActive = activeCategory === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center space-x-1.5 ${
                  isActive
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800'
                }`}
              >
                <span>{cat.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive
                      ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Sort & View Switcher */}
        <div className="flex items-center space-x-2 self-end sm:self-auto shrink-0">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-sky-500 shadow-2xs"
            title={lang === 'nl' ? 'Documenten sorteren' : 'Sort documents'}
          >
            <option value="date_desc">{lang === 'nl' ? 'Datum: Nieuwste eerst' : 'Date: Newest first'}</option>
            <option value="date_asc">{lang === 'nl' ? 'Datum: Oudste eerst' : 'Date: Oldest first'}</option>
            <option value="name_asc">{lang === 'nl' ? 'Naam (A-Z)' : 'Name (A-Z)'}</option>
          </select>

          <div className="flex items-center space-x-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <button
            type="button"
            onClick={() => handleSetViewMode('list')}
            className={`p-1.5 rounded-lg text-xs font-semibold transition ${
              viewMode === 'list'
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
            title={lang === 'nl' ? 'Lijstweergave' : 'List view'}
          >
            <LayoutList className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleSetViewMode('grid')}
            className={`p-1.5 rounded-lg text-xs font-semibold transition ${
              viewMode === 'grid'
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
            title={lang === 'nl' ? 'Rasterweergave' : 'Grid view'}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          </div>
        </div>
      </div>

      {/* Documents Content */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800">
          {t('loading')}
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-12 text-center shadow-sm">
          <FolderLock className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-white">
            {t('noDocumentsFound')}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
            Bewaar al je belangrijke autopapieren, groene kaart, kentekencard scans en garagefacturen digitaal op één veilige plek.
          </p>
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="px-4 py-2 bg-accent-600 hover:bg-accent-700 text-white rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>{t('uploadDocument')}</span>
          </button>
        </div>
      ) : viewMode === 'list' ? (
        <div className="space-y-2.5">
          {filteredDocuments.map((doc) => {
            const badge = getCategoryBadge(doc.category);
            const isPdf = doc.mime_type?.includes('pdf') || doc.file_path.endsWith('.pdf');
            const isImage = doc.mime_type?.includes('image') || /\.(jpg|jpeg|png|webp|heic)$/i.test(doc.file_path);
            const downloadUrl = `/uploads/documents/${doc.file_path}`;

            return (
              <div
                key={doc.id}
                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-2xl p-3.5 sm:p-4 shadow-2xs hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 group"
              >
                {/* Left: Icon + Title + Metadata (ALL ALIGNED TOGETHER) */}
                <div className="flex items-start sm:items-center space-x-3.5 min-w-0 flex-1">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                      isPdf
                        ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-500 border-rose-200/60 dark:border-rose-900/40'
                        : isImage
                        ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-500 border-sky-200/60 dark:border-sky-900/40'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {isPdf ? (
                      <FileText className="w-5 h-5 text-rose-500" />
                    ) : isImage ? (
                      <FileCheck className="w-5 h-5 text-sky-500" />
                    ) : (
                      <File className="w-5 h-5 text-slate-500" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-2">
                      <h4
                        className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition"
                        title={formatDocumentTitle(doc.name)}
                      >
                        {formatDocumentTitle(doc.name)}
                      </h4>
                    </div>

                    <div className="flex items-center flex-wrap gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${badge.badgeClass}`}>
                        {badge.label}
                      </span>

                      {(() => {
                        const dateStr = extractDocumentDate(doc);
                        return dateStr && dateStr !== '1970-01-01' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            📅 {formatDisplayDate(dateStr)}
                          </span>
                        ) : null;
                      })()}

                      {doc.expires_at && (() => {
                        const exp = new Date(doc.expires_at);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const days = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                        const isExpired = days < 0;
                        const isDueSoon = days >= 0 && days <= 30;

                        return (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                              isExpired
                                ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                                : isDueSoon
                                ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                                : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                            }`}
                            title={`Vervaldatum: ${formatDisplayDate(doc.expires_at)}`}
                          >
                            {isExpired
                              ? (lang === 'nl' ? `Verlopen (${formatDisplayDate(doc.expires_at)})` : `Expired (${formatDisplayDate(doc.expires_at)})`)
                              : isDueSoon
                              ? (lang === 'nl' ? `Verloopt over ${days}d` : `Expires in ${days}d`)
                              : (lang === 'nl' ? `Geldig t/m ${formatDisplayDate(doc.expires_at)}` : `Valid until ${formatDisplayDate(doc.expires_at)}`)}
                          </span>
                        );
                      })()}

                      <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                        {formatFileSize(doc.file_size)}
                      </span>

                      {doc.notes && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 italic truncate max-w-xs" title={doc.notes}>
                          • "{doc.notes}"
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center justify-end space-x-1.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800/80 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewDoc({
                        isOpen: true,
                        title: formatDocumentTitle(doc.name),
                        url: downloadUrl,
                        fileSize: doc.file_size,
                        notes: doc.notes || undefined,
                      })
                    }
                    className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/40 dark:hover:bg-sky-900/50 text-sky-700 dark:text-sky-300 rounded-xl transition inline-flex items-center space-x-1.5 font-bold text-xs border border-sky-200/60 dark:border-sky-800/40 shadow-2xs"
                    title={lang === 'nl' ? 'Bekijk direct in-app' : 'Preview in-app'}
                  >
                    <Eye className="w-3.5 h-3.5 text-sky-500" />
                    <span>{lang === 'nl' ? 'Bekijken' : 'Preview'}</span>
                  </button>

                  <a
                    href={downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition inline-flex items-center space-x-1.5 font-semibold text-xs border border-slate-200/60 dark:border-slate-700"
                    title={t('downloadDocument')}
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>{t('download')}</span>
                  </a>

                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition"
                    title={t('delete')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocuments.map((doc) => {
            const badge = getCategoryBadge(doc.category);
            const isPdf = doc.mime_type?.includes('pdf') || doc.file_path.endsWith('.pdf');
            const isImage = doc.mime_type?.includes('image') || /\.(jpg|jpeg|png|webp|heic)$/i.test(doc.file_path);
            const downloadUrl = `/uploads/documents/${doc.file_path}`;

            return (
              <div
                key={doc.id}
                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div className="flex items-start space-x-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                          isPdf
                            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-500 border-rose-200/60 dark:border-rose-900/40'
                            : isImage
                            ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-500 border-sky-200/60 dark:border-sky-900/40'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {isPdf ? (
                          <FileText className="w-5 h-5 text-rose-500" />
                        ) : isImage ? (
                          <FileCheck className="w-5 h-5 text-sky-500" />
                        ) : (
                          <File className="w-5 h-5 text-slate-500" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4
                          className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition"
                          title={formatDocumentTitle(doc.name)}
                        >
                          {formatDocumentTitle(doc.name)}
                        </h4>
                        <div className="flex items-center flex-wrap gap-1 mt-1">
                          <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${badge.badgeClass}`}>
                            {badge.label}
                          </span>
                          {(() => {
                            const dateStr = extractDocumentDate(doc);
                            return dateStr && dateStr !== '1970-01-01' ? (
                              <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                📅 {formatDisplayDate(dateStr)}
                              </span>
                            ) : null;
                          })()}
                          {doc.expires_at && (() => {
                            const exp = new Date(doc.expires_at);
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const days = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                            const isExpired = days < 0;
                            const isDueSoon = days >= 0 && days <= 30;

                            return (
                              <span
                                className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                  isExpired
                                    ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                                    : isDueSoon
                                    ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                                    : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                                }`}
                                title={`Vervaldatum: ${formatDisplayDate(doc.expires_at)}`}
                              >
                                {isExpired
                                  ? (lang === 'nl' ? `Verlopen` : `Expired`)
                                  : isDueSoon
                                  ? (lang === 'nl' ? `${days}d` : `${days}d`)
                                  : (lang === 'nl' ? `Geldig` : `Valid`)}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      title={t('delete')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {doc.notes && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-2 mb-1 p-2 bg-slate-50 dark:bg-slate-950/40 rounded-lg italic">
                      "{doc.notes}"
                    </p>
                  )}
                </div>

                <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                  <div className="font-medium">
                    <span>{formatFileSize(doc.file_size)}</span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewDoc({
                          isOpen: true,
                          title: formatDocumentTitle(doc.name),
                          url: downloadUrl,
                          fileSize: doc.file_size,
                          notes: doc.notes || undefined,
                        })
                      }
                      className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/40 dark:hover:bg-sky-900/50 text-sky-700 dark:text-sky-300 rounded-lg transition inline-flex items-center space-x-1 font-bold text-[11px] border border-sky-200/60 dark:border-sky-800/40"
                      title={lang === 'nl' ? 'Bekijk direct in-app' : 'Preview in-app'}
                    >
                      <Eye className="w-3.5 h-3.5 text-sky-500" />
                      <span>{lang === 'nl' ? 'Bekijken' : 'Preview'}</span>
                    </button>

                    <a
                      href={downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg transition inline-flex items-center space-x-1 font-semibold text-[11px] border border-slate-200/60 dark:border-slate-700"
                      title={t('downloadDocument')}
                    >
                      <Download className="w-3.5 h-3.5 text-slate-500" />
                      <span>{t('download')}</span>
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
        </>
      )}

      {/* Upload Document Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <FolderLock className="w-4 h-4 text-sky-500" />
                <span>{t('uploadDocument')}</span>
              </h3>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpload} className="space-y-4">
              {/* File Dropzone */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {lang === 'nl' ? 'Bestand (.pdf, .jpg, .png, .webp) *' : 'File (.pdf, .jpg, .png, .webp) *'}
                </label>
                <label
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-sky-500 bg-sky-50/90 dark:bg-sky-950/70 ring-4 ring-sky-500/20 scale-[1.01]'
                      : 'border-slate-300 dark:border-slate-700 hover:border-sky-500 bg-slate-50/50 dark:bg-slate-950/40'
                  }`}
                >
                  <UploadCloud className={`w-8 h-8 mb-1.5 transition ${isDragging ? 'text-sky-500 scale-110 animate-bounce' : 'text-slate-400'}`} />
                  <span className={`text-xs font-semibold ${isDragging ? 'text-sky-600 dark:text-sky-400 font-bold' : 'text-slate-700 dark:text-slate-300'}`}>
                    {isDragging
                      ? (lang === 'nl' ? 'Laat bestand hier los om te uploaden' : 'Drop file here to upload')
                      : (docFile ? docFile.name : t('dragOrClickDocument'))}
                  </span>
                  {docFile && !isDragging && (
                    <span className="text-[10px] text-slate-400 mt-0.5 font-mono">
                      {formatFileSize(docFile.size)}
                    </span>
                  )}
                  {compressing && (
                    <span className="text-[10px] text-amber-500 font-medium animate-pulse mt-1">
                      {lang === 'nl' ? 'Foto comprimeren & optimaliseren...' : 'Compressing & optimizing image...'}
                    </span>
                  )}
                  {compressionRatio && !compressing && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                      {lang === 'nl' ? `✓ Gecomprimeerd: ${compressionRatio}` : `✓ Compressed: ${compressionRatio}`}
                    </span>
                  )}
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.heic"
                    onChange={handleFileChange}
                    className="hidden"
                    required={!docFile}
                  />
                </label>
              </div>

              {/* Document Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('documentName')} *
                </label>
                <input
                  type="text"
                  required
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  placeholder={lang === 'nl' ? 'bijv. Kentekenbewijs, Verzekeringspolis, Keuringsrapport' : 'e.g. Registration Card, Insurance Policy, Inspection Report'}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              {/* Document Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('documentCategory')} *
                </label>
                <select
                  value={docCategory}
                  onChange={(e) => setDocCategory(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="registration">{t('docCatRegistration')}</option>
                  <option value="insurance">{t('docCatInsurance')}</option>
                  <option value="apk">{t('docCatApk')}</option>
                  <option value="invoice">{t('docCatInvoices')}</option>
                  <option value="manual">{t('docCatManual')}</option>
                  <option value="other">{t('docCatOther')}</option>
                </select>
              </div>

              {/* Document Date */}
              <div>
                <DatePicker
                  label={lang === 'nl' ? 'Document- / Factuurdatum' : 'Document / Invoice Date'}
                  value={docDate}
                  onChange={setDocDate}
                />
              </div>

              {/* Expiration Date (Optional) */}
              <div>
                <DatePicker
                  label={lang === 'nl' ? 'Vervaldatum (optioneel, voor bijv. polis of keuring)' : 'Expiration Date (optional, e.g. for policy or inspection)'}
                  value={docExpiresAt}
                  onChange={setDocExpiresAt}
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  {lang === 'nl'
                    ? 'Als je een datum instelt, stuurt VehicleVault automatisch een herinnering 30 dagen en 7 dagen van tevoren.'
                    : 'Setting an expiration date triggers automatic alerts 30 days and 7 days prior to expiry.'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'nl' ? 'Notities (optioneel)' : 'Notes (optional)'}
                </label>
                <textarea
                  rows={2}
                  value={docNotes}
                  onChange={(e) => setDocNotes(e.target.value)}
                  placeholder={lang === 'nl' ? 'Optionele toelichting of polisnummer...' : 'Optional notes or policy number...'}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition font-medium"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !docFile}
                  className="px-4 py-2 bg-accent-600 hover:bg-accent-700 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50"
                >
                  {isUploading ? t('saving') : t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* In-app Document Preview Modal */}
      {previewDoc && (
        <DocumentPreviewModal
          isOpen={previewDoc.isOpen}
          onClose={() => setPreviewDoc(null)}
          title={previewDoc.title}
          url={previewDoc.url}
          fileSize={previewDoc.fileSize}
          date={previewDoc.date}
          notes={previewDoc.notes}
        />
      )}
    </div>
  );
};
