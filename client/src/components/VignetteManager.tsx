import React, { useEffect, useState } from 'react';
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

interface Props {
  vehicle: Vehicle;
}

const COUNTRIES = [
  { code: 'AT', name: 'Oostenrijk', flag: '🇦🇹', defaultTypes: ['toll_digital', 'toll_sticker'] },
  { code: 'CH', name: 'Zwitserland', flag: '🇨🇭', defaultTypes: ['toll_digital', 'toll_sticker'] },
  { code: 'FR', name: 'Frankrijk', flag: '🇫🇷', defaultTypes: ['emission_sticker'] },
  { code: 'DE', name: 'Duitsland', flag: '🇩🇪', defaultTypes: ['emission_sticker'] },
  { code: 'SI', name: 'Slovenië', flag: '🇸🇮', defaultTypes: ['toll_digital'] },
  { code: 'CZ', name: 'Tsjechië', flag: '🇨🇿', defaultTypes: ['toll_digital'] },
  { code: 'SK', name: 'Slowakije', flag: '🇸🇰', defaultTypes: ['toll_digital'] },
  { code: 'HU', name: 'Hongarije', flag: '🇭🇺', defaultTypes: ['toll_digital'] },
  { code: 'BE', name: 'België', flag: '🇧🇪', defaultTypes: ['other'] },
  { code: 'IT', name: 'Italië', flag: '🇮🇹', defaultTypes: ['toll_digital', 'other'] },
  { code: 'ES', name: 'Spanje', flag: '🇪🇸', defaultTypes: ['emission_sticker', 'other'] },
  { code: 'OTHER', name: 'Overig land', flag: '🌍', defaultTypes: ['other'] },
];

