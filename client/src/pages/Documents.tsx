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
} from 'lucide-react';
import { Vehicle, VehicleDocument } from '../types/index.js';
import { apiFetch } from '../api/client.js';
import { useLanguage } from '../context/LanguageContext.js';

interface ContextType {
  vehicles: Vehicle[];
  selectedVehicle: Vehicle | null;
}

type DocCategory = 'all' | 'registration' | 'insurance' | 'apk' | 'invoice' | 'manual' | 'other';

export const Documents: React.FC = () => {
  const { selectedVehicle } = useOutletContext<ContextType>();
  const { t } = useLanguage();

  const [documents, setDocuments] = useState<VehicleDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<DocCategory>('all');

  // Upload modal state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docName, setDocName] = useState('');
  const [docCategory, setDocCategory] = useState<'registration' | 'insurance' | 'apk' | 'invoice' | 'manual' | 'other'>('registration');
  const [docNotes, setDocNotes] = useState('');
  const [isUploading, setIsUploading] = useState(false);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setDocFile(file);
      if (!docName) {
        // Remove extension for default document title
        const cleanName = file.name.replace(/\.[^/.]+$/, '');
        setDocName(cleanName);
      }
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle || !docFile) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('document', docFile);
      formData.append('name', docName || docFile.name);
      formData.append('category', docCategory);
      if (docNotes) formData.append('notes', docNotes);

      await apiFetch(`/api/documents/${selectedVehicle.id}`, {
        method: 'POST',
        body: formData,
      });

      setIsUploadModalOpen(false);
      setDocFile(null);
      setDocName('');
      setDocNotes('');
      setDocCategory('registration');
      await loadDocuments(selectedVehicle.id);
    } catch {
      alert('Upload mislukt. Controleer bestandsformaat (PDF, JPG, PNG) en bestandsgrootte (max 30MB).');
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

  const filteredDocuments = documents.filter((doc) => {
    if (activeCategory === 'all') return true;
    return doc.category === activeCategory;
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
        <h3 className="text-base font-bold text-slate-800 dark:text-white">Geen voertuig geselecteerd</h3>
        <p className="text-xs text-slate-500 max-w-sm mt-1">Selecteer een voertuig in het menu hierboven om de digitale handschoenenkast te bekijken.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
          className="px-4 py-2 bg-slate-900 text-white hover:bg-black dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 transition shadow-sm hover:scale-[1.02] self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{t('uploadDocument')}</span>
        </button>
      </div>

      {/* Filter Tabs */}
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

      {/* Documents Grid */}
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
            className="px-4 py-2 bg-slate-900 text-white hover:bg-black dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>{t('uploadDocument')}</span>
          </button>
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
                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4.5 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 text-slate-600 dark:text-slate-300">
                        {isPdf ? (
                          <FileText className="w-5 h-5 text-rose-500" />
                        ) : isImage ? (
                          <FileCheck className="w-5 h-5 text-sky-500" />
                        ) : (
                          <File className="w-5 h-5 text-slate-500" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition" title={doc.name}>
                          {doc.name}
                        </h4>
                        <span className={`inline-block px-2 py-0.5 mt-0.5 rounded-full text-[10px] font-bold border ${badge.badgeClass}`}>
                          {badge.label}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition opacity-0 group-hover:opacity-100"
                      title={t('delete')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {doc.notes && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 mb-2 italic">
                      "{doc.notes}"
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                  <div className="space-x-2">
                    <span>{formatFileSize(doc.file_size)}</span>
                    <span>•</span>
                    <span>{new Date(doc.created_at).toLocaleDateString('nl-NL')}</span>
                  </div>

                  <a
                    href={downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg transition inline-flex items-center space-x-1 font-semibold text-[11px]"
                    title={t('downloadDocument')}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{t('download')}</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
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
                  Bestand (.pdf, .jpg, .png, .webp) *
                </label>
                <label className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-sky-500 rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition bg-slate-50/50 dark:bg-slate-950/40">
                  <UploadCloud className="w-7 h-7 text-slate-400 mb-1" />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {docFile ? docFile.name : t('dragOrClickDocument')}
                  </span>
                  {docFile && (
                    <span className="text-[10px] text-slate-400 mt-0.5">
                      {formatFileSize(docFile.size)}
                    </span>
                  )}
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.heic"
                    onChange={handleFileChange}
                    className="hidden"
                    required
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
                  placeholder="bijv. Kentekenbewijs Deel 1, Polis Univé 2026, APK Rapport"
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

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('notes')} ({t('vehicleNotes')})
                </label>
                <textarea
                  rows={2}
                  value={docNotes}
                  onChange={(e) => setDocNotes(e.target.value)}
                  placeholder="Optionele toelichting of polisnummer..."
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
                  className="px-4 py-1.5 bg-slate-900 hover:bg-black dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50"
                >
                  {isUploading ? t('saving') : t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
