import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Wrench,
  Plus,
  FileText,
  Trash2,
  Edit2,
  Paperclip,
  ShieldCheck,
  X,
  Sparkles,
  Package,
  CircleDollarSign,
  UploadCloud,
  MapPin,
  Languages,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Building2,
} from 'lucide-react';
import {
  Vehicle,
  MaintenanceInterval,
  ServiceRecord,
  ServiceCategory,
  InvoiceLineItem,
  AiInvoiceExtraction,
} from '../types/index.js';
import { apiFetch } from '../api/client.js';
import { IntervalProgressBar } from '../components/IntervalProgressBar.js';
import { DatePicker } from '../components/DatePicker.js';
import { useLanguage } from '../context/LanguageContext.js';
import { formatDisplayDate } from '../utils/format.js';
import { compressImage } from '../utils/imageCompressor.js';
import { DocumentPreviewModal } from '../components/DocumentPreviewModal.js';

interface ContextType {
  vehicles: Vehicle[];
  selectedVehicle: Vehicle | null;
}

export const Maintenance: React.FC = () => {
  const { selectedVehicle } = useOutletContext<ContextType>();
  const { t, translateCategory, lang } = useLanguage();
  const [intervals, setIntervals] = useState<MaintenanceInterval[]>([]);
  const [records, setRecords] = useState<ServiceRecord[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);

  // Modals
  const [isLogServiceOpen, setIsLogServiceOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ServiceRecord | null>(null);
  const [isAddIntervalOpen, setIsAddIntervalOpen] = useState(false);
  const [isEditIntervalOpen, setIsEditIntervalOpen] = useState(false);

  // Expanded line items in table
  const [expandedRecordIds, setExpandedRecordIds] = useState<Record<string, boolean>>({});

  // Log Service Form State
  const [serviceItem, setServiceItem] = useState('');
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [serviceOdometer, setServiceOdometer] = useState<string>('');
  const [serviceCost, setServiceCost] = useState<string>('0');
  const [partsCost, setPartsCost] = useState<string>('0');
  const [laborCost, setLaborCost] = useState<string>('0');
  const [performingParty, setPerformingParty] = useState<'self' | 'garage'>('self');
  const [garageName, setGarageName] = useState('');
  const [garageAddress, setGarageAddress] = useState('');
  const [extractedLineItems, setExtractedLineItems] = useState<InvoiceLineItem[]>([]);
  const [serviceNotes, setServiceNotes] = useState('');
  const [matchedIntervalId, setMatchedIntervalId] = useState<string>('');
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [uploadedInvoiceFileName, setUploadedInvoiceFileName] = useState<string | null>(null);
  const [submittingService, setSubmittingService] = useState(false);

  // AI Invoice Scanner State
  const [scanningInvoice, setScanningInvoice] = useState(false);
  const [isDraggingInvoice, setIsDraggingInvoice] = useState(false);
  const [scanExtraction, setScanExtraction] = useState<AiInvoiceExtraction | null>(null);
  const [scanWarning, setScanWarning] = useState<string | null>(null);

  // In-app Document / Invoice Preview State
  const [previewDoc, setPreviewDoc] = useState<{
    isOpen: boolean;
    title: string;
    url: string;
    date?: string;
    notes?: string;
  } | null>(null);
  const [attachingInvoiceRecordId, setAttachingInvoiceRecordId] = useState<string | null>(null);

  // Add Interval Form State
  const [intervalCategoryId, setIntervalCategoryId] = useState('');
  const [customName, setCustomName] = useState('');
  const [intervalKm, setIntervalKm] = useState<string>('15000');
  const [intervalMonths, setIntervalMonths] = useState<string>('12');
  const [lastServiceDate, setLastServiceDate] = useState('');
  const [lastServiceOdo, setLastServiceOdo] = useState<string>('0');

  // Edit Interval Form State
  const [editingInterval, setEditingInterval] = useState<MaintenanceInterval | null>(null);
  const [editCustomName, setEditCustomName] = useState('');
  const [editIntervalKm, setEditIntervalKm] = useState('');
  const [editIntervalMonths, setEditIntervalMonths] = useState('');
  const [editLastDate, setEditLastDate] = useState('');
  const [editLastOdo, setEditLastOdo] = useState('');

  const handlePartsCostChange = (val: string) => {
    setPartsCost(val);
    const p = parseFloat(val) || 0;
    const l = parseFloat(laborCost) || 0;
    setServiceCost((p + l).toFixed(2));
  };

  const handleLaborCostChange = (val: string) => {
    setLaborCost(val);
    const p = parseFloat(partsCost) || 0;
    const l = parseFloat(val) || 0;
    setServiceCost((p + l).toFixed(2));
  };

  const handlePartyChange = (party: 'self' | 'garage') => {
    setPerformingParty(party);
    if (party === 'self') {
      setLaborCost('0');
      const p = parseFloat(partsCost) || 0;
      setServiceCost(p.toFixed(2));
    }
  };

  useEffect(() => {
    if (selectedVehicle) {
      loadData(selectedVehicle.id);
      const curr = selectedVehicle.current_odometer || selectedVehicle.initial_odometer || 0;
      setServiceOdometer(curr > 0 ? String(curr) : '');
      setLastServiceOdo(curr > 0 ? String(curr) : '0');
    }
  }, [selectedVehicle?.id]);

  const loadData = async (vehicleId: string) => {
    try {
      const [intRes, recRes, catRes] = await Promise.all([
        apiFetch<{ intervals: MaintenanceInterval[] }>(`/api/maintenance/intervals/${vehicleId}`),
        apiFetch<{ records: ServiceRecord[] }>(`/api/maintenance/records/${vehicleId}`),
        apiFetch<{ categories: ServiceCategory[] }>('/api/maintenance/categories'),
      ]);
      setIntervals(intRes.intervals);
      setRecords(recRes.records);
      setCategories(catRes.categories);
      if (catRes.categories.length > 0 && !intervalCategoryId) {
        setIntervalCategoryId(catRes.categories[0].id);
      }
    } catch {
      // ignore
    }
  };

  const openNewServiceModal = () => {
    setEditingRecord(null);
    setServiceItem('');
    setServiceDate(new Date().toISOString().split('T')[0]);
    const curr = selectedVehicle?.current_odometer || selectedVehicle?.initial_odometer || 0;
    setServiceOdometer(curr > 0 ? String(curr) : '');
    setServiceCost('0');
    setPartsCost('0');
    setLaborCost('0');
    setPerformingParty('garage');
    setGarageName('');
    setGarageAddress('');
    setExtractedLineItems([]);
    setServiceNotes('');
    setMatchedIntervalId('');
    setInvoiceFile(null);
    setUploadedInvoiceFileName(null);
    setScanExtraction(null);
    setScanWarning(null);
    setIsLogServiceOpen(true);
  };

  const openEditRecordModal = (rec: ServiceRecord) => {
    setEditingRecord(rec);
    setServiceItem(rec.service_item);
    setServiceDate(rec.date);
    setServiceOdometer(String(rec.odometer || 0));
    setServiceCost((rec.cost || 0).toFixed(2));
    setPartsCost(String(rec.parts_cost ?? (rec.performing_party === 'self' ? rec.cost : 0)));
    setLaborCost(String(rec.labor_cost ?? 0));
    setPerformingParty(rec.performing_party || 'garage');
    setGarageName(rec.garage_name || '');
    setGarageAddress(rec.garage_address || '');
    let parsedItems: InvoiceLineItem[] = [];
    if (rec.line_items) {
      try {
        parsedItems = JSON.parse(rec.line_items);
      } catch {}
    }
    setExtractedLineItems(Array.isArray(parsedItems) ? parsedItems : []);
    setServiceNotes(rec.notes || '');
    setMatchedIntervalId(rec.maintenance_interval_id || '');
    setInvoiceFile(null);
    setUploadedInvoiceFileName(rec.invoice_path || null);
    setScanExtraction(null);
    setScanWarning(null);
    setIsLogServiceOpen(true);
  };

  const handleScanInvoiceFile = async (file: File) => {
    setInvoiceFile(file);
    setScanningInvoice(true);
    setScanWarning(null);
    setScanExtraction(null);

    try {
      const processedFile = file.type.startsWith('image/') ? await compressImage(file, 1800, 2400, 0.85) : file;
      const formData = new FormData();
      formData.append('invoice', processedFile);
      formData.append('lang', lang);

      const res = await apiFetch<{
        fileName: string;
        aiConfigured: boolean;
        extraction: AiInvoiceExtraction | null;
        warning?: string;
      }>(`/api/maintenance/scan-invoice?lang=${lang}`, {
        method: 'POST',
        body: formData,
      });

      setUploadedInvoiceFileName(res.fileName);

      if (res.warning) {
        setScanWarning(res.warning);
      }

      if (res.extraction) {
        const ext = res.extraction;
        setScanExtraction(ext);
        setPerformingParty('garage');

        if (ext.serviceTitle) {
          setServiceItem(ext.serviceTitle);
        }
        if (ext.date) {
          setServiceDate(ext.date);
        }
        if (ext.odometer && ext.odometer > 0) {
          setServiceOdometer(String(ext.odometer));
        }
        if (ext.garageName) {
          setGarageName(ext.garageName);
        }
        if (ext.garageAddress) {
          setGarageAddress(ext.garageAddress);
        }
        if (ext.partsCost !== null) {
          setPartsCost(ext.partsCost.toFixed(2));
        }
        if (ext.laborCost !== null) {
          setLaborCost(ext.laborCost.toFixed(2));
        }
        if (ext.totalCost !== null) {
          setServiceCost(ext.totalCost.toFixed(2));
        } else if (ext.partsCost !== null || ext.laborCost !== null) {
          setServiceCost(((ext.partsCost || 0) + (ext.laborCost || 0)).toFixed(2));
        }
        if (Array.isArray(ext.lineItems) && ext.lineItems.length > 0) {
          setExtractedLineItems(ext.lineItems);
        }
        if (ext.translatedNotes) {
          setServiceNotes(ext.translatedNotes);
        }
      }
    } catch (err: any) {
      setScanWarning(err?.message || (lang === 'nl' ? 'Fout bij het scannen van de factuur.' : 'Error scanning invoice.'));
    } finally {
      setScanningInvoice(false);
    }
  };

  const handleInvoiceDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingInvoice) setIsDraggingInvoice(true);
  };

  const handleInvoiceDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDraggingInvoice(false);
  };

  const handleInvoiceDrop = async (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingInvoice(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await handleScanInvoiceFile(file);
    }
  };

  const handleLogService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle) return;

    setSubmittingService(true);
    try {
      let finalInvoicePath = uploadedInvoiceFileName;
      if (!finalInvoicePath && invoiceFile) {
        const compressedInvoice = invoiceFile.type.startsWith('image/')
          ? await compressImage(invoiceFile)
          : invoiceFile;
        const formData = new FormData();
        formData.append('invoice', compressedInvoice);
        const uploadRes = await apiFetch<{ fileName: string }>('/api/maintenance/upload-invoice', {
          method: 'POST',
          body: formData,
        });
        finalInvoicePath = uploadRes.fileName;
      }

      const payload = {
        vehicle_id: selectedVehicle.id,
        service_item: serviceItem,
        date: serviceDate,
        odometer: parseFloat(serviceOdometer) || 0,
        cost: parseFloat(serviceCost) || 0,
        parts_cost: parseFloat(partsCost) || 0,
        labor_cost: parseFloat(laborCost) || 0,
        performing_party: performingParty,
        garage_name: performingParty === 'garage' && garageName.trim() ? garageName.trim() : null,
        garage_address: performingParty === 'garage' && garageAddress.trim() ? garageAddress.trim() : null,
        line_items: extractedLineItems.length > 0 ? JSON.stringify(extractedLineItems) : null,
        notes: serviceNotes || null,
        invoice_path: finalInvoicePath || null,
        maintenance_interval_id: matchedIntervalId || undefined,
      };

      if (editingRecord) {
        await apiFetch(`/api/maintenance/records/${editingRecord.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/maintenance/records', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      setIsLogServiceOpen(false);
      setEditingRecord(null);
      loadData(selectedVehicle.id);
    } catch (err: any) {
      alert(err?.message || 'Failed to save maintenance record');
    } finally {
      setSubmittingService(false);
    }
  };

  const handleQuickAttachInvoice = async (recordId: string, file?: File | null) => {
    if (!file || !selectedVehicle) return;
    try {
      setAttachingInvoiceRecordId(recordId);
      const compressed = file.type.startsWith('image/') ? await compressImage(file) : file;
      const formData = new FormData();
      formData.append('invoice', compressed);
      await apiFetch(`/api/maintenance/records/${recordId}/invoice`, {
        method: 'POST',
        body: formData,
      });
      await loadData(selectedVehicle.id);
    } catch (err: any) {
      alert(err?.message || (lang === 'nl' ? 'Koppelen van factuur mislukt' : 'Failed to attach invoice'));
    } finally {
      setAttachingInvoiceRecordId(null);
    }
  };

  const handleCreateInterval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle) return;

    try {
      await apiFetch('/api/maintenance/intervals', {
        method: 'POST',
        body: JSON.stringify({
          vehicle_id: selectedVehicle.id,
          category_id: intervalCategoryId,
          custom_name: customName || null,
          interval_km: intervalKm ? parseFloat(intervalKm) : null,
          interval_months: intervalMonths ? parseInt(intervalMonths, 10) : null,
          last_service_date: lastServiceDate || null,
          last_service_odometer: lastServiceOdo ? parseFloat(lastServiceOdo) : null,
        }),
      });

      setIsAddIntervalOpen(false);
      setCustomName('');
      loadData(selectedVehicle.id);
    } catch (err: any) {
      alert(err?.message || 'Failed to create interval');
    }
  };

  const openEditModal = (interval: MaintenanceInterval) => {
    setEditingInterval(interval);
    setEditCustomName(interval.customName || '');
    setEditIntervalKm(interval.intervalKm ? String(interval.intervalKm) : '');
    setEditIntervalMonths(interval.intervalMonths ? String(interval.intervalMonths) : '');
    setEditLastDate(interval.lastServiceDate || '');
    setEditLastOdo(interval.lastServiceOdometer ? String(interval.lastServiceOdometer) : '0');
    setIsEditIntervalOpen(true);
  };

  const handleSaveEditInterval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInterval || !selectedVehicle) return;

    try {
      await apiFetch(`/api/maintenance/intervals/${editingInterval.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          custom_name: editCustomName || null,
          interval_km: editIntervalKm ? parseFloat(editIntervalKm) : null,
          interval_months: editIntervalMonths ? parseInt(editIntervalMonths, 10) : null,
          last_service_date: editLastDate || null,
          last_service_odometer: editLastOdo ? parseFloat(editLastOdo) : null,
        }),
      });

      setIsEditIntervalOpen(false);
      setEditingInterval(null);
      loadData(selectedVehicle.id);
    } catch (err: any) {
      alert(err?.message || 'Failed to update interval');
    }
  };

  const handleDeleteRecord = async (id: string) => {
    if (confirm(t('confirmDeleteRecord'))) {
      try {
        await apiFetch(`/api/maintenance/records/${id}`, { method: 'DELETE' });
        if (selectedVehicle) loadData(selectedVehicle.id);
      } catch (err: any) {
        alert(err?.message || 'Delete failed');
      }
    }
  };

  const handleDeleteInterval = async (id: string) => {
    if (confirm(t('confirmDeleteInterval'))) {
      try {
        await apiFetch(`/api/maintenance/intervals/${id}`, { method: 'DELETE' });
        if (selectedVehicle) loadData(selectedVehicle.id);
      } catch (err: any) {
        alert(err?.message || 'Delete failed');
      }
    }
  };

  const toggleExpandRecord = (id: string) => {
    setExpandedRecordIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (!selectedVehicle) {
    return <div className="text-slate-400 text-xs py-8">{t('welcomeSubtitle')}</div>;
  }

  const totalSpend = records.reduce((sum, r) => sum + (r.cost || 0), 0);
  const totalParts = records.reduce((sum, r) => sum + (r.parts_cost ?? (r.performing_party === 'self' ? r.cost : 0)), 0);
  const totalLabor = records.reduce((sum, r) => sum + (r.labor_cost ?? 0), 0);
  const diyRecords = records.filter((r) => r.performing_party === 'self');
  const totalDiySavings = diyRecords.reduce((sum, r) => {
    const parts = r.parts_cost ?? r.cost ?? 0;
    const saved = Math.max(65, parts > 0 ? parts * 0.85 : 75);
    return sum + saved;
  }, 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center space-x-2">
            <Wrench className="w-5 h-5 text-sky-500" />
            <span>{t('maintenanceTitle')}</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t('maintenanceSubtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsAddIntervalOpen(true)}
            className="px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold inline-flex items-center space-x-1.5 transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>{t('addPart')}</span>
          </button>
          <button
            onClick={openNewServiceModal}
            className="px-4 py-2 bg-accent-600 hover:bg-accent-700 text-white rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 transition shadow-sm hover:scale-[1.02]"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-200" />
            <span>{lang === 'nl' ? 'Onderhoud / Factuur Scannen' : 'Log Service / Scan Invoice'}</span>
          </button>
        </div>
      </div>

      {/* Maintenance KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>{t('totalFleetSpend')}</span>
            <CircleDollarSign className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white font-mono">
            € {totalSpend.toFixed(2)}
          </div>
          <span className="text-[10px] text-slate-400">{records.length} records</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>{t('partsCostShort')}</span>
            <Package className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white font-mono">
            € {totalParts.toFixed(2)}
          </div>
          <span className="text-[10px] text-slate-400">{lang === 'nl' ? 'Onderdelen & filters' : 'Parts & consumables'}</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>{t('laborCostShort')}</span>
            <Wrench className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white font-mono">
            € {totalLabor.toFixed(2)}
          </div>
          <span className="text-[10px] text-slate-400">{lang === 'nl' ? 'Garage & werkplaatstarieven' : 'Garage & workshop labor'}</span>
        </div>

        <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/50 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 text-xs mb-1 font-semibold">
            <span>{t('totalDiySaved')}</span>
            <Sparkles className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400 font-mono">
            ~ € {totalDiySavings.toFixed(0)}
          </div>
          <span className="text-[10px] text-emerald-600/80 dark:text-emerald-500/80">
            {diyRecords.length} {lang === 'nl' ? 'beurten zelf gesleuteld' : (diyRecords.length === 1 ? 'service self-performed' : 'services self-performed')}
          </span>
        </div>
      </div>

      {/* Intervals Grid */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm transition-colors">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>{t('monitoredParts')} ({intervals.length})</span>
            </h2>
            <p className="text-[11px] text-slate-500">{t('colorLegend')}</p>
          </div>
        </div>

        {intervals.length === 0 ? (
          <div className="text-xs text-slate-400 text-center py-10">
            {t('noIntervalsConfigured')}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {intervals.map((interval) => (
              <div
                key={interval.id}
                className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 p-4 rounded-xl flex flex-col justify-between shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition"
              >
                <IntervalProgressBar interval={interval} />
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-3 mt-3 border-t border-slate-200/80 dark:border-slate-800/80 font-medium">
                  <span>
                    {t('everyKm')} {interval.intervalKm?.toLocaleString() || '—'} km /{' '}
                    {interval.intervalMonths ? `${interval.intervalMonths} ${t('months')}` : '—'}
                  </span>
                  
                  {/* Pencil Edit & Trash Delete Buttons */}
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => openEditModal(interval)}
                      className="text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition"
                      title={t('editPart')}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteInterval(interval.id)}
                      className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition"
                      title={t('delete')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Service History Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm transition-colors">
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4 text-slate-500" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">
              {t('servicePassport')} ({records.length})
            </h3>
          </div>
        </div>

        {records.length === 0 ? (
          <div className="text-xs text-slate-400 text-center py-10">
            {t('noMaintenanceHistory')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 font-semibold border-b border-slate-200/80 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-4">{t('date')}</th>
                  <th className="py-2.5 px-4">{t('odometer')}</th>
                  <th className="py-2.5 px-4">{t('partName')}</th>
                  <th className="py-2.5 px-4">{t('performingParty')}</th>
                  <th className="py-2.5 px-4">{t('cost')}</th>
                  <th className="py-2.5 px-4">{t('invoiceAttachment')}</th>
                  <th className="py-2.5 px-4 text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {records.map((r) => {
                  let lineItems: InvoiceLineItem[] = [];
                  if (r.line_items) {
                    try {
                      lineItems = JSON.parse(r.line_items);
                    } catch {}
                  }
                  const isExpanded = Boolean(expandedRecordIds[r.id]);

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition align-top">
                      <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-white whitespace-nowrap">
                        {formatDisplayDate(r.date)}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {r.odometer.toLocaleString()} km
                      </td>
                      <td className="py-3.5 px-4 text-slate-800 dark:text-slate-200 max-w-md">
                        <div className="font-bold text-slate-900 dark:text-white">{r.service_item}</div>

                        {lineItems.length > 0 && (
                          <div className="mt-1.5">
                            <button
                              type="button"
                              onClick={() => toggleExpandRecord(r.id)}
                              className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200/70 dark:border-sky-800/50 text-[10px] font-bold hover:bg-sky-100 transition"
                            >
                              <Languages className="w-3 h-3 text-sky-500" />
                              <span>
                                {lang === 'nl'
                                  ? `${lineItems.length} uitgelezen & vertaalde onderdelen`
                                  : `${lineItems.length} extracted & translated items`}
                              </span>
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>

                            {isExpanded && (
                              <div className="mt-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                                {lineItems.map((item, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-start justify-between gap-2 text-[11px] pb-1.5 last:pb-0 border-b last:border-b-0 border-slate-200/50 dark:border-slate-800/60"
                                  >
                                    <div>
                                      <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                        <span
                                          className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                                            item.category === 'labor'
                                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                              : 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300'
                                          }`}
                                        >
                                          {item.category === 'labor'
                                            ? (lang === 'nl' ? 'Arbeid' : 'Labor')
                                            : (lang === 'nl' ? 'Onderdeel' : 'Part')}
                                        </span>
                                        <span>{item.translatedDescription}</span>
                                        {item.quantity && (
                                          <span className="text-[10px] text-slate-400 font-mono">({item.quantity})</span>
                                        )}
                                      </div>
                                      {item.originalDescription &&
                                        item.originalDescription.toLowerCase() !== item.translatedDescription.toLowerCase() && (
                                          <div className="text-[10px] text-slate-400 italic mt-0.5">
                                            Origineel: "{item.originalDescription}"
                                          </div>
                                        )}
                                    </div>
                                    {item.totalPrice !== null && (
                                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                        € {item.totalPrice.toFixed(2)}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {r.notes && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 whitespace-pre-line line-clamp-3">
                            {r.notes}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                              r.performing_party === 'self'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            {r.performing_party === 'garage' ? (
                              <>
                                <Building2 className="w-3 h-3 text-slate-500 shrink-0" />
                                <span>{r.garage_name || t('garage')}</span>
                              </>
                            ) : (
                              t('self')
                            )}
                          </span>

                          {r.performing_party === 'garage' && r.garage_address && (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                `${r.garage_name ? r.garage_name + ', ' : ''}${r.garage_address}`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-start gap-1 text-[10px] text-slate-500 hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-400 transition max-w-[220px]"
                              title={lang === 'nl' ? 'Open garage-adres in Google Maps' : 'Open garage address in Google Maps'}
                            >
                              <MapPin className="w-3 h-3 text-rose-500 shrink-0 mt-0.5" />
                              <span className="underline decoration-dotted">{r.garage_address}</span>
                            </a>
                          )}

                          {r.performing_party === 'self' && (
                            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center space-x-1">
                              <Sparkles className="w-2.5 h-2.5" />
                              <span>{t('diySavings')}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                        <div className="font-bold text-slate-900 dark:text-white">€ {r.cost.toFixed(2)}</div>
                        {(r.parts_cost !== undefined || r.labor_cost !== undefined) && (
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-sans mt-0.5">
                            <span>{t('partsCostShort')}: €{(r.parts_cost ?? (r.performing_party === 'self' ? r.cost : 0)).toFixed(0)}</span>
                            <span className="mx-1">•</span>
                            <span>{t('laborCostShort')}: €{(r.labor_cost || 0).toFixed(0)}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {r.invoice_path ? (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewDoc({
                                isOpen: true,
                                title: `${r.service_item} — ${r.garage_name || (lang === 'nl' ? 'Factuur' : 'Invoice')}`,
                                url: `/uploads/invoices/${r.invoice_path}`,
                                date: formatDisplayDate(r.date),
                                notes: r.notes || undefined,
                              })
                            }
                            className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/50 hover:bg-sky-100 dark:hover:bg-sky-900/50 font-bold text-xs transition shadow-2xs group"
                            title={lang === 'nl' ? 'Bekijk factuur direct in-app' : 'View invoice in-app'}
                          >
                            <FileText className="w-3.5 h-3.5 text-rose-500 group-hover:scale-110 transition-transform" />
                            <span>{lang === 'nl' ? 'Factuur bekijken' : 'View invoice'}</span>
                          </button>
                        ) : (
                          <label
                            className={`inline-flex items-center space-x-1 text-[11px] text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 font-semibold cursor-pointer transition ${
                              attachingInvoiceRecordId === r.id ? 'opacity-50 pointer-events-none' : ''
                            }`}
                            title={lang === 'nl' ? 'Koppel een PDF factuur of bon aan deze beurt' : 'Attach an invoice or receipt to this service record'}
                          >
                            <Paperclip className="w-3 h-3" />
                            <span>
                              {attachingInvoiceRecordId === r.id
                                ? (lang === 'nl' ? 'Uploaden...' : 'Uploading...')
                                : (lang === 'nl' ? '+ Factuur koppelen' : '+ Attach invoice')}
                            </span>
                            <input
                              type="file"
                              accept=".pdf,image/*"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleQuickAttachInvoice(r.id, f);
                              }}
                            />
                          </label>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center space-x-1">
                          <button
                            onClick={() => openEditRecordModal(r)}
                            className="text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 p-1 rounded transition"
                            title={lang === 'nl' ? 'Bewerken' : 'Edit'}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteRecord(r.id)}
                            className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 rounded transition"
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

      {/* Log / Edit Service & AI Invoice Scanner Modal */}
      {isLogServiceOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[92vh] overflow-y-auto animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Wrench className="w-4 h-4 text-sky-500" />
                <span>
                  {editingRecord
                    ? (lang === 'nl' ? 'Onderhoudsbeurt Bewerken' : 'Edit Service Record')
                    : t('logService')}
                </span>
              </h3>
              <button
                onClick={() => setIsLogServiceOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleLogService} className="space-y-4 text-xs">
              {/* Smart AI Invoice Scanner & Translator Dropzone */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-sky-500/10 via-indigo-500/5 to-purple-500/10 border border-sky-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-600 dark:text-sky-400">
                      <Languages className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                        <span>
                          {lang === 'nl'
                            ? 'Slimme Factuur Scanner & AI Vertaler'
                            : 'Smart Invoice Scanner & AI Translator'}
                        </span>
                        <span className="px-2 py-0.2 rounded-full text-[10px] font-extrabold bg-sky-500 text-white">
                          AI
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {lang === 'nl'
                          ? 'Upload een (Duitse/buitenlandse) factuur. AI leest onderdelen, prijzen & garage-adres uit en vertaalt alles naar het Nederlands.'
                          : 'Upload any foreign or local garage invoice. AI extracts parts, prices & garage address and translates everything automatically.'}
                      </p>
                    </div>
                  </div>
                </div>

                <label
                  onDragOver={handleInvoiceDragOver}
                  onDragEnter={handleInvoiceDragOver}
                  onDragLeave={handleInvoiceDragLeave}
                  onDrop={handleInvoiceDrop}
                  className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                    isDraggingInvoice
                      ? 'border-sky-500 bg-sky-50/90 dark:bg-sky-950/70 ring-4 ring-sky-500/20 scale-[1.01]'
                      : 'border-sky-300/70 dark:border-sky-700/60 hover:border-sky-500 bg-white/70 dark:bg-slate-950/50'
                  }`}
                >
                  {scanningInvoice ? (
                    <div className="py-2 flex flex-col items-center space-y-2">
                      <Sparkles className="w-7 h-7 text-sky-500 animate-spin" />
                      <span className="font-bold text-sky-600 dark:text-sky-400 animate-pulse">
                        {lang === 'nl'
                          ? 'Factuur lezen, onderdelen herkennen & vertalen met AI...'
                          : 'Reading invoice, extracting parts & translating with AI...'}
                      </span>
                    </div>
                  ) : (
                    <>
                      <UploadCloud
                        className={`w-7 h-7 mb-1 transition ${
                          isDraggingInvoice ? 'text-sky-500 scale-110 animate-bounce' : 'text-sky-500/80'
                        }`}
                      />
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {isDraggingInvoice
                          ? (lang === 'nl' ? 'Laat factuur los om direct te scannen & vertalen' : 'Drop invoice to scan & translate')
                          : invoiceFile
                            ? invoiceFile.name
                            : uploadedInvoiceFileName
                              ? (lang === 'nl' ? `Gekoppeld bestand: ${uploadedInvoiceFileName} (klik of sleep om te vervangen)` : `Attached: ${uploadedInvoiceFileName}`)
                              : (lang === 'nl' ? 'Sleep je garagefactuur (PDF of foto) hierheen of klik om te kiezen' : 'Drag your garage invoice (PDF or photo) here or click to browse')}
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5">
                        {lang === 'nl'
                          ? 'Ondersteunt PDF, JPG, PNG & WebP • Wordt ook direct opgeslagen onder Documenten'
                          : 'Supports PDF, JPG, PNG & WebP • Automatically saved to Documents as well'}
                      </span>
                    </>
                  )}
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.heic"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleScanInvoiceFile(f);
                    }}
                  />
                </label>

                {scanExtraction && (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between text-emerald-800 dark:text-emerald-300">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <div>
                        <span className="font-bold">
                          {lang === 'nl'
                            ? `Factuur succesvol uitgelezen${scanExtraction.detectedLanguage ? ` & vertaald uit ${scanExtraction.detectedLanguage}` : ''}!`
                            : `Invoice extracted${scanExtraction.detectedLanguage ? ` & translated from ${scanExtraction.detectedLanguage}` : ''}!`}
                        </span>
                        <span className="block text-[10px] text-emerald-600 dark:text-emerald-400">
                          {lang === 'nl'
                            ? 'Alle velden, prijzen en het garage-adres zijn hieronder voor je ingevuld.'
                            : 'All fields, prices, and garage address have been pre-filled below.'}
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-[10px] font-mono font-bold">
                      {scanExtraction.model}
                    </span>
                  </div>
                )}

                {scanWarning && (
                  <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-[11px]">
                    {scanWarning}
                  </div>
                )}

                {uploadedInvoiceFileName && (
                  <div className="flex items-center space-x-1.5 text-[11px] text-sky-700 dark:text-sky-300 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                    <span>
                      {lang === 'nl'
                        ? 'De factuur wordt bij opslaan gekoppeld aan deze beurt én automatisch toegevoegd aan het onderdeel Documenten.'
                        : 'Upon saving, this invoice will be linked to this service record and automatically added to Documents.'}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  {t('partName')} *
                </label>
                <input
                  type="text"
                  required
                  value={serviceItem}
                  onChange={(e) => setServiceItem(e.target.value)}
                  placeholder={lang === 'nl' ? 'bijv. Grote Onderhoudsbeurt & Oliefilter' : 'e.g. Major Service & Oil Filter'}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-sky-500 shadow-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <DatePicker
                    label={t('date')}
                    value={serviceDate}
                    onChange={setServiceDate}
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
                    value={serviceOdometer}
                    onChange={(e) => setServiceOdometer(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-1.5 text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:border-sky-500 shadow-sm"
                  />
                </div>
              </div>

              {/* Performing Party */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  {t('performingParty')} *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handlePartyChange('self')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-1.5 transition ${
                      performingParty === 'self'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-800 dark:text-emerald-300 shadow-sm'
                        : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{t('self')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePartyChange('garage')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-1.5 transition ${
                      performingParty === 'garage'
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 shadow-sm'
                        : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>{t('garage')}</span>
                  </button>
                </div>
              </div>

              {/* Garage Name & Address (when performingParty === 'garage') */}
              {performingParty === 'garage' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-sky-500" />
                      <span>{lang === 'nl' ? 'Naam Garage / Dealer' : 'Garage / Dealer Name'}</span>
                    </label>
                    <input
                      type="text"
                      value={garageName}
                      onChange={(e) => setGarageName(e.target.value)}
                      placeholder={lang === 'nl' ? 'Naam van de garage of dealer' : 'Name of garage or dealer'}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-rose-500" />
                      <span>{lang === 'nl' ? 'Adres van de Garage' : 'Garage Address'}</span>
                    </label>
                    <input
                      type="text"
                      value={garageAddress}
                      onChange={(e) => setGarageAddress(e.target.value)}
                      placeholder={lang === 'nl' ? 'Straat, huisnummer en woonplaats' : 'Street, number and city'}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>
              )}

              {/* Cost Split Section */}
              {performingParty === 'self' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                      {t('partsCost')} *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={partsCost}
                      onChange={(e) => handlePartsCostChange(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-1.5 font-bold font-mono text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 shadow-sm"
                    />
                  </div>
                  <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div>
                      <div className="font-bold">{t('diySavedBadge')}</div>
                      <div className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                        {t('diySavingsTooltip')}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                        {t('partsCost')}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={partsCost}
                        onChange={(e) => handlePartsCostChange(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-1.5 font-bold font-mono text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 shadow-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                        {t('laborCost')}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={laborCost}
                        onChange={(e) => handleLaborCostChange(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-1.5 font-bold font-mono text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 shadow-sm"
                      />
                    </div>
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-600 dark:text-slate-400">{t('totalCalculatedCost')}:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">€ {serviceCost}</span>
                  </div>
                </div>
              )}

              {/* Extracted & Translated Line Items Preview */}
              {extractedLineItems.length > 0 && (
                <div className="p-3.5 rounded-xl bg-sky-50/50 dark:bg-sky-950/20 border border-sky-200/80 dark:border-sky-800/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Languages className="w-4 h-4 text-sky-500" />
                      <span>
                        {lang === 'nl'
                          ? `Uitgelezen & Vertaalde Factuurregels (${extractedLineItems.length})`
                          : `Extracted & Translated Invoice Items (${extractedLineItems.length})`}
                      </span>
                    </span>
                  </div>
                  <div className="divide-y divide-slate-200/60 dark:divide-slate-800 max-h-48 overflow-y-auto pr-1">
                    {extractedLineItems.map((item, index) => (
                      <div key={index} className="py-2 flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                                item.category === 'labor'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                  : 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300'
                              }`}
                            >
                              {item.category === 'labor'
                                ? (lang === 'nl' ? 'Arbeid' : 'Labor')
                                : (lang === 'nl' ? 'Onderdeel' : 'Part')}
                            </span>
                            <span>{item.translatedDescription}</span>
                            {item.quantity && (
                              <span className="text-[10px] text-slate-400 font-mono">({item.quantity})</span>
                            )}
                          </div>
                          {item.originalDescription &&
                            item.originalDescription.toLowerCase() !== item.translatedDescription.toLowerCase() && (
                              <div className="text-[10px] text-slate-400 italic">
                                Origineel: {item.originalDescription}
                              </div>
                            )}
                        </div>
                        <div className="flex items-center space-x-2 shrink-0">
                          {item.totalPrice !== null && (
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                              € {item.totalPrice.toFixed(2)}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setExtractedLineItems((prev) => prev.filter((_, i) => i !== index))
                            }
                            className="text-slate-400 hover:text-rose-500 p-0.5"
                            title={t('delete')}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  {lang === 'nl' ? 'Koppel aan onderhoudsinterval (optioneel resetten)' : 'Link to maintenance interval (optional reset)'}
                </label>
                <select
                  value={matchedIntervalId}
                  onChange={(e) => setMatchedIntervalId(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white font-medium focus:outline-none focus:border-sky-500 shadow-sm"
                >
                  <option value="">{lang === 'nl' ? 'Geen (losse reparatie / geen interval resetten)' : 'None (standalone service / no interval reset)'}</option>
                  {intervals.map((i) => (
                    <option key={i.id} value={i.id}>
                      {translateCategory(i.customName || i.categoryName)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  {t('notes')}
                </label>
                <textarea
                  rows={3}
                  value={serviceNotes}
                  onChange={(e) => setServiceNotes(e.target.value)}
                  placeholder={lang === 'nl' ? 'Optionele toelichting over de uitgevoerde werkzaamheden...' : 'Optional notes about the performed work...'}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 shadow-sm"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsLogServiceOpen(false)}
                  className="px-4 py-2 text-slate-500 hover:text-slate-800 dark:hover:text-white font-medium"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submittingService || scanningInvoice}
                  className="px-5 py-2 bg-accent-600 hover:bg-accent-700 text-white rounded-xl font-bold transition shadow-sm disabled:opacity-50"
                >
                  {submittingService ? t('saving') : t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Interval Modal */}
      {isAddIntervalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>{t('addPart')}</span>
              </h3>
              <button
                onClick={() => setIsAddIntervalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInterval} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  {t('partName')}
                </label>
                <select
                  value={intervalCategoryId}
                  onChange={(e) => setIntervalCategoryId(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-sky-500 shadow-sm"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {translateCategory(c.name)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  {t('customName')}
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder={lang === 'nl' ? 'Eigen benaming (optioneel)' : 'Custom name (optional)'}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 shadow-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    {t('intervalDistance')}
                  </label>
                  <input
                    type="number"
                    value={intervalKm}
                    onChange={(e) => setIntervalKm(e.target.value)}
                    placeholder="15000"
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white font-bold focus:outline-none focus:border-sky-500 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    {t('intervalTime')}
                  </label>
                  <input
                    type="number"
                    value={intervalMonths}
                    onChange={(e) => setIntervalMonths(e.target.value)}
                    placeholder="12"
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white font-bold focus:outline-none focus:border-sky-500 shadow-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <DatePicker
                    label={t('lastServiceDate')}
                    value={lastServiceDate}
                    onChange={setLastServiceDate}
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    {t('lastServiceKm')}
                  </label>
                  <input
                    type="number"
                    value={lastServiceOdo}
                    onChange={(e) => setLastServiceOdo(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-1.5 text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:border-sky-500 shadow-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddIntervalOpen(false)}
                  className="px-4 py-2 text-slate-500 hover:text-slate-800 dark:hover:text-white font-medium"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-accent-600 hover:bg-accent-700 text-white rounded-xl font-bold transition shadow-sm"
                >
                  {t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Interval Modal (Pencil Icon Trigger) */}
      {isEditIntervalOpen && editingInterval && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Edit2 className="w-4 h-4 text-sky-500" />
                <span>{t('editPart')}: {translateCategory(editingInterval.customName || editingInterval.categoryName)}</span>
              </h3>
              <button
                onClick={() => setIsEditIntervalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditInterval} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  {t('customName')}
                </label>
                <input
                  type="text"
                  value={editCustomName}
                  onChange={(e) => setEditCustomName(e.target.value)}
                  placeholder={translateCategory(editingInterval.categoryName)}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 shadow-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    {t('intervalDistance')}
                  </label>
                  <input
                    type="number"
                    value={editIntervalKm}
                    onChange={(e) => setEditIntervalKm(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white font-bold focus:outline-none focus:border-sky-500 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    {t('intervalTime')}
                  </label>
                  <input
                    type="number"
                    value={editIntervalMonths}
                    onChange={(e) => setEditIntervalMonths(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white font-bold focus:outline-none focus:border-sky-500 shadow-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <DatePicker
                    label={t('lastServiceDate')}
                    value={editLastDate}
                    onChange={setEditLastDate}
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    {t('lastServiceKm')}
                  </label>
                  <input
                    type="number"
                    value={editLastOdo}
                    onChange={(e) => setEditLastOdo(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-1.5 text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:border-sky-500 shadow-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditIntervalOpen(false)}
                  className="px-4 py-2 text-slate-500 hover:text-slate-800 dark:hover:text-white font-medium"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-accent-600 hover:bg-accent-700 text-white rounded-xl font-bold transition shadow-sm"
                >
                  {t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* In-app Document / Invoice Preview Modal */}
      {previewDoc && (
        <DocumentPreviewModal
          isOpen={previewDoc.isOpen}
          onClose={() => setPreviewDoc(null)}
          title={previewDoc.title}
          url={previewDoc.url}
          date={previewDoc.date}
          notes={previewDoc.notes}
        />
      )}
    </div>
  );
};