export const VignetteManager: React.FC<Props> = ({ vehicle }) => {
  const { lang } = useLanguage();
  const [vignettes, setVignettes] = useState<VehicleVignette[]>([]);
  const [documents, setDocuments] = useState<VehicleDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVignette, setEditingVignette] = useState<VehicleVignette | null>(null);

  // Form state
  const [country, setCountry] = useState('AT');
  const [vignetteType, setVignetteType] = useState<'toll_digital' | 'toll_sticker' | 'emission_sticker' | 'other'>('toll_digital');
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
    setName('Digitaal Tolvignet (10 dagen)');
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
    if (!editingVignette) {
      if (c === 'AT') {
        setVignetteType('toll_digital');
        setName('Digitaal Tolvignet Oostenrijk (10 dagen)');
      } else if (c === 'CH') {
        setVignetteType('toll_digital');
        setName('E-Vignet Zwitserland');
      } else if (c === 'FR') {
        setVignetteType('emission_sticker');
        setName("Crit'Air Milieusticker Categorie 1");
      } else if (c === 'DE') {
        setVignetteType('emission_sticker');
        setName('Umweltplakette Duitsland (Groen 4)');
      } else if (c === 'SI') {
        setVignetteType('toll_digital');
        setName('E-Vignet Slovenië (7 dagen)');
      }
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
      alert(err?.message || 'Fout bij opslaan van vignet');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(lang === 'nl' ? 'Weet je zeker dat je dit vignet wilt verwijderen?' : 'Delete this vignette?')) return;
    try {
      await apiFetch(`/api/vignettes/${id}`, { method: 'DELETE' });
      loadVignettes();
    } catch {
      // ignore
    }
  };

  const getCountryInfo = (code: string) => {
    return COUNTRIES.find((c) => c.code === code) || { flag: '🌍', name: code };
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'toll_digital':
        return lang === 'nl' ? 'Digitaal Tolvignet' : 'Digital Toll Vignette';
      case 'toll_sticker':
        return lang === 'nl' ? 'Fysieke Sticker' : 'Physical Toll Sticker';
      case 'emission_sticker':
        return lang === 'nl' ? 'Milieusticker' : 'Environmental Badge';
      default:
        return lang === 'nl' ? 'Overig Vignet' : 'Other Vignette';
    }
  };

  const activeCount = vignettes.filter((v) => v.status === 'active' || v.status === 'lifetime').length;
  const totalCost = vignettes.reduce((acc, v) => acc + (Number(v.cost) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Banner & KPI summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 block mb-1 uppercase tracking-wider">
            {lang === 'nl' ? 'Actieve Vignetten' : 'Active Vignettes'}
          </span>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">{activeCount}</span>
            <span className="text-xs text-slate-500 font-semibold">/ {vignettes.length} geregistreerd</span>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 block mb-1 uppercase tracking-wider">
            {lang === 'nl' ? 'Totale Kosten' : 'Total Expense'}
          </span>
          <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
            € {totalCost.toFixed(2)}
          </span>
        </div>

        <div className="p-4 bg-sky-50/60 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900/40 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-sky-900 dark:text-sky-300 block">
              {lang === 'nl' ? 'Vakantie & Reis Vignetten' : 'Travel & Toll Badges'}
            </span>
            <span className="text-[11px] text-sky-700/80 dark:text-sky-400 block mt-0.5">
              {lang === 'nl' ? 'Automatische herinnering vóór verloopdatum' : 'Automatic expiry notifications'}
            </span>
          </div>
          <button
            onClick={openCreateModal}
            className="px-3.5 py-2 bg-accent-600 hover:bg-accent-700 text-white rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 transition shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{lang === 'nl' ? 'Nieuw Vignet' : 'Add Vignette'}</span>
          </button>
        </div>
      </div>

      {/* Vignettes List */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800">
          {lang === 'nl' ? 'Vignetten laden...' : 'Loading vignettes...'}
        </div>
      ) : vignettes.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-12 text-center shadow-sm">
          <Tag className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-white">
            {lang === 'nl' ? 'Nog geen tolvignetten of milieustickers geregistreerd' : 'No vignettes registered yet'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
            {lang === 'nl'
              ? 'Houd al je tolvignetten voor Oostenrijk, Zwitserland, Frankrijk (Crit\'Air), Duitsland (Umweltplakette) en andere landen georganiseerd met automatische verval-alerts.'
              : 'Keep all your toll vignettes and low-emission badges organized with expiry notifications.'}
          </p>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-accent-600 hover:bg-accent-700 text-white rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>{lang === 'nl' ? 'Eerste Vignet Toevoegen' : 'Add First Vignette'}</span>
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
                        {lang === 'nl' ? 'Levenslang' : 'Lifetime'}
                      </span>
                    ) : isExpired ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800 shrink-0">
                        {lang === 'nl' ? 'Verlopen' : 'Expired'}
                      </span>
                    ) : isExpiring ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800 shrink-0">
                        {lang === 'nl' ? `Verloopt (${vig.days_remaining}d)` : `Expires (${vig.days_remaining}d)`}
                      </span>
                    ) : isFuture ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800 shrink-0">
                        {lang === 'nl' ? `Actief over ${vig.days_remaining}d` : `Starts in ${vig.days_remaining}d`}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 shrink-0">
                        {lang === 'nl' ? `Actief (${vig.days_remaining}d)` : `Active (${vig.days_remaining}d)`}
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
                      <span className="text-slate-400">{lang === 'nl' ? 'Geldig van:' : 'Valid from:'}</span>
                      <span className="font-semibold">{vig.valid_from ? formatDisplayDate(vig.valid_from) : '—'}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">{lang === 'nl' ? 'Geldig tot:' : 'Valid until:'}</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {vig.valid_until ? formatDisplayDate(vig.valid_until) : (lang === 'nl' ? 'Onbeperkt / Levenslang' : 'Indefinite')}
                      </span>
                    </div>
                    {vig.reference_number && (
                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60 dark:border-slate-800">
                        <span className="text-slate-400">{lang === 'nl' ? 'Bestel-/Vignetnr:' : 'Ref / Number:'}</span>
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
                        <span className="truncate max-w-[200px]">{vig.document_name || (lang === 'nl' ? 'Aankoopbewijs bekijken' : 'View invoice')}</span>
                      </a>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end space-x-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => openEditModal(vig)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                    title={lang === 'nl' ? 'Bewerken' : 'Edit'}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(vig.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                    title={lang === 'nl' ? 'Verwijderen' : 'Delete'}
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
                  {editingVignette
                    ? (lang === 'nl' ? 'Vignet / Milieusticker Bewerken' : 'Edit Vignette / Badge')
                    : (lang === 'nl' ? 'Nieuw Vignet of Milieusticker Toevoegen' : 'Add New Vignette / Badge')}
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
                    {lang === 'nl' ? 'Land' : 'Country'}
                  </label>
                  <select
                    value={country}
                    onChange={(e) => handleCountryChange(e.target.value)}
                    className="w-full text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'nl' ? 'Type Vignet / Sticker' : 'Vignette Type'}
                  </label>
                  <select
                    value={vignetteType}
                    onChange={(e) => setVignetteType(e.target.value as any)}
                    className="w-full text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="toll_digital">{lang === 'nl' ? 'Digitaal Tolvignet (E-Vignet)' : 'Digital Toll (E-Vignette)'}</option>
                    <option value="toll_sticker">{lang === 'nl' ? 'Fysieke Tolsticker' : 'Physical Toll Sticker'}</option>
                    <option value="emission_sticker">{lang === 'nl' ? 'Milieusticker (Crit\'Air / Umweltplakette)' : 'Low-Emission Badge'}</option>
                    <option value="other">{lang === 'nl' ? 'Overig Vignet / Pas' : 'Other Pass'}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'nl' ? 'Naam of Omschrijving' : 'Title / Description'} *
                </label>
                <input
                  type="text"
                  required
                  placeholder={lang === 'nl' ? 'bijv. Digitaal Vignet 10 Dagen' : 'e.g. 10-Day Digital Toll'}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <DatePicker
                    label={lang === 'nl' ? 'Geldig vanaf' : 'Valid from'}
                    value={validFrom}
                    onChange={setValidFrom}
                  />
                </div>
                <div>
                  <DatePicker
                    label={lang === 'nl' ? 'Geldig t/m (leeg = levenslang)' : 'Valid until (empty = lifetime)'}
                    value={validUntil}
                    onChange={setValidUntil}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'nl' ? 'Aanschafkosten (€)' : 'Cost (€)'}
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
                    {lang === 'nl' ? 'Bestel- / Referentienummer' : 'Order / Reference Nr'}
                  </label>
                  <input
                    type="text"
                    placeholder="bijv. ASFINAG-982137"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    className="w-full text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'nl' ? 'Gekoppeld Aankoopbewijs uit Documenten' : 'Linked Proof from Documents'}
                </label>
                <select
                  value={documentId}
                  onChange={(e) => setDocumentId(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="">{lang === 'nl' ? 'Geen aankoopbewijs gekoppeld' : 'No document linked'}</option>
                  {documents.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({formatDisplayDate(d.document_date || d.created_at)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'nl' ? 'Notities (optioneel)' : 'Notes (optional)'}
                </label>
                <textarea
                  rows={2}
                  placeholder={lang === 'nl' ? 'bijv. Gekocht voor zomervakantie naar Karinthië' : 'Optional notes...'}
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
                  {lang === 'nl' ? 'Annuleren' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-bold bg-accent-600 hover:bg-accent-700 text-white rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {saving ? (lang === 'nl' ? 'Opslaan...' : 'Saving...') : (lang === 'nl' ? 'Vignet Opslaan' : 'Save Vignette')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
