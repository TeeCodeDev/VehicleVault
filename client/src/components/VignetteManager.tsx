import React, { useEffect, useMemo, useState } from 'react';
import {
  Tag,
  Plus,
  Pencil,
  Trash2,
  Receipt,
  X,
} from 'lucide-react';
import { Vehicle, VehicleVignette, VehicleDocument } from '../types/index.js';
import { apiFetch } from '../api/client.js';
import { useLanguage } from '../context/LanguageContext.js';
import { formatDisplayDate } from '../utils/format.js';
import { DatePicker } from './DatePicker.js';
import type { TranslationKey } from '../i18n/translations.js';

interface Props {
  vehicle: Vehicle;
}

type VignetteType = VehicleVignette['vignette_type'];

const COUNTRIES = [
  { code: 'AT', flag: '🇦🇹', defaultTypes: ['toll_digital', 'toll_sticker'] },
  { code: 'CH', flag: '🇨🇭', defaultTypes: ['toll_digital', 'toll_sticker'] },
  { code: 'FR', flag: '🇫🇷', defaultTypes: ['emission_sticker'] },
  { code: 'DE', flag: '🇩🇪', defaultTypes: ['emission_sticker'] },
  { code: 'SI', flag: '🇸🇮', defaultTypes: ['toll_digital'] },
  { code: 'CZ', flag: '🇨🇿', defaultTypes: ['toll_digital'] },
  { code: 'SK', flag: '🇸🇰', defaultTypes: ['toll_digital'] },
  { code: 'HU', flag: '🇭🇺', defaultTypes: ['toll_digital'] },
  { code: 'BE', flag: '🇧🇪', defaultTypes: ['other'] },
  { code: 'IT', flag: '🇮🇹', defaultTypes: ['toll_digital', 'other'] },
  { code: 'ES', flag: '🇪🇸', defaultTypes: ['emission_sticker', 'other'] },
  { code: 'OTHER', flag: '🌍', defaultTypes: ['other'] },
];

// Pre-filled type and name when picking a country for a new vignette
const COUNTRY_DEFAULTS: Record<string, { type: VignetteType; nameKey: TranslationKey }> = {
  AT: { type: 'toll_digital', nameKey: 'vignetteDefaultAT' },
  CH: { type: 'toll_digital', nameKey: 'vignetteDefaultCH' },
  FR: { type: 'emission_sticker', nameKey: 'vignetteDefaultFR' },
  DE: { type: 'emission_sticker', nameKey: 'vignetteDefaultDE' },
  SI: { type: 'toll_digital', nameKey: 'vignetteDefaultSI' },
};

const TYPE_LABEL_KEYS: Record<VignetteType, TranslationKey> = {
  toll_digital: 'vignetteTypeTollDigital',
  toll_sticker: 'vignetteTypeTollSticker',
  emission_sticker: 'vignetteTypeEmission',
  other: 'vignetteTypeOther',
};

const TYPE_OPTION_KEYS: Record<VignetteType, TranslationKey> = {
  toll_digital: 'vignetteOptionTollDigital',
  toll_sticker: 'vignetteOptionTollSticker',
  emission_sticker: 'vignetteOptionEmission',
  other: 'vignetteOptionOther',
};

export const VignetteManager: React.FC<Props> = ({ vehicle }) => {
  const { t, lang } = useLanguage();

  const regionNames = useMemo(() => {
    try {
      return new Intl.DisplayNames([lang], { type: 'region' });
    } catch {
      return null;
    }
  }, [lang]);

  const getCountryName = (code: string) => {
    if (code === 'OTHER') return t('vignetteOtherCountry');
    try {
      return regionNames?.of(code) || code;
    } catch {
      return code;
    }
  };

  const [vignettes, setVignettes] = useState<VehicleVignette[]>([]);
  const [documents, setDocuments] = useState<VehicleDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVignette, setEditingVignette] = useState<VehicleVignette | null>(null);

  // Form state
  const [country, setCountry] = useState('AT');
  const [vignetteType, setVignetteType] = useState<VignetteType>('toll_digital');
  const [name, setName] = useState('');
  const [validFrom, setValidFrom] = useState(new Date().toISOString().split('T')[0]);
  const [validUntil, setValidUntil] = useState('');
  const [cost, setCost] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadVignettes();
    loadDocuments();
  }, [vehicle.id]);

  const loadVignettes = async () => {
    try {
      setLoading(true);
      const res = await apiFetch<{ vignettes: VehicleVignette[] }>(`/api/vignettes/${vehicle.id}`);
      setVignettes(res.vignettes || []);
    } catch {
      setVignettes([]);
    } finally {
      setLoading(false);
    }
  };

  const loadDocuments = async () => {
    try {
      const res = await apiFetch<{ documents: VehicleDocument[] }>(`/api/documents/${vehicle.id}`);
      setDocuments(res.documents || []);
    } catch {
      setDocuments([]);
    }
  };

  const openCreateModal = () => {
    setEditingVignette(null);
    setCountry('AT');
    setVignetteType('toll_digital');
    setName(t('vignetteDefaultName'));
    setValidFrom(new Date().toISOString().split('T')[0]);
    setValidUntil('');
    setCost('');
    setReferenceNumber('');
    setDocumentId('');
    setNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (vig: VehicleVignette) => {
    setEditingVignette(vig);
    setCountry(vig.country || 'AT');
    setVignetteType(vig.vignette_type);
    setName(vig.name);
    setValidFrom(vig.valid_from || '');
    setValidUntil(vig.valid_until || '');
    setCost(vig.cost ? vig.cost.toString() : '');
    setReferenceNumber(vig.reference_number || '');
    setDocumentId(vig.document_id || '');
    setNotes(vig.notes || '');
    setIsModalOpen(true);
  };

  const handleCountryChange = (c: string) => {
    setCountry(c);
    const defaults = COUNTRY_DEFAULTS[c];
    if (!editingVignette && defaults) {
      setVignetteType(defaults.type);
      setName(t(defaults.nameKey));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      const payload = {
        vehicleId: vehicle.id,
        country,
        vignetteType,
        name: name.trim(),
        validFrom: validFrom || null,
        validUntil: validUntil || null,
        cost: cost ? parseFloat(cost) : 0,
        referenceNumber: referenceNumber.trim() || null,
        documentId: documentId || null,
        notes: notes.trim() || null,
      };

      if (editingVignette) {
        await apiFetch(`/api/vignettes/${editingVignette.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/vignettes', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      setIsModalOpen(false);
      loadVignettes();
    } catch (err: any) {
      alert(err?.message || t('vignetteSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('vignetteDeleteConfirm'))) return;
    try {
      await apiFetch(`/api/vignettes/${id}`, { method: 'DELETE' });
      loadVignettes();
    } catch {
      // ignore
    }
  };

  const getCountryInfo = (code: string) => ({
    flag: COUNTRIES.find((c) => c.code === code)?.flag || '🌍',
    name: getCountryName(code),
  });

  const getTypeLabel = (type: VignetteType) => t(TYPE_LABEL_KEYS[type] ?? 'vignetteTypeOther');

  const activeCount = vignettes.filter((v) => v.status === 'active' || v.status === 'lifetime').length;
  const totalCost = vignettes.reduce((acc, v) => acc + (Number(v.cost) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Banner & KPI summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 block mb-1 uppercase tracking-wider">
            {t('vignettesActive')}
          </span>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">{activeCount}</span>
            <span className="text-xs text-slate-500 font-semibold">{t('vignettesRegisteredCount', { count: vignettes.length })}</span>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 block mb-1 uppercase tracking-wider">
            {t('vignettesTotalCost')}
          </span>
          <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
            € {totalCost.toFixed(2)}
          </span>
        </div>

        <div className="p-4 bg-sky-50/60 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900/40 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-sky-900 dark:text-sky-300 block">
              {t('vignettesTravelTitle')}
            </span>
            <span className="text-[11px] text-sky-700/80 dark:text-sky-400 block mt-0.5">
              {t('vignettesTravelHint')}
            </span>
          </div>
          <button
            onClick={openCreateModal}
            className="px-3.5 py-2 bg-accent-600 hover:bg-accent-700 text-white rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 transition shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{t('vignettesAdd')}</span>
          </button>
        </div>
      </div>

      {/* Vignettes List */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800">
          {t('vignettesLoading')}
        </div>
      ) : vignettes.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-12 text-center shadow-sm">
          <Tag className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-white">
            {t('vignettesEmptyTitle')}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
            {t('vignettesEmptyHint')}
          </p>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-accent-600 hover:bg-accent-700 text-white rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>{t('vignettesAddFirst')}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vignettes.map((vig) => {
            const countryInfo = getCountryInfo(vig.country);
            const isLifetime = vig.status === 'lifetime';
            const isExpired = vig.status === 'expired';
            const isExpiring = vig.status === 'expiring_soon';
            const isFuture = vig.status === 'future';

            return (
              <div
                key={vig.id}
                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center space-x-2.5">
                      <span className="text-2xl select-none" role="img" aria-label={vig.country}>
                        {countryInfo.flag}
                      </span>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">{vig.name}</h4>
                        <span className="text-[10px] text-slate-400 font-semibold">{countryInfo.name}</span>
                      </div>
                    </div>

                    {/* Status badge */}
                    {isLifetime ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800 shrink-0">
                        {t('vignetteStatusLifetime')}
                      </span>
                    ) : isExpired ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800 shrink-0">
                        {t('vignetteStatusExpired')}
                      </span>
                    ) : isExpiring ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800 shrink-0">
                        {t('vignetteStatusExpiring', { days: vig.days_remaining ?? 0 })}
                      </span>
                    ) : isFuture ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800 shrink-0">
                        {t('vignetteStatusFuture', { days: vig.days_remaining ?? 0 })}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 shrink-0">
                        {t('vignetteStatusActive', { days: vig.days_remaining ?? 0 })}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-1.5 mb-3">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {getTypeLabel(vig.vignette_type)}
                    </span>
                    {Number(vig.cost) > 0 && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                        € {Number(vig.cost).toFixed(2)}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 mb-3">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">{t('vignetteValidFromLabel')}</span>
                      <span className="font-semibold">{vig.valid_from ? formatDisplayDate(vig.valid_from) : '—'}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">{t('vignetteValidUntilLabel')}</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {vig.valid_until ? formatDisplayDate(vig.valid_until) : t('vignetteIndefinite')}
                      </span>
                    </div>
                    {vig.reference_number && (
                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60 dark:border-slate-800">
                        <span className="text-slate-400">{t('vignetteRefLabel')}</span>
                        <span className="font-mono text-[10px] font-bold truncate max-w-[140px]">{vig.reference_number}</span>
                      </div>
                    )}
                  </div>

                  {vig.notes && (
                    <p className="text-[11px] text-slate-500 italic mb-3 line-clamp-2">
                      "{vig.notes}"
                    </p>
                  )}

                  {vig.document_file_path && (
                    <div className="mb-3">
                      <a
                        href={`/uploads/documents/${vig.document_file_path}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center space-x-1.5 text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:underline"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        <span className="truncate max-w-[200px]">{vig.document_name || t('vignetteViewProof')}</span>
                      </a>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end space-x-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => openEditModal(vig)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                    title={t('edit')}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(vig.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                    title={t('delete')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Tag className="w-4 h-4 text-sky-500" />
                <span>
                  {editingVignette ? t('vignetteEditTitle') : t('vignetteNewTitle')}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('vignetteCountry')}
                  </label>
                  <select
                    value={country}
                    onChange={(e) => handleCountryChange(e.target.value)}
                    className="w-full text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {getCountryName(c.code)}{c.code !== 'OTHER' ? ` (${c.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('vignetteTypeLabel')}
                  </label>
                  <select
                    value={vignetteType}
                    onChange={(e) => setVignetteType(e.target.value as any)}
                    className="w-full text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    {(Object.keys(TYPE_OPTION_KEYS) as VignetteType[]).map((type) => (
                      <option key={type} value={type}>
                        {t(TYPE_OPTION_KEYS[type])}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('vignetteNameLabel')}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t('vignetteNamePlaceholder')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <DatePicker
                    label={t('vignetteValidFrom')}
                    value={validFrom}
                    onChange={setValidFrom}
                  />
                </div>
                <div>
                  <DatePicker
                    label={t('vignetteValidUntil')}
                    value={validUntil}
                    onChange={setValidUntil}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('vignetteCost')}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    className="w-full text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('vignetteReference')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('examplePlaceholder', { value: 'ASFINAG-982137' })}
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    className="w-full text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('vignetteLinkedProof')}
                </label>
                <select
                  value={documentId}
                  onChange={(e) => setDocumentId(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="">{t('vignetteNoProof')}</option>
                  {documents.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({formatDisplayDate(d.document_date || d.created_at)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('vignetteNotesOptional')}
                </label>
                <textarea
                  rows={2}
                  placeholder={t('vignetteNotesPlaceholder')}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-bold bg-accent-600 hover:bg-accent-700 text-white rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {saving ? t('saving') : t('vignetteSave')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

